"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import {
  LuUpload,
  LuFileText,
  LuSend,
  LuLoader,
  LuSparkles,
  LuMessageCircle,
  LuRefreshCw,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const MAX_MB = 20;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export default function PriorArtPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [followups, setFollowups] = useState<Record<string, string[]>>({});
  const [followupsLoadingFor, setFollowupsLoadingFor] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      abortRef.current?.abort();
    };
  }, [pdfUrl]);

  const handleFile = useCallback(async (incoming: File) => {
    if (incoming.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      return;
    }
    if (incoming.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB limit.`);
      return;
    }
    setEncoding(true);
    try {
      const b64 = await fileToBase64(incoming);
      const url = URL.createObjectURL(incoming);
      setPdfBase64(b64);
      setPdfUrl(url);
      setFile(incoming);
      setMessages([]);
      toast.success(`"${incoming.name}" loaded. Ready to interrogate.`);
    } catch (err) {
      toast.error("Failed to read PDF.");
      console.error(err);
    } finally {
      setEncoding(false);
    }
  }, []);

  const resetPaper = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    abortRef.current?.abort();
    setFile(null);
    setPdfUrl(null);
    setPdfBase64(null);
    setMessages([]);
    setInput("");
    setStreaming(false);
    setFollowups({});
    setFollowupsLoadingFor(null);
  }, [pdfUrl]);

  const fetchFollowups = useCallback(
    async (assistantId: string, convo: ChatMessage[]) => {
      if (!pdfBase64) return;
      setFollowupsLoadingFor(assistantId);
      try {
        const res = await fetch("/api/prior-art/followups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64,
            pdfFilename: file?.name,
            messages: convo.map(({ role, content }) => ({ role, content })),
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { followups?: string[] };
        if (Array.isArray(data.followups) && data.followups.length > 0) {
          setFollowups((prev) => ({ ...prev, [assistantId]: data.followups! }));
        }
      } catch {
        // Silent: follow-ups are a nice-to-have, not blocking.
      } finally {
        setFollowupsLoadingFor((curr) => (curr === assistantId ? null : curr));
      }
    },
    [pdfBase64, file?.name]
  );

  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const question = (overrideText ?? input).trim();
      if (!question || !pdfBase64 || streaming) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: question,
      };
      const assistantId = `a-${Date.now()}`;
      const assistantPlaceholder: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
      };

      const nextMessages = [...messages, userMsg];
      setMessages([...nextMessages, assistantPlaceholder]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let finalConvo: ChatMessage[] = nextMessages;
      let succeeded = false;

      try {
        const res = await fetch("/api/prior-art/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64,
            pdfFilename: file?.name,
            messages: nextMessages.map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
          );
        }
        finalConvo = [
          ...nextMessages,
          { id: assistantId, role: "assistant", content: acc },
        ];
        succeeded = acc.trim().length > 0;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          const msg = err instanceof Error ? err.message : "Chat request failed";
          toast.error(msg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `_Error: ${msg}_` }
                : m
            )
          );
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }

      if (succeeded) {
        fetchFollowups(assistantId, finalConvo);
      }
    },
    [input, pdfBase64, streaming, messages, file?.name, fetchFollowups]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface/30">
      {!file ? (
        <UploadZone
          dragOver={dragOver}
          encoding={encoding}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onPick={() => fileInputRef.current?.click()}
        />
      ) : (
        <>
          <header className="px-6 py-4 bg-white border-b border-obs-border flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-cyan/10 border border-cyan/20 flex items-center justify-center shrink-0">
                <LuFileText className="text-cyan text-lg" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-text truncate">{file.name}</h1>
                <p className="text-[11px] font-mono text-text-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · Document Interrogation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetPaper}
                className="text-[11px] font-bold uppercase tracking-widest gap-2"
              >
                <LuRefreshCw className="text-sm" />
                New document
              </Button>
            </div>
          </header>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_440px] overflow-hidden">
            <div className="bg-text/90 relative">
              {pdfUrl && (
                <iframe
                  src={pdfUrl}
                  title={file.name}
                  className="w-full h-full border-0"
                />
              )}
            </div>

            <ChatPanel
              messages={messages}
              streaming={streaming}
              input={input}
              onInput={setInput}
              onSend={sendMessage}
              followups={followups}
              followupsLoadingFor={followupsLoadingFor}
            />
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UploadZone({
  dragOver,
  encoding,
  onDrop,
  onDragOver,
  onDragLeave,
  onPick,
}: {
  dragOver: boolean;
  encoding: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onPick: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan/10 text-cyan text-[10px] font-bold uppercase tracking-widest border border-cyan/20 mb-4">
            <LuSparkles /> Prior-Art Search
          </div>
          <h1 className="text-3xl font-display font-semibold text-text mb-2">
            Interrogate a research document
          </h1>
          <p className="text-sm text-text-secondary">
            Upload a paper or patent filing to surface claims, methods, and prior-art overlaps side-by-side with an AI analyst.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={onPick}
          className={`rounded-2xl border-2 border-dashed transition-all cursor-pointer p-16 flex flex-col items-center justify-center text-center ${
            dragOver
              ? "border-cyan bg-cyan/5"
              : "border-obs-border bg-white hover:border-cyan/50 hover:bg-cyan/5"
          }`}
        >
          {encoding ? (
            <>
              <LuLoader className="text-4xl text-cyan animate-spin mb-4" />
              <p className="text-sm font-semibold text-text">Reading document…</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mb-5">
                <LuUpload className="text-2xl text-cyan" />
              </div>
              <p className="text-sm font-semibold text-text mb-1">
                Drop a PDF here or click to browse
              </p>
              <p className="text-xs text-text-muted font-mono">
                Up to {MAX_MB} MB · research paper or patent filing
              </p>
            </>
          )}
        </div>

        <p className="mt-6 text-[11px] text-text-muted text-center font-mono">
          Processed securely via OpenRouter. Content stays within this session.
        </p>
      </div>
    </div>
  );
}

function ChatPanel({
  messages,
  streaming,
  input,
  onInput,
  onSend,
  followups,
  followupsLoadingFor,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  input: string;
  onInput: (v: string) => void;
  onSend: (override?: string) => void;
  followups: Record<string, string[]>;
  followupsLoadingFor: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant" && m.content.trim().length > 0)?.id;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, followups]);

  return (
    <aside className="bg-white border-l border-obs-border flex flex-col min-h-0">
      <div className="px-5 py-4 border-b border-obs-border flex items-center gap-2">
        <LuMessageCircle className="text-cyan" />
        <h2 className="text-sm font-semibold text-text">Document Analyst</h2>
        {streaming && (
          <span className="ml-auto text-[10px] font-mono font-bold text-cyan uppercase tracking-widest flex items-center gap-1">
            <LuLoader className="animate-spin" />
            <AnalysisStatus />
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 ? (
          <EmptyChatHints onPick={onInput} />
        ) : (
          messages.map((m) => {
            const isLastAssistant = m.id === lastAssistantId;
            const chips = followups[m.id];
            const loadingChips = followupsLoadingFor === m.id;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-cyan text-white rounded-br-sm"
                      : "bg-surface border border-obs-border text-text rounded-bl-sm"
                  }`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div className="prose prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-pre:bg-text/90 prose-pre:text-white [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-1 [&_li]:pl-1 [&_li::marker]:text-text-muted">
                        <Streamdown>{m.content}</Streamdown>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-text-muted text-xs font-mono">
                        <LuLoader className="animate-spin" />
                        <AnalysisStatus verbose />
                      </span>
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>

                {m.role === "assistant" && isLastAssistant && !streaming && (loadingChips || chips) && (
                  <div className="mt-3 w-full">
                    <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted mb-2">
                      Suggested follow-ups
                    </p>
                    {loadingChips && !chips ? (
                      <div className="flex flex-wrap gap-2">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="h-7 w-40 rounded-full bg-surface border border-obs-border animate-pulse"
                          />
                        ))}
                      </div>
                    ) : chips ? (
                      <div className="flex flex-wrap gap-2">
                        {chips.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => onSend(q)}
                            disabled={streaming}
                            className="text-xs text-left px-3 py-1.5 rounded-full border border-cyan/30 bg-cyan/5 text-cyan hover:bg-cyan hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-obs-border p-4 bg-surface/20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1">
            <Input
              value={input}
              onChange={(e) => onInput(e.target.value)}
              placeholder="Ask about methods, claims, prior-art overlaps…"
              className="h-11 obs-input"
              disabled={streaming}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || streaming}
            className="h-11 w-11 p-0 bg-cyan hover:bg-cyan-hover text-white disabled:opacity-40"
            title="Send"
          >
            {streaming ? (
              <LuLoader className="animate-spin text-lg" />
            ) : (
              <LuSend className="text-lg" />
            )}
          </Button>
        </form>
      </div>
    </aside>
  );
}

const ANALYSIS_PHASES = [
  "Parsing document",
  "Analysing passages",
  "Cross-referencing claims",
  "Synthesising response",
] as const;

function AnalysisStatus({ verbose = false }: { verbose?: boolean }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % ANALYSIS_PHASES.length),
      1800
    );
    return () => clearInterval(timer);
  }, []);
  const phrase = ANALYSIS_PHASES[index];
  return <span>{verbose ? `${phrase}…` : phrase}</span>;
}

function EmptyChatHints({ onPick }: { onPick: (v: string) => void }) {
  const prompts = [
    "Summarize this paper in 5 bullet points.",
    "What is the main contribution and how is it validated?",
    "Identify potential prior-art overlaps or conflicting claims.",
    "Extract all evaluation metrics and their values.",
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-cyan/10 border border-cyan/20 flex items-center justify-center mb-4">
        <LuSparkles className="text-cyan text-xl" />
      </div>
      <p className="text-sm font-semibold text-text mb-1">Begin document interrogation</p>
      <p className="text-[12px] text-text-secondary mb-5 max-w-xs">
        Ask anything about the uploaded document. Answers are grounded in its contents.
      </p>
      <div className="w-full space-y-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="w-full text-left text-xs px-3 py-2 rounded-lg border border-obs-border bg-surface hover:border-cyan/40 hover:bg-cyan/5 transition-colors text-text-secondary hover:text-text"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

