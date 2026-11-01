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
    // If the latest message introduces a specific product query, override previous keywords
    // so stale product searches do not pollute new inquiries
    productKeywords = currentExtracted.productKeywords;
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
          matchingProducts = products.filter((p: any) => matchesProduct(p, productKeywords));
        }
      }
    }

    // -------------------------------------------------------------------
    // Step 2b: Handle out-of-catalog product inquiry immediately
    // If the buyer asked for an item that is not in the database (e.g. beds,
    // laptops, footwear), apologize explicitly and recommend verified catalog items.
    // -------------------------------------------------------------------
    const isProductNotFound = productKeywords.length > 0 && matchingProducts.length === 0;

    if (isProductNotFound) {
      const primaryTerm = productKeywords[0];
      const notFoundResponse = buildProductNotFoundResponse(primaryTerm, allProducts);

      return res.status(200).json({
        success: true,
        response: notFoundResponse.message,
        type: "not_found",
        extractedFields: {
          quantity,
          budget,
          deliveryDays,
          productKeywords,
        },
        missingFields: ["product_not_in_catalog"],
        catalogMatches: [],
        matchCount: 0,
        totalCatalogProducts: allProducts.length,
        structuredAnalysis: null,
        suggestedQuestions: notFoundResponse.suggestedQuestions,
      });
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
 * Checks whether a catalog product matches any of the extracted search keywords/terms
 */
export function matchesProduct(product: any, terms: string[]): boolean {
  const searchable = `${product.name} ${product.category} ${product.material || ""} ${product.sku} ${product.businesses?.name || ""}`.toLowerCase();
  
  return terms.some((term) => {
    const t = term.toLowerCase().trim();
    if (!t) return false;

    // Direct substring match
    if (searchable.includes(t)) return true;

    // Singular form of plural term (e.g. "desks" -> "desk", "beds" -> "bed")
    if (t.endsWith("s") && searchable.includes(t.slice(0, -1))) return true;
    if (t.endsWith("es") && searchable.includes(t.slice(0, -2))) return true;

    // Plural form of singular term (e.g. "chair" -> "chairs")
    if (searchable.includes(`${t}s`) || searchable.includes(`${t}es`)) return true;

    // Multi-word matching (e.g. "school desks" matches if both "school" and "desk" exist)
    const words = t.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 1 && words.every((w) => {
      const root = w.endsWith("s") ? w.slice(0, -1) : w;
      return searchable.includes(root);
    })) {
      return true;
    }

    return false;
  });
}

/**
 * Builds an explicit, helpful advisory response when the user asks for a product
 * that does NOT exist in the Supabase catalog (e.g. beds, laptops, footwear).
 * Clearly states upfront that the product doesn't exist, and recommends existing catalog products.
 */
export function buildProductNotFoundResponse(searchedTerm: string, _allProducts?: any[]): IntakeAnalysisOutput {
  const displayTerm = searchedTerm ? `"${searchedTerm}"` : "the requested product";

  const categoryHighlights = [
    { name: "Educational & School Furniture", examples: "School Desks, Kids Study Desks, Study Tables, Classroom Chairs" },
    { name: "Office Desks & Workstations", examples: "Executive Desks, Office Desks, Workstation Desks, Aluminium Desks" },
    { name: "Ergonomic & Commercial Seating", examples: "Folding Chairs, Visitor Chairs, Static Chairs, Wheel Chairs, Lab Stools" },
    { name: "Lounge & Reception Seating", examples: "L-Shaped Sofas, Recliner Sofas" },
    { name: "Storage & Filing Systems", examples: "Heavy-duty Steel Almirahs, Storage Cabinets" },
  ];

  const recommendationsText = categoryHighlights
    .map((c) => `• **${c.name}**: ${c.examples}`)
    .join("\n");

  const message = `Sorry! The product doesn't exist in our database.\n\nWe currently do not have ${displayTerm} in our verified B2B supplier catalog. Our platform specializes in commercial, institutional, and office workspace furniture.\n\nHere are the product categories available in our catalog that you can explore:\n\n${recommendationsText}\n\nWould you like to explore any of these verified alternatives?`;

  return {
    type: "not_found",
    message,
    structuredAnalysis: undefined,
    suggestedQuestions: [
      "Show School Desks & Tables",
      "Show Office & Ergonomic Chairs",
      "Show Workstation Desks",
      "Show Storage Cabinets & Almirahs",
      "Show Lounge & Reception Sofas",
    ],
  };
}

/**
 * Extracts meaningful product-related keywords from user input
 * Handles explicit intent patterns ("looking for beds", "need 100 laptops", "do you have chairs"),
 * common out-of-catalog product queries (e.g., beds, mattress, electronics, clothing),
 * and standard in-catalog items.
 */
