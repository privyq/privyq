/**
 * PrivyQ v2 (JS) — protect/check/access, seal()/verify(), and evidence export.
 *
 * Start the stack, build the SDK, then:
 *   PRIVYQ_GATEWAY_URL=http://localhost:8000 node 02_seal_and_compliance.mjs
 *
 * Mirrors examples/python/02_seal_and_compliance.py.
 */
import { writeFileSync } from "node:fs";
import { configure, protect, access, check, seal, verify, evidence } from "@privyq/sdk";

configure({ gatewayUrl: process.env.PRIVYQ_GATEWAY_URL ?? "http://localhost:8000" });

// 1. Protect a record (policy-bound, post-quantum) and check who may open it.
const protectedData = await protect("Patient: Ada. Plan: continue beta-blocker.", {
  role: "doctor",
  purpose: "treatment",
});

const granted = await check({ role: "doctor", purpose: "treatment" }, protectedData);
console.log("Doctor may access:", granted.allowed, "-", granted.reason);
const denied = await check({ role: "nurse" }, protectedData);
console.log("Nurse may access:", denied.allowed, "-", denied.reason);

const opened = await access(protectedData, { role: "doctor", purpose: "treatment" });
console.log("Decrypted:", opened.text());

// 2. seal() — a post-quantum signature over a discharge summary.
const summary = "Discharge summary for Ada, signed.";
const sealed = await seal(summary);
const ok = await verify(sealed, { data: summary });
console.log(`\nSealed with ${sealed.algorithm}; verifies: ${ok.ok}`);
const bad = await verify(sealed, { data: "forged" });
console.log("Tampered verifies:", bad.ok);

// 3. Export the evidence trail for compliance (json/csv/pdf).
const pdf = await evidence.export("pdf");
writeFileSync("evidence-report.pdf", pdf);
console.log(`\nWrote evidence-report.pdf (${pdf.byteLength} bytes) — a verifiable audit report.`);
