"use client";

import * as React from "react";

export type DocLang = "python" | "typescript";

interface LangContextValue {
  lang: DocLang;
  setLang: (lang: DocLang) => void;
}

const LangContext = React.createContext<LangContextValue | null>(null);

const STORAGE_KEY = "privyq.docs.lang";

/**
 * Holds the docs-wide code language choice (Python | TypeScript). Defaults to
 * Python and remembers the reader's choice across pages via localStorage.
 */
export function DocLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<DocLang>("python");

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "python" || stored === "typescript") setLangState(stored);
  }, []);

  const setLang = React.useCallback((next: DocLang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — choice is still honoured for this session */
    }
  }, []);

  const value = React.useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useDocLang(): LangContextValue {
  const ctx = React.useContext(LangContext);
  if (!ctx) throw new Error("useDocLang must be used within a DocLangProvider");
  return ctx;
}
