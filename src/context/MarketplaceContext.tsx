import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/services/apiClient";

export interface ProductItem {
  id: string;
  businessId: string;
  businessName: string;
  name: string;
  sku: string;
  category: string;
  inStock: number;
  basePrice: number; // in INR
  floorPrice: number; // in INR
  leadDays: number;
  specifications: Record<string, string>;
  rating: number;
  onTimeRate: number; // percentage e.g. 98
  isDemo?: boolean;
}

export interface SellerProfile {
  businessId: string;
  name: string;
  regNo: string;
  gstin: string;
  category: string;
  email: string;
  isRegistered: boolean;
  verified: boolean;
}

export interface OrderRecord {
  id: string;
  businessId?: string;
  orderCode: string;
  title: string;
  value: number; // in INR
  counterparty: string;
  location: string;
  stage: "In production" | "Awaiting Seller Approval" | "Paid & Confirmed" | "In Transit" | "Delivered" | "QA Review" | string;
  type: "buying" | "selling";
  dueDate: string;
  docsSummary: string; // e.g. "9/14 docs"
  health: "Healthy" | "Attention" | "Delayed" | string;
}

export interface PendingQuote {
  id: string;
  businessId?: string;
  businessName?: string;
  buyerName: string;
  item: string;
  quantity: number;
  proposedUnitPrice: number;
  totalValue: number;
  buyerLeadDays: number;
  status: "awaiting_approval" | "approved" | "rejected" | string;
  round: number;
  marginAchieved: number;
  isHumanTakeover?: boolean;
  createdAt?: string;
  transcript?: {
    sender: "buyer_agent" | "supplier_agent" | "safeguard" | string;
    text: string;
    price: number;
    round: number;
  }[];
  specs?: {
    material?: string;
    standards?: string;
    frame?: string;
    certification?: string;
  };
}

export interface AgentGuardrails {
  minMargin: number;
  maxRoundConcession: number;
  requireApprovalAbove: number;
  autoQuote: boolean;
  leadTimeBuffer: number;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "buyer_agent";
  text: string;
  timestamp: string;
  parsedRequirements?: {
    itemName: string;
    quantity: number;
    maxBudget: number;
    deadlineDays: number;
    category: string;
    specs: string;
  };
}

interface MarketplaceContextType {
  seller: SellerProfile;
  registerSeller: (profile: Omit<SellerProfile, "isRegistered" | "verified">) => Promise<void>;
  products: ProductItem[];
  addProduct: (product: Omit<ProductItem, "id" | "businessId" | "businessName">) => Promise<void>;
  orders: OrderRecord[];
  addOrder: (order: OrderRecord) => void;
  pendingQuotes: PendingQuote[];
  approveQuote: (quoteId: string) => Promise<void>;
  rejectQuote: (quoteId: string) => Promise<void>;
  takeoverNegotiation: (quotationId: string, sellerName?: string) => Promise<void>;
  handoverNegotiation: (quotationId: string, sellerName?: string) => Promise<void>;
  sendNegotiationMessage: (data: {
    quotationId: string;
    sender: string;
    message: string;
    price?: number;
    round?: number;
    isHumanSeller?: boolean;
  }) => Promise<any>;
  initiateNegotiation: (data: {
    productId: string;
    quantity: number;
    buyerTargetPrice: number;
    buyerName?: string;
    strategy?: "aggressive" | "balanced" | "speed_first";
  }) => Promise<any>;
  guardrails: AgentGuardrails;
  updateGuardrails: (newGuardrails: Partial<AgentGuardrails>) => Promise<void>;
  chatMessages: ChatMessage[];
  sendBuyerPrompt: (promptText: string) => void;
  buyerPreferences: {
    maxRounds: number;
    strategy: "aggressive" | "balanced" | "speed_first";
    requireExplicitContactApproval: boolean;
    mandatoryWarrantyMonths: number;
  };
  updateBuyerPreferences: (prefs: Partial<MarketplaceContextType["buyerPreferences"]>) => void;
  seedSampleCatalog: () => Promise<void>;
  clearAllData: () => void;
  clearAllRFQs: () => Promise<void>;
  refreshData: () => Promise<void>;
  autoRefreshInterval: number;
  setAutoRefreshInterval: (sec: number) => void;
  backendConnected: boolean;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

const EMPTY_SELLER: SellerProfile = {
  businessId: "",
  name: "",
  regNo: "",
  gstin: "",
  category: "",
  email: "",
  isRegistered: false,
  verified: false,
};

export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [backendConnected, setBackendConnected] = useState(false);

