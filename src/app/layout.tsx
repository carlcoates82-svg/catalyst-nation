import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catalyst Nation",
  description: "The Catalyst Nation operating system for ventures and their CEOs.",
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-graphite text-off-white">
        {children}
      </body>
    </html>
  );
}
