import { LuSettings, LuBell, LuUser, LuLock, LuCode, LuArrowRight } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">Workspace Settings</h2>
        <p className="text-text-secondary text-sm">Configure your personal and organization preferences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
        <aside className="space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-amber/10 text-amber ring-1 ring-amber/20">
            <LuUser /> Profile Info
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:text-text hover:bg-surface">
            <LuBell /> Notifications
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:text-text hover:bg-surface">
            <LuLock /> Privacy & Security
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-text-secondary hover:text-text hover:bg-surface">
            <LuCode /> API Integration
          </button>
        </aside>

        <section className="md:col-span-3 space-y-12">
           <div className="max-w-2xl">
             <h3 className="text-lg font-display font-semibold text-text mb-6 pb-2 border-b border-obs-border">Personal Information</h3>
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">First Name</p>
                      <Input placeholder="Arpan" className="obs-input" />
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">Last Name</p>
                      <Input placeholder="Kumar" className="obs-input" />
                   </div>
                </div>
                <div className="space-y-2">
                   <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">Public Display Name</p>
                   <Input placeholder="Arpan Kumar" className="obs-input" />
                </div>
                <div className="space-y-2 text-right pt-4">
                  <Button className="bg-amber hover:bg-amber-hover text-white px-8 font-bold text-[13px] uppercase tracking-widest">Update Profile</Button>
                </div>
             </div>
           </div>

           <div className="max-w-2xl p-6 bg-amber/5 border border-amber/20 rounded-xl relative overflow-hidden">
             <div className="flex gap-4">
               <div className="w-10 h-10 rounded-lg bg-amber flex items-center justify-center shrink-0">
                 <LuCode className="text-white text-xl" />
               </div>
               <div>
                  <h4 className="text-sm font-bold text-text mb-1 uppercase tracking-tight">Meridian API Access</h4>
                  <p className="text-xs text-text-secondary leading-relaxed mb-4">
                    Bridge your local research server with Meridian's cloud-based intelligence engine using our enterprise API.
                  </p>
                  <Button variant="ghost" className="text-amber text-[11px] font-bold uppercase tracking-widest hover:bg-amber/10 gap-2 p-0 h-auto">
                    View API Keys <LuArrowRight />
                  </Button>
               </div>
             </div>
           </div>
        </section>
      </div>
    </div>
  );
}
