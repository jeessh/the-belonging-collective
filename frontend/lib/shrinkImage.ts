/**
 * A photo from a phone is often 3–5 MB and 4000px across; a profile picture
 * is drawn at 72px and the API takes 2 MB at most. So the browser scales it
 * down to `max` px on its longer side and re-encodes it as a JPEG before it
 * is sent — well under the limit, and a much shorter upload on a slow
 * connection.
 *
 * Already-small images go up as they are. Anything the browser can't decode
 * here is also sent unchanged, so the API's own checks (type, size) still
 * give the member a reason rather than this failing silently.
 */
export async function shrinkImage(
  file: File,
  max = 512,
  quality = 0.88,
): Promise<File> {
  try {
    // Honours EXIF orientation, so a portrait photo stays upright.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // JPEG has no transparency: a see-through PNG goes onto white, not black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const name = `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
