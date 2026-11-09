/**
 * Employee Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { employeeService } from "../services/employeeService";

export async function getEmployees(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const employees = employeeService.getAll();
    res.json({ success: true, message: "OK", data: employees, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const employee = employeeService.getById(id);
    res.json({ success: true, message: "OK", data: employee, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getNextEmployeeId(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const nextId = employeeService.generateNextId();
    res.json({ success: true, message: "OK", data: { nextId }, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const newEmployee = employeeService.createEmployee(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Karyawan berhasil dibuat.",
      data: newEmployee,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updated = employeeService.updateEmployee(id, req.body, req.user);
    res.json({
      success: true,
      message: "Data karyawan berhasil diperbarui.",
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const success = employeeService.deleteEmployee(id, req.user);
    res.json({
      success,
      message: "Karyawan berhasil dihapus.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
