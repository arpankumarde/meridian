import { LuCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandingPricing() {
  const plans = [
    {
      name: "Researcher",
      price: "Free",
      description: "For individuals running localized literature scopes.",
      features: [
        "Up to 100 queries per month",
        "Public literature (arXiv, Semantic Scholar)",
        "Basic citation mapping",
        "Standard support"
      ],
      buttonText: "Start Free",
      buttonHref: "/signup",
      accent: "bg-surface border-obs-border",
      textAccent: "text-text",
      popular: false
    },
    {
      name: "Intelligence",
      price: "$99/mo",
      description: "For R&D teams matching internal data to the external world.",
      features: [
        "Unlimited queries",
        "Full patent + literature + filings access",
        "Google Drive corpus ingestion (up to 50GB)",
        "Cross-corpus corroboration graph",
        "Priority support"
      ],
      buttonText: "Launch Workspace",
      buttonHref: "/workspace",
      accent: "bg-amber-softer/50 border-amber/30 ring-2 ring-amber/10 shadow-[0_10px_40px_-10px_rgba(28,12,158,0.1)]",
      textAccent: "text-amber",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For organizations requiring private nodes and custom ingestion.",
      features: [
        "Unlimited private corpus ingestion",
        "On-prem VPC deployment options",
        "Custom data connectors (SharePoint, Azure)",
        "Dedicated implementation architect",
        "SLA & 24/7 dedicated support"
      ],
      buttonText: "Contact Sales",
      buttonHref: "#",
      accent: "bg-surface border-obs-border",
      textAccent: "text-text",
      popular: false
    }
  ];

  return (
    <section id="pricing" className="py-24 px-6 relative bg-white overflow-hidden border-t border-obs-border">
      {/* Background elements */}
      <div className="absolute top-0 right-0 -mr-40 w-[600px] h-[600px] bg-amber/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-40 w-[600px] h-[600px] bg-cyan/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto stagger-children">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-cyan mb-6 animate-rise opacity-0">
            Pricing
          </h4>
          <h2 className="font-section text-4xl mb-6 text-text animate-rise opacity-0 [animation-delay:80ms] tracking-tight">
            Transparent scaling for your research
          </h2>
          <p className="font-sub text-text-secondary animate-rise opacity-0 [animation-delay:160ms]">
            Start free with public literature. Upgrade to intelligence when you need to cross-reference your internal IP.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pt-4">
          {plans.map((plan, i) => (
            <div 
              key={plan.name}
              className={`relative flex flex-col p-8 rounded-2xl border ${plan.accent} animate-rise opacity-0 transition-all duration-300 hover:-translate-y-1 bg-white hover:border-amber/20 focus-within:ring-2 focus-within:ring-amber/20`}
              style={{ animationDelay: `${240 + i * 80}ms` }}
            >
              {plan.popular && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-amber text-white text-[10px] font-mono font-bold uppercase tracking-widest rounded-full shadow-md z-10 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Most Popular
                </div>
              )}
              
              <div className="mb-8 mt-2">
                <h3 className={`text-[11px] font-mono font-bold uppercase tracking-widest mb-4 ${plan.textAccent}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-section text-text tracking-tight">{plan.price}</span>
                </div>
                <p className="text-[14px] text-text-secondary min-h-[48px] leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="flex-grow">
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3 text-[13.5px] text-text-secondary">
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.popular ? 'bg-amber/10 text-amber' : 'bg-surface text-cyan border border-obs-border'}`}>
                        <LuCheck className="text-[11px] font-bold" />
                      </div>
                      <span className="leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button 
                asChild
                className={`w-full h-12 text-[11px] font-bold uppercase tracking-widest transition-all mt-auto ${
                  plan.popular 
                    ? "bg-amber hover:bg-amber-hover text-white shadow-md shadow-amber/20" 
                    : "bg-surface hover:bg-amber text-text hover:text-white border border-obs-border hover:border-amber shadow-none"
                }`}
              >
                <Link href={plan.buttonHref}>
                  {plan.buttonText}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
