import { env } from "../config/env.js";

export interface OllamaProbeResult {
  ok: boolean;
  message: string;
  models: string[];
}

export interface IntakeAnalysisInput {
  userMessage: string;
  conversationHistory: string;
  extractedFields: {
    quantity: number | null;
    budget: number | null;
    deliveryDays: number | null;
    productKeywords: string[];
  };
  missingFields: string[];
  catalogMatches: any[];
  totalCatalogProducts: number;
  buyerName: string;
}

export interface IntakeAnalysisOutput {
  type: "clarification" | "analysis" | "ready_to_negotiate";
  message: string;
  structuredAnalysis?: {
    matchCount: number;
    topMatches: any[];
  };
  suggestedQuestions?: string[];
}

export interface BuyerTurnInput {
  productName: string;
  category: string;
  quantity: number;
  basePrice: number;
  lastSellerPrice?: number; // Latest price quoted by the seller
  buyerTargetPrice: number;
  strategy: "aggressive" | "balanced" | "speed_first";
  roundNumber: number;      // Dynamic round number
  totalRoundsSoFar: number; // How many rounds have occurred
  history: { round: number; sender: string; message: string; price: number }[];
}

export interface BuyerTurnOutput {
  proposedPrice: number;
  message: string;
  rationale?: string;
  usedModel: string;
  wantsToAccept: boolean; // Whether buyer agent thinks the deal is acceptable
}

export interface SellerTurnInput {
  productName: string;
  quantity: number;
  basePrice: number;
  floorPrice: number;
  leadDays: number;
  maxConcessionPercent: number;
  buyerProposedPrice: number;
  roundNumber: number;      // Dynamic round number
  totalRoundsSoFar: number; // How many rounds have occurred
  history: { round: number; sender: string; message: string; price: number }[];
  sellerFalkorHistory?: string; // Strictly for the SELLER agent based on past FalkorDB data
}

export interface SellerTurnOutput {
  proposedPrice: number;
  message: string;
  concessions?: string[];
  usedModel: string;
  wantsToAccept: boolean; // Whether seller agent thinks the deal is acceptable
}

/**
 * Strips DeepSeek-R1 reasoning tags and markdown bold/italic formatting
 * to ensure agent replies look human and natural.
 */
function cleanModelResponse(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Remove markdown code fences if wrapped in ```json ... ``` or ```
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/```$/i, "").trim();
  // Strip markdown bold and italic formatting for human-like conversational chat
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "");
  return cleaned.trim();
}

/**
 * Test connectivity to local Ollama instance and discover available models
 */
export async function testOllamaConnection(): Promise<OllamaProbeResult> {
  try {
    const baseUrl = env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const res = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return {
        ok: false,
        message: `Ollama returned HTTP ${res.status}`,
        models: [],
      };
    }

    const data: any = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name);

    return {
      ok: true,
      message: `Connected to Ollama (${models.length} models installed) - Buyer: ${env.BUYER_AGENT_MODEL} | Seller: ${env.SELLER_AGENT_MODEL}`,
      models,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to connect to Ollama server",
      models: [],
    };
  }
}

/**
 * Call Ollama generate endpoint with timeout
 */
async function callOllama(model: string, systemPrompt: string, userPrompt: string, timeoutMs: number = 8000): Promise<string> {
  const baseUrl = env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 500,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  }

  const data: any = await res.json();
  return data.response || "";
}

/**
 * Generate conversational intake analysis using the buyer agent model.
 * This is the core "smart intake" function that decides whether to ask
 * clarifying questions or return a structured sourcing analysis.
 */
