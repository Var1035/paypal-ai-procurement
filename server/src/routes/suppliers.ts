import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";

export const suppliersRouter = Router();

const RegisterSupplierSchema = z.object({
  name: z.string().min(2, "Business name is required"),
  regNo: z.string().optional().default(""),
  gstin: z.string().optional().default(""),
  category: z.string().optional().default("Commercial Grade Furniture & Equipment"),
  email: z.string().email("Valid email required").optional().default("procurement@enterprise.com"),
});

const GuardrailsSchema = z.object({
  businessId: z.string().optional(),
  minMargin: z.number().int().min(5).max(50),
  maxRoundConcession: z.number().int().min(1).max(20),
  requireApprovalAbove: z.number().positive(),
  autoQuote: z.boolean(),
});

/**
 * GET /api/suppliers
 * List all registered businesses with their active catalog products
 */
suppliersRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { data: businesses, error } = await supabase
      .from("businesses")
      .select(`
        *,
        supplier_products (*),
        agent_configs (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message, code: "DB_QUERY_ERROR" });
    }

    res.status(200).json({ suppliers: businesses });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/suppliers/register
 * Register or update the seller's business profile
 */
suppliersRouter.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = RegisterSupplierSchema.parse(req.body);

    // Check if business already exists by name
    const { data: existing } = await supabase
      .from("businesses")
      .select("*")
      .eq("name", body.name)
      .maybeSingle();

    let businessId: string;

    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from("businesses")
        .update({
          reg_no: body.regNo,
          gstin: body.gstin,
          category: body.category,
          email: body.email,
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr) return res.status(500).json({ error: updateErr.message });
      businessId = updated.id;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("businesses")
        .insert({
          name: body.name,
          reg_no: body.regNo,
          gstin: body.gstin,
          category: body.category,
          email: body.email,
          is_verified: true,
        })
        .select()
        .single();

      if (insertErr) return res.status(500).json({ error: insertErr.message });
      businessId = created.id;

      // Initialize default agent policy guardrail
      await supabase.from("agent_configs").insert({
        business_id: businessId,
        min_margin: 20,
        max_round_concession: 5,
        require_approval_above: 250000,
        auto_quote: true,
      });
    }

    res.status(200).json({
      success: true,
      message: "Supplier business profile registered successfully in Supabase",
      businessId,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/suppliers/guardrails
 * Fetch agent policy guardrails
 */
suppliersRouter.get("/guardrails", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { data, error } = await supabase
      .from("agent_configs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    if (!data) {
      return res.status(200).json({
        minMargin: 20,
        maxRoundConcession: 5,
        requireApprovalAbove: 250000,
        autoQuote: true,
      });
    }

    res.status(200).json({
      minMargin: data.min_margin,
      maxRoundConcession: data.max_round_concession,
      requireApprovalAbove: data.require_approval_above,
      autoQuote: data.auto_quote,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/suppliers/guardrails
 * Update autonomous agent guardrails
 */
suppliersRouter.put("/guardrails", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = GuardrailsSchema.parse(req.body);

    const { data: existing } = await supabase
      .from("agent_configs")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("agent_configs")
        .update({
          min_margin: body.minMargin,
          max_round_concession: body.maxRoundConcession,
          require_approval_above: body.requireApprovalAbove,
          auto_quote: body.autoQuote,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("agent_configs").insert({
        min_margin: body.minMargin,
        max_round_concession: body.maxRoundConcession,
        require_approval_above: body.requireApprovalAbove,
        auto_quote: body.autoQuote,
      });
    }

    res.status(200).json({ success: true, message: "Agent guardrails updated in Supabase" });
  } catch (err) {
    next(err);
  }
});
