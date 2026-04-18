import Link from "next/link";
import { LuCopyright } from "react-icons/lu";
import { FaGithub, FaLinkedin } from "react-icons/fa";

export default function LandingFooter() {
  return (
    <footer className="px-6 py-20 bg-white border-t border-obs-border">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <img src="/brand/logo.png" alt="Meridian" className="h-8 w-auto" />
            <h1 className="text-xl font-display font-semibold tracking-tight text-text uppercase">
              Meridian
            </h1>
          </div>
          <p className="text-sm text-text-secondary max-w-sm mb-8 leading-relaxed">
            Enterprise R&amp;D intelligence - a hierarchical multi-agent
            research system that links your internal corpus to the external
            world of papers, patents, standards, and regulatory filings.
          </p>
          <div className="flex items-center gap-4">
            <Link
              target="_blank"
              href="https://github.com/arpankumarde/meridian"
              className="size-10 border flex items-center justify-center hover:bg-surface transition-colors"
            >
              <FaGithub className="text-lg" />
            </Link>
            <Link
              href="https://www.linkedin.com/in/arpankumarde"
              className="size-10 border flex items-center justify-center hover:bg-surface transition-colors"
            >
              <FaLinkedin className="text-lg" />
            </Link>
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber mb-6">
            Platform
          </h4>
          <ul className="space-y-4 text-[13px] text-text-secondary">
            <li>
              <Link href="#" className="hover:text-amber transition-colors">
                Landscape scan
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-amber transition-colors">
                Prior-art search
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-amber transition-colors">
                Cross-corpus knowledge graph
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-amber transition-colors">
                Google Drive connector
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-amber mb-6">
            Company
          </h4>
          <ul className="space-y-4 text-[13px] text-text-secondary">
            <li>
              <a href="#" className="hover:text-amber transition-colors">
                Design-partner program
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-amber transition-colors">
                Security &amp; data handling
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-amber transition-colors">
                Roadmap
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-amber transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-20 pt-8 border-t border-obs-border flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-sm font-mono text-text-muted inline-flex gap-2 items-center">
          <LuCopyright /> {new Date().getFullYear()} MERIDIAN RESEARCH
          INTELLIGENCE. | INGENICO
        </p>
        <div className="flex items-center gap-6">
          <p className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
            Status: <span className="text-emerald font-bold">Operational</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
