import type { Metadata } from "next";
import { DocArticle } from "@/components/docs/doc-article";
import { getSection } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation — PrivyQ",
  description: getSection("introduction")?.summary,
};

export default function DocsIndexPage() {
  return <DocArticle slug="introduction" />;
}
