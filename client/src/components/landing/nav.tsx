import Link from "next/link";
import { LuArrowRight } from "react-icons/lu";
import { Button } from "../ui/button";

export default function LandingNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-obs-border">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <img src="/brand/logo.png" alt="Meridian" className="h-9 w-auto" />
          <div>
            <h1 className="text-lg font-display font-semibold tracking-tight text-text">
              Meridian
            </h1>
            <p className="text-[10px] text-text-secondary font-mono uppercase tracking-[0.2em] leading-none">
              Enterprise R&amp;D Intelligence
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-8">
          <div className="hidden md:flex items-center gap-8 text-[13px] font-medium text-text-secondary uppercase tracking-wider">
            <Link
              href="#process"
              className="hover:text-amber transition-colors"
            >
              How it works
            </Link>
            <Link
              href="#features"
              className="hover:text-amber transition-colors"
            >
              Architecture
            </Link>
            <Link
              href="#pricing"
              className="hover:text-amber transition-colors"
            >
              Pricing
            </Link>
          </div>

          <Button
            asChild
            className="rounded-lg px-6 py-2 text-[13px] tracking-wide bg-amber hover:bg-amber-hover shadow-none"
          >
            <Link href="/workspace">
              Workspace <LuArrowRight className="text-sm" />
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
