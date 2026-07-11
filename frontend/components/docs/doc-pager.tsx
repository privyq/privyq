import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { docHref, nextSection, prevSection } from "@/lib/docs";

/**
 * Bottom-of-page prev/next pager. The prominent label on each button is the
 * DESTINATION page's title (e.g. `← Configuration`, `check & explain →`) with a
 * small muted "Previous"/"Next" caption above it. Order comes from `DOC_SECTIONS`.
 */
export function DocPager({ slug }: { slug: string }) {
  const prev = prevSection(slug);
  const next = nextSection(slug);

  return (
    <nav aria-label="Pagination" className="mt-14 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
      {prev ? (
        <Link
          href={docHref(prev.slug)}
          className={cn(
            "group flex flex-col gap-1 rounded-xl border border-line bg-white p-4 transition-colors hover:border-ink",
            "sm:col-start-1",
          )}
        >
          <span className="flex items-center gap-1.5 font-mono text-[.68rem] font-semibold uppercase tracking-widest text-muted">
            <ArrowLeft className="h-3.5 w-3.5" /> Previous
          </span>
          <span className="font-display text-base font-bold text-ink">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden sm:block" aria-hidden="true" />
      )}

      {next && (
        <Link
          href={docHref(next.slug)}
          className="group flex flex-col items-end gap-1 rounded-xl border border-line bg-white p-4 text-right transition-colors hover:border-ink sm:col-start-2"
        >
          <span className="flex items-center gap-1.5 font-mono text-[.68rem] font-semibold uppercase tracking-widest text-muted">
            Next <ArrowRight className="h-3.5 w-3.5" />
          </span>
          <span className="font-display text-base font-bold text-ink">{next.title}</span>
        </Link>
      )}
    </nav>
  );
}
