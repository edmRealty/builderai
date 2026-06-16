import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://builder.housingpa.com"),
  title: {
    default: "Contractor Builder Software | Housing Pro Assets",
    template: "%s | Builder"
  },
  description: "Contractor / Builder is part of Housing Pro Assets: construction project tracking, draw requests, permits, inspections, vendors, and field coordination for real estate teams.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Contractor Builder Software | Housing Pro Assets",
    description: "Construction project tracking, draw requests, permits, inspections, vendors, and real estate field coordination.",
    url: "https://builder.housingpa.com/",
    siteName: "Builder by Housing Pro Assets",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Contractor Builder Software",
    description: "Construction operations software from Housing Pro Assets."
  }
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-bg text-fg antialiased">{children}</body>
    </html>
  );
}
