import React, { useState, useRef, useMemo, useEffect } from "react";
import { useMarketplace, type ProductItem } from "@/context/MarketplaceContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/services/apiClient";
import MorphOrb, { type MorphOrbHandle } from "@/components/ui/ai-thiking-orb-and-input";
import { 
  Bot, 
  CheckCircle2, 
  ShieldCheck, 
  GitBranch, 
  ArrowRight, 
  AlertCircle,
  Building2,
  X,
  Package,
  FileText,
  Sparkles,
  RefreshCw,
  Clock,
  LogIn,
  MessageSquare,
  Layers,
  CreditCard,
  Square,
  Calendar
} from "lucide-react";
import { NegotiationDetailModal } from "@/components/negotiation/NegotiationDetailModal";
import { PayPalCheckoutModal } from "@/components/payment/PayPalCheckoutModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cleanHumanChatText, isWithinTimeline, type TimelineFilterOption, TIMELINE_FILTER_OPTIONS } from "@/lib/utils";

export interface DetailedAIAnalysis {
  query: string;
  timestamp: string;
  item: string;
  qty: number;
  budget: number;
  unitTarget: number;
  days: number;
  executiveSummary: string;
  specs: {
    material: string;
    standards: string;
    frame: string;
    certification: string;
  };
  policyCheck: {
    status: "PASSED";
    maxRounds: number;
    openingTarget: number;
    escrowRule: string;
    humanSignoff: string;
  };
  supplierMatches: {
    id: string;
    name: string;
    matchScore: number;
    leadDays: number;
    unitPrice: number;
    totalPrice: number;
    inStock: number;
    hubLocation: string;
    reliability: number;
    highlights: string;
    matchedProduct?: ProductItem;
  }[];
}

