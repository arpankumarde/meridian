"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import NewCheckForm from "@/components/new-check-form";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LuPlus,
  LuArrowUpRight,
  LuHistory,
  LuLoader,
  LuFileSearch,
  LuCompass,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";

interface Session {
  session_id: string;
  goal: string;
  claim: string;
  max_iterations: number;
  status: string;
  created_at: string;
  completed_at?: string | null;
  iteration_count?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const fetchSessions = async () => {
    try {
      const response = await fetch("http://localhost:9090/api/sessions/?limit=50");
      if (response.ok) {
        const data = await response.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    if (!localStorage.getItem("meridian_onboarding_domain")) {
      setTimeout(() => setShowOnboarding(true), 300);
    }
  }, []);

  const handleOnboardingComplete = async (domain: string) => {
    localStorage.setItem("meridian_onboarding_domain", domain);
    setShowOnboarding(false);
    toast.success(`Workspace tailored for ${domain}`);
    // This value mimics the orgDomain payload dropped during signup
  };

  const activeStatuses = ["running", "pending", "paused", "crashed"];
  const activeSessions = sessions.filter((s) => activeStatuses.includes(s.status));
  const completedSessions = sessions.filter((s) => !activeStatuses.includes(s.status));

  return (
    <div className="w-full flex-1 flex flex-col font-sans">
      {/* Main Dashboard UI */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-baseline mb-8 gap-4">
           <div>
             <h2 className="text-3xl font-display font-semibold mb-2">Research Intelligence</h2>
             <p className="text-text-secondary text-sm">Workspace status: <span className="text-emerald font-bold uppercase tracking-widest text-[10px]">Operational</span></p>
           </div>

            <div className="flex flex-wrap gap-4 items-center">
              <div className="px-4 py-2 bg-surface border border-obs-border rounded-lg text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">
                 Session: {Math.random().toString(16).slice(2, 8).toUpperCase()}
              </div>
              <Button
                onClick={() => setShowNewCheck(true)}
                size="default"
                className="px-5 text-[12px] font-bold uppercase tracking-wider"
              >
                <LuPlus />
                New Scan
              </Button>
            </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-white border border-obs-border rounded-lg overflow-hidden mb-10">
          <div className="p-5 border-b md:border-b-0 md:border-r border-obs-border hover:bg-surface transition-colors">
            <p className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.2em] mb-2">Total Scans</p>
            <p className="font-display text-3xl font-bold text-text mb-0.5">{sessions.length}</p>
            <p className="text-[11px] text-text-secondary">Landscape &amp; prior-art history</p>
          </div>
          <div className="p-5 border-b md:border-b-0 md:border-r border-obs-border hover:bg-surface transition-colors">
            <p className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.2em] mb-2">In Progress</p>
            <p className="font-display text-3xl font-bold text-amber mb-0.5">{activeSessions.length}</p>
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-breathe" />
               <p className="text-[11px] text-text-secondary">Agents gathering evidence</p>
            </div>
          </div>
          <div className="p-5 hover:bg-surface transition-colors">
            <p className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.2em] mb-2">Workspace Uptime</p>
            <p className="font-display text-3xl font-bold text-text mb-0.5"><SystemUptime /></p>
            <p className="text-[11px] text-text-secondary">Since March 24, 2026</p>
          </div>
        </div>