export async function generateIntakeAnalysis(input: IntakeAnalysisInput): Promise<IntakeAnalysisOutput> {
  const model = env.BUYER_AGENT_MODEL || "deepseek-r1:14b";

  const systemPrompt = `You are an intelligent procurement assistant for a B2B marketplace platform. Your role is to help buyers find the right products from verified suppliers.

CRITICAL RULES:
1. NEVER fabricate prices, product details, or supplier information. Only reference data provided in the catalog section below.
2. If the buyer's request is vague or missing critical information (quantity, budget, delivery timeline, or specific product type), you MUST ask clarifying questions FIRST before providing any pricing or analysis.
3. Be conversational, professional, and helpful. Ask one set of questions at a time, not everything at once.
4. When you have enough information, present the real catalog matches with accurate data.
5. Always acknowledge what the buyer has told you so far before asking for more.

RESPONSE FORMAT:
- If asking questions: Start with "I'd like to help you..." and ask 2-3 specific questions
- If providing analysis: Present the real product data from the catalog clearly
- Always be specific about what information you still need`;

  const catalogSection = input.catalogMatches.length > 0
    ? `\n\nAVAILABLE CATALOG PRODUCTS (real database data):\n${input.catalogMatches.map((m: any, i: number) =>
        `${i + 1}. "${m.name}" by ${m.supplier} — ₹${m.basePrice}/unit, Stock: ${m.inStock}, Lead: ${m.leadDays} days, Material: ${m.material}`
      ).join("\n")}`
    : `\n\nCATALOG: No matching products found in ${input.totalCatalogProducts} total active products.`;

  const userPrompt = `Buyer "${input.buyerName}" says: "${input.userMessage}"

EXTRACTED INFO SO FAR:
- Quantity: ${input.extractedFields.quantity ?? "NOT SPECIFIED"}
- Budget: ${input.extractedFields.budget ? `₹${input.extractedFields.budget.toLocaleString()}` : "NOT SPECIFIED"}
- Delivery Timeline: ${input.extractedFields.deliveryDays ? `${input.extractedFields.deliveryDays} days` : "NOT SPECIFIED"}
- Product Keywords: ${input.extractedFields.productKeywords.length > 0 ? input.extractedFields.productKeywords.join(", ") : "NONE DETECTED"}
- Missing Fields: ${input.missingFields.length > 0 ? input.missingFields.join(", ") : "All fields captured"}

PREVIOUS CONVERSATION:
${input.conversationHistory || "None — this is the first message."}
${catalogSection}

Based on the above, respond appropriately. If critical information is missing, ask clarifying questions. If you have enough information, present the catalog matches with real data.`;

  const timeoutMs = env.NODE_ENV === "test" ? 1000 : 30000;

  try {
    const raw = await callOllama(model, systemPrompt, userPrompt, timeoutMs);
    const cleaned = cleanModelResponse(raw);

    if (cleaned && cleaned.length > 10) {
      // Determine response type based on content and missing fields
      const isAskingQuestions = input.missingFields.length >= 2 ||
        cleaned.toLowerCase().includes("how many") ||
        cleaned.toLowerCase().includes("what quantity") ||
        cleaned.toLowerCase().includes("what is your budget") ||
        cleaned.toLowerCase().includes("could you") ||
        cleaned.toLowerCase().includes("can you specify") ||
        cleaned.toLowerCase().includes("please provide") ||
        cleaned.toLowerCase().includes("i need to know") ||
        cleaned.toLowerCase().includes("?");

      const type: IntakeAnalysisOutput["type"] =
        input.missingFields.length >= 2 ? "clarification" :
        input.catalogMatches.length > 0 && input.missingFields.length === 0 ? "ready_to_negotiate" :
        input.catalogMatches.length > 0 ? "analysis" : "clarification";

      return {
        type,
        message: cleaned.replace(/\n{3,}/g, "\n\n").slice(0, 1500),
        structuredAnalysis: type !== "clarification" && input.catalogMatches.length > 0
          ? {
              matchCount: input.catalogMatches.length,
              topMatches: input.catalogMatches.slice(0, 5),
            }
          : undefined,
        suggestedQuestions: type === "clarification"
          ? input.missingFields.map((f) => {
              switch (f) {
                case "quantity": return "How many units do you need?";
                case "budget": return "What is your total budget or target per-unit price?";
                case "delivery_timeline": return "When do you need delivery?";
                case "specific_product_type": return "What specific type of product are you looking for?";
                default: return `Please specify: ${f}`;
              }
            })
          : [],
      };
    }
  } catch (err) {
    // Fall through to deterministic fallback
  }

  // Deterministic fallback if Ollama fails
  return buildFallbackIntakeResponse(input);
}

