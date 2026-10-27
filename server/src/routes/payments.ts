import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { supabase } from "../services/supabase.js";
import { 
  createPayPalOrder, 
  capturePayPalOrder, 
  testPayPalConnection 
} from "../services/paypal.js";

export const paymentsRouter = Router();

const CreateOrderSchema = z.object({
  orderId: z.string().optional(),
  quotationId: z.string().optional(),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().default("USD"),
  title: z.string().default("B2B Procurement Order"),
});

const CaptureOrderSchema = z.object({
  paypalOrderId: z.string().min(1, "PayPal Order ID required"),
  orderId: z.string().optional(),
});

/**
 * GET /api/payments/config
 * Returns PayPal client configuration for frontend checkout
 */
paymentsRouter.get("/config", async (_req: Request, res: Response) => {
  const configured = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
  res.status(200).json({
    configured,
    clientId: configured ? env.PAYPAL_CLIENT_ID : null,
    currency: "USD",
    mode: env.PAYPAL_API_BASE.includes("sandbox") ? "sandbox" : "live",
  });
});

/**
 * GET /api/payments/status
 * Health probe for PayPal connectivity
 */
paymentsRouter.get("/status", async (_req: Request, res: Response) => {
  const status = await testPayPalConnection();
  res.status(200).json(status);
});

/**
 * POST /api/payments/create-order
 * Initializes a PayPal Order (Vault/Escrow)
 */
paymentsRouter.post("/create-order", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreateOrderSchema.parse(req.body);

    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        error: "PayPal credentials not configured. Please supply PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in server/.env",
        code: "PAYPAL_NOT_CONFIGURED",
      });
    }

    const order = await createPayPalOrder(body);

    res.status(201).json({
      success: true,
      orderId: order.id,
      status: order.status,
      approvalUrl: order.approvalUrl,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/payments/capture-order
 * Captures payment after buyer approves in PayPal window
 */
paymentsRouter.post("/capture-order", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CaptureOrderSchema.parse(req.body);

    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({
        error: "PayPal credentials not configured",
        code: "PAYPAL_NOT_CONFIGURED",
      });
    }

    const result = await capturePayPalOrder(body);

    res.status(200).json({
      success: true,
      captureId: result.captureId,
      status: result.status,
      paymentRecordId: result.paymentRecordId,
      message: "PayPal payment successfully captured and confirmed.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/payments/history
 * List captured payments from Supabase audit log
 */
paymentsRouter.get("/history", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Database unavailable", code: "DATABASE_UNAVAILABLE" });
    }

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ payments: data || [] });
  } catch (err) {
    next(err);
  }
});
