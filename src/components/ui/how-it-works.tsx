import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Network, 
  Bot, 
  ShieldCheck, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  Sliders, 
  Lock 
} from "lucide-react";

interface WorkflowStep {
  id: string;
  stepNumber: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  agentRole: "Buyer Agent" | "FalkorDB Graph" | "Seller Agent" | "Human Safeguard" | "Fulfilment";
  technicalHighlight: string;
  mockUI: {
    title: string;
    badgeText: string;
    details: { label: string; value: string }[];
    simulationSnippet?: { sender: string; text: string; time: string }[];
  };
}

const workflowSteps: WorkflowStep[] = [
  {
    id: "step-1",
    stepNumber: "01",
    badge: "Requirement Ingestion",
    title: "Natural Language to Structured RFQ",
    subtitle: "Conversational procurement without tedious spec sheets",
    description:
      "A procurement manager or CEO specifies their purchase in plain English. The Buyer Agent converts ambiguous demands into rigorous technical parameters, delivery constraints, and budget brackets.",
    icon: Sparkles,
    agentRole: "Buyer Agent",
    technicalHighlight: "Gemini 1.5 Flash structured JSON schema extraction & constraint validation",
    mockUI: {
      title: "Extracted Procurement Intent",
      badgeText: "Structured RFQ #B2B-8941",
      details: [
        { label: "Original Input", value: "“Need 100 ergonomic school desks, delivered in 7 days to Boston.”" },
        { label: "Item Category", value: "Commercial Grade Educational Furniture" },
        { label: "Quantity & Lead Time", value: "100 Units · Max 7 Days (Due Oct 19)" },
        { label: "Target Price Range", value: "$120 – $155 / unit (Max Budget $16,000)" },
        { label: "Material Standard", value: "FSC Certified Birch, Antimicrobial Top" }
      ]
    }
  },
  {
    id: "step-2",
    stepNumber: "02",
    badge: "Contextual Discovery",
    title: "Graph Traversal & Historical Match Ranking",
    subtitle: "FalkorDB relationship intelligence meets Supabase catalog data",
    description:
      "Rather than raw keyword matching, the platform traverses the FalkorDB knowledge graph. It evaluates supplier reliability scores, past volume discounts, geographic reach, and product substitutions.",
    icon: Network,
    agentRole: "FalkorDB Graph",
    technicalHighlight: "Cypher graph queries across supplier relationships, prior quotations & stock",
    mockUI: {
      title: "FalkorDB Relationship Query Results",
      badgeText: "3 Ranked Suppliers Identified",
      details: [
        { label: "Top Match", value: "Apex Nordic Furnishings (98.4% Confidence)" },
        { label: "Graph Relation", value: "HAS_TRANSACTION_HISTORY · 0% Defect Rate" },
        { label: "Historical Index", value: "Avg previous order: $132/unit at 100+ volume" },
        { label: "Alternative Match", value: "Vertex Woodcraft (88% Match · Requires 9-day lead)" },
        { label: "Operational State", value: "Verified in Supabase Catalog with 240 in stock" }
      ]
    }
  },
  {
    id: "step-3",
    stepNumber: "03",
    badge: "Autonomous Negotiation",
    title: "Agent-to-Agent Protocol & Policy Safeguards",
    subtitle: "AI delegates negotiate terms inside strictly bounded human limits",
    description:
      "The Buyer Agent contacts authorized Seller Agents via secure platform protocols. The Seller Agent verifies live inventory and minimum margin rules, trading off lead times, volume tiers, and freight charges.",
    icon: Bot,
    agentRole: "Seller Agent",
    technicalHighlight: "Bi-directional constrained negotiation with zero cross-tenant leakages",
    mockUI: {
      title: "Agent-to-Agent Negotiation Transcript",
      badgeText: "Audit Log Active",
      details: [
        { label: "Round 1", value: "Seller Agent quotes $148/unit + expedited freight ($1,200)" },
        { label: "Round 2", value: "Buyer Agent counters: $135/unit based on 100-batch history" },
        { label: "Final Consensus", value: "$138/unit with free 5-day insured shipping included" },
        { label: "Total Quoted", value: "$13,800 USD (Saved $2,200 under initial ceiling)" }
      ],
      simulationSnippet: [
        { sender: "BuyerAgent_v1", text: "Proposing $135/unit for 100 desks. Target delivery Oct 18.", time: "10:41:02" },
        { sender: "SellerAgent_Apex", text: "Approved at $138/unit including 5-day expedited freight.", time: "10:41:04" }
      ]
    }
  },
  {
    id: "step-4",
    stepNumber: "04",
    badge: "Human Authorization",
    title: "Explicit Human Review & PayPal Settlement",
    subtitle: "AI never commits funds without user verification and signed webhooks",
    description:
      "Once agreed, a binding formal quotation is generated. Both buyer and seller human supervisors must manually sign off. Checkout redirects to secure PayPal payment with signed server webhook validation.",
    icon: ShieldCheck,
    agentRole: "Human Safeguard",
    technicalHighlight: "Server-side PayPal Order v2 API + Idempotent Webhook Verification",
    mockUI: {
      title: "Formal Quotation & Checkout Authorization",
      badgeText: "Awaiting Human Signature",
      details: [
        { label: "Quotation ID", value: "QUOTE-2026-APEX-094" },
        { label: "Authorized Total", value: "$13,800.00 USD (Includes Tax & Freight)" },
        { label: "Payment Gateway", value: "PayPal B2B Secure Vault / Checkout" },
        { label: "Safety State", value: "Supabase RLS locked · Buyer 2FA Approval Required" },
        { label: "Execution Hook", value: "Payment Webhook triggers immutable Order creation" }
      ]
    }
  },
  {
    id: "step-5",
    stepNumber: "05",
    badge: "Fulfillment & Tracking",
    title: "Telemetry, Tracking & Post-Trade Graph Sync",
    subtitle: "Realtime milestone telemetry synchronizing back into FalkorDB",
    description:
      "Seller agent updates dispatch, tracking numbers, and freight checkpoints. Upon successful delivery, the transaction is indexed back into FalkorDB to sharpen future ranking, discounts, and reliability scores.",
    icon: Truck,
    agentRole: "Fulfilment",
    technicalHighlight: "Supabase Realtime channels + Graph node & edge generation",
    mockUI: {
      title: "Order Fulfilment & Knowledge Graph Update",
      badgeText: "Order #ORD-7729 In Transit",
      details: [
        { label: "Current Status", value: "Dispatched via Freight Express (Tracking #FX-88419)" },
        { label: "Estimated Delivery", value: "Thursday, Oct 17 · 2 Days Ahead of SLA" },
        { label: "Graph Update", value: "Created edge: Apex -[SUPPLIED {units: 100}]-> BuyerCorp" },
        { label: "Reliability Delta", value: "+0.2% Supplier Score improvement registered" }
      ]
    }
  }
];

