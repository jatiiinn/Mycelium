import type { Metadata, Viewport } from "next";
import "./globals.css";

// Typography note: using a clean system stack for now so the build has no
// font-fetch dependency. When the UI reference images arrive, swap in the
// exact typeface (next/font makes that a two-line change here).

export const metadata: Metadata = {
  title: "mycelium",
  description: "A private network of saved things.",
};

export const viewport: Viewport = {
  themeColor: "#0e0f0d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-ink text-fog min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
