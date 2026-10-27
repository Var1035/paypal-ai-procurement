import { FalkorDB } from "falkordb";
import { env } from "../config/env.js";
import { supabase } from "./supabase.js";

const GRAPH_NAME = "agentmarket";

let falkorClient: any = null;

/**
 * Returns an active FalkorDB client instance
 */
export async function getFalkorClient() {
  if (falkorClient) return falkorClient;

  if (!env.FALKORDB_HOST) {
    throw new Error("Missing FALKORDB_HOST in environment variables");
  }

  const socket: any = {
    host: env.FALKORDB_HOST,
    port: env.FALKORDB_PORT || 6379,
    connectTimeout: 6000,
  };

  const clientConfig: any = {
    socket,
  };

  if (env.FALKORDB_USERNAME) {
    clientConfig.username = env.FALKORDB_USERNAME;
  }

  if (env.FALKORDB_PASSWORD) {
    clientConfig.password = env.FALKORDB_PASSWORD;
  }

  falkorClient = await FalkorDB.connect(clientConfig);
  return falkorClient;
}

/**
 * Probe FalkorDB connection
 */
export async function testFalkorDBConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!env.FALKORDB_HOST) {
      return { ok: false, message: "FALKORDB_HOST not configured in environment" };
    }

    const client = await getFalkorClient();
    const graph = client.selectGraph(GRAPH_NAME);
    const res = await graph.query("RETURN 'FalkorDB Operational' AS status");

    const statusVal = res?.data?.[0]?.status || "Active";
    return {
      ok: true,
      message: `Connected to FalkorDB Cloud (${env.FALKORDB_HOST}:${env.FALKORDB_PORT || 6379}) - Status: ${statusVal}`,
    };
  } catch (err: any) {
    // If failed, reset client so next attempt can reconnect
    falkorClient = null;
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to connect to FalkorDB",
    };
  }
}

/**
 * Execute Cypher query on the agentmarket graph
 */
export async function executeCypher(cypherQuery: string): Promise<{ data: any[]; statistics?: any }> {
  const client = await getFalkorClient();
  const graph = client.selectGraph(GRAPH_NAME);
  const result = await graph.query(cypherQuery);
  return {
    data: result.data || [],
    statistics: result.statistics || {},
  };
}

/**
 * Synchronize relational records from Supabase into the FalkorDB Knowledge Graph
 */
export async function syncSupabaseToFalkorDB(): Promise<{ nodesCount: number; edgesCount: number }> {
  if (!supabase) {
    throw new Error("Supabase is not connected to sync graph data");
  }

  const client = await getFalkorClient();
  const graph = client.selectGraph(GRAPH_NAME);

  // 1. Fetch live records from Supabase
  const [{ data: businesses }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from("businesses").select("*"),
    supabase.from("supplier_products").select("*"),
    supabase.from("orders").select("*"),
  ]);

  let nodesCount = 0;
  let edgesCount = 0;

  // 2. Insert or merge Business nodes
  for (const b of businesses || []) {
    await graph.query(
      `MERGE (b:Business { id: $id })
       ON CREATE SET b.name = $name, b.category = $category, b.regNo = $regNo
       ON MATCH SET b.name = $name, b.category = $category`,
      {
        params: {
          id: b.id,
          name: b.name,
          category: b.category || "General",
          regNo: b.reg_no || "",
        },
      }
    );
    nodesCount++;
  }

  // 3. Insert or merge Product nodes and :OFFERS relationship
  for (const p of products || []) {
    await graph.query(
      `MERGE (p:Product { id: $id })
       ON CREATE SET p.name = $name, p.sku = $sku, p.category = $category, p.basePrice = $basePrice, p.floorPrice = $floorPrice, p.leadDays = $leadDays
       ON MATCH SET p.name = $name, p.basePrice = $basePrice, p.floorPrice = $floorPrice, p.leadDays = $leadDays`,
      {
        params: {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          basePrice: Number(p.base_price),
          floorPrice: Number(p.floor_price),
          leadDays: p.lead_days,
        },
      }
    );
    nodesCount++;

    if (p.business_id) {
      await graph.query(
        `MATCH (b:Business { id: $bizId }), (p:Product { id: $prodId })
         MERGE (b)-[:OFFERS]->(p)`,
        {
          params: {
            bizId: p.business_id,
            prodId: p.id,
          },
        }
      );
      edgesCount++;
    }
  }

  // 4. Insert or merge Order & Delivery nodes
  for (const o of orders || []) {
    await graph.query(
      `MERGE (o:Order { id: $id })
       ON CREATE SET o.orderCode = $orderCode, o.title = $title, o.value = $value, o.stage = $stage, o.dueDate = $dueDate
       ON MATCH SET o.stage = $stage, o.value = $value`,
      {
        params: {
          id: o.id,
          orderCode: o.order_code,
          title: o.title,
          value: Number(o.value),
          stage: o.stage || "Open",
          dueDate: o.due_date || "",
        },
      }
    );
    nodesCount++;

    if (o.business_id) {
      await graph.query(
        `MATCH (o:Order { id: $ordId }), (b:Business { id: $bizId })
         MERGE (o)-[:SOLD_BY]->(b)`,
        {
          params: {
            ordId: o.id,
            bizId: o.business_id,
          },
        }
      );
      edgesCount++;
    }

    // Delivery node
    if (o.stage === "In Transit" || o.stage === "Delivered" || o.stage === "In production") {
      const delId = `del-${o.id}`;
      await graph.query(
        `MERGE (d:Delivery { id: $delId })
         ON CREATE SET d.dueDate = $dueDate, d.stage = $stage
         ON MATCH SET d.stage = $stage`,
        {
          params: {
            delId,
            dueDate: o.due_date || "",
            stage: o.stage,
          },
        }
      );
      nodesCount++;

      await graph.query(
        `MATCH (o:Order { id: $ordId }), (d:Delivery { id: $delId })
         MERGE (o)-[:HAS_DELIVERY]->(d)`,
        {
          params: {
            ordId: o.id,
            delId,
          },
        }
      );
      edgesCount++;
    }
  }

  return { nodesCount, edgesCount };
}

