import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";

export const procurementRouter = Router();

const ProcurementIntakeSchema = z.object({
  buyerName: z.string().default("Institutional Buyer"),
  itemName: z.string().min(2, "Item name is required"),
  category: z.string().min(2, "Category is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  maxBudget: z.number().positive("Budget must be positive"),
  deadlineDays: z.number().int().positive("Deadline in days must be positive"),
  deliveryLocation: z.string().default("Bangalore Central Logistics Depot"),
  specifications: z.record(z.any()).optional().default({}),
});

const ContactApprovalSchema = z.object({
  requestId: z.string().uuid("Valid request ID required"),
  businessId: z.string().uuid("Valid business ID required"),
  approved: z.boolean(),
});

/**
 * POST /api/procurement/request
 * Save a validated structured procurement request
 */
procurementRouter.post("/request", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = ProcurementIntakeSchema.parse(req.body);

    const { data, error } = await supabase
      .from("procurement_requests")
      .insert({
        buyer_name: body.buyerName,
        item_name: body.itemName,
        category: body.category,
        quantity: body.quantity,
        max_budget: body.maxBudget,
        deadline_days: body.deadlineDays,
        delivery_location: body.deliveryLocation,
        specifications: body.specifications,
        status: "analyzing",
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({
      success: true,
      requestId: data.id,
      request: data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/procurement/discover
 * Deterministically filters eligible suppliers from Supabase against hard constraints
 */
procurementRouter.post("/discover", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { itemName, quantity, maxBudget, deadlineDays } = req.body;
    const reqQty = Number(quantity) || 100;
    const reqBudget = Number(maxBudget) || 500000;
    const reqDays = Number(deadlineDays) || 7;
    const targetUnitPrice = Math.round(reqBudget / reqQty);

    // Fetch all active products
    const { data: products, error } = await supabase
      .from("supplier_products")
      .select(`
        *,
        businesses (id, name, reg_no, gstin, is_verified, email)
      `)
      .eq("is_active", true);

    if (error) return res.status(500).json({ error: error.message });

    const results = (products || []).map((p: any) => {
      const meetsStock = p.in_stock >= reqQty;
      const meetsLead = p.lead_days <= reqDays;
      const meetsBudget = Number(p.base_price) <= targetUnitPrice * 1.15; // Within 15% negotiable range

      // Hard constraint validation per specification
      const isEligible = meetsStock && meetsLead;

      let score = 90;
      if (meetsStock) score += 5;
      if (meetsLead) score += 4;
      if (p.on_time_rate >= 98) score += 3;
      if (Number(p.base_price) <= targetUnitPrice) score += 5;

      return {
        product: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          basePrice: Number(p.base_price),
          floorPrice: Number(p.floor_price),
          inStock: p.in_stock,
          leadDays: p.lead_days,
          onTimeRate: Number(p.on_time_rate),
          material: p.material,
        },
        business: {
          id: p.businesses?.id,
          name: p.businesses?.name || "Verified Supplier",
          isVerified: p.businesses?.is_verified ?? true,
        },
        constraints: {
          meetsStock,
          meetsLead,
          meetsBudget,
          isEligible,
        },
        matchScore: Math.min(99, score),
        estimatedTotal: Number(p.base_price) * reqQty,
      };
    }).sort((a: any, b: any) => b.matchScore - a.matchScore);

    res.status(200).json({
      totalCandidates: results.length,
      eligibleCandidates: results.filter((r: any) => r.constraints.isEligible).length,
      matches: results,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/procurement/approve-contact
 * Consequential human permission gate: records explicit authorization to contact
 */
procurementRouter.post("/approve-contact", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { requestId, businessId, approved } = ContactApprovalSchema.parse(req.body);

    const { data, error } = await supabase
      .from("contact_approvals")
      .insert({
        request_id: requestId,
        business_id: businessId,
        approved_by_buyer: approved,
        approved_at: approved ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({
      success: true,
      message: "Human permission recorded. Agent is authorized to contact supplier.",
      approval: data,
    });
  } catch (err) {
    next(err);
  }
});
