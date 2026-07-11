/** health() — gateway readiness snapshot (GET /api/v1/health). */

import { request } from "./http.js";
import { type Health, type WireHealthResponse } from "./types.js";

export async function health(): Promise<Health> {
  const resp = await request<WireHealthResponse>("/api/v1/health");
  return { status: resp.status, services: resp.services ?? {}, version: resp.version };
}
