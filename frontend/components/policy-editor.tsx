"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  Policy,
  PolicyCombination,
  PolicyCondition,
  PolicyConditionType,
  PolicyOperator,
} from "@/lib/types";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * PolicyEditor (ARCH §11.3) — a JSON-like form for policy conditions with
 * autocomplete-style selects for condition types and operators, plus a live
 * JSON preview of the resulting policy (BP §14.1 schema).
 */

const CONDITION_TYPES: PolicyConditionType[] = [
  "role",
  "department",
  "purpose",
  "classification",
  "expiry",
  "jurisdiction",
  "organization",
];

const OPERATORS: PolicyOperator[] = [
  "equals",
  "not_equals",
  "in",
  "one_of",
  "before",
  "after",
];

// Suggested values per condition type (BP §14.2) — surfaced as datalist hints.
const VALUE_HINTS: Partial<Record<PolicyConditionType, string[]>> = {
  role: ["doctor", "nurse", "researcher", "admin"],
  department: ["cardiology", "oncology", "neurology", "radiology", "general"],
  purpose: ["treatment", "research", "audit", "administrative"],
  classification: ["public", "internal", "confidential", "restricted"],
  jurisdiction: ["EU", "US", "UK", "GDPR"],
};

const MULTI_VALUE_OPS: PolicyOperator[] = ["in", "one_of"];

function conditionValueToString(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

export function PolicyEditor({
  value,
  onChange,
}: {
  value: Policy;
  onChange: (policy: Policy) => void;
}) {
  const setConditions = (conditions: PolicyCondition[]) =>
    onChange({ ...value, conditions });

  const updateCondition = (i: number, patch: Partial<PolicyCondition>) => {
    const next = value.conditions.map((c, idx) =>
      idx === i ? { ...c, ...patch } : c,
    );
    setConditions(next);
  };

  const addCondition = () =>
    setConditions([
      ...value.conditions,
      { type: "role", operator: "equals", value: "" },
    ]);

  const removeCondition = (i: number) =>
    setConditions(value.conditions.filter((_, idx) => idx !== i));

  const listId = React.useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">
          Conditions
        </span>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          Combine
          <Select
            aria-label="Condition combination"
            value={value.combination}
            onChange={(e) =>
              onChange({
                ...value,
                combination: e.target.value as PolicyCombination,
              })
            }
            className="w-24 py-1.5"
          >
            <option value="all">all</option>
            <option value="any">any</option>
          </Select>
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        {value.conditions.map((condition, i) => {
          const hints = VALUE_HINTS[condition.type] ?? [];
          const dl = `${listId}-${i}`;
          return (
            <div
              key={i}
              className="grid grid-cols-1 items-center gap-2 rounded-[10px] border border-line bg-tint/50 p-2.5 sm:grid-cols-[1fr_1fr_1.4fr_auto]"
            >
              <Select
                aria-label={`Condition ${i + 1} type`}
                value={condition.type}
                onChange={(e) =>
                  updateCondition(i, {
                    type: e.target.value as PolicyConditionType,
                  })
                }
                className="bg-white py-2"
              >
                {CONDITION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={`Condition ${i + 1} operator`}
                value={condition.operator}
                onChange={(e) => {
                  const op = e.target.value as PolicyOperator;
                  const isMulti = MULTI_VALUE_OPS.includes(op);
                  const wasMulti = Array.isArray(condition.value);
                  let nextValue: string | string[] = condition.value;
                  if (isMulti && !wasMulti) {
                    nextValue = conditionValueToString(condition.value)
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                  } else if (!isMulti && wasMulti) {
                    nextValue = conditionValueToString(condition.value);
                  }
                  updateCondition(i, { operator: op, value: nextValue });
                }}
                className="bg-white py-2"
              >
                {OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op.replace("_", " ")}
                  </option>
                ))}
              </Select>
              <Input
                aria-label={`Condition ${i + 1} value`}
                list={dl}
                placeholder={
                  MULTI_VALUE_OPS.includes(condition.operator)
                    ? "comma, separated, values"
                    : "value"
                }
                value={conditionValueToString(condition.value)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const nextValue = MULTI_VALUE_OPS.includes(condition.operator)
                    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
                    : raw;
                  updateCondition(i, { value: nextValue });
                }}
              />
              {hints.length > 0 && (
                <datalist id={dl}>
                  {hints.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              )}
              <button
                type="button"
                onClick={() => removeCondition(i)}
                aria-label={`Remove condition ${i + 1}`}
                className="grid h-9 w-9 place-items-center justify-self-end rounded-lg text-muted transition-colors hover:bg-red/10 hover:text-red"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4" />
          Add condition
        </Button>
      </div>

      <details className="rounded-[10px] border border-line bg-white">
        <summary className="cursor-pointer px-3.5 py-2.5 font-mono text-xs font-semibold text-muted">
          Policy JSON preview
        </summary>
        <pre className="scroll-thin overflow-x-auto border-t border-line bg-dark px-4 py-3 font-mono text-xs leading-relaxed text-[#8FA0FF]">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>

      <div className="flex flex-wrap gap-1.5">
        {value.conditions.map((c, i) => (
          <Badge key={i} variant="muted" size="sm">
            {c.type} {c.operator.replace("_", " ")}{" "}
            {conditionValueToString(c.value) || "—"}
          </Badge>
        ))}
      </div>
    </div>
  );
}
