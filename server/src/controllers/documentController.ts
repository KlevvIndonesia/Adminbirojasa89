/**
 * Document Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { documentService } from "../services/documentService";
import { documentTicketService } from "../services/documentTicketService";
import { dbDocumentRepository } from "../repositories/dbDocumentRepository";
import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { verifyToken, TokenPayload } from "../utils/crypto";
import { ApiError } from "../middleware/errorHandler";
import { normalizeDocumentUploadPayload } from "../utils/aliasNormalizer";

async function resolveDocumentUser(
  req: AuthenticatedRequest,
  docId: string,
  operation: "preview" | "download"
): Promise<TokenPayload> {
  // 1. Check Bearer token from header
  if (req.user) {
    return req.user;
  }

  const authHeader = req.headers["authorization"];
  if (authHeader) {
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) {
      const verified = verifyToken(token);
      if (verified) return verified;
    }
  }

  // 2. Check short-lived access ticket
  const ticket = typeof req.query?.ticket === "string" ? req.query.ticket.trim() : "";
  if (ticket) {
    const validation = documentTicketService.validateTicket(ticket, docId, operation);
    if (validation.valid && validation.ticketData) {
      return {
        userId: validation.ticketData.userId,
        email: "",
        nama: validation.ticketData.userName,
        jabatan: validation.ticketData.userRole,
        role: validation.ticketData.userRole as any,
        exp: Math.floor(validation.ticketData.expiresAt / 1000),
      };
    }
  }

  throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan untuk mengakses berkas dokumen.");
}

export async function createAccessTicket(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const operation = req.body?.operation === "download" ? "download" : "preview";

    // 1. Verify document existence
    const doc = dbDocumentRepository.findById(id);
    if (!doc || doc.isActive === false) {
      throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Dokumen tidak ditemukan atau telah dinonaktifkan.");
    }

    // 2. Ticket Issuance Authorization Matrix
    const role = (req.user.role || req.user.jabatan || "").toLowerCase();
    const uid = String(req.user.userId || (req.user as any).id || "");

    if (role === "administrator" || role === "svp" || role === "finance") {
      // Full ticket issuance access
    } else if (role === "admin") {
      // Operational admin can issue tickets for order documents or documents uploaded by this admin
      const isOwner = doc.uploadedById === uid;
      const isOperationalOrder = Boolean(doc.orderNo);
      if (!isOperationalOrder && !isOwner) {
        throw new ApiError(
          403,
          "FORBIDDEN_DOCUMENT_ACCESS",
          "Staf operasional hanya memiliki wewenang menerbitkan tiket untuk dokumen yang terkait order operasional."
        );
      }
    } else if (role === "messenger") {
      // Messenger ONLY has access if the document is linked to an order assigned to them
      if (!doc.orderNo) {
        throw new ApiError(
          403,
          "FORBIDDEN_DOCUMENT_ACCESS",
          "Kurir tidak memiliki izin untuk menerbitkan tiket pada dokumen non-order."
        );
      }

      const order = dbOrderRepository.getByOrderNo(doc.orderNo);
      if (!order) {
        throw new ApiError(
          403,
          "FORBIDDEN_DOCUMENT_ACCESS",
          "Order operasional terkait dokumen ini tidak ditemukan."
        );
      }

      const uName = (req.user.nama || "").toLowerCase().trim();
      const uEmpId = ((req.user as any).employeeId || req.user.userId || "").toLowerCase().trim();

      const ordMessenger = (order.messenger || (order as any).assignedMessengerName || "").toLowerCase().trim();
      const ordPengantar = ((order as any).messengerPengantar || "").toLowerCase().trim();
      const assignedEmpId = ((order as any).assignedMessengerId || "").toLowerCase().trim();
      const deliveryEmpId = ((order as any).deliveryMessengerId || "").toLowerCase().trim();

      const isAssigned =
        (ordMessenger && (ordMessenger === uName || ordMessenger.includes(uName) || uName.includes(ordMessenger))) ||
        (ordPengantar && (ordPengantar === uName || ordPengantar.includes(uName) || uName.includes(ordPengantar))) ||
        (assignedEmpId && (assignedEmpId === uEmpId || assignedEmpId === uName)) ||
        (deliveryEmpId && (deliveryEmpId === uEmpId || deliveryEmpId === uName));

      if (!isAssigned) {
        throw new ApiError(
          403,
          "FORBIDDEN_DOCUMENT_ACCESS",
          "Anda tidak memiliki wewenang menerbitkan tiket untuk dokumen order yang tidak ditugaskan kepada Anda."
        );
      }
    } else {
      throw new ApiError(403, "FORBIDDEN_DOCUMENT_ACCESS", "Akses penerbitan tiket dokumen ditolak.");
    }

    const ticketEntry = documentTicketService.createTicket(id, req.user, operation);
    res.status(201).json({
      success: true,
      message: "Tiket akses dokumen berhasil diterbitkan.",
      data: {
        ticket: ticketEntry.ticket,
        expiresInSeconds: 60,
        documentId: id,
        operation: ticketEntry.operation,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export const createDocumentTicket = createAccessTicket;

export async function uploadDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new ApiError(400, "MISSING_FILE", "Berkas upload (field 'file') wajib disertakan.");
    }

    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan untuk mengunggah dokumen.");
    }

    normalizeDocumentUploadPayload(req.body);

    const doc = await documentService.uploadDocument({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      reportedMime: req.file.mimetype,
      documentType: req.body.documentType || "DOKUMEN_PENDUKUNG",
      orderNo: req.body.orderNo || undefined,
      invoiceId: req.body.invoiceId || undefined,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined,
      user: req.user,
    });

    res.status(201).json({
      success: true,
      message: "Dokumen berhasil diunggah dan disimpan secara permanen.",
      data: doc,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const doc = documentService.getDocumentById(id, req.user);
    res.json({
      success: true,
      message: "OK",
      data: doc,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function previewDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resolvedUser = await resolveDocumentUser(req, id, "preview");
    const { doc, stream } = await documentService.getDocumentStream(id, resolvedUser);

    // Allow embedding in app iframes with tailored CSP per mimeType
    res.removeHeader("X-Frame-Options");
    const allowedAncestors = "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000 http://localhost:3001 http://127.0.0.1:3001 http://localhost:5173 http://127.0.0.1:5173";
    if (doc.mimeType === "application/pdf") {
      res.setHeader("Content-Security-Policy", `default-src 'none'; style-src 'unsafe-inline'; object-src 'self'; ${allowedAncestors}`);
    } else {
      res.setHeader("Content-Security-Policy", `default-src 'none'; img-src 'self' data: blob:; ${allowedAncestors}`);
    }

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.originalName)}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`
    );
    res.setHeader("Content-Length", doc.sizeBytes);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function downloadDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const resolvedUser = await resolveDocumentUser(req, id, "download");
    const { doc, stream } = await documentService.getDocumentStream(id, resolvedUser);

    res.setHeader("Content-Type", doc.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(doc.originalName)}"; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`
    );
    res.setHeader("Content-Length", doc.sizeBytes);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox;");

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function getDocumentsByOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const orderNo = Array.isArray(req.params.orderNo) ? req.params.orderNo[0] : req.params.orderNo;
    const docs = documentService.getDocumentsByOrder(orderNo, req.user);
    res.json({
      success: true,
      message: "OK",
      data: docs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getDocumentsByInvoice(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
    const docs = documentService.getDocumentsByInvoice(invoiceId, req.user);
    res.json({
      success: true,
      message: "OK",
      data: docs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDocument(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await documentService.deleteDocument(id, req.user);
    res.json({
      success: true,
      message: "Dokumen berhasil dihapus.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function linkDocumentToOrder(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    normalizeDocumentUploadPayload(req.body);
    const { orderNo } = req.body;
    if (!orderNo) {
      throw new ApiError(400, "VALIDATION_ERROR", "Field 'orderNo' (atau alias 'order_no') wajib disertakan.");
    }
    const success = documentService.linkOrder(id, orderNo, req.user);
    res.json({
      success,
      message: success ? "Dokumen berhasil dihubungkan ke order." : "Gagal menghubungkan dokumen.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
