import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { supabase } from "../services/supabase.js";

export const productsRouter = Router();

const ProductInputSchema = z.object({
  businessId: z.string().optional(),
  businessName: z.string().optional().default("DeskWorks"),
  name: z.string().min(2, "Product name is required"),
  sku: z.string().min(2, "SKU is required"),
  category: z.string().min(2, "Category is required"),
  basePrice: z.number().positive("Base price must be positive"),
  floorPrice: z.number().positive("Floor price must be positive"),
  inStock: z.number().int().nonnegative("Stock cannot be negative"),
  leadDays: z.number().int().positive("Lead days must be positive"),
  material: z.string().optional().default("Commercial Grade Composite"),
  specs: z.record(z.any()).optional().default({}),
});

/**
 * GET /api/products
 * Retrieve all published products in the Supabase catalog
 */
productsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const { category, search, businessId } = req.query;

    let query = supabase
      .from("supplier_products")
      .select(`
        *,
        businesses (name, reg_no, gstin, email, is_verified)
      `)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (businessId && typeof businessId === "string" && businessId !== "all") {
      query = query.eq("business_id", businessId);
    }

    if (category && typeof category === "string" && category !== "All") {
      query = query.eq("category", category);
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message, code: "DB_QUERY_ERROR" });
    }

    // Map into frontend-friendly format
    const products = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      basePrice: Number(p.base_price),
      floorPrice: Number(p.floor_price),
      inStock: p.in_stock,
      leadDays: p.lead_days,
      onTimeRate: Number(p.on_time_rate ?? 98.0),
      businessName: p.businesses?.name || "Verified Supplier",
      businessId: p.business_id,
      material: p.material,
      specs: p.specs,
    }));

    res.status(200).json({ products, count: products.length });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products
 * Create a new product listing in Supabase
 */
productsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    const body = ProductInputSchema.parse(req.body);

    if (body.floorPrice > body.basePrice) {
      return res.status(400).json({
        error: "Floor price cannot exceed base catalog price",
        code: "INVALID_PRICE_FLOOR",
      });
    }

    // Find or create associated business
    let businessId = body.businessId;
    if (!businessId) {
      const { data: biz } = await supabase
        .from("businesses")
        .select("id")
        .eq("name", body.businessName)
        .maybeSingle();

      if (biz) {
        businessId = biz.id;
      } else {
        const { data: newBiz, error: bizErr } = await supabase
          .from("businesses")
          .insert({ name: body.businessName, is_verified: true, category: body.category })
          .select("id")
          .single();

        if (bizErr) return res.status(500).json({ error: bizErr.message });
        businessId = newBiz.id;
      }
    }

    const { data: created, error } = await supabase
      .from("supplier_products")
      .insert({
        business_id: businessId,
        name: body.name,
        sku: body.sku,
        category: body.category,
        base_price: body.basePrice,
        floor_price: body.floorPrice,
        in_stock: body.inStock,
        lead_days: body.leadDays,
        material: body.material,
        specs: body.specs,
        on_time_rate: 98.5,
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message, code: "DB_INSERT_ERROR" });
    }

    res.status(201).json({
      success: true,
      message: "Product listing created in Supabase",
      product: created,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/products/seed
 * Seeds sample catalog items into Supabase if catalog is empty
 */
productsRouter.post("/seed", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase database not connected", code: "DATABASE_UNAVAILABLE" });
    }

    // Check count
    const { count } = await supabase
      .from("supplier_products")
      .select("*", { count: "exact", head: true });

    if (count && count > 0) {
      return res.status(200).json({ message: "Catalog already has products", count });
    }

    // Create 3 distinct supplier businesses per specification
    const suppliers = [
      { name: "DeskWorks", regNo: "DW-IND-8841", gstin: "29AABCU9603R1Z7", category: "Classroom Desks", email: "sales@deskworks.com" },
      { name: "FurnitureHub", regNo: "FH-IND-2033", gstin: "27AABCF1234F1ZX", category: "Commercial Workstations", email: "contracts@furniturehub.com" },
      { name: "ClassRoom Supply Co.", regNo: "CR-IND-9099", gstin: "07AABCC5544K1ZZ", category: "Educational Furniture", email: "b2b@classroomsupply.com" },
    ];

    const bizMap: Record<string, string> = {};

    for (const sup of suppliers) {
      const { data: biz } = await supabase
        .from("businesses")
        .insert({
          name: sup.name,
          reg_no: sup.regNo,
          gstin: sup.gstin,
          category: sup.category,
          email: sup.email,
          is_verified: true,
        })
        .select("id")
        .single();

      if (biz) {
        bizMap[sup.name] = biz.id;
        await supabase.from("agent_configs").insert({
          business_id: biz.id,
          min_margin: 20,
          max_round_concession: 5,
          require_approval_above: 250000,
          auto_quote: true,
        });
      }
    }

    const sampleProducts = [
      {
        business_id: bizMap["DeskWorks"],
        name: "Birch Standard Classroom Desk",
        sku: "DW-DSK-100",
        category: "Classroom Desks",
        base_price: 4500,
        floor_price: 4100,
        in_stock: 250,
        lead_days: 6,
        on_time_rate: 98.4,
        material: "FSC Certified Birch Wood & 16-Gauge Steel Frame",
      },
      {
        business_id: bizMap["FurnitureHub"],
        name: "Ergonomic Modular Study Desk",
        sku: "FH-MOD-200",
        category: "Classroom Desks",
        base_price: 4350,
        floor_price: 3950,
        in_stock: 140,
        lead_days: 7,
        on_time_rate: 96.2,
        material: "High-Pressure Melamine Top & Heavy-Duty Tube Base",
      },
      {
        business_id: bizMap["ClassRoom Supply Co."],
        name: "Rapid-Deploy Adjustable Student Desk",
        sku: "CR-EXP-300",
        category: "Classroom Desks",
        base_price: 4700,
        floor_price: 4250,
        in_stock: 85,
        lead_days: 4,
        on_time_rate: 99.1,
        material: "Anti-Scratch Polyurethane Core & Rapid Lock Legs",
      },
      {
        business_id: bizMap["FurnitureHub"],
        name: "Heavy-Duty Dual-Bench Study Table",
        sku: "FH-BNCH-400",
        category: "Classroom Desks",
        base_price: 7800,
        floor_price: 7100,
        in_stock: 60,
        lead_days: 8,
        on_time_rate: 95.8,
        material: "Solid Teakwood Veneer with Integrated Cable Channel",
      },
    ];

    const { error: seedErr } = await supabase.from("supplier_products").insert(sampleProducts);

    if (seedErr) return res.status(500).json({ error: seedErr.message });

    res.status(201).json({
      success: true,
      message: "Seeded initial 3 verified suppliers and catalog products in Supabase",
      count: sampleProducts.length,
    });
  } catch (err) {
    next(err);
  }
});
