import React from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { 
  Bot, 
  ShieldCheck, 
  Sliders, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";

export const BuyerAgentsPage: React.FC = () => {
  const { buyerPreferences, updateBuyerPreferences } = useMarketplace();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A11] text-slate-900 dark:text-gray-100 pt-20 pb-20">
      
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0F1D]/80 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/10 dark:bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 font-mono">
                  AGENT POLICY
                </span>
                <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">/agents</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Buyer Agent OS & Procurement Rules
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                Configure autonomous procurement rules, bounded negotiation permissions, and human approval gates.
              </p>
            </div>

            <Link
              to="/sourcing"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all self-start md:self-auto cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Launch Sourcing with this Agent</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Controls (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Card 1: Negotiation Guardrails */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-lg space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1B2335] pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Bounded Negotiation Behavior</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400">Control multi-agent conversational concession bounds</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold">
                  Policy Enforced
                </span>
              </div>

              {/* Strategy Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-2">Negotiation Strategy</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["aggressive", "balanced", "speed_first"] as const).map((strat) => (
                    <button
                      key={strat}
                      onClick={() => updateBuyerPreferences({ strategy: strat })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                        buyerPreferences.strategy === strat
                          ? "border-blue-500 bg-blue-50 text-blue-900 shadow-sm dark:border-blue-500/50 dark:bg-blue-600/20 dark:text-white font-semibold"
                          : "border-slate-200 bg-slate-50/60 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-[#1E2638] dark:bg-[#0A0F1D] dark:text-gray-400 dark:hover:text-white"
                      }`}
                    >
                      <span className="text-xs font-bold capitalize block">
                        {strat.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-gray-400 mt-1 block">
                        {strat === "aggressive"
                          ? "Pushes for max discounts near supplier price floor"
                          : strat === "balanced"
                          ? "Weights FalkorDB historical benchmark prices"
                          : "Prioritizes guaranteed rapid delivery"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Rounds Safety Cap */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-gray-300 font-medium">Safety Cap (Max Negotiation Rounds)</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{buyerPreferences.maxRounds} Rounds (Safety Limit)</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="20"
                  value={buyerPreferences.maxRounds}
                  onChange={(e) => updateBuyerPreferences({ maxRounds: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 dark:text-gray-500 mt-1 block">
                  Agents negotiate dynamically until convergence. This slider sets the maximum safety cap to prevent infinite loops.
                </span>
              </div>

              {/* Warranty */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 dark:text-gray-300 font-medium">Mandatory Warranty Standard</span>
                  <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{buyerPreferences.mandatoryWarrantyMonths} Months</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="36"
                  step="6"
                  value={buyerPreferences.mandatoryWarrantyMonths}
                  onChange={(e) => updateBuyerPreferences({ mandatoryWarrantyMonths: parseInt(e.target.value, 10) })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

            </div>

            {/* Card 2: Human Approval Safeguards */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-lg space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-[#1B2335] pb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Human-In-The-Loop Governance</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Consequential decision gates as specified in abstract</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-[#1B2335] bg-slate-50/70 dark:bg-[#0A0F1D]">
                  <div>
                    <strong className="text-slate-900 dark:text-white block font-medium">Require Explicit Permission Before Contacting Suppliers</strong>
                    <p className="text-slate-500 dark:text-gray-400 text-[11px] mt-0.5">
                      The Buyer Agent will NOT dispatch RFQs or begin negotiation until a human procurement manager clicks "Approve Contact".
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={buyerPreferences.requireExplicitContactApproval}
                    onChange={(e) => updateBuyerPreferences({ requireExplicitContactApproval: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-600 cursor-pointer mt-1"
                  />
                </div>

                <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 dark:border-[#1B2335] bg-slate-50/70 dark:bg-[#0A0F1D]">
                  <div>
                    <strong className="text-slate-900 dark:text-white block font-medium">PayPal Checkout Approval Gate</strong>
                    <p className="text-slate-500 dark:text-gray-400 text-[11px] mt-0.5">
                      Strict policy: Even if agents agree on terms, payment is NEVER automated. Human buyer must review finalized quotation version before PayPal checkout.
                    </p>
                  </div>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/30 font-semibold">
                    Always Enforced
                  </span>
                </div>

              </div>
            </div>

          </div>

          {/* Right Info Sidebar (1 col) */}
          <div className="space-y-6">
            
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-lg">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Agent Identity & Security
              </h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-2 leading-relaxed">
                Your Buyer Agent operates under your verified enterprise profile. It only exposes procurement parameters you authorize and cannot access confidential supplier pricing policies.
              </p>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-[#182033] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-500">Agent Protocol:</span>
                  <span className="font-mono text-slate-800 dark:text-white font-medium">REST Orchestration</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-500">Buyer Agent LLM:</span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">deepseek-r1:14b (Ollama)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-500">Seller Agent LLM:</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-medium">qwen2.5:14b (Ollama)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-500">Graph Memory:</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400 font-medium">FalkorDB Traversal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-gray-500">Payment Engine:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">PayPal Sandbox</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-gradient-to-br dark:from-[#0F172A] dark:to-[#0A0E1A] p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ready to test agent behavior?</h3>
              <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">
                Enter your procurement requirements in the AI Sourcing console to see this agent in action.
              </p>
              <Link
                to="/sourcing"
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <span>Open Sourcing Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
};
