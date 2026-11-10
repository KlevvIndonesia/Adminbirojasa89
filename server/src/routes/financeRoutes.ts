/**
 * Finance Routes (Secured & Validated)
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import {
  getInvoices,
  getProfitList,
  getLabaRugiSummary,
  getInvoiceById,
  getInvoicePayments,
  payInvoice,
  verifyInvoicePayment,
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
  transferMessengerToOffice,
  transferOfficeToMessenger,
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
  requireRoles("administrator", "finance", "svp", "admin"),
  getInvoices
);

financeRouter.get(
  "/laba-rugi",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getLabaRugiSummary
);

financeRouter.get(
  "/pnl",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getLabaRugiSummary
);

financeRouter.get(
  "/profit",
  requireAuth,
  requireRoles("administrator", "finance", "svp"),
  getProfitList
);

financeRouter.get(
  "/invoices/:id",
  requireAuth,
  requireRoles("administrator", "finance", "svp", "admin"),
  getInvoiceById
);

financeRouter.get(
  "/invoices/:invoiceNo/payments",
  requireAuth,
  requireRoles("administrator", "finance", "svp", "admin"),
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

// Payment verification (Administrator, Finance, Admin & Supervisor / SPV)
financeRouter.post(
  "/invoices/:id/payments/:paymentId/verify",
  requireAuth,
  requireRoles("administrator", "finance", "admin", "svp"),
  verifyInvoicePayment
);

financeRouter.post(
  "/invoices/:id/verify-payment",
  requireAuth,
  requireRoles("administrator", "finance", "admin", "svp"),
  verifyInvoicePayment
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


// Internal Transfer: Setor Sisa Kas Messenger ke Kas Kantor
financeRouter.post(
  "/transfer/messenger-to-office",
  requireAuth,
  requireRoles("administrator", "finance", "supervisor", "svp", "admin"),
  transferMessengerToOffice
);

// Internal Transfer: Kas Kantor ke Messenger (Panjar/Uang Jalan)
financeRouter.post(
  "/transfer/office-to-messenger",
  requireAuth,
  requireRoles("administrator", "finance", "supervisor", "svp", "admin"),
  transferOfficeToMessenger
);


