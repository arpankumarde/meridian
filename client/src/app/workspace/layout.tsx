"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuLayoutDashboard,
  LuMicroscope,
  LuTrendingUp,
  LuLibrary,
  LuUsers,
  LuCreditCard,
  LuSettings,
  LuLogOut,
  LuSlidersHorizontal
} from "react-icons/lu";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const primaryNav = [
    { name: "Dashboard", href: "/workspace", icon: LuLayoutDashboard },
    { name: "Research", href: "/workspace/research", icon: LuMicroscope },
    { name: "Insights", href: "/workspace/insights", icon: LuTrendingUp },
    { name: "Connectors", href: "/workspace/connectors", icon: LuLibrary },
  ];

  const secondaryNav = [
    { name: "Team", href: "/workspace/team", icon: LuUsers },
    { name: "Configuration", href: "/workspace/configuration", icon: LuSlidersHorizontal },
    { name: "Billing", href: "/workspace/billing", icon: LuCreditCard },
    { name: "Settings", href: "/workspace/settings", icon: LuSettings },
  ];

  return (
    <div className="flex h-screen bg-white text-text font-sans overflow-hidden font-sans cursor-default selection:bg-amber-soft">
      {/* Sidebar */}
      <aside className="w-[280px] bg-[#f8fbff] border-r border-slate-200/80 flex flex-col shrink-0 relative overflow-hidden transition-all duration-300">
        {/* Subtle Decorative Atmosphere */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute -top-[20%] -left-[20%] w-[140%] h-[140%] aurora" />
        </div>
        
        {/* Logo Section */}
        <div className="p-7 pb-5 relative z-10">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex bg-white p-2 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/60 transition-transform group-hover:scale-105 active:scale-95">
              <img src="/brand/logo.png" alt="Meridian" className="h-5 w-auto" />
            </div>
            <div>
              <h1 className="text-[17px] font-display font-bold tracking-tight text-text">Meridian</h1>
              <p className="text-[9px] text-text-muted font-mono uppercase tracking-[0.25em] leading-none mt-1 font-bold">Workspace</p>
            </div>
          </Link>
        </div>

        <div className="px-5 flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-7 relative z-10 pt-2 scrollbar-hide">
          {/* Core Workspace */}
          <div>
            <p className="px-4 text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-text-muted mb-3">Core</p>
            <nav className="space-y-1">
              {primaryNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all group ${
                      isActive
                        ? "bg-white text-text shadow-[0_4px_12px_rgba(0,0,0,0.05),0_0_1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200"
                        : "text-text-secondary hover:text-text hover:bg-slate-200/40 active:scale-[0.98]"
                    }`}
                  >
                    <item.icon className={`text-[18px] transition-all duration-300 ${isActive ? "text-amber scale-110" : "text-text-muted group-hover:text-text-secondary"}`} />
                    {item.name}
                    {isActive && (
                      <div className="ml-auto flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber shadow-[0_0_8px_rgba(28,12,158,0.4)]" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Management */}
          <div>
            <p className="px-4 text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-text-muted mb-3">Management</p>
            <nav className="space-y-1">
              {secondaryNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all group ${
                      isActive
                        ? "bg-white text-text shadow-[0_4px_12px_rgba(0,0,0,0.05),0_0_1px_rgba(0,0,0,0.1)] ring-1 ring-slate-200"
                        : "text-text-secondary hover:text-text hover:bg-slate-200/40 active:scale-[0.98]"
                    }`}
                  >
                    <item.icon className={`text-[18px] transition-all duration-300 ${isActive ? "text-cyan scale-110" : "text-text-muted group-hover:text-text-secondary"}`} />
                    {item.name}
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan shadow-[0_0_8px_rgba(15,151,170,0.4)]" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Area */}
        <div className="p-5 border-t border-slate-200/60 relative z-10 bg-white/40 backdrop-blur-md">
          <Link
            href="/login"
            className="group flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold text-text-secondary hover:text-rose hover:bg-rose/5 transition-all active:scale-[0.98]"
          >
            <LuLogOut className="text-[18px] text-text-muted group-hover:text-rose transition-colors" />
            Sign Out
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-white relative">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:32px_32px] opacity-25 pointer-events-none" />
        <div className="relative z-10 min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
