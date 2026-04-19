"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LuSearch, LuFilter, LuPlus, LuFileText, LuLoader } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NewCheckForm from "@/components/new-check-form";

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

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald/10 text-emerald",
  running: "bg-amber/10 text-amber",
  pending: "bg-amber/10 text-amber",
  paused: "bg-gold/10 text-gold",
  crashed: "bg-rose/10 text-rose",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export default function ResearchPage() {
  const router = useRouter();
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(
      (s) =>
        s.claim?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q)
    );
  }, [sessions, query]);

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-display font-semibold mb-2">Research Library</h2>
            <p className="text-text-secondary text-sm">Manage and analyze your research repository.</p>
          </div>
          <Button
            onClick={() => setShowNewCheck(true)}
            className="px-5 text-[12px] font-bold uppercase tracking-wider gap-2 shadow-lg shadow-amber/10"
          >
            <LuPlus />
            New Scan
          </Button>
        </div>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1">
            <LuSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              placeholder="Search within your library..."
              className="pl-11 h-12 obs-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-12 border-obs-border gap-2">
            <LuFilter />
            Filters
          </Button>
        </div>

        <div className="bg-white border border-obs-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-obs-border">
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Claim</th>
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Created</th>
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obs-border">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center">
                    <LuLoader className="animate-spin text-amber text-2xl mx-auto mb-3" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
                      Loading sessions...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-16 text-center text-sm text-text-secondary">
                    {sessions.length === 0
                      ? "No research sessions yet. Start a new scan to populate your library."
                      : "No sessions match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((session) => {
                  const statusClass = STATUS_STYLES[session.status] ?? "bg-surface text-text-muted";
                  return (
                    <tr
                      key={session.session_id}
                      onClick={() => router.push(`/check/${session.session_id}`)}
                      className="hover:bg-surface/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <LuFileText className="text-amber text-lg shrink-0" />
                          <span className="text-sm font-semibold text-text group-hover:text-amber transition-colors line-clamp-1">
                            {session.claim || "Untitled claim"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary font-mono">
                        {formatDate(session.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                          {session.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </>
  );
}
