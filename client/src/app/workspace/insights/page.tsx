import { LuTrendingUp, LuChartBarBig, LuChartPie, LuTriangleAlert } from "react-icons/lu";

export default function InsightsPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">Research Insights</h2>
        <p className="text-text-secondary text-sm">Automated analysis of your research landscape.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-emerald">
            <LuTrendingUp className="text-xl" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Growth Rate</span>
          </div>
          <p className="text-3xl font-display font-bold text-text mb-1">+24%</p>
          <p className="text-xs text-text-secondary">Increase in relevant patents this quarter</p>
        </div>
        <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-amber">
            <LuTriangleAlert className="text-xl" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Risk Factor</span>
          </div>
          <p className="text-3xl font-display font-bold text-text mb-1">Low</p>
          <p className="text-xs text-text-secondary">Freedom to operate analysis completed</p>
        </div>
        <div className="p-6 bg-white border border-obs-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-cyan">
            <LuChartPie className="text-xl" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">Domain Coverage</span>
          </div>
          <p className="text-3xl font-display font-bold text-text mb-1">82%</p>
          <p className="text-xs text-text-secondary">Capture of core technological white-space</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <h3 className="text-lg font-display font-semibold text-text flex items-center gap-2">
            <LuChartBarBig className="text-amber" />
            Citation Network Development
          </h3>
          <div className="h-64 bg-surface rounded-xl border border-dashed border-obs-border flex items-center justify-center relative overflow-hidden">
             <div className="aurora opacity-10" />
             <p className="text-sm font-mono text-text-muted">Relational graph visualizing (placeholder)</p>
          </div>
        </div>
        <div className="space-y-6">
          <h3 className="text-lg font-display font-semibold text-text flex items-center gap-2">
            <LuTrendingUp className="text-cyan" />
            Technology Lifecycle Positioning
          </h3>
          <div className="h-64 bg-surface rounded-xl border border-dashed border-obs-border flex items-center justify-center relative overflow-hidden">
             <div className="aurora opacity-10" />
             <p className="text-sm font-mono text-text-muted">Trend visualization (placeholder)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
