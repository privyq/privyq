"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "@/components/role-switcher";
import { CoreStatus } from "@/components/core-status";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/records", label: "Records" },
  { href: "/audit", label: "Audit" },
  { href: "/keys", label: "Keys" },
  { href: "/playground", label: "Playground" },
];

function BrandMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7"
      aria-hidden="true"
      role="img"
    >
      <rect width="32" height="32" rx="9" fill="#0B0C10" />
      <path
        d="M10 23V9h7.5a5.5 5.5 0 0 1 0 11H13"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22" cy="22.5" r="3" fill="#2B3AFF" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-wrap flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PrivyQ home">
          <BrandMark />
          <span className="font-display text-[1.05rem] font-extrabold tracking-tight">
            PrivyQ
          </span>
          <span className="hidden font-mono text-[.62rem] uppercase tracking-widest text-muted md:inline">
            demo
          </span>
        </Link>

        <nav
          className="order-3 flex w-full items-center gap-1 overflow-x-auto scroll-thin lg:order-none lg:w-auto"
          aria-label="Main"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                isActive(item.href)
                  ? "bg-ink text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <CoreStatus />
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}
