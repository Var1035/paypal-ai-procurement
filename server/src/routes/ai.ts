import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";
import { generateIntakeAnalysis, type IntakeAnalysisInput, type IntakeAnalysisOutput } from "../services/ollama.js";

export const aiRouter = Router();

const ChatMessageSchema = z.object({
  message: z.string().min(1, "Message is required"),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .default([]),
  buyerName: z.string().default("Buyer"),
  selectedSellerId: z.string().optional(),
  existingQuantity: z.number().nullable().optional(),
  existingBudget: z.number().nullable().optional(),
  existingDeliveryDays: z.number().nullable().optional(),
});

interface ExtractedParams {
  quantity: number | null;
  budget: number | null;
  deliveryDays: number | null;
  productKeywords: string[];
}

/**
 * Extracts structured parameters from natural language text
 * Supports Indian numbering formats (Lakh, Crore), currency symbols (₹, Rs, INR),
 * colloquial phrases ("for all 1000 units was 1 Lakh"), and delivery days.
 */
function extractFieldsFromText(text: string): Partial<ExtractedParams> {
  const lower = text.toLowerCase();
  const result: Partial<ExtractedParams> = {};

  // 1. Quantity extraction
  // Matches: "1000 units", "1000 pieces", "1000 pcs", "1000 desks", "for all 1000 units", "need 1000", "qty 1000", "quantity: 1000"
  const qtyPatterns = [
    /(?:need|want|order|buy|procure|request|for all|quantity[:\s]*|qty[:\s]*)\s*(\d+)\s*(?:units?|pieces?|pcs|nos?\.?|items?|desks?|chairs?|tables?|sets?)?/i,
    /(\d+)\s*(?:units?|pieces?|pcs|nos?\.?|items?|desks?|chairs?|tables?|sets?)/i,
  ];
  for (const pat of qtyPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const q = parseInt(m[1], 10);
      if (q > 0 && q < 1000000) {
        result.quantity = q;
        break;
      }
    }
  }

  // 2. Budget extraction (Handles ₹, Rs, INR, Lakh, Lac, Crore, Cr, k, and comma numbers)
  // e.g. "1 Lakh", "1.5 Lakhs", "10 lakh", "2.5 lac", "1 Crore", "50k", "₹1,00,000", "budget was 1 Lakh"
  const lakhMatch = text.match(/([\d.]+)\s*(?:lakhs?|lacs?)\b/i);
  const croreMatch = text.match(/([\d.]+)\s*(?:crores?|cr)\b/i);
  const kMatch = text.match(/([\d.]+)\s*k\b/i);

  if (lakhMatch) {
    result.budget = Math.round(parseFloat(lakhMatch[1]) * 100000);
  } else if (croreMatch) {
    result.budget = Math.round(parseFloat(croreMatch[1]) * 10000000);
  } else if (kMatch) {
    result.budget = Math.round(parseFloat(kMatch[1]) * 1000);
  } else {
    // Check for currency symbols or budget keywords followed by number
    const budgetPatterns = [
      /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i,
      /budget(?:[\s\w]*?(?:is|was|of|around|approx|approximately))?[:\s]*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
      /(?:total|target|max(?:imum)?)\s*(?:budget|price|cost)?[:\s]*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)/i,
    ];
    for (const pat of budgetPatterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        const val = parseFloat(m[1].replace(/,/g, ""));
        if (!isNaN(val) && val > 0) {
          result.budget = Math.round(val);
          break;
        }
      }
    }
  }

  // 3. Delivery timeline (Days)
  // Matches: "within 13 days", "within 13 days including delivery", "in 13 days", "13 days", "13 business days"
  const daysMatch = text.match(/(\d+)\s*(?:business\s*|working\s*)?(?:days?|d)\b/i);
  if (daysMatch) {
    result.deliveryDays = parseInt(daysMatch[1], 10);
  }

  // 4. Product keywords
  const kw = extractProductKeywords(text);
  if (kw.length > 0) {
    result.productKeywords = kw;
  }

  return result;
}

