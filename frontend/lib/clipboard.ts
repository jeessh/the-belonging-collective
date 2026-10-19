import type { ToastOptions } from "@/components/ui/Toast";

/**
 * Copy `text`; true when it worked. Clipboard access can be refused
 * (permissions, insecure origin), so the fallback shows the text in an alert
 * toast where it can still be read and copied by hand — not a browser prompt.
 */
export async function copyText(
  text: string,
  show: (opts: ToastOptions) => number,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    show({
      title: "Copying didn't work.",
      description: `Here is the link to copy: ${text}`,
      tone: "alert",
    });
    return false;
  }
}
