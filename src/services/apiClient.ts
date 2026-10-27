import { type HealthResponse, HealthResponseSchema, type ApiErrorResponse } from "@shared/contracts";

export class ApiClientError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "/api") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorData = data as ApiErrorResponse | null;
        throw new ApiClientError(
          errorData?.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData?.code || "HTTP_ERROR",
          errorData?.details
        );
      }

      return data as T;
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        throw err;
      }
      const message = err instanceof Error ? err.message : "Network error";
      throw new ApiClientError(message, 0, "NETWORK_ERROR");
    }
  }

  /**
   * Health check endpoint
   */
  async getHealth(): Promise<HealthResponse> {
    const raw = await this.request<HealthResponse>("/health");
    const parsed = HealthResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiClientError(
        "Invalid health check response schema",
        500,
        "SCHEMA_VALIDATION_ERROR",
        parsed.error.issues
      );
    }
    return parsed.data;
  }

  // --- Suppliers & Guardrails ---
  async getSuppliers(): Promise<{ suppliers: any[] }> {
    return this.request<{ suppliers: any[] }>("/suppliers");
  }

  async registerSupplier(data: {
    name: string;
    regNo?: string;
    gstin?: string;
    category?: string;
    email?: string;
  }): Promise<{ success: boolean; businessId: string; message: string }> {
    return this.request("/suppliers/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getGuardrails(): Promise<{
    minMargin: number;
    maxRoundConcession: number;
    requireApprovalAbove: number;
    autoQuote: boolean;
  }> {
    return this.request("/suppliers/guardrails");
  }

  async updateGuardrails(data: {
    minMargin: number;
    maxRoundConcession: number;
    requireApprovalAbove: number;
    autoQuote: boolean;
  }): Promise<{ success: boolean }> {
    return this.request("/suppliers/guardrails", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // --- Products Catalog ---
  async getProducts(params?: { category?: string; search?: string; businessId?: string }): Promise<{ products: any[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== "All") query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    if (params?.businessId && params.businessId !== "all") query.set("businessId", params.businessId);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/products${qs}`);
  }

  async addProduct(data: {
    businessName?: string;
    name: string;
    sku: string;
    category: string;
    basePrice: number;
    floorPrice: number;
    inStock: number;
    leadDays: number;
    material?: string;
  }): Promise<{ success: boolean; product: any }> {
    return this.request("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async seedProducts(): Promise<{ success: boolean; count: number; message: string }> {
    return this.request("/products/seed", {
      method: "POST",
    });
  }

  // --- Procurement & Discovery ---
  async createProcurementRequest(data: {
    buyerName?: string;
    itemName: string;
    category: string;
    quantity: number;
    maxBudget: number;
    deadlineDays: number;
    deliveryLocation?: string;
  }): Promise<{ success: boolean; requestId: string; request: any }> {
    return this.request("/procurement/request", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async discoverSuppliers(data: {
    itemName: string;
    quantity: number;
    maxBudget: number;
    deadlineDays: number;
  }): Promise<{
    totalCandidates: number;
    eligibleCandidates: number;
    matches: any[];
  }> {
    return this.request("/procurement/discover", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async approveContact(data: {
    requestId: string;
    businessId: string;
    approved: boolean;
  }): Promise<{ success: boolean; approval: any }> {
    return this.request("/procurement/approve-contact", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // --- Multi-Agent Bounded Negotiation ---
  async initiateNegotiation(data: {
    productId: string;
    quantity: number;
    buyerTargetPrice: number;
    buyerName?: string;
    strategy?: "aggressive" | "balanced" | "speed_first";
  }): Promise<{
    success: boolean;
    quotationId: string;
    finalUnitPrice: number;
    totalValue: number;
    marginAchieved: number;
    transcript: any[];
    status: string;
  }> {
    return this.request("/negotiation/initiate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * Conversational AI Sourcing Chat
   * Sends user's message + conversation history to the AI intake agent.
   * The agent checks the Supabase catalog and either asks clarifying questions
   * or returns structured analysis with real product data.
   */
  async aiChat(data: {
    message: string;
    conversationHistory: { role: "user" | "assistant"; content: string }[];
    buyerName?: string;
    selectedSellerId?: string;
    existingQuantity?: number | null;
    existingBudget?: number | null;
    existingDeliveryDays?: number | null;
  }): Promise<{
    success: boolean;
    response: string;
    type: "clarification" | "analysis" | "ready_to_negotiate";
    extractedFields: {
      quantity: number | null;
      budget: number | null;
      deliveryDays: number | null;
      productKeywords: string[];
    };
    missingFields: string[];
    catalogMatches?: any[];
    matchCount: number;
    totalCatalogProducts: number;
    structuredAnalysis?: any;
    suggestedQuestions: string[];
  }> {
    return this.request("/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }


  async getQuotations(params?: { businessId?: string; buyerName?: string }): Promise<{ quotations: any[] }> {
    const query = new URLSearchParams();
    if (params?.businessId && params.businessId !== "all") query.set("businessId", params.businessId);
    if (params?.buyerName && params.buyerName !== "all") query.set("buyerName", params.buyerName);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<{ quotations: any[] }>(`/negotiation/quotations${qs}`);
  }

  async approveQuotation(id: string): Promise<{ success: boolean; quotation: any }> {
    return this.request(`/negotiation/quotations/${id}/approve`, {
      method: "PUT",
    });
  }

  async rejectQuotation(id: string): Promise<{ success: boolean; quotation: any }> {
    return this.request(`/negotiation/quotations/${id}/reject`, {
      method: "PUT",
    });
  }

  async clearAllQuotations(): Promise<{ success: boolean; message: string }> {
    return this.request("/negotiation/quotations", {
      method: "DELETE",
    });
  }

  async deleteQuotation(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/negotiation/quotations/${id}`, {
      method: "DELETE",
    });
  }

  async takeoverNegotiation(quotationId: string, sellerName?: string): Promise<{ success: boolean; message: string; auditMsg: any }> {
    return this.request("/negotiation/takeover", {
      method: "POST",
      body: JSON.stringify({ quotationId, sellerName }),
    });
  }

  async handoverNegotiation(quotationId: string, sellerName?: string): Promise<{ success: boolean; message: string; auditMsg: any }> {
    return this.request("/negotiation/handover", {
      method: "POST",
      body: JSON.stringify({ quotationId, sellerName }),
    });
  }

  async sendNegotiationMessage(data: {
    quotationId: string;
    sender: string;
    message: string;
    price?: number;
    round?: number;
    isHumanSeller?: boolean;
  }): Promise<{ success: boolean; message: any; learningNote?: string }> {
    return this.request("/negotiation/message", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // --- Orders & Deal Flow ---
  async getOrders(params?: { type?: string; stage?: string; businessId?: string; counterparty?: string }): Promise<{ orders: any[]; count: number }> {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.stage && params.stage !== "All") query.set("stage", params.stage);
    if (params?.businessId && params.businessId !== "all") query.set("businessId", params.businessId);
    if (params?.counterparty && params.counterparty !== "all") query.set("counterparty", params.counterparty);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request(`/orders${qs}`);
  }

  async createOrder(data: {
    title: string;
    counterparty: string;
    value: number;
    dueDate?: string;
    type?: "buying" | "selling";
  }): Promise<{ success: boolean; order: any }> {
    return this.request("/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateOrderStage(id: string, stage: string, health?: string): Promise<{ success: boolean; order: any }> {
    return this.request(`/orders/${id}/stage`, {
      method: "PUT",
      body: JSON.stringify({ stage, health }),
    });
  }

  // --- FalkorDB Graph Database ---
  async getGraphTopology(): Promise<{ nodes: any[]; edges: any[]; count: number }> {
    return this.request("/graph/topology");
  }

  async executeGraphQuery(query: string): Promise<{
    success: boolean;
    data: any[];
    statistics: any;
    count: number;
    error?: string;
  }> {
    return this.request("/graph/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    });
  }

  async syncGraph(): Promise<{
    success: boolean;
    nodesCount: number;
    edgesCount: number;
    message: string;
  }> {
    return this.request("/graph/sync", {
      method: "POST",
    });
  }

  // --- PayPal Escrow & Payments ---
  async getPaymentConfig(): Promise<{
    configured: boolean;
    clientId: string | null;
    currency: string;
    mode: "sandbox" | "live";
  }> {
    return this.request("/payments/config");
  }

  async createPayPalOrder(data: {
    orderId?: string;
    quotationId?: string;
    amount: number;
    currency?: string;
    title: string;
  }): Promise<{
    success: boolean;
    orderId: string;
    status: string;
    approvalUrl?: string;
  }> {
    return this.request("/payments/create-order", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async capturePayPalOrder(data: {
    paypalOrderId: string;
    orderId?: string;
  }): Promise<{
    success: boolean;
    captureId: string;
    status: string;
    paymentRecordId?: string;
    message: string;
  }> {
    return this.request("/payments/capture-order", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPaymentHistory(): Promise<{ payments: any[] }> {
    return this.request("/payments/history");
  }
}

export const api = new ApiClient();