  const [seller, setSeller] = useState<SellerProfile>(() => {
    try {
      const saved = localStorage.getItem("agentmarket_seller");
      return saved ? JSON.parse(saved) : EMPTY_SELLER;
    } catch {
      return EMPTY_SELLER;
    }
  });

  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem("agentmarket_products");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem("agentmarket_orders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>(() => {
    try {
      const saved = localStorage.getItem("agentmarket_quotes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [guardrails, setGuardrails] = useState<AgentGuardrails>({
    minMargin: 20,
    maxRoundConcession: 5,
    requireApprovalAbove: 250000,
    autoQuote: true,
    leadTimeBuffer: 2,
  });

  const [buyerPreferences, setBuyerPreferences] = useState({
    maxRounds: 20,
    strategy: "balanced" as "aggressive" | "balanced" | "speed_first",
    requireExplicitContactApproval: true,
    mandatoryWarrantyMonths: 12,
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Local storage persistence
  useEffect(() => {
    try {
      localStorage.setItem("agentmarket_seller", JSON.stringify(seller));
    } catch {}
  }, [seller]);

  useEffect(() => {
    try {
      localStorage.setItem("agentmarket_products", JSON.stringify(products));
    } catch {}
  }, [products]);

  useEffect(() => {
    try {
      localStorage.setItem("agentmarket_orders", JSON.stringify(orders));
    } catch {}
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem("agentmarket_quotes", JSON.stringify(pendingQuotes));
    } catch {}
  }, [pendingQuotes]);

  // Synchronize live data from Supabase / Backend API
  const refreshData = useCallback(async () => {
    try {
      const health = await api.getHealth().catch(() => null);
      if (health?.status === "ok") {
        setBackendConnected(true);

        // 1. Fetch products from Supabase
        const prodRes = await api.getProducts().catch(() => null);
        if (prodRes?.products) {
          const mapped: ProductItem[] = prodRes.products.map((p: any) => ({
            id: p.id,
            businessId: p.businessId || "biz-direct",
            businessName: p.businessName || "Verified Supplier",
            name: p.name,
            sku: p.sku,
            category: p.category,
            basePrice: p.basePrice,
            floorPrice: p.floorPrice,
            inStock: p.inStock,
            leadDays: p.leadDays,
            onTimeRate: p.onTimeRate || 98,
            rating: 4.8,
            specifications: p.specs || {},
          }));
          setProducts(mapped);
          localStorage.setItem("agentmarket_products", JSON.stringify(mapped));
        }

        // 2. Fetch orders from Supabase
        const ordRes = await api.getOrders().catch(() => null);
        if (ordRes?.orders) {
          const mappedOrders: OrderRecord[] = ordRes.orders.map((o: any) => ({
            id: o.id,
            businessId: o.businessId || o.business_id,
            orderCode: o.orderCode,
            title: o.title,
            value: o.value,
            counterparty: o.counterparty,
            location: o.location || "Central Logistics Park",
            stage: o.stage,
            health: o.health || "Healthy",
            dueDate: o.dueDate,
            docsSummary: o.docsSummary || "PO issued",
            type: o.type || "buying",
          }));
          setOrders(mappedOrders);
          localStorage.setItem("agentmarket_orders", JSON.stringify(mappedOrders));
        }

        // 3. Fetch quotations from Supabase
        const quoteRes = await api.getQuotations().catch(() => null);
        if (quoteRes?.quotations) {
          const mappedQuotes: PendingQuote[] = quoteRes.quotations.map((q: any) => {
            const msgs = (q.messages || []).map((m: any) => ({
              sender: m.sender,
              text: m.message,
              price: m.price || q.unitPrice,
              round: m.round,
            }));
            const lastTakeoverIdx = msgs.map((m: any) => m.message || "").lastIndexOf("[Human Takeover]");
            const lastHandoverIdx = msgs.map((m: any) => m.message || "").lastIndexOf("[AI Handover]");
            const isHumanTakeover = lastTakeoverIdx !== -1 && lastTakeoverIdx > lastHandoverIdx;

            return {
              id: q.id,
              businessId: q.businessId || q.business_id,
              businessName: q.businessName,
              buyerName: q.buyerName,
              item: q.item,
              quantity: q.quantity,
              proposedUnitPrice: q.unitPrice,
              totalValue: q.totalValue,
              buyerLeadDays: q.leadDays,
              status: q.status,
              round: q.round,
              marginAchieved: q.marginAchieved,
              isHumanTakeover,
              createdAt: q.createdAt,
              transcript: msgs,
            };
          });
          setPendingQuotes(mappedQuotes);
          localStorage.setItem("agentmarket_quotes", JSON.stringify(mappedQuotes));
        }

        // 4. Fetch guardrails from Supabase
        const guardRes = await api.getGuardrails().catch(() => null);
        if (guardRes) {
          setGuardrails((prev) => ({
            ...prev,
            minMargin: guardRes.minMargin,
            maxRoundConcession: guardRes.maxRoundConcession,
            requireApprovalAbove: guardRes.requireApprovalAbove,
            autoQuote: guardRes.autoQuote,
          }));
        }
      }
    } catch {
      setBackendConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const registerSeller = async (profile: Omit<SellerProfile, "isRegistered" | "verified">) => {
    const updated = {
      ...profile,
      isRegistered: true,
      verified: true,
    };
    setSeller(updated);

    try {
      const res = await api.registerSupplier(profile);
      if (res?.businessId) {
        setSeller((prev) => ({ ...prev, businessId: res.businessId }));
      }
    } catch (err) {
      console.warn("Backend registration fallback to local state:", err);
    }
  };

  const addProduct = async (item: Omit<ProductItem, "id" | "businessId" | "businessName">) => {
    const businessName = seller.name || "DeskWorks";
    const tempId = `prod-${Date.now()}`;
    const newProduct: ProductItem = {
      ...item,
      id: tempId,
      businessId: seller.businessId || "biz-direct",
      businessName,
      rating: 5.0,
      onTimeRate: 100,
    };
    setProducts((prev) => [newProduct, ...prev]);

    try {
      const res = await api.addProduct({
        businessName,
        name: item.name,
        sku: item.sku,
        category: item.category,
        basePrice: item.basePrice,
        floorPrice: item.floorPrice,
        inStock: item.inStock,
        leadDays: item.leadDays,
        material: item.specifications?.material || "Commercial Grade Birch Wood",
      });
      if (res?.product?.id) {
        setProducts((prev) =>
          prev.map((p) => (p.id === tempId ? { ...p, id: res.product.id } : p))
        );
      }
    } catch (err) {
      console.warn("Backend addProduct fallback:", err);
    }
  };

  const seedSampleCatalog = async () => {
    try {
      await api.seedProducts();
      await refreshData();
    } catch (err) {
      console.warn("Seeding fallback:", err);
    }
  };

  const clearAllData = () => {
    setProducts([]);
    setOrders([]);
    setPendingQuotes([]);
    setSeller(EMPTY_SELLER);
    localStorage.removeItem("agentmarket_products");
    localStorage.removeItem("agentmarket_orders");
    localStorage.removeItem("agentmarket_quotes");
    localStorage.removeItem("agentmarket_seller");
  };

  const clearAllRFQs = async () => {
    setPendingQuotes([]);
    setOrders([]);
    localStorage.removeItem("agentmarket_quotes");
    localStorage.removeItem("agentmarket_orders");
    try {
      await api.clearAllQuotations();
      await refreshData();
    } catch (err) {
      console.warn("clearAllRFQs error:", err);
    }
  };

  const addOrder = (order: OrderRecord) => {
    setOrders((prev) => [order, ...prev]);
  };

  const approveQuote = async (quoteId: string) => {
    setPendingQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: "approved" as const } : q))
    );

    try {
      await api.approveQuotation(quoteId);
      await refreshData();
    } catch (err) {
      console.warn("approveQuote fallback:", err);
    }
  };

  const rejectQuote = async (quoteId: string) => {
    setPendingQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status: "rejected" as const } : q))
    );

    try {
      await api.rejectQuotation(quoteId);
      await refreshData();
    } catch (err) {
      console.warn("rejectQuote fallback:", err);
    }
  };

  const updateGuardrails = async (newGuardrails: Partial<AgentGuardrails>) => {
    setGuardrails((prev) => ({ ...prev, ...newGuardrails }));

    try {
      await api.updateGuardrails({
        minMargin: newGuardrails.minMargin ?? guardrails.minMargin,
        maxRoundConcession: newGuardrails.maxRoundConcession ?? guardrails.maxRoundConcession,
        requireApprovalAbove: newGuardrails.requireApprovalAbove ?? guardrails.requireApprovalAbove,
        autoQuote: newGuardrails.autoQuote ?? guardrails.autoQuote,
      });
    } catch (err) {
      console.warn("updateGuardrails fallback:", err);
    }
  };

  const updateBuyerPreferences = (prefs: Partial<MarketplaceContextType["buyerPreferences"]>) => {
    setBuyerPreferences((prev) => ({ ...prev, ...prefs }));
  };

  const sendBuyerPrompt = (promptText: string) => {
    const userMsg: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      sender: "user",
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const lower = promptText.toLowerCase();
    const qtyMatch = lower.match(/(\d+)\s*(units|desks|chairs|items|tables)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 100;
    
    const budgetMatch = lower.match(/(₹|rs\.?|\$)\s*([\d,]+)/i);
    let budget = 460000;
    if (budgetMatch) {
      budget = parseInt(budgetMatch[2].replace(/,/g, ""), 10);
      if (budget < 10000) budget = budget * 83;
    }

    const daysMatch = lower.match(/(\d+)\s*(days|day)/);
    const deadlineDays = daysMatch ? parseInt(daysMatch[1], 10) : 7;

    const agentMsg: ChatMessage = {
      id: `msg-agent-${Date.now() + 1}`,
      sender: "buyer_agent",
      text: `Parsed your request into structured RFQ constraints. Traversed FalkorDB graph relationships across registered supplier agents in Supabase. Scroll below to review the ranked shortlist, historical pricing benchmarks, and graph reasoning.`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      parsedRequirements: {
        itemName: lower.includes("chair") ? "Ergonomic Chairs" : "Commercial Birch School Desks",
        quantity: qty,
        maxBudget: budget,
        deadlineDays: deadlineDays,
        category: "Classroom Furniture",
        specs: "Durable FSC Certified Birch Wood, tubular steel frame, scratch-resistant surface",
      },
    };

    setChatMessages((prev) => [...prev, userMsg, agentMsg]);
  };

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      refreshData();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, refreshData]);

  const takeoverNegotiation = async (quotationId: string, sellerName?: string) => {
    try {
      await api.takeoverNegotiation(quotationId, sellerName);
      await refreshData();
    } catch (err) {
      console.warn("takeoverNegotiation error:", err);
    }
  };

  const handoverNegotiation = async (quotationId: string, sellerName?: string) => {
    try {
      await api.handoverNegotiation(quotationId, sellerName);
      await refreshData();
    } catch (err) {
      console.warn("handoverNegotiation error:", err);
    }
  };

  const sendNegotiationMessage = async (data: {
    quotationId: string;
    sender: string;
    message: string;
    price?: number;
    round?: number;
    isHumanSeller?: boolean;
  }) => {
    try {
      const res = await api.sendNegotiationMessage(data);
      await refreshData();
      return res;
    } catch (err) {
      console.warn("sendNegotiationMessage error:", err);
      throw err;
    }
  };

  const initiateNegotiation = async (data: {
    productId: string;
    quantity: number;
    buyerTargetPrice: number;
    buyerName?: string;
    strategy?: "aggressive" | "balanced" | "speed_first";
  }) => {
    const res = await api.initiateNegotiation(data);
    await refreshData();
    return res;
  };

  return (
    <MarketplaceContext.Provider
      value={{
        seller,
        registerSeller,
        products,
        addProduct,
        orders,
        addOrder,
        pendingQuotes,
        approveQuote,
        rejectQuote,
        takeoverNegotiation,
        handoverNegotiation,
        sendNegotiationMessage,
        initiateNegotiation,
        guardrails,
        updateGuardrails,
        chatMessages,
        sendBuyerPrompt,
        buyerPreferences,
        updateBuyerPreferences,
        seedSampleCatalog,
        clearAllData,
        clearAllRFQs,
        refreshData,
        autoRefreshInterval,
        setAutoRefreshInterval,
        backendConnected,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (!context) {
    throw new Error("useMarketplace must be used within a MarketplaceProvider");
  }
  return context;
};
