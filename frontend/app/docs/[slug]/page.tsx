import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/docs/doc-article";
import { DOC_SECTIONS, getSection } from "@/lib/docs";

/** Prerender every section except the introduction (which lives at /docs). */
export function generateStaticParams(): { slug: string }[] {
  return DOC_SECTIONS.filter((s) => s.slug !== "introduction").map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const section = getSection(params.slug);
  if (!section) return { title: "Documentation — PrivyQ" };
  return {
    title: `${section.title} — PrivyQ docs`,
    description: section.summary,
  };
}

export default function DocsSectionPage({ params }: { params: { slug: string } }) {
  const section = getSection(params.slug);
  if (!section || section.slug === "introduction") notFound();
  return <DocArticle slug={params.slug} />;
}
