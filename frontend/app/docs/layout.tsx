"use client";

import { DocLangProvider } from "@/components/docs/lang-provider";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

/**
 * Docs shell: a persistent left sidebar (current section highlighted) beside the
 * article. The language toggle state (Python | TypeScript) is provided here so
 * every code block on every page stays in sync and remembers the reader's choice.
 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocLangProvider>
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-20 lg:h-max lg:self-start">
          <DocsSidebar />
        </aside>
        {children}
      </div>
    </DocLangProvider>
  );
}
