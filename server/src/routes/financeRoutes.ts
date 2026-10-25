/**
 * Finance Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getInvoices,
  getInvoiceById,
  getInvoicePayments,
  payInvoice,
  payoutCashback,
  completeInvoice,
  getKasKantor,
  addKasKantor,
  deleteKasKantor,
  getPengeluaran,
  addPengeluaran,
  deletePengeluaran,
  getKasMessenger,
  addKasMessenger,
  deleteKasMessenger,
  voidInvoicePayment,
  voidCashbackPayout,
  getVoidAuditHistory,
} from "../controllers/financeController";
import { requireAuth, requireRoles } from "../middleware/auth";
import {
  validateInvoicePaymentPayload,
  validateKasKantorPayload,
  validatePengeluaranPayload,
} from "../middleware/validation";

export const financeRouter = Router();

// Read operations (Protected from anonymous access & restricted to authorized roles)
financeRouter.get(
  "/invoices",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getInvoices
);

financeRouter.get(
  "/invoices/:id",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getInvoiceById
);

financeRouter.get(
  "/invoices/:invoiceNo/payments",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getInvoicePayments
);

// Payment mutation (Strictly Administrator & Finance with amount validation)
financeRouter.post(
  "/invoices/:id/pay",
  requireAuth,
  requireRoles("administrator", "finance"),
  validateInvoicePaymentPayload,
  payInvoice
);

financeRouter.post(
  "/invoices/:id/cashback-payout",
  requireAuth,
  requireRoles("administrator", "finance"),
  payoutCashback
);

financeRouter.post(
  "/invoices/:id/complete",
  requireAuth,
  requireRoles("administrator", "finance"),
  completeInvoice
);

// Void / Cancel payment (Strictly Administrator & Supervisor / SPV)
financeRouter.post(
  "/invoices/:id/payments/:paymentId/void",
  requireAuth,
  requireRoles("administrator", "supervisor", "spv", "svp"),
  voidInvoicePayment
);

// Void / Cancel cashback payout (Strictly Administrator & Supervisor / SPV)
financeRouter.post(
  "/invoices/:id/cashback-payout/void",
  requireAuth,
  requireRoles("administrator", "supervisor", "spv", "svp"),
  voidCashbackPayout
);

// Void Audit History Log (Strictly Administrator & Supervisor / SPV)
financeRouter.get(
  "/audit/void-history",
  requireAuth,
  requireRoles("administrator", "supervisor", "spv", "svp"),
  getVoidAuditHistory
);

// Kas Kantor read (Protected)
financeRouter.get(
  "/kas-kantor",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getKasKantor
);

// Kas Kantor mutation (Administrator & Finance with debit/credit validation)
financeRouter.post(
  "/kas-kantor",
  requireAuth,
  requireRoles("administrator", "finance"),
  validateKasKantorPayload,
  addKasKantor
);

financeRouter.delete(
  "/kas-kantor/:id",
  requireAuth,
  requireRoles("administrator", "finance"),
  deleteKasKantor
);

// Pengeluaran read (Protected)
financeRouter.get(
  "/pengeluaran",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getPengeluaran
);

// Pengeluaran mutation (Administrator & Finance)
financeRouter.post(
  "/pengeluaran",
  requireAuth,
  requireRoles("administrator", "finance"),
  validatePengeluaranPayload,
  addPengeluaran
);

financeRouter.delete(
  "/pengeluaran/:id",
  requireAuth,
  requireRoles("administrator", "finance"),
  deletePengeluaran
);

// Kas Messenger (Database Connected)
financeRouter.get(
  "/kas-messenger",
  requireAuth,
  requireRoles("administrator", "admin", "finance", "messenger"),
  getKasMessenger
);

financeRouter.post(
  "/kas-messenger",
  requireAuth,
  requireRoles("administrator", "finance", "admin"),
  addKasMessenger
);

financeRouter.delete(
  "/kas-messenger/:id",
  requireAuth,
  requireRoles("administrator", "finance"),
  deleteKasMessenger
);

