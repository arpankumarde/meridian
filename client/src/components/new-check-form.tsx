"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  LuX, 
  LuRefreshCw, 
  LuArrowRight,
} from "react-icons/lu";
import { RiSparkling2Fill } from "react-icons/ri";

interface NewCheckFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ClarificationQuestion {
  question: string;
  options: string[];
  allow_multiple: boolean;
}

export default function NewCheckForm({ onClose, onSuccess }: NewCheckFormProps) {
  const router = useRouter();
  const [claim, setClaim] = useState("");
  const [maxIterations, setMaxIterations] = useState(1);
  const [enableClarification, setEnableClarification] = useState(true);
  const [enableMidQuestions, setEnableMidQuestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [showClarification, setShowClarification] = useState(false);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim.trim()) {
      setError("Please enter a research brief to scan");
      return;
    }

    if (enableClarification && !showClarification) {
      await getClarificationQuestions();
      return;
    }

    if (showClarification && Object.keys(answers).length > 0) {
      await startWithEnrichedClaim();
    } else {
      await startCheck(claim);
    }
  };

  const getClarificationQuestions = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://localhost:9090/api/checks/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: claim.trim(), max_questions: 4 }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate questions");
      }

      const data = await response.json();
      const qs = data.questions || [];
      if (qs.length === 0) {
        await startCheck(claim.trim());
        return;
      }
      setQuestions(qs);
      setShowClarification(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get clarification questions");
    } finally {
      setLoading(false);
    }
  };

  const startWithEnrichedClaim = async () => {
    setLoading(true);
    setError("");

    try {
      const enrichResponse = await fetch("http://localhost:9090/api/checks/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: claim.trim(),
          questions: questions,
          answers: answers,
        }),
      });

      if (!enrichResponse.ok) {
        throw new Error("Failed to enrich claim");
      }

      const enrichData = await enrichResponse.json();
      const enrichedClaim = enrichData.enriched_claim;

      await startCheck(enrichedClaim);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start fact check");
      setLoading(false);
    }
  };

  const startCheck = async (checkClaim: string) => {
    try {
      const response = await fetch("http://localhost:9090/api/checks/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: checkClaim,
          max_iterations: maxIterations,
          autonomous: !enableClarification && !enableMidQuestions,
          enable_mid_questions: enableMidQuestions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start fact check");
      }

      const data = await response.json();
      onSuccess();
      router.push(`/check/${data.session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start fact check");
    } finally {
      setLoading(false);
    }
  };

  const depthLabel = maxIterations <= 3 ? "Standard" : maxIterations <= 7 ? "Detailed" : maxIterations <= 14 ? "Deep Scan" : "Exhaustive";

  return (
    <div className="bg-white border border-obs-border rounded-lg overflow-hidden relative shadow-2xl">
      <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-7">
        {/* Header */}
        <div className="space-y-1.5 border-b border-obs-border pb-5">
          <h2 className="text-xl md:text-2xl font-display font-semibold tracking-tight text-text uppercase text-center md:text-left">
            {showClarification ? "Scan Refinement" : "Initialize Intelligence Scan"}
          </h2>
          <p className="text-[11px] font-mono text-text-secondary uppercase tracking-[0.2em] opacity-60 text-center md:text-left">
            {showClarification
              ? "Refining research scope via AI inquiry"
              : "Configuring multi-agent research parameters"}
          </p>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 p-1.5 rounded-full text-text-muted hover:text-amber hover:bg-surface transition-all"
        >
          <LuX className="text-xl" />
        </button>

        {!showClarification ? (
          <>
            {/* Claim Input */}
            <div className="space-y-2.5">
              <label className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.3em]">
                Research Brief
              </label>
              <textarea
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="w-full min-h-[100px] bg-surface border border-obs-border text-sm p-4 rounded-xl focus:outline-none focus:border-amber transition-colors text-text placeholder:text-text-muted/50 shadow-inner"
                placeholder='Enter a question, hypothesis, topic, or brief — e.g., "Perovskite tandem solar cells, last 24 months"'
              />
            </div>

            {/* Iterations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.3em]">
                  Scan Depth <span className="text-cyan ml-2 opacity-80">[{depthLabel} Sweep]</span>
                </label>
                <div className="bg-amber-soft px-3 py-0.5 rounded-full border border-amber/10">
                  <span className="text-amber font-mono text-[10px] font-bold tracking-widest">
                    {maxIterations} ITERATIONS
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                className="w-full h-1 bg-obs-border rounded-full appearance-none cursor-pointer accent-amber"
              />
               <div className="flex justify-between text-[9px] text-text-muted font-mono uppercase tracking-[0.25em] font-medium">
                <span>Quick Scan</span>
                <span>Exhaustive</span>
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-4 bg-surface border border-obs-border rounded-xl transition-all hover:bg-white hover:shadow-md cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-text uppercase tracking-widest mb-0.5">Clarification</span>
                  <span className="text-[9px] text-text-secondary uppercase tracking-[0.2em] font-medium">Pre-scan inquiry</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableClarification}
                  onChange={(e) => setEnableClarification(e.target.checked)}
                  className="w-5 h-5 accent-amber rounded border-obs-border"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-surface border border-obs-border rounded-xl transition-all hover:bg-white hover:shadow-md cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-text uppercase tracking-widest mb-0.5">Human in loop</span>
                  <span className="text-[9px] text-text-secondary uppercase tracking-[0.2em] font-medium">Mid-scan interrupt</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableMidQuestions}
                  onChange={(e) => setEnableMidQuestions(e.target.checked)}
                  className="w-5 h-5 accent-amber rounded border-obs-border"
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Clarification Questions */}
            <div className="space-y-6 bg-surface p-6 rounded-xl border border-obs-border">
              {questions.map((q, idx) => (
                <div key={idx} className="space-y-2">
                  <label className="block text-sm font-semibold text-text">
                    <span className="text-amber mr-2 font-mono">{idx + 1}.</span> {q.question}
                  </label>
                  <input
                    type="text"
                    value={answers[idx.toString()] || ""}
                    onChange={(e) => setAnswers({ ...answers, [idx.toString()]: e.target.value })}
                    className="w-full bg-white border border-obs-border p-3.5 text-sm rounded-lg focus:outline-none focus:border-amber transition-colors shadow-sm"
                    placeholder="Enter analytical response..."
                  />
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => {
                  setShowClarification(false);
                  setQuestions([]);
                  setAnswers({});
                }}
                className="flex items-center gap-2 text-[10px] font-mono font-bold text-text-muted hover:text-amber uppercase tracking-[0.25em] transition-colors"
              >
                <LuArrowRight className="rotate-180" /> Back to brief
              </button>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="text-[11px] font-mono text-rose bg-rose-soft border border-rose/20 rounded-xl px-4 py-3 uppercase tracking-[0.2em] font-bold">
            [ERR]: {error}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-0">
          <button
            type="submit"
            disabled={loading || !claim.trim() || (showClarification && Object.keys(answers).length === 0)}
            className="w-full py-5 px-6 bg-amber hover:bg-amber-hover text-white font-bold text-[12px] rounded-xl transition-all duration-300 uppercase tracking-[0.3em] flex items-center justify-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-amber/10 active:scale-[0.98]"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <span className="mt-0.5">{showClarification ? "Processing" : "Analyzing"}</span>
                <LuRefreshCw className="animate-spin text-lg" />
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2.5">
                <span className="mt-0.5 whitespace-nowrap">
                  {showClarification ? "Launch Scan" : (enableClarification ? "Next Phase" : "Launch Scan")}
                </span>
                { (showClarification || !enableClarification) ? (
                  <RiSparkling2Fill className="text-[17px] mb-0.5 text-white/90" />
                ) : (
                  <LuArrowRight className="text-lg" />
                )}
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
