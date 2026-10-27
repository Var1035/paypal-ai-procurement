import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file if present
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().default("http://localhost:5173"),

  // External Services (Optional in Phase 1 Foundation, validated when configured)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  FALKORDB_HOST: z.string().optional(),
  FALKORDB_PORT: z.coerce.number().optional(),
  FALKORDB_USERNAME: z.string().default("falkordb"),
  FALKORDB_PASSWORD: z.string().optional(),

  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_API_BASE: z.string().default("https://api-m.sandbox.paypal.com"),

  GEMINI_API_KEY: z.string().optional(),

  // Local Autonomous Agent Models (Ollama)
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  BUYER_AGENT_MODEL: z.string().default("deepseek-r1:14b"),
  SELLER_AGENT_MODEL: z.string().default("qwen2.5:14b"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid server environment configuration:", parsedEnv.error.format());
  throw new Error("Invalid server environment variables.");
}

import type { ServiceStatus } from "../../../shared/contracts.js";

export const env = parsedEnv.data;

/**
 * Evaluates configured vs missing credentials for external services.
 * This guarantees honesty per the project specification without fake mocks.
 */
export function getServicesConnectivityStatus(): Record<"supabase" | "falkordb" | "paypal" | "gemini" | "ollama", ServiceStatus> {
  const isPlaceholder = (val?: string) =>
    !val || val.includes("your-") || val.trim() === "";

  return {
    supabase: {
      configured: !isPlaceholder(env.SUPABASE_URL) && !isPlaceholder(env.SUPABASE_ANON_KEY),
      status: !isPlaceholder(env.SUPABASE_URL) && !isPlaceholder(env.SUPABASE_ANON_KEY)
        ? ("ready" as const)
        : ("missing_credentials" as const),
      details: !isPlaceholder(env.SUPABASE_URL) && !isPlaceholder(env.SUPABASE_ANON_KEY)
        ? "Supabase credentials configured"
        : "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment",
    },
    falkordb: {
      configured: !isPlaceholder(env.FALKORDB_HOST),
      status: !isPlaceholder(env.FALKORDB_HOST)
        ? ("ready" as const)
        : ("missing_credentials" as const),
      details: !isPlaceholder(env.FALKORDB_HOST)
        ? `Configured to connect to ${env.FALKORDB_HOST}:${env.FALKORDB_PORT || 6379}`
        : "Missing FALKORDB_HOST in environment",
    },
    paypal: {
      configured: !isPlaceholder(env.PAYPAL_CLIENT_ID) && !isPlaceholder(env.PAYPAL_CLIENT_SECRET),
      status: !isPlaceholder(env.PAYPAL_CLIENT_ID) && !isPlaceholder(env.PAYPAL_CLIENT_SECRET)
        ? ("ready" as const)
        : ("missing_credentials" as const),
      details: !isPlaceholder(env.PAYPAL_CLIENT_ID) && !isPlaceholder(env.PAYPAL_CLIENT_SECRET)
        ? "PayPal Sandbox credentials configured"
        : "Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET in environment",
    },
    gemini: {
      configured: !isPlaceholder(env.GEMINI_API_KEY),
      status: !isPlaceholder(env.GEMINI_API_KEY)
        ? ("ready" as const)
        : ("missing_credentials" as const),
      details: !isPlaceholder(env.GEMINI_API_KEY)
        ? "Gemini API key configured"
        : "Missing GEMINI_API_KEY in environment",
    },
    ollama: {
      configured: !isPlaceholder(env.OLLAMA_BASE_URL),
      status: !isPlaceholder(env.OLLAMA_BASE_URL)
        ? ("ready" as const)
        : ("disabled" as const),
      details: `Configured for Buyer: ${env.BUYER_AGENT_MODEL} | Seller: ${env.SELLER_AGENT_MODEL} at ${env.OLLAMA_BASE_URL}`,
    },
  };
}