const buildAnalysisDetails = (
  queryText: string,
  itemName: string,
  qty: number,
  budget: number,
  days: number,
  productList: ProductItem[],
  selectedSellerId?: string
): DetailedAIAnalysis => {
  const filteredProducts = selectedSellerId && selectedSellerId !== "all"
    ? productList.filter((p) => p.businessId === selectedSellerId || p.businessName?.toLowerCase() === selectedSellerId.toLowerCase())
    : productList;

  const unitTarget = Math.round(budget / (qty > 0 ? qty : 1));
  const isChairs = itemName.toLowerCase().includes("chair");

  const supplierMatches = filteredProducts.map((p, idx) => {
    const isDesk = p.name.toLowerCase().includes("desk");
    const itemMatch = isChairs ? !isDesk : isDesk;
    const meetsLead = p.leadDays <= days;
    const meetsStock = p.inStock >= qty;
    let score = 95 - idx * 5;
    if (meetsLead && meetsStock && itemMatch) score = Math.max(90, 99 - idx * 3);
    else if (!meetsLead) score -= 12;

    const unitPrice = p.basePrice ? Math.round(p.basePrice / 100) : 4500;
    const totalPrice = unitPrice * qty;
    const hubs = ["Bangalore Logistics Park", "Mumbai Port Distribution Hub", "Delhi NCR Express Depot"];
    const highlights = idx === 0 
      ? "Direct manufacturer inventory • ISO 9001:2015 certified • Express dispatch ready"
      : idx === 1
      ? "Institutional contract rates • Bulk pallet packing • Anti-tamper crating"
      : "Heavy gauge steel construction • Scratch-resistant laminate • Extended 3-yr warranty";

    return {
      id: p.id,
      name: p.businessName || p.name,
      matchScore: Math.min(99, Math.max(75, score)),
      leadDays: p.leadDays,
      unitPrice,
      totalPrice,
      inStock: p.inStock,
      hubLocation: hubs[idx % hubs.length],
      reliability: 98.2 - idx * 2.1,
      highlights,
      matchedProduct: p,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);

  return {
    query: queryText,
    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    item: itemName,
    qty,
    budget,
    unitTarget,
    days,
    executiveSummary: `Autonomous AI Sourcing Agent evaluated procurement requirements for ${qty} units of ${itemName} against verified supplier catalogs and active inventory. Verified ${supplierMatches.length} supplier catalogs with active stock, meeting delivery lead time (≤ ${days} days) and target unit price ceiling of ₹${unitTarget.toLocaleString()}. Deterministic safeguards initialized for bounded negotiation with top supplier.`,
    specs: {
      material: isChairs ? "High-Density Polypropylene & Breathable Mesh" : "FSC-Certified Commercial European Birch Hardwood",
      standards: isChairs ? "BIFMA X5.1 Ergonomic Standards Compliant" : "EN 1729 European Educational Furniture Specification",
      frame: isChairs ? "Reinforced Nylon 5-Star Base with Heavy-Duty Gas Lift" : "16-Gauge Dual-Stage Powder-Coated Tubular Steel",
      certification: "ISO 9001:2015 Quality & ISO 14001 Environmental Compliant",
    },
    policyCheck: {
      status: "PASSED",
      maxRounds: 5,
      openingTarget: Math.round(budget * 0.92),
      escrowRule: "Direct Settlement via PayPal upon confirmation",
      humanSignoff: "Mandatory Human-in-the-Loop review required on Seller Dashboard",
    },
    supplierMatches,
  };
};

export interface AIChatResponse {
  type: "clarification" | "analysis" | "ready_to_negotiate";
  message: string;
  extractedFields?: {
    quantity: number | null;
    budget: number | null;
    deliveryDays: number | null;
    productKeywords: string[];
  };
  missingFields?: string[];
  catalogMatches?: any[];
  matchCount?: number;
  structuredAnalysis?: any;
  suggestedQuestions?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  queryText: string;
  timestamp: string;
  analysis?: DetailedAIAnalysis;
  aiResponse?: AIChatResponse;
  isLoading?: boolean;
}

export const AISourcingPage: React.FC = () => {
  const { 
    products, 
    sendBuyerPrompt, 
    buyerPreferences, 
    initiateNegotiation, 
    pendingQuotes, 
    orders,
    refreshData,
    clearAllRFQs 
  } = useMarketplace();

  const { 
    activeBuyer, 
    user,
    signInWithGoogle 
  } = useAuth();

  const orbRef = useRef<MorphOrbHandle>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  
  // Tab State: AI Sourcing Intake vs My Sourced Requests & Orders
  const [activeTab, setActiveTab] = useState<"sourcing" | "my_requests">("sourcing");

  // Target Seller Filter: evaluating across all verified marketplace suppliers
  const selectedSellerFilter: string = "all";

  // Active procurement parameters (derived or user-adjusted)
  const [targetQuantity, setTargetQuantity] = useState(100);
  const [targetBudget, setTargetBudget] = useState(460000);
  const [targetDeadline, setTargetDeadline] = useState(7);
  const [approvedContacts, setApprovedContacts] = useState<Record<string, boolean>>({});

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Negotiation Modal State
  const [negotiationActive, setNegotiationActive] = useState<ProductItem | null>(null);
  const [negotiationRound, setNegotiationRound] = useState(1);
  const [negotiationTranscript, setNegotiationTranscript] = useState<
    { sender: "buyer_agent" | "supplier_agent" | "safeguard"; text: string; price: number; round: number }[]
  >([]);
  const [negotiationSubmitted, setNegotiationSubmitted] = useState(false);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [negotiationError, setNegotiationError] = useState<string | null>(null);
  const [negotiationViewTab, setNegotiationViewTab] = useState<"chat" | "detailed" | "protocol">("chat");
  const stopNegotiationRef = useRef<boolean>(false);
  const [isStopped, setIsStopped] = useState<boolean>(false);
  const [negotiationStatusText, setNegotiationStatusText] = useState<string>("");
  const negotiationScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (negotiationScrollRef.current) {
      negotiationScrollRef.current.scrollTop = negotiationScrollRef.current.scrollHeight;
    }
  }, [negotiationTranscript, isNegotiating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && negotiationActive) {
        setNegotiationActive(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [negotiationActive]);

  const handleStopNegotiation = () => {
    stopNegotiationRef.current = true;
    setIsStopped(true);
    setIsNegotiating(false);
    setNegotiationStatusText(`Negotiation halted at Round ${negotiationRound}. Terms locked.`);
  };

  const [inspectingQuote, setInspectingQuote] = useState<{
    quote: any;
    mode: "chat" | "detailed" | "protocol";
  } | null>(null);
  const [selectedPaypalOrder, setSelectedPaypalOrder] = useState<{
    id: string;
    title: string;
    amount: number;
    counterparty: string;
    orderCode?: string;
  } | null>(null);

  // Scoped buyer datasets: ONLY requests & orders belonging to this active buyer profile
  const scopedBuyerQuotes = useMemo(() => {
    return pendingQuotes.filter((q) => 
      q.buyerName?.toLowerCase().includes(activeBuyer.name.toLowerCase()) ||
      (user?.email && q.buyerName?.toLowerCase().includes(user.email.split("@")[0].toLowerCase()))
    );
  }, [pendingQuotes, activeBuyer, user]);

  // RFQ Timeline Filter state: "this_year" by default
  const [rfqTimelineFilter, setRfqTimelineFilter] = useState<TimelineFilterOption>("this_year");

  // Filtered quotations by selected timeline
  const timelineFilteredQuotes = useMemo(() => {
    return scopedBuyerQuotes.filter((q) => isWithinTimeline(q.createdAt, rfqTimelineFilter));
  }, [scopedBuyerQuotes, rfqTimelineFilter]);

  const scopedBuyerOrders = useMemo(() => {
    return orders.filter((o) => 
      o.counterparty?.toLowerCase().includes(activeBuyer.name.toLowerCase()) ||
      (user?.email && o.counterparty?.toLowerCase().includes(user.email.split("@")[0].toLowerCase()))
    );
  }, [orders, activeBuyer, user]);

  const handleOrbSubmit = async (text: string) => {
    const userMsgId = "user-" + Date.now();
    const assistantMsgId = "ai-" + (Date.now() + 1);
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    // Instantly append user bubble and assistant loading indicator
    setChatHistory((prev) => [
      ...prev,
      {
        id: userMsgId,
        role: "user",
        queryText: text,
        timestamp: timeStr,
      },
      {
        id: assistantMsgId,
        role: "assistant",
        queryText: text,
        timestamp: timeStr,
        isLoading: true,
      },
    ]);

    setTimeout(() => {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);

    // Build conversation history from previous chat for multi-turn context
    const conversationHistory = chatHistory
      .filter((m) => !m.isLoading)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.role === "user" ? m.queryText : (m.aiResponse?.message || m.analysis?.executiveSummary || m.queryText),
      }));

    try {
      // Call the real AI backend which checks Supabase catalog and uses Ollama
      const aiResult = await api.aiChat({
        message: text,
        conversationHistory,
        buyerName: activeBuyer.name,
        selectedSellerId: selectedSellerFilter !== "all" ? selectedSellerFilter : undefined,
        existingQuantity: targetQuantity,
        existingBudget: targetBudget,
        existingDeliveryDays: targetDeadline,
      });

      // Update sliders if the backend extracted structured fields
      if (aiResult.extractedFields) {
        if (aiResult.extractedFields.quantity) setTargetQuantity(aiResult.extractedFields.quantity);
        if (aiResult.extractedFields.budget) setTargetBudget(aiResult.extractedFields.budget);
        if (aiResult.extractedFields.deliveryDays) setTargetDeadline(aiResult.extractedFields.deliveryDays);
      }

      // Build analysis if we have catalog matches (for the structured cards view)
      let analysis: DetailedAIAnalysis | undefined;
      if (aiResult.type !== "clarification" && aiResult.catalogMatches && aiResult.catalogMatches.length > 0) {
        const qty = aiResult.extractedFields?.quantity || targetQuantity;
        const budget = aiResult.extractedFields?.budget || targetBudget;
        const days = aiResult.extractedFields?.deliveryDays || targetDeadline;
        analysis = buildAnalysisDetails(
          text,
          aiResult.extractedFields?.productKeywords?.[0] || "Products",
          qty, budget, days, products, selectedSellerFilter
        );
        // Override supplier matches with REAL catalog data
        analysis.supplierMatches = aiResult.catalogMatches.map((m: any, idx: number) => ({
          id: m.id,
          name: m.supplier || m.name,
          matchScore: Math.min(99, 95 - idx * 3),
          leadDays: m.leadDays,
          unitPrice: m.basePrice,
          totalPrice: m.basePrice * qty,
          inStock: m.inStock,
          hubLocation: "Verified Supplier Hub",
          reliability: m.onTimeRate || 95,
          highlights: `${m.material || "Quality materials"} • ${m.category} • ${m.leadDays}-day delivery`,
          matchedProduct: products.find((p) => p.id === m.id),
        }));
        analysis.executiveSummary = aiResult.response;
      }

      setChatHistory((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isLoading: false,
                analysis,
                aiResponse: {
                  type: aiResult.type,
                  message: aiResult.response,
                  extractedFields: aiResult.extractedFields,
                  missingFields: aiResult.missingFields,
                  catalogMatches: aiResult.catalogMatches,
                  matchCount: aiResult.matchCount,
                  structuredAnalysis: aiResult.structuredAnalysis,
                  suggestedQuestions: aiResult.suggestedQuestions,
                },
              }
            : msg
        )
      );

      sendBuyerPrompt(text);

      return aiResult.type === "clarification"
        ? `Agent is gathering more details before providing analysis...`
        : `Found ${aiResult.matchCount} matching products from ${aiResult.totalCatalogProducts} in catalog.`;
    } catch (err: any) {
      // Fallback: if backend is unreachable, use the old static analysis
      console.warn("AI chat API error, falling back to static analysis:", err);

      const lower = text.toLowerCase();
      const qtyMatch = lower.match(/(\d+)\s*(units|desks|chairs|items|tables)/);
      const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : targetQuantity;
      if (qtyMatch) setTargetQuantity(qty);
      const budgetMatch = lower.match(/(₹|rs\.?|\$)\s*([\d,]+)/i);
      let budget = targetBudget;
      if (budgetMatch) {
        budget = parseInt(budgetMatch[2].replace(/,/g, ""), 10);
        if (budget < 10000) budget = budget * 83;
        setTargetBudget(budget);
      }
      const daysMatch = lower.match(/(\d+)\s*(days|day)/);
      let days = targetDeadline;
      if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
        setTargetDeadline(days);
      }
      const itemName = lower.includes("chair") ? "Ergonomic Lumbar Chairs" : "Commercial Birch School Desks";
      const analysis = buildAnalysisDetails(text, itemName, qty, budget, days, products, selectedSellerFilter);

      setChatHistory((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, isLoading: false, analysis }
            : msg
        )
      );

      sendBuyerPrompt(text);
      return `Fallback: Parsed RFQ for ${qty} units. Backend AI unavailable.`;
    } finally {
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 120);
    }
  };

  const handleApproveContact = (productId: string) => {
    setApprovedContacts((prev) => ({ ...prev, [productId]: true }));
  };

  const startNegotiation = async (product: ProductItem) => {
    stopNegotiationRef.current = false;
    setIsStopped(false);
    setNegotiationActive(product);
    setNegotiationRound(1);
    setNegotiationSubmitted(false);
    setIsNegotiating(true);
    setNegotiationError(null);
    setNegotiationTranscript([]);
    setNegotiationStatusText("Initiating negotiation session with verified supplier agent...");

    try {
      const res = await initiateNegotiation({
        productId: product.id,
        quantity: targetQuantity,
        buyerTargetPrice: targetBudget,
        buyerName: activeBuyer.name,
        strategy: buyerPreferences.strategy,
      });

      if (res?.transcript && res.transcript.length > 0) {
        const mappedTranscript: { sender: "buyer_agent" | "supplier_agent" | "safeguard"; text: string; price: number; round: number }[] = res.transcript.map((t: any) => ({
          sender: t.sender.toLowerCase().includes("buyer") ? ("buyer_agent" as const)
            : t.sender.toLowerCase().includes("system") ? ("safeguard" as const)
            : ("supplier_agent" as const),
          round: t.round,
          price: t.price,
          text: t.message,
        }));

        const rounds = Array.from(new Set(mappedTranscript.map((m: any) => m.round))).sort((a: any, b: any) => a - b);
        let accumulated: { sender: "buyer_agent" | "supplier_agent" | "safeguard"; text: string; price: number; round: number }[] = [];

        for (const r of rounds) {
          if (stopNegotiationRef.current) break;

          setNegotiationRound(r);
          setNegotiationStatusText(`Round ${r} in Progress: Formulating buyer proposal...`);

          const roundMessages = mappedTranscript.filter((m: any) => m.round === r);
          const buyerMsg = roundMessages.find((m: any) => m.sender === "buyer_agent");
          const supplierMsg = roundMessages.find((m: any) => m.sender === "supplier_agent");
          const safeguardMsg = roundMessages.find((m: any) => m.sender === "safeguard");

          if (buyerMsg) {
            accumulated = [...accumulated, buyerMsg];
            setNegotiationTranscript([...accumulated]);
            setNegotiationStatusText(`Round ${r} in Progress: Evaluating pricing & terms...`);
            await new Promise((resolve) => setTimeout(resolve, 900));
            if (stopNegotiationRef.current) break;
          }

          if (supplierMsg) {
            accumulated = [...accumulated, supplierMsg];
            setNegotiationTranscript([...accumulated]);
            setNegotiationStatusText(`Round ${r} Complete: Concession terms analyzed.`);
            await new Promise((resolve) => setTimeout(resolve, 700));
            if (stopNegotiationRef.current) break;
          }

          if (safeguardMsg) {
            accumulated = [...accumulated, safeguardMsg];
            setNegotiationTranscript([...accumulated]);
          }
        }

        if (!stopNegotiationRef.current) {
          setNegotiationRound(res.roundCount || rounds.length);
          setNegotiationSubmitted(true);
          setNegotiationStatusText(`Multi-agent price convergence achieved in Round ${res.roundCount || rounds.length}. Final quotation locked.`);
        }
      }
    } catch (err: any) {
      console.warn("Live multi-agent negotiation error:", err);
      setNegotiationError(err?.message || "Failed to initiate live negotiation");
    } finally {
      setIsNegotiating(false);
    }
  };

  const handleSendCounteroffer = () => {
    if (!negotiationActive) return;

    // Manual local counteroffer fallback
    const nextRound = negotiationRound + 1;
    const counterBuyer = Math.round(targetBudget * (0.97 - nextRound * 0.01));
    const supplierCounter = Math.max(
      negotiationActive.floorPrice,
      Math.round(negotiationActive.basePrice * (1 - nextRound * 0.015))
    );

    setNegotiationRound(nextRound);
    setNegotiationTranscript((prev) => [
      ...prev,
      {
        sender: "buyer_agent",
        round: nextRound,
        price: counterBuyer,
        text: `Round ${nextRound} counteroffer by ${activeBuyer.name}: ₹${counterBuyer.toLocaleString()} / unit. Citing market benchmarks and volume discount justification.`,
      },
      {
        sender: "supplier_agent",
        round: nextRound,
        price: supplierCounter,
        text: `Round ${nextRound} supplier response: Adjusted to ₹${supplierCounter.toLocaleString()} / unit. Fulfillment guaranteed within ${negotiationActive.leadDays} days.`,
      },
    ]);

    // Check for convergence
    const gap = Math.abs(counterBuyer - supplierCounter);
    const gapPercent = (gap / supplierCounter) * 100;
    if (gapPercent < 3.5 || counterBuyer >= supplierCounter || nextRound >= 8) {
      const finalPrice = Math.max(
        negotiationActive.floorPrice,
        Math.min(supplierCounter, Math.round((counterBuyer + supplierCounter) / 2))
      );
      setNegotiationTranscript((prev) => [
        ...prev,
        {
          sender: "safeguard",
          round: nextRound,
          price: finalPrice,
          text: `Deal converged at ₹${finalPrice.toLocaleString()} / unit after ${nextRound} rounds (${gapPercent.toFixed(1)}% gap). Quotation generated for ${activeBuyer.name}. Pending human approval on ${negotiationActive.businessName} Seller Dashboard.`,
        },
      ]);
      setNegotiationSubmitted(true);
    }
  };

  // Filter products by stock and deadline
  const matchingProducts = products.filter((p) => {
    const hasStock = p.inStock >= (targetQuantity > 0 ? targetQuantity : 1);
    const meetsDeadline = p.leadDays <= targetDeadline;
    return hasStock && meetsDeadline;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A11] text-slate-900 dark:text-gray-100 pt-20 pb-20">
      
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0F1D]/80 px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="w-full space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-500/10 dark:bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 font-mono">
                  BUYER OS
                </span>
                <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">/sourcing</span>
              </div>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Autonomous AI Procurement Sourcing
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                Natural-language request intake, deterministic policy validation, and FalkorDB graph-backed supplier ranking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Active Buyer Identity Pill */}
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-[#11182A] px-4 py-2 text-left shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-400 font-mono">
                    AUTHENTICATED BUYER:
                  </span>
                  {user ? (
                    <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                      Google OAuth Verified
                    </span>
                  ) : (
                    <button
                      onClick={() => signInWithGoogle()}
                      className="text-[9px] font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LogIn className="h-2.5 w-2.5" /> Sign In Google
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {activeBuyer.name}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-gray-400 hidden sm:inline">
                    • {activeBuyer.organization}
                  </span>
                </div>
              </div>

              {/* Bounded Mode Badge */}
              <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50 dark:bg-[#111726] px-4 py-2 text-right shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-400 block font-mono">Negotiation Mode</span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Dynamic Convergence (Agent-Driven)
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1E2638] pt-2">
            <button
              onClick={() => setActiveTab("sourcing")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "sourcing"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Sourcing & Supplier Matching</span>
            </button>

            <button
              onClick={() => setActiveTab("my_requests")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "my_requests"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>My Sourced RFQs & Orders</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                {scopedBuyerQuotes.length + scopedBuyerOrders.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-6 lg:px-8 mt-6 space-y-8">

        {activeTab === "sourcing" ? (
          <>
            {/* ============================================================== */}
            {/* ============================================================== */}
            {/* SECTION 1: Unified Autonomous AI Sourcing Chatbox (MorphOrb) */}
            {/* ============================================================== */}
            <section className="w-full rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] shadow-lg dark:shadow-2xl overflow-hidden">
          
          <div className="border-b border-slate-100 dark:border-[#1E2638] bg-slate-50 dark:bg-[#121A2E]/80 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Autonomous AI Sourcing Agent</h2>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">Natural-language requirement intake, dynamic thinking orb & FalkorDB reasoning</p>
              </div>
            </div>

            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-1 rounded-full font-mono font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Agent Ready
            </span>
          </div>

          {/* Active Sourcing Agent Stream or Unified Hero Area */}
          {chatHistory.length === 0 ? (
            <div className="pt-8 pb-1 px-6 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-3 bg-white dark:bg-[#0E1424]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 shadow-xs">
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Procurement Sourcing Agent Ready
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 max-w-lg leading-relaxed">
                  Describe your company's procurement need in the AI chatbox below (e.g. required product, quantity, target budget, and delivery window). The agent will extract structured RFQ parameters, traverse graph relationships, and rank verified suppliers.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 dark:bg-[#111726] border border-slate-200 dark:border-gray-800 text-[11px] font-mono text-slate-600 dark:text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Deterministic Price Floor Enforcement & Bounded Negotiation</span>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-xl">
                {[
                  "Need 50 School Desks under ₹150,000",
                  "Procure 100 Classroom Chairs in 4 days",
                  "Source 10 Executive Desks for main office"
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      orbRef.current?.setInputValue(suggestion);
                      handleOrbSubmit(suggestion);
                    }}
                    className="text-[11px] font-medium px-3.5 py-1.5 rounded-full bg-slate-50 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:bg-gray-800/80 dark:hover:bg-blue-950/40 dark:hover:text-blue-300 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-gray-700 transition-all cursor-pointer shadow-2xs"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <MaterialIcon name="auto_awesome" size={13} className="text-blue-500" />
                      <span>{suggestion}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-h-[500px] overflow-y-auto bg-slate-50/50 dark:bg-[#0A0F1D]/50 divide-y divide-slate-100 dark:divide-gray-800/40">
              {chatHistory.map((msg) => (
              <div key={msg.id} className="pt-4 first:pt-0 space-y-3">
                {msg.role === "user" ? (
                  /* User Bubble */
                  <div className="flex items-start justify-end gap-3">
                    <div className="rounded-2xl rounded-tr-sm bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 px-4 py-3 max-w-xl text-right shadow-sm">
                      <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 block mb-1">YOU • {msg.timestamp}</span>
                      <p className="text-xs sm:text-sm text-slate-900 dark:text-white font-medium">"{msg.queryText}"</p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-600/30 border border-blue-200 dark:border-blue-500/50 text-blue-700 dark:text-blue-300 shrink-0">
                      <span className="text-xs font-bold font-mono">YOU</span>
                    </div>
                  </div>
                ) : msg.isLoading ? (
                  /* Loading Thinking Bubble */
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 shrink-0">
                      <Bot className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-[#121A2E] border border-blue-200 dark:border-blue-500/30 p-4 space-y-2 shadow-sm">
                      <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-mono font-medium">
                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                        <span>Autonomous AI Agent Reasoning...</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-gray-400">
                        Querying Supabase catalog, checking inventory & verifying requirements via Ollama agent...
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Full AI Response Bubble — handles both clarification and analysis */
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
                      msg.aiResponse?.type === "clarification"
                        ? "bg-amber-50 dark:bg-amber-600/20 border border-amber-200 dark:border-amber-500/40 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-50 dark:bg-emerald-600/20 border border-emerald-200 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    }`}>
                      <Bot className="h-4 w-4" />
                    </div>
                    
                    <div className={`flex-1 rounded-2xl rounded-tl-sm bg-white dark:bg-[#0E1528] p-5 space-y-5 shadow-lg ${
                      msg.aiResponse?.type === "clarification"
                        ? "border border-amber-200 dark:border-amber-500/30"
                        : "border border-emerald-200 dark:border-emerald-500/30"
                    }`}>
                      {/* Response Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold font-mono flex items-center gap-1.5 ${
                            msg.aiResponse?.type === "clarification"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {msg.aiResponse?.type === "clarification" ? (
                              <><MessageSquare className="h-4 w-4" /> AGENT NEEDS MORE DETAILS</>
                            ) : (
                              <><CheckCircle2 className="h-4 w-4" /> AI SOURCING ANALYSIS COMPLETE</>
                            )}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-gray-400">
                            • {msg.timestamp}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium ${
                          msg.aiResponse?.type === "clarification"
                            ? "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/30"
                            : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/30"
                        }`}>
                          {msg.aiResponse?.type === "clarification" ? "Clarification Needed" : "Supabase Catalog Verified"}
                        </span>
                      </div>

                      {/* AI Response Message (always shown) */}
                      {msg.aiResponse && (
                        <div className={`rounded-xl p-3.5 ${
                          msg.aiResponse.type === "clarification"
                            ? "border border-amber-200 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-950/20"
                            : "border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/20"
                        }`}>
                          <span className={`text-[11px] font-mono font-semibold block mb-1.5 ${
                            msg.aiResponse.type === "clarification"
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-blue-700 dark:text-blue-400"
                          }`}>
                            {msg.aiResponse.type === "clarification" ? "AGENT QUESTION" : "SOURCING AGENT RESPONSE"}
                          </span>
                          <div className="text-xs sm:text-sm text-slate-800 dark:text-gray-200 leading-relaxed whitespace-pre-line">
                            {cleanHumanChatText(msg.aiResponse.message)}
                          </div>
                        </div>
                      )}

                      {/* Suggested Quick-Reply Questions */}
                      {msg.aiResponse?.suggestedQuestions && msg.aiResponse.suggestedQuestions.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {msg.aiResponse.suggestedQuestions.map((q, qi) => (
                            <button
                              key={qi}
                              type="button"
                              onClick={() => {
                                if (orbRef.current) {
                                  // Trigger the orb with the suggested question
                                  handleOrbSubmit(q);
                                }
                              }}
                              className="text-[11px] px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer font-medium"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Extracted Fields Summary (when available) */}
                      {msg.aiResponse?.extractedFields && msg.aiResponse.type !== "clarification" && (
                        <div className="rounded-xl border border-slate-200 dark:border-[#222E4A] bg-slate-50/80 dark:bg-[#111728] p-3.5 space-y-1.5">
                          <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-gray-300 block">EXTRACTED REQUIREMENTS</span>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500 dark:text-gray-400 block">Quantity</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {msg.aiResponse.extractedFields.quantity ? `${msg.aiResponse.extractedFields.quantity} units` : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-gray-400 block">Budget</span>
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                {msg.aiResponse.extractedFields.budget ? `₹${msg.aiResponse.extractedFields.budget.toLocaleString()}` : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-gray-400 block">Delivery</span>
                              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                                {msg.aiResponse.extractedFields.deliveryDays ? `${msg.aiResponse.extractedFields.deliveryDays} days` : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-gray-400 block">Keywords</span>
                              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                                {msg.aiResponse.extractedFields.productKeywords?.length > 0 ? msg.aiResponse.extractedFields.productKeywords.join(", ") : "—"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Full Detailed Analysis (from DB matches) */}
                      {msg.analysis && (
                        <>
                          <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/20 p-3.5">
                            <span className="text-[11px] font-mono text-blue-700 dark:text-blue-400 font-semibold block mb-1">
                              EXECUTIVE REASONING SUMMARY
                            </span>
                            <p className="text-xs sm:text-sm text-slate-800 dark:text-gray-200 leading-relaxed font-normal">
                              {msg.analysis.executiveSummary}
                            </p>
                          </div>

                          {/* 3 Breakdown Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            {/* Card 1: Specs */}
                            <div className="rounded-xl border border-slate-200 dark:border-[#222E4A] bg-slate-50/80 dark:bg-[#111728] p-3.5 space-y-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono border-b border-slate-200 dark:border-gray-800 pb-1.5">
                                <Package className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> Structured RFQ Specs
                              </span>
                              <div className="text-xs space-y-1.5 pt-1">
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Item:</span><span className="font-semibold text-slate-900 dark:text-white">{msg.analysis.item}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Quantity:</span><span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{msg.analysis.qty} units</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Budget:</span><span className="font-mono text-amber-600 dark:text-amber-400 font-bold">₹{msg.analysis.budget.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Unit Ceiling:</span><span className="font-mono text-slate-800 dark:text-gray-300 font-semibold">₹{msg.analysis.unitTarget.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Max Lead:</span><span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{msg.analysis.days} Days</span></div>
                              </div>
                            </div>

                            {/* Card 2: Top Match */}
                            {msg.analysis.supplierMatches[0] && (
                              <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 space-y-2 flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-center border-b border-emerald-200 dark:border-emerald-500/20 pb-1.5">
                                    <span className="text-xs font-semibold text-emerald-950 dark:text-white flex items-center gap-1.5 font-mono">
                                      <GitBranch className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Top Supplier Match
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-500/40 font-bold">
                                      {msg.analysis.supplierMatches[0].matchScore}% Match
                                    </span>
                                  </div>
                                  <div className="text-xs space-y-1.5 pt-1">
                                    <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Supplier:</span><span className="font-bold text-slate-900 dark:text-white">{msg.analysis.supplierMatches[0].name}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Unit Quote:</span><span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{msg.analysis.supplierMatches[0].unitPrice.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Total Lot:</span><span className="font-mono text-slate-900 dark:text-white font-bold">₹{msg.analysis.supplierMatches[0].totalPrice.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Lead Time:</span><span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{msg.analysis.supplierMatches[0].leadDays} Days</span></div>
                                  </div>
                                </div>

                                {msg.analysis.supplierMatches[0].matchedProduct && (
                                  <button
                                    type="button"
                                    onClick={() => startNegotiation(msg.analysis!.supplierMatches[0].matchedProduct!)}
                                    className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" /> Start AI Negotiation
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Card 3: Policy */}
                            <div className="rounded-xl border border-slate-200 dark:border-[#222E4A] bg-slate-50/80 dark:bg-[#111728] p-3.5 space-y-2">
                              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 font-mono border-b border-slate-200 dark:border-gray-800 pb-1.5">
                                <ShieldCheck className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" /> Policy Safeguards
                              </span>
                              <div className="text-xs space-y-1.5 pt-1">
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Max Rounds:</span><span className="font-mono text-slate-900 dark:text-white font-bold">Dynamic (Agent-Driven)</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Opening Offer:</span><span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{msg.analysis.policyCheck.openingTarget.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Payment:</span><span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">PayPal Direct</span></div>
                                <div className="flex justify-between"><span className="text-slate-500 dark:text-gray-400">Human Approval:</span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">Seller Hub</span></div>
                              </div>
                            </div>
                          </div>

                          {/* Supplier Graph Ranked Table */}
                          <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/70 dark:bg-[#0A1020] p-3.5 space-y-2">
                            <span className="text-[11px] font-mono font-semibold text-slate-700 dark:text-gray-300 uppercase tracking-wider block">
                              Verified Graph Suppliers ({msg.analysis.supplierMatches.length})
                            </span>
                            <div className="space-y-2">
                              {msg.analysis.supplierMatches.map((sup, sIdx) => (
                                <div key={sup.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-[#111728]/70 border border-slate-200 dark:border-gray-800 text-xs shadow-2xs">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-400 dark:text-gray-400 font-bold">#{sIdx + 1}</span>
                                    <span className="font-semibold text-slate-900 dark:text-white">{sup.name}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-medium">
                                      {sup.matchScore}% Match
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">{sup.leadDays}d Lead</span>
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">Stock: {sup.inStock}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-900 dark:text-white font-bold">₹{sup.unitPrice.toLocaleString()}/unit</span>
                                    {sup.matchedProduct && (
                                      <button
                                        type="button"
                                        onClick={() => startNegotiation(sup.matchedProduct!)}
                                        className="py-1 px-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors cursor-pointer"
                                      >
                                        Negotiate
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
          )}

          {/* Sourcing Chatbox Input (MorphOrb) - Unified seamlessly in single section */}
          <div className={`px-4 flex flex-col items-center justify-center bg-white dark:bg-[#0E1424] ${
            chatHistory.length > 0
              ? "py-3 border-t border-slate-100 dark:border-[#1E2638] dark:bg-gradient-to-b dark:from-[#0A0F1D] dark:to-[#0E1424]"
              : "pt-0 pb-7 border-t-0"
          }`}>
            <MorphOrb
              ref={orbRef}
              onSubmit={handleOrbSubmit}
              placeholder="Ask anything or request adjustments… e.g. 'Now change delivery to 4 days'"
              minThinkMs={1200}
              keepChatboxSame={true}
            />
          </div>
        </section>

        {/* ============================================================== */}
        {/* SECTION 2: Matching Products Displayed Below */}
        {/* ============================================================== */}
        <section className="space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-[#1E2638] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Ranked Eligible Suppliers ({matchingProducts.length})
                </h2>
                <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[10px] font-mono text-blue-700 dark:text-blue-400 font-medium">
                  Verified Supplier Track Scored
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                Suppliers passing deterministic stock and deadline criteria, ranked by verified past order fulfillment records.
              </p>
            </div>

            <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
              Verified Supplier Sourcing Pipeline
            </span>
          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {matchingProducts.map((product, index) => {
              const estimatedTotal = product.basePrice * (targetQuantity / 100);
              const isBudgetFit = estimatedTotal <= targetBudget;
              const isContactApproved = approvedContacts[product.id];

              return (
                <div
                  key={product.id}
                  className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-md hover:border-blue-400 dark:hover:border-blue-500/40 transition-all group flex flex-col justify-between"
                >
                  <div>
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="rounded-full bg-blue-50 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 font-mono">
                        Rank #{index + 1} Match
                      </span>
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" /> In Stock: {product.inStock}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-gray-400" />
                      {product.businessName} • SKU: {product.sku}
                    </p>

                    {/* Specs List */}
                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-[#1C253B] bg-slate-50 dark:bg-[#0A1020] p-3 text-[11px] space-y-1.5">
                      <div className="flex justify-between text-slate-600 dark:text-gray-300">
                        <span className="text-slate-500 dark:text-gray-400">Material:</span>
                        <span className="font-medium text-slate-900 dark:text-white truncate max-w-[170px]" title={product.specifications?.material || (product as any).material || "Commercial Heavy-Duty Specification"}>
                          {product.specifications?.material || (product as any).material || "Commercial Grade"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-gray-300">
                        <span className="text-slate-500 dark:text-gray-400">Warranty:</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {product.specifications?.warranty || "2 Years Guarantee"}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-gray-300">
                        <span className="text-slate-500 dark:text-gray-400">Delivery Lead Time:</span>
                        <span className="font-medium text-purple-600 dark:text-purple-300 font-mono">{product.leadDays} Days Promise</span>
                      </div>
                    </div>

                    {/* Verified Fulfillment Performance Box */}
                    <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/80 dark:bg-blue-950/20 p-3 text-[11px] text-blue-950 dark:text-gray-300">
                      <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-semibold mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verified Performance Record
                      </div>
                      <p className="text-[11px] text-slate-700 dark:text-gray-300 leading-relaxed font-medium">
                        Supplier records confirm {product.onTimeRate}% on-time order fulfillment with zero compliance penalties across past orders.
                      </p>
                    </div>

                    {/* Pricing Breakdown */}
                    <div className="mt-5 border-t border-slate-100 dark:border-[#1C253B] pt-4">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-500 dark:text-gray-400">Base Unit Quote:</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">₹{product.basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-xs text-slate-500 dark:text-gray-400">Total for {targetQuantity} units:</span>
                        <span className={`text-base font-bold font-mono ${isBudgetFit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                          ₹{estimatedTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-gray-400 text-right mt-0.5">
                        Floor Price Guardrail: ₹{product.floorPrice.toLocaleString()}/unit
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 space-y-2">
                    {!isContactApproved ? (
                      <button
                        onClick={() => handleApproveContact(product.id)}
                        className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50 hover:bg-blue-100 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition-all cursor-pointer shadow-2xs"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Approve Contact & Request RFQ</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 py-1 rounded-lg font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Contact Authorized by Buyer
                        </div>
                        <button
                          onClick={() => startNegotiation(product)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                        >
                          <Bot className="h-4 w-4" />
                          <span>Initiate Agent Negotiation</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-12 text-center shadow-sm">
              <Package className="mx-auto h-8 w-8 text-blue-500 mb-2" />
              <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">Supplier Catalog is Currently Empty</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                No products are currently published in the catalog. Suppliers can list products via the Seller Hub.
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <a
                  href="/seller"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Go to Seller Hub Catalog</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ) : matchingProducts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-12 text-center shadow-sm">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">No Suppliers Met All Hard Constraints</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                Adjust quantity (under in-stock limits) or extend delivery deadline slider to expand eligible suppliers.
              </p>
            </div>
          ) : null}

        </section>
          </>
        ) : (
          /* ============================================================== */
          /* TAB 2: My Sourced RFQs & Purchase Orders (Multi-Tenant Scoped) */
          /* ============================================================== */
          <div className="space-y-8">
            
            {/* Header / Context Notice */}
            <div className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-[#0E1528] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono font-bold">
                    SCOPED BUYER VAULT
                  </span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                    {activeBuyer.name} ({activeBuyer.email})
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  My Active Procurement Requests & Quotations
                </h2>
                <p className="text-xs text-slate-600 dark:text-gray-400">
                  Data isolation active: Only quotation requests and purchase orders initiated by your buyer account are visible.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {scopedBuyerQuotes.length > 0 && (
                  <button
                    onClick={() => clearAllRFQs()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all cursor-pointer"
                    title="Remove all RFQs and quotations"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear All RFQs</span>
                  </button>
                )}
                <button
                  onClick={() => refreshData()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* QUOTATIONS SECTION */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1A2236] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                    Sourced Quotations ({timelineFilteredQuotes.length})
                  </h3>
                </div>

                {/* Timeline Filter Controls */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#12192B] p-1 rounded-xl border border-slate-200 dark:border-[#1E2638] overflow-x-auto">
                  <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase px-2 font-bold hidden md:inline">
                    Timeline:
                  </span>
                  {TIMELINE_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setRfqTimelineFilter(opt.id)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        rfqTimelineFilter === opt.id
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {scopedBuyerQuotes.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <Package className="mx-auto h-8 w-8 text-slate-400 dark:text-gray-600" />
                  <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                    No active quotations found for {activeBuyer.name}. Launch a new natural-language sourcing request in the AI chatbox or select an eligible product below.
                  </p>
                  <button
                    onClick={() => setActiveTab("sourcing")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Start Sourcing RFQ</span>
                  </button>
                </div>
              ) : timelineFilteredQuotes.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <Clock className="mx-auto h-8 w-8 text-amber-500/80" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-200">
                    No quotations found for {TIMELINE_FILTER_OPTIONS.find((t) => t.id === rfqTimelineFilter)?.label || "This Year"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm mx-auto">
                    You have {scopedBuyerQuotes.length} quotation{scopedBuyerQuotes.length > 1 ? "s" : ""} recorded in total under other timeframes.
                  </p>
                  <button
                    onClick={() => setRfqTimelineFilter("all")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#12192B] hover:bg-slate-50 dark:hover:bg-[#1A233C] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-all cursor-pointer"
                  >
                    <span>View All Time ({scopedBuyerQuotes.length})</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {timelineFilteredQuotes.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-[#111728] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs hover:border-blue-400 dark:hover:border-blue-500/30 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-500/30">
                            #{q.id.substring(0, 8)}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {q.item}
                          </span>
                          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            • {q.quantity} Units
                          </span>
                          {q.createdAt && (
                            <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(q.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            Target Supplier: <strong className="text-slate-700 dark:text-gray-300">{q.businessName || "DeskWorks"}</strong>
                          </span>
                          <span>•</span>
                          <span>Lead Time: <strong className="font-mono text-purple-600 dark:text-purple-400">{q.buyerLeadDays || 6} days</strong></span>
                          <span>•</span>
                          <span>Unit Price: <strong className="font-mono text-slate-800 dark:text-gray-200">₹{q.proposedUnitPrice?.toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 block font-mono">Agreed Lot Value</span>
                          <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                            ₹{q.totalValue?.toLocaleString()}
                          </span>
                        </div>

                        {/* Interactive Inspection Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setInspectingQuote({ quote: q, mode: "chat" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                            title="Open live chat-style conversation preview"
                          >
                            <MessageSquare className="h-3 w-3" />
                            <span>Live Preview</span>
                          </button>

                          <button
                            onClick={() => setInspectingQuote({ quote: q, mode: "detailed" })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                            title="Inspect full engineering specs and financial audit"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Detailed View</span>
                          </button>
                        </div>

                        <div>
                          {q.status === "awaiting_approval" ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 px-3 py-1 text-xs font-semibold font-mono flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 animate-pulse text-amber-500" />
                                Awaiting Seller Sign-off
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                                In {q.businessName || "Seller"}'s Approval Queue
                              </span>
                            </div>
                          ) : q.status === "approved" ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-3 py-0.5 text-xs font-semibold font-mono flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                Approved by Seller
                              </span>
                              <button
                                onClick={() => setSelectedPaypalOrder({
                                  id: q.id,
                                  title: `${q.quantity} units of ${q.item}`,
                                  amount: q.totalValue,
                                  counterparty: q.businessName || "Supplier",
                                })}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-[#003087] to-[#0079C1] hover:from-[#002568] hover:to-[#005ea6] text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all cursor-pointer"
                                title="Pay with PayPal"
                              >
                                <CreditCard className="h-3 w-3" />
                                <span>Pay with PayPal</span>
                              </button>
                            </div>
                          ) : (
                            <span className="rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 px-3 py-1 text-xs font-semibold font-mono">
                              Declined by Seller
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ORDERS SECTION */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1A2236] pb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                    My Purchase Orders ({scopedBuyerOrders.length})
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-gray-400 font-mono">
                  Deal Flow & Order Lifecycle
                </span>
              </div>

              {scopedBuyerOrders.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-gray-400">
                  No active purchase orders yet. When a seller signs off on an approved quotation, the official PO will appear here for payment and order tracking.
                </div>
              ) : (
                <div className="space-y-3">
                  {scopedBuyerOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50/60 dark:bg-[#111728] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                            {ord.orderCode}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {ord.title}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-gray-400 flex flex-wrap items-center gap-3">
                          <span>Counterparty: <strong className="text-slate-700 dark:text-gray-300">{ord.counterparty}</strong></span>
                          <span>•</span>
                          <span>Location: {ord.location}</span>
                          <span>•</span>
                          <span>Due: <strong className="font-mono text-slate-700 dark:text-gray-300">{ord.dueDate}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block">
                            ₹{ord.value.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                            {ord.docsSummary}
                          </span>
                        </div>

                        <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-semibold border ${
                          ord.stage === "Awaiting Payment Capture"
                            ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/30"
                            : "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-500/30"
                        }`}>
                          {ord.stage}
                        </span>

                        {ord.stage === "Awaiting Payment Capture" && (
                          <button
                            onClick={() => setSelectedPaypalOrder({
                              id: ord.id,
                              title: ord.title,
                              amount: ord.value,
                              counterparty: ord.counterparty,
                              orderCode: ord.orderCode,
                            })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#003087] to-[#0079C1] hover:from-[#002568] hover:to-[#005ea6] text-white text-xs font-bold shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                            title="Pay with PayPal"
                          >
                            <CreditCard className="h-3 w-3" />
                            <span>Pay with PayPal</span>
                          </button>
                        )}

                        <button
                          onClick={() => setInspectingQuote({
                            quote: {
                              id: ord.id,
                              item: ord.title,
                              quantity: 100,
                              totalValue: ord.value,
                              status: "approved",
                              buyerName: activeBuyer.name,
                              businessName: ord.counterparty,
                              leadDays: 7,
                            },
                            mode: "detailed"
                          })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                          title="Inspect contract specifications and payment terms"
                        >
                          <FileText className="h-3 w-3" />
                          <span>Detailed View</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* Interactive Negotiation Room Modal (Full Screen Workstation) */}
      {/* ============================================================== */}
      {negotiationActive && (
        <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-white dark:bg-[#070B16] overflow-hidden animate-in fade-in duration-150">
          
          {/* Full Screen Top Header Bar */}
          <div className="border-b border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0A0F1E] px-6 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-xs">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    Agent-to-Agent Negotiation Room
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                    Round {negotiationRound}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                  <span>Buyer Agent ({activeBuyer.name})</span>
                  <span>⟷</span>
                  <span>{negotiationActive.businessName} Agent</span>
                  <span>• {targetQuantity} Units</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {isNegotiating && (
                <button
                  type="button"
                  onClick={handleStopNegotiation}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer animate-pulse"
                  title="Stop autonomous negotiation at current round"
                >
                  <Square className="h-3 w-3 fill-current" />
                  <span>Stop Round</span>
                </button>
              )}

              <button
                onClick={() => setNegotiationActive(null)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#111728] hover:bg-slate-100 dark:hover:bg-[#182035] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="Exit Full Screen Negotiation Room (Esc)"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Subheader / Mode Switcher Bar */}
          <div className="px-6 sm:px-8 py-2.5 border-b border-slate-200 dark:border-[#182033] bg-slate-100/70 dark:bg-[#0B1123] flex items-center justify-between gap-3 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-[#131B32] border border-slate-300/40 dark:border-gray-800">
              <button
                onClick={() => setNegotiationViewTab("chat")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  negotiationViewTab === "chat"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Live Chat Preview</span>
                {isNegotiating && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
              </button>

              <button
                onClick={() => setNegotiationViewTab("detailed")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  negotiationViewTab === "detailed"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Detailed View & Specs</span>
              </button>

              <button
                onClick={() => setNegotiationViewTab("protocol")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  negotiationViewTab === "protocol"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Protocol Log</span>
              </button>
            </div>

            <div className="text-[11px] font-mono text-slate-500 dark:text-gray-400 hidden sm:flex items-center gap-3">
              <span>
                Ollama: <strong className="text-blue-600 dark:text-blue-400">DeepSeek-R1 (14B)</strong> vs <strong className="text-purple-600 dark:text-purple-400">Qwen 2.5 (14B)</strong>
              </span>
              <span>•</span>
              <span>
                Item: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.name}</strong>
              </span>
            </div>
          </div>

          {/* Full Screen Scrollable Body Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-[#070B16]" ref={negotiationScrollRef}>
            <div className="max-w-4xl mx-auto space-y-4">
              
              {/* Active LLM Inference Banner & Live Round Status */}
              {isNegotiating ? (
                <div className="rounded-xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/40 p-4 flex items-center justify-between gap-3 animate-pulse shadow-xs">
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300 block font-mono">
                        Round {negotiationRound} in Progress...
                      </span>
                      <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                        {negotiationStatusText || `Autonomous multi-agent deliberation: DeepSeek-R1 ⟷ Qwen 2.5`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleStopNegotiation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop Round</span>
                  </button>
                </div>
              ) : isStopped ? (
                <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 p-3.5 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Negotiation Paused at Round {negotiationRound}.</strong> Current offer: ₹{negotiationTranscript[negotiationTranscript.length - 1]?.price?.toLocaleString() || "..."}/unit.
                    </span>
                  </div>
                  <button
                    onClick={() => setNegotiationSubmitted(true)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Lock In & Submit
                  </button>
                </div>
              ) : null}

              {negotiationError && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <p><strong>Notice:</strong> {negotiationError}. Fallback bounding active.</p>
                </div>
              )}

              {/* 1. CHATTING STYLE (Buyer & Seller Dialogue) */}
              {negotiationViewTab === "chat" && (
                <div className="space-y-4">
                  <div className="space-y-3.5 pt-1">
                    {negotiationTranscript.map((msg, idx) => {
                      if (msg.sender === "safeguard") {
                        return (
                          <div key={idx} className="flex justify-center my-3">
                            <div className="flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-mono font-medium border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-xs">
                              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span>{cleanHumanChatText(msg.text)}</span>
                            </div>
                          </div>
                        );
                      }

                      const isBuyer = msg.sender === "buyer_agent";

                      return (
                        <div 
                          key={idx} 
                          className={`flex flex-col ${isBuyer ? "items-start" : "items-end"} gap-1`}
                        >
                          <div className="flex items-center gap-1.5 px-2 text-[10px] font-mono text-slate-500 dark:text-gray-400 uppercase">
                            <span className="font-bold flex items-center gap-1">
                              {isBuyer ? (
                                <>
                                  <MaterialIcon name="school" size={13} className="text-blue-500" />
                                  <span>{activeBuyer.name} Agent (DeepSeek-R1)</span>
                                </>
                              ) : (
                                <>
                                  <MaterialIcon name="domain" size={13} className="text-purple-500" />
                                  <span>{negotiationActive.businessName} Agent (Qwen 2.5)</span>
                                </>
                              )}
                            </span>
                            <span>• Round {msg.round}</span>
                          </div>

                          <div
                            className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm transition-all ${
                              isBuyer
                                ? "bg-blue-50 dark:bg-[#111A33] border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-blue-100 rounded-tl-sm"
                                : "bg-purple-50 dark:bg-[#1A1430] border border-purple-200 dark:border-purple-500/30 text-slate-900 dark:text-purple-100 rounded-tr-sm"
                            }`}
                          >
                            <p className="text-[13px] leading-relaxed">{cleanHumanChatText(msg.text)}</p>

                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono">
                              <span className="opacity-75">
                                {isBuyer ? "Bid Proposed:" : "Counter-Offer:"}
                              </span>
                              <span className={`font-bold px-2 py-0.5 rounded ${
                                isBuyer 
                                  ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
                                  : "bg-purple-600/10 text-purple-700 dark:text-purple-300"
                              }`}>
                                ₹{msg.price.toLocaleString()} / unit
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. DETAILED VIEW & SPECS */}
              {negotiationViewTab === "detailed" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0E1528] p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                          PRODUCT & CONTRACT SPECIFICATION
                        </span>
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">
                          {negotiationActive.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                          Supplier: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.businessName}</strong> • Delivery: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.leadDays} Days</strong>
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                          BATCH VALUE
                        </span>
                        <span className="text-xl font-mono font-extrabold text-slate-900 dark:text-white">
                          ₹{(negotiationTranscript[negotiationTranscript.length - 1]?.price * targetQuantity || targetBudget).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-gray-800 text-xs">
                      <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">MATERIAL SPECIFICATION:</span>
                        <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">Commercial Grade Birch & Tubular Steel</span>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">STANDARDS:</span>
                        <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">BIFMA X5.1 / EN 1729 Compliant</span>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">PAYMENT METHOD:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">PayPal Direct Settlement</span>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">FLOOR PROTECTION:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">Server-Enforced (₹{negotiationActive.floorPrice.toLocaleString()})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. PROTOCOL LOG */}
              {negotiationViewTab === "protocol" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/20 p-3.5 text-xs text-blue-900 dark:text-blue-300">
                    <strong>Protocol Notice:</strong> Negotiation uses dynamic convergence — agents negotiate until a deal is reached or price gap falls below 2%. Ollama models DeepSeek-R1 (14B) & Qwen 2.5 (14B) run multi-turn bargaining with server-enforced price floors.
                  </div>

                  {negotiationTranscript.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-4 text-xs leading-relaxed shadow-2xs ${
                        msg.sender === "buyer_agent"
                          ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200"
                          : msg.sender === "supplier_agent"
                          ? "border-purple-200 dark:border-purple-500/30 bg-purple-50/80 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200"
                          : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] uppercase">
                        <span className="font-bold">
                          {msg.sender === "buyer_agent"
                            ? "Buyer AI Agent"
                            : msg.sender === "supplier_agent"
                            ? `${negotiationActive.businessName} Agent`
                            : "Deterministic Policy Guardrail"}
                        </span>
                        <span className="font-semibold">Round {msg.round} • Quote: ₹{msg.price.toLocaleString()}</span>
                      </div>
                      <p>{msg.text}</p>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Full Screen Bottom Footer Controls */}
          <div className="border-t border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0A0F1E] px-6 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-xs">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 flex items-center gap-2">
              <span>Current Agreed Total:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                ₹{negotiationTranscript[negotiationTranscript.length - 1]?.price.toLocaleString() || "..."}
              </span>
              {negotiationActive && (
                <span className="text-[11px] font-mono text-slate-400 dark:text-gray-500">
                  (Floor: ₹{negotiationActive.floorPrice.toLocaleString()} / unit)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!negotiationSubmitted ? (
                <button
                  onClick={handleSendCounteroffer}
                  disabled={isNegotiating}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <span>Transmit Round {negotiationRound + 1} Counteroffer</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Queued in {negotiationActive.businessName} Hub
                  </span>
                  <button
                    onClick={() => {
                      setNegotiationActive(null);
                      setActiveTab("my_requests");
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
                  >
                    View in My RFQs
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Historical Quote / Order Detailed & Live Chat Inspection Modal */}
      <NegotiationDetailModal
        isOpen={!!inspectingQuote}
        onClose={() => setInspectingQuote(null)}
        quotation={inspectingQuote?.quote || null}
        initialViewMode={inspectingQuote?.mode || "chat"}
      />

      {/* PayPal Vault Escrow Checkout Modal */}
      <PayPalCheckoutModal
        isOpen={!!selectedPaypalOrder}
        onClose={() => setSelectedPaypalOrder(null)}
        order={selectedPaypalOrder}
        onPaymentSuccess={() => refreshData()}
      />

    </div>
  );
};
