import { fetchEvent, siteUrl } from "@/lib/serverApi";
import { EVENT_PLACEHOLDER, eventImage } from "@/lib/eventImage";

// The program's picture for email, so the mail code needn't know how the site
// picks one. A stock photo goes to its 2:1 copy in /placeholders/email: mail
// apps ignore object-fit, so a portrait one would come out a foot tall. An
// organizer's own upload goes as it is.
//
// Never fails: a mail app shows a broken image for good, so a backend blip
// gets the generic photo rather than a 500. The redirect is built on
// siteUrl(), not the request's URL, which behind a self-hosted proxy can be
// the internal localhost:3000.
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const event = await fetchEvent(params.id).catch(() => null);
  const image = event ? eventImage(event) : EVENT_PLACEHOLDER;
  const target = image.startsWith("/placeholders/")
    ? image.replace("/placeholders/", "/placeholders/email/")
    : image;
  return Response.redirect(new URL(target, siteUrl()), 302);
}
