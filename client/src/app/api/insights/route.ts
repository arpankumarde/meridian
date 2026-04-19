import { NextRequest, NextResponse } from "next/server";

const ENGINE_BASE = "http://localhost:9090";
const FANOUT_LIMIT = 20;

interface EngineSession {
  session_id: string;
  claim: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  iteration_count?: number;
  confidence?: number | null;
  consensus?: number | null;
  source_diversity?: number | null;
}

interface SessionStats {
  evidence: number;
  sources: number;
  sub_claims: number;
}

interface KgStats {
  num_entities: number;
  num_relations: number;
  entity_types?: Record<string, number>;
}

interface CrossEdge {
  subject_name?: string;
  object_name?: string;
  subject?: string;
  object?: string;
  relation_type?: string;
  predicate?: string;
  confidence?: number;
}

interface CrossCorpus {
  corroborations?: CrossEdge[];
  contradictions?: CrossEdge[];
  prior_art?: CrossEdge[];
  overlaps?: CrossEdge[];
  citations?: CrossEdge[];
  white_space?: CrossEdge[];
}

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

// TODO(multi-tenant): filter sessions by organizationId once the engine
// tracks session ownership. See PRD §9 (deployment deferrals).
export async function GET(_req: NextRequest) {
  try {
    const sessions =
      (await safeJson<EngineSession[]>(
        `${ENGINE_BASE}/api/sessions/?limit=100`
      )) ?? [];

    const recent = sessions.slice(0, FANOUT_LIMIT);

    const perSession = await Promise.all(
      recent.map(async (s) => {
        const [stats, kg, cross] = await Promise.all([
          safeJson<SessionStats>(
            `${ENGINE_BASE}/api/sessions/${s.session_id}/stats`
          ),
          safeJson<KgStats>(
            `${ENGINE_BASE}/api/sessions/${s.session_id}/knowledge/stats`
          ),
          safeJson<CrossCorpus>(
            `${ENGINE_BASE}/api/sessions/${s.session_id}/knowledge/cross-corpus?limit=50`
          ),
        ]);
        return { session: s, stats, kg, cross };
      })
    );

    // Aggregate totals
    let totalEvidence = 0;
    let totalSources = 0;
    let totalEntities = 0;
    let totalRelations = 0;
    let contradictionCount = 0;
    let priorArtCount = 0;
    let corroborationCount = 0;
    const entityTypes: Record<string, number> = {};

    const recentContradictions: Array<CrossEdge & { session_id: string }> = [];
    const recentPriorArt: Array<CrossEdge & { session_id: string }> = [];

    for (const { session, stats, kg, cross } of perSession) {
      if (stats) {
        totalEvidence += stats.evidence;
        totalSources += stats.sources;
      }
      if (kg) {
        totalEntities += kg.num_entities ?? 0;
        totalRelations += kg.num_relations ?? 0;
        for (const [k, v] of Object.entries(kg.entity_types ?? {})) {
          entityTypes[k] = (entityTypes[k] ?? 0) + (v as number);
        }
      }
      if (cross) {
        const c = cross.contradictions ?? [];
        const p = cross.prior_art ?? [];
        contradictionCount += c.length;
        priorArtCount += p.length;
        corroborationCount += (cross.corroborations ?? []).length;
        for (const e of c.slice(0, 5)) {
          recentContradictions.push({ ...e, session_id: session.session_id });
        }
        for (const e of p.slice(0, 5)) {
          recentPriorArt.push({ ...e, session_id: session.session_id });
        }
      }
    }

    const topEntityTypes = Object.entries(entityTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([type, count]) => ({ type, count }));

    const reports = perSession
      .filter(({ session }) => session.status === "completed")
      .slice(0, 10)
      .map(({ session, stats }) => ({
        session_id: session.session_id,
        claim: session.claim,
        completed_at: session.completed_at ?? null,
        confidence: session.confidence ?? null,
        consensus: session.consensus ?? null,
        evidence: stats?.evidence ?? 0,
        sources: stats?.sources ?? 0,
      }));

    return NextResponse.json({
      totals: {
        sessions: sessions.length,
        sessionsAnalyzed: perSession.length,
        evidence: totalEvidence,
        sources: totalSources,
        entities: totalEntities,
        relations: totalRelations,
        contradictions: contradictionCount,
        priorArt: priorArtCount,
        corroborations: corroborationCount,
      },
      topEntityTypes,
      recentContradictions: recentContradictions.slice(0, 10),
      recentPriorArt: recentPriorArt.slice(0, 10),
      reports,
    });
  } catch (err) {
    console.error("[insights] GET error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
