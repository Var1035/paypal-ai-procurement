import { createClient } from "@supabase/supabase-js";
import type { Database } from "@shared/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://scvujitwroemvqwdrwlv.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjdnVqaXR3cm9lbXZxd2Ryd2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Njc3MTIsImV4cCI6MjEwODM0MzcxMn0.ra0ADMKdjw2HFuVgJMljNv8WLVkJGK7dmaBDaYH1rOQ";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