/**
 * Accumulates parameters across previous conversation turns + current message.
 * This guarantees the agent never forgets information the user already provided!
 */
function accumulateParameters(
  currentMessage: string,
  conversationHistory: { role: string; content: string }[],
  contextDefaults?: { quantity?: number | null; budget?: number | null; deliveryDays?: number | null }
): ExtractedParams {
  let quantity: number | null = contextDefaults?.quantity || null;
  let budget: number | null = contextDefaults?.budget || null;
  let deliveryDays: number | null = contextDefaults?.deliveryDays || null;
  let productKeywords: string[] = [];

  // 1. Process previous user messages in chronological order
  for (const entry of conversationHistory) {
    if (entry.role === "user") {
      const extracted = extractFieldsFromText(entry.content);
      if (extracted.quantity != null) quantity = extracted.quantity;
      if (extracted.budget != null) budget = extracted.budget;
      if (extracted.deliveryDays != null) deliveryDays = extracted.deliveryDays;
      if (extracted.productKeywords && extracted.productKeywords.length > 0) {
        productKeywords = Array.from(new Set([...productKeywords, ...extracted.productKeywords]));
      }
    }
  }

  // 2. Process the current incoming message (can fill or update parameters)
  const currentExtracted = extractFieldsFromText(currentMessage);
  if (currentExtracted.quantity != null) quantity = currentExtracted.quantity;
  if (currentExtracted.budget != null) budget = currentExtracted.budget;
  if (currentExtracted.deliveryDays != null) deliveryDays = currentExtracted.deliveryDays;
  if (currentExtracted.productKeywords && currentExtracted.productKeywords.length > 0) {
    productKeywords = Array.from(new Set([...productKeywords, ...currentExtracted.productKeywords]));
  }

  return {
    quantity,
    budget,
    deliveryDays,
    productKeywords,
  };
}

/**
 * POST /api/ai/chat
 * Conversational AI intake endpoint with full multi-turn parameter persistence.
 */
