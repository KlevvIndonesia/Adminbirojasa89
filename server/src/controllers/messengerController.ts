/**
 * Messenger REST API Controller
 * Admin SUN89 — Biro Jasa Management System
 */

import { Request, Response, NextFunction } from "express";
import { messengerService } from "../services/messengerService";
import { normalizeReimbursementPayload } from "../utils/aliasNormalizer";
import { ApiError } from "../middleware/errorHandler";

/**
 * Resolves the authenticated courier's canonical identifiers with strict validation.
 */
function resolveAuthenticatedMessenger(user: any): { employeeId: string; name: string; userId: string } {
  const name = (user?.nama || (user as any)?.userName || "").trim();
  const userId = typeof user?.userId === "string" ? user.userId.trim() : "";
  const employeeId = typeof user?.employeeId === "string" ? user.employeeId.trim() : "";

  // For messenger role, a verified canonical employeeId is mandatory
  if (user?.role === "messenger") {
    if (!employeeId || employeeId === "EMP-MSG" || employeeId === "EMP-SAMSAT" || employeeId === "Belum Ditugaskan" || employeeId === "-") {
      throw new ApiError(403, "FORBIDDEN", "Identitas kurir tidak valid atau tidak memiliki employeeId kanonikal.");
    }
    return { employeeId, name: name || "Messenger", userId };
  }

  const canonicalId = employeeId || userId;
  if (!canonicalId || canonicalId === "EMP-MSG" || canonicalId === "EMP-SAMSAT" || canonicalId === "Belum Ditugaskan" || canonicalId === "-") {
    throw new ApiError(403, "FORBIDDEN", "Identitas pengguna tidak valid atau tidak terverifikasi.");
  }

  return { employeeId: canonicalId, name: name || "Petugas Operasional", userId };
}


export async function getMyTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "Autentikasi diperlukan.");
    }
    const data = messengerService.getMyTasks(user);
    res.json({
      success: true,
      message: "OK",
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessengersWithStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };
    const data = messengerService.getMessengersWithStats(dateFrom, dateTo);

    res.status(200).json({
      success: true,
      data,
      total: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessengerHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const q = req.query as Record<string, string>;
    const { taskType, dateFrom, dateTo, search } = q;

    let messenger = q.messenger || q.messengerName || q.messenger_name;
    let employeeId = q.employeeId || q.employee_id;

    // IDOR / BOLA Prevention: Enforce caller scoping if role is messenger
    if (user?.role === "messenger") {
      const authMessenger = resolveAuthenticatedMessenger(user);
      employeeId = authMessenger.employeeId;
      messenger = authMessenger.name;
    }

    const data = messengerService.getMessengerTaskHistory({
      messenger,
      employeeId,
      taskType,
      dateFrom,
      dateTo,
      search,
    });

    res.status(200).json({
      success: true,
      data,
      total: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getTaskDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderNo = Array.isArray(req.params.orderNo) ? req.params.orderNo[0] : req.params.orderNo;
    const taskType = typeof req.query.taskType === "string" ? req.query.taskType : undefined;
    const user = (req as any).user;

    const data = messengerService.getTaskDetail(orderNo, taskType);

    // IDOR / Object-Level Access Control: Couriers can ONLY access tasks assigned to their identity
    if (user?.role === "messenger") {
      const authMessenger = resolveAuthenticatedMessenger(user);
      const userEmpId = authMessenger.employeeId.toLowerCase();
      const userName = authMessenger.name.toLowerCase();
      const userId = authMessenger.userId.toLowerCase();

      const task = data.task;
      const rawOrder = task.rawOrder as any;

      const taskMessenger = (task.messenger || "").toLowerCase();
      const taskEmpId = (task.messengerEmployeeId || "").toLowerCase();

      const orderMessenger = (rawOrder?.messenger || "").toLowerCase();
      const assignedName = (rawOrder?.assignedMessengerName || "").toLowerCase();
      const assignedId = (rawOrder?.assignedMessengerId || "").toLowerCase();
      const deliveryMessenger = (rawOrder?.messengerPengantar || "").toLowerCase();
      const deliveryId = (rawOrder?.deliveryMessengerId || "").toLowerCase();
      const samsatMessengerId = (rawOrder?.samsatMessengerId || "").toLowerCase();
      const samsatPickupMessengerId = (rawOrder?.samsatPickupMessengerId || "").toLowerCase();

      const isAssigned =
        Boolean(taskEmpId && (taskEmpId === userEmpId || (userId && taskEmpId === userId))) ||
        Boolean(assignedId && (assignedId === userEmpId || (userId && assignedId === userId))) ||
        Boolean(deliveryId && (deliveryId === userEmpId || (userId && deliveryId === userId))) ||
        Boolean(samsatMessengerId && (samsatMessengerId === userEmpId || (userId && samsatMessengerId === userId))) ||
        Boolean(samsatPickupMessengerId && (samsatPickupMessengerId === userEmpId || (userId && samsatPickupMessengerId === userId)));

      if (!isAssigned) {
        throw new ApiError(
          403,
          "FORBIDDEN_TASK_ACCESS",
          "Anda tidak memiliki wewenang untuk mengakses rincian tugas/order ini."
        );
      }
    }

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getReimbursements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as any).user;
    const q = req.query as Record<string, string>;
    const orderNo = q.orderNo || q.order_no;
    const status = q.status;

    let employeeId = q.employeeId || q.employee_id;
    let messengerName: string | undefined = undefined;

    // IDOR / BOLA Prevention: Restrict couriers to only their own reimbursement claims
    if (user?.role === "messenger") {
      const authMessenger = resolveAuthenticatedMessenger(user);
      employeeId = authMessenger.employeeId;
      messengerName = authMessenger.name;
    }

    const data = messengerService.getAllReimbursements({
      employeeId,
      messengerName,
      orderNo,
      status,
    });

    res.status(200).json({
      success: true,
      data,
      total: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function createReimbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    normalizeReimbursementPayload(req.body);
    const user = (req as any).user;
    if (user?.role === "messenger") {
      const authMessenger = resolveAuthenticatedMessenger(user);
      // Strictly enforce caller's canonical identity to prevent client spoofing
      req.body.employeeId = authMessenger.employeeId;
      req.body.messengerName = authMessenger.name;
    }
    const data = messengerService.createReimbursement(req.body, user);

    res.status(201).json({
      success: true,
      data,
      message: "Pengajuan biaya berhasil diajukan.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function reviewReimbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { decision, reviewNotes, approvedAmount, rejectedAmount } = req.body;
    const user = (req as any).user;

    const data = messengerService.reviewReimbursement(
      id,
      decision,
      user,
      reviewNotes,
      approvedAmount,
      rejectedAmount
    );

    res.status(200).json({
      success: true,
      data,
      message: `Pengajuan biaya '${id}' berhasil ${decision.toLowerCase()}.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function payReimbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { paymentMethod, transactionRef, channel } = req.body;
    const user = (req as any).user;

    const data = messengerService.payReimbursement(id, user, { paymentMethod, transactionRef, channel });

    res.status(200).json({
      success: true,
      data,
      message: `Pencairan reimbursement '${id}' berhasil dibukukan.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function voidReimbursement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { voidReason } = req.body;
    const user = (req as any).user;

    const data = messengerService.voidReimbursement(id, user, voidReason);

    res.status(200).json({
      success: true,
      data,
      message: `Pembatalan (void) pencairan reimbursement '${id}' berhasil dibukukan.`,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
