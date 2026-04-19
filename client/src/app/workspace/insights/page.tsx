"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LuActivity,
  LuArrowUpRight,
  LuChartPie,
  LuFileText,
  LuLoader,
  LuNetwork,
  LuShieldAlert,
  LuTriangleAlert,
  LuCircleCheck,
} from "react-icons/lu";
import { toast } from "sonner";

interface EdgeRow {
  subject_name?: string;
  object_name?: string;
  subject?: string;
  object?: string;
  relation_type?: string;
  predicate?: string;
  confidence?: number;
  session_id: string;
}

interface ReportRow {
  session_id: string;
  claim: string;
  completed_at: string | null;
  confidence: number | null;
  consensus: number | null;
  evidence: number;
  sources: number;
}

interface InsightsResponse {
  totals: {
    sessions: number;
    sessionsAnalyzed: number;
    evidence: number;
    sources: number;
    entities: number;
    relations: number;
    contradictions: number;
    priorArt: number;
    corroborations: number;
  };
  topEntityTypes: Array<{ type: string; count: number }>;
  recentContradictions: EdgeRow[];
  recentPriorArt: EdgeRow[];
  reports: ReportRow[];
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function edgeLabel(e: EdgeRow) {
  const s = e.subject_name ?? e.subject ?? "—";
  const o = e.object_name ?? e.object ?? "—";
  return { s, o, rel: e.relation_type ?? e.predicate ?? "" };
}

function Kpi({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
      <div className={`flex items-center gap-2 mb-4 ${accent}`}>
        <Icon className="text-xl" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-3xl font-display font-bold text-text">{value}</p>
    </div>
  );
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/insights", { cache: "no-store" });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load insights");
        }
        setData(await r.json());
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load insights"
        );
        console.error("[InsightsPage] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <div className="p-20 flex flex-col items-center justify-center text-text-muted">
          <LuLoader className="text-3xl animate-spin mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Aggregating insights...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <p className="text-sm text-text-secondary">No insights available.</p>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">
          Research Insights
        </h2>
        <p className="text-text-secondary text-sm">
          Accumulated findings across {t.sessionsAnalyzed} of {t.sessions}{" "}
          recent scans.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <Kpi
          label="Scans"
          value={t.sessions}
          icon={LuActivity}
          accent="text-amber"
        />
        <Kpi
          label="Evidence"
          value={t.evidence}
          icon={LuFileText}
          accent="text-cyan"
        />
        <Kpi
          label="Sources"
          value={t.sources}
          icon={LuNetwork}
          accent="text-emerald"
        />
        <Kpi
          label="Cross-corpus signals"
          value={t.contradictions + t.priorArt + t.corroborations}
          icon={LuChartPie}
          accent="text-gold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-start">
        <div className="lg:col-span-5 p-6 bg-white border border-obs-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <LuChartPie className="text-cyan text-lg" />
            <h3 className="text-lg font-display font-semibold">
              Top Entity Types
            </h3>
          </div>
          {data.topEntityTypes.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No entities extracted yet.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topEntityTypes.map((e) => {
                const max = data.topEntityTypes[0].count || 1;
                const pct = Math.max(6, Math.round((e.count / max) * 100));
                return (
                  <div key={e.type} className="flex items-center gap-3">
                    <span className="w-28 text-[11px] font-mono uppercase tracking-wider text-text-secondary shrink-0">
                      {e.type}
                    </span>
                    <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-mono font-semibold text-text">
                      {e.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-obs-border/60 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
                Entities
              </p>
              <p className="text-xl font-display font-bold text-text">
                {t.entities}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
                Relations
              </p>
              <p className="text-xl font-display font-bold text-text">
                {t.relations}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-1">
                Corroborations
              </p>
              <p className="text-xl font-display font-bold text-emerald">
                {t.corroborations}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <LuTriangleAlert className="text-rose text-lg" />
                <h3 className="text-lg font-display font-semibold">
                  Recent Contradictions
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-rose">
                {t.contradictions} total
              </span>
            </div>
            {data.recentContradictions.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No contradiction edges detected.
              </p>
            ) : (
              <ul className="divide-y divide-obs-border/60">
                {data.recentContradictions.map((e, i) => {
                  const { s, o, rel } = edgeLabel(e);
                  return (
                    <li key={i} className="py-3">
                      <Link
                        href={`/check/${e.session_id}/graph`}
                        className="group flex items-center gap-3 hover:text-amber"
                      >
                        <span className="text-sm text-text font-semibold truncate">
                          {s}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-rose">
                          {rel || "contradicts"}
                        </span>
                        <span className="text-sm text-text-secondary truncate">
                          {o}
                        </span>
                        <LuArrowUpRight className="ml-auto text-text-muted group-hover:text-amber shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <LuShieldAlert className="text-gold text-lg" />
                <h3 className="text-lg font-display font-semibold">
                  Prior-Art Hits
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gold">
                {t.priorArt} total
              </span>
            </div>
            {data.recentPriorArt.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No prior-art edges detected.
              </p>
            ) : (
              <ul className="divide-y divide-obs-border/60">
                {data.recentPriorArt.map((e, i) => {
                  const { s, o } = edgeLabel(e);
                  return (
                    <li key={i} className="py-3">
                      <Link
                        href={`/check/${e.session_id}/graph`}
                        className="group flex items-center gap-3 hover:text-amber"
                      >
                        <span className="text-sm text-text font-semibold truncate">
                          {s}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-gold">
                          predates
                        </span>
                        <span className="text-sm text-text-secondary truncate">
                          {o}
                        </span>
                        <LuArrowUpRight className="ml-auto text-text-muted group-hover:text-amber shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <LuCircleCheck className="text-emerald text-lg" />
          <h3 className="text-lg font-display font-semibold">
            Completed Reports
          </h3>
        </div>
        {data.reports.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No completed reports yet.
          </p>
        ) : (
          <div className="divide-y divide-obs-border">
            {data.reports.map((r) => (
              <Link
                key={r.session_id}
                href={`/check/${r.session_id}`}
                className="flex items-center justify-between py-4 group hover:bg-surface/50 -mx-6 px-6 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-semibold text-text line-clamp-1 group-hover:text-amber">
                    {r.claim || "Untitled scan"}
                  </p>
                  <p className="text-[11px] font-mono uppercase tracking-widest text-text-muted mt-1">
                    {formatDate(r.completed_at)} · {r.evidence} evidence ·{" "}
                    {r.sources} sources
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {r.confidence != null && (
                    <div className="text-right">
                      <p className="text-[9px] font-mono uppercase tracking-widest text-text-muted">
                        Confidence
                      </p>
                      <p className="text-xs font-mono font-bold text-emerald">
                        {Math.round((r.confidence ?? 0) * 100)}%
                      </p>
                    </div>
                  )}
                  <LuArrowUpRight className="text-text-muted group-hover:text-amber" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
