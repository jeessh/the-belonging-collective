import { ImageResponse } from "next/og";
import { fetchEvent } from "@/lib/serverApi";
import { longDate } from "@/lib/time";

// The link-preview card for a program with no cover image. `generateMetadata`
// points OG/Twitter here only in that case, so a program with a cover keeps
// its own picture and this is never fetched for it.
export const revalidate = 60;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const event = await fetchEvent(params.id);
  if (!event) return new Response("Not found", { status: 404 });

  const when = longDate(event.starts_at) || "Date to be announced";
  const where = event.location || (event.is_virtual ? "Online" : "");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#E5FAFF",
          color: "#1A1A1A",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 32,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#6D6D6D",
          }}
        >
          The Belonging Collective
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: event.title.length > 60 ? 56 : 72,
              fontWeight: 700,
              lineHeight: 1.1,
              // Satori has no line clamp; cut long titles before they overflow.
              display: "block",
              lineClamp: 3,
            }}
          >
            {event.title}
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 36 }}>
            <span>{when}</span>
            {where && <span style={{ color: "#6D6D6D" }}>· {where}</span>}
          </div>
        </div>
        <div
          style={{
            height: 16,
            width: 240,
            borderRadius: 8,
            background: "#00CDFF",
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
