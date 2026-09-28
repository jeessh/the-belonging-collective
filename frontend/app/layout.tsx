import type { Metadata } from "next";
import { Lexend_Deca } from "next/font/google";
import { siteUrl } from "@/lib/serverApi";
import { MotionRoot } from "@/components/MotionRoot";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const lexend = Lexend_Deca({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  // metadataBase is what makes per-page canonical and OG URLs resolve; without
  // it Next emits relative og:url, which link previews ignore.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "The Belonging Collective",
    // Program pages supply their own name; this keeps the source visible in
    // search results and browser tabs without each page repeating it.
    template: "%s · The Belonging Collective",
  },
  description: "Find community programs that fit you, all in one place.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={lexend.variable}>
      <body>
        <MotionRoot>
          <ToastProvider>{children}</ToastProvider>
        </MotionRoot>
      </body>
    </html>
  );
}
