"use client";

import { useState } from "react";
import { 
  LuLibrary, LuGlobe, LuDatabase, LuCircleCheck, 
  LuBookOpen, LuShieldCheck, LuFileJson, LuHardDrive,
  LuActivity, LuInfo,
  LuSettings2, LuLayoutGrid,LuX, LuRefreshCcw
} from "react-icons/lu";
import { RiSparkling2Fill } from "react-icons/ri";
import { FaGoogleDrive, FaAws, FaSlack, FaConfluence } from "react-icons/fa";
import { IoMdCloud } from "react-icons/io";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import NewCheckForm from "@/components/new-check-form";

interface Connector {
  id: string;
  name: string;
  category: "Intelligence" | "Internal";
  description: string;
  coverage: string;
  status: "Active" | "Authorized" | "Configurable" | "Coming Soon";
  url: string;
  color: string;
  icon?: any;
  image?: string;
}

const CONNECTORS: Connector[] = [
  {
    id: "semantic-scholar",
    name: "Semantic Scholar",
    category: "Intelligence",
    description: "AI-powered research tool with citation graphs and automated TLDR summaries.",
    coverage: "215M+ Papers",
    status: "Active",
    url: "https://www.semanticscholar.org/",
    color: "cyan",
    icon: LuBookOpen
  },
  {
    id: "arxiv",
    name: "arXiv",
    category: "Intelligence",
    description: "Open-access archive for 2.4 million scholarly articles in physics, AI, and CS.",
    coverage: "2.4M+ Preprints",
    status: "Active",
    url: "https://arxiv.org/",
    color: "amber",
    icon: LuLibrary
  },
  {
    id: "uspto",
    name: "USPTO PatentsView",
    category: "Intelligence",
    description: "Authoritative United States Patent and Trademark Office data for prior-art analysis.",
    coverage: "11M+ Patents",
    status: "Active",
    url: "https://patentsview.org/",
    color: "amber",
    icon: LuDatabase
  },
  {
    id: "sec-edgar",
    name: "SEC EDGAR",
    category: "Intelligence",
    description: "Comprehensive database of US public company filings (10-K, 10-Q, 8-K).",
    coverage: "Daily Filings",
    status: "Active",
    url: "https://www.sec.gov/edgar",
    color: "emerald",
    icon: LuShieldCheck
  },
  {
    id: "openfda",
    name: "openFDA",
    category: "Intelligence",
    description: "Direct access to drug, device, and food enforcement records from the FDA.",
    coverage: "Full Dataset",
    status: "Active",
    url: "https://open.fda.gov/",
    color: "rose",
    icon: LuActivity
  },
  {
    id: "google-search",
    name: "Web Intelligence",
    category: "Intelligence",
    description: "Live web indexing and real-time SERP data for general knowledge extraction.",
    coverage: "Global Web",
    status: "Active",
    url: "https://google.com",
    color: "violet",
    icon: LuGlobe
  },
  {
    id: "standards",
    name: "ISO / IEEE / NIST",
    category: "Intelligence",
    description: "Global engineering, safety, and technical standards for compliance auditing.",
    coverage: "Multi-Body",
    status: "Active",
    url: "https://iso.org",
    color: "cyan",
    icon: LuFileJson
  },
  {
    id: "gdrive",
    name: "Google Drive",
    category: "Internal",
    description: "Secure connector for synchronizing internal research documents and private corpus.",
    coverage: "Private Storage",
    status: "Authorized",
    url: "/workspace/connectors/gdrive",
    color: "emerald",
    icon: FaGoogleDrive
  },
  {
    id: "s3",
    name: "Amazon S3",
    category: "Internal",
    description: "Enterprise data lake integration for large-scale document analysis and vectorization.",
    coverage: "Object Store",
    status: "Configurable",
    url: "/workspace/connectors/s3",
    color: "amber",
    icon: FaAws
  },
  {
    id: "onedrive",
    name: "OneDrive Business",
    category: "Internal",
    description: "Connect Microsoft 365 file repositories for organization-wide document auditing.",
    coverage: "Enterprise Files",
    status: "Coming Soon",
    url: "#",
    color: "cyan",
    icon: IoMdCloud
  },
  {
    id: "sharepoint",
    name: "SharePoint Online",
    category: "Internal",
    description: "Synchronize organizational sites and document libraries for institutional audit.",
    coverage: "Intranet Docs",
    status: "Coming Soon",
    url: "#",
    color: "emerald",
    icon: LuLayoutGrid
  },
  {
    id: "confluence",
    name: "Atlassian Confluence",
    category: "Internal",
    description: "Index institutional knowledge bases, wiki pages, and team documentation hubs.",
    coverage: "Wiki Pages",
    status: "Coming Soon",
    url: "#",
    color: "violet",
    icon: FaConfluence
  },
  {
    id: "slack",
    name: "Slack Archive",
    category: "Internal",
    description: "Search across communication threads and shared files for investigative research.",
    coverage: "Global Chats",
    status: "Coming Soon",
    url: "#",
    color: "rose",
    icon: FaSlack
  }
];

