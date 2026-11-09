/**
 * Employee Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getEmployees,
  getEmployeeById,
  getNextEmployeeId,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../controllers/employeeController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const employeeRouter = Router();

// List all employees (Administrator & Admin only)
employeeRouter.get(
  "/",
  requireAuth,
  requireRoles("administrator", "admin"),
  getEmployees
);

// Get next available Employee ID format (e.g. EMP-0007)
employeeRouter.get(
  "/next-id",
  requireAuth,
  requireRoles("administrator", "admin"),
  getNextEmployeeId
);

// Get employee by ID
employeeRouter.get(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  getEmployeeById
);

// Create employee
employeeRouter.post(
  "/",
  requireAuth,
  requireRoles("administrator", "admin"),
  createEmployee
);

// Update employee
employeeRouter.put(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  updateEmployee
);

// Delete employee
employeeRouter.delete(
  "/:id",
  requireAuth,
  requireRoles("administrator", "admin"),
  deleteEmployee
);
