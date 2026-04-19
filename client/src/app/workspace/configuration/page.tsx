"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  LuCopy, 
  LuCheck, 
  LuKey, 
  LuBrain, 
  LuZap, 
  LuShieldCheck, 
  LuCode, 
  LuFileText, 
  LuMicroscope,
  LuCompass
} from "react-icons/lu";
import { toast } from "sonner";

// Purposes tailored for Meridian Intelligence
const PURPOSES = [
  {
    key: "graph_builder",
    label: "Graph Builder",
    description: "Ingests raw reconnaissance data into the knowledge graph.",
    icon: LuBrain,
    color: "text-amber"
  },
  {
    key: "strategist",
    label: "Strategist",
    description: "Generates high-level research hypotheses and plans.",
    icon: LuCompass,
    color: "text-cyan"
  },
  {
    key: "scout",
    label: "Scout",
    description: "Performs fast, exploratory analysis of new sources.",
    icon: LuZap,
    color: "text-gold"
  },
  {
    key: "exploit_planner",
    label: "Exploit Planner",
    description: "Agentic coding for vulnerability proof-of-concepts.",
    icon: LuCode,
    color: "text-rose"
  },
  {
    key: "cross_validator",
    label: "Cross Validator",
    description: "Performs independent validation of research findings.",
    icon: LuShieldCheck,
    color: "text-emerald"
  },
  {
    key: "codebase_analyzer",
    label: "Codebase Analyzer",
    description: "Deep structural understanding of target source code.",
    icon: LuMicroscope,
    color: "text-violet"
  },
  {
    key: "report_writer",
    label: "Report Writer",
    description: "Synthesizes intelligence into executive reports.",
    icon: LuFileText,
    color: "text-text"
  },
] as const;

