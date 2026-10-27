import React, { useState, useMemo, useRef, useEffect } from "react";
import { useMarketplace } from "@/context/MarketplaceContext";
import { useAuth } from "@/context/AuthContext";
import { 
  LayoutDashboard, 
  Building2, 
  Package, 
  FileText, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  Mail, 
  Search, 
  Plus, 
  Calendar, 
  X,
  Tag,
  Filter,
  MessageSquare,
  UserCheck,
  Bot,
  Send,
  RefreshCw,
  Brain,
  ShieldCheck,
  GraduationCap
} from "lucide-react";
import { NegotiationDetailModal } from "@/components/negotiation/NegotiationDetailModal";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { cleanHumanChatText, isWithinTimeline, type TimelineFilterOption, TIMELINE_FILTER_OPTIONS } from "@/lib/utils";

export const SellerHubPage: React.FC = () => {
  const { 
    seller, 
    registerSeller, 
    products, 
    addProduct, 
    orders, 
    pendingQuotes, 
    approveQuote, 
    rejectQuote,
    takeoverNegotiation,
    handoverNegotiation,
    sendNegotiationMessage,
    guardrails,
    updateGuardrails,
    seedSampleCatalog,
    refreshData,
    autoRefreshInterval,
    setAutoRefreshInterval,
    clearAllRFQs,
  } = useMarketplace();

  const { 
    activeSeller, 
    availableSellers, 
    switchSeller
  } = useAuth();

  // Navigation within Seller Hub
  const [activeNav, setActiveNav] = useState<
    "orders" | "products" | "chats" | "rfqs" | "guardrails" | "profile"
  >("orders");

  // State for Live Negotiations & Chats Hub
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "active" | "takeover" | "awaiting" | "approved">("all");
  const [manualSellerMessage, setManualSellerMessage] = useState("");
  const [manualSellerPrice, setManualSellerPrice] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [learningNotice, setLearningNotice] = useState<string | null>(null);
  const sellerChatScrollRef = useRef<HTMLDivElement>(null);

  // State for inspecting quote / order detailed view & live chat preview
  const [inspectingQuote, setInspectingQuote] = useState<{
    quote: any;
    mode: "chat" | "detailed" | "protocol";
  } | null>(null);

  // Scoped datasets: ONLY information belonging to this active seller business
  const scopedProducts = useMemo(() => {
    if (!activeSeller) return products;
    return products.filter((p) => 
      p.businessId === activeSeller.id || 
      p.businessName?.toLowerCase() === activeSeller.name.toLowerCase()
    );
  }, [products, activeSeller]);

  const scopedOrders = useMemo(() => {
    if (!activeSeller) return orders;
    return orders.filter((o) => 
      (o.businessId && o.businessId === activeSeller.id) ||
      o.counterparty?.toLowerCase().includes(activeSeller.name.toLowerCase()) || 
      o.title?.toLowerCase().includes(activeSeller.name.toLowerCase())
    );
  }, [orders, activeSeller]);

  const scopedPendingQuotes = useMemo(() => {
    if (!activeSeller) return pendingQuotes;
    return pendingQuotes.filter((q) => 
      (q.businessId && q.businessId === activeSeller.id) ||
      (q.businessName && q.businessName.toLowerCase() === activeSeller.name.toLowerCase())
    );
  }, [pendingQuotes, activeSeller]);

  // RFQ Timeline Filter state: "this_year" by default
  const [rfqTimelineFilter, setRfqTimelineFilter] = useState<TimelineFilterOption>("this_year");

  // Filtered RFQs for RFQs & Approvals queue
  const timelineFilteredRFQs = useMemo(() => {
    return scopedPendingQuotes.filter((q) => isWithinTimeline(q.createdAt, rfqTimelineFilter));
  }, [scopedPendingQuotes, rfqTimelineFilter]);

  // Filtered chats for Live Negotiations & Chats tab (Scoped by timeline, search, and status)
  const filteredChats = useMemo(() => {
    return scopedPendingQuotes.filter((q) => {
      if (!isWithinTimeline(q.createdAt, rfqTimelineFilter)) return false;

      const matchesSearch = 
        q.buyerName?.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
        q.item?.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
        q.id?.toLowerCase().includes(chatSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (chatFilter === "takeover") return q.isHumanTakeover;
      if (chatFilter === "awaiting") return q.status === "awaiting_approval";
      if (chatFilter === "approved") return q.status === "approved";
      if (chatFilter === "active") return q.status !== "approved" && q.status !== "rejected";
      return true;
    });
  }, [scopedPendingQuotes, chatSearchQuery, chatFilter, rfqTimelineFilter]);

  const activeChat = useMemo(() => {
    if (selectedChatId) {
      const found = scopedPendingQuotes.find((q) => q.id === selectedChatId);
      if (found) return found;
    }
    return filteredChats[0] || scopedPendingQuotes[0] || null;
  }, [scopedPendingQuotes, selectedChatId, filteredChats]);

  useEffect(() => {
    if (sellerChatScrollRef.current) {
      sellerChatScrollRef.current.scrollTop = sellerChatScrollRef.current.scrollHeight;
    }
  }, [activeChat?.transcript?.length, activeNav, selectedChatId]);

  const handleTakeover = async () => {
    if (!activeChat) return;
    try {
      await takeoverNegotiation(activeChat.id, activeSeller?.name || seller.name || "Supplier");
      setLearningNotice("Human takeover engaged. Autonomous AI messaging has paused. You are in manual control.");
    } catch (err) {
      console.warn("Takeover failed:", err);
    }
  };

  const handleHandover = async () => {
    if (!activeChat) return;
    try {
      await handoverNegotiation(activeChat.id, activeSeller?.name || seller.name || "Supplier");
      setLearningNotice("Control handed back to AI. The supplier autonomous agent will resume bounded negotiation incorporating your guidance.");
    } catch (err) {
      console.warn("Handover failed:", err);
    }
  };

  const handleSendManualMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChat || !manualSellerMessage.trim()) return;

    setIsSendingMessage(true);
    try {
      const priceVal = manualSellerPrice ? Number(manualSellerPrice) : activeChat.proposedUnitPrice;
      const res = await sendNegotiationMessage({
        quotationId: activeChat.id,
        sender: `${activeSeller?.name || seller.name || "Supplier"} (Human Seller)`,
        message: manualSellerMessage.trim(),
        price: priceVal,
        round: (activeChat.round || 1) + 1,
        isHumanSeller: true,
      });

      setManualSellerMessage("");
      setManualSellerPrice("");
      setLearningNotice(
        res?.learningNote || 
        `AI Learned: Captured seller concession threshold (₹${priceVal?.toLocaleString()}/unit). Supplier agent behavior updated.`
      );
    } catch (err) {
      console.warn("Send message failed:", err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Orders Tab State (Matching screenshot)
  const [orderTypeFilter, setOrderTypeFilter] = useState<"buying" | "selling">("buying");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("All");
  const [showExceptionsOnly, setShowExceptionsOnly] = useState(false);

  // Dynamic KPI calculations from scoped orders
  const openOrdersCount = scopedOrders.length;
  const buyingCount = scopedOrders.filter((o) => o.type === "buying").length;
  const sellingCount = scopedOrders.filter((o) => o.type === "selling").length;
  const needsActionCount = scopedOrders.filter((o) => o.stage === "Awaiting Seller Approval" || o.health === "Attention").length;
  const movingCount = scopedOrders.filter((o) => o.stage === "In production" || o.stage === "In Transit" || o.stage === "QA Review").length;
  const openValueTotal = scopedOrders.reduce((sum, o) => sum + o.value, 0);
  const overdueCount = scopedOrders.filter((o) => o.health === "Delayed").length;

  // Add Product Modal State
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Classroom Desks");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [newProductStock, setNewProductStock] = useState(100);
  const [newProductBasePrice, setNewProductBasePrice] = useState(4500);
  const [newProductFloorPrice, setNewProductFloorPrice] = useState(4100);
  const [newProductLeadDays, setNewProductLeadDays] = useState(6);
  const [newProductMaterial, setNewProductMaterial] = useState("High Density Birch Wood");

  // Products Tab State (Search & Dynamic Category Filter across n categories)
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("All");

  // Standard multi-industry B2B categories
  const standardIndustryCategories = [
    "Classroom Desks",
    "Ergonomic Seating",
    "Meeting Tables",
    "Storage & Lockers",
    "Commercial Workstations",
    "IT Hardware & Servers",
    "Laptops & Mobile Workstations",
    "Networking & Telecom",
    "Electronics & AV Displays",
    "Industrial Machinery & Spares",
    "Warehouse & Material Handling",
    "Safety & PPE Equipment",
    "Electrical & Lighting",
    "Office Supplies & Paper",
    "Lab Equipment & Testing",
    "Medical & Healthcare Devices",
    "Packaging & Shipping Supplies",
    "Raw Materials & Sheet Metal",
    "Facility & Maintenance",
  ];

  // Dynamically compute all unique categories from scoped products + industry standards
  const dynamicCategories = useMemo(() => {
    const catalogCats = Array.from(new Set(scopedProducts.map((p) => p.category).filter(Boolean)));
    return Array.from(new Set([...catalogCats, ...standardIndustryCategories]));
  }, [scopedProducts]);

  // Unique categories actively existing in current products catalog
  const uniqueCatalogCategories = useMemo(() => {
    return Array.from(new Set(scopedProducts.map((p) => p.category).filter(Boolean)));
  }, [scopedProducts]);

  // Filtered products for Catalog & Inventory view (Scoped to Active Seller)
  const filteredProducts = useMemo(() => {
    return scopedProducts.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.category.toLowerCase().includes(productSearch.toLowerCase());
      const matchesCategory =
        productCategoryFilter === "All" || p.category.toLowerCase() === productCategoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [scopedProducts, productSearch, productCategoryFilter]);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(!seller.isRegistered);
  const [regName, setRegName] = useState(seller.name);
  const [regNo, setRegNo] = useState(seller.regNo);
  const [regGstin, setRegGstin] = useState(seller.gstin);
  const [regCategory, setRegCategory] = useState(seller.category);
  const [regEmail, setRegEmail] = useState(seller.email);

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerSeller({
      businessId: `biz-${Date.now()}`,
      name: regName,
      regNo,
      gstin: regGstin,
      category: regCategory,
      email: regEmail,
    });
    setIsRegisterOpen(false);
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCategory = (isCustomCategory ? customCategoryInput.trim() : newProductCategory.trim()) || "General Supplies";
    addProduct({
      name: newProductName,
      sku: newProductSku || `SKU-${Date.now().toString().slice(-4)}`,
      category: resolvedCategory,
      inStock: newProductStock,
      basePrice: newProductBasePrice,
      floorPrice: newProductFloorPrice,
      leadDays: newProductLeadDays,
      specifications: {
        material: newProductMaterial,
        warranty: "24 Months",
        standard: "ISO 9001 B2B Certified",
      },
      rating: 5.0,
      onTimeRate: 100,
    });
    setIsAddProductOpen(false);
    // Reset form
    setNewProductName("");
    setNewProductSku("");
    setIsCustomCategory(false);
    setCustomCategoryInput("");
  };

  // Filter orders (Scoped to active seller)
  const filteredOrders = scopedOrders.filter((ord) => {
    const matchesType = ord.type === orderTypeFilter;
    const matchesSearch = 
      ord.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.orderCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.counterparty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = stageFilter === "All" || ord.stage === stageFilter;
    const matchesException = !showExceptionsOnly || ord.health === "Attention";
    return matchesType && matchesSearch && matchesStage && matchesException;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-gray-100 flex flex-col md:flex-row pt-20">
      
      {/* ============================================================== */}
      {/* 1. LEFT SIDEBAR (Matching Reference Image) */}
      {/* ============================================================== */}
      <aside className="w-full md:w-64 border-r border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0A0E1A] flex flex-col justify-between shrink-0">
        
        <div>
          {/* Workspace / Brand Header with Multi-Seller Switcher */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-[#1B2335] space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 shadow-md shadow-purple-600/30 font-bold text-white text-xs">
                {activeSeller?.name ? activeSeller.name.substring(0, 2).toUpperCase() : "SH"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide uppercase font-mono truncate">
                  {activeSeller?.name || seller.name || "DeskWorks"} Hub
                </h2>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Verified Enterprise Seller
                </span>
                {activeSeller?.email && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400 font-mono truncate mt-0.5" title={`Connected to: ${activeSeller.email}`}>
                    <Mail className="h-2.5 w-2.5 text-purple-500 shrink-0" />
                    <span className="truncate">{activeSeller.email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Active Seller Business Switcher Dropdown */}
            {availableSellers.length > 0 && (
              <div className="pt-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-gray-400 block mb-1 font-mono">
                  ACTIVE BUSINESS TENANT:
                </label>
                <select
                  value={activeSeller?.id || ""}
                  onChange={(e) => switchSeller(e.target.value)}
                  className="w-full text-xs font-medium rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#111728] px-2 py-1.5 text-slate-800 dark:text-gray-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  {availableSellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.email ? `(${s.email})` : `(${s.category})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Sections */}
          <div className="p-3 space-y-6 text-xs">
            
            {/* COMPANY Section */}
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
                Company
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveNav("orders")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "orders"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard Overview</span>
                </button>
                <button
                  onClick={() => setActiveNav("profile")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "profile"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>Company Profile</span>
                </button>
              </div>
            </div>

            {/* ORDERS Section */}
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
                Orders
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveNav("orders")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "orders"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-500/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" />
                    <span>Orders Tracker</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeNav === "orders" ? "bg-blue-200/60 dark:bg-white/20 text-blue-800 dark:text-white" : "bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-400"
                  }`}>
                    {scopedOrders.length}
                  </span>
                </button>
              </div>
            </div>

            {/* SUPPLIER Section */}
            <div>
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
                Supplier
              </div>
              <div className="space-y-0.5">
                <button
                  onClick={() => setActiveNav("products")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "products"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4" />
                    <span>Products & Catalog</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeNav === "products"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-400"
                  }`}>{scopedProducts.length}</span>
                </button>

                <button
                  onClick={() => setActiveNav("chats")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "chats"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4" />
                    <span>Live Negotiations</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    activeNav === "chats"
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-400"
                  }`}>{scopedPendingQuotes.length}</span>
                </button>

                <button
                  onClick={() => setActiveNav("rfqs")}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "rfqs"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4" />
                    <span>RFQs & Approvals</span>
                  </div>
                  {scopedPendingQuotes.filter((q) => q.status === "awaiting_approval").length > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {scopedPendingQuotes.filter((q) => q.status === "awaiting_approval").length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveNav("guardrails")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left font-medium transition-all cursor-pointer ${
                    activeNav === "guardrails"
                      ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30"
                      : "text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-[#12192B] hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Agent Guardrails</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-slate-100 dark:border-[#1B2335] flex items-center justify-between bg-slate-50 dark:bg-[#080C16]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-600/30 border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
              {seller.isRegistered && seller.name ? seller.name.charAt(0).toUpperCase() : "?"}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[110px]">
                {seller.isRegistered && seller.name ? seller.name : "Unregistered"}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-gray-500 truncate font-mono">
                {seller.isRegistered && seller.regNo ? seller.regNo : "Click to register"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsRegisterOpen(true)}
            title="Edit Profile"
            className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

      </aside>

      {/* ============================================================== */}
      {/* 2. MAIN DASHBOARD CONTENT AREA */}
      {/* ============================================================== */}
      <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:px-10">

        {!seller.isRegistered && (
          <div className="mb-6 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/70 dark:bg-blue-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Supplier Profile Not Registered</h4>
                <p className="text-[11px] text-slate-600 dark:text-gray-400">Complete business registration to link your corporate identity, tax ID, and catalog to the procurement network.</p>
              </div>
            </div>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Register Business</span>
            </button>
          </div>
        )}

        {/* Header Breadcrumb & Title */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase font-mono mb-1">
              {activeNav === "orders" ? "ORDER CONTROL" : activeNav === "products" ? "CATALOG & INVENTORY" : activeNav === "chats" ? "LIVE AI NEGOTIATIONS" : activeNav === "rfqs" ? "APPROVAL QUEUE" : "SUPPLIER AGENT OS"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {activeNav === "orders" ? "Orders" : activeNav === "products" ? "Product Listings & Inventory" : activeNav === "chats" ? "Live Negotiations & Chats" : activeNav === "rfqs" ? "RFQs & Quotation Sign-Off" : "Supplier Agent Policy"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400 mt-1 max-w-2xl">
              {activeNav === "orders"
                ? "Track buying and selling activity across RFQs, purchase orders, documents, shipment, invoice matching, and payment."
                : activeNav === "products"
                ? "Manage your product catalog, available inventory units, base prices, and strict floor price safeguards."
                : activeNav === "chats"
                ? "Monitor autonomous buyer-seller agent negotiations in real time, inspect transcripts, or take manual control to negotiate directly."
                : activeNav === "rfqs"
                ? "Human-in-the-loop sign-off: Approve or reject finalized quotation versions agreed with buyer agents."
                : "Configure your supplier AI agent's floor margins, concession rules, and automated response capabilities."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Auto Refresh Option */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0E1A] px-3 py-2 shadow-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${autoRefreshInterval > 0 ? "text-blue-500 animate-spin" : "text-slate-400"}`} />
              <span className="text-[11px] font-medium text-slate-500 dark:text-gray-400">Auto-Sync:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="text-xs font-semibold bg-transparent border-0 text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
              >
                <option value={0}>Off</option>
                <option value={5}>Every 5s</option>
                <option value={15}>Every 15s</option>
                <option value={30}>Every 30s</option>
              </select>
              <button
                onClick={() => refreshData()}
                title="Sync now"
                className="p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            {/* Clear All RFQs Button */}
            {(activeNav === "chats" || activeNav === "rfqs") && scopedPendingQuotes.length > 0 && (
              <button
                onClick={() => clearAllRFQs()}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 transition-all cursor-pointer"
                title="Remove all RFQs and quotations"
              >
                <X className="h-3.5 w-3.5" />
                <span>Clear All RFQs</span>
              </button>
            )}

            {/* Quick Action Button */}
            {activeNav === "products" && (
              <button
                onClick={() => setIsAddProductOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Product Listing</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* VIEW 1: ORDERS DASHBOARD (Matching Reference Image) */}
        {/* ============================================================== */}
        {activeNav === "orders" && (
          <div className="space-y-8">
            
            {/* Top 4 KPI Metric Cards (Matching Screenshot) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: Open */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-5 shadow-sm relative">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-400 font-mono tracking-wider uppercase">
                    Open
                  </span>
                </div>
                <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{openOrdersCount}</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{buyingCount} buying · {sellingCount} selling</p>
              </div>

              {/* Card 2: Needs Action */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-5 shadow-sm relative">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <span className="rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 font-mono tracking-wider uppercase">
                    Needs Action
                  </span>
                </div>
                <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{needsActionCount}</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{overdueCount} delayed / attention</p>
              </div>

              {/* Card 3: Moving */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-5 shadow-sm relative">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <Truck className="h-4 w-4" />
                  </div>
                  <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-400 font-mono tracking-wider uppercase">
                    Moving
                  </span>
                </div>
                <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white font-mono">{movingCount}</div>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Production, QA, or shipment</p>
              </div>

              {/* Card 4: Open Value */}
              <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-5 shadow-sm relative">
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-400 font-mono tracking-wider uppercase">
                    Open Value
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {openValueTotal > 0 ? `₹${openValueTotal.toLocaleString()}` : "₹0"}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">Active deal volume</p>
              </div>

            </div>

            {/* DEAL FLOW Section (Matching Screenshot) */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] shadow-sm overflow-hidden">
              
              <div className="p-6 border-b border-slate-100 dark:border-[#1B2335]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold tracking-widest text-slate-500 dark:text-gray-500 uppercase font-mono">
                      Deal Flow
                    </span>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Buying and selling order tracker</h2>
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                      Track buyer orders and sales orders from RFQ through documents, shipment, invoice matching, and payment.
                    </p>
                  </div>                  {/* Segmented Toggle: [Buying 4] [Selling 3] */}
                  <div className="flex items-center rounded-xl bg-slate-100 dark:bg-[#090D18] border border-slate-200 dark:border-[#1B2335] p-1 self-start">
                    <button
                      onClick={() => setOrderTypeFilter("buying")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        orderTypeFilter === "buying"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Buying</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                        orderTypeFilter === "buying" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300"
                      }`}>
                        {buyingCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setOrderTypeFilter("selling")}
                      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        orderTypeFilter === "selling"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <span>Selling</span>
                      <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                        orderTypeFilter === "selling" ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300"
                      }`}>
                        {sellingCount}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar (Matching Screenshot) */}
                <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-200 dark:border-[#182033]">
                  
                  {/* Search orders */}
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search orders"
                      className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0E1A] pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Date pills */}
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400">
                    <span className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0E1A] px-3 py-2 flex items-center gap-1.5 shadow-xs">
                      <span className="text-[10px] uppercase text-slate-400 dark:text-gray-500 font-mono font-semibold">FROM</span>
                      <span className="text-slate-800 dark:text-gray-200">Any date</span>
                    </span>
                    <span className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0E1A] px-3 py-2 flex items-center gap-1.5 shadow-xs">
                      <span className="text-[10px] uppercase text-slate-400 dark:text-gray-500 font-mono font-semibold">TO</span>
                      <span className="text-slate-800 dark:text-gray-200">Any date</span>
                    </span>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setStageFilter("All");
                        setShowExceptionsOnly(false);
                      }}
                      className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white px-2 py-1 font-medium cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Stage Dropdown */}
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0A0E1A] px-3 py-2 text-xs text-slate-800 dark:text-gray-300 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All stages</option>
                    <option value="In production">In production</option>
                    <option value="In Transit">In Transit</option>
                    <option value="Awaiting Seller Approval">Awaiting Seller Approval</option>
                    <option value="Delivered">Delivered</option>
                  </select>

                  {/* Exceptions checkbox */}
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-gray-400 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={showExceptionsOnly}
                      onChange={(e) => setShowExceptionsOnly(e.target.checked)}
                      className="rounded border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-600 focus:ring-0"
                    />
                    <span>Show exceptions only</span>
                  </label>

                </div>
              </div>

              {/* Data Table (Matching Screenshot Columns) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-[#1B2335] bg-slate-50 dark:bg-[#0B101E] text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-gray-400 font-mono">
                    <tr>
                      <th className="py-3.5 px-6">Order</th>
                      <th className="py-3.5 px-4">Value</th>
                      <th className="py-3.5 px-4">Counterparty</th>
                      <th className="py-3.5 px-4">Stage</th>
                      <th className="py-3.5 px-4">Due</th>
                      <th className="py-3.5 px-6 text-right">Checks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#171F32]">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center">
                          <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-slate-500 dark:text-gray-400">
                            <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-[#12192B] flex items-center justify-center text-slate-400 mb-3 border border-slate-200 dark:border-[#1E2638]">
                              <FileText className="h-6 w-6 text-blue-500" />
                            </div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">No Orders in Deal Flow</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                              {orders.length === 0
                                ? "Orders will appear here as procurement agreements and quotation approvals are completed."
                                : "No orders match the current filter criteria."}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50 dark:hover:bg-[#12192B]/60 transition-colors">
                          
                          {/* Order Column */}
                          <td className="py-4 px-6">
                            <span className="font-mono text-[11px] text-slate-500 dark:text-gray-400 block font-semibold">{ord.orderCode}</span>
                            <span className="font-bold text-slate-900 dark:text-white text-xs mt-0.5 block">{ord.title}</span>
                          </td>

                          {/* Value Column */}
                          <td className="py-4 px-4 font-mono font-bold text-slate-900 dark:text-white text-sm">
                            ₹{ord.value.toLocaleString()}
                          </td>

                          {/* Counterparty Column */}
                          <td className="py-4 px-4">
                            <span className="font-semibold text-slate-800 dark:text-gray-200 block">{ord.counterparty}</span>
                            <span className="text-[10px] text-slate-500 dark:text-gray-500 block">{ord.location}</span>
                          </td>

                          {/* Stage Column */}
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                              ord.stage === "Delivered" || ord.stage === "Paid & Confirmed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                                : ord.stage === "Awaiting Seller Approval"
                                ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
                                : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20"
                            }`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {ord.stage}
                            </span>
                          </td>

                          {/* Due Column */}
                          <td className="py-4 px-4 font-mono text-slate-700 dark:text-gray-300">
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 text-slate-400 dark:text-gray-500" />
                              {ord.dueDate}
                            </span>
                          </td>

                          {/* Checks & Actions Column */}
                          <td className="py-4 px-6 text-right">
                            <div className="inline-flex flex-col items-end gap-1.5">
                              <button
                                onClick={() => setInspectingQuote({
                                  quote: {
                                    id: ord.id,
                                    item: ord.title,
                                    quantity: 100,
                                    totalValue: ord.value,
                                    status: "approved",
                                    buyerName: ord.counterparty,
                                    businessName: activeSeller?.name || "My Business",
                                    leadDays: 7,
                                  },
                                  mode: "detailed"
                                })}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                                title="Inspect order details and contract specs"
                              >
                                <FileText className="h-3 w-3" />
                                <span>Detailed View</span>
                              </button>
                              <div className="flex items-center gap-1">
                                <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 px-1 py-0.2 text-[8px] font-mono">PO</span>
                                <span className="rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30 px-1 py-0.2 text-[8px] font-mono">GR</span>
                                <span className="rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30 px-1 py-0.2 text-[8px] font-mono">INV</span>
                              </div>
                            </div>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: PRODUCTS & INVENTORY */}
        {/* ============================================================== */}
        {activeNav === "products" && (
          <div className="space-y-6">
            {/* Products Filter Bar: Search + Dynamic N-Categories Filter */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product name, SKU..."
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E273C] bg-white dark:bg-[#080C16] pl-9 pr-3.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-slate-500 dark:text-gray-400" />
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="rounded-xl border border-slate-200 dark:border-[#1E273C] bg-white dark:bg-[#080C16] px-3 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="All">All Categories ({products.length})</option>
                    {uniqueCatalogCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat} ({products.filter((p) => p.category === cat).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-3 font-mono">
                <span>
                  Showing <strong className="text-slate-900 dark:text-white">{filteredProducts.length}</strong> of <strong className="text-slate-900 dark:text-white">{products.length}</strong> items
                </span>
                <span className="text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
                  {uniqueCatalogCategories.length} active {uniqueCatalogCategories.length === 1 ? "category" : "categories"}
                </span>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-[#1E273C] bg-white dark:bg-[#0E1526]/50 p-12 text-center shadow-xs">
                <Package className="h-10 w-10 text-slate-400 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800 dark:text-gray-200">Catalog is Currently Empty</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                  Add your first product listing to enable AI buyer agents to discover your inventory and autonomously negotiate RFQs within your price floor.
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setIsAddProductOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add First Product</span>
                  </button>
                  <button
                    onClick={() => seedSampleCatalog()}
                    className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-[#12192B] dark:hover:bg-[#19233C] px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                  >
                    <span>Load Sample Catalog</span>
                  </button>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 dark:border-[#1E273C] bg-white dark:bg-[#0E1526]/50 p-12 text-center shadow-xs">
                <Package className="h-10 w-10 text-slate-400 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300">No products match your filter</h3>
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">Try resetting the category filter or searching another keyword.</p>
                <button
                  onClick={() => {
                    setProductSearch("");
                    setProductCategoryFilter("All");
                  }}
                  className="mt-4 text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredProducts.map((p) => (
                  <div key={p.id} className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded-full font-medium">
                        SKU: {p.sku}
                      </span>
                      <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        In Stock: {p.inStock} units
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{p.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/20 font-medium">
                        <Tag className="h-2.5 w-2.5" /> {p.category}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-gray-400">• Lead time: {p.leadDays}d</span>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-[#1A2337] bg-slate-50 dark:bg-[#0A0F1D] p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-gray-400">Base Catalog Price:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">₹{p.basePrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-gray-400">Floor Price (Guardrail):</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">₹{p.floorPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-gray-400">Fulfillment On-Time:</span>
                        <span className="font-mono text-purple-600 dark:text-purple-300 font-medium">{p.onTimeRate}%</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#182033] flex items-center justify-between text-xs text-slate-500 dark:text-gray-400">
                      <span>Seller: {p.businessName}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Auto-Quote Active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW: LIVE MULTI-AGENT NEGOTIATIONS & CHATS HUB */}
        {/* ============================================================== */}
        {activeNav === "chats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
              
              {/* Left Column: Available Chats List */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1526] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-[#1B2335] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <span>Available Chats</span>
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {filteredChats.length} Active
                    </span>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      placeholder="Search buyer or product..."
                      className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-slate-50 dark:bg-[#0A0E1A] pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                    {[
                      { id: "all", label: "All" },
                      { id: "active", label: "Live AI" },
                      { id: "takeover", label: "Seller Control" },
                      { id: "awaiting", label: "Sign-Off" },
                      { id: "approved", label: "Approved" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setChatFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                          chatFilter === f.id
                            ? "bg-blue-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Timeline Filter Row */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] pt-1.5 border-t border-slate-100 dark:border-[#1B2335]">
                    <span className="text-[10px] font-mono text-slate-400 dark:text-gray-500 uppercase px-1 font-bold">
                      Time:
                    </span>
                    {TIMELINE_FILTER_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setRfqTimelineFilter(t.id)}
                        className={`px-2 py-0.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap text-[10px] ${
                          rfqTimelineFilter === t.id
                            ? "bg-purple-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-gray-800/60 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chats Stream List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-gray-800/50 max-h-[540px]">
                  {filteredChats.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500 dark:text-gray-400">
                      <Bot className="h-8 w-8 text-slate-400 dark:text-gray-600 mx-auto mb-2" />
                      <p className="font-semibold">No Negotiations Found</p>
                      <p className="text-[11px] mt-1 text-slate-400">When buyers start negotiating on the marketplace, the live streams will appear here.</p>
                    </div>
                  ) : (
                    filteredChats.map((q) => {
                      const isSelected = activeChat?.id === q.id;
                      return (
                        <div
                          key={q.id}
                          onClick={() => {
                            setSelectedChatId(q.id);
                            setLearningNotice(null);
                          }}
                          className={`p-4 transition-all cursor-pointer text-left ${
                            isSelected
                              ? "bg-blue-50/70 dark:bg-[#131E3D] border-l-4 border-l-blue-600"
                              : "hover:bg-slate-50 dark:hover:bg-[#111728]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px]">
                              {q.buyerName}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                              q.isHumanTakeover
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : q.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : q.status === "awaiting_approval"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                                : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                            }`}>
                              {q.isHumanTakeover ? "Seller Control" : q.status === "awaiting_approval" ? "Sign-Off" : q.status.toUpperCase()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-gray-300 font-medium truncate">
                            {q.item} ({q.quantity} units)
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-gray-400">
                            <span>Round {q.round}</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              ₹{(q.proposedUnitPrice || Math.round(q.totalValue / (q.quantity || 1))).toLocaleString()} / unit
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Interactive Chat & Takeover Control Room */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col rounded-2xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#0E1526] shadow-sm overflow-hidden">
                {!activeChat ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-slate-400">
                    <MessageSquare className="h-10 w-10 text-slate-300 dark:text-gray-600 mb-2" />
                    <h4 className="text-sm font-bold text-slate-700 dark:text-gray-300">No Negotiation Selected</h4>
                    <p className="text-xs text-slate-500 dark:text-gray-500 max-w-sm mt-1">Select any conversation from the left to view the multi-agent deliberation stream, take manual control, or approve terms.</p>
                  </div>
                ) : (
                  <>
                    {/* Active Chat Header */}
                    <div className="p-4 border-b border-slate-100 dark:border-[#1A233A] bg-slate-50/80 dark:bg-[#0E1529] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {activeChat.buyerName} ⟷ {activeChat.businessName || activeSeller?.name}
                            </h3>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                              activeChat.isHumanTakeover
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : activeChat.status === "approved"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30"
                            }`}>
                              {activeChat.isHumanTakeover ? "Seller in Control" : activeChat.status.replace("_", " ").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Item: <strong className="text-slate-800 dark:text-gray-200">{activeChat.item}</strong> ({activeChat.quantity} units) • Current Quote: <strong className="font-mono text-purple-600 dark:text-purple-400">₹{(activeChat.proposedUnitPrice || Math.round(activeChat.totalValue / (activeChat.quantity || 1))).toLocaleString()} / unit</strong>
                          </p>
                        </div>
                      </div>

                      {/* Header Actions: Take Over / Handover to AI / Sign-off */}
                      <div className="flex items-center gap-2">
                        {!activeChat.isHumanTakeover ? (
                          <button
                            onClick={handleTakeover}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                            title="Take manual control from AI agent"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Take Over</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleHandover}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer animate-pulse"
                            title="Hand control back to autonomous AI agent"
                          >
                            <Bot className="h-3.5 w-3.5" />
                            <span>Handover to AI</span>
                          </button>
                        )}

                        {activeChat.status === "awaiting_approval" && (
                          <>
                            <button
                              onClick={() => approveQuote(activeChat.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => rejectQuote(activeChat.id)}
                              className="p-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI Learning Notification Banner */}
                    {learningNotice && (
                      <div className="px-4 py-2.5 bg-purple-50 dark:bg-purple-950/40 border-b border-purple-200 dark:border-purple-500/20 text-xs text-purple-900 dark:text-purple-300 flex items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-600 animate-pulse shrink-0" />
                          <span>{learningNotice}</span>
                        </div>
                        <button
                          onClick={() => setLearningNotice(null)}
                          className="text-purple-400 hover:text-purple-700 dark:hover:text-purple-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Chat Messages Stream (Signature Multi-Agent Style) */}
                    <div 
                      ref={sellerChatScrollRef} 
                      className="p-5 space-y-3.5 flex-1 max-h-[460px] overflow-y-auto bg-slate-50/40 dark:bg-[#0A0F1D]"
                    >
                      {/* Persona Bar */}
                      <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-100 dark:border-gray-800 text-xs">
                        <div className="flex items-center gap-2 rounded-xl p-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-500/20">
                          <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-blue-900 dark:text-blue-300 block truncate">
                              Buyer Agent ({activeChat.buyerName})
                            </span>
                            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400">
                              DeepSeek-R1 (14B)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 rounded-xl p-2 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-500/20 text-right">
                          <div className="truncate">
                            <span className="font-bold text-purple-900 dark:text-purple-300 block truncate">
                              {activeChat.isHumanTakeover ? `Seller Human (${activeSeller?.name || "Varun Furni"})` : `Supplier Agent (${activeChat.businessName || activeSeller?.name})`}
                            </span>
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                              {activeChat.isHumanTakeover ? "Manual Control" : "Qwen 2.5 (14B)"}
                            </span>
                          </div>
                          <Building2 className="h-4 w-4 text-purple-500 shrink-0" />
                        </div>
                      </div>

                      {/* Chat Bubbles */}
                      {(activeChat.transcript || []).map((msg, idx) => {
                        if (msg.sender === "safeguard" || msg.sender === "System" || msg.text.includes("[Human Takeover]") || msg.text.includes("[AI Handover]")) {
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

                        const isBuyer = msg.sender === "buyer_agent" || msg.sender.toLowerCase().includes("buyer");
                        const isHumanSeller = msg.sender.includes("Human Seller");

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
                                    <span>{activeChat.buyerName} Agent</span>
                                  </>
                                ) : isHumanSeller ? (
                                  <>
                                    <MaterialIcon name="person" size={13} className="text-amber-500" />
                                    <span>{activeChat.businessName || "Varun Furni"} (You)</span>
                                  </>
                                ) : (
                                  <>
                                    <MaterialIcon name="domain" size={13} className="text-purple-500" />
                                    <span>{activeChat.businessName} Agent</span>
                                  </>
                                )}
                              </span>
                              <span>• Round {msg.round}</span>
                            </div>

                            <div
                              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs leading-relaxed shadow-sm transition-all text-left ${
                                isBuyer
                                  ? "bg-blue-50 dark:bg-[#111A33] border border-blue-200 dark:border-blue-500/30 text-slate-900 dark:text-blue-100 rounded-tl-sm"
                                  : isHumanSeller
                                  ? "bg-amber-50 dark:bg-[#251A10] border-2 border-amber-300 dark:border-amber-500/40 text-slate-900 dark:text-amber-100 rounded-tr-sm"
                                  : "bg-purple-50 dark:bg-[#1A1430] border border-purple-200 dark:border-purple-500/30 text-slate-900 dark:text-purple-100 rounded-tr-sm"
                              }`}
                            >
                              <p>{cleanHumanChatText(msg.text)}</p>

                              {msg.price > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-between text-[11px] font-mono">
                                  <span className="opacity-75">
                                    {isBuyer ? "Bid Proposed:" : "Counter-Offer:"}
                                  </span>
                                  <span className={`font-bold px-2 py-0.5 rounded ${
                                    isBuyer 
                                      ? "bg-blue-600/10 text-blue-700 dark:text-blue-300"
                                      : isHumanSeller
                                      ? "bg-amber-600/10 text-amber-700 dark:text-amber-300"
                                      : "bg-purple-600/10 text-purple-700 dark:text-purple-300"
                                  }`}>
                                    ₹{msg.price.toLocaleString()} / unit
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Bottom Messaging or Status Area */}
                    {activeChat.isHumanTakeover ? (
                      <div className="p-4 border-t border-slate-100 dark:border-[#1E2638] bg-amber-50/40 dark:bg-[#161208]">
                        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                          <Brain className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>Human Takeover Active • Autonomous AI Agent Paused</span>
                        </div>
                        <form onSubmit={handleSendManualMessage} className="space-y-3">
                          <textarea
                            value={manualSellerMessage}
                            onChange={(e) => setManualSellerMessage(e.target.value)}
                            placeholder="Type custom message to buyer (e.g. 'We can accept ₹2,800/unit if batch delivery is set to 8 days')..."
                            rows={2}
                            className="w-full rounded-xl border border-amber-300/70 dark:border-amber-500/30 bg-white dark:bg-[#0E1526] p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                          />
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium text-slate-600 dark:text-gray-400">Unit Price: ₹</span>
                              <input
                                type="number"
                                value={manualSellerPrice}
                                onChange={(e) => setManualSellerPrice(e.target.value)}
                                placeholder={(activeChat.proposedUnitPrice || 3000).toString()}
                                className="w-28 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0E1526] px-2 py-1 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSendingMessage || !manualSellerMessage.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Send className="h-3.5 w-3.5" />
                              <span>{isSendingMessage ? "Transmitting..." : "Send Counteroffer"}</span>
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div className="p-3.5 border-t border-slate-100 dark:border-[#1E2638] bg-slate-50 dark:bg-[#0B1020] flex items-center justify-between text-xs text-slate-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span>Supplier Agent (Qwen 2.5 14B) is autonomously negotiating within your floor price.</span>
                        </div>
                        <button
                          onClick={handleTakeover}
                          className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                        >
                          Take Over Now →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 3: RFQS & QUOTATION APPROVALS QUEUE */}
        {/* ============================================================== */}
        {activeNav === "rfqs" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    Quotations Awaiting Seller Human Approval ({timelineFilteredRFQs.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Step 5 human safeguard: An LLM or automated agent cannot finalize commercial terms without explicit seller confirmation.
                  </p>
                </div>

                {/* Timeline Filter Controls */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#12192B] p-1 rounded-xl border border-slate-200 dark:border-[#1E2638] overflow-x-auto self-start sm:self-auto">
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

              <div className="space-y-4">
                {scopedPendingQuotes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#1E273C] p-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">No Quotations Awaiting Approval for {activeSeller?.name || "This Supplier"}</p>
                    <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                      Only quotation requests specifically submitted to {activeSeller?.name || "your business"} will appear in this approval queue.
                    </p>
                  </div>
                ) : timelineFilteredRFQs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-[#1E273C] p-10 text-center space-y-3">
                    <Clock className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-300">
                      No Quotations found for {TIMELINE_FILTER_OPTIONS.find((t) => t.id === rfqTimelineFilter)?.label || "This Year"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-500 max-w-sm mx-auto">
                      You have {scopedPendingQuotes.length} quotation{scopedPendingQuotes.length > 1 ? "s" : ""} recorded in total under other timeframes.
                    </p>
                    <button
                      onClick={() => setRfqTimelineFilter("all")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-gray-700 bg-white dark:bg-[#12192B] hover:bg-slate-50 dark:hover:bg-[#1A233C] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200 transition-all cursor-pointer"
                    >
                      <span>View All Time ({scopedPendingQuotes.length})</span>
                    </button>
                  </div>
                ) : (
                  timelineFilteredRFQs.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-slate-200 dark:border-[#1E273C] bg-slate-50/70 dark:bg-[#0A0F1D] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">{q.id.toUpperCase()}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                          q.status === "approved"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
                            : q.status === "rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 animate-pulse"
                        }`}>
                          {q.status === "awaiting_approval" ? "Awaiting Your Sign-Off" : q.status.toUpperCase()}
                        </span>
                        {q.createdAt && (
                          <span className="text-[10px] text-slate-400 dark:text-gray-500 font-mono flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(q.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{q.buyerName}</h4>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        {q.quantity} units of {q.item} • Lead time: {q.buyerLeadDays} days • Round {q.round}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-slate-500 dark:text-gray-400">Agreed Total: <strong className="text-slate-900 dark:text-white font-mono">₹{q.totalValue.toLocaleString()}</strong></span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Margin Achieved: <strong>+{q.marginAchieved}%</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setInspectingQuote({ quote: q, mode: "chat" })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/30 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                        title="Open live chat-style conversation preview"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Live Preview</span>
                      </button>

                      <button
                        onClick={() => setInspectingQuote({ quote: q, mode: "detailed" })}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#12192F] hover:bg-slate-50 dark:hover:bg-[#1A2440] text-slate-700 dark:text-gray-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                        title="Inspect full engineering specs and financial audit"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Detailed View</span>
                      </button>

                      {q.status === "awaiting_approval" ? (
                        <>
                          <button
                            onClick={() => approveQuote(q.id)}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Approve Quotation</span>
                          </button>
                          <button
                            onClick={() => rejectQuote(q.id)}
                            className="flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 transition-all cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                            <span>Reject</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4" /> Signed by Seller Human
                        </div>
                      )}
                    </div>
                  </div>
                )))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 4: AGENT POLICY GUARDRAILS */}
        {/* ============================================================== */}
        {activeNav === "guardrails" && (
          <div className="space-y-6 max-w-3xl">
            <div className="rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Autonomous Agent Guardrails</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  Your supplier agent will autonomously negotiate with buyer agents within these exact mathematical limits. It will NEVER quote below your floor price.
                </p>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 dark:text-gray-300 font-medium">Minimum Profit Margin Floor</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{guardrails.minMargin}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    value={guardrails.minMargin}
                    onChange={(e) => updateGuardrails({ minMargin: parseInt(e.target.value, 10) })}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 dark:text-gray-300 font-medium">Maximum Concession Per Round</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{guardrails.maxRoundConcession}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={guardrails.maxRoundConcession}
                    onChange={(e) => updateGuardrails({ maxRoundConcession: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-700 dark:text-gray-300 font-medium">Require Human Approval For Deals Over</span>
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">₹{guardrails.requireApprovalAbove.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="100000"
                    max="1000000"
                    step="50000"
                    value={guardrails.requireApprovalAbove}
                    onChange={(e) => updateGuardrails({ requireApprovalAbove: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-[#182033] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-white block">Auto-Quote Enablement</span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-400">Allow AI agent to emit initial quotes without manual approval</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={guardrails.autoQuote}
                    onChange={(e) => updateGuardrails({ autoQuote: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 5: COMPANY PROFILE */}
        {/* ============================================================== */}
        {activeNav === "profile" && (
          <div className="max-w-2xl rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0E1526] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{seller.name}</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Registered Supplier Entity</p>
              </div>
              <span className="rounded-full bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1 text-xs font-mono flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="h-4 w-4" /> Verified B2B Merchant
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100 dark:border-[#182033]">
              <div>
                <span className="text-slate-500 dark:text-gray-500 block">Registration Code:</span>
                <span className="font-mono text-slate-900 dark:text-white font-semibold">{seller.regNo}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-gray-500 block">Tax / GSTIN Identifier:</span>
                <span className="font-mono text-slate-900 dark:text-white font-semibold">{seller.gstin}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-gray-500 block">Category Focus:</span>
                <span className="text-slate-900 dark:text-white font-medium">{seller.category}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-gray-500 block">Procurement Contact:</span>
                <span className="text-slate-900 dark:text-white font-medium">{seller.email}</span>
              </div>
            </div>

            <button
              onClick={() => setIsRegisterOpen(true)}
              className="mt-4 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-600/20 px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-600/30 cursor-pointer transition-colors"
            >
              Update Registration Credentials
            </button>
          </div>
        )}

      </main>

      {/* ============================================================== */}
      {/* MODAL 1: ADD PRODUCT LISTING MODAL */}
      {/* ============================================================== */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0D1322] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#182033]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Create Product Listing
              </h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Ergonomic Study Desk Standard"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 dark:text-gray-300 font-medium text-xs">Category</label>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isCustomCategory;
                        setIsCustomCategory(next);
                        if (next) {
                          setCustomCategoryInput(newProductCategory === "__NEW_CUSTOM_CATEGORY__" ? "" : newProductCategory);
                        }
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-mono transition-colors cursor-pointer"
                    >
                      {isCustomCategory ? "← Select standard" : "+ Type custom category"}
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <div>
                      <input
                        type="text"
                        required
                        list="seller-categories-datalist"
                        value={customCategoryInput}
                        onChange={(e) => {
                          setCustomCategoryInput(e.target.value);
                          setNewProductCategory(e.target.value);
                        }}
                        placeholder="Type any category (e.g. IT, Safety, Medical...)"
                        className="w-full rounded-xl border border-blue-500 bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                        autoFocus
                      />
                      <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-1">Supports any arbitrary category name</p>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={newProductCategory}
                        onChange={(e) => {
                          if (e.target.value === "__NEW_CUSTOM_CATEGORY__") {
                            setIsCustomCategory(true);
                            setCustomCategoryInput("");
                            setNewProductCategory("");
                          } else {
                            setNewProductCategory(e.target.value);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
                      >
                        {uniqueCatalogCategories.length > 0 && (
                          <optgroup label="Your Catalog Categories">
                            {uniqueCatalogCategories.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Standard Industry Categories">
                          {standardIndustryCategories
                            .filter((c) => !uniqueCatalogCategories.includes(c))
                            .map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </optgroup>
                        <option value="__NEW_CUSTOM_CATEGORY__" className="text-blue-600 dark:text-blue-400 font-bold">
                          + Enter Custom Category Name…
                        </option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={newProductSku}
                    onChange={(e) => setNewProductSku(e.target.value)}
                    placeholder="DW-DSK-99"
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Initial Stock Units</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductStock}
                    onChange={(e) => setNewProductStock(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductLeadDays}
                    onChange={(e) => setNewProductLeadDays(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Base Price / Unit (₹)</label>
                  <input
                    type="number"
                    min="100"
                    value={newProductBasePrice}
                    onChange={(e) => setNewProductBasePrice(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Floor Price / Unit (₹)</label>
                  <input
                    type="number"
                    min="100"
                    value={newProductFloorPrice}
                    onChange={(e) => setNewProductFloorPrice(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Material / Finish</label>
                <input
                  type="text"
                  value={newProductMaterial}
                  onChange={(e) => setNewProductMaterial(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#182033] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="rounded-xl px-4 py-2 text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-2 font-semibold text-white shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: SELLER REGISTRATION MODAL */}
      {/* ============================================================== */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#1B2335] bg-white dark:bg-[#0D1322] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#182033]">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Supplier Registration
              </h3>
              {seller.isRegistered && (
                <button onClick={() => setIsRegisterOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Business Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Apex Industrial Supplies Ltd"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Corporate Registration No.</label>
                <input
                  type="text"
                  required
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="CORP-B2B-10928"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">GSTIN / Tax ID</label>
                <input
                  type="text"
                  required
                  value={regGstin}
                  onChange={(e) => setRegGstin(e.target.value)}
                  placeholder="29AABCS1429B1Z8"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Primary Category</label>
                <input
                  type="text"
                  required
                  list="seller-categories-datalist"
                  value={regCategory}
                  onChange={(e) => setRegCategory(e.target.value)}
                  placeholder="Educational Furniture, Hardware, etc."
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              {/* Datalist for dynamic autocomplete across n categories */}
              <datalist id="seller-categories-datalist">
                {dynamicCategories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>

              <div>
                <label className="text-slate-700 dark:text-gray-300 font-medium block mb-1">Contact Email</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="sales@company.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-[#1E2638] bg-white dark:bg-[#080C16] px-3.5 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#182033] flex justify-end">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-2.5 font-semibold text-white shadow-md shadow-blue-600/30 cursor-pointer"
                >
                  Confirm & Activate Seller Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Negotiation & Spec Inspection Modal */}
      <NegotiationDetailModal
        isOpen={!!inspectingQuote}
        onClose={() => setInspectingQuote(null)}
        quotation={inspectingQuote?.quote || null}
        initialViewMode={inspectingQuote?.mode || "chat"}
        onApprove={(id) => {
          approveQuote(id);
          setInspectingQuote(null);
        }}
        onReject={(id) => {
          rejectQuote(id);
          setInspectingQuote(null);
        }}
        isSellerView={true}
      />

    </div>
  );
};
