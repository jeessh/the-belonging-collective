"""Adoption numbers for grant applications.

Saves (a member keeping a program), registration-link clicks (the last step
we can see when sign-up happens on the agency's own site) and postings, over
a date range, for one organization or — for a superadmin — all of them.
Everything is aggregated in SQL; nothing here loads rows to count them.

Nothing is filtered on `deleted_at`: a save on a program that was later
un-published still happened, and un-saving only flips the attendance row's
status. Programs that have since been archived are marked as such instead.
"""

import csv
import io
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_host, get_db
from app.models.host import Host, org_id_of
from app.schemas.analytics import (
    AnalyticsOut,
    AnalyticsProgram,
    AnalyticsTotals,
    AnalyticsWeek,
)

router = APIRouter(tags=["analytics"])

# The programs happen in Kitchener-Waterloo; days and weeks are counted there.
TZ = ZoneInfo("America/Toronto")
DEFAULT_DAYS = 90
MAX_DAYS = 366 * 3

# Postgres date_trunc('week') starts weeks on Monday.
_WEEK = "date_trunc('week', {col} AT TIME ZONE 'America/Toronto')::date"


def _range(from_: date | None, to: date | None) -> tuple[date, date]:
    today = datetime.now(TZ).date()
    to = to or today
    from_ = from_ or to - timedelta(days=DEFAULT_DAYS)
    if from_ > to:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "'from' must be on or before 'to'")
    if (to - from_).days > MAX_DAYS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That range is too long.")
    return from_, to


def _scope(db: Session, host: Host, host_id: uuid.UUID | None) -> Host | None:
    """Whose numbers: your own organization's, or — for a superadmin — the
    organization asked for, or every organization's when none is."""
    if not host.is_superadmin:
        return host.org if host.org_id is not None else host
    if host_id is None:
        return None
    org = db.get(Host, host_id)
    if not org or org.org_id is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return org


def _compute(
    db: Session, org: Host | None, from_: date, to: date
) -> AnalyticsOut:
    start = datetime.combine(from_, datetime.min.time(), TZ)
    end = datetime.combine(to + timedelta(days=1), datetime.min.time(), TZ)
    params = {"start": start, "end": end, "org": org.id if org else None}
    # Same clause everywhere: with no org, `:org IS NULL` is true and the
    # comparison is skipped.
    org_clause = "(CAST(:org AS uuid) IS NULL OR e.host_id = :org)"

    def one(sql: str):
        return db.execute(text(sql), params).one()

    saves, unique_savers = one(
        f"""
        SELECT count(*), count(DISTINCT a.user_id)
        FROM event_attendees a JOIN events e ON e.id = a.event_id
        WHERE a.created_at >= :start AND a.created_at < :end AND {org_clause}
        """
    )
    (clicks,) = one(
        f"""
        SELECT count(*)
        FROM event_registration_clicks c JOIN events e ON e.id = c.event_id
        WHERE c.clicked_at >= :start AND c.clicked_at < :end AND {org_clause}
        """
    )
    (postings,) = one(
        f"""
        SELECT count(DISTINCT coalesce(e.series_id, e.id))
        FROM events e
        WHERE e.created_at >= :start AND e.created_at < :end AND {org_clause}
        """
    )

    # --- weekly series: three grouped queries, merged onto a full run of
    # weeks so the chart has a point for a quiet week too ---
    def weekly(sql: str) -> dict[date, int]:
        return {week: n for week, n in db.execute(text(sql), params).all()}

    w_saves = weekly(
        f"""
        SELECT {_WEEK.format(col='a.created_at')} AS week, count(*)
        FROM event_attendees a JOIN events e ON e.id = a.event_id
        WHERE a.created_at >= :start AND a.created_at < :end AND {org_clause}
        GROUP BY 1
        """
    )
    w_clicks = weekly(
        f"""
        SELECT {_WEEK.format(col='c.clicked_at')} AS week, count(*)
        FROM event_registration_clicks c JOIN events e ON e.id = c.event_id
        WHERE c.clicked_at >= :start AND c.clicked_at < :end AND {org_clause}
        GROUP BY 1
        """
    )
    w_postings = weekly(
        f"""
        SELECT {_WEEK.format(col='e.created_at')} AS week,
               count(DISTINCT coalesce(e.series_id, e.id))
        FROM events e
        WHERE e.created_at >= :start AND e.created_at < :end AND {org_clause}
        GROUP BY 1
        """
    )
    weeks: list[AnalyticsWeek] = []
    week = from_ - timedelta(days=from_.weekday())
    while week <= to:
        weeks.append(
            AnalyticsWeek(
                week=week,
                saves=w_saves.get(week, 0),
                clicks=w_clicks.get(week, 0),
                postings=w_postings.get(week, 0),
            )
        )
        week += timedelta(days=7)

    # --- per program: one row per series, with what happened to it in the
    # range. Listed if it was posted in the range or anything happened to it. ---
    rows = db.execute(
        text(
            f"""
            WITH p AS (
                SELECT coalesce(e.series_id, e.id) AS program_id,
                       (array_agg(e.id ORDER BY e.starts_at NULLS LAST, e.created_at))[1] AS event_id,
                       min(e.title) AS title,
                       min(e.starts_at) AS starts_at,
                       e.host_id,
                       min(e.created_at) AS created_at,
                       NOT bool_or(e.deleted_at IS NULL) AS archived
                FROM events e
                WHERE {org_clause}
                GROUP BY 1, e.host_id
            ),
            s AS (
                SELECT coalesce(e.series_id, e.id) AS program_id,
                       count(*) FILTER (WHERE a.created_at >= :start AND a.created_at < :end) AS saves,
                       count(*) FILTER (WHERE a.status = 'saved') AS going
                FROM event_attendees a JOIN events e ON e.id = a.event_id
                GROUP BY 1
            ),
            c AS (
                SELECT coalesce(e.series_id, e.id) AS program_id, count(*) AS clicks
                FROM event_registration_clicks c JOIN events e ON e.id = c.event_id
                WHERE c.clicked_at >= :start AND c.clicked_at < :end
                GROUP BY 1
            )
            SELECT p.program_id, p.event_id, p.title, p.starts_at, p.host_id, h.name,
                   coalesce(s.saves, 0), coalesce(s.going, 0), coalesce(c.clicks, 0),
                   p.archived
            FROM p
            JOIN hosts h ON h.id = p.host_id
            LEFT JOIN s ON s.program_id = p.program_id
            LEFT JOIN c ON c.program_id = p.program_id
            WHERE coalesce(s.saves, 0) > 0 OR coalesce(c.clicks, 0) > 0
               OR (p.created_at >= :start AND p.created_at < :end)
            ORDER BY coalesce(s.saves, 0) DESC, coalesce(c.clicks, 0) DESC, p.title
            """
        ),
        params,
    ).all()
    programs = [
        AnalyticsProgram(
            program_id=r[0],
            event_id=r[1],
            title=r[2],
            starts_at=r[3],
            host_id=r[4],
            host_name=r[5],
            saves=r[6],
            going=r[7],
            clicks=r[8],
            archived=r[9],
        )
        for r in rows
    ]

    return AnalyticsOut(
        from_=from_,
        to=to,
        host_id=org.id if org else None,
        host_name=org.name if org else None,
        totals=AnalyticsTotals(
            saves=saves, unique_savers=unique_savers, clicks=clicks, postings=postings
        ),
        weekly=weeks,
        programs=programs,
    )


