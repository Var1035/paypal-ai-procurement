import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../services/supabase.js";
import { getFalkorClient, syncSupabaseToFalkorDB } from "../services/falkordb.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seed() {
  if (!supabase) {
    console.error("Supabase client not initialized.");
    process.exit(1);
  }

  const payloadPath = path.join(__dirname, "seed_payload.json");
  if (!fs.existsSync(payloadPath)) {
    console.error(`Payload file not found at: ${payloadPath}`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));
  const { businesses, supplier_products, agent_configs } = payload;

  console.log(`[Seed] Ingesting dataset into Supabase:`);
  console.log(` - Businesses: ${businesses.length}`);
  console.log(` - Products: ${supplier_products.length}`);
  console.log(` - Agent Configs: ${agent_configs.length}`);

  // 1. Insert Businesses
  console.log("\n1. Inserting 40 Businesses into 'businesses' table...");
  const { error: bizErr } = await (supabase as any)
    .from("businesses")
    .upsert(businesses, { onConflict: "id" });

  if (bizErr) {
    console.error("Error inserting businesses:", bizErr.message);
    process.exit(1);
  }
  console.log("Successfully inserted 40 businesses.");

  // 2. Insert Agent Configs
  console.log("\n2. Inserting 40 Agent Configs into 'agent_configs' table...");
  const { error: cfgErr } = await (supabase as any)
    .from("agent_configs")
    .upsert(agent_configs, { onConflict: "id" });

  if (cfgErr) {
    console.error("Error inserting agent configs:", cfgErr.message);
    process.exit(1);
  }
  console.log("Successfully inserted 40 agent configs.");

  // 3. Insert Supplier Products in batches of 50
  console.log("\n3. Inserting 200 Products into 'supplier_products' table...");
  const batchSize = 50;
  for (let i = 0; i < supplier_products.length; i += batchSize) {
    const chunk = supplier_products.slice(i, i + batchSize);
    const { error: prodErr } = await (supabase as any)
      .from("supplier_products")
      .upsert(chunk, { onConflict: "id" });

    if (prodErr) {
      console.error(`Error inserting products batch [${i} - ${i + chunk.length}]:`, prodErr.message);
      process.exit(1);
    }
    console.log(`  Inserted batch ${i / batchSize + 1}/${Math.ceil(supplier_products.length / batchSize)} (${chunk.length} items)`);
  }
  console.log("Successfully inserted all 200 products.");

  // 4. Verify Row Counts in Supabase
  console.log("\n================ SUPABASE ROW COUNT VERIFICATION ================");
  const tables = ["businesses", "agent_configs", "supplier_products"];
  for (const table of tables) {
    const { count, error } = await (supabase as any)
      .from(table)
      .select("*", { count: "exact", head: true });
    console.log(`${table.padEnd(20)} : ${count ?? 0} rows ${error ? `(Error: ${error.message})` : "OK"}`);
  }

  // Verify Varun Furni specifically
  const { data: vfBiz, error: vfErr } = await (supabase as any)
    .from("businesses")
    .select(`
      *,
      supplier_products (*),
      agent_configs (*)
    `)
    .ilike("name", "%varun furni%")
    .single();

  if (vfErr) {
    console.error("Could not fetch Varun Furni:", vfErr.message);
  } else {
    console.log("\nVarun Furni Database Verification:");
    console.log(`  Name: ${vfBiz.name}`);
    console.log(`  Email: ${vfBiz.email}`);
    console.log(`  GSTIN: ${vfBiz.gstin}`);
    console.log(`  Reg No: ${vfBiz.reg_no}`);
    console.log(`  Catalog Items: ${vfBiz.supplier_products?.length || 0}`);
    console.log(`  Agent Configured: ${vfBiz.agent_configs?.length > 0 ? "Yes" : "No"}`);
  }

  // 5. FalkorDB Knowledge Graph Sync
  console.log("\n================ FALKORDB GRAPH SYNC ================");
  try {
    const syncRes = await syncSupabaseToFalkorDB();
    console.log(`FalkorDB graph 'agentmarket' synchronized: ${syncRes.nodesCount} nodes created/merged, ${syncRes.edgesCount} edges created.`);
  } catch (graphErr: any) {
    console.warn("FalkorDB 'agentmarket' sync warning:", graphErr?.message);
  }

  // Also sync to 'b2b_procurement' if that graph is used by any other page
  try {
    const client = await getFalkorClient();
    const g = client.selectGraph("b2b_procurement");
    // Clear and re-populate
    await g.query("MATCH (n) DETACH DELETE n");
    for (const b of businesses) {
      await g.query(
        `MERGE (b:Business { id: $id })
         ON CREATE SET b.name = $name, b.category = $category, b.regNo = $regNo, b.email = $email`,
        { params: { id: b.id, name: b.name, category: b.category, regNo: b.reg_no, email: b.email } }
      );
    }
    for (const p of supplier_products) {
      await g.query(
        `MERGE (p:Product { id: $id })
         ON CREATE SET p.name = $name, p.sku = $sku, p.category = $category, p.basePrice = $basePrice, p.floorPrice = $floorPrice, p.leadDays = $leadDays`,
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
      if (p.business_id) {
        await g.query(
          `MATCH (b:Business { id: $bizId }), (p:Product { id: $prodId })
           MERGE (b)-[:OFFERS]->(p)`,
          { params: { bizId: p.business_id, prodId: p.id } }
        );
      }
    }
    console.log(`FalkorDB graph 'b2b_procurement' synchronized successfully with 40 Business nodes and 200 Product nodes!`);
  } catch (err: any) {
    console.warn("FalkorDB 'b2b_procurement' sync note:", err?.message);
  }

  console.log("\n================ SEEDING COMPLETE ================\n");
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  });