export default function ConnectorsPage() {
  const [activeTab, setActiveTab] = useState<"Intelligence" | "Internal">("Intelligence");
  const [showNewCheck, setShowNewCheck] = useState(false);
  const [configuringConnector, setConfiguringConnector] = useState<Connector | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredConnectors = CONNECTORS.filter(c => c.category === activeTab);

  const handleSaveConfig = () => {
    setIsSaving(true);
    // Simulate API call
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setConfiguringConnector(null);
      }, 1500);
    }, 1000);
  };

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        {/* Header section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-amber font-mono text-[10px] font-bold uppercase tracking-[0.3em] mb-3">
              <RiSparkling2Fill className="text-sm" />
              Active Mesh
            </div>
            <h2 className="text-4xl font-display font-semibold mb-3 tracking-tight text-text">Intelligence Connectors</h2>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xl">
              Configure unified access to global research databases and your organization&apos;s internal document corpus.
            </p>
          </div>
        </div>

        {/* Custom Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-surface border border-obs-border rounded-2xl w-fit mb-12">
          <button
            onClick={() => setActiveTab("Intelligence")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "Intelligence" 
                ? "bg-white text-text shadow-sm ring-1 ring-slate-200" 
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <LuGlobe className={activeTab === "Intelligence" ? "text-amber" : ""} />
            Intelligence Mesh
          </button>
          <button
            onClick={() => setActiveTab("Internal")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold transition-all ${
              activeTab === "Internal" 
                ? "bg-white text-text shadow-sm ring-1 ring-slate-200" 
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            <LuHardDrive className={activeTab === "Internal" ? "text-emerald" : ""} />
            Internal Corpus
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConnectors.map((connector) => {
            const Icon = connector.icon;
            const colorClass = 
              connector.color === "cyan" ? "text-cyan bg-cyan-soft border-cyan/10" :
              connector.color === "amber" ? "text-amber bg-amber-soft border-amber/10" :
              connector.color === "emerald" ? "text-emerald bg-emerald-soft border-emerald/10" :
              connector.color === "rose" ? "text-rose bg-rose-soft border-rose/10" :
              "text-violet bg-violet-soft border-violet/10";

            return (
              <div 
                key={connector.id} 
                className={`group relative flex flex-col p-7 bg-white border border-obs-border rounded-2xl hover:border-amber/30 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] cursor-default overflow-hidden ${
                  connector.status === "Coming Soon" ? "opacity-60 grayscale-[0.8]" : ""
                }`}
              >
                {/* Top Row: Icon and Status */}
                <div className="flex justify-between items-start mb-6">
                  {connector.image ? (
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-transform group-hover:scale-110 duration-500">
                      <img src={connector.image} alt={connector.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-110 duration-500 ${colorClass}`}>
                      <Icon className="text-2xl" />
                    </div>
                  )}
                  <div className="flex flex-col items-end gap-1.5">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                      connector.status === "Active" || connector.status === "Authorized" 
                        ? "bg-emerald/10 text-emerald" 
                        : connector.status === "Coming Soon" 
                        ? "bg-slate-100 text-slate-400" 
                        : "bg-amber/10 text-amber"
                    }`}>
                      {(connector.status === "Active" || connector.status === "Authorized") && (
                        <span className="w-1 h-1 rounded-full bg-emerald animate-pulse" />
                      )}
                      {connector.status}
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="mb-8">
                  <h4 className="text-[17px] font-semibold text-text mb-2 transition-colors flex items-center justify-between">
                    {connector.name}
                  </h4>
                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-3 font-medium">
                    {connector.description}
                  </p>
                </div>

                {/* Footer Actions / Stats */}
                <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted/70">Index Coverage</p>
                    <p className="text-[13px] font-mono font-bold text-text">{connector.coverage}</p>
                  </div>
                  {(connector.category === "Internal" && connector.status !== "Coming Soon") ? (
                    <Button 
                      onClick={() => setConfiguringConnector(connector)}
                      variant="outline" 
                      size="sm" 
                      className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest gap-2 bg-surface hover:bg-white transition-all"
                    >
                      <LuSettings2 className="text-sm" />
                      Configure
                    </Button>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 opacity-60">
                       <LuInfo className="text-xs text-text-muted" />
                    </div>
                  )}
                </div>
                
                {/* Interactive Decoration */}
                <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-gradient-to-br from-transparent to-slate-50/50 rounded-full blur-2xl group-hover:to-amber/10 transition-colors duration-700" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Configuration Modal */}
      {configuringConnector && (
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-[540px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 transform transition-all animate-scale-up">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white shadow-sm">
                  {configuringConnector.image ? (
                    <img src={configuringConnector.image} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <LuSettings2 className="text-slate-400" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text">Configure {configuringConnector.name}</h3>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Connection Setup</p>
                </div>
              </div>
              <button 
                onClick={() => setConfiguringConnector(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-text-muted transition-colors"
              >
                <LuX className="text-lg" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              {configuringConnector.id === "s3" ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">AWS Access Key ID</Label>
                    <Input placeholder="AKIA..." className="obs-input h-11 font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">AWS Secret Access Key</Label>
                    <Input type="password" placeholder="••••••••••••••••" className="obs-input h-11 font-mono text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">S3 Bucket Name</Label>
                    <Input placeholder="my-research-data" className="obs-input h-11 font-mono text-sm" />
                  </div>
                </div>
              ) : configuringConnector.id === "gdrive" ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-[11px] font-bold uppercase tracking-wider text-text-muted px-1">Service Account Key (JSON)</Label>
                    <Textarea 
                      placeholder='{ "type": "service_account", ... }' 
                      className="obs-input min-h-[200px] font-mono text-xs leading-relaxed"
                    />
                    <p className="text-[10px] text-text-muted/70 px-1 mt-2">Paste the content of your Google Cloud service account key file.</p>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                      <LuSettings2 className="text-2xl text-text-muted/40" />
                   </div>
                   <h4 className="font-bold text-text">Configuration Pathway Locked</h4>
                   <p className="text-sm text-text-muted max-w-[280px] mt-2">
                     Direct API integration for {configuringConnector.name} is currently in closed preview.
                   </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50 flex justify-end gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setConfiguringConnector(null)}
                className="text-[11px] font-bold uppercase tracking-widest px-6"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveConfig}
                disabled={isSaving || showSuccess}
                className={`min-w-[160px] text-[11px] font-bold uppercase tracking-widest px-6 transition-all ${
                  showSuccess ? "bg-emerald hover:bg-emerald !opacity-100" : ""
                }`}
              >
                {isSaving ? (
                  <>
                    <LuRefreshCcw className="animate-spin text-sm mr-2" />
                    Saving...
                  </>
                ) : showSuccess ? (
                  <>
                    <LuCircleCheck className="text-sm mr-2" />
                    Configured
                  </>
                ) : (
                  "Save Configuration"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Check Modal */}
      {showNewCheck && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4 md:p-12">
            <div className="w-full max-w-[640px] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl bg-white overflow-hidden">
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
