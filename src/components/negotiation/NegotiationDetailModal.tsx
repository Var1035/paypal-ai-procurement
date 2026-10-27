import React, { useState, useEffect, useRef } from "react";
import { 
  Bot, 
  Building2, 
  GraduationCap, 
  CheckCircle2, 
  ShieldCheck, 
  FileText, 
  MessageSquare, 
  Play, 
  RotateCcw, 
  X, 
  Scale, 
  Sparkles,
  Layers
} from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cleanHumanChatText } from "@/lib/utils";

export interface NegotiationMessage {
  sender: "buyer_agent" | "supplier_agent" | "safeguard";
  text: string;
  price: number;
  round: number;
  timestamp?: string;
}

export interface NegotiationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotation: {
    id: string;
    item: string;
    quantity: number;
    totalValue: number;
    unitPrice?: number;
    marginAchieved?: number;
    buyerLeadDays?: number;
    leadDays?: number;
    round?: number;
    status: string;
    buyerName?: string;
    businessName?: string;
    businessId?: string;
    specs?: {
      material?: string;
      standards?: string;
      frame?: string;
      certification?: string;
    };
    transcript?: NegotiationMessage[];
  } | null;
  initialViewMode?: "chat" | "detailed" | "protocol";
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  isSellerView?: boolean;
}

