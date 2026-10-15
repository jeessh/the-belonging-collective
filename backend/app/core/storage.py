"""Upload helper: Supabase Storage or a local folder (STORAGE_BACKEND).

Supabase: uploads bytes to a public bucket using the SECRET key (server-side
only) and returns the public URL. Kept dependency-light — talks to the Storage
REST API directly with httpx rather than pulling in the full supabase client.

Local: writes the bytes to UPLOAD_DIR under a random name and returns
UPLOAD_PUBLIC_URL + name. main.py serves UPLOAD_DIR at /uploads.
"""

import asyncio
import uuid
from pathlib import Path

import httpx

from app.core.config import settings

# Map a MIME type to a file extension for the stored object's name. Every type
# here must also be allowed by the bucket, or Storage rejects the upload.
_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
}


class StorageError(RuntimeError):
    """Raised when the upload cannot be performed or the bucket rejects it."""


async def upload_image(data: bytes, content_type: str) -> str:
    """Upload file bytes (an image or a PDF poster) to the bucket; return the public URL.

    Async so the (up to 30s) storage round trip never blocks the event loop.
    Raises StorageError if storage isn't configured or the upload fails.
    """
    ext = _EXT.get(content_type)
    if ext is None:
        raise StorageError(f"Unsupported file type: {content_type}")
    key = f"{uuid.uuid4()}.{ext}"

    if settings.STORAGE_BACKEND == "local":
        return await _upload_local(data, key)

    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise StorageError("File storage is not configured on the server.")

    bucket = settings.SUPABASE_IMAGE_BUCKET
    base = settings.SUPABASE_URL.rstrip("/")
    upload_url = f"{base}/storage/v1/object/{bucket}/{key}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                upload_url,
                content=data,
                headers={
                    "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
                    "apikey": settings.SUPABASE_SECRET_KEY,
                    "Content-Type": content_type,
                    "cache-control": "3600",
                },
            )
    except httpx.HTTPError as exc:
        raise StorageError(f"Could not reach file storage: {exc}") from exc

    if res.status_code >= 400:
        raise StorageError(f"Storage rejected the upload ({res.status_code}): {res.text}")

    # Public bucket → the object is served at this stable URL.
    return f"{base}/storage/v1/object/public/{bucket}/{key}"


def upload_dir() -> Path:
    """The local upload folder, created if missing."""
    path = Path(settings.UPLOAD_DIR)
    path.mkdir(parents=True, exist_ok=True)
    return path


def upload_public_url() -> str:
    """URL prefix local uploads are served from, without a trailing slash."""
    if settings.UPLOAD_PUBLIC_URL:
        return settings.UPLOAD_PUBLIC_URL.rstrip("/")
    return f"{settings.FRONTEND_ORIGIN.rstrip('/')}{settings.ROOT_PATH}/uploads"


async def _upload_local(data: bytes, key: str) -> str:
    try:
        await asyncio.to_thread((upload_dir() / key).write_bytes, data)
    except OSError as exc:
        raise StorageError(f"Could not save the file: {exc}") from exc
    return f"{upload_public_url()}/{key}"
