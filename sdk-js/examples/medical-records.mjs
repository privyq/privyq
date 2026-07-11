/**
 * The canonical medical-records scenario (blueprint §25), end to end.
 *
 * Requires a running PrivyQ gateway. Start the stack first, e.g.:
 *   docker compose -f ../deploy/docker-compose.yml up
 * then:
 *   PRIVYQ_GATEWAY_URL=http://localhost:8000 node examples/medical-records.mjs
 *
 * This imports from the built package (run `npm run build` first) — swap the
 * import for "../src/index.ts" if you run it through a TS loader instead.
 */
import {
  configure,
  protect,
  access,
  check,
  explain,
  seal,
  evidence,
  AccessDenied,
} from "../dist/index.js";

configure({
  gatewayUrl: process.env.PRIVYQ_GATEWAY_URL ?? "http://localhost:8000",
  apiKey: process.env.PRIVYQ_API_KEY,
});

async function main() {
  // 1. Protect a record, attaching the access rules in the same call.
  const record = await protect(
    "Patient: John Doe. Plan: continue beta-blocker.",
    { role: "doctor", department: "cardiology", purpose: "treatment", expiry: "24h" },
    { actor: { user_id: "dr_smith", role: "doctor", department: "cardiology" } },
  );
  console.log("protected:", record.resourceId, record.algorithm);

  // 2. A nurse is denied — no data revealed, just an explained decision.
  const decision = await check({ role: "nurse", department: "cardiology" }, record);
  console.log("nurse allowed?", decision.allowed, "-", explain(decision));

  // 3. The treating doctor opens it.
  try {
    const opened = await access(
      record,
      { role: "doctor", department: "cardiology" },
      { purpose: "treatment" },
    );
    console.log("doctor read:", opened.text());
    console.log("evidence id:", opened.evidence.evidenceId);
  } catch (err) {
    if (err instanceof AccessDenied) console.error("denied:", err.reason);
    else throw err;
  }

  // 4. Sign a discharge summary (post-quantum signature).
  const sealed = await seal("Discharge: stable, follow-up in 2 weeks.");
  console.log("sealed with:", sealed.algorithm, sealed.keyId);

  // 5. Inspect the tamper-evident audit trail for the record.
  const trail = await evidence.of(record.resourceId);
  console.log(`audit trail: ${trail.length} entr${trail.length === 1 ? "y" : "ies"}`);
  const chain = await evidence.verify({ resourceId: record.resourceId });
  console.log("chain intact?", chain.ok);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
