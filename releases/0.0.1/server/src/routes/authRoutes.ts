/**
 * Authentication Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { login, me, changePassword } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";
import { loginRateLimiter } from "../middleware/rateLimiter";
import { validateLoginPayload } from "../middleware/validation";

export const authRouter = Router();

// Login endpoint with rate limiting and payload validation
authRouter.post("/login", loginRateLimiter, validateLoginPayload, login);

// Protected session check
authRouter.get("/me", requireAuth, me);

// Self-service password change
authRouter.post("/change-password", requireAuth, changePassword);
