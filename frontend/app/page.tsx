"use client";

import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  FileUp,
  Files,
  KeyRound,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { DEMO_EVIDENCE, DEMO_KEYS, DEMO_RECORDS } from "@/lib/demo-data";
import { shortDateTime } from "@/lib/utils";
import { useIdentity } from "@/components/providers/identity-provider";
import { PageHeading } from "@/components/page-heading";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const activeKeys = DEMO_KEYS.filter((k) => k.status === "active").length;
const grantedCount = DEMO_EVIDENCE.filter((e) => e.result === "granted").length;
const deniedCount = DEMO_EVIDENCE.filter((e) => e.result === "denied").length;

const chartData = [
  { name: "Granted", value: grantedCount, fill: "var(--mint)" },
  { name: "Denied", value: deniedCount, fill: "var(--red)" },
];

const STATS = [
  { label: "Protected records", value: DEMO_RECORDS.length, icon: Files, href: "/records" },
  { label: "Active keys", value: activeKeys, icon: KeyRound, href: "/keys" },
  { label: "Evidence entries", value: DEMO_EVIDENCE.length, icon: ShieldCheck, href: "/audit" },
];

export default function DashboardPage() {
  const { persona } = useIdentity();

  return (
    <div>
      <PageHeading
        eyebrow="Secure Medical Records"
        title={
          <>
            Welcome, <span className="ink-hl">{persona.name}</span>
          </>
        }
        description={`Acting as ${persona.identity.role} · ${persona.identity.department} · ${persona.identity.organization}. Switch personas from the header to see policy decisions change.`}
      >
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white shadow-ink transition-transform hover:-translate-y-0.5"
        >
          <FileUp className="h-4 w-4" />
          Upload record
        </Link>
      </PageHeading>

      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-transform hover:-translate-y-1 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-tint text-ink">
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-display text-2xl font-extrabold tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-sm text-muted">{s.label}</div>
                </div>
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent access events</CardTitle>
            <Link
              href="/audit"
              className="text-sm font-semibold text-blue hover:underline"
            >
              View audit log
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {DEMO_EVIDENCE.slice()
              .reverse()
              .slice(0, 6)
              .map((e) => (
                <div
                  key={e.evidence_id}
                  className="flex items-center gap-3 rounded-[10px] border border-line bg-tint/40 px-3 py-2.5"
                >
                  <Badge
                    variant={e.result === "granted" ? "granted" : "denied"}
                    size="sm"
                  >
                    {e.result}
                  </Badge>
                  <span className="text-sm font-medium">
                    {e.resource.resource_id}
                  </span>
                  <span className="text-xs text-muted">
                    {e.actor.user_id} · {e.operation}
                  </span>
                  <span className="ml-auto font-mono text-[.66rem] text-muted">
                    {shortDateTime(e.timestamp)}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    width={24}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,.04)" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--line)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 rounded-[10px] border border-mint/40 bg-mint/10 px-3 py-2.5 text-sm font-semibold text-[#0a9c6b]">
              All {DEMO_EVIDENCE.length} entries verified — no tampering detected
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
