import { LuLibrary, LuGlobe, LuDatabase, LuSearch, LuCircleCheck } from "react-icons/lu";
import { Input } from "@/components/ui/input";

export default function SourcesPage() {
  const sources = [
    { name: "ArXiv", type: "Preprints", items: "2.3M+", connectivity: "Full" },
    { name: "USPTO", type: "Patents", items: "11M+", connectivity: "API" },
    { name: "PubMed", type: "Medical", items: "35M+", connectivity: "Full" },
    { name: "IEEE Xplore", type: "Engineering", items: "5M+", connectivity: "Partial" },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">Knowledge Sources</h2>
        <p className="text-text-secondary text-sm">Global literature and data repositories connected to Meridian.</p>
      </div>

      <div className="relative mb-12">
        <LuSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input placeholder="Search for specific journal or patent office..." className="pl-11 h-12 obs-input" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sources.map((source) => (
          <div key={source.name} className="p-6 bg-white border border-obs-border rounded-xl hover:border-amber transition-all shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                  {source.name === "USPTO" ? <LuDatabase className="text-amber" /> : <LuGlobe className="text-cyan" />}
                </div>
                <div>
                  <h4 className="text-[17px] font-semibold text-text">{source.name}</h4>
                  <p className="text-xs text-text-secondary">{source.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald/10 text-emerald text-[10px] font-bold uppercase tracking-widest">
                <LuCircleCheck /> Connected
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-obs-border/50 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">
              <div>
                <p className="text-[9px] opacity-60 mb-1">Indexed Items</p>
                <p className="text-text">{source.items}</p>
              </div>
              <div>
                <p className="text-[9px] opacity-60 mb-1">Integration</p>
                <p className="text-text">{source.connectivity}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
