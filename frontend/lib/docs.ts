/**
 * The docs are an *ordered* set of pages. This module is the single source of
 * truth for that order — the sidebar, the prev/next pager, and route
 * generation all derive from `DOC_SECTIONS`. The introduction lives at `/docs`;
 * every other section at `/docs/<slug>`.
 */

export interface DocSection {
  slug: string;
  /** The page name — this is what the pager buttons display. */
  title: string;
  /** Sidebar grouping. */
  group: string;
  /** One-line summary shown under the page heading. */
  summary: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "introduction",
    title: "Introduction",
    group: "Getting started",
    summary:
      "PrivyQ is the trust-infrastructure SDK: describe access policies instead of writing authorization code.",
  },
  {
    slug: "installation",
    title: "Installation",
    group: "Getting started",
    summary: "Install the Python or TypeScript SDK and point it at a running core or gateway.",
  },
  {
    slug: "configuration",
    title: "Configuration",
    group: "Getting started",
    summary: "Tell the SDK where the core/gateway lives and set your defaults.",
  },
  {
    slug: "protect-access",
    title: "protect & access",
    group: "Verbs",
    summary: "Encrypt data with an embedded policy, then authorize and reveal it.",
  },
  {
    slug: "check-explain",
    title: "check & explain",
    group: "Verbs",
    summary: "The pure authorization decision — a Decision you can explain, with no data revealed.",
  },
  {
    slug: "seal-verify",
    title: "seal & verify",
    group: "Verbs",
    summary: "Post-quantum digital signatures, and verifying signatures or audit evidence.",
  },
  {
    slug: "evidence",
    title: "evidence & audit export",
    group: "Verbs",
    summary: "Query the tamper-evident audit trail and export it for compliance.",
  },
  {
    slug: "keys",
    title: "keys",
    group: "Verbs",
    summary: "Generate, fetch, rotate, and revoke post-quantum keys.",
  },
  {
    slug: "policies",
    title: "policies",
    group: "Guides",
    summary: "Shorthand, structured, generic attributes, custom_logic, deny rules, and obligations.",
  },
  {
    slug: "compliance",
    title: "compliance",
    group: "Guides",
    summary: "Map the evidence chain onto GDPR / HIPAA / SOC 2 controls and export it.",
  },
  {
    slug: "wallet",
    title: "wallet identity",
    group: "Guides",
    summary: "Turn a signed wallet/DID challenge into a verified subject attribute, plus break-glass.",
  },
  {
    slug: "rest-api",
    title: "REST API reference",
    group: "Reference",
    summary: "The FastAPI gateway endpoints — the client↔gateway contract.",
  },
];

/** The href for a section — the introduction is the docs index. */
export function docHref(slug: string): string {
  return slug === "introduction" ? "/docs" : `/docs/${slug}`;
}

export function getSection(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.slug === slug);
}

export function sectionIndex(slug: string): number {
  return DOC_SECTIONS.findIndex((s) => s.slug === slug);
}

export function prevSection(slug: string): DocSection | undefined {
  const i = sectionIndex(slug);
  return i > 0 ? DOC_SECTIONS[i - 1] : undefined;
}

export function nextSection(slug: string): DocSection | undefined {
  const i = sectionIndex(slug);
  return i >= 0 && i < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[i + 1] : undefined;
}

/** Sidebar groups, in order, each with its ordered sections. */
export function docGroups(): { group: string; sections: DocSection[] }[] {
  const out: { group: string; sections: DocSection[] }[] = [];
  for (const s of DOC_SECTIONS) {
    const last = out[out.length - 1];
    if (last && last.group === s.group) last.sections.push(s);
    else out.push({ group: s.group, sections: [s] });
  }
  return out;
}
