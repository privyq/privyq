"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Github, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/role-switcher";
import { CoreStatus } from "@/components/core-status";

export const GITHUB_URL = "https://github.com/privyq/privyq";
export const PYPI_URL = "https://pypi.org/project/privyq/";

const APP_NAV = [
  { href: "/app", label: "Dashboard" },
  { href: "/records", label: "Records" },
  { href: "/audit", label: "Audit" },
  { href: "/keys", label: "Keys" },
  { href: "/playground", label: "Playground" },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true" role="img">
      <rect width="32" height="32" rx="9" fill="#0B0C10" />
      <path d="M10 23V9h7.5a5.5 5.5 0 0 1 0 11H13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="22.5" r="3" fill="#2B3AFF" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const marketing = pathname === "/" || pathname.startsWith("/docs");

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-wrap flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href={marketing ? "/" : "/app"} className="flex items-center gap-2.5" aria-label="PrivyQ home">
          <BrandMark />
          <span className="font-display text-[1.05rem] font-extrabold tracking-tight">PrivyQ</span>
          {!marketing && (
            <span className="hidden font-mono text-[.62rem] uppercase tracking-widest text-muted md:inline">demo</span>
          )}
        </Link>

        {marketing ? (
          <>
            <nav className="order-3 flex w-full items-center gap-1 lg:order-none lg:ml-4 lg:w-auto" aria-label="Main">
              <Link href="/docs" className={navClass(pathname.startsWith("/docs"))}>Docs</Link>
              <a href={GITHUB_URL} target="_blank" rel="noopener" className={navClass(false)}>GitHub</a>
              <a href={PYPI_URL} target="_blank" rel="noopener" className={navClass(false)}>PyPI</a>
            </nav>
            <Link
              href="/app"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              Launch demo <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto scroll-thin lg:order-none lg:w-auto" aria-label="Main">
              {APP_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className={navClass(isActive(pathname, item.href))}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/docs" className={navClass(false)}>Docs</Link>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <a href={GITHUB_URL} target="_blank" rel="noopener" aria-label="GitHub" className="hidden text-muted hover:text-ink sm:block">
                <Github className="h-5 w-5" />
              </a>
              <CoreStatus />
              <RoleSwitcher />
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/app" ? pathname === "/app" : pathname.startsWith(href);
}

function navClass(active: boolean): string {
  return cn(
    "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
    active ? "bg-ink text-white" : "text-muted hover:text-ink",
  );
}
