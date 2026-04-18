"use client";

import {
  LuGitBranch,
  LuCompass,
  LuNetwork,
  LuChartLine,
} from "react-icons/lu";
import type { IconType } from "react-icons";

type Step = {
  title: string;
  description: string;
  Icon: IconType;
  /** Primary chip color — alternates across the four steps. */
  tone: "indigo" | "teal";
};

export default function LandingProcess() {
  const steps: Step[] = [
    {
      title: "Decompose",
      description:
        "The Director turns a brief, hypothesis, or internal document into researchable sub-questions.",
      Icon: LuGitBranch,
      tone: "indigo",
    },
    {
      title: "Gather",
      description:
        "Parallel Intern agents pull evidence from papers, patents, standards, filings, and your Drive corpus.",
      Icon: LuCompass,
      tone: "teal",
    },
    {
      title: "Connect",
      description:
        "A cross-corpus knowledge graph links internal findings to external signals - corroboration, contradiction, prior art, white space.",
      Icon: LuNetwork,
      tone: "indigo",
    },
    {
      title: "Synthesize",
      description:
        "Findings are scored on confidence, consensus, and source diversity - rendered as a report, landscape, ranked list, or decision memo.",
      Icon: LuChartLine,
      tone: "teal",
    },
  ];

  return (
    <section id="process" className="py-24 px-6 max-w-7xl mx-auto border-t border-b border-obs-border">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
        <div className="max-w-xl">
          <h2 className="font-section mb-6 text-text">One pipeline. Two workflows.</h2>
          <p className="text-text-secondary text-base leading-relaxed">
            The same hierarchical Director → Manager → Intern system drives both a competitive landscape scan for strategy analysts and a prior-art search for IP teams - differing only in prompt and renderer.
          </p>
        </div>
        <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted border-l border-amber pl-6 py-2">
          Hierarchical agents <br />
          Cross-corpus KG
        </div>
      </div>

      <div className="grid-container grid-cols-1 md:grid-cols-2 lg:grid-cols-4 bg-white border-obs-border">
        {steps.map(({ title, description, Icon, tone }, i) => {
          const chip = tone === "indigo" ? "bg-amber ring-amber-hover/60" : "bg-cyan ring-cyan-hover/60";
          const dot = tone === "indigo" ? "bg-cyan" : "bg-amber";
          const step = String(i + 1).padStart(2, "0");
          return (
            <div
              key={i}
              className="grid-cell group relative hover:bg-surface transition-colors cursor-default border-obs-border"
            >
              <span className="absolute top-4 right-4 text-[10px] font-mono font-bold text-text-muted tracking-widest">
                {step}
              </span>
              <div
                className={`relative mb-8 w-12 h-12 rounded-lg ring-1 ${chip} inline-flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}
              >
                <Icon className="text-[22px] text-white" />
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${dot} ring-2 ring-white`} />
              </div>
              <h3 className="text-lg font-display font-semibold mb-4 text-text uppercase tracking-tight">
                {title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
