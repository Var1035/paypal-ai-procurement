import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import type { Database } from "../../../shared/database.types.js";

// Initialize type-safe Supabase client
export const supabase = (env.SUPABASE_URL && env.SUPABASE_ANON_KEY)
  ? createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  : null;

/**
 * Returns true if the Supabase client is configured and operational.
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
    return { ok: false, message: "Supabase client not initialized (missing environment variables)" };
  }

  try {
    const { count, error } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true });

    if (error) {
      return { ok: false, message: error.message };
    }

    return { ok: true, message: `Connected to Supabase (businesses table ready, ${count ?? 0} rows)` };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error connecting to Supabase",
    };
  }
}
