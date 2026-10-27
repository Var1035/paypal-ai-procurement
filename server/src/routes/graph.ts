import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { executeCypher, syncSupabaseToFalkorDB, testFalkorDBConnection } from "../services/falkordb.js";

export const graphRouter = Router();

const CypherQuerySchema = z.object({
  query: z.string().min(5, "Cypher query must be provided"),
});

/**
 * GET /api/graph/status
 * Probes FalkorDB status
 */
graphRouter.get("/status", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const probe = await testFalkorDBConnection();
    res.status(200).json(probe);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/graph/sync
 * Syncs Supabase businesses, products, and orders into FalkorDB
 */
graphRouter.post("/sync", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncSupabaseToFalkorDB();
    res.status(200).json({
      success: true,
      message: `Synchronized ${result.nodesCount} nodes and ${result.edgesCount} relationships to FalkorDB`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "FalkorDB synchronization failed",
      code: "FALKORDB_SYNC_ERROR",
    });
  }
});

/**
 * POST /api/graph/query
 * Executes an open Cypher query against FalkorDB
 */
graphRouter.post("/query", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query } = CypherQuerySchema.parse(req.body);
    const result = await executeCypher(query);
    res.status(200).json({
      success: true,
      query,
      data: result.data,
      statistics: result.statistics,
      count: result.data.length,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Cypher execution failed",
      code: "CYPHER_EXEC_ERROR",
    });
  }
});

/**
 * GET /api/graph/topology
 * Fetches all active nodes and relationships from FalkorDB
 */
graphRouter.get("/topology", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Fetch nodes
    const nodesResult = await executeCypher(
      "MATCH (n) RETURN labels(n) AS labels, n.id AS id, n.name AS name, n.title AS title, n.orderCode AS orderCode, n.category AS category, n.basePrice AS basePrice, n.value AS value, n.stage AS stage, n.dueDate AS dueDate LIMIT 100"
    ).catch(() => ({ data: [] }));

    // 2. Fetch edges
    const edgesResult = await executeCypher(
      "MATCH (a)-[r]->(b) RETURN a.id AS from, b.id AS to, type(r) AS label LIMIT 150"
    ).catch(() => ({ data: [] }));

    const nodes = (nodesResult.data || []).map((row: any, idx: number) => {
      const type = row.labels?.[0] || "Entity";
      let label = row.name || row.title || row.orderCode || `Node #${idx}`;
      let meta = "";
      if (type === "Product") meta = `Category: ${row.category} • ₹${row.basePrice || 0}`;
      else if (type === "Order") meta = `${row.stage || "Open"} • ₹${row.value || 0}`;
      else if (type === "Delivery") meta = `Due: ${row.dueDate || "Standard"} • ${row.stage || "Pending"}`;
      else if (type === "Business") meta = `Verified Supplier • ${row.category || "General"}`;

      return {
        id: row.id || `node-${idx}`,
        type,
        label,
        meta,
        color: type === "Business" ? "from-blue-600 to-blue-800" : type === "Product" ? "from-cyan-600 to-cyan-800" : type === "Order" ? "from-amber-600 to-amber-800" : "from-rose-600 to-rose-800",
      };
    });

    const edges = (edgesResult.data || []).map((row: any) => ({
      from: row.from,
      to: row.to,
      label: `:${row.label}`,
    }));

    res.status(200).json({ nodes, edges, count: nodes.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message, code: "FALKORDB_ERROR" });
  }
});
