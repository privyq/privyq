// k6 load test for the PrivyQ gateway (ARCH §24, BP §19).
// Usage:  k6 run tests/perf/gateway_load.js
// Requires the stack up (make dev) and BASE_URL (default http://localhost:8000).
import http from "k6/http";
import { check, sleep } from "k6";
import encoding from "k6/encoding";

const BASE = __ENV.BASE_URL || "http://localhost:8000";

export const options = {
  scenarios: {
    // Ramp to the concurrency levels in BP §24.3 Scenario 3.
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 10 },
        { duration: "20s", target: 50 },
        { duration: "20s", target: 100 },
        { duration: "10s", target: 0 },
      ],
    },
  },
  thresholds: {
    // Targets from ARCH §24.3.
    http_req_duration: ["p(95)<50"], // gateway adds little over the core's <20ms access
    http_req_failed: ["rate<0.01"],
  },
};

const policy = { role: "doctor", department: "cardiology", purpose: "treatment" };
const identity = { user_id: "dr_smith", role: "doctor", department: "cardiology", purpose: "treatment" };

export default function () {
  // protect
  const protectRes = http.post(
    `${BASE}/api/v1/protect`,
    JSON.stringify({ data: encoding.b64encode("benchmark record"), policy, resource_id: "load", actor: identity }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(protectRes, { "protect 200": (r) => r.status === 200 });
  if (protectRes.status !== 200) return;

  // access
  const protectedData = protectRes.json("protected_data");
  const accessRes = http.post(
    `${BASE}/api/v1/access`,
    JSON.stringify({ protected_data: protectedData, identity }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(accessRes, { "access 200": (r) => r.status === 200 });

  sleep(0.1);
}
