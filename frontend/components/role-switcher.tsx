"use client";

import { UserCog } from "lucide-react";
import { PERSONAS } from "@/lib/personas";
import { useIdentity } from "@/components/providers/identity-provider";

/**
 * Header control to act as one of the demo personas
 * (Doctor / Nurse / Researcher / Admin — BP §25, the original design prototype).
 * The selected persona's identity is what pages send to POST /api/v1/access.
 */
export function RoleSwitcher() {
  const { personaId, persona, setPersonaId } = useIdentity();

  return (
    <label className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 shadow-sm">
      <span className="avatar-gradient grid h-7 w-7 place-items-center rounded-lg text-[.62rem] font-extrabold text-white">
        {persona.initials}
      </span>
      <span className="sr-only">Acting as</span>
      <UserCog className="h-4 w-4 text-muted" aria-hidden="true" />
      <select
        aria-label="Acting as persona"
        value={personaId}
        onChange={(e) => setPersonaId(e.target.value as typeof personaId)}
        className="cursor-pointer appearance-none bg-transparent text-sm font-semibold text-ink focus-visible:outline-none"
      >
        {PERSONAS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.identity.role}
          </option>
        ))}
      </select>
    </label>
  );
}
