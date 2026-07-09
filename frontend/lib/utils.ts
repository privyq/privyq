import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, de-duplicating Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Short, deterministic-looking hex hash for demo receipts (not cryptographic). */
export function fakeHash(len = 10): string {
  const c = "abcdef0123456789";
  let h = "";
  for (let i = 0; i < len; i += 1) h += c[Math.floor(Math.random() * c.length)];
  return h;
}

/** base64-encode a UTF-8 string (browser + node safe). */
export function toBase64(input: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(input, "utf-8").toString("base64");
  }
  return window.btoa(unescape(encodeURIComponent(input)));
}

/** base64-decode to a UTF-8 string (browser + node safe). */
export function fromBase64(input: string): string {
  if (typeof window === "undefined") {
    return Buffer.from(input, "base64").toString("utf-8");
  }
  return decodeURIComponent(escape(window.atob(input)));
}

/** Format an ISO timestamp as a short local time. */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Format an ISO timestamp as a short local date-time. */
export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
