"use client";

import * as React from "react";
import { probeHealth } from "@/services/api";

type Status = "checking" | "online" | "offline";

/**
 * Small live indicator of gateway/core reachability. Polls GET /api/v1/health.
 * When offline, the app falls back to seeded demo data (graceful degradation).
 */
export function CoreStatus() {
  const [status, setStatus] = React.useState<Status>("checking");

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      const health = await probeHealth();
      if (active) setStatus(health ? "online" : "offline");
    };
    void check();
    const id = setInterval(check, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const label =
    status === "online"
      ? "Core online"
      : status === "offline"
        ? "Core offline"
        : "Checking core…";
  const dot =
    status === "online"
      ? "bg-mint"
      : status === "offline"
        ? "bg-amber"
        : "bg-muted";

  return (
    <span
      className="hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-mono text-[.72rem] font-medium text-muted shadow-sm sm:inline-flex"
      title={label}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
