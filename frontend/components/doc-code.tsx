"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard button. Degrades gracefully when the Clipboard API is
 * unavailable (older browsers, insecure origins) by hiding itself.
 */
export function CopyButton({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  const [supported, setSupported] = React.useState(true);

  React.useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" && !!navigator.clipboard?.writeText,
    );
  }, []);

  if (!supported) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white/70 px-2.5 py-1.5 font-mono text-[.7rem] font-semibold text-muted backdrop-blur transition-colors hover:border-ink hover:text-ink",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-mint" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}

/**
 * Styled code block with an optional language tag and a copy button.
 * `title` renders a small file/label chip in the header row.
 */
export function CodeBlock({
  code,
  lang,
  title,
  className,
}: {
  code: string;
  lang?: string;
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-line bg-tint/70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line/80 bg-white/50 px-3 py-1.5">
        <span className="font-mono text-[.68rem] font-semibold uppercase tracking-widest text-muted">
          {title ?? lang ?? "code"}
        </span>
        <CopyButton value={code} />
      </div>
      <pre className="scroll-thin overflow-x-auto px-4 py-3.5 text-[.82rem] leading-relaxed text-ink-2">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

/** Inline monospace token. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-line bg-tint px-1.5 py-0.5 font-mono text-[.82em] text-ink-2">
      {children}
    </code>
  );
}
