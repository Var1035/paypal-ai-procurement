import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { HealthResponseSchema, ProcurementRequirementSchema } from "../../../shared/contracts.js";

describe("Foundation API - Health & Error Handling", () => {
  it("GET /api/health returns 200 and matches HealthResponseSchema", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("service", "agentmarket-orchestrator");
    expect(res.body).toHaveProperty("version", "1.0.0");
    expect(res.body).toHaveProperty("services");

    // Validate against contract Zod schema
    const parseResult = HealthResponseSchema.safeParse(res.body);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      expect(parseResult.data.services.supabase).toBeDefined();
      expect(parseResult.data.services.falkordb).toBeDefined();
      expect(parseResult.data.services.paypal).toBeDefined();
      expect(parseResult.data.services.gemini).toBeDefined();
    }
  });

  it("GET /api/nonexistent returns 404 with structured error payload", async () => {
    const res = await request(app).get("/api/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("code", "NOT_FOUND");
    expect(res.body).toHaveProperty("statusCode", 404);
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("Shared Contracts - Zod Validation", () => {
  it("validates compliant procurement requirements successfully", () => {
    const validData = {
      itemName: "School Desks",
      category: "Furniture",
      quantity: 100,
      maxBudget: 450000,
      deadlineDays: 7,
      deliveryLocation: "Boston, MA",
    };

    const result = ProcurementRequirementSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects invalid procurement requirements with explicit issues", () => {
    const invalidData = {
      itemName: "X", // too short (< 2 chars)
      category: "F",
      quantity: -5, // negative
      maxBudget: -100, // negative
      deadlineDays: 0, // not positive
      deliveryLocation: "",
    };

    const result = ProcurementRequirementSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issueFields = result.error.issues.map((i) => i.path[0]);
      expect(issueFields).toContain("itemName");
      expect(issueFields).toContain("quantity");
      expect(issueFields).toContain("maxBudget");
      expect(issueFields).toContain("deadlineDays");
      expect(issueFields).toContain("deliveryLocation");
    }
  });
});
