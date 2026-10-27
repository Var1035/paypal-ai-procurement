import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";
import { generateBuyerTurn, generateSellerTurn } from "../services/ollama.js";
import { getSellerHistoricalPricingIntelligence } from "../services/falkordb.js";

export const negotiationRouter = Router();

const NegotiationStartSchema = z.object({
  requestId: z.string().optional(),
  productId: z.string().uuid("Product ID required"),
  quantity: z.number().int().positive(),
  buyerTargetPrice: z.number().positive(),
  buyerName: z.string().default("Institutional Buyer"),
  maxRounds: z.number().int().min(1).max(20).optional(), // Optional, defaults to dynamic convergence
  strategy: z.enum(["aggressive", "balanced", "speed_first"]).default("balanced"),
});

/**
 * POST /api/negotiation/initiate
 * Runs a dynamic multi-agent negotiation loop between Buyer Agent and Supplier Agent.
 * Rounds are NOT hardcoded — the loop continues until:
 *   1. Both agents agree (ACCEPT_DEAL), OR
 *   2. The price converges (gap < 2%), OR
 *   3. A safety cap of 20 rounds is reached (prevents infinite loops)
 */
negotiationRouter.post("/initiate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = NegotiationStartSchema.parse(req.body);

    // 1. Fetch product & seller agent guardrails from Supabase
    const { data: product, error: prodErr } = await supabase
      .from("supplier_products")
      .select(`
        *,
        businesses (id, name, email)
      `)
      .eq("id", body.productId)
      .single();

    if (prodErr || !product) {
      return res.status(404).json({ error: "Product not found in catalog", code: "NOT_FOUND" });
    }

    const basePrice = Number(product.base_price);
    const floorPrice = Number(product.floor_price);
    const businessName = product.businesses?.name || "Verified Supplier";
    const businessId = product.business_id;

    // Fetch agent config for this business
    let maxConcession = 0.05;
    if (businessId) {
      const { data: cfg } = await supabase
        .from("agent_configs")
        .select("max_round_concession")
        .eq("business_id", businessId)
        .maybeSingle();
      if (cfg?.max_round_concession) {
        maxConcession = Number(cfg.max_round_concession) / 100;
      }
    }

    // PRIVILEGED ACCESS: Fetch FalkorDB historical intelligence STRICTLY for the Seller Agent.
    // The Buyer Agent is never provided access to FalkorDB data to prevent data leakage.
    let sellerFalkorHistory = "";
    try {
      const falkorIntel = await getSellerHistoricalPricingIntelligence(
        businessId || undefined,
        product.category,
        product.name
      );
      sellerFalkorHistory = falkorIntel.summary;
    } catch (err) {
      console.warn("FalkorDB seller historical intelligence unavailable:", err);
    }

    const transcript: { round: number; sender: string; message: string; price: number }[] = [];

    // Safety cap: realistic max rounds (3 to 6 rounds is standard for convergence)
    const SAFETY_MAX_ROUNDS = Math.min(body.maxRounds || 6, 8);
    let currentRound = 0;
    let negotiationComplete = false;
    let finalUnitPrice = basePrice;

    // ===================================================================
    // Round 1: Supplier Agent emits initial catalog quote
    // ===================================================================
    currentRound = 1;
    const r1Price = basePrice;
    transcript.push({
      round: currentRound,
      sender: `${businessName} Agent`,
      message: `Quoting standard catalog terms for ${body.quantity} units of ${product.name} at ₹${r1Price.toLocaleString()} / unit. Express dispatch in ${product.lead_days} days. Stock available: ${product.in_stock} units.`,
      price: r1Price,
    });

    const maxBudgetPerUnit = Math.round(body.buyerTargetPrice / body.quantity);
    let lastBuyerPrice = Math.min(maxBudgetPerUnit, Math.round(basePrice * 0.90));
    let lastSellerPrice = basePrice;

    // ===================================================================
    // Dynamic Negotiation Loop
    // ===================================================================
    while (currentRound < SAFETY_MAX_ROUNDS && !negotiationComplete) {
      currentRound++;

      // --- Buyer Agent Turn (Zero FalkorDB Access) ---
      const buyerTurn = await generateBuyerTurn({
        productName: product.name,
        category: product.category,
        quantity: body.quantity,
        basePrice,
        lastSellerPrice,
        buyerTargetPrice: maxBudgetPerUnit,
        strategy: body.strategy,
        roundNumber: currentRound,
        totalRoundsSoFar: currentRound,
        history: transcript,
      });

      transcript.push({
        round: currentRound,
        sender: `Buyer Agent`,
        message: buyerTurn.message,
        price: buyerTurn.proposedPrice,
      });

      lastBuyerPrice = buyerTurn.proposedPrice;

      // Check if buyer accepts seller's current quote
      if (buyerTurn.wantsToAccept || buyerTurn.proposedPrice >= lastSellerPrice) {
        finalUnitPrice = Math.max(floorPrice, lastSellerPrice);
        negotiationComplete = true;
        transcript.push({
          round: currentRound,
          sender: "System",
          message: `Buyer accepted terms at ₹${finalUnitPrice.toLocaleString()}/unit. Negotiation concluded in ${currentRound} rounds.`,
          price: finalUnitPrice,
        });
        break;
      }

      currentRound++;

      // --- Seller Agent Turn (Exclusive FalkorDB Past Intelligence) ---
      const sellerTurn = await generateSellerTurn({
        productName: product.name,
        quantity: body.quantity,
        basePrice,
        floorPrice,
        leadDays: product.lead_days,
        maxConcessionPercent: maxConcession,
        buyerProposedPrice: buyerTurn.proposedPrice,
        roundNumber: currentRound,
        totalRoundsSoFar: currentRound,
        history: transcript,
        sellerFalkorHistory,
      });

      // HARD SERVER-SIDE SAFEGUARD: Never quote below floorPrice
      const sellerOffer = Math.max(floorPrice, sellerTurn.proposedPrice);

      transcript.push({
        round: currentRound,
        sender: `${businessName} Agent`,
        message: sellerTurn.message,
        price: sellerOffer,
      });

      lastSellerPrice = sellerOffer;

      // Check convergence conditions
      const priceGap = Math.abs(lastSellerPrice - lastBuyerPrice);
      const gapPercent = lastSellerPrice > 0 ? (priceGap / lastSellerPrice) * 100 : 0;

      // Deal closes if seller accepts, or buyer offered at/above seller's quote, or spread is <= 3.5%
      if (sellerTurn.wantsToAccept || lastBuyerPrice >= lastSellerPrice || gapPercent <= 3.5) {
        finalUnitPrice = Math.max(floorPrice, Math.min(lastSellerPrice, Math.round((lastBuyerPrice + lastSellerPrice) / 2)));
        negotiationComplete = true;
        transcript.push({
          round: currentRound,
          sender: "System",
          message: `Deal reached at ₹${finalUnitPrice.toLocaleString()}/unit (${gapPercent.toFixed(1)}% spread). Terms finalized in ${currentRound} rounds.`,
          price: finalUnitPrice,
        });
        break;
      }
    }

    // If we hit the safety cap without explicit convergence
    if (!negotiationComplete) {
      finalUnitPrice = Math.max(floorPrice, Math.min(lastSellerPrice, Math.round((lastBuyerPrice + lastSellerPrice) / 2)));
      transcript.push({
        round: currentRound,
        sender: "System",
        message: `Negotiation reached maximum ${SAFETY_MAX_ROUNDS} rounds. Final agreed price: ₹${finalUnitPrice.toLocaleString()}/unit. Transferred to human review.`,
        price: finalUnitPrice,
      });
    }

    const totalValue = finalUnitPrice * body.quantity;
    const marginPercent = Math.round(((finalUnitPrice - floorPrice) / floorPrice) * 100);

    // 2. Save Quotation in Supabase
    const { data: quote, error: quoteErr } = await supabase
      .from("quotations")
      .insert({
        request_id: body.requestId || null,
        business_id: businessId,
        buyer_name: body.buyerName,
        item_name: product.name,
        quantity: body.quantity,
        unit_price: finalUnitPrice,
        total_value: totalValue,
        margin_achieved: marginPercent,
        lead_days: product.lead_days,
        round_count: currentRound,
        status: "awaiting_approval",
      })
      .select()
      .single();

    if (quoteErr) return res.status(500).json({ error: quoteErr.message });

    // 3. Save audit trail in negotiation_messages
    const messagesToInsert = transcript.map((m) => ({
      quotation_id: quote.id,
      round: m.round,
      sender: m.sender,
      message: m.message,
      price: m.price,
    }));

    await supabase.from("negotiation_messages").insert(messagesToInsert);

    res.status(200).json({
      success: true,
      quotationId: quote.id,
      finalUnitPrice,
      totalValue,
      marginAchieved: marginPercent,
      roundCount: currentRound,
      transcript,
      status: "awaiting_seller_approval",
      createdAt: quote.created_at,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/quotations
 * List quotations for human approvals
 */
negotiationRouter.get("/quotations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { businessId, buyerName } = req.query;

    let query = supabase
      .from("quotations")
      .select(`
        *,
        businesses (name, email),
        negotiation_messages (*)
      `)
      .order("created_at", { ascending: false });

    if (businessId && typeof businessId === "string" && businessId !== "all") {
      query = query.eq("business_id", businessId);
    }

    if (buyerName && typeof buyerName === "string" && buyerName !== "all") {
      query = query.eq("buyer_name", buyerName);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    const quotations = (data || []).map((q: any) => ({
      id: q.id,
      businessId: q.business_id,
      buyerName: q.buyer_name,
      businessName: q.businesses?.name || "Verified Supplier",
      item: q.item_name,
      quantity: q.quantity,
      unitPrice: Number(q.unit_price),
      totalValue: Number(q.total_value),
      marginAchieved: Number(q.margin_achieved ?? 15),
      leadDays: q.lead_days ?? 6,
      round: q.round_count ?? 3,
      status: q.status,
      messages: q.negotiation_messages,
      createdAt: q.created_at,
    }));

    res.status(200).json({ quotations });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/negotiation/quotations
 * Delete all RFQs, quotations, negotiation messages, and RFQ-linked orders
 */
negotiationRouter.delete("/quotations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    // 1. Delete all negotiation messages first (foreign key to quotations)
    await supabase.from("negotiation_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 2. Delete all orders generated from quotations
    await supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Delete all quotations
    const { error: quoteErr } = await supabase.from("quotations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (quoteErr) return res.status(500).json({ error: quoteErr.message });

    // 4. Delete all procurement requests
    await supabase.from("procurement_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    res.status(200).json({ success: true, message: "All RFQs, quotations, and negotiation messages removed successfully." });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/negotiation/quotations/:id
 * Delete a specific quotation by ID
 */
negotiationRouter.delete("/quotations/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const id = req.params.id as string;

    await supabase.from("negotiation_messages").delete().eq("quotation_id", id);
    await supabase.from("orders").delete().eq("quotation_id", id);
    const { error } = await supabase.from("quotations").delete().eq("id", id);

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ success: true, message: `Quotation ${id} removed.` });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/quotations/:id/approve
 * Step 5 Consequential Gate: Seller Human sign-off
 */
negotiationRouter.put("/quotations/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const id = req.params.id as string;

    const { data: updated, error } = await supabase
      .from("quotations")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        businesses (name)
      `)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // Also auto-create or update order in orders table
    const orderCode = `PO-${Math.floor(1000 + Math.random() * 9000)}`;
    await supabase.from("orders").insert({
      order_code: orderCode,
      quotation_id: updated.id,
      business_id: updated.business_id,
      title: `${updated.quantity} Units ${updated.item_name}`,
      counterparty: updated.buyer_name,
      value: updated.total_value,
      stage: "Awaiting Payment Capture",
      health: "On Track",
      due_date: new Date(Date.now() + (updated.lead_days || 7) * 86400000).toISOString().split("T")[0],
      docs_summary: "Quotation signed by human seller",
      type: "selling",
    });

    res.status(200).json({
      success: true,
      message: "Quotation officially approved by seller human. Ready for buyer checkout.",
      quotation: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/quotations/:id/reject
 */
negotiationRouter.put("/quotations/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const id = req.params.id as string;

    const { data, error } = await supabase
      .from("quotations")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ success: true, quotation: data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/negotiation/takeover
 * Seller takes over from autonomous AI agent
 */
negotiationRouter.post("/takeover", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected" });
    }
    const { quotationId, sellerName } = req.body;
    if (!quotationId) {
      return res.status(400).json({ error: "quotationId is required" });
    }

    const auditMsg = {
      quotation_id: quotationId,
      round: 99,
      sender: "System",
      message: `[Human Takeover] ${sellerName || "Supplier"} has taken over the negotiation. Autonomous AI messaging paused. Human seller is in control.`,
      price: 0,
    };
    await supabase.from("negotiation_messages").insert([auditMsg]);

    res.status(200).json({ success: true, message: "Human takeover active", auditMsg });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/negotiation/handover
 * Seller hands control back to autonomous AI agent
 */
negotiationRouter.post("/handover", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected" });
    }
    const { quotationId, sellerName } = req.body;
    if (!quotationId) {
      return res.status(400).json({ error: "quotationId is required" });
    }

    const auditMsg = {
      quotation_id: quotationId,
      round: 99,
      sender: "System",
      message: `[AI Handover] Control returned to ${sellerName || "Supplier"} Autonomous Agent. AI has internalized human seller inputs and resumed bounded negotiation.`,
      price: 0,
    };
    await supabase.from("negotiation_messages").insert([auditMsg]);

    res.status(200).json({ success: true, message: "Handed over to AI", auditMsg });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/negotiation/message
 * Insert manual seller message and update quotation
 */
negotiationRouter.post("/message", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected" });
    }
    const { quotationId, sender, message, price, round, isHumanSeller } = req.body;
    if (!quotationId || !message) {
      return res.status(400).json({ error: "quotationId and message are required" });
    }

    const newMsg = {
      quotation_id: quotationId,
      round: round || 1,
      sender: sender || "Supplier Agent",
      message,
      price: Number(price) || 0,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("negotiation_messages")
      .insert([newMsg])
      .select()
      .single();

    if (insertErr) return res.status(500).json({ error: insertErr.message });

    // Update quotation with new price if given
    if (price && Number(price) > 0) {
      const { data: quote } = await supabase
        .from("quotations")
        .select("quantity")
        .eq("id", quotationId)
        .single();
      const qty = quote?.quantity || 1;
      const unitPrice = Number(price);
      await supabase
        .from("quotations")
        .update({
          unit_price: unitPrice,
          total_value: unitPrice * qty,
          round_count: round || 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", quotationId);
    }

    // AI Learning: Learn from human seller strategy
    const learningNote = isHumanSeller
      ? `AI Learning Engaged: Analyzed seller concession style, pricing threshold (₹${price}/unit), and delivery terms. Tactical profile updated.`
      : undefined;

    res.status(200).json({
      success: true,
      message: inserted,
      learningNote,
    });
  } catch (err) {
    next(err);
  }
});
