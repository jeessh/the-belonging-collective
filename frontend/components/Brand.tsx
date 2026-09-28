/** KW Habilitation's logo, with the app's own name beside it. */
export function Brand() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/kwhab-logo.png"
        alt="KW Habilitation"
        width={153}
        height={53}
        className="h-10 w-auto"
      />
      <span aria-hidden="true" className="h-8 w-px shrink-0 bg-line" />
      <span className="text-xl font-medium leading-tight sm:text-2xl">
        The Belonging Collective
      </span>
    </>
  );
}
