import * as React from "react";
import { cn } from "@/lib/utils";

/** Page heading for a docs section (eyebrow + title + summary). */
export function DocHeading({
  eyebrow,
  title,
  summary,
}: {
  eyebrow: string;
  title: string;
  summary?: string;
}) {
  return (
    <div className="mb-6 border-b border-line pb-4">
      <p className="mb-1 font-mono text-[.68rem] uppercase tracking-widest text-blue">{eyebrow}</p>
      <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-[2.1rem]">{title}</h1>
      {summary && <p className="mt-2 text-base text-muted">{summary}</p>}
    </div>
  );
}

/** A sub-heading within a section. */
export function H3({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-2 font-display text-lg font-bold tracking-tight text-ink">{children}</h2>;
}

/** A body paragraph. */
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[.95rem] leading-relaxed text-ink-2">{children}</p>;
}

export function Callout({
  tone = "blue",
  children,
}: {
  tone?: "blue" | "amber" | "mint";
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue/30 bg-blue/[.06]",
    amber: "border-amber/40 bg-amber/[.08]",
    mint: "border-mint/40 bg-mint/[.07]",
  } as const;
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm text-ink-2 [&_a]:font-semibold [&_a]:text-blue [&_a]:underline",
        tones[tone],
      )}
    >
      {children}
    </div>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-tint/60">
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 font-mono text-[.68rem] font-semibold uppercase tracking-widest text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/70 last:border-0 hover:bg-tint/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-ink-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Vertical rhythm wrapper for a section's body. */
export function DocBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>;
}
