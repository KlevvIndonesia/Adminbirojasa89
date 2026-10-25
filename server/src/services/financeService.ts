/**
 * Finance Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { dbFinanceRepository } from "../repositories/dbFinanceRepository";
import { dbOrderRepository } from "../repositories/dbOrderRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { dbDocumentRepository } from "../repositories/dbDocumentRepository";
import { dbMessengerRepository } from "../repositories/dbMessengerRepository";
import { db, runInTransaction } from "../database/db";
import { InvoiceBillingRecord, KasKantorItem, PengeluaranItem, KasMessengerItem } from "../../../src/domain/finance/types";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../utils/crypto";

export class FinanceService {
  public getAllInvoices(): InvoiceBillingRecord[] {
    return dbFinanceRepository.getAllInvoices();
  }

  public getInvoiceById(id: number): InvoiceBillingRecord {
    const inv = dbFinanceRepository.getInvoiceById(id);
    if (!inv) {
      throw new ApiError(404, "INVOICE_NOT_FOUND", `Invoice ID '${id}' tidak ditemukan.`);
    }
    return inv;
  }

  public getInvoicePayments(invoiceNo: string): any[] {
    return dbFinanceRepository.getPaymentsByInvoiceNo(invoiceNo);
  }

  public getOrderPayments(orderNo: string): any[] {
    return dbFinanceRepository.getPaymentsByOrderNo(orderNo);
  }

  public recordPayment(id: number, amount: number, paymentDetails: any, user?: TokenPayload | null): InvoiceBillingRecord {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal pembayaran harus berupa angka positif yang valid.");
    }

    const inv = this.getInvoiceById(id);

    // P0 Anti-Double Payment: Strict rejection if invoice is already fully paid or remaining is 0
    const currentPaid = Number(inv.dibayar ?? inv.terbayar ?? 0);
    const currentRemaining = inv.sisa !== undefined ? Number(inv.sisa) : Math.max(0, inv.totalTagihan - currentPaid);

    if (inv.status === "PAID" || inv.status === "Lunas" || currentRemaining <= 0) {
      throw new ApiError(400, "INVOICE_ALREADY_PAID", "Invoice ini sudah lunas. Pembayaran baru tidak dapat diproses.");
    }

    // P0 Strict validation: Payment amount cannot exceed remaining balance
    if (amount > currentRemaining) {
      throw new ApiError(400, "EXCESSIVE_PAYMENT_AMOUNT", `Nominal pembayaran (Rp ${amount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${currentRemaining.toLocaleString("id-ID")}).`);
    }

    // Phase B Payment Security Gating: Payment cannot be processed before final cost is set and Supervisi is approved
    if (inv.orderNo) {
      const linkedOrder = dbOrderRepository.getByOrderNo(inv.orderNo);
      if (!linkedOrder) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${inv.orderNo}' yang terhubung dengan invoice #${id} tidak ditemukan.`);
      }
      if (linkedOrder.currentStageName === "Dibatalkan" || Boolean((linkedOrder as any).isCancelled)) {
        throw new ApiError(400, "ORDER_CANCELLED", `Order '${linkedOrder.orderNo}' telah dibatalkan. Pembayaran tidak dapat diproses.`);
      }

      const hasFinalCost = Boolean(
        linkedOrder.isVerified ||
        (typeof (linkedOrder as any).finalCost === "number" && (linkedOrder as any).finalCost > 0) ||
        linkedOrder.documentApproval?.stage5Verified ||
        linkedOrder.currentStep >= 6
      );
      if (!hasFinalCost) {
        throw new ApiError(
          400,
          "FINAL_COST_NOT_SET",
          `Pembayaran untuk order '${linkedOrder.orderNo}' tidak dapat diproses karena rincian biaya final belum ditetapkan.`
        );
      }

      const isSupervisiApproved = Boolean(
        linkedOrder.approvedBySpv ||
        linkedOrder.documentApproval?.stage6Approved ||
        linkedOrder.currentStep >= 7
      );
      if (!isSupervisiApproved) {
        throw new ApiError(
          400,
          "SUPERVISI_NOT_APPROVED",
          `Pembayaran untuk order '${linkedOrder.orderNo}' tidak dapat diproses karena belum disetujui oleh Supervisor (Stage 6 Supervisi).`
        );
      }
    }

    const proof = paymentDetails?.buktiPembayaran || paymentDetails?.buktiBayar || (paymentDetails?.fileUrl ? {
      fileName: paymentDetails.fileName || "Bukti_Pembayaran",
      fileType: paymentDetails.fileType || "image",
      fileUrl: paymentDetails.fileUrl,
      documentId: paymentDetails.documentId,
      uploadedAt: new Date().toISOString(),
    } : null);

    return runInTransaction(() => {
      // Re-fetch inside transaction lock
      const lockedInv = this.getInvoiceById(id);
      const lockedPaid = Number(lockedInv.dibayar ?? lockedInv.terbayar ?? 0);
      const lockedRemaining = lockedInv.sisa !== undefined ? Number(lockedInv.sisa) : Math.max(0, lockedInv.totalTagihan - lockedPaid);

      if (lockedInv.status === "PAID" || lockedInv.status === "Lunas" || lockedRemaining <= 0) {
        throw new ApiError(400, "INVOICE_ALREADY_PAID", "Invoice ini sudah lunas. Pembayaran baru tidak dapat diproses.");
      }
      if (amount > lockedRemaining) {
        throw new ApiError(
          400,
          "EXCESSIVE_PAYMENT_AMOUNT",
          `Nominal pembayaran (Rp ${amount.toLocaleString("id-ID")}) melampaui sisa tagihan (Rp ${lockedRemaining.toLocaleString("id-ID")}).`
        );
      }

      // Re-verify payment security gating inside transaction lock
      if (lockedInv.orderNo) {
        const lockedOrder = dbOrderRepository.getByOrderNo(lockedInv.orderNo);
        if (!lockedOrder) {
          throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${lockedInv.orderNo}' yang terhubung dengan invoice #${id} tidak ditemukan.`);
        }
        if (lockedOrder.currentStageName === "Dibatalkan" || Boolean((lockedOrder as any).isCancelled)) {
          throw new ApiError(400, "ORDER_CANCELLED", `Order '${lockedOrder.orderNo}' telah dibatalkan. Pembayaran tidak dapat diproses.`);
        }

        const hasFinalCost = Boolean(
          lockedOrder.isVerified ||
          (typeof (lockedOrder as any).finalCost === "number" && (lockedOrder as any).finalCost > 0) ||
          lockedOrder.documentApproval?.stage5Verified ||
          lockedOrder.currentStep >= 6
        );
        if (!hasFinalCost) {
          throw new ApiError(
            400,
            "FINAL_COST_NOT_SET",
            `Pembayaran untuk order '${lockedOrder.orderNo}' tidak dapat diproses karena rincian biaya final belum ditetapkan.`
          );
        }

        const isSupervisiApproved = Boolean(
          lockedOrder.approvedBySpv ||
          lockedOrder.documentApproval?.stage6Approved ||
          lockedOrder.currentStep >= 7
        );
        if (!isSupervisiApproved) {
          throw new ApiError(
            400,
            "SUPERVISI_NOT_APPROVED",
            `Pembayaran untuk order '${lockedOrder.orderNo}' tidak dapat diproses karena belum disetujui oleh Supervisor (Stage 6 Supervisi).`
          );
        }
      }

      // P0 Persistent Idempotency: Protect against concurrent retry and prevent parameter reuse
      const idempotencyKey = paymentDetails?.idempotencyKey || paymentDetails?.clientRequestId || paymentDetails?.transactionRef;
      const requestHash = `${id}:${amount}`;
      if (idempotencyKey) {
        const existingRecord = dbFinanceRepository.getIdempotencyRecord(idempotencyKey, "payment");
        if (existingRecord) {
          if (existingRecord.request_hash === requestHash) {
            // Identical retry: return current invoice directly without double-charging
            return this.getInvoiceById(id);
          } else {
            // Reused key with different transaction parameters: reject with 409 Conflict
            throw new ApiError(
              409,
              "IDEMPOTENCY_CONFLICT",
              `Idempotency key '${idempotencyKey}' sudah digunakan untuk transaksi pembayaran dengan parameter berbeda.`
            );
          }
        }
      }

      const newDibayar = lockedPaid + amount;
      const newSisa = Math.max(0, lockedInv.totalTagihan - newDibayar);
      const newStatus = newSisa === 0 ? "PAID" : "PARTIAL";

      const success = dbFinanceRepository.updateInvoice(id, {
        dibayar: newDibayar,
        sisa: newSisa,
        status: newStatus,
      });

      if (!success) {
        throw new ApiError(500, "PAYMENT_FAILED", "Gagal mencatat pembayaran invoice.");
      }

      // Record cash inflow into Kas Kantor atomically with explicit order and invoice links
      const nowStr = new Date().toISOString();
      const paymentDate = nowStr.split("T")[0];
      const bankName = paymentDetails?.bank || paymentDetails?.metodePembayaran || "Kas Kantor";
      const invoiceNum = lockedInv.invoiceNo || (lockedInv as any).invoice || `INV-${id}`;
      const kasEntry = dbFinanceRepository.addKasKantor({
        tanggal: paymentDate,
        keterangan: `Pembayaran: ${invoiceNum} - ${lockedInv.customer} (${lockedInv.nopol || "-"} / ${bankName})`,
        status: "Debit",
        debit: amount,
        kredit: 0,
        penanggungJawab: user?.nama || "Finance User",
        orderNo: lockedInv.orderNo || undefined,
        invoiceNo: invoiceNum,
      });

      // Validate document relation before saving payment record
      let verifiedDocId: string | undefined = undefined;
      if (proof?.documentId) {
        const existingDoc = dbDocumentRepository.findById(proof.documentId);
        if (existingDoc) {
          verifiedDocId = proof.documentId;
        }
      }

      // Record into canonical invoice_payments relational table
      dbFinanceRepository.recordInvoicePayment({
        invoiceNo: invoiceNum,
        orderNo: lockedInv.orderNo || "",
        nominal: amount,
        metodePembayaran: paymentDetails?.metodePembayaran || bankName,
        namaBank: bankName,
        nomorRekening: paymentDetails?.noRekening || paymentDetails?.nomorRekening || undefined,
        tanggalBayar: paymentDate,
        documentId: verifiedDocId,
        kasKantorId: kasEntry.id,
        statusVerifikasi: proof ? "TERVERIFIKASI" : "TERCATAT",
        idempotencyKey: idempotencyKey || undefined,
        verifiedBy: user?.nama || "Finance User",
        verifiedAt: nowStr,
        catatan: paymentDetails?.catatan || "Pembayaran Tagihan / Pelunasan",
      });

      // Synchronize to linked Order in SQLite orders table atomically
      if (lockedInv.orderNo) {
        const linkedOrder = dbOrderRepository.getByOrderNo(lockedInv.orderNo);
        if (linkedOrder) {
          const orderPaymentStatus = (newSisa === 0 ? "Lunas" : (newDibayar > 0 ? "Kurang" : "Belum Lunas")) as any;
          const uniquePayId = idempotencyKey ? `pay-${idempotencyKey}` : `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const newPaymentRecord = {
            id: uniquePayId,
            idempotencyKey: idempotencyKey || undefined,
            nominal: amount,
            tanggal: nowStr,
            metodePembayaran: paymentDetails?.metodePembayaran || bankName,
            namaBank: bankName,
            namaRekening: paymentDetails?.namaRekening || "",
            noRekening: paymentDetails?.noRekening || "",
            buktiPembayaran: proof,
            statusVerifikasi: (proof ? "TERVERIFIKASI" : "TERCATAT") as any,
            verifiedAt: nowStr,
            verifiedBy: user?.nama || "Finance User",
            uploadedBy: user?.nama || "Finance User",
            catatan: paymentDetails?.catatan || "Pembayaran Tagihan / Pelunasan",
          };
          const existingRecords = linkedOrder.payment?.paymentRecords || [];
          const updatedOrderPayment = {
            ...linkedOrder.payment,
            dibayar: newDibayar,
            kurang: newSisa,
            statusPembayaran: orderPaymentStatus,
            isPaymentVerified: newSisa === 0,
            tanggalBayar: nowStr.split("T")[0],
            buktiPembayaran: linkedOrder.payment?.buktiPembayaran || proof,
            paymentRecords: [...existingRecords, newPaymentRecord],
            ...(paymentDetails?.metodePembayaran ? { metodePembayaran: paymentDetails.metodePembayaran } : {}),
          };

          dbOrderRepository.saveOrder({
            ...linkedOrder,
            payment: updatedOrderPayment,
          });
        }
      }

      // Persist idempotency key on success
      if (idempotencyKey) {
        dbFinanceRepository.saveIdempotencyRecord({
          key: idempotencyKey,
          scope: "payment",
          user_id: user?.userId || null,
          request_hash: requestHash,
          resource_id: String(id),
          response_json: JSON.stringify({ invoiceId: id, amount, status: newStatus }),
        });
      }

      dbAuditRepository.save({
        id: `log-fin-pay-${Date.now()}`,
        userId: user?.userId || "usr-finance",
        userName: user?.nama || "Finance User",
        userRole: user?.role || "finance",
        action: "RECORD_PAYMENT",
        module: "Keuangan",
        details: `Penerimaan pembayaran invoice ${lockedInv.invoiceNo} sejumlah Rp ${amount.toLocaleString("id-ID")}`,
        metadata: { invoiceId: id, orderNo: lockedInv.orderNo, amount, paymentDetails },
        createdAt: new Date().toISOString(),
      });

      return this.getInvoiceById(id);
    });
  }

  public getAllKasKantor(): KasKantorItem[] {
    return dbFinanceRepository.getAllKasKantor();
  }

  public addKasKantor(item: Omit<KasKantorItem, "id">, user?: TokenPayload | null): KasKantorItem {
    const rawOrderNo = (item as any).orderNo?.trim();
    const rawInvoiceNo = (item as any).invoiceNo?.trim();

    if (rawOrderNo) {
      const orderExists = dbOrderRepository.getByOrderNo(rawOrderNo);
      if (!orderExists) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${rawOrderNo}' tidak ditemukan.`);
      }
    }

    if (rawInvoiceNo) {
      const invExists = dbFinanceRepository.getInvoiceByNo(rawInvoiceNo);
      if (!invExists) {
        throw new ApiError(404, "INVOICE_NOT_FOUND", `Invoice '${rawInvoiceNo}' tidak ditemukan.`);
      }
    }

    const created = dbFinanceRepository.addKasKantor(item);

    dbAuditRepository.save({
      id: `log-kas-${Date.now()}`,
      userId: user?.userId || "usr-finance",
      userName: user?.nama || "Finance User",
      userRole: user?.role || "finance",
      action: "ADD_KAS",
      module: "Kas Kantor",
      details: `Transaksi Kas: ${item.keterangan} (${item.status}) Rp ${(item.debit || item.kredit).toLocaleString("id-ID")}`,
      metadata: { item },
      createdAt: new Date().toISOString(),
    });

    return created;
  }

  public payoutCashback(
    id: number,
    payoutData: {
      nominal: number;
      paymentType?: "KELEBIHAN" | "KOMISI" | "ALL";
      penerima: string;
      nomorHP?: string;
      bank: string;
      noRekening: string;
      namaRekening: string;
      buktiPembayaran: any;
      catatan?: string;
    },
    user?: TokenPayload | null
  ): InvoiceBillingRecord {
    const nominal = Number(payoutData.nominal);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal pencairan cashback/refund harus berupa angka positif.");
    }
    if (!payoutData.penerima || !payoutData.penerima.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama penerima cashback/refund wajib diisi.");
    }
    const isCash = (payoutData as any).paymentMethod?.toLowerCase().includes("tunai") ||
                   (payoutData as any).paymentMethod?.toLowerCase().includes("cash") ||
                   payoutData.bank?.toLowerCase().includes("tunai") ||
                   payoutData.bank?.toLowerCase().includes("cash") ||
                   payoutData.bank === "Kas Kantor" ||
                   payoutData.bank === "—" ||
                   payoutData.bank === "-";

    if (!isCash) {
      if (!payoutData.bank || !payoutData.bank.trim() || !payoutData.noRekening || !payoutData.noRekening.trim()) {
        throw new ApiError(400, "VALIDATION_ERROR", "Informasi rekening bank tujuan (Nama Bank dan Nomor Rekening) wajib diisi untuk transfer bank.");
      }
      payoutData.namaRekening = (payoutData.namaRekening || "").trim();
    }

    const proof = payoutData.buktiPembayaran || (payoutData as any).fileUrl ? {
      fileName: payoutData.buktiPembayaran?.fileName || (payoutData as any).fileName || "Bukti_Transfer_Cashback",
      fileType: payoutData.buktiPembayaran?.fileType || (payoutData as any).fileType || "image",
      fileUrl: payoutData.buktiPembayaran?.fileUrl || (payoutData as any).fileUrl,
      documentId: payoutData.buktiPembayaran?.documentId || (payoutData as any).documentId,
      uploadedAt: new Date().toISOString(),
    } : null;

    // Phase B Payment Security Gating: Cashback cannot be disbursed before final cost is set and Supervisi is approved
    const invPre = this.getInvoiceById(id);
    if (!invPre) {
      throw new ApiError(404, "NOT_FOUND", `Invoice #${id} tidak ditemukan.`);
    }

    if (invPre.orderNo) {
      const linkedOrder = dbOrderRepository.getByOrderNo(invPre.orderNo);
      if (!linkedOrder) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${invPre.orderNo}' yang terhubung dengan invoice #${id} tidak ditemukan.`);
      }
      const isCancelledOrder = linkedOrder.currentStageName === "Dibatalkan" || Boolean((linkedOrder as any).isCancelled);
      if (isCancelledOrder) {
        if (!invPre.overpayment || invPre.overpayment <= 0) {
          throw new ApiError(400, "ORDER_CANCELLED", `Order '${linkedOrder.orderNo}' telah dibatalkan dan tidak memiliki saldo dana titipan untuk dikembalikan.`);
        }
      } else {
        const hasFinalCost = Boolean(
          linkedOrder.isVerified ||
          (typeof (linkedOrder as any).finalCost === "number" && (linkedOrder as any).finalCost > 0) ||
          linkedOrder.documentApproval?.stage5Verified ||
          linkedOrder.currentStep >= 6
        );
        if (!hasFinalCost) {
          throw new ApiError(
            400,
            "FINAL_COST_NOT_SET",
            `Pencairan cashback/kelebihan bayar untuk order '${linkedOrder.orderNo}' tidak dapat diproses karena rincian biaya final belum ditetapkan.`
          );
        }

        const isSupervisiApproved = Boolean(
          linkedOrder.approvedBySpv ||
          linkedOrder.documentApproval?.stage6Approved ||
          linkedOrder.currentStep >= 7
        );
        if (!isSupervisiApproved) {
          throw new ApiError(
            400,
            "SUPERVISI_NOT_APPROVED",
            `Pencairan cashback/kelebihan bayar untuk order '${linkedOrder.orderNo}' tidak dapat diproses karena belum disetujui oleh Supervisor (Stage 6 Supervisi).`
          );
        }
      }
    }

    return runInTransaction(() => {
      const inv = this.getInvoiceById(id);
      if (!inv) {
        throw new ApiError(404, "NOT_FOUND", `Invoice #${id} tidak ditemukan.`);
      }

      // Re-verify payment security gating inside transaction lock
      if (inv.orderNo) {
        const lockedOrder = dbOrderRepository.getByOrderNo(inv.orderNo);
        if (!lockedOrder) {
          throw new ApiError(404, "ORDER_NOT_FOUND", "Order tidak valid.");
        }
        const isCancelledOrder = lockedOrder.currentStageName === "Dibatalkan" || Boolean((lockedOrder as any).isCancelled);
        if (isCancelledOrder) {
          if (!inv.overpayment || inv.overpayment <= 0) {
            throw new ApiError(400, "ORDER_CANCELLED", "Order telah dibatalkan dan tidak memiliki saldo refund.");
          }
        } else {
          const isSupervisiApproved = Boolean(
            lockedOrder.approvedBySpv ||
            lockedOrder.documentApproval?.stage6Approved ||
            lockedOrder.currentStep >= 7
          );
          if (!isSupervisiApproved) {
            throw new ApiError(
              400,
              "SUPERVISI_NOT_APPROVED",
              "Pencairan ditolak karena belum disetujui oleh Supervisor (Stage 6 Supervisi)."
            );
          }
        }
      }

      const pType = payoutData.paymentType || (inv.overpayment && inv.overpayment > 0 ? "KELEBIHAN" : "KOMISI");

      const maxAllowed = pType === "KELEBIHAN"
        ? Number(inv.overpayment || 0)
        : (pType === "KOMISI" ? Number(inv.cashback || 0) : (Number(inv.overpayment || 0) + Number(inv.cashback || 0)));

      if (maxAllowed > 0 && nominal > maxAllowed) {
        throw new ApiError(400, "EXCEEDS_LIMIT", `Nominal pencairan (Rp ${nominal.toLocaleString("id-ID")}) melebihi batas saldo yang dapat dicairkan (Rp ${maxAllowed.toLocaleString("id-ID")}).`);
      }

      if (pType === "KELEBIHAN" && inv.refundStatus === "PROCESSED") {
        throw new ApiError(400, "ALREADY_PROCESSED", "Pengembalian kelebihan bayar untuk invoice ini sudah diproses sebelumnya.");
      }
      if (pType === "KOMISI" && inv.cashbackStatus === "REALIZED") {
        throw new ApiError(400, "ALREADY_PROCESSED", "Pencairan komisi rekanan untuk invoice ini sudah diproses sebelumnya.");
      }

      const nowStr = new Date().toISOString();
      const paymentDate = (payoutData as any).tanggal && typeof (payoutData as any).tanggal === "string" && (payoutData as any).tanggal.trim()
        ? (payoutData as any).tanggal.trim()
        : nowStr.split("T")[0];

      const updates: Partial<InvoiceBillingRecord> = {};
      if (pType === "KELEBIHAN" || pType === "ALL") {
        updates.refundStatus = "PROCESSED";
        (updates as any).refundProcessedAt = nowStr;
        (updates as any).refundProcessedBy = user?.nama || "Finance User";
        (updates as any).refundProof = proof;
        (updates as any).refundAccount = isCash ? {
          penerima: payoutData.penerima,
          nomorHP: payoutData.nomorHP || "-",
          metode: "Tunai",
        } : {
          penerima: payoutData.penerima,
          nomorHP: payoutData.nomorHP || "-",
          bank: payoutData.bank,
          noRekening: payoutData.noRekening,
          namaRekening: payoutData.namaRekening,
        };
      }
      if (pType === "KOMISI" || pType === "ALL") {
        updates.cashbackStatus = "REALIZED";
        (updates as any).cashbackPaidAt = nowStr;
        (updates as any).cashbackPaidBy = user?.nama || "Finance User";
        (updates as any).cashbackProof = proof;
        (updates as any).cashbackAccount = isCash ? {
          penerima: payoutData.penerima,
          nomorHP: payoutData.nomorHP || "-",
          metode: "Tunai",
        } : {
          penerima: payoutData.penerima,
          nomorHP: payoutData.nomorHP || "-",
          bank: payoutData.bank,
          noRekening: payoutData.noRekening,
          namaRekening: payoutData.namaRekening,
        };
      }

      const success = dbFinanceRepository.updateInvoice(id, updates);
      if (!success) {
        throw new ApiError(500, "PAYMENT_FAILED", "Gagal memperbarui status pencairan cashback pada invoice.");
      }

      // Record 1 Kas Keluar (Kredit) atomically in kas_kantor
      const channelDesc = isCash ? "Kas Tunai" : `Transfer ${payoutData.bank}`;
      const desc = pType === "KELEBIHAN"
        ? `Pengembalian kelebihan bayar: ${inv.invoiceNo || `INV-${id}`} - ${payoutData.penerima} (${inv.nopol || "-"} / ${channelDesc})`
        : `Pencairan komisi rekanan: ${inv.invoiceNo || `INV-${id}`} - ${payoutData.penerima} (${inv.nopol || "-"} / ${channelDesc})`;

      dbFinanceRepository.addKasKantor({
        tanggal: paymentDate,
        keterangan: desc,
        status: "Kredit",
        debit: 0,
        kredit: nominal,
        penanggungJawab: user?.nama || "Finance User",
        orderNo: inv.orderNo || undefined,
        invoiceNo: inv.invoiceNo || `INV-${id}`,
      });

      // Synchronize to linked order if present
      if (inv.orderNo) {
        const linkedOrder = dbOrderRepository.getByOrderNo(inv.orderNo);
        if (linkedOrder) {
          dbOrderRepository.saveOrder({
            ...linkedOrder,
            payment: {
              ...linkedOrder.payment,
              refundStatus: updates.refundStatus || linkedOrder.payment?.refundStatus,
              refundAmount: nominal,
              refundProcessedAt: nowStr,
              refundProcessedBy: user?.nama || "Finance User",
            },
          });
        }
      }

      // Audit Log
      dbAuditRepository.save({
        id: `log-cashback-pay-${Date.now()}`,
        userId: user?.userId || "usr-finance",
        userName: user?.nama || "Finance User",
        userRole: user?.role || "finance",
        action: "CASHBACK_PAYOUT",
        module: "Cashback Terpending",
        details: `${desc} sejumlah Rp ${nominal.toLocaleString("id-ID")}`,
        metadata: { invoiceId: id, orderNo: inv.orderNo, nominal, payoutData },
        createdAt: nowStr,
      });

      return this.getInvoiceById(id);
    });
  }

  public completeInvoice(id: number, user?: TokenPayload | null): InvoiceBillingRecord {
    return runInTransaction(() => {
      const inv = this.getInvoiceById(id);
      const paid = Number(inv.terbayar ?? inv.dibayar) || 0;
      const total = Number(inv.totalTagihan) || 0;
      if (paid < total || (inv.sisa && inv.sisa > 0) || (inv.status !== "Lunas" && inv.status !== "PAID")) {
        throw new ApiError(400, "INVOICE_NOT_PAID", "Hanya tagihan yang sudah lunas yang dapat diselesaikan dan diarsipkan.");
      }

      const nowStr = new Date().toISOString();
      const success = dbFinanceRepository.updateInvoice(id, {
        billingStatus: "COMPLETED",
        completedAt: nowStr,
        completedBy: user?.nama || "Finance User",
      });

      if (!success) {
        throw new ApiError(500, "UPDATE_FAILED", "Gagal memperbarui status invoice.");
      }

      dbAuditRepository.save({
        id: `log-inv-complete-${Date.now()}`,
        userId: user?.userId || "usr-finance",
        userName: user?.nama || "Finance User",
        userRole: user?.role || "finance",
        action: "COMPLETE_INVOICE",
        module: "Tagihan",
        details: `Menyelesaikan dan mengarsipkan tagihan ${inv.invoiceNo}`,
        metadata: { invoiceId: id, orderNo: inv.orderNo },
        createdAt: nowStr,
      });

      return this.getInvoiceById(id);
    });
  }

  /**
   * Void / Cancel a recorded invoice payment (Storno / Reversal).
   * Restricted strictly to roles: Administrator, Supervisor (SPV), or SVP.
   * Atomically posts a Kredit reversal into kas_kantor, marks invoice_payment as VOID,
   * decrements paid amount, restores remaining balance, resets invoice and order status,
   * and records an immutable audit log.
   */
  public voidInvoicePayment(
    id: number,
    paymentId: number,
    voidReason: string,
    user?: TokenPayload | null
  ): InvoiceBillingRecord {
    const userRole = (user?.role || "").toLowerCase();
    const isSpvOrAdmin =
      userRole === "administrator" ||
      userRole === "supervisor" ||
      userRole === "spv" ||
      userRole === "svp" ||
      (user as any)?.jabatan === "SVP";

    if (!isSpvOrAdmin) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Hanya Supervisor (SPV) atau Administrator yang berwenang membatalkan transaksi pembayaran."
      );
    }

    const reason = (voidReason || "").trim();
    if (!reason || reason.length < 10) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Alasan pembatalan transaksi wajib diisi minimal 10 karakter demi akuntabilitas audit."
      );
    }

    return runInTransaction(() => {
      const inv = this.getInvoiceById(id);
      if (!inv) {
        throw new ApiError(404, "NOT_FOUND", `Invoice #${id} tidak ditemukan.`);
      }

      const payment = dbFinanceRepository.getInvoicePaymentById(paymentId);
      if (!payment) {
        throw new ApiError(404, "PAYMENT_NOT_FOUND", `Data pembayaran #${paymentId} tidak ditemukan.`);
      }

      if (payment.is_void === 1 || payment.status_verifikasi === "VOID") {
        throw new ApiError(400, "PAYMENT_ALREADY_VOIDED", `Pembayaran #${paymentId} sudah dibatalkan sebelumnya.`);
      }

      const invoiceNum = inv.invoiceNo || (inv as any).invoice || `INV-${id}`;
      if (payment.invoice_no !== invoiceNum && payment.invoice_no !== inv.invoiceNo) {
        throw new ApiError(
          400,
          "PAYMENT_MISMATCH",
          `Pembayaran #${paymentId} tidak terdaftar pada invoice ${invoiceNum}.`
        );
      }

      const amount = Number(payment.nominal);
      const nowStr = new Date().toISOString();
      const paymentDate = nowStr.split("T")[0];

      // 1. Post atomic Kredit reversal in Kas Kantor
      const reversalKas = dbFinanceRepository.addKasKantor({
        tanggal: paymentDate,
        keterangan: `[BATAL/VOID] Koreksi Pelunasan: ${invoiceNum} - ${reason}`,
        status: "Kredit",
        debit: 0,
        kredit: amount,
        penanggungJawab: user?.nama || "Supervisor",
        orderNo: inv.orderNo || undefined,
        invoiceNo: invoiceNum,
      });

      // 2. Mark payment as VOID
      dbFinanceRepository.updateInvoicePayment(paymentId, {
        is_void: 1,
        status_verifikasi: "VOID",
        void_reason: reason,
        voided_by: user?.nama || "Supervisor",
        voided_at: nowStr,
        reversal_kas_id: reversalKas.id,
      });

      // 3. Recalculate invoice balance and status
      const currentPaid = Number(inv.dibayar ?? inv.terbayar ?? 0);
      const newPaid = Math.max(0, currentPaid - amount);
      const totalTagihan = Number(inv.totalTagihan || 0);
      const newSisa = Math.max(0, totalTagihan - newPaid);
      const newStatus = (newSisa === 0 && totalTagihan > 0) ? "PAID" : (newPaid > 0 ? "PARTIAL" : "UNPAID");

      dbFinanceRepository.updateInvoice(id, {
        dibayar: newPaid,
        sisa: newSisa,
        status: newStatus as any,
        billingStatus: "ACTIVE",
      });

      // 4. Synchronize with linked Order in orders table
      if (inv.orderNo) {
        const linkedOrder = dbOrderRepository.getByOrderNo(inv.orderNo);
        if (linkedOrder) {
          const existingRecords = (linkedOrder.payment?.paymentRecords || []).map((r: any) => {
            if (
              r.id === payment.idempotency_key ||
              r.id === `pay-${payment.idempotency_key}` ||
              (Number(r.nominal) === amount && !r.isVoid)
            ) {
              return { ...r, statusVerifikasi: "VOID", isVoid: true, voidReason: reason, voidedAt: nowStr, voidedBy: user?.nama || "Supervisor" };
            }
            return r;
          });
          const orderPayStatus = (newSisa === 0 && totalTagihan > 0) ? "Lunas" : (newPaid > 0 ? "Kurang Bayar" : "Belum Lunas");
          dbOrderRepository.saveOrder({
            ...linkedOrder,
            payment: {
              ...linkedOrder.payment,
              dibayar: newPaid,
              kurang: newSisa,
              statusPembayaran: orderPayStatus as any,
              isPaymentVerified: false,
              paymentRecords: existingRecords,
            },
          });
        }
      }

      // 5. Immutable Audit Log
      dbAuditRepository.save({
        id: `log-void-pay-${Date.now()}`,
        userId: user?.userId || "usr-spv",
        userName: user?.nama || "Supervisor",
        userRole: user?.role || "supervisor",
        action: "VOID_INVOICE_PAYMENT",
        module: "Finance Tagihan",
        details: `[VOID] Pembatalan pembayaran #${paymentId} (${invoiceNum}) sebesar Rp ${amount.toLocaleString("id-ID")} oleh ${user?.nama}. Alasan: ${reason}`,
        metadata: { invoiceId: id, paymentId, nominal: amount, reason, reversalKasId: reversalKas.id },
        createdAt: nowStr,
      });

      return this.getInvoiceById(id);
    });
  }

  /**
   * Void / Cancel a disbursed cashback or overpayment refund.
   * Restricted strictly to roles: Administrator, Supervisor (SPV), or SVP.
   * Atomically posts a Debit reversal into kas_kantor (restores cash),
   * resets invoice refundStatus back to PENDING, and logs to audit trail.
   */
  public voidCashbackPayout(
    id: number,
    voidReason: string,
    user?: TokenPayload | null
  ): InvoiceBillingRecord {
    const userRole = (user?.role || "").toLowerCase();
    const isSpvOrAdmin =
      userRole === "administrator" ||
      userRole === "supervisor" ||
      userRole === "spv" ||
      userRole === "svp" ||
      (user as any)?.jabatan === "SVP";

    if (!isSpvOrAdmin) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Hanya Supervisor (SPV) atau Administrator yang berwenang membatalkan transaksi pencairan cashback."
      );
    }

    const reason = (voidReason || "").trim();
    if (!reason || reason.length < 10) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Alasan pembatalan transaksi wajib diisi minimal 10 karakter demi akuntabilitas audit."
      );
    }

    return runInTransaction(() => {
      const inv = this.getInvoiceById(id);
      if (!inv) {
        throw new ApiError(404, "NOT_FOUND", `Invoice #${id} tidak ditemukan.`);
      }

      if (inv.refundStatus !== "PROCESSED" && inv.cashbackStatus !== "REALIZED") {
        throw new ApiError(
          400,
          "CASHBACK_NOT_PROCESSED",
          "Pencairan cashback untuk invoice ini belum pernah diproses atau sudah dibatalkan sebelumnya."
        );
      }

      const nominal = Number(inv.overpayment || inv.cashback || 0);
      const invoiceNum = inv.invoiceNo || (inv as any).invoice || `INV-${id}`;
      const nowStr = new Date().toISOString();
      const paymentDate = nowStr.split("T")[0];

      // 1. Post atomic Debit reversal in Kas Kantor (restore cash)
      const reversalKas = dbFinanceRepository.addKasKantor({
        tanggal: paymentDate,
        keterangan: `[BATAL/VOID] Koreksi Pencairan Cashback: ${invoiceNum} - ${reason}`,
        status: "Debit",
        debit: nominal,
        kredit: 0,
        penanggungJawab: user?.nama || "Supervisor",
        orderNo: inv.orderNo || undefined,
        invoiceNo: invoiceNum,
      });

      // 2. Revert invoice refund status
      dbFinanceRepository.updateInvoice(id, {
        refundStatus: "PENDING",
        cashbackStatus: "PENDING",
        settlementCondition: "OVERPAID",
      });

      // 3. Immutable Audit Log
      dbAuditRepository.save({
        id: `log-void-cashback-${Date.now()}`,
        userId: user?.userId || "usr-spv",
        userName: user?.nama || "Supervisor",
        userRole: user?.role || "supervisor",
        action: "VOID_CASHBACK_PAYOUT",
        module: "Cashback Terpending",
        details: `[VOID] Pembatalan pencairan cashback invoice #${id} (${invoiceNum}) sebesar Rp ${nominal.toLocaleString("id-ID")} oleh ${user?.nama}. Alasan: ${reason}`,
        metadata: { invoiceId: id, nominal, reason, reversalKasId: reversalKas.id },
        createdAt: nowStr,
      });

      return this.getInvoiceById(id);
    });
  }

  public getAllPengeluaran(): PengeluaranItem[] {
    return dbFinanceRepository.getAllPengeluaran();
  }

  public addPengeluaran(item: Omit<PengeluaranItem, "id">, user?: TokenPayload | null): PengeluaranItem {
    const rawOrderNo = (item as any).orderNo?.trim();
    const rawInvoiceNo = (item as any).invoiceNo?.trim();

    if (rawOrderNo) {
      const orderExists = dbOrderRepository.getByOrderNo(rawOrderNo);
      if (!orderExists) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${rawOrderNo}' tidak ditemukan.`);
      }
    }

    if (rawInvoiceNo) {
      const invExists = dbFinanceRepository.getInvoiceByNo(rawInvoiceNo);
      if (!invExists) {
        throw new ApiError(404, "INVOICE_NOT_FOUND", `Invoice '${rawInvoiceNo}' tidak ditemukan.`);
      }
    }

    const created = dbFinanceRepository.addPengeluaran(item);

    dbAuditRepository.save({
      id: `log-pengeluaran-${Date.now()}`,
      userId: user?.userId || "usr-finance",
      userName: user?.nama || "Finance User",
      userRole: user?.role || "finance",
      action: "ADD_PENGELUARAN",
      module: "Pengeluaran",
      details: `Pengeluaran: ${item.keterangan} Rp ${item.nominal.toLocaleString("id-ID")}${item.penanggungJawab ? ` (PJ: ${item.penanggungJawab})` : ""}`,
      metadata: { item },
      createdAt: new Date().toISOString(),
    });

    return created;
  }

  public deleteKasKantor(id: number, user: TokenPayload): boolean {
    const existing = dbFinanceRepository.getKasKantorById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Entri Kas Kantor #${id} tidak ditemukan.`);
    }

    // Referential integrity check: Cannot delete if linked to invoice_payments
    const payCheck = db.prepare("SELECT COUNT(*) as count FROM invoice_payments WHERE kas_kantor_id = ?").get(id) as any;
    if (payCheck && payCheck.count > 0) {
      throw new ApiError(
        409,
        "CANNOT_DELETE_LINKED_KAS",
        `Entri Kas Kantor #${id} terhubung dengan data verifikasi pembayaran tagihan (invoice_payments) dan tidak dapat dihapus untuk menjaga integritas pelaporan.`
      );
    }

    const ket = existing.keterangan || "";
    if (
      ket.startsWith("Pembayaran: INV-") ||
      ket.startsWith("Pencairan Reimbursement:") ||
      ket.startsWith("Pengembalian kelebihan bayar:") ||
      ket.startsWith("Pencairan komisi rekanan:")
    ) {
      throw new ApiError(
        400,
        "SYSTEM_ENTRY_PROTECTED",
        "Transaksi kas otomatis dari pelunasan tagihan atau pencairan reimbursement/cashback tidak dapat dihapus langsung untuk menjaga konsistensi keuangan. Lakukan pembatalan melalui transaksi sumbernya."
      );
    }

    const success = dbFinanceRepository.deleteKasKantor(id);
    if (success) {
      dbAuditRepository.save({
        id: `audit-del-kaskantor-${Date.now()}`,
        userId: user.userId,
        userName: user.nama,
        userRole: user.role as any,
        action: "DELETE",
        module: "Kas Kantor",
        details: `Menghapus entri Kas Kantor #${id} (${existing.keterangan} - ${existing.status})`,
        metadata: { id, existing },
        createdAt: new Date().toISOString(),
      });
    }
    return success;
  }

  public deletePengeluaran(id: number, user: TokenPayload): boolean {
    const existing = dbFinanceRepository.getPengeluaranById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Entri Pengeluaran #${id} tidak ditemukan.`);
    }

    // Referential integrity check: Cannot delete if linked to messenger_reimbursements
    const reimbCheck = db.prepare("SELECT COUNT(*) as count FROM messenger_reimbursements WHERE pengeluaran_id = ?").get(id) as any;
    if (reimbCheck && reimbCheck.count > 0) {
      throw new ApiError(
        409,
        "CANNOT_DELETE_LINKED_PENGELUARAN",
        `Entri Pengeluaran #${id} terhubung dengan pengajuan reimbursement kurir dan tidak dapat dihapus untuk menjaga keutuhan audit trail.`
      );
    }

    const ket = existing.keterangan || "";
    if (ket.startsWith("Reimbursement ")) {
      throw new ApiError(
        400,
        "SYSTEM_ENTRY_PROTECTED",
        "Pengeluaran otomatis dari pencairan reimbursement kurir tidak dapat dihapus langsung demi integritas audit trail."
      );
    }

    const success = dbFinanceRepository.deletePengeluaran(id);
    if (success) {
      dbAuditRepository.save({
        id: `audit-del-pengeluaran-${Date.now()}`,
        userId: user.userId,
        userName: user.nama,
        userRole: user.role as any,
        action: "DELETE",
        module: "Pengeluaran",
        details: `Menghapus entri Pengeluaran #${id} (${existing.keterangan} - Rp ${existing.nominal.toLocaleString("id-ID")})`,
        metadata: { id, existing },
        createdAt: new Date().toISOString(),
      });
    }
    return success;
  }

  // ─── KAS MESSENGER DATABASE SERVICES ───────────────────────────────────────

  public getAllKasMessenger(): KasMessengerItem[] {
    return dbFinanceRepository.getAllKasMessenger();
  }

  public addKasMessenger(
    item: Omit<KasMessengerItem, "id" | "total"> & { total?: number; orderNo?: string },
    user?: TokenPayload | null
  ): KasMessengerItem {
    if (!item.messenger || !item.messenger.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nama messenger wajib diisi.");
    }
    if (!item.jenis || !item.jenis.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "Jenis kas messenger wajib diisi.");
    }
    const debit = Number(item.in || 0);
    const kredit = Number(item.out || 0);
    if (debit < 0 || kredit < 0 || (debit === 0 && kredit === 0)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Nominal kas masuk (in) atau kas keluar (out) harus lebih besar dari 0.");
    }

    const rawOrderNo = item.orderNo?.trim();
    const rawReimbId = (item as any).reimbursementId?.trim();

    if (rawOrderNo) {
      const orderExists = dbOrderRepository.getByOrderNo(rawOrderNo);
      if (!orderExists) {
        throw new ApiError(404, "ORDER_NOT_FOUND", `Order '${rawOrderNo}' tidak ditemukan.`);
      }
    }

    if (rawReimbId) {
      const reimbExists = dbMessengerRepository.getReimbursementById(rawReimbId);
      if (!reimbExists) {
        throw new ApiError(404, "REIMBURSEMENT_NOT_FOUND", `Pengajuan reimbursement '${rawReimbId}' tidak ditemukan.`);
      }
    }

    const created = dbFinanceRepository.addKasMessenger({
      ...item,
      penanggungJawab: user?.nama || "Admin Finance",
    });

    // QC-02 Fix: Double-entry balanced bookkeeping. If panjar/uang jalan given to messenger, post Credit to Kas Kantor
    if (debit > 0 && ((item.jenis || "").toLowerCase().includes("petty") || (item.jenis || "").toLowerCase().includes("uang jalan") || (item.jenis || "").toLowerCase().includes("panjar") || Boolean((item as any).deductKasKantor))) {
      dbFinanceRepository.addKasKantor({
        tanggal: item.tanggal,
        keterangan: `[KAS KELUAR] Panjar Uang Jalan Kurir: ${item.messenger} (${item.keterangan || item.jenis})${rawOrderNo ? ` [Order: ${rawOrderNo}]` : ""}`,
        status: "Kredit",
        debit: 0,
        kredit: debit,
        penanggungJawab: user?.nama || "Admin Finance",
        orderNo: rawOrderNo || undefined,
      });
    }

    dbAuditRepository.save({
      id: `audit-kas-msg-${Date.now()}`,
      userId: user?.userId || "usr-finance",
      userName: user?.nama || "Finance User",
      userRole: user?.role || "finance",
      action: "ADD_KAS_MESSENGER",
      module: "Kas Messenger",
      details: `Kas Messenger (${item.messenger}): ${item.keterangan} [Masuk: Rp ${debit.toLocaleString("id-ID")}, Keluar: Rp ${kredit.toLocaleString("id-ID")}]`,
      metadata: { created },
      createdAt: new Date().toISOString(),
    });

    return created;
  }

  public deleteKasMessenger(id: number, user: TokenPayload): boolean {
    const existing = dbFinanceRepository.getKasMessengerById(id);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Entri Kas Messenger #${id} tidak ditemukan.`);
    }

    // Referential integrity check: Cannot delete if linked to messenger_reimbursements
    const reimbCheck = db.prepare("SELECT COUNT(*) as count FROM messenger_reimbursements WHERE kas_messenger_id = ?").get(id) as any;
    if (reimbCheck && reimbCheck.count > 0) {
      throw new ApiError(
        409,
        "CANNOT_DELETE_LINKED_KAS_MESSENGER",
        `Entri Kas Messenger #${id} terhubung dengan pencairan reimbursement kurir dan tidak dapat dihapus.`
      );
    }
    if ((existing as any).reimbursementId) {
      throw new ApiError(
        409,
        "CANNOT_DELETE_LINKED_KAS_MESSENGER",
        `Entri Kas Messenger #${id} dicatat dari reimbursement '${(existing as any).reimbursementId}' dan dilindungi dari penghapusan langsung.`
      );
    }

    const success = dbFinanceRepository.deleteKasMessenger(id);
    if (success) {
      dbAuditRepository.save({
        id: `audit-del-kas-msg-${Date.now()}`,
        userId: user.userId,
        userName: user.nama,
        userRole: user.role as any,
        action: "DELETE",
        module: "Kas Messenger",
        details: `Menghapus entri Kas Messenger #${id}`,
        metadata: { id },
        createdAt: new Date().toISOString(),
      });
    }
    return success;
  }

  public getVoidAuditHistory(): { payments: any[]; cashbacks: any[] } {
    const payments = db.prepare(`
      SELECT 
        p.id as payment_id,
        COALESCE(p.invoice_no, '') as invoice_no,
        COALESCE(p.order_no, '') as order_no,
        COALESCE(i.customer, '') as customer,
        p.nominal,
        COALESCE(p.metode_pembayaran, '') as metode_pembayaran,
        p.is_void,
        COALESCE(p.void_reason, '') as void_reason,
        COALESCE(p.voided_by, '') as voided_by,
        COALESCE(p.voided_at, '') as voided_at,
        p.reversal_kas_id,
        'VOID_PAYMENT' as void_type
      FROM invoice_payments p
      LEFT JOIN finance_invoices i ON p.invoice_no = i.invoice_no
      WHERE p.is_void = 1
      ORDER BY p.voided_at DESC
    `).all() as any[];

    const cashbacksRaw = db.prepare(`
      SELECT 
        id,
        user_id,
        COALESCE(user_name, '') as voided_by,
        user_role,
        action as void_type,
        COALESCE(metadata_json, '') as metadata_json,
        COALESCE(details, '') as void_reason,
        created_at as voided_at
      FROM audit_logs
      WHERE action = 'VOID_CASHBACK_PAYOUT'
      ORDER BY created_at DESC
    `).all() as any[];

    const cashbacks = cashbacksRaw.map((c) => {
      let invoiceNo = "-";
      let nominal = 0;
      try {
        if (c.metadata_json) {
          const m = JSON.parse(c.metadata_json);
          invoiceNo = m.invoiceNum || m.invoiceNo || m.orderNo || `INV-${m.invoiceId || ""}`;
          nominal = Number(m.nominal || 0);
        }
      } catch {
        // fallback
      }
      return {
        ...c,
        invoice_no: invoiceNo,
        nominal,
      };
    });

    return { payments, cashbacks };
  }
}

export const financeService = new FinanceService();
