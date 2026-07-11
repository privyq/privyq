"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/doc-code";
import { useDocLang, type DocLang } from "@/components/docs/lang-provider";

const TABS: { id: DocLang; label: string }[] = [
  { id: "python", label: "Python" },
  { id: "typescript", label: "TypeScript" },
];

/**
 * A code block shown in both Python and TypeScript, with a language toggle that
 * is synced across the whole docs (via `DocLangProvider`) and remembered. The
 * active tab picks the sample; the copy button copies whatever is showing.
 */
export function CodeTabs({
  python,
  typescript,
  title,
}: {
  python: string;
  typescript: string;
  title?: string;
}) {
  const { lang, setLang } = useDocLang();
  const code = lang === "python" ? python : typescript;

  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-tint/70">
      <div className="flex items-center justify-between gap-2 border-b border-line/80 bg-white/50 px-2 py-1.5">
        <div role="tablist" aria-label="Code language" className="flex items-center gap-1">
          {TABS.map((t) => {
            const active = t.id === lang;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLang(t.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 font-mono text-[.7rem] font-semibold uppercase tracking-widest transition-colors",
                  active ? "bg-ink text-white" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
          {title && (
            <span className="ml-1.5 hidden font-mono text-[.68rem] text-muted sm:inline">{title}</span>
          )}
        </div>
        <CopyButton value={code} />
      </div>
      <pre className="scroll-thin overflow-x-auto px-4 py-3.5 text-[.82rem] leading-relaxed text-ink-2">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
