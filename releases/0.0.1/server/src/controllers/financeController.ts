/**
 * Finance Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { financeService } from "../services/financeService";
import { normalizeInvoicePaymentPayload } from "../utils/aliasNormalizer";
import { ApiError } from "../middleware/errorHandler";

export async function getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoices = financeService.getAllInvoices();
    res.json({ success: true, message: "OK", data: invoices, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getProfitList(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profitList = financeService.getProfitList();
    res.json({ success: true, message: "OK", data: profitList, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getLabaRugiSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { period, startDate, endDate } = req.query as any;
    const summary = financeService.getCanonicalLabaRugiSummary(period || "monthly", startDate, endDate);
    res.json({ success: true, message: "OK", data: summary, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = financeService.getInvoiceById(id);
    res.json({ success: true, message: "OK", data: invoice, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getInvoicePayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const invoiceNo = req.params.invoiceNo;
    const payments = financeService.getInvoicePayments(invoiceNo);
    res.json({ success: true, message: "OK", data: payments, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function payInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "ID invoice harus berupa bilangan bulat positif yang valid.");
    }

    normalizeInvoicePaymentPayload(req.body);
    const amount = req.body.amount;
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal pembayaran harus berupa angka positif yang lebih besar dari 0.");
    }

    const headerKey = (req.headers["idempotency-key"] as string) || (req.headers["x-idempotency-key"] as string);
    const bodyKey = req.body.idempotencyKey || req.body.details?.idempotencyKey || req.body.details?.clientRequestId || req.body.details?.transactionRef;
    const idempotencyKey = headerKey || bodyKey;

    const rawDetails = req.body.details || req.body;
    normalizeInvoicePaymentPayload(rawDetails);

    const details = {
      ...rawDetails,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    const invoice = financeService.recordPayment(id, Number(amount), details, req.user);
    res.json({ success: true, message: "Pembayaran berhasil dicatat.", data: invoice, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getKasKantor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = financeService.getAllKasKantor();
    res.json({ success: true, message: "OK", data: entries, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function addKasKantor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = financeService.addKasKantor(req.body, req.user);
    res.status(201).json({ success: true, message: "Transaksi kas berhasil ditambahkan.", data: entry, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getPengeluaran(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = financeService.getAllPengeluaran();
    res.json({ success: true, message: "OK", data: entries, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function addPengeluaran(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = financeService.addPengeluaran(req.body, req.user);
    res.status(201).json({ success: true, message: "Transaksi pengeluaran berhasil ditambahkan.", data: entry, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function payoutCashback(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const headerKey = req.headers["x-idempotency-key"] as string | undefined;
    const bodyKey = req.body?.idempotencyKey as string | undefined;
    const idempotencyKey = (headerKey && headerKey.trim()) || (bodyKey && bodyKey.trim()) || undefined;

    if (!idempotencyKey) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency key (X-Idempotency-Key) wajib disertakan untuk transaksi pencairan cashback.");
    }

    const headerVersion = req.headers["x-expected-version"] as string | undefined;
    const bodyVersion = req.body?.expectedVersion;
    const rawVersion = bodyVersion !== undefined ? bodyVersion : headerVersion;

    if (rawVersion === undefined || rawVersion === null || String(rawVersion).trim() === "") {
      throw new ApiError(400, "EXPECTED_VERSION_REQUIRED", "expectedVersion (X-Expected-Version) wajib disertakan untuk transaksi pencairan cashback.");
    }

    const expectedVersion = Number(rawVersion);
    if (isNaN(expectedVersion) || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
      throw new ApiError(400, "INVALID_EXPECTED_VERSION", "expectedVersion harus berupa bilangan bulat non-negatif (0, 1, 2, ...).");
    }

    const payoutData = {
      ...req.body,
      idempotencyKey,
      expectedVersion,
    };

    const invoice = financeService.payoutCashback(id, payoutData, req.user);
    res.json({
      success: true,
      message: "Pencairan cashback/refund berhasil dicatat dan dibukukan ke Kas Kantor.",
      data: invoice,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function completeInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const invoice = financeService.completeInvoice(id, req.user);
    res.json({
      success: true,
      message: "Tagihan berhasil diselesaikan dan diarsipkan.",
      data: invoice,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteKasKantor(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const success = financeService.deleteKasKantor(id, req.user!);
    res.json({ success, message: "Entri Kas Kantor berhasil dihapus.", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function deletePengeluaran(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const success = financeService.deletePengeluaran(id, req.user!);
    res.json({ success, message: "Entri Pengeluaran berhasil dihapus.", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function getKasMessenger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = financeService.getAllKasMessenger();
    res.json({ success: true, message: "OK", data: entries, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function addKasMessenger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = financeService.addKasMessenger(req.body, req.user);
    res.status(201).json({ success: true, message: "Kas messenger berhasil dicatat.", data: entry, timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function deleteKasMessenger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const success = financeService.deleteKasMessenger(id, req.user!);
    res.json({ success, message: "Entri Kas Messenger berhasil dihapus.", timestamp: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}

export async function voidInvoicePayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const paymentId = parseInt(req.params.paymentId, 10);
    if (isNaN(id) || id <= 0 || isNaN(paymentId) || paymentId <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "ID invoice dan ID pembayaran harus berupa bilangan bulat positif yang valid.");
    }

    const reason = req.body?.reason || req.body?.voidReason || req.body?.alasan;
    const invoice = financeService.voidInvoicePayment(id, paymentId, reason, req.user);
    res.json({
      success: true,
      message: "Pembayaran berhasil dibatalkan (Void) dan jurnal pembalik telah dicatat.",
      data: invoice,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function voidCashbackPayout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "ID invoice harus berupa bilangan bulat positif yang valid.");
    }

    const reason = req.body?.reason || req.body?.voidReason || req.body?.alasan;
    const payoutId = req.body?.payoutId;
    const payoutType = req.body?.payoutType || req.body?.type;
    const invoice = financeService.voidCashbackPayout(id, reason, req.user, { payoutId, payoutType });
    res.json({
      success: true,
      message: "Pencairan cashback berhasil dibatalkan (Void) dan saldo kas telah dipulihkan.",
      data: invoice,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getVoidAuditHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const history = financeService.getVoidAuditHistory();
    res.json({
      success: true,
      message: "OK",
      data: history,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}




export async function transferMessengerToOffice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messengerId, amount, notes, idempotencyKey } = req.body;
    const user = (req as any).user;
    const result = financeService.transferMessengerToOffice(
      { messengerId, amount: Number(amount), notes, idempotencyKey },
      user
    );
    res.status(200).json({
      success: true,
      data: result,
      message: "Setoran kas messenger ke kas kantor berhasil dibukukan.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function transferOfficeToMessenger(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { messengerId, amount, notes, idempotencyKey } = req.body;
    const headerKey = (req.headers["idempotency-key"] as string) || (req.headers["x-idempotency-key"] as string);
    const resolvedKey = headerKey || idempotencyKey;
    const user = (req as any).user;
    const result = financeService.transferOfficeToMessenger(
      { messengerId, amount: Number(amount), notes, idempotencyKey: resolvedKey },
      user
    );
    res.status(200).json({
      success: true,
      data: result,
      message: "Penyerahan kas operasional kantor ke kurir berhasil dibukukan.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