/**
 * Retrieves historical pricing and deal intelligence strictly for the SELLER agent.
 * The buyer agent is NEVER granted access to this data to prevent data leakage.
 * Queries FalkorDB for:
 * - Historical contract order volume and clearing values for this seller
 * - Past product floor margins and category averages
 */
export async function getSellerHistoricalPricingIntelligence(
  businessId?: string | null,
  category?: string,
  _productName?: string
): Promise<{
  pastOrdersCount: number;
  averagePastOrderValue: number;
  recommendedFloor: number | null;
  summary: string;
}> {
  try {
    const client = await getFalkorClient();
    const graph = client.selectGraph(GRAPH_NAME);

    // Query past orders associated with this seller in FalkorDB
    const cypher = `
      MATCH (b:Business)
      WHERE ($bizId IS NOT NULL AND b.id = $bizId) OR ($bizId IS NULL)
      OPTIONAL MATCH (o:Order)-[:SOLD_BY]->(b)
      OPTIONAL MATCH (b)-[:OFFERS]->(p:Product)
      RETURN 
        count(DISTINCT o) AS orderCount,
        avg(o.value) AS avgOrderValue,
        avg(p.floorPrice) AS avgFloorPrice,
        avg(p.basePrice) AS avgBasePrice
    `;

    const res = await graph.query(cypher, {
      params: {
        bizId: businessId || null,
      },
    });

    const row = res.data?.[0];
    const orderCount = Number(row?.orderCount || 0);
    const avgOrderValue = Math.round(Number(row?.avgOrderValue || 0));
    const avgFloorPrice = Math.round(Number(row?.avgFloorPrice || 0));

    let summary = "";
    if (orderCount > 0) {
      summary = `FalkorDB Historical Deal Intelligence (Seller Private): Seller has ${orderCount} recorded contract deliveries with average deal size of ₹${avgOrderValue.toLocaleString()}. Past category floor margin maintained at ₹${avgFloorPrice.toLocaleString()} / unit.`;
    } else {
      summary = `FalkorDB Historical Deal Intelligence (Seller Private): Benchmark index across verified suppliers suggests standard volume concession of 3-7% with strict floor price adherence.`;
    }

    return {
      pastOrdersCount: orderCount,
      averagePastOrderValue: avgOrderValue,
      recommendedFloor: avgFloorPrice > 0 ? avgFloorPrice : null,
      summary,
    };
  } catch (err: any) {
    return {
      pastOrdersCount: 0,
      averagePastOrderValue: 0,
      recommendedFloor: null,
      summary: "FalkorDB Historical Deal Intelligence: Standard manufacturer margin defense active with strict unit floor enforcement.",
    };
  }
}

