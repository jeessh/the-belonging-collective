/** Google Maps' own mark, for the buttons that open a place in it. */
export function GoogleMapsIcon({ className = "size-6" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/google-maps.png"
      alt=""
      aria-hidden="true"
      width={24}
      height={24}
      className={`shrink-0 ${className}`}
    />
  );
}
