import { Router, Request, Response } from "express";
import { env, getServicesConnectivityStatus } from "../config/env.js";
import { testSupabaseConnection } from "../services/supabase.js";
import { testFalkorDBConnection } from "../services/falkordb.js";
import { testOllamaConnection } from "../services/ollama.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  const services = getServicesConnectivityStatus();
  
  // 1. Perform real runtime probe for Supabase
  if (services.supabase.configured) {
    const supabaseProbe = await testSupabaseConnection();
    if (supabaseProbe.ok) {
      services.supabase.status = "ready";
      services.supabase.details = supabaseProbe.message;
    } else {
      services.supabase.status = "connection_error";
      services.supabase.details = supabaseProbe.message;
    }
  }

  // 2. Perform real runtime probe for FalkorDB
  if (services.falkordb.configured) {
    const falkorProbe = await testFalkorDBConnection();
    if (falkorProbe.ok) {
      services.falkordb.status = "ready";
      services.falkordb.details = falkorProbe.message;
    } else {
      services.falkordb.status = "connection_error";
      services.falkordb.details = falkorProbe.message;
    }
  }

  // 3. Perform real runtime probe for local Ollama
  if (services.ollama.configured) {
    const ollamaProbe = await testOllamaConnection();
    if (ollamaProbe.ok) {
      services.ollama.status = "ready";
      services.ollama.details = ollamaProbe.message;
    } else {
      services.ollama.status = "connection_error";
      services.ollama.details = ollamaProbe.message;
    }
  }

  const response = {
    status: "ok" as const,
    service: "agentmarket-orchestrator" as const,
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services,
  };

  res.status(200).json(response);
});