@router.get("/analytics", response_model=AnalyticsOut, response_model_by_alias=True)
def analytics(
    from_: date | None = Query(None, alias="from"),
    to: date | None = None,
    host_id: uuid.UUID | None = None,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    from_, to = _range(from_, to)
    return _compute(db, _scope(db, host, host_id), from_, to)


def _cell(text: str | None) -> str:
    """Organizer-written text, safe for a spreadsheet: a leading = + - or @
    would otherwise run as a formula when the file is opened in Excel."""
    text = text or ""
    return "'" + text if text[:1] in ("=", "+", "-", "@") else text


@router.get("/analytics.csv")
def analytics_csv(
    from_: date | None = Query(None, alias="from"),
    to: date | None = None,
    host_id: uuid.UUID | None = None,
    host: Host = Depends(get_current_host),
    db: Session = Depends(get_db),
):
    """The same numbers as a spreadsheet, for pasting into an application."""
    from_, to = _range(from_, to)
    out = _compute(db, _scope(db, host, host_id), from_, to)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["The Belonging Collective — program analytics"])
    w.writerow(["From", from_.isoformat()])
    w.writerow(["To", to.isoformat()])
    w.writerow(["Organization", out.host_name or "All organizations"])
    w.writerow([])
    w.writerow(["Totals"])
    w.writerow(["Saves (including later un-saved)", out.totals.saves])
    w.writerow(["Unique members who saved", out.totals.unique_savers])
    w.writerow(["Registration-link clicks", out.totals.clicks])
    w.writerow(["Programs posted", out.totals.postings])
    w.writerow([])
    w.writerow(["Week starting", "Saves", "Registration-link clicks", "Programs posted"])
    for wk in out.weekly:
        w.writerow([wk.week.isoformat(), wk.saves, wk.clicks, wk.postings])
    w.writerow([])
    w.writerow(
        [
            "Program",
            "First date",
            "Organization",
            "Saves",
            "Currently going",
            "Registration-link clicks",
            "Status",
        ]
    )
    for p in out.programs:
        w.writerow(
            [
                _cell(p.title),
                p.starts_at.astimezone(TZ).date().isoformat() if p.starts_at else "",
                _cell(p.host_name),
                p.saves,
                p.going,
                p.clicks,
                "Archived" if p.archived else "Live",
            ]
        )

    filename = f"analytics-{from_.isoformat()}-to-{to.isoformat()}.csv"
    return Response(
        buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
