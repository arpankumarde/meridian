"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ActivityFeed from "@/components/activity-feed";
import EvidenceBrowser from "@/components/evidence-browser";
import ReportPreview from "@/components/report-preview";
import SourcesBrowser from "@/components/sources-browser";
import QuestionModal from "@/components/question-modal";
import { ConfidenceMeter } from "@/components/confidence-meter";
import { ResearchWebSocket } from "@/lib/websocket";
import Link from "next/link";
import { LuLoader, LuCircleAlert, LuChevronRight, LuArrowLeft, LuClock, LuPause, LuPlay, LuTriangleAlert, LuCirclePause, LuCompass, LuFileText, LuTimer, LuNetwork, LuBrain, LuAward, LuUsers, LuExternalLink, LuActivity } from "react-icons/lu";
import type { IconType } from "react-icons";
import { Button } from "@/components/ui/button";

interface Session {
  session_id: string;
  goal: string;
  claim?: string;
  max_iterations: number;
  status: string;
  mode?: string;
  confidence?: number | null;
  consensus?: number | null;
  source_diversity?: number | null;
  created_at: string;
  completed_at?: string | null;
  elapsed_seconds?: number;
  paused_at?: string | null;
  iteration_count?: number;
}

const tabs = [
  { id: "activity", label: "Live Activity", icon: LuActivity },
  { id: "evidence", label: "Evidence", icon: LuFileText },
  { id: "report", label: "Intelligence Report", icon: LuFileText },
  { id: "graph", label: "Knowledge Graph", icon: LuNetwork },
  { id: "sources", label: "Sources", icon: LuCompass },
  { id: "agents", label: "Agents", icon: LuBrain },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function CheckDetail() {
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [stats, setStats] = useState<{ evidence: number; sources: number; sub_claims: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [pendingQuestion, setPendingQuestion] = useState<{
    questionId: string;
    question: string;
    context: string;
    options: string[];
    timeout: number;
  } | null>(null);
  const wsRef = useRef<ResearchWebSocket | null>(null);

  useEffect(() => {
    fetchSession();
    fetchStats();
  }, [sessionId]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return;
    const terminalStatuses = ["completed", "error", "interrupted"];
    if (terminalStatuses.includes(session.status)) return;
    const interval = setInterval(() => {
      fetchSession();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [session?.status]);

  useEffect(() => {
    const ws = new ResearchWebSocket(sessionId);

    ws.onEvent((event) => {
      if (event.event_type === "question_asked" && event.data) {
        setPendingQuestion({
          questionId: event.data.question_id,
          question: event.data.question,
          context: event.data.context || "",
          options: event.data.options || [],
          timeout: event.data.timeout || 60,
        });
      } else if (event.event_type === "question_answered" || event.event_type === "question_timeout") {
        setPendingQuestion(null);
      }
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`http://localhost:9090/api/sessions/${sessionId}`);
      if (!response.ok) {
        if (response.status === 404) setError("Session not found");
        else throw new Error("Failed to fetch session");
        return;
      }
      const data = await response.json();
      setSession(data);
    } catch (err) {
      console.error("Error fetching session:", err);
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`http://localhost:9090/api/sessions/${sessionId}/stats`);
      if (response.ok) setStats(await response.json());
    } catch {
      // Non-critical
    }
  };
console.log("ab: ", session)
  const [actionPending, setActionPending] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [pauseStale, setPauseStale] = useState(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (session?.status === "paused" || session?.status === "crashed") {
      setIsPausing(false);
      setPauseStale(false);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    }
  }, [session?.status]);

  const handlePause = async () => {
    setActionPending(true);
    setIsPausing(true);
    setPauseStale(false);
    pauseTimerRef.current = setTimeout(() => setPauseStale(true), 10000);
    try {
      const res = await fetch(`http://localhost:9090/api/checks/${sessionId}/pause`, {
        method: "POST",
      });
      if (!res.ok) {
        setIsPausing(false);
        setPauseStale(false);
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      }
    } catch (err) {
      console.error("Failed to pause:", err);
      setIsPausing(false);
      setPauseStale(false);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    } finally {
      setActionPending(false);
    }
  };

  const handleResume = async () => {
    setActionPending(true);
    try {
      const res = await fetch(`http://localhost:9090/api/checks/${sessionId}/resume`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchSession();
      }
    } catch (err) {
      console.error("Failed to resume:", err);
    } finally {
      setActionPending(false);
    }
  };

  const handleQuestionSubmit = (response: string) => {
    setPendingQuestion(null);
  };

  const handleQuestionTimeout = () => {
    setPendingQuestion(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void flex-col p-6">
        <div className="relative w-16 h-16 flex items-center justify-center mb-6">
          <div className="absolute inset-0 rounded-2xl bg-amber/5 animate-pulse" />
          <LuLoader className="text-3xl text-amber animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-sm font-mono font-bold text-amber uppercase tracking-[0.3em]">Initializing Agent</h2>
          <p className="text-[11px] text-text-secondary uppercase tracking-[0.2em]">Synchronizing research workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-void p-6">
        <div className="max-w-md w-full bg-white border border-obs-border rounded-2xl p-10 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-soft border border-rose/10 flex items-center justify-center mx-auto mb-2">
            <LuCircleAlert className="text-3xl text-rose" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-semibold tracking-tight">{error || "Session not found"}</h2>
            <p className="text-sm text-text-secondary">The intelligence session you are looking for might have been expired, archived, or is currently unreachable.</p>
          </div>
          <div className="pt-4">
            <Button asChild variant="default" className="w-full h-12 font-bold uppercase tracking-widest text-[11px]">
              <Link href="/workspace">
                <LuArrowLeft className="mr-2" />
                Return to Workspace
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = session.status === "running" || session.status === "pending";
  const isPaused = session.status === "paused";
  const isCrashed = session.status === "crashed";
  const isResumable = isPaused || isCrashed;

  const elapsed = isRunning
    ? getElapsedTime(session.created_at, nowTick)
    : session.elapsed_seconds && session.elapsed_seconds > 0
      ? formatSeconds(session.elapsed_seconds)
      : getDuration(session.created_at, session.completed_at || null);
  const iterationProgress = `${session.iteration_count ?? 0}/${session.max_iterations}`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-obs-border bg-surface/40 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono mb-3">
            <Link href="/" className="hover:text-amber transition-colors">Sessions</Link>
            <LuChevronRight className="text-[12px]" />
            <span className={isRunning ? "text-emerald" : "text-text-secondary"}>
              {isRunning ? "Running" : session.status}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Link href="/workspace" className="text-text-secondary hover:text-amber transition-colors mt-1 shrink-0">
                <LuArrowLeft />
              </Link>
              <div className="min-w-0">
                <h1 className="text-xl font-display font-semibold line-clamp-2 leading-tight">{session.claim ?? session.goal}</h1>
                <div className="flex items-center gap-4 mt-2 text-[11px] text-text-muted font-mono">
                  <span>#{session.session_id.slice(0, 8)}</span>
                  <span className="flex items-center gap-1">
                    <LuClock className="text-[13px]" />
                    {formatDate(session.created_at)}
                  </span>
                  {session.mode && <span className="uppercase">mode: {session.mode}</span>}
                </div>
                {(session.confidence != null || session.consensus != null || session.source_diversity != null) && (
                  <div className="mt-3">
                    <ConfidenceMeter
                      confidence={session.confidence}
                      consensus={session.consensus}
                      sourceDiversity={session.source_diversity}
                      size="sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className={`obs-badge ${getStatusBadgeClass(session.status)}`}>
                {isRunning && (
                  <span className="relative flex h-1.5 w-1.5 mr-1">
                    <span className="animate-breathe absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                  </span>
                )}
                {session.status}
              </span>
              {isRunning && !isPausing && (
                <Button
                  onClick={handlePause}
                  disabled={actionPending}
                  variant="secondary"
                  size="sm"
                >
                  <LuPause />
                  Pause
                </Button>
              )}
              {isPausing && !isPaused && (
                <div className="flex items-center gap-2">
                  <Button disabled variant="secondary" size="sm" className="opacity-70">
                    <LuLoader className="animate-spin" />
                    Pausing...
                  </Button>
                  {pauseStale && (
                    <Button
                      onClick={() => { setIsPausing(false); setPauseStale(false); if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current); }}
                      variant="ghost"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              )}
              {isResumable && (
                <Button
                  onClick={handleResume}
                  disabled={actionPending}
                  size="sm"
                >
                  <LuPlay />
                  Resume
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Accent line */}
      <div className="glow-line" />

      {/* Crash Banner */}
      {isCrashed && (
        <div className="border-b border-rose/30 bg-rose-soft">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LuTriangleAlert className="text-rose" />
              <div>
                <p className="text-sm font-medium text-rose">This audit session crashed unexpectedly</p>
                <p className="text-xs text-text-secondary">Progress was saved. You can resume from the last checkpoint.</p>
              </div>
            </div>
            <Button onClick={handleResume} disabled={actionPending} size="sm">
              <LuPlay />
              Resume Audit
            </Button>
          </div>
        </div>
      )}

      {/* Paused Banner */}
      {isPaused && (
        <div className="border-b border-gold/30 bg-gold-soft">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LuCirclePause className="text-gold" />
              <div>
                <p className="text-sm font-medium text-gold">Audit is paused</p>
                <p className="text-xs text-text-secondary">All progress has been saved. Resume when ready.</p>
              </div>
            </div>
            <Button onClick={handleResume} disabled={actionPending} size="sm">
              <LuPlay />
              Resume
            </Button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="border-b border-obs-border bg-surface/20">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={LuCompass} label="Sources Found" value={stats ? String(stats.sources) : "--"} color="text-amber" />
            <StatCard icon={LuFileText} label="Evidence" value={stats ? String(stats.evidence) : "--"} color="text-emerald" />
            {/* <StatCard icon="repeat" label="Iterations" value={iterationProgress} color={isRunning ? "text-amber" : "text-text-secondary"} animate={isRunning} /> */}
            <StatCard icon={LuTimer} label="Elapsed" value={elapsed} color="text-text-secondary" animate={isRunning} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-obs-border bg-surface/10 sticky top-[89px] z-10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative">
            {/* Scroll fade indicators */}
            <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-void/80 to-transparent z-10 pointer-events-none md:hidden" />
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-void/80 to-transparent z-10 pointer-events-none md:hidden" />
            <div className="tab-bar overflow-x-auto scrollbar-hide" role="tablist">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`tab-item whitespace-nowrap ${activeTab === tab.id ? "tab-item-active" : ""}`}
                  >
                    <TabIcon className="text-lg" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {activeTab === "activity" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityFeed sessionId={sessionId} sharedWs={wsRef.current} />
            </div>
            <div className="space-y-6">
              <div className="obs-card">
                <h3 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-widest mb-4">Agent Status</h3>
                <div className="space-y-3">
                  <AgentStatusCard name="Director" role="Level 0" status="active" icon={LuAward} variant="violet" />
                  <AgentStatusCard name="Manager" role="Level 1" status="thinking" icon={LuBrain} variant="amber" />
                  <AgentStatusCard name="Intern Pool" role="Level 2" status="active" icon={LuUsers} count={3} variant="emerald" />
                </div>
              </div>

              <div className="obs-card" style={{ background: "rgb(var(--surface-inset))" }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-mono font-semibold text-text-muted uppercase tracking-widest">System Logs</h3>
                  <span className="status-dot status-dot-active" />
                </div>
                <div className="space-y-1.5 font-mono text-xs text-text-secondary max-h-48 overflow-y-auto scrollbar-hide">
                  <p><span className="text-amber">[{new Date().toLocaleTimeString()}]</span> Monitoring fact check session...</p>
                  <p><span className="text-amber">[{new Date().toLocaleTimeString()}]</span> WebSocket connection established</p>
                  <p className="text-text bg-text/5 p-1 -mx-1 rounded">
                    <span className="text-amber animate-breathe">&rsaquo;</span> Awaiting agent events...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "evidence" && <EvidenceBrowser sessionId={sessionId} />}
        {activeTab === "report" && <ReportPreview sessionId={sessionId} />}

        {activeTab === "graph" && (
          <SubPagePlaceholder
            icon={LuNetwork}
            title="Knowledge Graph"
            description="Interactive visualization of entities, relationships, and the knowledge network built during fact checking."
            linkHref={`/check/${sessionId}/graph`}
            linkText="Open Full Graph View"
          />
        )}

        {activeTab === "sources" && <SourcesBrowser sessionId={sessionId} />}

        {activeTab === "agents" && (
          <SubPagePlaceholder
            icon={LuBrain}
            title="Agent Transparency"
            description="Explore the decision audit trail -- see how each agent reasoned, what actions they took, and how they collaborated."
            linkHref={`/check/${sessionId}/agents`}
            linkText="Open Agent View"
          />
        )}

      </main>

      {pendingQuestion && (
        <QuestionModal
          sessionId={sessionId}
          questionId={pendingQuestion.questionId}
          question={pendingQuestion.question}
          context={pendingQuestion.context}
          options={pendingQuestion.options}
          timeout={pendingQuestion.timeout}
          onSubmit={handleQuestionSubmit}
          onTimeout={handleQuestionTimeout}
        />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, animate }: { icon: IconType; label: string; value: string; color: string; animate?: boolean }) {
  return (
    <div className="bg-surface border border-obs-border rounded-2xl p-4 hover:border-amber/20 transition-colors group">
      <div className="flex justify-between items-start mb-2">
        <p className="text-[11px] font-mono text-text-muted uppercase tracking-widest">{label}</p>
        <Icon className={`text-lg transition-colors group-hover:text-amber ${color}`} />
      </div>
      <p className={`font-mono text-2xl font-bold tracking-tighter ${animate ? "animate-breathe" : ""}`}>{value}</p>
    </div>
  );
}

function AgentStatusCard({ name, role, status, icon: Icon, count, variant }: { name: string; role: string; status: string; icon: IconType; count?: number; variant?: "violet" | "amber" | "emerald" }) {
  const statusConfig: Record<string, { dot: string; label: string }> = {
    active: { dot: "status-dot-active", label: "Active" },
    thinking: { dot: "bg-violet animate-breathe", label: "Thinking" },
    idle: { dot: "status-dot-idle", label: "Idle" },
  };
  const cfg = statusConfig[status] || statusConfig.idle;

  const variantConfig = {
    violet: { bg: "bg-violet-soft", text: "text-violet" },
    amber: { bg: "bg-amber-soft", text: "text-amber" },
    emerald: { bg: "bg-emerald-soft", text: "text-emerald" },
  };
  const vc = variantConfig[variant || "amber"];

  return (
    <div className="flex items-center justify-between p-3 bg-surface-inset rounded-xl border border-obs-border hover:border-amber/20 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${vc.bg} flex items-center justify-center`}>
          <Icon className={`${vc.text} text-base`} />
        </div>
        <div>
          <span className="text-sm font-medium block">{name}</span>
          <span className="text-xs text-text-muted">{role}{count ? ` (${count})` : ""}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`status-dot ${cfg.dot}`} />
        <span className="text-xs text-text-secondary">{cfg.label}</span>
      </div>
    </div>
  );
}

function SubPagePlaceholder({ icon: Icon, title, description, linkHref, linkText }: { icon: IconType; title: string; description: string; linkHref: string; linkText: string }) {
  return (
    <div className="obs-card flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-soft border border-amber/20 flex items-center justify-center mb-4">
        <Icon className="text-amber text-3xl" />
      </div>
      <h2 className="text-xl font-display font-semibold mb-2">{title}</h2>
      <p className="text-sm text-text-secondary max-w-md mb-6">{description}</p>
      <Button asChild>
        <Link href={linkHref}>
          <LuExternalLink />
          {linkText}
        </Link>
      </Button>
    </div>
  );
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "running":
      return "badge-action";
    case "completed":
      return "badge-success";
    case "error":
    case "crashed":
      return "badge-error";
    case "paused":
      return "badge-warning";
    default:
      return "badge-system";
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getElapsedTime(startDate: string, nowMs: number): string {
  const start = new Date(startDate);
  const diffMs = nowMs - start.getTime();
  const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
  const mins = Math.floor(diffSecs / 60);
  const hrs = Math.floor(mins / 60);
  const secs = diffSecs % 60;

  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function getDuration(startDateString: string, endDateString: string | null): string {
  if (!endDateString) {
    return "N/A";
  }

  const start = new Date(startDateString);
  const end = new Date(endDateString);
  const diffMs = end.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);

  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m ${diffSecs % 60}s`;
  return `${diffHours}h ${diffMins % 60}m`;
}

function formatSeconds(totalSecs: number): string {
  const secs = Math.max(0, Math.floor(totalSecs));
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);

  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}