aiRouter.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ChatMessageSchema.parse(req.body);

    // -------------------------------------------------------------------
    // Step 1: Accumulate structured fields across all conversation turns
    // -------------------------------------------------------------------
    const accumulated = accumulateParameters(
      body.message,
      body.conversationHistory,
      {
        quantity: body.existingQuantity,
        budget: body.existingBudget,
        deliveryDays: body.existingDeliveryDays,
      }
    );

    const { quantity, budget, deliveryDays, productKeywords } = accumulated;

    // -------------------------------------------------------------------
    // Step 2: Search Supabase for matching products in the catalog
    // -------------------------------------------------------------------
    let matchingProducts: any[] = [];
    let allProducts: any[] = [];

    if (supabase) {
      let query = supabase
        .from("supplier_products")
        .select(`
          *,
          businesses (id, name, email, is_verified, gstin, reg_no)
        `)
        .eq("is_active", true);

      if (body.selectedSellerId && body.selectedSellerId !== "all") {
        query = query.eq("business_id", body.selectedSellerId);
      }

      const { data: products, error } = await query;

      if (!error && products) {
        allProducts = products;

        // Filter by keyword relevance
        if (productKeywords.length > 0) {
          matchingProducts = products.filter((p: any) => {
            const searchable = `${p.name} ${p.category} ${p.material || ""} ${p.sku} ${p.businesses?.name || ""}`.toLowerCase();
            return productKeywords.some((kw) => searchable.includes(kw));
          });
        }

        // If no keyword match found, return all products as potential matches
        if (matchingProducts.length === 0) {
          matchingProducts = products;
        }
      }
    }

    // -------------------------------------------------------------------
    // Step 3: Determine genuinely missing fields
    // -------------------------------------------------------------------
    const missingFields: string[] = [];
    if (!quantity) missingFields.push("quantity");
    if (!budget) missingFields.push("budget");
    if (!deliveryDays) missingFields.push("delivery_timeline");
    if (productKeywords.length === 0) missingFields.push("specific_product_type");

    // Build conversation text for LLM
    const fullConversation = body.conversationHistory.map(
      (m) => `${m.role === "user" ? "Buyer" : "Agent"}: ${m.content}`
    ).join("\n");

    // Build the structured catalog summary for the LLM
    const catalogSummary = matchingProducts.slice(0, 10).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sku: p.sku,
      basePrice: Number(p.base_price),
      floorPrice: Number(p.floor_price),
      inStock: p.in_stock,
      leadDays: p.lead_days,
      material: p.material || "N/A",
      onTimeRate: Number(p.on_time_rate || 95),
      supplier: p.businesses?.name || "Verified Supplier",
      supplierVerified: p.businesses?.is_verified ?? true,
    }));

    // -------------------------------------------------------------------
    // Step 4: Call Ollama or fallback to deterministic response
    // -------------------------------------------------------------------
    const intakeInput: IntakeAnalysisInput = {
      userMessage: body.message,
      conversationHistory: fullConversation,
      extractedFields: {
        quantity,
        budget,
        deliveryDays,
        productKeywords,
      },
      missingFields,
      catalogMatches: catalogSummary,
      totalCatalogProducts: allProducts.length,
      buyerName: body.buyerName,
    };

    let aiResponse: IntakeAnalysisOutput;

    // If all critical fields are captured, or only 1 is missing with catalog matches, prioritize immediate analysis
    if (missingFields.length === 0) {
      aiResponse = buildDeterministicResponse(intakeInput);
    } else {
      try {
        aiResponse = await generateIntakeAnalysis(intakeInput);
      } catch (err) {
        aiResponse = buildDeterministicResponse(intakeInput);
      }
    }

    // -------------------------------------------------------------------
    // Step 5: Return the response with real data and accumulated parameters
    // -------------------------------------------------------------------
    res.status(200).json({
      success: true,
      response: aiResponse.message,
      type: aiResponse.type, // "clarification" | "analysis" | "ready_to_negotiate"
      extractedFields: {
        quantity,
        budget,
        deliveryDays,
        productKeywords,
      },
      missingFields,
      catalogMatches: aiResponse.type !== "clarification" ? catalogSummary : undefined,
      matchCount: matchingProducts.length,
      totalCatalogProducts: allProducts.length,
      structuredAnalysis: aiResponse.structuredAnalysis || null,
      suggestedQuestions: aiResponse.suggestedQuestions || [],
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Extracts meaningful product-related keywords from user input
 * Normalizes multi-word variants (e.g. "class room" -> "classroom")
 */
function extractProductKeywords(message: string): string[] {
  const normalized = message
    .toLowerCase()
    .replace(/\bclass\s+rooms?\b/g, "classroom")
    .replace(/\bwork\s+stations?\b/g, "workstation")
    .replace(/\bwhite\s+boards?\b/g, "whiteboard");

  const keywords: string[] = [];

  const productTypes = [
    "classroom", "desk", "table", "chair", "furniture", "cabinet", "shelf", "rack",
    "stool", "bench", "bookcase", "locker", "whiteboard", "board",
    "workstation", "cubicle", "pod", "seating", "sofa", "lounge",
    "computer", "laptop", "monitor", "printer", "scanner", "hardware", "server",
    "pen", "pencil", "notebook", "paper", "stationery",
    "study", "office", "school", "lab", "library",
    "wood", "metal", "steel", "plastic", "ergonomic",
  ];

  for (const type of productTypes) {
    if (normalized.includes(type)) {
      keywords.push(type);
    }
  }

  return keywords;
}

/**
 * Builds a deterministic response without asking redundant questions
 */
function buildDeterministicResponse(input: IntakeAnalysisInput): IntakeAnalysisOutput {
  const { missingFields, catalogMatches, extractedFields } = input;

  // 1. If ALL fields are captured (or 0 missing)
  if (missingFields.length === 0) {
    if (catalogMatches.length > 0) {
      const top = catalogMatches.slice(0, 5);
      const summaryItems = top.map((m: any, i: number) => 
        `${i + 1}. ${m.name} by ${m.supplier}\n   • Unit Price: ₹${m.basePrice.toLocaleString()} | Stock: ${m.inStock} units | Lead: ${m.leadDays} days | Material: ${m.material}`
      ).join("\n\n");

      return {
        type: "ready_to_negotiate",
        message: `I have analyzed your requirements (${extractedFields.quantity ? `${extractedFields.quantity} units` : ""}${extractedFields.budget ? ` • Budget: ₹${extractedFields.budget.toLocaleString()}` : ""}${extractedFields.deliveryDays ? ` • Delivery: ${extractedFields.deliveryDays} days` : ""}) and identified ${catalogMatches.length} matching products from our verified supplier catalog.\n\n${summaryItems}\n\nAll candidate suppliers are ready. Would you like to proceed with automated agent negotiation or contact these suppliers?`,
        structuredAnalysis: {
          matchCount: catalogMatches.length,
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

  // 2. If only 1 field is missing
  if (missingFields.length === 1) {
    const missing = missingFields[0];
    let question = "Could you provide additional specifications?";
    if (missing === "quantity") question = "How many units do you need?";
    if (missing === "budget") question = "What is your approximate total budget or target per-unit price?";
    if (missing === "delivery_timeline") question = "When do you need delivery? (e.g., within 7, 10, or 14 days)";
    if (missing === "specific_product_type") question = "What specific type of product or material are you looking for?";

    const matchesPreview = catalogMatches.length > 0
      ? `\n\nI found ${catalogMatches.length} matching verified products in our catalog (such as ${catalogMatches[0].name} by ${catalogMatches[0].supplier} at ₹${catalogMatches[0].basePrice.toLocaleString()}/unit).`
      : "";

    return {
      type: "clarification",
      message: `Got it! Just one final detail needed to finalize supplier matching and volume discount calculation:${matchesPreview}\n\n• ${question}`,
      suggestedQuestions: [question],
    };
  }

  // 3. If 2 or more fields are missing
  if (missingFields.length >= 2) {
    const questions: string[] = [];
    if (missingFields.includes("quantity")) questions.push("How many units do you need?");
    if (missingFields.includes("budget")) questions.push("What is your approximate budget?");
    if (missingFields.includes("delivery_timeline")) questions.push("When do you need delivery? (e.g., within 7 days)");
    if (missingFields.includes("specific_product_type")) questions.push("Can you specify the exact product type?");

    const matchesPrefix = catalogMatches.length > 0
      ? `I found ${catalogMatches.length} candidate products in our verified catalog. `
      : "";

    return {
      type: "clarification",
      message: `${matchesPrefix}To match you with the right verified suppliers and calculate accurate volume discounts, I need a couple of details:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`,
      suggestedQuestions: questions,
    };
  }

  // If catalog matches exist
  if (catalogMatches.length > 0) {
    return {
      type: "analysis",
      message: `I found ${catalogMatches.length} matching products from verified suppliers:\n\n${catalogMatches.slice(0, 5).map((m: any, i: number) => `${i + 1}. ${m.name} by ${m.supplier}\n   • Price: ₹${m.basePrice.toLocaleString()}/unit | Stock: ${m.inStock} | Lead: ${m.leadDays} days`).join("\n\n")}\n\nWould you like to start negotiation with any of these suppliers?`,
      structuredAnalysis: {
        matchCount: catalogMatches.length,
        topMatches: catalogMatches.slice(0, 5),
      },
      suggestedQuestions: [],
    };
  }

  return {
    type: "clarification",
    message: `I could not find any products matching your request in our current catalog of ${input.totalCatalogProducts} active items. Could you try describing what you need differently?`,
    suggestedQuestions: [
      "What specific product category are you looking for?",
      "Would you like to see all available products?",
    ],
  };
}
