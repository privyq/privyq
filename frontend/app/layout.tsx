import type { Metadata } from "next";
import "./globals.css";
import { IdentityProvider } from "@/components/providers/identity-provider";
import { RecordsProvider } from "@/components/providers/records-provider";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "PrivyQ — Describe access. Don't code it.",
  description:
    "The trust-infrastructure SDK: describe access policies instead of writing " +
    "authorization code. PBAC/ABAC decisions you can explain, tamper-evident evidence " +
    "for compliance, and post-quantum encryption as the floor. Open source.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/*
          Fonts are loaded via <link> (as in the original design prototype) rather than
          next/font/google so `next build` never needs to fetch fonts from the
          network — keeping the build deterministic and offline-friendly.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- global font, loaded via link (see comment above) not next/font, to keep the build offline-friendly */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <div className="grain" aria-hidden="true" />
        <div className="aurora" aria-hidden="true">
          <span className="blob blob--a animate-drift-a" />
          <span className="blob blob--b animate-drift-b" />
          <span className="blob blob--c animate-drift-c" />
        </div>

        <IdentityProvider>
          <RecordsProvider>
            <SiteHeader />
            <main id="main" className="mx-auto max-w-wrap px-5 py-8 md:py-10">
              {children}
            </main>
          </RecordsProvider>
        </IdentityProvider>
      </body>
    </html>
  );
}
