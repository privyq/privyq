"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { docGroups, docHref } from "@/lib/docs";

const GITHUB_URL = "https://github.com/privyq/privyq";
const PYPI_URL = "https://pypi.org/project/privyq/";

/** Persistent docs sidebar — lists every section, grouped, current highlighted. */
export function DocsSidebar() {
  const pathname = usePathname();
  const groups = docGroups();

  return (
    <nav aria-label="Documentation" className="flex flex-col gap-5">
      {groups.map(({ group, sections }) => (
        <div key={group}>
          <p className="mb-1.5 px-3 font-mono text-[.62rem] font-semibold uppercase tracking-widest text-muted">
            {group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {sections.map((s) => {
              const href = docHref(s.slug);
              const active = pathname === href;
              return (
                <li key={s.slug}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
                      active ? "bg-ink text-white" : "text-muted hover:bg-tint hover:text-ink",
                    )}
                  >
                    {s.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="flex flex-col gap-1.5 border-t border-line px-3 pt-4">
        <a href={PYPI_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          PyPI <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          GitHub <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <Link href="/explorer" className="flex items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
          Decision Explorer <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  );
}