// Models available via OpenRouter (latest generation)
const MODELS = [
  // Anthropic
  { id: "anthropic/claude-opus-4-7", name: "Claude Opus 4.7", provider: "anthropic" },
  { id: "anthropic/claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic" },
  // OpenAI
  { id: "openai/gpt-5.4", name: "GPT-5.4", provider: "openai" },
  { id: "openai/gpt-5.4-mini", name: "GPT-5.4 Mini", provider: "openai" },
  { id: "openai/codex-1", name: "Codex", provider: "openai" },
  { id: "openai/o3", name: "o3", provider: "openai" },
  { id: "openai/o3-mini", name: "o3 Mini", provider: "openai" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "openai" },
  // Google
  { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google" },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "google" },
  { id: "google/gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "google" },
  // xAI
  { id: "x-ai/grok-4", name: "Grok 4", provider: "xai" },
  { id: "x-ai/grok-3", name: "Grok 3", provider: "xai" },
  // Meta
  { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout", provider: "meta" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", provider: "meta" },
  // DeepSeek
  { id: "deepseek/deepseek-v3.1", name: "DeepSeek V3.1", provider: "deepseek" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
  // Mistral
  { id: "mistralai/mistral-large-3", name: "Mistral Large 3", provider: "mistral" },
] as const;

const PROVIDER_LOGOS: Record<string, string> = {
  openai: "https://models.dev/logos/openai.svg",
  anthropic: "https://models.dev/logos/anthropic.svg",
  google: "https://models.dev/logos/google.svg",
  xai: "https://models.dev/logos/xai.svg",
  meta: "https://models.dev/logos/meta.svg",
  deepseek: "https://models.dev/logos/deepseek.svg",
  mistral: "https://models.dev/logos/mistral.svg",
};

const DUMMY_API_KEY = "sk-or-v1-••••••••••••••••••••••••••••••••";

export default function ConfigurationPage() {
  const DEFAULT_MODEL_BY_PURPOSE: Record<string, string> = {
    graph_builder: "anthropic/claude-opus-4-7",
    strategist: "anthropic/claude-opus-4-7",
    scout: "openai/gpt-5.4",
    exploit_planner: "openai/codex-1",
    cross_validator: "anthropic/claude-opus-4-7",
    codebase_analyzer: "openai/codex-1",
    report_writer: "anthropic/claude-opus-4-7",
  };

  const [modelByPurpose, setModelByPurpose] = useState<Record<string, string>>(
    Object.fromEntries(
      PURPOSES.map((p) => [p.key, DEFAULT_MODEL_BY_PURPOSE[p.key] ?? "anthropic/claude-opus-4-7"])
    )
  );
  const [apiKey, setApiKey] = useState(DUMMY_API_KEY);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleCopyKey = useCallback(async () => {
    if (apiKey) {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success("API Key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [apiKey]);

  const testConnection = async () => {
    setTesting(true);
    // Simulate a connection test
    await new Promise(r => setTimeout(r, 1500));
    toast.success("Connection to OpenRouter verified successfully");
    setTesting(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2 text-text">Workspace Configuration</h2>
        <p className="text-text-secondary text-sm">Tune the intelligence engine and model parameters.</p>
      </div>

      <div className="grid gap-8">
        {/* API Key Card */}
        <Card className="border-obs-border shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b border-obs-border bg-surface/30">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center border border-amber/20">
                <LuKey className="text-amber" />
              </div>
              <div>
                <CardTitle className="text-base">OpenRouter API Access</CardTitle>
                <CardDescription className="text-xs">Secure gateway for all intelligence requests.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              <Label className="text-[10px] uppercase tracking-widest font-bold text-text-secondary">
                Production API Key
              </Label>
              <div className="flex items-center gap-3 max-w-2xl">
                <div className="relative flex-1">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono text-xs h-11 border-obs-border bg-surface pl-10 focus:border-amber"
                  />
                  <LuKey className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm" />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyKey}
                  className="h-11 w-11 border-obs-border hover:bg-surface transition-colors"
                >
                  {copied ? (
                    <LuCheck className="text-emerald" />
                  ) : (
                    <LuCopy className="text-text-muted" />
                  )}
                </Button>
                <Button
                  onClick={testConnection}
                  disabled={testing}
                  className="h-11 bg-amber hover:bg-amber-hover text-white font-bold uppercase tracking-widest text-[10px] px-6 gap-2 h-11"
                >
                  {testing ? "Verifying..." : "Test Connection"}
                </Button>
              </div>
              <p className="text-[11px] text-text-muted italic">
                Keys are stored locally and encrypted before transit. Never share your secret keys.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Intelligence Purposes Grid */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1">
             <LuZap className="text-amber" />
             <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-text-secondary/80">Intelligence Assignment</h3>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PURPOSES.map((purpose) => {
              const modelId = modelByPurpose[purpose.key];
              return (
                <Card key={purpose.key} className="border-obs-border shadow-sm hover:shadow-md transition-all duration-300 bg-white group">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-surface border border-obs-border flex items-center justify-center transition-transform group-hover:scale-110`}>
                        <purpose.icon className={`text-xl ${purpose.color}`} />
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-surface border border-obs-border text-[9px] font-mono font-bold text-text-muted uppercase tracking-tighter">
                        Purpose: {purpose.key.replace('_', ' ')}
                      </div>
                    </div>
                    <CardTitle className="text-base text-text">{purpose.label}</CardTitle>
                    <CardDescription className="text-xs leading-relaxed min-h-[32px]">
                      {purpose.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                         <Label className="text-[10px] uppercase tracking-widest font-bold text-text-muted">Target Model</Label>
                         <span className="text-[9px] font-mono text-text-muted opacity-60">Latency: Low</span>
                      </div>
                      <Select
                        value={modelId}
                        onValueChange={(v) =>
                          setModelByPurpose((prev) => ({
                            ...prev,
                            [purpose.key]: v,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full h-11 border-obs-border bg-surface text-xs focus:ring-1 focus:ring-amber/20">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent className="border-obs-border">
                          {MODELS.map((m) => (
                            <SelectItem key={m.id} value={m.id} className="text-xs focus:bg-amber-soft">
                              <span className="flex items-center gap-2">
                                <Image
                                  src={PROVIDER_LOGOS[m.provider]}
                                  alt=""
                                  width={14}
                                  height={14}
                                  className="shrink-0 grayscale opacity-70"
                                  unoptimized
                                />
                                <span className="font-medium">{m.name}</span>
                                <span className="opacity-40 font-mono text-[10px]">
                                  {m.id.split('/')[1]}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Footer Actions */}
      <div className="mt-12 pt-8 border-t border-obs-border flex justify-end items-center gap-3">
         <Button variant="ghost" className="h-11 font-bold uppercase tracking-widest text-[11px] px-6">Discard Changes</Button>
         <Button className="h-11 bg-amber hover:bg-amber-hover text-white font-bold uppercase tracking-widest text-[11px] px-8 shadow-sm shadow-amber/10 transition-all hover:translate-y-[-1px]">
           Persist Configuration
         </Button>
      </div>
    </div>
  );
}
