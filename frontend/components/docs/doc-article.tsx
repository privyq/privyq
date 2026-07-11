import { notFound } from "next/navigation";
import { getSection } from "@/lib/docs";
import { SECTION_CONTENT } from "@/components/docs/sections";
import { DocHeading } from "@/components/docs/prose";
import { DocPager } from "@/components/docs/doc-pager";

/**
 * Renders one docs section: its heading (from `DOC_SECTIONS`), the content
 * component for the slug, and the destination-titled prev/next pager. Used by
 * both `/docs` (introduction) and `/docs/[slug]`.
 */
export function DocArticle({ slug }: { slug: string }) {
  const section = getSection(slug);
  const Content = SECTION_CONTENT[slug];
  if (!section || !Content) notFound();

  return (
    <article className="min-w-0">
      <DocHeading eyebrow="Documentation" title={section.title} summary={section.summary} />
      <Content />
      <DocPager slug={slug} />
    </article>
  );
}