function buildFallbackIntakeResponse(input: IntakeAnalysisInput): IntakeAnalysisOutput {
  // If ALL fields are captured (or 0 missing)
  if (input.missingFields.length === 0) {
    if (input.catalogMatches.length > 0) {
      const top = input.catalogMatches.slice(0, 5);
      const summaryItems = top.map((m: any, i: number) => 
        `${i + 1}. ${m.name} by ${m.supplier}\n   • Unit Price: ₹${m.basePrice.toLocaleString()} | Stock: ${m.inStock} units | Lead: ${m.leadDays} days | Material: ${m.material}`
      ).join("\n\n");

      return {
        type: "ready_to_negotiate",
        message: `I have analyzed your requirements (${input.extractedFields.quantity ? `${input.extractedFields.quantity} units` : ""}${input.extractedFields.budget ? ` • Budget: ₹${input.extractedFields.budget.toLocaleString()}` : ""}${input.extractedFields.deliveryDays ? ` • Delivery: ${input.extractedFields.deliveryDays} days` : ""}) and identified ${input.catalogMatches.length} matching products from our verified supplier catalog.\n\n${summaryItems}\n\nAll candidate suppliers are ready. Would you like to proceed with automated agent negotiation or contact these suppliers?`,
        structuredAnalysis: {
          matchCount: input.catalogMatches.length,
          topMatches: top,
        },
        suggestedQuestions: [
          "Initiate Agent Negotiation with top supplier",
          "Compare lead times across suppliers",
          "Request bulk discount terms"
        ],
      };
    }
  }

  // If only 1 field is missing
  if (input.missingFields.length === 1) {
    const missing = input.missingFields[0];
    let question = "Could you provide additional specifications?";
    if (missing === "quantity") question = "How many units do you need?";
    if (missing === "budget") question = "What is your approximate total budget or target per-unit price?";
    if (missing === "delivery_timeline") question = "When do you need delivery? (e.g., within 7, 10, or 14 days)";
    if (missing === "specific_product_type") question = "What specific type of product or material are you looking for?";

    const matchesPreview = input.catalogMatches.length > 0
      ? `\n\nI found ${input.catalogMatches.length} matching verified products in our catalog (such as ${input.catalogMatches[0].name} by ${input.catalogMatches[0].supplier} at ₹${input.catalogMatches[0].basePrice.toLocaleString()}/unit).`
      : "";

    return {
      type: "clarification",
      message: `Got it! Just one final detail needed to finalize supplier matching and volume discount calculation:${matchesPreview}\n\n• ${question}`,
      suggestedQuestions: [question],
    };
  }

  // If 2 or more fields are missing
  if (input.missingFields.length >= 2) {
    const questions: string[] = [];
    if (input.missingFields.includes("quantity")) questions.push("How many units do you need?");
    if (input.missingFields.includes("budget")) questions.push("What is your approximate budget?");
    if (input.missingFields.includes("delivery_timeline")) questions.push("When do you need delivery? (e.g., within 7 days)");
    if (input.missingFields.includes("specific_product_type")) questions.push("Can you specify the exact product type?");

    const matchesPrefix = input.catalogMatches.length > 0
      ? `I found ${input.catalogMatches.length} candidate products in our verified catalog. `
      : "";

    return {
      type: "clarification",
      message: `${matchesPrefix}To match you with the right verified suppliers and calculate accurate volume discounts, I need a couple of details:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
      suggestedQuestions: questions,
    };
  }

  if (input.catalogMatches.length > 0) {
    return {
      type: "analysis",
      message: `I found ${input.catalogMatches.length} matching products from verified suppliers:\n\n${input.catalogMatches.slice(0, 5).map((m: any, i: number) => `${i + 1}. ${m.name} by ${m.supplier}\n   • Price: ₹${m.basePrice.toLocaleString()}/unit | Stock: ${m.inStock} | Lead: ${m.leadDays} days`).join("\n\n")}\n\nWould you like to start negotiation with any of these suppliers?`,
      structuredAnalysis: {
        matchCount: input.catalogMatches.length,
        topMatches: input.catalogMatches.slice(0, 5),
      },
    };
  }

  return {
    type: "clarification",
    message: `I could not find matching products in our current catalog of ${input.totalCatalogProducts} active items. Could you describe what you are looking for in more detail?`,
    suggestedQuestions: ["What type of product do you need?", "Would you like to browse available categories?"],
  };
}

/**
 * Generate Buyer Agent counteroffer using DeepSeek-R1 (or configured buyer model)
 * SECURITY CONSTRAINT: Buyer Agent NEVER accesses FalkorDB directly or indirectly.
 * All formatting must be plain, human-like text without bold or italic asterisks.
 */
export async function generateBuyerTurn(input: BuyerTurnInput): Promise<BuyerTurnOutput> {
  const model = env.BUYER_AGENT_MODEL || "deepseek-r1:14b";
  const sellerOffer = input.lastSellerPrice || input.basePrice;

  // Buyer discount target based on procurement strategy (85% aggressive, 90% balanced, 95% speed)
  const discountMultiplier = input.strategy === "aggressive" ? 0.85 : input.strategy === "speed_first" ? 0.95 : 0.90;
  
  // Buyer ceiling should not exceed base price or buyer budget per unit
  const buyerCeiling = Math.min(input.basePrice, input.buyerTargetPrice);
  const idealTarget = Math.round(buyerCeiling * discountMultiplier);

  // If the supplier has already offered a rate at or below our ideal target, or within 4% of target:
  const gapToSeller = sellerOffer > 0 ? (sellerOffer - idealTarget) / sellerOffer : 1;
  const isAcceptableDeal = sellerOffer <= idealTarget || (sellerOffer <= buyerCeiling && (gapToSeller <= 0.04 || input.roundNumber >= 4));

  let effectiveTarget: number;
  let wantsToAccept = false;

  if (isAcceptableDeal) {
    effectiveTarget = sellerOffer;
    wantsToAccept = true;
  } else {
    // Incremental counteroffer moving toward sellerOffer, but STRICTLY below sellerOffer
    const concessionStep = Math.round((sellerOffer - idealTarget) * Math.min(0.7, 0.25 * (input.roundNumber / 2)));
    effectiveTarget = Math.min(sellerOffer - 25, idealTarget + concessionStep);
  }

  const systemPrompt = `You are an institutional procurement agent negotiating bulk purchasing contracts for educational and enterprise buyers.
Your goal is to secure favorable volume pricing based strictly on the buyer's requested batch volume, target budget, and delivery parameters.
The supplier's latest offered price is ₹${sellerOffer} / unit.
CRITICAL BIDDING RULE: NEVER offer a price higher than the supplier's current offer (₹${sellerOffer}/unit). Your counteroffer must be at or below ₹${effectiveTarget}/unit.
${wantsToAccept ? 'The supplier\'s price meets our criteria. You SHOULD accept the deal by stating acceptance and including "ACCEPT_DEAL".' : 'If the supplier\'s price is acceptable, include "ACCEPT_DEAL" to close the deal.'}
SECURITY RULE: You do NOT have access to internal seller databases or FalkorDB knowledge graphs. Never mention FalkorDB, graph queries, or internal margins.
CRITICAL FORMAT RULE: Speak naturally and conversationally like a human procurement professional. Do NOT use markdown asterisks (* or **), bolding, italics, or raw formatting tags. All responses must be clean, natural plain text.
Be professional, firm, and concise (2-3 sentences). State your proposed unit price clearly.`;

  const historyText = input.history.map((h) => `Round ${h.round} [${h.sender}]: ${h.message} (₹${h.price}/unit)`).join("\n");

  const userPrompt = `Product: ${input.productName} (${input.category})
Batch Quantity: ${input.quantity} units
Supplier's catalog base price: ₹${input.basePrice} / unit
Supplier's latest offer: ₹${sellerOffer} / unit
Negotiation Strategy: ${input.strategy}
Target Unit Price: ₹${effectiveTarget}
Current Round: ${input.roundNumber}
Commercial Justification: Bulk institutional order of ${input.quantity} units with prompt payment terms upon confirmation.

Conversation so far:
${historyText || "Supplier just submitted catalog quote."}

Task: Formulate your Round ${input.roundNumber} response proposing ₹${effectiveTarget} per unit${wantsToAccept ? " and accept the deal" : ""}. Write in natural conversational English without any markdown bold or italics.`;

  const timeoutMs = env.NODE_ENV === "test" ? 1000 : 20000;

  try {
    const raw = await callOllama(model, systemPrompt, userPrompt, timeoutMs);
    const cleaned = cleanModelResponse(raw);

    if (cleaned && cleaned.length > 10) {
      const modelAccepts = cleaned.includes("ACCEPT_DEAL") || cleaned.toLowerCase().includes("we accept") || cleaned.toLowerCase().includes("deal accepted") || wantsToAccept;
      const displayMessage = cleaned.replace(/ACCEPT_DEAL/gi, "").replace(/\n+/g, " ").trim().slice(0, 400);

      return {
        proposedPrice: modelAccepts ? sellerOffer : Math.min(sellerOffer - 10, effectiveTarget),
        message: displayMessage,
        usedModel: model,
        wantsToAccept: modelAccepts,
      };
    }
  } catch (err) {
    // Graceful fallback to deterministic policy if Ollama is slow/unreachable
  }

  if (wantsToAccept) {
    return {
      proposedPrice: sellerOffer,
      message: `We accept your revised commercial offer of ₹${sellerOffer.toLocaleString()} / unit for ${input.quantity} units. Please lock in these terms and initiate dispatch processing. (Round ${input.roundNumber})`,
      usedModel: `${model} (policy fallback)`,
      wantsToAccept: true,
    };
  }

  return {
    proposedPrice: effectiveTarget,
    message: `Counter-proposal: Based on our volume order of ${input.quantity} units, we propose ₹${effectiveTarget.toLocaleString()} / unit with standard commercial warranty and prompt settlement. (Round ${input.roundNumber})`,
    usedModel: `${model} (policy fallback)`,
    wantsToAccept: false,
  };
}

/**
 * Generate Supplier Agent defense using Qwen 2.5 14B (or configured seller model)
 * SELLER AGENT EXCLUSIVE: Sole consumer of FalkorDB historical intelligence.
 * Formulates pricing and concessions based on past seller orders and floor margins.
 * All formatting must be plain, human-like text without bold or italic asterisks.
 */
export async function generateSellerTurn(input: SellerTurnInput): Promise<SellerTurnOutput> {
  const model = env.SELLER_AGENT_MODEL || "qwen2.5:14b";

  // Dynamic concession that increases slightly with each round
  const roundConcession = Math.min(input.maxConcessionPercent * (input.roundNumber / 2), 0.15);
  const negotiatedTarget = Math.round(input.basePrice * (1 - roundConcession));
  const finalUnitPrice = Math.max(input.floorPrice, negotiatedTarget);

  // Check if buyer's price is acceptable
  const buyerAboveFloor = input.buyerProposedPrice >= input.floorPrice;
  const buyerMeetsTarget = input.buyerProposedPrice >= finalUnitPrice;
  const priceGap = Math.abs(finalUnitPrice - input.buyerProposedPrice);
  const gapPercent = finalUnitPrice > 0 ? (priceGap / finalUnitPrice) * 100 : 0;

  // Seller accepts if buyer offers at or above floor AND (meets target OR gap <= 3.5% OR after round 4)
  const wantsToAccept = buyerAboveFloor && (buyerMeetsTarget || gapPercent <= 3.5 || input.roundNumber >= 4);

  const systemPrompt = `You are an authorized sales & dispatch agent representing a verified manufacturer.
Your job is to defend gross margins and never violate the company's floor price (₹${input.floorPrice}) under any circumstances.
The buyer's current offer is ₹${input.buyerProposedPrice}/unit.
${wantsToAccept ? 'The buyer\'s offer is acceptable and meets margin requirements. Include "ACCEPT_DEAL" to close the sale.' : 'Propose a reasonable concession defended by production costs, never going below floor price.'}
You have EXCLUSIVE private access to internal FalkorDB historical clearing data and past deal intelligence for your business. Use this past data to formulate your pricing strategy, concessions, and counter-offers, but NEVER expose internal margin secrets or raw database internals directly.
CRITICAL FORMAT RULE: Speak naturally and conversationally like a human sales director in a clean business chat. Do NOT use markdown asterisks (* or **), bolding, italics, or raw formatting tags. All responses must be clean, natural plain text.
If conceding on price, include value-adds (e.g. priority ${input.leadDays}-day dispatch, extended 12-month commercial warranty, insured freight).
Keep your response concise (2-3 sentences), authoritative, and commercial.`;

  const historyText = input.history.map((h) => `Round ${h.round} [${h.sender}]: ${h.message} (₹${h.price}/unit)`).join("\n");

  const userPrompt = `Product: ${input.productName}
Quantity: ${input.quantity} units
Catalog Base Price: ₹${input.basePrice} / unit
Approved Negotiated Target: ₹${finalUnitPrice} / unit (Absolute Floor: ₹${input.floorPrice})
Lead Days: ${input.leadDays} days
Buyer's Latest Offer: ₹${input.buyerProposedPrice} / unit
Gap from target: ${gapPercent.toFixed(1)}%
Buyer above floor: ${buyerAboveFloor ? "YES" : "NO"}
Current Round: ${input.roundNumber}

Private FalkorDB Historical Deal Intelligence (Seller Exclusive):
${input.sellerFalkorHistory || "Historical index indicates standard batch concession of 3-7% with strict floor price defense."}

Conversation History:
${historyText}

Task: Deliver your Round ${input.roundNumber} commercial response at ₹${wantsToAccept ? Math.max(input.floorPrice, input.buyerProposedPrice) : finalUnitPrice} per unit. ${wantsToAccept ? "Accept the deal with ACCEPT_DEAL." : "Provide counteroffer."} Mention insured expedited shipping and standard warranty. Write in natural conversational English without any markdown bold or italics.`;

  const timeoutMs = env.NODE_ENV === "test" ? 1000 : 20000;

  try {
    const raw = await callOllama(model, systemPrompt, userPrompt, timeoutMs);
    const cleaned = cleanModelResponse(raw);

    if (cleaned && cleaned.length > 10) {
      const modelAccepts = cleaned.includes("ACCEPT_DEAL") ||
        cleaned.toLowerCase().includes("we accept") ||
        cleaned.toLowerCase().includes("agreed") ||
        wantsToAccept;
      const agreedPrice = modelAccepts ? Math.max(input.floorPrice, input.buyerProposedPrice) : finalUnitPrice;
      const displayMessage = cleaned.replace(/ACCEPT_DEAL/gi, "").replace(/\n+/g, " ").trim().slice(0, 400);

      return {
        proposedPrice: agreedPrice,
        message: displayMessage,
        concessions: ["Insured freight", `${input.leadDays}-day dispatch`],
        usedModel: model,
        wantsToAccept: modelAccepts,
      };
    }
  } catch (err) {
    // Graceful fallback to deterministic policy
  }

  if (wantsToAccept) {
    const agreedPrice = Math.max(input.floorPrice, input.buyerProposedPrice);
    return {
      proposedPrice: agreedPrice,
      message: `We accept your commercial rate of ₹${agreedPrice.toLocaleString()} / unit for ${input.quantity} units. Order confirmed with ${input.leadDays}-day express dispatch and standard warranty. (Round ${input.roundNumber})`,
      concessions: ["Insured freight", `${input.leadDays}-day dispatch`],
      usedModel: `${model} (policy fallback)`,
      wantsToAccept: true,
    };
  }

  const defaultMsg = finalUnitPrice <= input.floorPrice
    ? `Strict manufacturing limit reached: Based on verified material costs and past clearing levels, our lowest rate is ₹${finalUnitPrice.toLocaleString()} / unit with free insured ${input.leadDays}-day dispatch. (Round ${input.roundNumber})`
    : `Concession offered: Based on our past contract fulfillment volume and category benchmarks, we can offer ₹${finalUnitPrice.toLocaleString()} / unit (total ₹${(finalUnitPrice * input.quantity).toLocaleString()}). Includes insured freight and warranty. (Round ${input.roundNumber})`;

  return {
    proposedPrice: finalUnitPrice,
    message: defaultMsg,
    concessions: ["Insured freight", `${input.leadDays}-day dispatch`],
    usedModel: `${model} (policy fallback)`,
    wantsToAccept: false,
  };
}
