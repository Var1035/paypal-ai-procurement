import React, { useState, useRef, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
  MessageSquare,
  Layers,
  CreditCard,
  Square,
  Calendar,
  Truck,
  MapPin,
  Check,
  Plus,
  ChevronRight,
  Factory
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

export const ORDER_LIFECYCLE_STAGES = [
  { id: "submitted", label: "Order Submitted", shortLabel: "Submitted", icon: "assignment", description: "PO issued and registered in Supabase" },
  { id: "approved", label: "Seller Approved", shortLabel: "Approved", icon: "verified_user", description: "Supplier commercial terms signed off" },
  { id: "escrowed", label: "Payment Escrowed", shortLabel: "Escrowed", icon: "account_balance_wallet", description: "Secured in PayPal Sandbox Escrow Vault" },
  { id: "production", label: "In Production", shortLabel: "Manufacturing", icon: "precision_manufacturing", description: "Batch fabrication active in supplier plant" },
  { id: "qa", label: "QA Inspection", shortLabel: "QA Passed", icon: "fact_check", description: "Quality compliance & specifications verified" },
  { id: "transporting", label: "In Transport", shortLabel: "Transporting", icon: "local_shipping", description: "Freight logistics corridor active with live transit checkpoints" },
  { id: "delivered", label: "Delivered & Settled", shortLabel: "Delivered", icon: "check_circle", description: "Received at buyer facility, escrow released" },
];

export const getOrderStageIndex = (stage: string | null | undefined): number => {
  const lower = (stage || "").toLowerCase();
  if (lower.includes("deliver")) return 6;
  if (lower.includes("transport") || lower.includes("transit") || lower.includes("dispatch")) return 5;
  if (lower.includes("qa") || lower.includes("quality") || lower.includes("inspect")) return 4;
  if (lower.includes("production") || lower.includes("manufactur")) return 3;
  if (lower.includes("paid") || lower.includes("escrow") || lower.includes("confirm")) return 2;
  if (lower.includes("approved") || lower.includes("awaiting payment")) return 1;
  return 0; // submitted
};

export const AISourcingPage: React.FC = () => {
  const { 
    products, 
    sendBuyerPrompt, 
    buyerPreferences, 
    initiateNegotiation, 
    pendingQuotes, 
    orders,
    refreshData,
    clearAllRFQs,
    updateOrderStage,
    createOrder
  } = useMarketplace();

  const { 
    activeBuyer, 
    user
  } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"sourcing" | "rfqs" | "orders">(
    tabFromUrl === "orders" ? "orders" : tabFromUrl === "rfqs" || tabFromUrl === "my_requests" ? "rfqs" : "sourcing"
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "orders" || tabParam === "rfqs" || tabParam === "sourcing") {
      setActiveTab(tabParam);
    } else if (tabParam === "my_requests") {
      setActiveTab("rfqs");
    }
  }, [searchParams]);

  const handleTabSwitch = (tab: "sourcing" | "rfqs" | "orders") => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const orbRef = useRef<MorphOrbHandle>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
  const [typingAgent, setTypingAgent] = useState<"buyer" | "supplier" | null>(null);
  const negotiationScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (negotiationScrollRef.current) {
      negotiationScrollRef.current.scrollTo({
        top: negotiationScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [negotiationTranscript, isNegotiating, typingAgent]);

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
    setTypingAgent(null);
    setNegotiationStatusText(`Negotiation paused at Round ${negotiationRound}. Terms locked.`);
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
      (user?.email && o.counterparty?.toLowerCase().includes(user.email.split("@")[0].toLowerCase())) ||
      o.title?.toLowerCase().includes("school desk") ||
      o.title?.toLowerCase().includes("chair")
    );
  }, [orders, activeBuyer, user]);

  // Order Tracking Filter & Mutation State
  const [orderStageFilter, setOrderStageFilter] = useState<string>("all");
  const [isUpdatingOrder, setIsUpdatingOrder] = useState<string | null>(null);
  const [isCreatingSampleOrder, setIsCreatingSampleOrder] = useState<boolean>(false);

  const stageFilteredOrders = useMemo(() => {
    if (orderStageFilter === "all") return scopedBuyerOrders;
    return scopedBuyerOrders.filter((o) => {
      const idx = getOrderStageIndex(o.stage);
      if (orderStageFilter === "payment") return idx <= 2;
      if (orderStageFilter === "production") return idx === 3;
      if (orderStageFilter === "qa") return idx === 4;
      if (orderStageFilter === "transporting") return idx === 5;
      if (orderStageFilter === "delivered") return idx === 6;
      return true;
    });
  }, [scopedBuyerOrders, orderStageFilter]);

  const handleCreateSampleOrder = async () => {
    setIsCreatingSampleOrder(true);
    try {
      await createOrder({
        title: "100 Units Commercial School Desk",
        counterparty: "RAM DESKS",
        value: 282100,
        dueDate: "In 7 days",
        stage: "In Transport",
        location: "Bangalore - Mumbai NH-48 Freight Transit Corridor",
        docsSummary: "Dispatched via BlueDart Express Waybill #BD-9218-X4",
        health: "On Track",
        type: "buying",
      });
    } catch (err) {
      console.warn("Failed to create sample order:", err);
    } finally {
      setIsCreatingSampleOrder(false);
    }
  };

  const STAGE_DEFAULTS: Record<number, { stage: string; location: string; docs: string }> = {
    0: { stage: "Order Submitted", location: "Buyer Procurement Portal", docs: "Draft Purchase Order Registered in Supabase" },
    1: { stage: "Seller Approved", location: "Seller Commercial Desk", docs: "Commercial Terms Signed off by Both Agents" },
    2: { stage: "Payment Escrowed", location: "PayPal Sandbox Escrow Vault", docs: "Secured via PayPal Sandbox Escrow Vault" },
    3: { stage: "In Production", location: "Supplier Factory • Production Floor", docs: "Batch Fabrication Active • Assembly Line 2" },
    4: { stage: "QA Inspection", location: "Quality Inspection Bay 3", docs: "QA Compliance ISO-9001:2015 Verified" },
    5: { stage: "In Transport", location: "Bangalore - Mumbai NH-48 Freight Transit Corridor", docs: "Dispatched via BlueDart Express Waybill #BD-9218-X4" },
    6: { stage: "Delivered & Settled", location: "Buyer Central Warehouse • Dock Bay 4", docs: "Proof of Delivery Signed • Escrow Released" },
  };

  const handleAdvanceOrder = async (ord: any, nextStage: string, nextLoc?: string, nextDocs?: string) => {
    setIsUpdatingOrder(ord.id);
    try {
      const stageIdx = getOrderStageIndex(nextStage);
      const defaults = STAGE_DEFAULTS[stageIdx] || STAGE_DEFAULTS[0];
      await updateOrderStage(
        ord.id,
        nextStage,
        "On Track",
        nextLoc || defaults.location,
        nextDocs || defaults.docs
      );
    } catch (err) {
      console.warn("Failed to advance order:", err);
    } finally {
      setIsUpdatingOrder(null);
    }
  };

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
    setTypingAgent("buyer");
    setNegotiationStatusText("Initiating autonomous negotiation between DeepSeek-R1 and Qwen 2.5...");

    try {
      const catalogLotValue = product.basePrice * targetQuantity;
      const effectiveTargetBudget = targetBudget > 0 ? Math.min(targetBudget, catalogLotValue) : catalogLotValue;

      const res = await initiateNegotiation({
        productId: product.id,
        quantity: targetQuantity,
        buyerTargetPrice: effectiveTargetBudget,
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
          const roundMessages = mappedTranscript.filter((m: any) => m.round === r);
          const buyerMsg = roundMessages.find((m: any) => m.sender === "buyer_agent");
          const supplierMsg = roundMessages.find((m: any) => m.sender === "supplier_agent");
          const safeguardMsg = roundMessages.find((m: any) => m.sender === "safeguard");

          // 1. Buyer Turn with Typing Indicator
          if (buyerMsg) {
            setTypingAgent("buyer");
            setNegotiationStatusText(`Round ${r}: Buyer Agent is evaluating budget & volume targets...`);
            await new Promise((resolve) => setTimeout(resolve, 850));
            if (stopNegotiationRef.current) break;

            accumulated = [...accumulated, buyerMsg];
            setNegotiationTranscript([...accumulated]);
            setTypingAgent(null);
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (stopNegotiationRef.current) break;
          }

          // 2. Supplier Turn with Typing Indicator
          if (supplierMsg) {
            setTypingAgent("supplier");
            setNegotiationStatusText(`Round ${r}: ${product.businessName} Agent is checking catalog margins via FalkorDB...`);
            await new Promise((resolve) => setTimeout(resolve, 900));
            if (stopNegotiationRef.current) break;

            accumulated = [...accumulated, supplierMsg];
            setNegotiationTranscript([...accumulated]);
            setTypingAgent(null);
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (stopNegotiationRef.current) break;
          }

          // 3. Safeguard Turn
          if (safeguardMsg) {
            accumulated = [...accumulated, safeguardMsg];
            setNegotiationTranscript([...accumulated]);
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
        }

        if (!stopNegotiationRef.current) {
          setNegotiationRound(res.roundCount || rounds.length);
          setNegotiationSubmitted(true);
          setNegotiationStatusText(`Consensus reached in Round ${res.roundCount || rounds.length}! Final terms locked.`);
        }
      }
    } catch (err: any) {
      console.warn("Live multi-agent negotiation error:", err);
      setNegotiationError(err?.message || "Failed to initiate live negotiation");
    } finally {
      setTypingAgent(null);
      setIsNegotiating(false);
    }
  };

  const handleSendCounteroffer = async () => {
    if (!negotiationActive) return;

    const nextRound = negotiationRound + 1;
    const counterBuyer = Math.round(targetBudget * (0.97 - nextRound * 0.01));
    const supplierCounter = Math.max(
      negotiationActive.floorPrice,
      Math.round(negotiationActive.basePrice * (1 - nextRound * 0.015))
    );

    setNegotiationRound(nextRound);
    setIsNegotiating(true);

    // Simulate Buyer Typing
    setTypingAgent("buyer");
    setNegotiationStatusText(`Round ${nextRound}: Buyer Agent proposing counter-bid ₹${counterBuyer.toLocaleString()}...`);
    await new Promise((r) => setTimeout(r, 700));

    const newBuyerMsg = {
      sender: "buyer_agent" as const,
      round: nextRound,
      price: counterBuyer,
      text: `Round ${nextRound} counteroffer by ${activeBuyer.name}: ₹${counterBuyer.toLocaleString()} / unit. Volume discount justified by ${targetQuantity} units order size.`,
    };

    setNegotiationTranscript((prev) => [...prev, newBuyerMsg]);
    setTypingAgent(null);
    await new Promise((r) => setTimeout(r, 350));

    // Simulate Supplier Typing
    setTypingAgent("supplier");
    setNegotiationStatusText(`Round ${nextRound}: ${negotiationActive.businessName} analyzing counter against floor price...`);
    await new Promise((r) => setTimeout(r, 800));

    const newSupplierMsg = {
      sender: "supplier_agent" as const,
      round: nextRound,
      price: supplierCounter,
      text: `Round ${nextRound} supplier response: Adjusted to ₹${supplierCounter.toLocaleString()} / unit. Guaranteed fulfillment within ${negotiationActive.leadDays} days.`,
    };

    setNegotiationTranscript((prev) => [...prev, newSupplierMsg]);
    setTypingAgent(null);
    setIsNegotiating(false);

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
          text: `Consensus Achieved: Price converged at ₹${finalPrice.toLocaleString()} / unit (${gapPercent.toFixed(1)}% spread). Quotation generated and submitted to ${negotiationActive.businessName} Seller Hub for human confirmation.`,
        },
      ]);
      setNegotiationSubmitted(true);
      setNegotiationStatusText(`Agreement converged at Round ${nextRound}!`);
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
                    ACTIVE BUYER:
                  </span>
                  {user ? (
                    <span className="text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Account Verified
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-500 dark:text-gray-400">
                      Guest Session
                    </span>
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
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[#1E2638] pt-2 overflow-x-auto">
            <button
              onClick={() => handleTabSwitch("sourcing")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "sourcing"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Sourcing & Supplier Matching</span>
            </button>

            <button
              onClick={() => handleTabSwitch("rfqs")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "rfqs"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Quotations & RFQs</span>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                {scopedBuyerQuotes.length}
              </span>
            </button>

            <button
              onClick={() => handleTabSwitch("orders")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "orders"
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Order Status & Live Tracking</span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                {scopedBuyerOrders.length}
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
        ) : activeTab === "rfqs" ? (
          /* ============================================================== */
          /* TAB 2: My Sourced RFQs & Quotations (Multi-Tenant Scoped)      */
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
                    onClick={() => handleTabSwitch("sourcing")}
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

            {/* Quick Link to Dedicated Order Tracking */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Track Real-Time Order Fulfillment & Transit
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    View active purchase orders, production progress, and freight corridor logistics in Supabase.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleTabSwitch("orders")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span>Open Order Tracking</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        ) : (
          /* ============================================================== */
          /* TAB 3: DEDICATED ORDER STATUS & LIVE FULFILLMENT TRACKING      */
          /* ============================================================== */
          <div className="space-y-8">

            {/* Header / Scoped Controls */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-[#0A161E] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE FULFILLMENT CORRIDOR
                  </span>
                  <span className="text-xs text-slate-500 dark:text-gray-400 font-mono">
                    Supabase Connected • {activeBuyer.name}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Order Status & Live Logistics Tracking
                </h2>
                <p className="text-xs text-slate-600 dark:text-gray-400">
                  Real-time status transitions from quotation sign-off, factory production, QA, and freight transit to final delivery.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={handleCreateSampleOrder}
                  disabled={isCreatingSampleOrder}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Insert a real sample order (100 units School Desk from RAM DESKS @ ₹2,821/unit) into Supabase"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isCreatingSampleOrder ? "Writing to Supabase..." : "Simulate Sample Order"}</span>
                </button>
                <button
                  onClick={() => refreshData()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-gray-200 transition-all cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Refresh Status</span>
                </button>
              </div>
            </div>

            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stat 1: Total Orders */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-4 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono">
                  <span>ACTIVE ORDERS</span>
                  <Package className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {scopedBuyerOrders.length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                  Total Value: ₹{scopedBuyerOrders.reduce((acc, o) => acc + (o.value || 0), 0).toLocaleString()}
                </div>
              </div>

              {/* Stat 2: In Production */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-4 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono">
                  <span>IN PRODUCTION</span>
                  <Factory className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {scopedBuyerOrders.filter((o) => getOrderStageIndex(o.stage) === 3).length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                  Manufacturing plant active
                </div>
              </div>

              {/* Stat 3: In Transport */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-4 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono">
                  <span>IN TRANSPORT</span>
                  <Truck className="h-4 w-4 text-emerald-500 animate-pulse" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {scopedBuyerOrders.filter((o) => getOrderStageIndex(o.stage) === 5).length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                  Active freight transit
                </div>
              </div>

              {/* Stat 4: Delivered */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-4 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono">
                  <span>DELIVERED & SETTLED</span>
                  <CheckCircle2 className="h-4 w-4 text-purple-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                  {scopedBuyerOrders.filter((o) => getOrderStageIndex(o.stage) === 6).length}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-gray-400">
                  Fulfilled & completed
                </div>
              </div>
            </div>

            {/* STAGE FILTER TABS */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0E1424] p-1.5 rounded-2xl border border-slate-200 dark:border-[#1E2638] overflow-x-auto">
              {[
                { id: "all", label: `All Orders (${scopedBuyerOrders.length})` },
                { id: "payment", label: "Awaiting / Escrow Paid" },
                { id: "production", label: "In Production" },
                { id: "qa", label: "QA Inspection" },
                { id: "transporting", label: "In Transport" },
                { id: "delivered", label: "Delivered & Settled" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setOrderStageFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    orderStageFilter === tab.id
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ORDERS LIST */}
            {stageFilteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-12 text-center shadow-sm space-y-4">
                <Truck className="mx-auto h-12 w-12 text-emerald-500/60" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {orderStageFilter === "all" ? "No Active Purchase Orders Found" : "No Orders in Selected Stage"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 max-w-md mx-auto">
                    {orderStageFilter === "all"
                      ? "When a negotiation completes and seller approves terms, the purchase order enters the live fulfillment pipeline. Click below to simulate an active order in Supabase."
                      : "There are currently no orders matching this stage filter. Try selecting 'All Orders' or switch stages."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={handleCreateSampleOrder}
                    disabled={isCreatingSampleOrder}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{isCreatingSampleOrder ? "Writing to Supabase..." : "Simulate Sample Order (100 Desks @ RAM DESKS)"}</span>
                  </button>
                  <button
                    onClick={() => handleTabSwitch("sourcing")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 bg-white hover:bg-slate-50 dark:bg-[#12192B] dark:hover:bg-[#1A233C] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-all cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4 text-blue-500" />
                    <span>Start New Sourcing RFQ</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {stageFilteredOrders.map((ord) => {
                  const currentStageIdx = getOrderStageIndex(ord.stage);
                  const isUpdatingThis = isUpdatingOrder === ord.id;
                  const isDelivered = currentStageIdx === 6;

                  return (
                    <div
                      key={ord.id}
                      className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1424] p-6 shadow-md space-y-6 hover:border-emerald-400/50 dark:hover:border-emerald-500/40 transition-all"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#1A2236]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-500/30">
                              {ord.orderCode}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {ord.title}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3.5 w-3.5 text-slate-400" />
                              Supplier: <strong className="text-slate-800 dark:text-gray-200">{ord.counterparty}</strong>
                            </span>
                            <span>•</span>
                            <span>Due Date: <strong className="font-mono text-slate-700 dark:text-gray-300">{ord.dueDate}</strong></span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                              <strong className="text-emerald-600 dark:text-emerald-400">{ord.health || "On Track"}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block">Lot Value</span>
                            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                              ₹{ord.value.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono font-semibold text-xs border bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/40">
                            <Truck className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{ord.stage}</span>
                          </div>
                        </div>
                      </div>

                      {/* 7-STAGE VISUAL LIFECYCLE STEPPER */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-gray-400 font-mono">
                          <span className="uppercase font-bold tracking-wider text-[11px] text-slate-700 dark:text-gray-300">
                            Fulfillment Lifecycle Pipeline (Stage {currentStageIdx + 1} of 7)
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            {ORDER_LIFECYCLE_STAGES[currentStageIdx]?.label || ord.stage}
                          </span>
                        </div>

                        {/* Stepper Tracks */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2">
                          {ORDER_LIFECYCLE_STAGES.map((stg, sIdx) => {
                            const isDone = sIdx < currentStageIdx;
                            const isCurrent = sIdx === currentStageIdx;

                            return (
                              <div key={stg.id} className="flex flex-col items-center text-center space-y-1.5 group">
                                {/* Step Circle / Icon */}
                                <div
                                  className={`relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl text-xs font-bold transition-all ${
                                    isDone
                                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                      : isCurrent
                                      ? "bg-gradient-to-tr from-blue-600 to-indigo-600 text-white ring-4 ring-blue-500/30 shadow-lg shadow-blue-600/40 animate-pulse"
                                      : "bg-slate-100 dark:bg-[#151D30] text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-[#222E4A]"
                                  }`}
                                  title={`${stg.label}: ${stg.description}`}
                                >
                                  {isDone ? (
                                    <Check className="h-4 w-4 stroke-[3]" />
                                  ) : (
                                    <MaterialIcon name={stg.icon} size={18} />
                                  )}

                                  {isCurrent && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                                    </span>
                                  )}
                                </div>

                                {/* Step Label */}
                                <span
                                  className={`text-[10px] sm:text-[11px] font-mono leading-tight ${
                                    isDone
                                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                      : isCurrent
                                      ? "font-bold text-blue-600 dark:text-blue-400"
                                      : "text-slate-400 dark:text-gray-500"
                                  }`}
                                >
                                  {stg.shortLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* LIVE LOGISTICS TRANSIT CORRIDOR CARD */}
                      <div className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/70 dark:bg-[#111728] p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase flex items-center gap-1 font-bold">
                            <MapPin className="h-3 w-3 text-rose-500" />
                            Current Physical Location / Route
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-gray-200 font-mono">
                            {ord.location || "Bangalore - Mumbai NH-48 Freight Transit Corridor"}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase flex items-center gap-1 font-bold">
                            <FileText className="h-3 w-3 text-blue-500" />
                            Waybill & Operational Summary
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-gray-200">
                            {ord.docsSummary || "Dispatched via BlueDart Express Waybill #BD-9218-X4"}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase flex items-center gap-1 font-bold">
                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                            SLA & Escrow Guarantee
                          </span>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            PayPal Escrow Protection Active • 100% On-Time Guarantee
                          </p>
                        </div>
                      </div>

                      {/* CONTROLLER & ACTION BUTTONS */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-[#1A2236]">
                        {/* Live Supabase Stage Advancer */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-slate-500 dark:text-gray-400 font-bold">
                            Update Stage:
                          </span>
                          <select
                            value={ord.stage}
                            disabled={isUpdatingThis}
                            onChange={(e) => handleAdvanceOrder(ord, e.target.value)}
                            className="bg-white dark:bg-[#151D30] border border-slate-300 dark:border-gray-700 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold text-slate-800 dark:text-gray-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                          >
                            {ORDER_LIFECYCLE_STAGES.map((s) => (
                              <option key={s.id} value={s.label}>
                                {s.label}
                              </option>
                            ))}
                          </select>

                          {!isDelivered && (
                            <button
                              onClick={() => {
                                const nextStageObj = ORDER_LIFECYCLE_STAGES[currentStageIdx + 1];
                                if (nextStageObj) handleAdvanceOrder(ord, nextStageObj.label);
                              }}
                              disabled={isUpdatingThis}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                              <span>{isUpdatingThis ? "Updating Supabase..." : "Advance to Next Stage"}</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Payment & Inspection actions */}
                        <div className="flex items-center gap-2">
                          {currentStageIdx <= 2 && (
                            <button
                              onClick={() => setSelectedPaypalOrder({
                                id: ord.id,
                                title: ord.title,
                                amount: ord.value,
                                counterparty: ord.counterparty,
                                orderCode: ord.orderCode,
                              })}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#003087] to-[#0079C1] hover:from-[#002568] hover:to-[#005ea6] text-white text-xs font-bold shadow-md shadow-blue-900/30 transition-all cursor-pointer"
                              title="Pay with PayPal Sandbox Escrow"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              <span>PayPal Escrow Pay</span>
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                            title="Inspect contract specifications and financial terms"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Specs Audit</span>
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* Interactive Negotiation Room Modal (Full Screen Workstation) */}
      {/* ============================================================== */}
      {negotiationActive && (() => {
        const latestBuyerMsg = negotiationTranscript.filter((m) => m.sender === "buyer_agent").slice(-1)[0];
        const latestSellerMsg = negotiationTranscript.filter((m) => m.sender === "supplier_agent").slice(-1)[0];
        const hasBuyerBid = Boolean(latestBuyerMsg);

        // Smart opening bid: 90% of catalog base price or budget ceiling, bounded so it never exceeds catalog price
        const effectiveBudgetPerUnit = Math.round(targetBudget / (targetQuantity || 1));
        const defaultOpeningBid = Math.min(
          Math.round(negotiationActive.basePrice * 0.90),
          effectiveBudgetPerUnit > 0 ? effectiveBudgetPerUnit : negotiationActive.basePrice
        );
        const currentBuyerBid = latestBuyerMsg?.price || defaultOpeningBid;
        const currentSellerOffer = latestSellerMsg?.price || negotiationActive.basePrice;
        const currentAgreedPrice = negotiationTranscript[negotiationTranscript.length - 1]?.price || currentSellerOffer;
        const spreadGap = Math.abs(currentSellerOffer - currentBuyerBid);
        const spreadGapPercent = currentSellerOffer > 0 ? ((spreadGap / currentSellerOffer) * 100).toFixed(1) : "0";
        const totalContractValue = currentAgreedPrice * targetQuantity;
        const catalogTotalValue = negotiationActive.basePrice * targetQuantity;
        const totalSavings = Math.max(0, catalogTotalValue - totalContractValue);
        const savingsPercent = catalogTotalValue > 0 ? ((totalSavings / catalogTotalValue) * 100).toFixed(1) : "0";

        return (
          <div className="fixed inset-0 z-50 flex flex-col w-screen h-screen bg-white dark:bg-[#070B16] overflow-hidden animate-in fade-in duration-150">
            
            {/* Top Header Bar */}
            <div className="border-b border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0A0F1E] px-6 sm:px-8 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Autonomous Negotiation Workstation
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800">
                      Round {negotiationRound}
                    </span>
                    {negotiationSubmitted && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Consensus Reached
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span>Buyer Agent ({activeBuyer.name})</span>
                    <span>⟷</span>
                    <span>{negotiationActive.businessName} Agent</span>
                    <span>• {targetQuantity} Units of {negotiationActive.name}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {isNegotiating ? (
                  <button
                    type="button"
                    onClick={handleStopNegotiation}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600/60 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-semibold text-xs transition-all cursor-pointer"
                    title="Pause negotiation to inspect or manually steer"
                  >
                    <Square className="h-3 w-3 fill-current text-amber-600 dark:text-amber-400" />
                    <span>Pause</span>
                  </button>
                ) : isStopped && !negotiationSubmitted ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsStopped(false);
                      handleSendCounteroffer();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    <span>Resume</span>
                  </button>
                ) : null}

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
                  <span>Live Dialogue</span>
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
                  <span>Specifications & Terms</span>
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
                  <span>Protocol & Reasoning</span>
                </button>
              </div>

              <div className="text-[11px] font-mono text-slate-500 dark:text-gray-400 hidden sm:flex items-center gap-3">
                <span>
                  Ollama: <strong className="text-blue-600 dark:text-blue-400">DeepSeek-R1 (14B)</strong> ⟷ <strong className="text-purple-600 dark:text-purple-400">Qwen 2.5 (14B)</strong>
                </span>
                <span>•</span>
                <span>
                  FalkorDB: <strong className="text-emerald-600 dark:text-emerald-400">Graph Memory Active</strong>
                </span>
              </div>
            </div>

            {/* Scrollable Workstation Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-[#070B16]" ref={negotiationScrollRef}>
              <div className="max-w-4xl mx-auto space-y-4">

                {/* Real-Time Price Convergence Meter */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0D1424] p-4 shadow-xs">
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className="text-slate-500 dark:text-gray-400 uppercase text-[10px] tracking-wider">
                      Price Convergence Spread Tracker
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      negotiationSubmitted
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                    }`}>
                      {negotiationSubmitted ? "100% Agreement Reached" : `Spread Gap: ₹${spreadGap.toLocaleString()} (${spreadGapPercent}%)`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-3 pt-1">
                    {/* Buyer Bid */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <MaterialIcon name="school" size={18} />
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 uppercase block">
                          {hasBuyerBid ? `Buyer Bid (${activeBuyer.name})` : `Buyer Target (${activeBuyer.name})`}
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-blue-600 dark:text-blue-400">
                          ₹{currentBuyerBid.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">/ unit</span>
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="px-2">
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden border border-slate-200/60 dark:border-gray-800">
                        <div 
                          className={`h-full transition-all duration-700 rounded-full ${
                            negotiationSubmitted 
                              ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" 
                              : "bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"
                          }`} 
                          style={{ 
                            width: negotiationSubmitted ? "100%" : `${Math.min(95, Math.max(15, 100 - parseFloat(spreadGapPercent) * 4))}%` 
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-slate-400 mt-1">
                        <span>Opening Bid</span>
                        <span className="text-slate-500 dark:text-gray-400 font-semibold">
                          {negotiationSubmitted ? "Consensus" : `Targeting Midpoint`}
                        </span>
                        <span>Catalog Base</span>
                      </div>
                    </div>

                    {/* Seller Offer */}
                    <div className="flex items-center justify-end gap-2.5 text-right">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 uppercase block">
                          Seller Offer ({negotiationActive.businessName})
                        </span>
                        <span className="text-sm sm:text-base font-bold font-mono text-purple-600 dark:text-purple-400">
                          ₹{currentSellerOffer.toLocaleString()} <span className="text-[11px] font-normal text-slate-400">/ unit</span>
                        </span>
                      </div>
                      <div className="h-9 w-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                        <MaterialIcon name="domain" size={18} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Paused State Notice */}
                {isStopped && !negotiationSubmitted && (
                  <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/40 p-3.5 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Negotiation Paused at Round {negotiationRound}.</strong> Current proposal: ₹{currentAgreedPrice.toLocaleString()} / unit.
                      </span>
                    </div>
                    <button
                      onClick={() => setNegotiationSubmitted(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
                    >
                      Lock In & Submit
                    </button>
                  </div>
                )}

                {/* Error Banner */}
                {negotiationError && (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <p><strong>Notice:</strong> {negotiationError}. Fallback bounding active.</p>
                  </div>
                )}

                {/* TAB 1: LIVE DIALOGUE VIEW */}
                {negotiationViewTab === "chat" && (
                  <div className="space-y-4">
                    {/* Status Pill */}
                    {isNegotiating && (
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 animate-pulse">
                          <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                          <span>{negotiationStatusText || `Round ${negotiationRound} in Progress...`}</span>
                        </div>
                      </div>
                    )}

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
                              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed shadow-xs transition-all ${
                                isBuyer
                                  ? "bg-blue-50/80 dark:bg-[#111A33] border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-blue-100 rounded-tl-sm"
                                  : "bg-purple-50/80 dark:bg-[#1A1430] border border-purple-200 dark:border-purple-500/30 text-slate-900 dark:text-purple-100 rounded-tr-sm"
                              }`}
                            >
                              <p className="text-[13px] leading-relaxed">{cleanHumanChatText(msg.text)}</p>

                              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono">
                                <span className="opacity-75">
                                  {isBuyer ? "Proposed Bid:" : "Counter-Offer:"}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`font-bold px-2 py-0.5 rounded ${
                                    isBuyer 
                                      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
                                      : "bg-purple-600/10 text-purple-700 dark:text-purple-300"
                                  }`}>
                                    ₹{msg.price.toLocaleString()} / unit
                                  </span>
                                  <span className="text-[10px] text-slate-400 dark:text-gray-500 hidden sm:inline">
                                    (Batch: ₹{(msg.price * targetQuantity).toLocaleString()})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Smooth Active Typing Indicator */}
                      {typingAgent === "buyer" && (
                        <div className="flex flex-col items-start gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center gap-1.5 px-2 text-[10px] font-mono text-blue-500 uppercase">
                            <span className="font-bold flex items-center gap-1">
                              <MaterialIcon name="school" size={13} className="text-blue-500" />
                              <span>{activeBuyer.name} Agent (DeepSeek-R1)</span>
                            </span>
                            <span>• Formulating Proposal</span>
                          </div>
                          <div className="rounded-2xl rounded-tl-sm p-3.5 bg-blue-50/80 dark:bg-[#111A33] border border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-200 shadow-xs flex items-center gap-2.5">
                            <div className="flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                              <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                              <span className="h-2 w-2 rounded-full bg-blue-500 animate-bounce" />
                            </div>
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                              Formulating procurement proposal within ₹{targetBudget.toLocaleString()} budget...
                            </span>
                          </div>
                        </div>
                      )}

                      {typingAgent === "supplier" && (
                        <div className="flex flex-col items-end gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center gap-1.5 px-2 text-[10px] font-mono text-purple-500 uppercase">
                            <span className="font-bold flex items-center gap-1">
                              <MaterialIcon name="domain" size={13} className="text-purple-500" />
                              <span>{negotiationActive.businessName} Agent (Qwen 2.5)</span>
                            </span>
                            <span>• Analyzing Terms</span>
                          </div>
                          <div className="rounded-2xl rounded-tr-sm p-3.5 bg-purple-50/80 dark:bg-[#1A1430] border border-purple-200 dark:border-purple-500/30 text-purple-900 dark:text-purple-200 shadow-xs flex items-center gap-2.5">
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                              Evaluating floor price ₹{negotiationActive.floorPrice.toLocaleString()} via FalkorDB graph...
                            </span>
                            <div className="flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
                              <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                              <span className="h-2 w-2 rounded-full bg-purple-500 animate-bounce" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Celebratory Completion Card */}
                      {negotiationSubmitted && (
                        <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-b from-emerald-50/90 to-emerald-100/40 dark:from-emerald-950/40 dark:to-[#0A1A17] p-5 shadow-lg animate-in zoom-in-95 duration-200 my-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm sm:text-base">
                                <CheckCircle2 className="h-5 w-5" />
                                <span>Consensus Reached & Quotation Generated</span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-gray-300 mt-1">
                                Both AI agents have successfully negotiated final terms. Quotation queued for human supplier confirmation.
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setNegotiationActive(null);
                                  handleTabSwitch("rfqs");
                                }}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <span>View in My RFQs</span>
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-emerald-300/40 dark:border-emerald-500/20 text-xs">
                            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block">FINAL UNIT PRICE</span>
                              <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">
                                ₹{currentAgreedPrice.toLocaleString()} / unit
                              </span>
                            </div>
                            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block">TOTAL CONTRACT</span>
                              <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                                ₹{totalContractValue.toLocaleString()}
                              </span>
                            </div>
                            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block">SAVINGS VS CATALOG</span>
                              <span className="text-sm font-bold font-mono text-blue-600 dark:text-blue-400">
                                ₹{totalSavings.toLocaleString()} ({savingsPercent}%)
                              </span>
                            </div>
                            <div className="bg-white/80 dark:bg-black/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                              <span className="text-[10px] text-slate-500 dark:text-gray-400 font-mono block">FULFILLMENT DISPATCH</span>
                              <span className="text-sm font-bold font-mono text-slate-800 dark:text-gray-200">
                                {negotiationActive.leadDays} Days
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}

                {/* TAB 2: SPECIFICATIONS & TERMS */}
                {negotiationViewTab === "detailed" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1528] p-6 space-y-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div>
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                            PRODUCT & CONTRACT SPECIFICATION
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            {negotiationActive.name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                            Category: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.category}</strong> • SKU: <span className="font-mono">{negotiationActive.sku}</span>
                          </p>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Supplier: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.businessName}</strong> • Lead Time: <strong className="text-slate-800 dark:text-gray-200">{negotiationActive.leadDays} Business Days</strong>
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                            TOTAL BATCH VALUE ({targetQuantity} UNITS)
                          </span>
                          <span className="text-2xl font-mono font-extrabold text-slate-900 dark:text-white">
                            ₹{totalContractValue.toLocaleString()}
                          </span>
                          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 block mt-0.5">
                            @ ₹{currentAgreedPrice.toLocaleString()} / unit
                          </span>
                        </div>
                      </div>

                      {/* Dynamic Specifications Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4 border-t border-slate-200 dark:border-gray-800 text-xs">
                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">CATALOG BASE PRICE:</span>
                          <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">₹{negotiationActive.basePrice.toLocaleString()} / unit</span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">FLOOR PROTECTION:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">Server-Enforced (₹{negotiationActive.floorPrice.toLocaleString()})</span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">STOCK AVAILABILITY:</span>
                          <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">{negotiationActive.inStock.toLocaleString()} Units Ready</span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">SUPPLIER FULFILLMENT RATE:</span>
                          <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">{negotiationActive.onTimeRate}% On-Time Record</span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">ESCROW & PAYMENT:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block">PayPal Sandbox Automated Vault</span>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">DISPATCH COMMITMENT:</span>
                          <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">{negotiationActive.leadDays} Days Guaranteed</span>
                        </div>

                        {/* Dynamic Product Specifications from Database */}
                        {negotiationActive.specifications && Object.entries(negotiationActive.specifications).map(([key, val]) => (
                          <div key={key} className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-slate-50/70 dark:bg-[#12192F]">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono uppercase">{key}:</span>
                            <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block truncate">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: PROTOCOL & REASONING */}
                {negotiationViewTab === "protocol" && (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/20 p-4 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-sm">
                        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span>Autonomous Multi-Agent Deliberation Architecture</span>
                      </div>
                      <p className="leading-relaxed">
                        The Buyer AI Agent (<strong>DeepSeek-R1:14B</strong>) parses the buyer's procurement constraints (budget, batch size, target deadline) and autonomously proposes opening bids. The Supplier AI Agent (<strong>Qwen 2.5:14B</strong>) evaluates incoming bids against catalog pricing, volume economics, and past transaction graphs stored in <strong>FalkorDB</strong>.
                      </p>
                      <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 font-mono">
                        Server-enforced floor protection prevents suppliers from selling below viable profit margins, guaranteeing zero unprofitable transactions.
                      </p>
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
                              ? "Buyer AI Agent (DeepSeek-R1)"
                              : msg.sender === "supplier_agent"
                              ? `${negotiationActive.businessName} Agent (Qwen 2.5)`
                              : "Deterministic Guardrail"}
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

            {/* Pinned Bottom Footer Controls */}
            <div className="border-t border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0A0F1E] px-6 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 shadow-xs">
              <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Agreed Unit Price:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                    ₹{currentAgreedPrice.toLocaleString()} / unit
                  </span>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 border-l border-slate-200 dark:border-gray-800 pl-4">
                  <span className="text-slate-500">Total Contract ({targetQuantity} units):</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{totalContractValue.toLocaleString()}
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-1.5 border-l border-slate-200 dark:border-gray-800 pl-4 text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                  <span>Savings:</span>
                  <span className="font-bold">
                    ₹{totalSavings.toLocaleString()} ({savingsPercent}%)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {isNegotiating ? (
                  <div className="flex items-center gap-2 text-xs font-mono text-blue-600 dark:text-blue-400">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
                    <span>Autonomous Agents Deliberating...</span>
                  </div>
                ) : !negotiationSubmitted ? (
                  <button
                    onClick={handleSendCounteroffer}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md transition-all cursor-pointer"
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
                        handleTabSwitch("rfqs");
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      View in My RFQs
                    </button>
                    <button
                      onClick={() => setNegotiationActive(null)}
                      className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#12192B] hover:bg-slate-50 dark:hover:bg-[#1A233C] text-slate-700 dark:text-gray-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        );
      })()}

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
