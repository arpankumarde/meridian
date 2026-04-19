"use client";

import LandingNav from "@/components/landing/nav";
import LandingHero from "@/components/landing/hero";
import LandingProcess from "@/components/landing/process";
import LandingPricing from "@/components/landing/pricing";
import LandingFooter from "@/components/landing/footer";
import { LuBookOpen, LuGlobe, LuScale, LuFolderGit2 } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-text selection:bg-amber/20 selection:text-amber overflow-x-hidden">
      <LandingNav />

      <main>
        <LandingHero />

        <LandingProcess />

        {/* Architecture Section */}
        <section
          id="features"
          className="py-24 px-6 bg-surface border-t border-b border-obs-border"
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="stagger-children">
              <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber mb-6 animate-rise opacity-0">
                The Moat
              </h4>
              <h2 className="font-section mb-8 text-text animate-rise opacity-0 [animation-delay:80ms]">
                A cross-corpus knowledge graph - not a search wrapper.
              </h2>
              <p className="font-sub mb-10 text-text-secondary leading-relaxed animate-rise opacity-0 [animation-delay:160ms]">
                Pure external research is crowded (Elicit, Consensus,
                Undermind). Pure internal search is crowded (Glean, Guru).
                Meridian&apos;s defensible layer is the edges between them -
                every node is tagged internal or external, and the graph
                surfaces corroboration, contradiction, prior art, and white
                space across both corpora.
              </p>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8 animate-rise opacity-0 [animation-delay:240ms]">
                <li className="flex flex-col gap-4 p-6 border border-obs-border bg-white rounded-lg">
                  <div className="relative w-9 h-9 rounded-lg bg-amber ring-1 ring-amber-hover/60 flex items-center justify-center">
                    <LuBookOpen className="text-[15px] text-white" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan ring-2 ring-white" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-text mb-1 uppercase tracking-tight">
                      Scientific Literature
                    </h5>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      Semantic Scholar and arXiv retrieval with peer-review
                      signal and citation graph context.
                    </p>
                  </div>
                </li>
                <li className="flex flex-col gap-4 p-6 border border-obs-border bg-white rounded-lg">
                  <div className="relative w-9 h-9 rounded-lg bg-cyan ring-1 ring-cyan-hover/60 flex items-center justify-center">
                    <LuScale className="text-[15px] text-white" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber ring-2 ring-white" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-text mb-1 uppercase tracking-tight">
                      Patents
                    </h5>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      USPTO, EPO, and Google Patents with claims structure and
                      citation graph for prior-art work.
                    </p>
                  </div>
                </li>
                <li className="flex flex-col gap-4 p-6 border border-obs-border bg-white rounded-lg">
                  <div className="relative w-9 h-9 rounded-lg bg-amber ring-1 ring-amber-hover/60 flex items-center justify-center">
                    <LuGlobe className="text-[15px] text-white" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan ring-2 ring-white" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-text mb-1 uppercase tracking-tight">
                      Standards &amp; Filings
                    </h5>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      SEC EDGAR, openFDA, EMA, plus IEEE/ISO/ASTM/NIST metadata
                      for regulatory and standards context.
                    </p>
                  </div>
                </li>
                <li className="flex flex-col gap-4 p-6 border border-obs-border bg-white rounded-lg">
                  <div className="relative w-9 h-9 rounded-lg bg-cyan ring-1 ring-cyan-hover/60 flex items-center justify-center">
                    <LuFolderGit2 className="text-[15px] text-white" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber ring-2 ring-white" />
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-text mb-1 uppercase tracking-tight">
                      Your Internal Corpus
                    </h5>
                    <p className="text-[13px] text-text-secondary leading-relaxed">
                      Google Drive OAuth connector ingests Docs, PDFs, and
                      Slides into a private, corpus-tagged vector store.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="relative animate-rise opacity-0 [animation-delay:320ms]">
              <div className="relative obs-card bg-white p-1 border-obs-border shadow-md rounded-lg overflow-hidden">
                <div className="bg-surface rounded-lg p-6 font-mono text-[11px] text-text-secondary overflow-hidden h-[400px]">
                  <div className="mb-4 flex items-center gap-2 text-text border-b border-obs-border pb-4">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                      scan_2026_04_19.log
                    </span>
                  </div>
                  <div className="space-y-3 opacity-90 overflow-y-auto h-full pr-2">
                    <p className="text-amber font-bold">
                      [DIRECTOR] Intent routed: prior-art - invention disclosure
                      #INV-0412
                    </p>
                    <p className="text-text-secondary ml-4">
                      → Decomposing into 7 sub-questions (novelty, obviousness,
                      claim scope)
                    </p>
                    <p className="text-cyan font-bold">
                      [MANAGER] Dispatching to Intern pool across 5 corpora
                    </p>
                    <p className="text-text-secondary ml-4">
                      [INTERN_02] patent_search(USPTO) → 34 hits
                    </p>
                    <p className="text-text-secondary ml-4">
                      [INTERN_05] academic_search(Semantic Scholar) → 18 papers
                    </p>
                    <p className="text-text-secondary ml-4">
                      [INTERN_09] gdrive_search(internal) → 6 docs
                    </p>
                    <p className="text-cyan font-bold">
                      [KG] Cross-corpus edges materialized: 11 internal↔external
                    </p>
                    <p className="text-rose font-bold">
                      [KG] external_overlaps_with_internal_claim detected → 2
                      high-risk hits
                    </p>
                    <p className="text-amber font-bold">
                      [MANAGER] Scoring confidence · consensus ·
                      source-diversity
                    </p>
                    <p className="text-emerald font-bold">
                      [SYNTH] Landscape ready - 3 corroborating, 2
                      contradicting, 4 prior-art
                    </p>
                    <div className="animate-pulse flex gap-1 h-2 mt-4">
                      <span className="w-2 bg-amber" />
                      <span className="w-1 bg-amber/50" />
                      <span className="w-1 bg-amber/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LandingPricing />

        {/* CTA Section */}
        <section className="py-32 px-6 flex flex-col items-center text-center max-w-7xl mx-auto">
          <div className="max-w-2xl stagger-children flex flex-col items-center">
            <h2 className="font-section mb-6 text-text uppercase tracking-tight">
              Enter the workspace
            </h2>
            <p className="font-sub mb-10 text-text-secondary leading-relaxed">
              Start a landscape scan or a prior-art search. Confidence-scored
              findings with full citation trails - not hard verdicts.
            </p>
            <Button
              asChild
              size="lg"
              className="px-12 h-14 text-[15px] font-bold uppercase tracking-widest"
            >
              <Link href="/login">Launch Workspace</Link>
            </Button>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
