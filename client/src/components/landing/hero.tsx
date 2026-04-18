"use client";

import { useRouter } from "next/navigation";
import {
  LuArrowRight,
  LuArrowUpRight,
  LuNetwork,
  LuBookOpen,
  LuGraduationCap,
  LuScale,
  LuFileText,
  LuHeartPulse,
  LuFolderGit2,
  LuRuler,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { Button } from "@/components/ui/button";

export default function LandingHero() {
  const router = useRouter();

  const logos: { name: string; Icon: IconType }[] = [
    { name: "Semantic Scholar", Icon: LuGraduationCap },
    { name: "arXiv", Icon: LuBookOpen },
    { name: "USPTO & EPO", Icon: LuScale },
    { name: "SEC EDGAR", Icon: LuFileText },
    { name: "openFDA", Icon: LuHeartPulse },
    { name: "Google Drive", Icon: LuFolderGit2 },
    { name: "IEEE / ISO", Icon: LuRuler },
  ];

  const orbit: { Icon: IconType; label: string; pos: string; delay: string }[] = [
    { Icon: LuFolderGit2, label: "Internal", pos: "top-0 left-1/2 -translate-x-1/2", delay: "0s" },
    { Icon: LuScale, label: "Patents", pos: "bottom-0 left-1/2 -translate-x-1/2", delay: "1.5s" },
    { Icon: LuBookOpen, label: "Literature", pos: "left-0 top-1/2 -translate-y-1/2", delay: "0.8s" },
    { Icon: LuFileText, label: "Filings", pos: "right-0 top-1/2 -translate-y-1/2", delay: "2.2s" },
  ];

  return (
    <section className="relative bg-white pt-24 overflow-hidden">
      {/* Subtle brand aurora (fades indigo → teal behind content) */}
      <div className="aurora" />
      {/* Structural Grid Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="max-w-7xl mx-auto h-full border-x border-obs-border/50 relative">
          <div className="absolute top-0 left-0 w-full h-px bg-obs-border/30" />
          <div className="absolute top-100 left-0 w-full h-px bg-obs-border/30" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-10 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center py-20 md:py-32">

          {/* Left Content */}
          <div className="lg:col-span-7 flex flex-col items-start text-left stagger-children">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-obs-border bg-surface mb-8 animate-rise opacity-0">
              <span className="flex h-2 w-2 rounded-full bg-amber animate-pulse" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber">
                Design-partner preview - v1 now onboarding
              </span>
              <LuArrowUpRight className="text-[14px] text-text-muted" />
            </div>

            <h1 className="font-hero mb-8 text-text leading-[0.9] tracking-[-0.03em] animate-rise opacity-0 [animation-delay:80ms]">
              Where your research <br />
              <span className="text-amber italic">meets the outside world.</span>
            </h1>

            <p className="text-[18px] md:text-[20px] text-text-secondary leading-relaxed mb-12 max-w-xl animate-rise opacity-0 [animation-delay:160ms]">
              Meridian connects your internal R&amp;D corpus to the literature, patents, standards, and filings - and tells you what corroborates your work, what contradicts it, what might scoop it, and where the white space is.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-5 animate-rise opacity-0 [animation-delay:240ms]">
              <Button
                onClick={() => router.push("/dashboard")}
                size="lg"
                className="group px-10 h-14 text-sm font-bold uppercase tracking-[0.2em]"
              >
                Start a Scan
                <LuArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
              <a
                href="#process"
                className="text-[12px] font-mono font-bold text-text-muted hover:text-amber uppercase tracking-[0.2em] transition-colors border-b border-obs-border pb-1"
              >
                See the pipeline
              </a>
            </div>
          </div>

          {/* Right Visual (Cross-corpus KG) */}
          <div className="lg:col-span-5 relative animate-rise opacity-0 [animation-delay:320ms]">
             <div className="relative aspect-square max-w-[500px] mx-auto">
                {/* Central Node — solid indigo with teal status dot */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-3xl bg-amber text-white shadow-[0_12px_40px_-12px_rgba(28,12,158,0.55)] flex items-center justify-center z-10 animate-float ring-1 ring-amber-hover">
                   <div className="text-center">
                     <LuNetwork className="text-white text-4xl mb-1 mx-auto" />
                     <p className="text-[10px] font-mono font-bold text-white/80 uppercase tracking-widest">Cross-Corpus KG</p>
                   </div>
                   <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-cyan ring-2 ring-white animate-breathe" />
                </div>

                {/* Orbiting Corpus Nodes */}
                {orbit.map(({ Icon, label, pos, delay }, i) => (
                  <div key={i} className={`absolute ${pos} w-24 h-24 rounded-2xl bg-surface border border-obs-border shadow-sm flex flex-col items-center justify-center animate-float`} style={{ animationDelay: delay }}>
                    <Icon className="text-text-secondary text-xl mb-1" />
                    <span className="text-[9px] font-mono font-bold text-text-muted uppercase tracking-widest">{label}</span>
                  </div>
                ))}

                {/* Connecting Lines */}
                <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 500 500">
                  <path d="M250 250 L250 50" stroke="currentColor" strokeDasharray="4 4" className="text-obs-border" />
                  <path d="M250 250 L250 450" stroke="currentColor" strokeDasharray="4 4" className="text-obs-border" />
                  <path d="M250 250 L50 250" stroke="currentColor" strokeDasharray="4 4" className="text-obs-border" />
                  <path d="M250 250 L450 250" stroke="currentColor" strokeDasharray="4 4" className="text-obs-border" />
                </svg>
             </div>
          </div>
        </div>

        {/* Corpus Sources Ticker */}
        <div className="pt-12 pb-24 border-t border-obs-border">
          <p className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-[0.3em] mb-10 text-center opacity-60">Corpus sources indexed by Meridian</p>
          <div className="relative overflow-hidden group">
            <div className="flex animate-marquee gap-16 items-center whitespace-nowrap min-w-full">
              {[...logos, ...logos].map(({ name, Icon }, i) => (
                <div key={i} className="flex items-center gap-4 grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all cursor-default pr-20">
                  <Icon className="text-2xl" />
                  <span className="text-sm font-display font-medium text-text">{name}</span>
                </div>
              ))}
            </div>
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white via-white/50 to-transparent z-10" />
            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white via-white/50 to-transparent z-10" />
          </div>
        </div>
      </div>
    </section>
  );
}
