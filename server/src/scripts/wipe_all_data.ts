import { supabase } from "../services/supabase.js";

async function wipeAll() {
  if (!supabase) {
    console.error("Supabase client is not initialized.");
    process.exit(1);
  }

  console.log("Starting full Supabase data wipe...");

  const tables = [
    "payments",
    "negotiation_messages",
    "quotations",
    "orders",
    "contact_approvals",
    "procurement_requests",
    "agent_configs",
    "supplier_products",
    "businesses"
  ];

  for (const table of tables) {
    console.log(`Clearing table: ${table}...`);
    // Delete all records where id is not null/empty
    const { error } = await (supabase as any)
      .from(table)
      .delete()
      .gte("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      // If gte UUID fails for text-based ID, try neq
      const fallback = await (supabase as any).from(table).delete().neq("id", "");
      if (fallback.error) {
        console.error(`  Error deleting from ${table}:`, fallback.error.message);
      } else {
        console.log(`  Table ${table} cleared via fallback.`);
      }
    } else {
      console.log(`  Table ${table} cleared.`);
    }
  }

  console.log("\n================ ROW COUNT VERIFICATION ================");
  for (const table of tables) {
    const { count, error } = await (supabase as any)
      .from(table)
      .select("*", { count: "exact", head: true });
    console.log(`${table.padEnd(25)} : ${count ?? 0} rows ${error ? `(Error: ${error.message})` : "✓"}`);
  }

  // Clear FalkorDB graph
  try {
    const { getFalkorClient } = await import("../services/falkordb.js");
    const client = await getFalkorClient();
    const graph = client.selectGraph("b2b_procurement");
    await graph.query("MATCH (n) DETACH DELETE n");
    console.log("FalkorDB graph (b2b_procurement) nodes successfully cleared.");
  } catch (err: any) {
    console.log("FalkorDB clear note:", err?.message);
  }
}

wipeAll()
  .then(() => {
    console.log("\nFull Supabase and Graph wipe complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Wipe failed:", err);
    process.exit(1);
  });
