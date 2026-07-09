import type { Identity } from "./types";

/**
 * Demo personas — the four roles from BP §13.2 / §25 and the identities used
 * in the original design prototype (Dr. Amara Okafor, Nurse Bello Musa, Riley Chen),
 * plus an Administrator for the audit-verification flow (§25.4).
 *
 * The active persona drives the `identity` sent to POST /api/v1/access.
 */
export type PersonaId = "amara" | "bello" | "chen" | "singh";

export interface Persona {
  id: PersonaId;
  name: string;
  initials: string;
  identity: Identity;
  blurb: string;
}

export const PERSONAS: Persona[] = [
  {
    id: "amara",
    name: "Dr. Amara Okafor",
    initials: "AO",
    blurb: "Cardiologist · treatment",
    identity: {
      user_id: "doctor_amara",
      role: "doctor",
      department: "cardiology",
      purpose: "treatment",
      organization: "Hospital A",
    },
  },
  {
    id: "bello",
    name: "Nurse Bello Musa",
    initials: "BM",
    blurb: "General medicine · admin",
    identity: {
      user_id: "nurse_bello",
      role: "nurse",
      department: "general",
      purpose: "administrative",
      organization: "Hospital A",
    },
  },
  {
    id: "chen",
    name: "Riley Chen",
    initials: "RC",
    blurb: "Oncology research · research",
    identity: {
      user_id: "researcher_chen",
      role: "researcher",
      department: "oncology",
      purpose: "research",
      organization: "Hospital A",
    },
  },
  {
    id: "singh",
    name: "Priya Singh",
    initials: "PS",
    blurb: "System administrator · audit",
    identity: {
      user_id: "admin_singh",
      role: "admin",
      department: "it",
      purpose: "audit",
      organization: "Hospital A",
    },
  },
];

export const DEFAULT_PERSONA_ID: PersonaId = "amara";

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
}
