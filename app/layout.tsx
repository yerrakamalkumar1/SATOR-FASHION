import type { Metadata } from "next";
import "./globals.css";
import "./entry.css";
import "./portals.css";
import "./journey.css";
import "./community.css";
import "./notifications.css";
import "./opening.css";
import "./account.css";
import "./members.css";
import "./search-tools.css";
import "./appearance.css";
import "./appearance-generated.css";
import "./creative.css";

export const metadata: Metadata = {
  title: "ŚATOR — Wear your imagination",
  description: "Discover independent design. Make something entirely yours.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="preload" as="image" href="/images/sator-editorial.png" /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
