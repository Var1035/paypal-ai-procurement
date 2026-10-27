import React from "react";
import { Link } from "react-router-dom";
import { PrismaHero } from "@/components/ui/prisma-hero";
import { HowItWorks } from "@/components/ui/how-it-works";
import { 
  Bot, 
  ShieldCheck, 
  CreditCard, 
  GitBranch, 
  ArrowRight, 
  Building2 
} from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-[#E1E0CC] selection:bg-blue-600 selection:text-white dark:selection:bg-[#E1E0CC] dark:selection:text-black">
      
      {/* 1. Hero Section */}
      <PrismaHero />

      {/* 2. Live Metrics Showcase */}
      <section className="border-y border-slate-200 dark:border-[#222735] bg-white dark:bg-[#0A0E17] py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            
            <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/80 dark:bg-[#111726]/60 p-6 backdrop-blur shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Bot className="h-5 w-5" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-400">Autonomous</span>
              </div>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono">3 Agents</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Independently configured supplier reasoning policies</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/80 dark:bg-[#111726]/60 p-6 backdrop-blur shadow-sm">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <GitBranch className="h-5 w-5" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-400">Graph DB</span>
              </div>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono">FalkorDB</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Evidence-backed Cypher traversal on historical quotes</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/80 dark:bg-[#111726]/60 p-6 backdrop-blur shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-400">Guardrails</span>
              </div>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono">100% Floor</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Deterministic server-side price & stock validation</p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/80 dark:bg-[#111726]/60 p-6 backdrop-blur shadow-sm">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <CreditCard className="h-5 w-5" />
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-gray-400">Settlement</span>
              </div>
              <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono">PayPal</div>
              <p className="mt-1 text-xs text-slate-600 dark:text-gray-400">Server-verified sandbox orders & capture status</p>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Interactive How It Works Section */}
      <HowItWorks />

      {/* 4. Action Dual Banner */}
      <section className="bg-slate-100 dark:bg-gradient-to-b dark:from-black dark:via-[#0B101D] dark:to-black py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-transparent">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Buyer Persona Card */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-white dark:bg-gradient-to-br dark:from-[#121B2F] dark:to-[#0A0E17] p-8 sm:p-10 shadow-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                <Bot className="h-3.5 w-3.5" />
                For Procurement Teams & Buyers
              </div>
              <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Source with AI Agents</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
                Describe your requirements naturally. Your AI agent inspects FalkorDB graph relationships, requests quotations, and conducts bounded negotiation up to 3 rounds.
              </p>
              <div className="mt-8 flex items-center gap-4">
                <Link
                  to="/sourcing"
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  Start Sourcing Session
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/agents"
                  className="text-xs font-medium text-slate-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-white transition-colors"
                >
                  Configure Buyer Preferences →
                </Link>
              </div>
            </div>

            {/* Seller Persona Card */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-500/20 bg-white dark:bg-gradient-to-br dark:from-[#1D1630] dark:to-[#0A0E17] p-8 sm:p-10 shadow-lg">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-400">
                <Building2 className="h-3.5 w-3.5" />
                For Registered Suppliers & Manufacturers
              </div>
              <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Seller Hub & Agent OS</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-gray-300 leading-relaxed">
                Register your business, list products in the catalog, configure automated agent negotiation guardrails, and approve high-value quotations before payment.
              </p>
              <div className="mt-8 flex items-center gap-4">
                <Link
                  to="/seller"
                  className="inline-flex items-center gap-2 rounded-full bg-purple-600 hover:bg-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  Open Seller Hub
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/graph"
                  className="text-xs font-medium text-slate-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-white transition-colors"
                >
                  Explore FalkorDB Graph →
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Minimal Footer */}
      <footer className="border-t border-slate-200 dark:border-[#1E2638] bg-slate-100 dark:bg-black py-8 text-center text-xs text-slate-600 dark:text-gray-500">
        <p>AgentMarket • PayPal AI Hackathon Demo • Built with Vite, React 19, Express, FalkorDB & Supabase</p>
      </footer>

    </div>
  );
};
