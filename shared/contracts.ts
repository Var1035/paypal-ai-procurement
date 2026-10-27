import { z } from "zod";

// --- Service Connectivity Status ---
export const ServiceStatusSchema = z.object({
  configured: z.boolean(),
  status: z.enum(["ready", "missing_credentials", "connection_error", "disabled"]),
  details: z.string().optional(),
});
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

// --- Health Check Contract ---
export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  service: z.literal("agentmarket-orchestrator"),
  version: z.string(),
  timestamp: z.string(),
  environment: z.string(),
  services: z.object({
    supabase: ServiceStatusSchema,
    falkordb: ServiceStatusSchema,
    paypal: ServiceStatusSchema,
    gemini: ServiceStatusSchema,
    ollama: ServiceStatusSchema.optional(),
  }),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// --- Standard API Error Contract ---
export const ApiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  statusCode: z.number(),
  details: z.any().optional(),
  timestamp: z.string(),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// --- Common Domain Enums & Schemas for Downstream Phases ---
export const RoleEnum = z.enum(["buyer", "seller", "admin"]);
export type Role = z.infer<typeof RoleEnum>;

export const ProcurementStatusEnum = z.enum([
  "draft",
  "analyzing",
  "discovering",
  "contact_approved",
  "negotiating",
  "quoted",
  "seller_approved",
  "buyer_approved",
  "paid",
  "completed",
  "cancelled",
]);
export type ProcurementStatus = z.infer<typeof ProcurementStatusEnum>;

// Core Procurement Requirement
export const ProcurementRequirementSchema = z.object({
  itemName: z.string().min(2, "Item name must be at least 2 characters"),
  category: z.string().min(2, "Category is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  maxBudget: z.number().positive("Budget must be greater than 0"),
  deadlineDays: z.number().int().positive("Deadline in days must be positive"),
  specifications: z.record(z.string(), z.string()).optional(),
  deliveryLocation: z.string().min(2, "Delivery location is required"),
});
export type ProcurementRequirement = z.infer<typeof ProcurementRequirementSchema>;