export const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState<string>("step-1");
  const activeStep = workflowSteps.find((s) => s.id === activeTab) || workflowSteps[0];

  return (
    <section id="how-it-works" className="relative w-full bg-white dark:bg-black py-24 sm:py-32 px-4 sm:px-6 md:px-10 overflow-hidden text-slate-900 dark:text-[#E1E0CC] border-t border-slate-200 dark:border-white/10">
      {/* Background ambient lighting matching aesthetics */}
      <div className="pointer-events-none absolute inset-0">
        <div 
          className="absolute -top-32 left-1/2 -translate-x-1/2 h-[500px] w-[700px] rounded-full opacity-[0.06] dark:opacity-[0.07] blur-[140px] bg-blue-500 dark:bg-[#E1E0CC]"
        />
        <div className="noise-overlay absolute inset-0 opacity-[0.2] dark:opacity-[0.4] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="flex flex-col items-start gap-4 mb-16 md:mb-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-[#E1E0CC]/20 bg-blue-50 dark:bg-white/[0.03] px-3.5 py-1 text-xs font-mono tracking-widest uppercase text-blue-700 dark:text-[#E1E0CC]/80 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-[#E1E0CC] animate-pulse" />
            02 / Architecture & Workflow
          </div>

          <div className="grid grid-cols-12 gap-6 w-full items-end">
            <div className="col-span-12 lg:col-span-8">
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-medium tracking-[-0.03em] leading-[1.05] text-slate-900 dark:text-[#E1E0CC]">
                How Agentic B2B Commerce Works.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <p className="text-sm sm:text-base text-slate-600 dark:text-[#E1E0CC]/60 leading-relaxed">
                From a single natural language prompt to autonomous multi-agent negotiations, verified graph context, and human-authorized PayPal checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Step Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-10">
          {workflowSteps.map((step) => {
            const Icon = step.icon;
            const isActive = activeTab === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={`group relative flex flex-col items-start text-left p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 cursor-pointer ${
                  isActive
                    ? "border-blue-500 bg-blue-50/80 dark:border-[#E1E0CC] dark:bg-[#E1E0CC]/[0.08] shadow-md shadow-blue-500/10 dark:shadow-[0_0_30px_-5px_rgba(225,224,204,0.15)]"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-[#E1E0CC]/40 dark:hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <span className={`text-xs font-mono font-semibold transition-colors ${isActive ? "text-blue-600 dark:text-[#E1E0CC]" : "text-slate-400 dark:text-[#E1E0CC]/40 group-hover:text-slate-600 dark:group-hover:text-[#E1E0CC]/70"}`}>
                    {step.stepNumber}
                  </span>
                  <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-blue-600 text-white dark:bg-[#E1E0CC] dark:text-black" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-[#E1E0CC]/60 group-hover:text-blue-600 dark:group-hover:text-[#E1E0CC]"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-[#E1E0CC]/50 mb-1">
                  {step.badge}
                </span>
                <span className={`text-sm font-medium transition-colors line-clamp-1 ${isActive ? "text-blue-900 dark:text-[#E1E0CC] font-semibold" : "text-slate-700 dark:text-[#E1E0CC]/80"}`}>
                  {step.title}
                </span>

                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-x-0 -bottom-[1px] h-[2px] bg-blue-600 dark:bg-[#E1E0CC]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Step Showcase Card */}
        <div className="relative rounded-2xl md:rounded-[2rem] border border-slate-200 dark:border-[#E1E0CC]/20 bg-slate-50/70 dark:bg-gradient-to-b dark:from-white/[0.04] dark:to-black/80 backdrop-blur-xl overflow-hidden p-6 sm:p-10 md:p-12 shadow-xl dark:shadow-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-12 gap-8 lg:gap-12 items-center"
            >
              {/* Left Column: Details & Philosophy */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-blue-600 text-white dark:bg-[#E1E0CC] dark:text-black px-3 py-0.5 text-xs font-mono font-semibold">
                    Step {activeStep.stepNumber}
                  </span>
                  <span className="rounded-full border border-blue-200 dark:border-[#E1E0CC]/30 bg-blue-50 dark:bg-white/[0.04] px-3 py-0.5 text-xs font-mono text-blue-700 dark:text-[#E1E0CC]/90">
                    Engine: {activeStep.agentRole}
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-medium tracking-tight text-slate-900 dark:text-[#E1E0CC] mb-3">
                    {activeStep.title}
                  </h3>
                  <p className="text-base sm:text-lg text-slate-700 dark:text-[#E1E0CC]/80 font-normal dark:font-light leading-relaxed">
                    {activeStep.subtitle}
                  </p>
                </div>

                <p className="text-sm sm:text-base text-slate-600 dark:text-[#E1E0CC]/60 leading-relaxed">
                  {activeStep.description}
                </p>

                {/* Technical highlight callout */}
                <div className="rounded-xl border border-slate-200 dark:border-[#E1E0CC]/15 bg-white dark:bg-black/40 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full p-1 bg-blue-50 text-blue-600 dark:bg-[#E1E0CC]/10 dark:text-[#E1E0CC]">
                      <Sliders className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-[#E1E0CC]/50 mb-0.5">
                        Technical Architecture
                      </div>
                      <div className="text-xs sm:text-sm text-slate-900 dark:text-[#E1E0CC]/90 font-mono font-medium">
                        {activeStep.technicalHighlight}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Next Step Action */}
                <div className="pt-2 flex items-center gap-4">
                  <button
                    onClick={() => {
                      const currentIndex = workflowSteps.findIndex((s) => s.id === activeStep.id);
                      const nextIndex = (currentIndex + 1) % workflowSteps.length;
                      setActiveTab(workflowSteps[nextIndex].id);
                    }}
                    className="group inline-flex items-center gap-2 rounded-full bg-blue-600 text-white dark:bg-[#E1E0CC] dark:text-black py-1.5 pl-5 pr-1.5 text-xs sm:text-sm font-medium transition-all hover:gap-3 cursor-pointer shadow-md"
                  >
                    Next Workflow Step
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 dark:bg-black dark:text-[#E1E0CC] transition-transform group-hover:scale-110">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                  <span className="text-xs text-slate-500 dark:text-[#E1E0CC]/40 font-mono">
                    Step {activeStep.stepNumber} of 05
                  </span>
                </div>
              </div>

              {/* Right Column: Live Simulated UI / Telemetry Terminal */}
              <div className="col-span-12 lg:col-span-6">
                <div className="rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/80 shadow-2xl p-5 sm:p-6 relative overflow-hidden">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4 mb-5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                      <span className="ml-2 text-xs font-mono text-slate-700 dark:text-[#E1E0CC]/70 font-semibold">
                        {activeStep.mockUI.title}
                      </span>
                    </div>
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-mono text-blue-700 dark:border-[#E1E0CC]/20 dark:bg-[#E1E0CC]/10 dark:text-[#E1E0CC]">
                      {activeStep.mockUI.badgeText}
                    </span>
                  </div>

                  {/* Simulated Data Grid */}
                  <div className="space-y-3 font-mono text-xs">
                    {activeStep.mockUI.details.map((detail, idx) => (
                      <div 
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4 p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-blue-400 dark:bg-white/[0.04] dark:border-white/10 dark:hover:border-blue-400/40 transition-colors"
                      >
                        <span className="text-slate-500 dark:text-gray-400 text-[11px] shrink-0 uppercase tracking-wider font-semibold">
                          {detail.label}:
                        </span>
                        <span className="text-slate-900 dark:text-white text-left sm:text-right font-medium">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* If step has live chat snippet (e.g. Negotiation) */}
                  {activeStep.mockUI.simulationSnippet && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 dark:text-[#E1E0CC]/50 mb-2 font-semibold">
                        Platform Wire Trace
                      </div>
                      {activeStep.mockUI.simulationSnippet.map((msg, i) => (
                        <div key={i} className="rounded-md bg-slate-50 dark:bg-white/[0.04] p-2 text-[11px] font-mono border border-slate-200 dark:border-white/10">
                          <div className="flex items-center justify-between text-slate-500 dark:text-gray-400 mb-1">
                            <span className="font-semibold text-slate-900 dark:text-white">{msg.sender}</span>
                            <span className="text-[9px]">{msg.time}</span>
                          </div>
                          <p className="text-slate-700 dark:text-gray-200">{msg.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Trust & Verification Footer */}
                  <div className="mt-5 pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="h-3 w-3" />
                      Cryptographically Validated
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Supabase RLS Protected
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Metrics Bar */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 text-center shadow-sm">
            <div className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-[#E1E0CC] mb-1 font-mono">
              78%
            </div>
            <div className="text-xs text-slate-500 dark:text-[#E1E0CC]/60 uppercase font-mono tracking-wider">
              Procurement Cycle Reduced
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 text-center shadow-sm">
            <div className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-[#E1E0CC] mb-1 font-mono">
              100%
            </div>
            <div className="text-xs text-slate-500 dark:text-[#E1E0CC]/60 uppercase font-mono tracking-wider">
              Human In The Loop Approval
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 text-center shadow-sm">
            <div className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-[#E1E0CC] mb-1 font-mono">
              FalkorDB
            </div>
            <div className="text-xs text-slate-500 dark:text-[#E1E0CC]/60 uppercase font-mono tracking-wider">
              Knowledge Graph Context
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 text-center shadow-sm">
            <div className="text-2xl sm:text-3xl font-medium tracking-tight text-slate-900 dark:text-[#E1E0CC] mb-1 font-mono">
              PayPal v2
            </div>
            <div className="text-xs text-slate-500 dark:text-[#E1E0CC]/60 uppercase font-mono tracking-wider">
              Signed Webhook Verification
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