        {/* Primary workflows */}
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-4">
            <h3 className="text-[12px] font-mono font-bold text-text-muted uppercase tracking-[0.3em]">Workflows</h3>
            <div className="h-px flex-1 bg-obs-border opacity-50" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowNewCheck(true)}
              className="group relative overflow-hidden p-5 bg-white border border-obs-border rounded-lg hover:border-amber hover:shadow-[0_8px_24px_-12px_rgba(28,12,158,0.35)] transition-all text-left"
            >
              <div className="relative w-9 h-9 rounded-lg bg-amber flex items-center justify-center mb-3 ring-1 ring-amber-hover/60">
                <LuCompass className="text-white text-lg" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan ring-2 ring-white" />
              </div>
              <h4 className="text-sm font-semibold text-text mb-1">Landscape Scan</h4>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                Hand in a brief, topic, or hypothesis. Get a confidence-scored landscape - who&apos;s doing what, where the consensus is, where the gaps are.
              </p>
              <span className="text-[10px] font-mono font-bold text-amber uppercase tracking-widest inline-flex items-center gap-1 border-b-2 border-cyan/0 group-hover:border-cyan transition-colors pb-0.5">
                New scan &rarr;
              </span>
            </button>
            <button
              onClick={() => router.push("/workspace/prior-art")}
              className="group relative overflow-hidden p-5 bg-white border border-obs-border rounded-lg hover:border-cyan hover:shadow-[0_8px_24px_-12px_rgba(15,151,170,0.35)] transition-all text-left"
            >
              <div className="relative w-9 h-9 rounded-lg bg-cyan flex items-center justify-center mb-3 ring-1 ring-cyan-hover/60">
                <LuFileSearch className="text-white text-lg" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber ring-2 ring-white" />
              </div>
              <h4 className="text-sm font-semibold text-text mb-1">Prior-Art Search</h4>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                Upload a paper or patent filing and interrogate it — surface conflicting claims, methods, and prior-art overlaps instantly.
              </p>
              <span className="text-[10px] font-mono font-bold text-cyan uppercase tracking-widest inline-flex items-center gap-1 border-b-2 border-amber/0 group-hover:border-amber transition-colors pb-0.5">
                Open analyst &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* Scan Sessions */}
        <div className="space-y-10">
          {/* Active Scans */}
          {activeSessions.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-[12px] font-mono font-bold text-amber uppercase tracking-[0.3em]">In Progress</h3>
                <div className="h-px flex-1 bg-obs-border opacity-50" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => (
                  <SessionCard key={session.session_id} session={session} onClick={() => router.push(`/check/${session.session_id}`)} />
                ))}
              </div>
            </div>
          )}

          {/* History */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-[12px] font-mono font-bold text-text-muted uppercase tracking-[0.3em]">Scan History</h3>
              <div className="h-px flex-1 bg-obs-border opacity-50" />
            </div>

            {loading ? (
              <div className="p-8 border border-obs-border border-dashed rounded-lg text-center">
                 <LuLoader className="animate-spin text-amber text-2xl mb-3 mx-auto" />
                 <p className="text-sm font-mono text-text-secondary">Loading scan history...</p>
              </div>
            ) : completedSessions.length === 0 && activeSessions.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center border border-obs-border rounded-lg bg-surface">
                <div className="relative w-14 h-14 rounded-xl bg-amber flex items-center justify-center mb-4 ring-1 ring-amber-hover/60">
                  <LuFileSearch className="text-white text-2xl" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan ring-2 ring-surface" />
                </div>
                <h3 className="text-lg font-display font-semibold mb-1.5">No scans yet</h3>
                <p className="text-sm text-text-secondary max-w-sm mb-5">
                  Kick off your first research scan - a brief, a hypothesis, or an invention disclosure. Meridian will return a cross-corpus landscape with citations.
                </p>
                <Button
                  onClick={() => setShowNewCheck(true)}
                  size="default"
                  className="px-6 text-sm font-bold"
                >
                  Start first scan
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedSessions.map((session) => (
                  <SessionCard key={session.session_id} session={session} onClick={() => router.push(`/check/${session.session_id}`)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Check Modal */}
      {showNewCheck && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4 md:p-12">
            <div className="w-full max-w-[640px] animate-scale-up shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl bg-white overflow-hidden">
              <NewCheckForm
                onClose={() => setShowNewCheck(false)}
                onSuccess={() => {
                  setShowNewCheck(false);
                  fetchSessions();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showOnboarding && <DomainOnboardingModal onClose={handleOnboardingComplete} />}
    </div>
  );
}

function DomainOnboardingModal({ onClose }: { onClose: (domain: string) => void }) {
  const [selected, setSelected] = useState<string>("");
  const [custom, setCustom] = useState("");

  const domains = ["Deep Tech", "Biology & Medical", "Software & AI", "Materials Science", "Custom"];

  const handleSave = () => {
    const finalDomain = selected === "Custom" ? custom : selected;
    if (finalDomain.trim()) {
      onClose(finalDomain);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white border border-obs-border rounded-xl shadow-2xl p-8 animate-rise relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber to-cyan" />
        
        <h2 className="font-display text-2xl font-bold text-text mb-2 tracking-tight">Configure Workspace</h2>
        <p className="font-sub text-[15px] text-text-secondary mb-6">
          To tailor your landscape scans, please specify your organization's primary domain of research.
        </p>

        <div className="space-y-3 mb-6">
          {domains.map(d => (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-[14px] font-semibold transition-all ${
                selected === d 
                  ? 'border-amber bg-amber/5 text-amber ring-1 ring-amber shadow-[0_0_15px_-3px_rgba(255,166,0,0.15)]' 
                  : 'border-obs-border hover:border-obs-border/80 hover:bg-surface text-text'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {selected === "Custom" && (
          <div className="mb-6 animate-scale-up">
            <Label htmlFor="customDomain" className="font-sans text-xs uppercase tracking-widest text-text-secondary mb-2 block">
              Specify Domain
            </Label>
            <Input 
              id="customDomain" 
              placeholder="e.g. Quantum Computing" 
              value={custom} 
              onChange={e => setCustom(e.target.value)}
              className="h-12 obs-input text-[15px]"
            />
          </div>
        )}

        <Button 
          onClick={handleSave} 
          disabled={!selected || (selected === "Custom" && !custom.trim())}
          className="h-12 w-full bg-text hover:bg-black text-white font-bold uppercase tracking-widest text-[13px] transition-colors relative overflow-hidden group"
        >
          <span className="relative z-10 transition-transform group-hover:translate-x-1 inline-block">Initialize Workspace</span>
          <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </Button>
      </div>
    </div>
  );
}

function SessionCard({ session, onClick }: { session: Session; onClick: () => void }) {
  const isActive = session.status === "running" || session.status === "pending";
  const isPaused = session.status === "paused";
  const isCrashed = session.status === "crashed";
  const isCompleted = session.status === "completed";

  const timeDisplay = isActive
    ? getElapsedTime(session.created_at)
    : getDuration(session.created_at, session.completed_at);

  const statusColor = isCrashed ? "bg-rose" : isPaused ? "bg-gold" : isActive ? "bg-amber" : isCompleted ? "bg-emerald" : "bg-text-muted opacity-40";
  const statusBorder = isCrashed ? "border-rose" : isPaused ? "border-gold" : isActive ? "border-amber" : isCompleted ? "border-emerald" : "border-obs-border";
  const statusText = isCrashed ? "text-rose" : isPaused ? "text-gold" : isActive ? "text-amber" : isCompleted ? "text-emerald" : "text-text-muted";

  return (
    <button
      onClick={onClick}
      className={`p-4 bg-white border ${statusBorder} hover:shadow-md transition-all text-left group relative overflow-hidden rounded-lg`}
    >
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${statusColor} ${isActive ? 'animate-breathe' : ''}`} />
            <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${statusText}`}>
              {session.status}
            </span>
         </div>
         <LuArrowUpRight className="text-[16px] text-text-muted group-hover:text-amber transition-colors" />
      </div>

      <h3 className="text-sm font-semibold text-text mb-3 line-clamp-2 leading-snug min-h-10">
        {session.claim}
      </h3>

      <div className="flex items-center justify-between pt-3 border-t border-obs-border/30 text-[10px] font-mono text-text-secondary uppercase">
        <span className="flex items-center gap-2">
          <LuHistory className="text-sm opacity-60" />
          {timeDisplay}
        </span>
      </div>
    </button>
  );
}

function getElapsedTime(startDateString: string): string {
  const now = new Date();
  const start = new Date(startDateString);
  const diffMs = now.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffMins < 1) return "initialized";
  if (diffMins < 60) return `${diffMins}m active`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
}

function getDuration(startDateString: string, endDateString?: string | null): string {
  if (!endDateString) {
    const start = new Date(startDateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    return `${diffDays}d ago`;
  }

  const start = new Date(startDateString);
  const end = new Date(endDateString);
  const diffMs = end.getTime() - start.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m`;
  return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
}

const SYSTEM_EPOCH = new Date("2026-03-24T08:00:00Z").getTime();

function SystemUptime() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const diffMs = now - SYSTEM_EPOCH;
  if (diffMs < 0) return <>0s</>;

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);

  if (days > 0) {
    return <>{days}<span className="text-xl opacity-60 ml-0.5">d</span> {hours}<span className="text-xl opacity-60 ml-0.5">h</span></>;
  }
  if (hours > 0) {
    return <>{hours}<span className="text-xl opacity-60 ml-0.5">h</span> {mins}<span className="text-xl opacity-60 ml-0.5">m</span></>;
  }
  return <>{mins}<span className="text-xl opacity-60 ml-0.5">m</span></>;
}
