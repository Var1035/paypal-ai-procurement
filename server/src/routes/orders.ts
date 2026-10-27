import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";

export const ordersRouter = Router();

const OrderCreateSchema = z.object({
  quotationId: z.string().optional(),
  businessId: z.string().optional(),
  title: z.string().min(2),
  counterparty: z.string().min(2),
  value: z.number().positive(),
  dueDate: z.string().default("In 7 days"),
  stage: z.string().default("Awaiting Seller Approval"),
  type: z.enum(["buying", "selling"]).default("buying"),
  location: z.string().default("Bangalore Central Logistics Depot"),
});

/**
 * GET /api/orders
 * Returns all deal flow records from Supabase
 */
ordersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { type, stage, businessId, counterparty } = req.query;

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (type && typeof type === "string") {
      query = query.eq("type", type);
    }

    if (stage && typeof stage === "string" && stage !== "All") {
      query = query.eq("stage", stage);
    }

    if (businessId && typeof businessId === "string" && businessId !== "all") {
      query = query.eq("business_id", businessId);
    }

    if (counterparty && typeof counterparty === "string" && counterparty !== "all") {
      query = query.ilike("counterparty", `%${counterparty}%`);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });

    const orders = (data || []).map((o: any) => ({
      id: o.id,
      orderCode: o.order_code,
      businessId: o.business_id,
      title: o.title,
      counterparty: o.counterparty,
      value: Number(o.value),
      stage: o.stage,
      health: o.health,
      dueDate: o.due_date,
      docsSummary: o.docs_summary,
      type: o.type,
      location: o.location,
      createdAt: o.created_at,
    }));

    res.status(200).json({ orders, count: orders.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/orders
 * Create a new deal flow order
 */
ordersRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = OrderCreateSchema.parse(req.body);
    const orderCode = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode,
        quotation_id: body.quotationId || null,
        business_id: body.businessId || null,
        title: body.title,
        counterparty: body.counterparty,
        value: body.value,
        due_date: body.dueDate,
        stage: body.stage,
        type: body.type,
        location: body.location,
        health: "On Track",
        docs_summary: "PO issued",
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json({ success: true, order: data });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/orders/:id/stage
 * Advance the order along the fulfillment lifecycle
 */
ordersRouter.put("/:id/stage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const id = req.params.id as string;
    const { stage, health } = req.body;

    const { data, error } = await supabase
      .from("orders")
      .update({
        stage,
        ...(health ? { health } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ success: true, order: data });
  } catch (err) {
    next(err);
  }
});
