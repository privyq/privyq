"use client";

import * as React from "react";
import {
  DEFAULT_PERSONA_ID,
  getPersona,
  type Persona,
  type PersonaId,
} from "@/lib/personas";

interface IdentityContextValue {
  personaId: PersonaId;
  persona: Persona;
  setPersonaId: (id: PersonaId) => void;
}

const IdentityContext = React.createContext<IdentityContextValue | null>(null);

const STORAGE_KEY = "privyq.persona";

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [personaId, setPersonaIdState] =
    React.useState<PersonaId>(DEFAULT_PERSONA_ID);

  // hydrate from localStorage after mount (avoids SSR mismatch)
  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as PersonaId | null;
    if (stored) setPersonaIdState(stored);
  }, []);

  const setPersonaId = React.useCallback((id: PersonaId) => {
    setPersonaIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const value = React.useMemo<IdentityContextValue>(
    () => ({ personaId, persona: getPersona(personaId), setPersonaId }),
    [personaId, setPersonaId],
  );

  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const ctx = React.useContext(IdentityContext);
  if (!ctx)
    throw new Error("useIdentity must be used within an IdentityProvider");
  return ctx;
}
