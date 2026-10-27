import { supabase } from "../services/supabase.js";
import { getFalkorClient } from "../services/falkordb.js";

async function syncCatalogToGraphs() {
  if (!supabase) {
    console.error("Supabase client is not available.");
    process.exit(1);
  }

  console.log("Fetching live businesses and products from Supabase...");
  const [{ data: businesses }, { data: products }] = await Promise.all([
    supabase.from("businesses").select("*"),
    supabase.from("supplier_products").select("*"),
  ]);

  console.log(`Fetched ${businesses?.length || 0} businesses and ${products?.length || 0} products.`);

  const client = await getFalkorClient();

  // Sync to both graph names: "agentmarket" (used by API) and "b2b_procurement"
  const graphNames = ["agentmarket", "b2b_procurement"];

  for (const graphName of graphNames) {
    console.log(`\nSyncing to graph '${graphName}'...`);
    const graph = client.selectGraph(graphName);

    // Clear existing nodes first to have a clean slate
    await graph.query("MATCH (n) DETACH DELETE n");
    console.log(`  Cleared existing nodes in '${graphName}'.`);

    // Insert Business nodes
    let bCount = 0;
    for (const b of businesses || []) {
      await graph.query(
        `MERGE (b:Business { id: $id })
         ON CREATE SET b.name = $name, b.category = $category, b.regNo = $regNo, b.email = $email
         ON MATCH SET b.name = $name, b.category = $category, b.email = $email`,
        {
          params: {
            id: b.id,
            name: b.name,
            category: b.category || "General",
            regNo: b.reg_no || "",
            email: b.email || "",
          },
        }
      );
      bCount++;
    }
    console.log(`  Merged ${bCount} Business nodes.`);

    // Insert Product nodes and :OFFERS relations
    let pCount = 0;
    let rCount = 0;
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
      pCount++;

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
        rCount++;
      }
    }
    console.log(`  Merged ${pCount} Product nodes and ${rCount} :OFFERS relationships.`);

    // Verify graph node counts
    const countRes = await graph.query("MATCH (n) RETURN labels(n) AS label, count(n) AS count");
    console.log(`  Graph '${graphName}' label breakdown:`, countRes.data);
  }

  console.log("\nFalkorDB sync complete for all graphs!");
}

syncCatalogToGraphs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