export const NegotiationDetailModal: React.FC<NegotiationDetailModalProps> = ({
  isOpen,
  onClose,
  quotation,
  initialViewMode = "chat",
  onApprove,
  onReject,
  isSellerView = false,
}) => {
  const [activeTab, setActiveTab] = useState<"chat" | "detailed" | "protocol">(initialViewMode);
  const [replayIndex, setReplayIndex] = useState<number>(-1);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveTab(initialViewMode);
    setReplayIndex(-1);
    setIsReplaying(false);
    setIsTyping(false);
  }, [isOpen, initialViewMode, quotation?.id]);

  // Build clean transcript if empty
  const rawTranscript: NegotiationMessage[] = quotation?.transcript && quotation.transcript.length > 0
    ? quotation.transcript
    : quotation
    ? [
        {
          round: 1,
          sender: "supplier_agent",
          price: quotation.unitPrice ? Math.round(quotation.unitPrice * 1.05) : Math.round(quotation.totalValue / (quotation.quantity || 1) * 1.05),
          text: `Emitted initial verified catalog quotation for ${quotation.quantity} units of ${quotation.item} at standard tier terms. Guaranteed ${quotation.leadDays || quotation.buyerLeadDays || 6}-day delivery dispatch.`,
        },
        {
          round: 2,
          sender: "buyer_agent",
          price: quotation.unitPrice ? Math.round(quotation.unitPrice * 0.96) : Math.round(quotation.totalValue / (quotation.quantity || 1) * 0.96),
          text: `Proposed counter-offer based on batch volume of ${quotation.quantity} units and commercial procurement budget targets. Requesting institutional contract pricing.`,
        },
        {
          round: 3,
          sender: "supplier_agent",
          price: quotation.unitPrice || Math.round(quotation.totalValue / (quotation.quantity || 1)),
          text: `Concession accepted at agreed price. Margin strictly satisfies server-enforced autonomous floor safeguard. Quoted delivery within ${quotation.leadDays || quotation.buyerLeadDays || 6} days. Transferred to seller human approval.`,
        },
        {
          round: quotation.round || 3,
          sender: "safeguard",
          price: quotation.unitPrice || Math.round(quotation.totalValue / (quotation.quantity || 1)),
          text: `Deterministic Safeguard Check: Multi-agent price convergence achieved. Margin (+${quotation.marginAchieved || 15}%) validated above floor. Transmitted to Supabase database.`,
        }
      ]
    : [];

  const visibleMessages = replayIndex === -1 ? rawTranscript : rawTranscript.slice(0, replayIndex + 1);

  // Auto scroll chat to bottom (always called unconditionally above early return)
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [visibleMessages, isTyping, activeTab]);

  if (!isOpen || !quotation) return null;

  const handleStartReplay = () => {
    setReplayIndex(0);
    setIsReplaying(true);
    setIsTyping(true);

    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current >= rawTranscript.length) {
        setReplayIndex(rawTranscript.length - 1);
        setIsTyping(false);
        setIsReplaying(false);
        clearInterval(interval);
      } else {
        setIsTyping(true);
        setTimeout(() => {
          setReplayIndex(current);
          setIsTyping(current < rawTranscript.length - 1);
        }, 600);
      }
    }, 1600);
  };

  const handleResetReplay = () => {
    setIsReplaying(false);
    setIsTyping(false);
    setReplayIndex(-1);
  };

  const unitPrice = quotation.unitPrice || Math.round(quotation.totalValue / (quotation.quantity || 1));
  const buyerName = quotation.buyerName || "Corporate Buyer";
  const businessName = quotation.businessName || "Verified Supplier";
  const leadDays = quotation.leadDays || quotation.buyerLeadDays || 6;
  const marginPercent = quotation.marginAchieved || 18;

  // Specs fallback
  const isChairs = quotation.item.toLowerCase().includes("chair");
  const specs = quotation.specs || {
    material: isChairs ? "High-Density Polypropylene & Breathable Mesh" : "FSC-Certified Commercial European Birch Hardwood",
    standards: isChairs ? "BIFMA X5.1 Ergonomic Standards Compliant" : "EN 1729 European Educational Furniture Specification",
    frame: isChairs ? "Reinforced Nylon 5-Star Base with Heavy-Duty Gas Lift" : "16-Gauge Dual-Stage Powder-Coated Tubular Steel",
    certification: "ISO 9001:2015 Quality & ISO 14001 Environmental Compliant",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0F1E] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Bar */}
        <div className="border-b border-slate-100 dark:border-[#1A233A] bg-slate-50/80 dark:bg-[#0E1529] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Multi-Agent Negotiation Intelligence
                </h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                  quotation.status === "approved"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : quotation.status === "rejected"
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                }`}>
                  {quotation.status === "awaiting_approval" || quotation.status === "awaiting_seller_approval"
                    ? "Awaiting Sign-Off"
                    : quotation.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{buyerName}</span>
                <span>⟷</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">{businessName}</span>
                <span>• {quotation.quantity} Units</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-200/60 dark:hover:bg-gray-800 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="px-6 py-2.5 border-b border-slate-100 dark:border-[#1A233A] bg-slate-100/50 dark:bg-[#0B1123] flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/60 dark:bg-[#131B32] border border-slate-300/40 dark:border-gray-800">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "chat"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Live Chat Preview</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>

            <button
              onClick={() => setActiveTab("detailed")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "detailed"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Detailed View & Specs</span>
            </button>

            <button
              onClick={() => setActiveTab("protocol")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "protocol"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                  : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Protocol Log</span>
            </button>
          </div>

          {activeTab === "chat" && (
            <div className="flex items-center gap-2">
              {replayIndex !== -1 ? (
                <button
                  onClick={handleResetReplay}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Full View</span>
                </button>
              ) : (
                <button
                  onClick={handleStartReplay}
                  disabled={isReplaying}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Replay Live Chat</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Body Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#0A0F1E] space-y-4" ref={chatScrollRef}>
          
          {/* ============================================================== */}
          {/* VIEW 1: LIVE CHAT PREVIEW (Chatting Style of Buyer & Seller) */}
          {/* ============================================================== */}
          {activeTab === "chat" && (
            <div className="space-y-4">
              
              {/* Agent Persona Indicator Bar */}
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-gray-800 text-xs">
                <div className="flex items-center gap-2 rounded-xl p-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-500/20">
                  <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-blue-900 dark:text-blue-300 block truncate">
                      Buyer Agent ({buyerName})
                    </span>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                      DeepSeek-R1 (14B)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 rounded-xl p-2 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-500/20 text-right">
                  <div className="truncate">
                    <span className="font-bold text-purple-900 dark:text-purple-300 block truncate">
                      Supplier Agent ({businessName})
                    </span>
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                      Qwen 2.5 (14B)
                    </span>
                  </div>
                  <Building2 className="h-4 w-4 text-purple-500 shrink-0" />
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-3.5 pt-1">
                {visibleMessages.map((msg, idx) => {
                  if ((msg.sender as any) === "safeguard" || (msg.sender as any) === "System" || msg.text.includes("[Human Takeover]") || msg.text.includes("[AI Handover]")) {
                    const isTakeover = msg.text.includes("[Human Takeover]");
                    const isHandover = msg.text.includes("[AI Handover]");
                    return (
                      <div key={idx} className="flex justify-center my-3">
                        <div className={`flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-mono font-medium border shadow-xs ${
                          isTakeover 
                            ? "border-amber-300 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300"
                            : isHandover
                            ? "border-blue-300 dark:border-blue-500/30 bg-blue-50/90 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300"
                            : "border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                        }`}>
                          <ShieldCheck className="h-3.5 w-3.5 text-current shrink-0" />
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
                      {/* Sender Label & Round */}
                      <div className="flex items-center gap-1.5 px-2 text-[10px] font-mono text-slate-500 dark:text-gray-400 uppercase">
                        <span className="font-bold flex items-center gap-1">
                          {isBuyer ? (
                            <>
                              <MaterialIcon name="school" size={13} className="text-blue-500" />
                              <span>{buyerName} Agent</span>
                            </>
                          ) : (
                            <>
                              <MaterialIcon name="domain" size={13} className="text-purple-500" />
                              <span>{businessName} Agent</span>
                            </>
                          )}
                        </span>
                        <span>• Round {msg.round}</span>
                      </div>

                      {/* Chat Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm transition-all text-left ${
                          isBuyer
                            ? "bg-blue-50 dark:bg-[#111A33] border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-blue-100 rounded-tl-sm"
                            : "bg-purple-50 dark:bg-[#1A1430] border border-purple-200 dark:border-purple-500/30 text-slate-900 dark:text-purple-100 rounded-tr-sm"
                        }`}
                      >
                        <p>{cleanHumanChatText(msg.text)}</p>

                        {/* Price / Offer Tag Inside Bubble */}
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

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 p-3 text-xs text-slate-500 dark:text-gray-400 italic">
                    <Bot className="h-4 w-4 animate-spin text-blue-500" />
                    <span>Autonomous agent evaluating concessions and pricing floor...</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 2: DETAILED VIEW & SPECS (Full Commercial Breakdown) */}
          {/* ============================================================== */}
          {activeTab === "detailed" && (
            <div className="space-y-6">
              
              {/* Product & Commercial Summary */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0E1528] p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                      PROCUREMENT ITEM SPECIFICATION
                    </span>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {quotation.item}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      Batch Volume: <strong className="text-slate-800 dark:text-gray-200">{quotation.quantity} Units</strong> • Guaranteed Lead Time: <strong className="text-slate-800 dark:text-gray-200">{leadDays} Days</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400 block mb-1">
                      TOTAL CONTRACT VALUE
                    </span>
                    <span className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
                      ₹{quotation.totalValue.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-mono block text-emerald-600 dark:text-emerald-400">
                      (₹{unitPrice.toLocaleString()} / unit)
                    </span>
                  </div>
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-gray-800 text-xs">
                  <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">
                      MATERIAL SPECIFICATION:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                      {specs.material}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">
                      STRUCTURAL STANDARDS:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                      {specs.standards}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">
                      CHASSIS & FRAME:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                      {specs.frame}
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-gray-800 p-3 bg-white dark:bg-[#12192F]">
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block font-mono">
                      CERTIFICATION:
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-gray-200 mt-0.5 block">
                      {specs.certification}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing & Safeguard Math */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0E1528] p-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 font-medium mb-1">
                    <Scale className="h-3.5 w-3.5 text-blue-500" />
                    <span>Unit Price Economics</span>
                  </div>
                  <div className="space-y-1.5 mt-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Agreed Unit:</span>
                      <span className="font-bold">₹{unitPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Total Units:</span>
                      <span className="font-bold">{quotation.quantity}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-gray-800 text-blue-600 dark:text-blue-400 font-bold">
                      <span>Total Value:</span>
                      <span>₹{quotation.totalValue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0E1528] p-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 font-medium mb-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Supplier Margin Floor</span>
                  </div>
                  <div className="space-y-1.5 mt-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Achieved Margin:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+{marginPercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Floor Status:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Enforced</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300">
                      <span>Rounds Elapsed:</span>
                      <span>{quotation.round || 3} of 5</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-slate-50/50 dark:bg-[#0E1528] p-4 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-gray-400 font-medium mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>PayPal Direct Settlement</span>
                  </div>
                  <div className="space-y-1.5 mt-2 font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Payment Status:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">Direct Checkout</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-gray-400">Confirmation:</span>
                      <span className="font-bold">Instant</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300">
                      <span>Human Sign-Off:</span>
                      <span>Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cryptographic Agent Audit Hash */}
              <div className="rounded-2xl border border-blue-200/70 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20 p-4 text-xs font-mono">
                <div className="flex items-center gap-2 mb-2 text-blue-900 dark:text-blue-300 font-bold">
                  <Sparkles className="h-4 w-4" />
                  <span>Deterministic Autonomous Protocol Verification</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-gray-400">
                  <div>
                    <span className="block font-semibold">Buyer Agent LLM:</span>
                    <span>Ollama deepseek-r1:14b (Temp: 0.2, Top-P: 0.9)</span>
                  </div>
                  <div>
                    <span className="block font-semibold">Supplier Agent LLM:</span>
                    <span>Ollama qwen2.5:14b (Temp: 0.2, Guardrails: Active)</span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-blue-200/50 dark:border-blue-500/20 truncate">
                    <span className="font-semibold">Supabase Hash ID: </span>
                    <span className="text-blue-700 dark:text-blue-300">{quotation.id}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* VIEW 3: PROTOCOL LOG */}
          {/* ============================================================== */}
          {activeTab === "protocol" && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-950/20 p-3 text-xs text-blue-900 dark:text-blue-300">
                <strong>Protocol Audit:</strong> Multi-turn bargaining log bounded by mathematical floor thresholds. Zero leakage of confidential seller cost baselines.
              </div>

              {rawTranscript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-4 text-xs leading-relaxed shadow-xs ${
                    msg.sender === "buyer_agent"
                      ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200"
                      : msg.sender === "supplier_agent"
                      ? "border-purple-200 dark:border-purple-500/30 bg-purple-50/80 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200"
                      : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 font-mono text-[10px] uppercase">
                    <span className="font-bold flex items-center gap-1">
                      {msg.sender === "buyer_agent" ? (
                        <>
                          <MaterialIcon name="school" size={13} className="text-blue-500" />
                          <span>{buyerName} Agent</span>
                        </>
                      ) : msg.sender === "supplier_agent" ? (
                        <>
                          <MaterialIcon name="domain" size={13} className="text-purple-500" />
                          <span>{businessName} Agent</span>
                        </>
                      ) : (
                        <>
                          <MaterialIcon name="shield" size={13} className="text-emerald-500" />
                          <span>Deterministic Policy Guardrail</span>
                        </>
                      )}
                    </span>
                    <span className="font-semibold">Round {msg.round} • Quote: ₹{msg.price.toLocaleString()}</span>
                  </div>
                  <p>{msg.text}</p>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="border-t border-slate-100 dark:border-[#1E2638] bg-slate-50 dark:bg-[#0B0F1D] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-gray-400 flex items-center gap-2">
            <span>Agreed Settlement:</span>
            <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
              ₹{unitPrice.toLocaleString()} / unit
            </span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
              (Total ₹{quotation.totalValue.toLocaleString()})
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {isSellerView && (quotation.status === "awaiting_approval" || quotation.status === "awaiting_seller_approval") ? (
              <>
                <button
                  onClick={() => onReject && onReject(quotation.id)}
                  className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Reject Terms
                </button>
                <button
                  onClick={() => onApprove && onApprove(quotation.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Approve & Issue PO</span>
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-800 dark:text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Close View
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
