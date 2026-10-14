import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Baytul Wisaal: Marriage is a big deal. Treat it like one.",
    template: "%s | Baytul Wisaal",
  },
  description:
    "A space where people learn how to build a strong, beautiful and formidable home. Start with a 30-day marriage-readiness programme.",
};

export const viewport: Viewport = {
  themeColor: "#17334B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-turquoise focus:px-4 focus:py-2 focus:text-nile"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
