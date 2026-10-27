import express, { Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { productsRouter } from "./routes/products.js";
import { procurementRouter } from "./routes/procurement.js";
import { negotiationRouter } from "./routes/negotiation.js";
import { ordersRouter } from "./routes/orders.js";
import { graphRouter } from "./routes/graph.js";
import { aiRouter } from "./routes/ai.js";
import { paymentsRouter } from "./routes/payments.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

// Security and utility middleware
app.use(
  cors({
    origin: [env.CLIENT_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    credentials: true,
  })
);
app.use(express.json());

// API Routes
app.use("/api/health", healthRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/products", productsRouter);
app.use("/api/procurement", procurementRouter);
app.use("/api/negotiation", negotiationRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/graph", graphRouter);
app.use("/api/ai", aiRouter);
app.use("/api/payments", paymentsRouter);

// Catch-all 404 handler for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling
app.use(errorHandler);