export function extractProductKeywords(message: string): string[] {
  const normalized = message
    .toLowerCase()
    .replace(/\bclass\s+rooms?\b/g, "classroom")
    .replace(/\bwork\s+stations?\b/g, "workstation")
    .replace(/\bwhite\s+boards?\b/g, "whiteboard");

  const keywords: string[] = [];

  // 1. Natural language intent patterns:
  // e.g. "looking for beds for my home", "need 50 laptops", "do you have double cots?", "show me study tables"
  const intentPatterns = [
    /(?:looking\s+for|search(?:ing)?\s+for|need(?:ing)?|want(?:ing)?|order(?:ing)?|buy(?:ing)?|procure(?:ment|s)?|interested\s+in|do\s+you\s+have|can\s+i\s+get|where\s+are\s+the|find|show\s+me)\s+(?:a\s+|an\s+|some\s+|any\s+|the\s+)?([a-z0-9\s\-]+?)(?:\s+for\s+(?:my|our|the|a|an)?|\s+in\s+|\s+with\s+|\s+under\s+|\s+within\s+|\s+at\s+|\s+qty|\s+quantity|\.|\?|!|$)/i,
    /(?:any\s+)([a-z0-9\s\-]+?)(?:\s+available|\s+in\s+stock|\.|\?|!|$)/i,
  ];

  for (const pat of intentPatterns) {
    const match = message.match(pat);
    if (match && match[1]) {
      const cleaned = match[1]
        .replace(/\b\d+\s*(?:units?|pcs|pieces?|items?|nos?\.?)?\b/gi, "")
        .replace(/\b(?:good|best|cheap|affordable|urgent|high\s+quality|quality)\b/gi, "")
        .trim();
      if (cleaned.length > 1 && !keywords.includes(cleaned)) {
        keywords.push(cleaned);
      }
    }
  }

  // 2. Comprehensive vocabulary bank of catalog products + out-of-catalog inquiries
  const productWordBank = [
    // Out-of-catalog common queries (home, electronics, apparel, etc.)
    "bed", "beds", "cot", "cots", "mattress", "mattresses", "bunk bed", "bunk beds", "pillow", "blanket",
    "laptop", "laptops", "computer", "computers", "mobile", "phone", "phones", "smartphone", "smartphones",
    "shoe", "shoes", "clothing", "clothes", "shirt", "shirts", "pant", "pants", "uniform", "uniforms",
    "tv", "television", "fridge", "refrigerator", "cooler", "ac", "air conditioner", "kitchen", "utensil",

    // In-catalog furniture items
    "desk", "desks", "chair", "chairs", "table", "tables", "stool", "stools",
    "bench", "benches", "sofa", "sofas", "couch", "couches", "almirah", "almirahs",
    "cabinet", "cabinets", "cupboard", "cupboards", "shelf", "shelves", "rack", "racks",
    "workstation", "workstations", "cubicle", "cubicles", "wheelchair", "wheelchairs",
    "whiteboard", "whiteboards", "board", "boards", "seating", "furniture",
    "classroom", "study", "office", "school", "lab", "library", "executive",
    "ergonomic", "folding", "visitor", "static", "recline", "recliner"
  ];

  for (const word of productWordBank) {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(normalized) && !keywords.includes(word)) {
      keywords.push(word);
    }
  }

  // 3. If still empty and input is short (1-4 words), treat meaningful nouns as product candidate
  if (keywords.length === 0) {
    const words = normalized
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) =>
        !["i", "im", "we", "my", "our", "the", "a", "an", "is", "are", "for", "in", "to", "at", "please", "can", "you", "me", "hi", "hello", "hey", "need", "want"].includes(w)
      );
    if (words.length > 0 && words.length <= 4) {
      keywords.push(words.join(" "));
    }
  }

  return keywords;
}

/**
 * Builds a deterministic response without asking redundant questions
 */
function buildDeterministicResponse(input: IntakeAnalysisInput): IntakeAnalysisOutput {
  const { missingFields, catalogMatches, extractedFields } = input;

  // 0. If product keywords were supplied but 0 catalog matches exist, return polite not_found response
  if (extractedFields.productKeywords && extractedFields.productKeywords.length > 0 && catalogMatches.length === 0) {
    return buildProductNotFoundResponse(extractedFields.productKeywords[0]);
  }

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

    const matchesPreview = catalogMatches.length > 0 && extractedFields.productKeywords.length > 0
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

    const matchesPrefix = catalogMatches.length > 0 && extractedFields.productKeywords.length > 0
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
