"use client";

import * as React from "react";
import type { Policy } from "@/lib/types";

/**
 * A real record the user has protected through the gateway. `protectedData` is
 * the actual base64 envelope returned by POST /api/v1/protect — passing it back
 * to POST /api/v1/access is what makes access decisions real (not simulated).
 *
 * The list is persisted in localStorage so records survive reloads and every
 * persona (in the same browser) can attempt access to the same sealed data.
 */
export interface StoredRecord {
  id: string; // == resource_id
  patientName: string;
  patientAge?: number;
  summary: string;
  classification: string;
  algorithm: string;
  keyId: string;
  policyHash: string;
  createdAt: string;
  owner: string; // persona name who protected it
  policy: Policy; // kept for display
  protectedData: string; // base64 envelope from the gateway
}

interface RecordsContextValue {
  records: StoredRecord[];
  addRecord: (r: StoredRecord) => void;
  removeRecord: (id: string) => void;
  getRecord: (id: string) => StoredRecord | undefined;
  clear: () => void;
  hydrated: boolean;
}

const RecordsContext = React.createContext<RecordsContextValue | null>(null);
const STORAGE_KEY = "privyq.records.v1";

export function RecordsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = React.useState<StoredRecord[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  // Load once on mount (avoids SSR mismatch).
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setRecords(JSON.parse(raw) as StoredRecord[]);
    } catch {
      /* corrupt storage — start empty */
    }
    setHydrated(true);
  }, []);

  const persist = React.useCallback((next: StoredRecord[]) => {
    setRecords(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — keep in-memory */
    }
  }, []);

  const addRecord = React.useCallback(
    (r: StoredRecord) => persist([r, ...records.filter((x) => x.id !== r.id)]),
    [records, persist],
  );
  const removeRecord = React.useCallback(
    (id: string) => persist(records.filter((r) => r.id !== id)),
    [records, persist],
  );
  const getRecord = React.useCallback(
    (id: string) => records.find((r) => r.id === id),
    [records],
  );
  const clear = React.useCallback(() => persist([]), [persist]);

  const value = React.useMemo<RecordsContextValue>(
    () => ({ records, addRecord, removeRecord, getRecord, clear, hydrated }),
    [records, addRecord, removeRecord, getRecord, clear, hydrated],
  );

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

export function useRecords(): RecordsContextValue {
  const ctx = React.useContext(RecordsContext);
  if (!ctx) throw new Error("useRecords must be used within a RecordsProvider");
  return ctx;
}
