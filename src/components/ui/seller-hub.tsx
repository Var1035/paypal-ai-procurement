import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SlidersHorizontal,
  PackageCheck,
  FileText,
  TrendingUp,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  Lock,
  Building2,
  RefreshCw
} from "lucide-react";

interface CatalogItem {
  sku: string;
  name: string;
  category: string;
  inStock: number;
  basePrice: number;
  floorPrice: number;
  autoQuote: boolean;
  leadDays: number;
}

interface PendingQuote {
  id: string;
  buyerCompany: string;
  item: string;
  quantity: number;
  proposedPrice: number;
  totalValue: number;
  marginAchieved: number;
  status: "awaiting_approval" | "auto_approved" | "rejected";
  buyerLeadTime: string;
}

export const SellerHub = () => {
  const [activeTab, setActiveTab] = useState<"guardrails" | "catalog" | "rfqs" | "graph">("guardrails");

  // Interactive Guardrail State
  const [minMargin, setMinMargin] = useState<number>(22);
  const [maxRoundConcession, setMaxRoundConcession] = useState<number>(4);
  const [requireHumanApprovalAbove, setRequireHumanApprovalAbove] = useState<number>(10000);
  const [autoQuoteEnabled, setAutoQuoteEnabled] = useState<boolean>(true);
  const [leadTimeBuffer, setLeadTimeBuffer] = useState<number>(2);

  // Live Catalog State
  const [catalog, setCatalog] = useState<CatalogItem[]>([
    { sku: "FUR-DSK-01", name: "Ergonomic Birch Workstation", category: "Commercial Desks", inStock: 340, basePrice: 155, floorPrice: 132, autoQuote: true, leadDays: 5 },
    { sku: "FUR-CHR-08", name: "Executive Lumbar Mesh Chair", category: "Ergonomic Seating", inStock: 180, basePrice: 220, floorPrice: 185, autoQuote: true, leadDays: 4 },
    { sku: "FUR-TBL-14", name: "Modular Conference Table 12ft", category: "Meeting Spaces", inStock: 45, basePrice: 890, floorPrice: 750, autoQuote: false, leadDays: 8 },
    { sku: "FUR-ACU-02", name: "Acoustic Partition Wall Paneling", category: "Acoustics", inStock: 620, basePrice: 75, floorPrice: 62, autoQuote: true, leadDays: 3 }
  ]);

  // Pending Quotes Queue
  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([
    {
      id: "RFQ-9921",
      buyerCompany: "Northgate Academy",
      item: "Ergonomic Birch Workstation",
      quantity: 100,
      proposedPrice: 138,
      totalValue: 13800,
      marginAchieved: 26.4,
      status: "awaiting_approval",
      buyerLeadTime: "7 Days"
    },
    {
      id: "RFQ-9924",
      buyerCompany: "Vanguard Tech Labs",
      item: "Executive Lumbar Mesh Chair",
      quantity: 40,
      proposedPrice: 195,
      totalValue: 7800,
      marginAchieved: 29.1,
      status: "auto_approved",
      buyerLeadTime: "5 Days"
    },
    {
      id: "RFQ-9928",
      buyerCompany: "Apex Design Studio",
      item: "Modular Conference Table 12ft",
      quantity: 4,
      proposedPrice: 760,
      totalValue: 3040,
      marginAchieved: 22.8,
      status: "awaiting_approval",
      buyerLeadTime: "10 Days"
    }
  ]);

  const handleApproveQuote = (id: string) => {
    setPendingQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "auto_approved" } : q))
    );
  };

  const handleRejectQuote = (id: string) => {
    setPendingQuotes((prev) =>
      prev.map((q) => (q.id === id ? { ...q, status: "rejected" } : q))
    );
  };

  return (
    <section id="seller-hub" className="relative w-full bg-black py-24 sm:py-32 px-4 sm:px-6 md:px-10 overflow-hidden text-[#E1E0CC] border-t border-white/10">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div 
          className="absolute top-1/3 -right-20 h-[550px] w-[650px] rounded-full opacity-[0.06] blur-[150px]"
          style={{ background: "#E1E0CC" }}
        />
        <div className="noise-overlay absolute inset-0 opacity-[0.35] mix-blend-overlay" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col items-start gap-4 mb-16 md:mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E1E0CC]/20 bg-white/[0.03] px-3.5 py-1 text-xs font-mono tracking-widest uppercase text-[#E1E0CC]/80 backdrop-blur-md">
            <Building2 className="h-3 w-3 text-[#E1E0CC]" />
            03 / Supplier OS & Seller Agent Control
          </div>

          <div className="grid grid-cols-12 gap-6 w-full items-end">
            <div className="col-span-12 lg:col-span-8">
              <h2 className="text-3xl sm:text-5xl md:text-6xl font-medium tracking-[-0.03em] leading-[1.05] text-[#E1E0CC]">
                Your 24/7 Autonomous Sales Desk.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-4">
              <p className="text-sm sm:text-base text-[#E1E0CC]/60 leading-relaxed">
                Equip your business with an AI Seller Agent that answers buyer inquiries, enforces minimum profit margins, calculates volume discounts, and coordinates formal quotations.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-white/[0.03] border border-white/10 mb-8 max-w-2xl">
          {[
            { id: "guardrails", label: "Agent Guardrails & Policies", icon: SlidersHorizontal },
            { id: "catalog", label: "Catalog & Floor Pricing", icon: PackageCheck },
            { id: "rfqs", label: "Quotation Approvals", icon: FileText, count: pendingQuotes.filter(q => q.status === "awaiting_approval").length },
            { id: "graph", label: "FalkorDB Market Intel", icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  isActive
                    ? "bg-[#E1E0CC] text-black shadow-lg"
                    : "text-[#E1E0CC]/70 hover:text-[#E1E0CC] hover:bg-white/[0.04]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? "bg-black text-[#E1E0CC]" : "bg-[#E1E0CC]/20 text-[#E1E0CC]"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Panels */}
        <AnimatePresence mode="wait">
          {activeTab === "guardrails" && (
            <motion.div
              key="guardrails"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-12 gap-6 lg:gap-8"
            >
              {/* Left Column: Interactive Policy Sliders */}
              <div className="col-span-12 lg:col-span-7 rounded-2xl md:rounded-[2rem] border border-[#E1E0CC]/20 bg-gradient-to-b from-white/[0.04] to-black/70 p-6 sm:p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
                  <div>
                    <h3 className="text-xl font-medium text-[#E1E0CC]">Agent Negotiation Parameters</h3>
                    <p className="text-xs sm:text-sm text-[#E1E0CC]/60">Your AI Agent is strictly sandboxed by these mathematical limits.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Lock className="h-3 w-3" /> Policy Active
                  </span>
                </div>

                <div className="space-y-6">
                  {/* Slider 1: Minimum Gross Margin */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E1E0CC]">Minimum Gross Margin Floor</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#E1E0CC]/70">Hard Limit</span>
                      </div>
                      <span className="font-mono text-base font-bold text-[#E1E0CC]">{minMargin}%</span>
                    </div>
                    <p className="text-xs text-[#E1E0CC]/50 mb-4">
                      The Seller Agent will automatically terminate or counter any buyer offer that yields under this margin.
                    </p>
                    <input
                      type="range"
                      min={10}
                      max={45}
                      value={minMargin}
                      onChange={(e) => setMinMargin(Number(e.target.value))}
                      className="w-full accent-[#E1E0CC] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-[#E1E0CC]/40 mt-1">
                      <span>10% (Aggressive Volume)</span>
                      <span>25% (Standard)</span>
                      <span>45% (High Margin)</span>
                    </div>
                  </div>

                  {/* Slider 2: Max Concession Per Round */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E1E0CC]">Max Price Discount Per Round</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#E1E0CC]/70">Pacing</span>
                      </div>
                      <span className="font-mono text-base font-bold text-[#E1E0CC]">{maxRoundConcession}%</span>
                    </div>
                    <p className="text-xs text-[#E1E0CC]/50 mb-4">
                      Prevents the agent from caving in prematurely during multi-turn negotiations.
                    </p>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={maxRoundConcession}
                      onChange={(e) => setMaxRoundConcession(Number(e.target.value))}
                      className="w-full accent-[#E1E0CC] cursor-pointer"
                    />
                  </div>

                  {/* Slider 3: Human Approval Ceiling */}
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-5">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E1E0CC]">Manual Sign-off Threshold</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Executive Review</span>
                      </div>
                      <span className="font-mono text-base font-bold text-[#E1E0CC]">${requireHumanApprovalAbove.toLocaleString()} USD</span>
                    </div>
                    <p className="text-xs text-[#E1E0CC]/50 mb-4">
                      Any quotation exceeding this total value requires explicit 1-click human executive authorization before being submitted to the buyer.
                    </p>
                    <input
                      type="range"
                      min={2000}
                      max={50000}
                      step={1000}
                      value={requireHumanApprovalAbove}
                      onChange={(e) => setRequireHumanApprovalAbove(Number(e.target.value))}
                      className="w-full accent-[#E1E0CC] cursor-pointer"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-medium text-[#E1E0CC]">Autonomous Instant Quote</div>
                        <div className="text-[10px] text-[#E1E0CC]/50">Quote immediately if under ceiling</div>
                      </div>
                      <button
                        onClick={() => setAutoQuoteEnabled(!autoQuoteEnabled)}
                        className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${autoQuoteEnabled ? "bg-[#E1E0CC] justify-end" : "bg-white/20 justify-start"}`}
                      >
                        <div className={`w-4 h-4 rounded-full ${autoQuoteEnabled ? "bg-black" : "bg-white"}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-medium text-[#E1E0CC]">Fulfillment Lead Buffer</div>
                        <div className="text-[10px] text-[#E1E0CC]/50">Safety buffer: +{leadTimeBuffer} business days</div>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <button 
                          onClick={() => setLeadTimeBuffer(Math.max(0, leadTimeBuffer - 1))}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[#E1E0CC]"
                        >
                          -
                        </button>
                        <span className="px-2 text-[#E1E0CC]">{leadTimeBuffer}d</span>
                        <button 
                          onClick={() => setLeadTimeBuffer(leadTimeBuffer + 1)}
                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[#E1E0CC]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live Policy Preview & Agent Decision Sandbox */}
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                <div className="rounded-2xl md:rounded-[2rem] border border-[#E1E0CC]/20 bg-black/80 p-6 sm:p-7 shadow-xl">
                  <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                    <span className="text-xs font-mono uppercase tracking-widest text-[#E1E0CC]/60 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#E1E0CC]" />
                      Real-Time Agent Simulation
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">Sandbox Synced</span>
                  </div>

                  <p className="text-xs text-[#E1E0CC]/70 mb-4 leading-relaxed">
                    Based on your live settings, here is how your Seller Agent behaves when an incoming buyer RFQ arrives:
                  </p>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                      <div className="text-[11px] text-[#E1E0CC]/50 uppercase mb-1">Scenario: 100 Desks ($130 / unit offer)</div>
                      <div className="text-xs text-rose-300 font-semibold mb-1">
                        Terminated / Countered
                      </div>
                      <div className="text-[11px] text-[#E1E0CC]/70">
                        Yields 19.8% margin, which breaches your {minMargin}% floor. Agent counters at ${(155 * (1 - (100 - minMargin)/100 * 0.4)).toFixed(0)}/unit.
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                      <div className="text-[11px] text-[#E1E0CC]/50 uppercase mb-1">Scenario: Order Total $13,800 USD</div>
                      <div className="text-xs text-amber-300 font-semibold mb-1">
                        {13800 > requireHumanApprovalAbove ? "Manual Sign-off Triggered" : "Instant Auto-Approved"}
                      </div>
                      <div className="text-[11px] text-[#E1E0CC]/70">
                        {13800 > requireHumanApprovalAbove 
                          ? `Exceeds your $${requireHumanApprovalAbove.toLocaleString()} ceiling. Alert sent to CEO dashboard before quote dispatch.`
                          : `Below your $${requireHumanApprovalAbove.toLocaleString()} threshold. Dispatched immediately via platform socket.`}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                      <div className="text-[11px] text-[#E1E0CC]/50 uppercase mb-1">Estimated Delivery Commitment</div>
                      <div className="text-xs text-[#E1E0CC] font-semibold mb-1">
                        Catalog SLA (4d) + Buffer ({leadTimeBuffer}d) = {4 + leadTimeBuffer} Days
                      </div>
                      <div className="text-[11px] text-[#E1E0CC]/70">
                        Agent guarantees arrival in {4 + leadTimeBuffer} business days, protecting your supplier reliability score.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 p-3 rounded-xl bg-[#E1E0CC]/[0.06] border border-[#E1E0CC]/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-[#E1E0CC]" />
                      <span className="text-xs text-[#E1E0CC] font-medium">Tenant Isolation Guard</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#E1E0CC]/70">Supabase RLS Enforced</span>
                  </div>
                </div>

                {/* Quick Stats Widget */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-2xl font-mono font-medium text-[#E1E0CC]">1,420</div>
                    <div className="text-[11px] text-[#E1E0CC]/60 uppercase font-mono">Negotiations Handled</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
                    <div className="text-2xl font-mono font-medium text-[#E1E0CC]">28.4%</div>
                    <div className="text-[11px] text-[#E1E0CC]/60 uppercase font-mono">Avg Gross Margin Retained</div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "catalog" && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl md:rounded-[2rem] border border-[#E1E0CC]/20 bg-gradient-to-b from-white/[0.04] to-black/80 p-6 sm:p-8 backdrop-blur-xl"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-white/10">
                <div>
                  <h3 className="text-xl font-medium text-[#E1E0CC]">Authorised Product Catalog</h3>
                  <p className="text-xs sm:text-sm text-[#E1E0CC]/60">Products, real-time stock levels, and confidential floor pricing accessible to your agent.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#E1E0CC]/50">Authorised SKUs: {catalog.length}</span>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#E1E0CC] text-black">
                    <RefreshCw className="h-3 w-3" /> Sync Supabase
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[#E1E0CC]/50 uppercase tracking-wider text-[11px]">
                      <th className="pb-3 font-medium">SKU / Product</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium">In Stock</th>
                      <th className="pb-3 font-medium">Base Price</th>
                      <th className="pb-3 font-medium">Agent Floor</th>
                      <th className="pb-3 font-medium">Lead Time</th>
                      <th className="pb-3 font-medium text-right">Autonomous Quote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {catalog.map((item) => (
                      <tr key={item.sku} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 font-sans font-medium text-[#E1E0CC]">
                          <div>{item.name}</div>
                          <div className="text-[10px] font-mono text-[#E1E0CC]/40">{item.sku}</div>
                        </td>
                        <td className="py-4 text-[#E1E0CC]/70">{item.category}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${item.inStock > 50 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-300"}`}>
                            {item.inStock} units
                          </span>
                        </td>
                        <td className="py-4 text-[#E1E0CC] font-semibold">${item.basePrice}</td>
                        <td className="py-4 text-emerald-400 font-semibold">${item.floorPrice}</td>
                        <td className="py-4 text-[#E1E0CC]/70">{item.leadDays} days</td>
                        <td className="py-4 text-right">
                          <button
                            onClick={() => {
                              setCatalog(prev => prev.map(c => c.sku === item.sku ? { ...c, autoQuote: !c.autoQuote } : c));
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-mono transition-colors ${
                              item.autoQuote 
                                ? "bg-[#E1E0CC]/15 text-[#E1E0CC] border border-[#E1E0CC]/30" 
                                : "bg-white/5 text-[#E1E0CC]/40 border border-white/10"
                            }`}
                          >
                            {item.autoQuote ? "Enabled" : "Manual Only"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "rfqs" && (
            <motion.div
              key="rfqs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xl font-medium text-[#E1E0CC]">Pending Formal Quotations</h3>
                <span className="text-xs font-mono text-[#E1E0CC]/60">Requiring Human Sign-off or Auto-Dispatched</span>
              </div>

              {pendingQuotes.map((quote) => (
                <div 
                  key={quote.id} 
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6 hover:border-[#E1E0CC]/30 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[#E1E0CC]">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-[#E1E0CC]">{quote.buyerCompany}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#E1E0CC]/70">{quote.id}</span>
                      </div>
                      <div className="text-xs text-[#E1E0CC]/80 mb-2">
                        {quote.quantity}x {quote.item} · Target delivery: {quote.buyerLeadTime}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                        <span className="text-[#E1E0CC]/60">Negotiated Price: <strong className="text-[#E1E0CC]">${quote.proposedPrice}/unit</strong></span>
                        <span className="text-[#E1E0CC]/60">Total: <strong className="text-[#E1E0CC]">${quote.totalValue.toLocaleString()} USD</strong></span>
                        <span className="text-emerald-400">Margin: +{quote.marginAchieved}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {quote.status === "awaiting_approval" ? (
                      <>
                        <button
                          onClick={() => handleRejectQuote(quote.id)}
                          className="px-4 py-2 rounded-xl text-xs font-mono font-medium border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleApproveQuote(quote.id)}
                          className="px-5 py-2 rounded-xl text-xs font-mono font-semibold bg-[#E1E0CC] text-black hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <CheckCircle className="h-3.5 w-3.5" /> Approve & Issue Quote
                        </button>
                      </>
                    ) : quote.status === "auto_approved" ? (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="h-3.5 w-3.5" /> Approved & Sent to Buyer
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
                        <AlertCircle className="h-3.5 w-3.5" /> Quotation Rejected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === "graph" && (
            <motion.div
              key="graph"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-12 gap-6 lg:gap-8"
            >
              <div className="col-span-12 lg:col-span-8 rounded-2xl md:rounded-[2rem] border border-[#E1E0CC]/20 bg-gradient-to-b from-white/[0.04] to-black/80 p-6 sm:p-8 backdrop-blur-xl">
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
                  <div>
                    <h3 className="text-xl font-medium text-[#E1E0CC]">FalkorDB Contextual Pricing Graph</h3>
                    <p className="text-xs sm:text-sm text-[#E1E0CC]/60">Anonymized graph topology showing past pricing outcomes, substitution patterns, and win rates.</p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    Graph Node Sync: Live
                  </span>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="text-[#E1E0CC]/50 text-[11px] mb-1">Graph Traversal: (:SellerApex)-[:OFFERS]-&gt;(:ProductBirchDesk)</div>
                    <div className="text-sm font-semibold text-[#E1E0CC] mb-2">Historical B2B Deal Distribution</div>
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-white/5">
                        <div className="text-[#E1E0CC]/50">1-49 units</div>
                        <div className="text-[#E1E0CC] font-bold">$148 - $155 / u</div>
                      </div>
                      <div className="p-2 rounded bg-white/5">
                        <div className="text-[#E1E0CC]/50">50-199 units</div>
                        <div className="text-emerald-400 font-bold">$135 - $142 / u</div>
                      </div>
                      <div className="p-2 rounded bg-white/5">
                        <div className="text-[#E1E0CC]/50">200+ units</div>
                        <div className="text-[#E1E0CC] font-bold">$125 - $132 / u</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                    <div className="text-[#E1E0CC]/50 text-[11px] mb-1">FalkorDB Relationship Edge</div>
                    <div className="text-xs text-[#E1E0CC] font-medium mb-1">
                      {"(NorthgateAcademy)-[:HAS_TRANSACTION_HISTORY_WITH {repeat_orders: 4, on_time_rate: 1.0}]->(ApexNordic)"}
                    </div>
                    <div className="text-[11px] text-[#E1E0CC]/70">
                      Loyalty bonus automatically factored by Seller Agent: +2.5% discount unlocked on 100+ volume for repeat partner.
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-4 rounded-2xl md:rounded-[2rem] border border-white/10 bg-black/80 p-6 flex flex-col justify-between">
                <div>
                  <h4 className="text-base font-medium text-[#E1E0CC] mb-2">Seller Health Rating</h4>
                  <div className="text-3xl font-mono font-bold text-[#E1E0CC] mb-1">98.4 / 100</div>
                  <p className="text-xs text-[#E1E0CC]/60 mb-6">
                    Top 2% supplier across all educational furniture categories on the platform.
                  </p>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between pb-2 border-b border-white/5">
                      <span className="text-[#E1E0CC]/50">Quote Acceptance Rate</span>
                      <span className="text-[#E1E0CC] font-semibold">72.4%</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-white/5">
                      <span className="text-[#E1E0CC]/50">Avg Fulfillment SLA</span>
                      <span className="text-[#E1E0CC] font-semibold">4.2 days</span>
                    </div>
                    <div className="flex justify-between pb-2 border-b border-white/5">
                      <span className="text-[#E1E0CC]/50">Dispute & Return Rate</span>
                      <span className="text-emerald-400 font-semibold">0.0%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10">
                  <a
                    href="#seller-hub"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-[#E1E0CC] transition-colors"
                  >
                    Export Historical Ledger <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </section>
  );
};
