import type { Event } from "@/lib/api";
import { Avatar } from "@/components/ui/Avatar";

/**
 * "Posted by" under an event's title in the console: the person who posted it
 * and the organization they're from, with their picture — "Posted by Sam
 * Lee · Karis Disability Services". Posted from the organization's shared
 * login (or imported, with no poster on record), it's just the organization,
 * with its logo. Staff logins have no photo, so they get their initials.
 */
export function PostedBy({ event }: { event: Event }) {
  const person =
    event.created_by_name && event.created_by_name !== event.host_name
      ? event.created_by_name
      : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {person ? (
        <Avatar name={person} src={event.created_by_picture} size={24} />
      ) : (
        <Avatar
          name={event.host_name}
          src={event.host_logo_url ?? event.created_by_picture}
          size={24}
        />
      )}
      <span>
        Posted by{" "}
        <span className="font-medium text-fg">{person ?? event.host_name}</span>
        {person && <> · {event.host_name}</>}
      </span>
    </span>
  );
}
