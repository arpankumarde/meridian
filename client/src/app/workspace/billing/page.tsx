import { LuCreditCard, LuZap, LuCheck, LuArrowRight } from "react-icons/lu";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">Billing & Subscription</h2>
        <p className="text-text-secondary text-sm">Manage your enterprise plan and usage limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="md:col-span-2 p-8 bg-white border border-obs-border rounded-2xl shadow-sm relative overflow-hidden">
          <div className="aurora opacity-10" />
          <div className="flex justify-between items-start mb-10 relative z-10">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber mb-2">Current Plan</p>
              <h3 className="text-2xl font-display font-bold text-text">Enterprise Pro</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted mb-2">Renewal Date</p>
              <p className="text-sm font-semibold text-text">Oct 24, 2024</p>
            </div>
          </div>

          <div className="space-y-6 relative z-10 mb-10">
            <div>
               <div className="flex justify-between items-end mb-2">
                 <p className="text-xs font-semibold text-text">Token Usage (Intelligence Scans)</p>
                 <p className="text-xs font-mono text-text-secondary">4,231 / 10,000</p>
               </div>
               <div className="h-2 bg-surface rounded-full overflow-hidden border border-obs-border">
                  <div className="h-full bg-amber w-[42%] transition-all duration-1000" />
               </div>
            </div>
            <div>
               <div className="flex justify-between items-end mb-2">
                 <p className="text-xs font-semibold text-text">Prior-Art Searches</p>
                 <p className="text-xs font-mono text-text-secondary">15 / 50</p>
               </div>
               <div className="h-2 bg-surface rounded-full overflow-hidden border border-obs-border">
                  <div className="h-full bg-cyan w-[30%] transition-all duration-1000" />
               </div>
            </div>
          </div>

          <Button className="w-full h-12 gap-2 text-[13px] font-bold uppercase tracking-widest relative z-10 group bg-text hover:bg-black text-white">
            Upgrade Subscription
            <LuArrowRight className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="p-8 bg-surface border border-obs-border rounded-2xl flex flex-col justify-between">
           <div>
             <LuCreditCard className="text-3xl text-text-muted mb-6" />
             <h4 className="text-lg font-display font-semibold mb-4 tracking-tight">Payment Method</h4>
             <div className="flex items-center gap-3 p-4 bg-white border border-obs-border rounded-xl mb-4 shadow-sm">
                <div className="w-10 h-6 bg-text rounded flex items-center justify-center text-[10px] text-white font-bold italic tracking-tighter uppercase">VISA</div>
                <div className="text-xs">
                   <p className="font-semibold text-text">•••• •••• •••• 4242</p>
                   <p className="text-text-muted">Expires 12/26</p>
                </div>
             </div>
           </div>
           <Button variant="outline" className="w-full border-obs-border text-[11px] font-bold uppercase tracking-widest text-text-secondary">Manage Methods</Button>
        </div>
      </div>
    </div>
  );
}
