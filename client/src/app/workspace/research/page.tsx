"use client";

import { useState } from "react";
import { LuSearch, LuFilter, LuPlus, LuFileText } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NewCheckForm from "@/components/new-check-form";

export default function ResearchPage() {
  const [showNewCheck, setShowNewCheck] = useState(false);
  
  const papers = [
    { id: 1, title: "Quantum Supremacy in Circuit Sampling", author: "Dr. Arpan Kumar", date: "2024-03-12", status: "Analyzed" },
    { id: 2, title: "Neural Architecture Search with Reinforcement Learning", author: "Sarah Chen", date: "2024-03-10", status: "Processing" },
    { id: 3, title: "The Impact of Large Language Models on R&D Efficiency", author: "James Miller", date: "2024-03-05", status: "Prior Art Found" },
  ];

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h2 className="text-3xl font-display font-semibold mb-2">Research Library</h2>
            <p className="text-text-secondary text-sm">Manage and analyze your research repository.</p>
          </div>
          <Button 
            onClick={() => setShowNewCheck(true)}
            className="px-5 text-[12px] font-bold uppercase tracking-wider gap-2 shadow-lg shadow-amber/10"
          >
            <LuPlus />
            New Scan
          </Button>
        </div>

        <div className="flex gap-4 mb-8">
          <div className="relative flex-1">
            <LuSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search within your library..." className="pl-11 h-12 obs-input" />
          </div>
          <Button variant="outline" className="h-12 border-obs-border gap-2">
            <LuFilter />
            Filters
          </Button>
        </div>

        <div className="bg-white border border-obs-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface border-b border-obs-border">
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Document Name</th>
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Lead Author</th>
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Added Date</th>
                <th className="px-6 py-4 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-obs-border">
              {papers.map((paper) => (
                <tr key={paper.id} className="hover:bg-surface/50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <LuFileText className="text-amber text-lg" />
                      <span className="text-sm font-semibold text-text group-hover:text-amber transition-colors">{paper.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">{paper.author}</td>
                  <td className="px-6 py-4 text-sm text-text-secondary">{paper.date}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded-full bg-emerald/10 text-emerald text-[10px] font-bold uppercase tracking-wider">
                      {paper.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Check Modal */}
      {showNewCheck && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4 md:p-12">
            <div className="w-full max-w-[640px] animate-scale-up shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl bg-white overflow-hidden">
              <NewCheckForm
                onClose={() => setShowNewCheck(false)}
                onSuccess={() => {
                  setShowNewCheck(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
