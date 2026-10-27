import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("AgentMarket - Supabase & Backend API Integration", () => {
  let createdProductId: string;
  let createdQuotationId: string;
  let createdRequestId: string;
  let createdBusinessId: string;

  beforeAll(async () => {
    // Seed initial catalog if needed
    await request(app).post("/api/products/seed");
  });

  it("1. GET /api/health probes Supabase connection and returns ready status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.services.supabase.configured).toBe(true);
    expect(res.body.services.supabase.status).toBe("ready");
    expect(res.body.services.supabase.details).toContain("Connected to Supabase");
  });

  it("2. POST /api/suppliers/register registers a supplier business and initializes agent guardrails", async () => {
    const res = await request(app)
      .post("/api/suppliers/register")
      .send({
        name: "Acme Industrial Furnishings",
        regNo: "ACME-REG-101",
        gstin: "29AABCU0000A1Z5",
        category: "Classroom Desks",
        email: "procure@acme.com",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.businessId).toBeDefined();
    createdBusinessId = res.body.businessId;
  });

  it("3. GET & PUT /api/suppliers/guardrails manages autonomous agent limits", async () => {
    const putRes = await request(app)
      .put("/api/suppliers/guardrails")
      .send({
        minMargin: 25,
        maxRoundConcession: 6,
        requireApprovalAbove: 300000,
        autoQuote: true,
      });

    expect(putRes.status).toBe(200);

    const getRes = await request(app).get("/api/suppliers/guardrails");
    expect(getRes.status).toBe(200);
    expect(getRes.body.minMargin).toBe(25);
    expect(getRes.body.maxRoundConcession).toBe(6);
  });

  it("4. POST /api/products creates a product and enforces floor price validation", async () => {
    // Should reject if floor price > base price
    const invalidRes = await request(app)
      .post("/api/products")
      .send({
        businessId: createdBusinessId,
        name: "Test Desk",
        sku: "TEST-SKU-INV",
        category: "Classroom Desks",
        basePrice: 4000,
        floorPrice: 4500, // Invalid: floor > base
        inStock: 50,
        leadDays: 5,
      });

    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.code).toBe("INVALID_PRICE_FLOOR");

    // Valid product creation
    const validRes = await request(app)
      .post("/api/products")
      .send({
        businessId: createdBusinessId,
        name: "Acme Heavy-Duty Desk",
        sku: `ACME-DSK-${Date.now()}`,
        category: "Classroom Desks",
        basePrice: 4800,
        floorPrice: 4200,
        inStock: 120,
        leadDays: 5,
        material: "Reinforced Solid Oak with Powder Coated Steel",
      });

    expect(validRes.status).toBe(201);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.product.id).toBeDefined();
    createdProductId = validRes.body.product.id;
  });

  it("5. GET /api/products returns catalog from Supabase", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.products)).toBe(true);
    expect(res.body.products.length).toBeGreaterThan(0);

    const found = res.body.products.find((p: any) => p.id === createdProductId);
    expect(found).toBeDefined();
    expect(found.basePrice).toBe(4800);
  });

  it("6. POST /api/procurement/request stores buyer intake requirement", async () => {
    const res = await request(app)
      .post("/api/procurement/request")
      .send({
        buyerName: "St. Jude Academy",
        itemName: "Classroom Desks",
        category: "Classroom Desks",
        quantity: 100,
        maxBudget: 480000,
        deadlineDays: 7,
        deliveryLocation: "Boston Campus Depot",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.requestId).toBeDefined();
    createdRequestId = res.body.requestId;
  });

  it("7. POST /api/procurement/discover filters candidates against hard stock and lead time bounds", async () => {
    const res = await request(app)
      .post("/api/procurement/discover")
      .send({
        itemName: "Classroom Desks",
        quantity: 100,
        maxBudget: 480000,
        deadlineDays: 7,
      });

    expect(res.status).toBe(200);
    expect(res.body.matches.length).toBeGreaterThan(0);
    const topMatch = res.body.matches[0];
    expect(topMatch.constraints.isEligible).toBe(true);
    expect(topMatch.constraints.meetsStock).toBe(true);
    expect(topMatch.constraints.meetsLead).toBe(true);
  });

  it("8. POST /api/procurement/approve-contact records human buyer authorization", async () => {
    const res = await request(app)
      .post("/api/procurement/approve-contact")
      .send({
        requestId: createdRequestId,
        businessId: createdBusinessId,
        approved: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.approval.approved_by_buyer).toBe(true);
  });

  it("9. POST /api/negotiation/initiate conducts bounded agent negotiation and enforces floor price", async () => {
    const res = await request(app)
      .post("/api/negotiation/initiate")
      .send({
        requestId: createdRequestId,
        productId: createdProductId,
        quantity: 100,
        buyerTargetPrice: 4000, // Lower than floor price (4200)
        buyerName: "St. Jude Academy",
        strategy: "aggressive",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.quotationId).toBeDefined();
    // HARD ENFORCEMENT: Final unit price must never drop below floor price (4200)
    expect(res.body.finalUnitPrice).toBeGreaterThanOrEqual(4200);
    expect(res.body.transcript.length).toBe(3); // Capped at 3 rounds
    expect(res.body.status).toBe("awaiting_seller_approval");
    createdQuotationId = res.body.quotationId;
  }, 30000);

  it("10. PUT /api/quotations/:id/approve records seller human sign-off and creates order in Deal Flow", async () => {
    const approveRes = await request(app).put(`/api/negotiation/quotations/${createdQuotationId}/approve`);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);
    expect(approveRes.body.quotation.status).toBe("approved");

    // Verify order was created in orders table
    const ordersRes = await request(app).get("/api/orders");
    expect(ordersRes.status).toBe(200);
    const linkedOrder = ordersRes.body.orders.find((o: any) => o.counterparty === "St. Jude Academy");
    expect(linkedOrder).toBeDefined();
    expect(linkedOrder.stage).toBe("Awaiting Payment Capture");
  });

  it("11. GET /api/health probes FalkorDB Cloud connection and returns ready status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.services.falkordb.configured).toBe(true);
    expect(res.body.services.falkordb.status).toBe("ready");
    expect(res.body.services.falkordb.details).toContain("Connected to FalkorDB Cloud");
  });

  it("12. POST /api/graph/sync synchronizes live Supabase entities to FalkorDB Cloud", async () => {
    const res = await request(app).post("/api/graph/sync");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.nodesCount).toBeGreaterThan(0);
    expect(res.body.edgesCount).toBeGreaterThanOrEqual(0);
  });

  it("13. GET /api/graph/topology retrieves live graph nodes and relationships from FalkorDB", async () => {
    const res = await request(app).get("/api/graph/topology");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it("14. POST /api/graph/query executes Cypher against FalkorDB and returns tabular records", async () => {
    const res = await request(app)
      .post("/api/graph/query")
      .send({ query: "MATCH (n) RETURN labels(n) AS label, count(n) AS count" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it("15. GET /api/health probes local Ollama connection and reports ready status with models", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.services.ollama).toBeDefined();
    expect(res.body.services.ollama.configured).toBe(true);
    expect(res.body.services.ollama.status).toBe("ready");
    expect(res.body.services.ollama.details).toContain("deepseek-r1:14b");
  });
});
