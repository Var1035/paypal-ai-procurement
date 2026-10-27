import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export interface CustomHttpError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(
  err: CustomHttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const timestamp = new Date().toISOString();

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details: err.issues,
      timestamp,
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const code = err.code || (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST");
  const message = err.message || "An unexpected error occurred";

  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
    details: err.details,
    timestamp,
  });
}
