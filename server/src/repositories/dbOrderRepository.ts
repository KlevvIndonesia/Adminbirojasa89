/**
 * SQLite Order Repository
 * Admin SUN89 — Biro Jasa Management System
 */

import { db, runInTransaction } from "../database/db";
import { OperationalOrder, StageName, STAGES } from "../../../src/domain/order/types";

/**
 * Evaluates whether an order represents a partial estimate or complete pricing.
 * Invariant: An order with unconfigured tariffs or PARTIAL_ESTIMATE cannot be verified
 * unless explicit legitimate verification metadata is present.
 */
export function evaluateOrderCostCompleteness(order: any): {
  isPartialEstimate: boolean;
  costCompletenessStatus: "COMPLETE" | "PARTIAL_ESTIMATE" | "VERIFIED";
  isCostVerified: boolean;
} {
  if (!order) {
    return { isPartialEstimate: false, costCompletenessStatus: "COMPLETE", isCostVerified: true };
  }

  // 1. Check if order was already verified through official verification process
  const hasVerifiedStatus = order.costCompletenessStatus === "VERIFIED" || order.cost_completeness_status === "VERIFIED";
  const hasVerifier = Boolean(order.costVerifiedBy || order.cost_verified_by);

  if (hasVerifiedStatus && hasVerifier) {
    return {
      isPartialEstimate: false,
      costCompletenessStatus: "VERIFIED",
      isCostVerified: true,
    };
  }

  // 2. Evaluate if snapshot or explicit status indicates PARTIAL_ESTIMATE or unconfigured tariffs
  const rawStatus = order.costCompletenessStatus || order.cost_completeness_status || order.completenessStatus;
  const snapshot = order.costSnapshot || order.cost_snapshot;

  let isPartial = rawStatus === "PARTIAL_ESTIMATE";

  if (snapshot && typeof snapshot === "object") {
    if (snapshot.completenessStatus === "PARTIAL_ESTIMATE") {
      isPartial = true;
    }
    if (snapshot.hasUnconfiguredTariff === true) {
      isPartial = true;
    }
    if (Array.isArray(snapshot.unconfiguredItems) && snapshot.unconfiguredItems.length > 0) {
      isPartial = true;
    }
    if (Array.isArray(snapshot.breakdown)) {
      if (snapshot.breakdown.some((b: any) => b && (b.status === "UNCONFIGURED" || b.isConfigured === false))) {
        isPartial = true;
      }
    }
  }

  if (isPartial) {
    return {
      isPartialEstimate: true,
      costCompletenessStatus: "PARTIAL_ESTIMATE",
      isCostVerified: false,
    };
  }

  // 3. Complete order (all tariffs configured and valid)
  return {
    isPartialEstimate: false,
    costCompletenessStatus: "COMPLETE",
    isCostVerified: true,
  };
}

export class DbOrderRepository {
  private mapRowToOrder(row: any): OperationalOrder {
    let parsed: any = {};
    if (row.data_json) {
      try {
        parsed = JSON.parse(row.data_json);
      } catch (err) {
        console.warn(`[DbOrderRepository] Gagal parse data_json pada order ${row.order_no}:`, err);
      }
    }

    // 1. Kolom SQL fisik adalah sumber kanonis utama (Single Source of Truth)
    const orderNo = String(row.order_no || parsed.orderNo || "");
    const customer = row.customer !== null && row.customer !== undefined ? String(row.customer) : String(parsed.customer || "");
    const nomorHP = row.nomor_hp !== null && row.nomor_hp !== undefined ? String(row.nomor_hp) : String(parsed.nomorHP || parsed.nomor_hp || "");
    const layanan = row.layanan !== null && row.layanan !== undefined ? String(row.layanan) : String(parsed.layanan || "");
    const nopol = row.nopol !== null && row.nopol !== undefined ? String(row.nopol) : String(parsed.nopol || "");
    const currentStep = row.current_step !== null && row.current_step !== undefined ? Number(row.current_step) : Number(parsed.currentStep || 1);
    const currentStageName = row.current_stage_name !== null && row.current_stage_name !== undefined ? String(row.current_stage_name) : String(parsed.currentStageName || "Verifikasi");
    const paymentStatus = row.payment_status !== null && row.payment_status !== undefined ? String(row.payment_status) : String(parsed.payment?.statusPembayaran || parsed.payment_status || "Belum Lunas");
    const totalBiaya = row.total_biaya !== null && row.total_biaya !== undefined ? Number(row.total_biaya) : Number(parsed.payment?.totalBiaya ?? parsed.totalBiaya ?? 0);
    const biayaJasa = row.biaya_jasa !== null && row.biaya_jasa !== undefined ? Number(row.biaya_jasa) : Number(parsed.biayaJasa ?? 0);
    const biayaAntarJemput = row.biaya_antar_jemput !== null && row.biaya_antar_jemput !== undefined ? Number(row.biaya_antar_jemput) : Number(parsed.biayaAntarJemput ?? 0);
    const namaPenerimaKeluar = row.nama_penerima_keluar !== null && row.nama_penerima_keluar !== undefined ? String(row.nama_penerima_keluar) : (parsed.namaPenerimaKeluar || parsed.namaPemilikRekeningKeluar || "");
    const bankUangKeluar = row.bank_uang_keluar !== null && row.bank_uang_keluar !== undefined ? String(row.bank_uang_keluar) : (parsed.bankUangKeluar || "");
    const metodePembayaranKeluar = row.metode_pembayaran_keluar !== null && row.metode_pembayaran_keluar !== undefined ? String(row.metode_pembayaran_keluar) : (parsed.metodePembayaranKeluar || "");
    const alasanPending = row.alasan_pending !== null && row.alasan_pending !== undefined ? String(row.alasan_pending) : (parsed.alasan_pending || parsed.alasanPending || parsed.alasan || "");
    const serviceId = row.service_id !== null && row.service_id !== undefined ? String(row.service_id) : (parsed.serviceId || parsed.service_id || undefined);
    const tanggalMasukBerkas = row.tanggal_masuk_berkas !== null && row.tanggal_masuk_berkas !== undefined ? String(row.tanggal_masuk_berkas) : (parsed.tanggalMasukBerkas || parsed.tanggal_masuk_berkas || undefined);
    const samsatAsal = row.samsat_asal !== null && row.samsat_asal !== undefined ? String(row.samsat_asal) : (parsed.wilayahSamsatAsal || parsed.samsatAsal || parsed.samsat || "Jakarta Timur");
    const samsatTujuan = row.samsat_tujuan !== null && row.samsat_tujuan !== undefined ? String(row.samsat_tujuan) : (parsed.wilayahSamsatTujuan || parsed.samsatTujuan || "-");
    const createdAt = row.created_at ? String(row.created_at) : (parsed.createdAt || new Date().toISOString());
    const updatedAt = row.updated_at ? String(row.updated_at) : (parsed.updatedAt || new Date().toISOString());
    const costEval = evaluateOrderCostCompleteness({
      ...parsed,
      is_cost_verified: row.is_cost_verified,
      cost_completeness_status: row.cost_completeness_status,
      cost_verified_at: row.cost_verified_at,
      cost_verified_by: row.cost_verified_by,
    });

    let isCostVerified: boolean;
    let costCompletenessStatus: string;
    let costVerifiedAt = row.cost_verified_at || parsed.costVerifiedAt || (parsed as any).cost_verified_at || undefined;
    let costVerifiedBy = row.cost_verified_by || parsed.costVerifiedBy || (parsed as any).cost_verified_by || undefined;

    if (row.is_cost_verified !== null && row.is_cost_verified !== undefined) {
      isCostVerified = Boolean(row.is_cost_verified);
      costCompletenessStatus = row.cost_completeness_status ? String(row.cost_completeness_status) : (isCostVerified ? "COMPLETE" : "PARTIAL_ESTIMATE");
      // Safety invariant: if completeness status is PARTIAL_ESTIMATE, it cannot be verified unless explicit verification process completed
      if (costCompletenessStatus === "PARTIAL_ESTIMATE" && isCostVerified) {
        isCostVerified = false;
      }
    } else {
      // Legacy rows where SQLite columns are null: evaluated dynamically from costSnapshot
      isCostVerified = costEval.isCostVerified;
      costCompletenessStatus = costEval.costCompletenessStatus;
    }

    // 2. Evaluasi status arsip dan tahapan efektif
    let isArchived: boolean | number = false;
    let effectiveStageName = currentStageName;
    let effectiveStep = currentStep;

    if (row.is_archived === 1) {
      isArchived = true;
      if (!parsed.isCancelled && currentStageName !== "Dibatalkan" && parsed.status !== "Dibatalkan") {
        effectiveStageName = "Selesai (Arsip)";
        effectiveStep = 8;
      }
    } else if (row.is_archived === 2) {
      isArchived = 2;
    } else {
      isArchived = false;
      // Normalisasi kanonis: jika stage bernilai "Selesai" atau step >= 8 pada order aktif, mapping ke "Dokumen Telah Diterima"
      if (effectiveStageName === "Selesai" || (effectiveStep >= 8 && effectiveStageName !== "Dibatalkan")) {
        effectiveStageName = "Dokumen Telah Diterima";
      }
    }

    // 3. Rekonsiliasi sub-objek payment
    const existingPayment = parsed.payment || {};
    const payment = {
      ...existingPayment,
      totalBiaya,
      statusPembayaran: paymentStatus as any,
    };

    return {
      ...parsed, // Pertahankan seluruh atribut dinamis dari JSON (alamat, timeline, dokumen, samsat, checklist, approver)
      orderNo,
      customer,
      nomorHP,
      layanan,
      nopol,
      currentStep: effectiveStep,
      currentStageName: effectiveStageName,
      isArchived,
      biayaJasa,
      biayaAntarJemput,
      namaPenerimaKeluar: namaPenerimaKeluar || undefined,
      bankUangKeluar: bankUangKeluar || undefined,
      metodePembayaranKeluar: metodePembayaranKeluar || undefined,
      alasan_pending: alasanPending || undefined,
      alasanPending: alasanPending || undefined,
      serviceId,
      service_id: serviceId,
      tanggalMasukBerkas,
      tanggal_masuk_berkas: tanggalMasukBerkas,
      wilayahSamsatAsal: samsatAsal,
      samsat_asal: samsatAsal,
      wilayahSamsatTujuan: samsatTujuan,
      samsat_tujuan: samsatTujuan,
      payment,
      createdAt,
      updatedAt,
      isCostVerified,
      costCompletenessStatus,
      cost_completeness_status: costCompletenessStatus,
      is_cost_verified: isCostVerified ? 1 : 0,
      costVerifiedAt,
      costVerifiedBy,
      // Alias reporting kompatibilitas
      totalBiaya,
      total_biaya: totalBiaya,
      paymentStatus,
      payment_status: paymentStatus,
      biaya_jasa: biayaJasa,
      biaya_antar_jemput: biayaAntarJemput,
    };
  }

  public getAllFlat(archived = false): OperationalOrder[] {
    const stmt = db.prepare("SELECT * FROM orders WHERE is_archived = ? ORDER BY created_at DESC");
    const rows = stmt.all(archived ? 1 : 0) as any[];
    return rows.map((r) => this.mapRowToOrder(r));
  }

  public getActiveOrders(): Record<StageName, OperationalOrder[]> {
    const result: Record<StageName, OperationalOrder[]> = {
      "Verifikasi": [],
      "Penjadwalan": [],
      "Verifikasi Dokumen": [],
      "Proses Samsat": [],
      "Verifikasi Ulang": [],
      "Supervisi": [],
      "Pengantaran": [],
      "Dokumen Telah Diterima": [],
    };

    const orders = this.getAllFlat(false);
    for (const order of orders) {
      let stage = ((order as any).stageBeforeCancel || order.currentStageName) as StageName;
      if ((stage as string) === "Selesai" || order.currentStep >= 8) {
        stage = "Dokumen Telah Diterima";
      }
      if (result[stage]) {
        result[stage].push(order);
      }
    }
    return result;
  }

  public getArchivedOrders(): OperationalOrder[] {
    return this.getAllFlat(true);
  }

  public getByOrderNo(orderNo: string): OperationalOrder | undefined {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    const stmt = db.prepare("SELECT * FROM orders WHERE UPPER(order_no) = ? OR order_no = ?");
    const row = stmt.get(cleanNo, orderNo) as any;
    if (!row) return undefined;
    return this.mapRowToOrder(row);
  }

  public getByStage(stage: StageName): OperationalOrder[] {
    const stmt = db.prepare("SELECT * FROM orders WHERE current_stage_name = ? AND is_archived = 0 ORDER BY created_at DESC");
    const rows = stmt.all(stage) as any[];
    return rows.map((r) => this.mapRowToOrder(r));
  }

  public saveOrder(order: OperationalOrder): void {
    if (this.getByOrderNo(order.orderNo)) {
      this.updateOrder(order.orderNo, order);
      return;
    }

    const biayaJasa = Number((order as any).biayaJasa || 0);
    const biayaAntarJemput = Number((order as any).biayaAntarJemput || 0);
    const namaPenerimaKeluar = (order as any).namaPenerimaKeluar || (order as any).namaPemilikRekeningKeluar || null;
    const bankUangKeluar = (order as any).bankUangKeluar || null;
    const metodePembayaranKeluar = (order as any).metodePembayaranKeluar || null;
    const alasanPending = (order as any).alasan_pending || (order as any).alasanPending || (order as any).alasan || null;
    const nomorHP = order.nomorHP || (order as any).nomorHp || (order as any).nomor_hp || "-";
    const serviceId = (order as any).serviceId || (order as any).service_id || null;
    const tanggalMasukBerkas = (order as any).tanggalMasukBerkas || (order as any).tanggal_masuk_berkas || null;
    const samsatAsal = (order as any).wilayahSamsatAsal || (order as any).samsatAsal || (order as any).samsat_asal || (order as any).samsat || null;
    const samsatTujuan = (order as any).wilayahSamsatTujuan || (order as any).samsatTujuan || (order as any).samsat_tujuan || "-";
    const currentStep = Number(order.currentStep || 1);
    const isArchived = order.isArchived === true ? 1 : (order.isArchived === 2 ? 2 : 0);
    let currentStageName = String(order.currentStageName || "Verifikasi");
    if (currentStageName === "Selesai" || (currentStep >= 8 && currentStageName !== "Dibatalkan" && isArchived === 0)) {
      currentStageName = "Dokumen Telah Diterima";
    }
    const paymentStatus = String(order.payment?.statusPembayaran || "Belum Lunas");
    const totalBiaya = Number(order.payment?.totalBiaya ?? order.totalEstimasi ?? order.biayaJasa ?? 0);
    const createdAt = order.createdAt ? String(order.createdAt) : new Date().toISOString().split("T")[0];

    const costEval = evaluateOrderCostCompleteness(order);
    const isCostVerifiedVal = costEval.isCostVerified ? 1 : 0;
    const costCompletenessVal = costEval.costCompletenessStatus;
    const costVerifiedAtVal = costEval.isCostVerified ? (order.costVerifiedAt || (order as any).cost_verified_at || null) : null;
    const costVerifiedByVal = costEval.isCostVerified ? (order.costVerifiedBy || (order as any).cost_verified_by || null) : null;

    const synchronizedOrder: OperationalOrder = {
      ...order,
      orderNo: order.orderNo,
      customer: order.customer,
      nomorHP,
      layanan: order.layanan,
      nopol: order.nopol,
      currentStep,
      currentStageName,
      biayaJasa,
      biayaAntarJemput,
      namaPenerimaKeluar: namaPenerimaKeluar || undefined,
      bankUangKeluar: bankUangKeluar || undefined,
      metodePembayaranKeluar: metodePembayaranKeluar || undefined,
      alasan_pending: alasanPending || undefined,
      alasanPending: alasanPending || undefined,
      serviceId: serviceId || undefined,
      service_id: serviceId || undefined,
      tanggalMasukBerkas: tanggalMasukBerkas || undefined,
      tanggal_masuk_berkas: tanggalMasukBerkas || undefined,
      wilayahSamsatAsal: samsatAsal || "Jakarta Timur",
      samsat_asal: samsatAsal || undefined,
      wilayahSamsatTujuan: samsatTujuan,
      samsat_tujuan: samsatTujuan,
      createdAt,
      isCostVerified: costEval.isCostVerified,
      costCompletenessStatus: costEval.costCompletenessStatus,
      costVerifiedAt: costVerifiedAtVal || undefined,
      costVerifiedBy: costVerifiedByVal || undefined,
      payment: {
        ...(order.payment || {}),
        totalBiaya,
        statusPembayaran: paymentStatus as any,
      } as any,
    };

    // Cost completeness and verification values evaluated by evaluateOrderCostCompleteness above

    const stmt = db.prepare(`
      INSERT INTO orders (
        order_no, customer, nomor_hp, layanan, nopol, current_step,
        current_stage_name, payment_status, total_biaya, is_archived,
        biaya_jasa, biaya_antar_jemput, nama_penerima_keluar, bank_uang_keluar, metode_pembayaran_keluar,
        alasan_pending, data_json, created_at, updated_at,
        service_id, tanggal_masuk_berkas, samsat_asal, samsat_tujuan,
        samsat_tujuan_id, is_cost_verified, cost_completeness_status, cost_verified_at, cost_verified_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `);

    stmt.run(
      order.orderNo,
      order.customer,
      nomorHP,
      order.layanan || "-",
      order.nopol || "-",
      currentStep,
      currentStageName,
      paymentStatus,
      totalBiaya,
      isArchived,
      biayaJasa,
      biayaAntarJemput,
      namaPenerimaKeluar,
      bankUangKeluar,
      metodePembayaranKeluar,
      alasanPending,
      JSON.stringify(synchronizedOrder),
      createdAt,
      serviceId,
      tanggalMasukBerkas,
      samsatAsal,
      samsatTujuan,
      isCostVerifiedVal,
      costCompletenessVal,
      costVerifiedAtVal,
      costVerifiedByVal
    );
  }

  public updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    const existing = this.getByOrderNo(orderNo);
    if (!existing) return false;

    // Resolve nilai kanonis dari updates atau existing
    const resolvedCustomer = updates.customer !== undefined ? String(updates.customer).trim() : existing.customer;
    const resolvedNomorHP = updates.nomorHP !== undefined
      ? String(updates.nomorHP).trim()
      : ((updates as any).nomor_hp !== undefined ? String((updates as any).nomor_hp).trim() : existing.nomorHP);
    const resolvedLayanan = updates.layanan !== undefined ? String(updates.layanan).trim() : existing.layanan;
    const resolvedNopol = updates.nopol !== undefined ? String(updates.nopol).trim() : existing.nopol;
    const resolvedStep = updates.currentStep !== undefined ? Number(updates.currentStep) : existing.currentStep;
    let resolvedStageName = updates.currentStageName !== undefined ? String(updates.currentStageName) : existing.currentStageName;
    if (resolvedStageName === "Selesai" || (resolvedStep >= 8 && resolvedStageName !== "Dibatalkan" && !existing.isArchived)) {
      resolvedStageName = "Dokumen Telah Diterima";
    }

    const resolvedPaymentStatus = updates.payment?.statusPembayaran !== undefined
      ? String(updates.payment.statusPembayaran)
      : ((updates as any).payment_status !== undefined
          ? String((updates as any).payment_status)
          : (existing.payment?.statusPembayaran || "Belum Lunas"));

    const resolvedTotalBiaya = updates.payment?.totalBiaya !== undefined
      ? Number(updates.payment.totalBiaya)
      : ((updates as any).total_biaya !== undefined
          ? Number((updates as any).total_biaya)
          : Number(existing.payment?.totalBiaya ?? 0));

    const resolvedBiayaJasa = (updates as any).biayaJasa !== undefined
      ? Number((updates as any).biayaJasa)
      : ((updates as any).biaya_jasa !== undefined
          ? Number((updates as any).biaya_jasa)
          : Number((existing as any).biayaJasa || 0));

    const resolvedBiayaAntarJemput = (updates as any).biayaAntarJemput !== undefined
      ? Number((updates as any).biayaAntarJemput)
      : ((updates as any).biaya_antar_jemput !== undefined
          ? Number((updates as any).biaya_antar_jemput)
          : Number((existing as any).biayaAntarJemput || 0));

    const resolvedNamaPenerimaKeluar = (updates as any).namaPenerimaKeluar !== undefined
      ? (updates as any).namaPenerimaKeluar
      : ((updates as any).namaPemilikRekeningKeluar !== undefined
          ? (updates as any).namaPemilikRekeningKeluar
          : ((existing as any).namaPenerimaKeluar || null));

    const resolvedBankUangKeluar = (updates as any).bankUangKeluar !== undefined
      ? (updates as any).bankUangKeluar
      : ((existing as any).bankUangKeluar || null);

    const resolvedMetodePembayaranKeluar = (updates as any).metodePembayaranKeluar !== undefined
      ? (updates as any).metodePembayaranKeluar
      : ((existing as any).metodePembayaranKeluar || null);

    const resolvedAlasanPending = (updates as any).alasan_pending !== undefined
      ? (updates as any).alasan_pending
      : ((updates as any).alasanPending !== undefined
          ? (updates as any).alasanPending
          : ((updates as any).alasan !== undefined
              ? (updates as any).alasan
              : ((existing as any).alasan_pending || (existing as any).alasanPending || (existing as any).alasan || null)));

    const resolvedServiceId = (updates as any).serviceId !== undefined
      ? (updates as any).serviceId
      : ((updates as any).service_id !== undefined ? (updates as any).service_id : ((existing as any).serviceId || (existing as any).service_id || null));

    const resolvedTanggalMasukBerkas = (updates as any).tanggalMasukBerkas !== undefined
      ? (updates as any).tanggalMasukBerkas
      : ((updates as any).tanggal_masuk_berkas !== undefined ? (updates as any).tanggal_masuk_berkas : ((existing as any).tanggalMasukBerkas || null));

    const resolvedSamsatAsal = (updates as any).wilayahSamsatAsal !== undefined
      ? (updates as any).wilayahSamsatAsal
      : ((updates as any).samsat_asal !== undefined ? (updates as any).samsat_asal : ((updates as any).samsatAsal || (existing as any).wilayahSamsatAsal || "Jakarta Timur"));

    const resolvedSamsatTujuan = (updates as any).wilayahSamsatTujuan !== undefined
      ? (updates as any).wilayahSamsatTujuan
      : ((updates as any).samsat_tujuan !== undefined ? (updates as any).samsat_tujuan : ((updates as any).samsatTujuan || (existing as any).wilayahSamsatTujuan || "-"));

    let resolvedIsCostVerified: number;
    let resolvedCostCompletenessStatus: string;
    let resolvedCostVerifiedAt: string | null;
    let resolvedCostVerifiedBy: string | null;

    if (existing.isCostVerified && (existing.costCompletenessStatus === "VERIFIED" || existing.costCompletenessStatus === "COMPLETE")) {
      // Verified or complete order: maintain verified state and metadata
      resolvedIsCostVerified = 1;
      resolvedCostCompletenessStatus = existing.costCompletenessStatus;
      resolvedCostVerifiedAt = (updates as any).costVerifiedAt || (updates as any).cost_verified_at || existing.costVerifiedAt || null;
      resolvedCostVerifiedBy = (updates as any).costVerifiedBy || (updates as any).cost_verified_by || existing.costVerifiedBy || null;
    } else {
      // Unverified order: only becomes verified if updates comes from verifyOrderCost (which sets status VERIFIED and verifier)
      if (
        ((updates as any).costCompletenessStatus === "VERIFIED" || (updates as any).cost_completeness_status === "VERIFIED") &&
        ((updates as any).costVerifiedBy || (updates as any).cost_verified_by)
      ) {
        resolvedIsCostVerified = 1;
        resolvedCostCompletenessStatus = "VERIFIED";
        resolvedCostVerifiedAt = (updates as any).costVerifiedAt || (updates as any).cost_verified_at || new Date().toISOString();
        resolvedCostVerifiedBy = (updates as any).costVerifiedBy || (updates as any).cost_verified_by;
      } else {
        // Remains unverified partial estimate
        resolvedIsCostVerified = 0;
        resolvedCostCompletenessStatus = "PARTIAL_ESTIMATE";
        resolvedCostVerifiedAt = null;
        resolvedCostVerifiedBy = null;
      }
    }

    const synchronizedMerged: OperationalOrder = {
      ...existing,
      ...updates,
      // Immutable Snapshot Guard (Patch D): Preserve captured snapshot
      serviceRequirementsSnapshot: existing.serviceRequirementsSnapshot,
      customer: resolvedCustomer,
      nomorHP: resolvedNomorHP,
      layanan: resolvedLayanan,
      nopol: resolvedNopol,
      currentStep: resolvedStep,
      currentStageName: resolvedStageName,
      biayaJasa: resolvedBiayaJasa,
      biayaAntarJemput: resolvedBiayaAntarJemput,
      namaPenerimaKeluar: resolvedNamaPenerimaKeluar || undefined,
      bankUangKeluar: resolvedBankUangKeluar || undefined,
      metodePembayaranKeluar: resolvedMetodePembayaranKeluar || undefined,
      alasan_pending: resolvedAlasanPending || undefined,
      alasanPending: resolvedAlasanPending || undefined,
      serviceId: resolvedServiceId || undefined,
      service_id: resolvedServiceId || undefined,
      tanggalMasukBerkas: resolvedTanggalMasukBerkas || undefined,
      tanggal_masuk_berkas: resolvedTanggalMasukBerkas || undefined,
      wilayahSamsatAsal: resolvedSamsatAsal,
      samsat_asal: resolvedSamsatAsal,
      wilayahSamsatTujuan: resolvedSamsatTujuan,
      samsat_tujuan: resolvedSamsatTujuan,
      isCostVerified: Boolean(resolvedIsCostVerified),
      costCompletenessStatus: resolvedCostCompletenessStatus,
      costVerifiedAt: resolvedCostVerifiedAt || undefined,
      costVerifiedBy: resolvedCostVerifiedBy || undefined,
      payment: {
        ...(existing.payment || {}),
        ...(updates.payment || {}),
        totalBiaya: resolvedTotalBiaya,
        statusPembayaran: resolvedPaymentStatus as any,
      } as any,
    };

    const stmt = db.prepare(`
      UPDATE orders SET
        customer = ?,
        nomor_hp = ?,
        layanan = ?,
        nopol = ?,
        current_step = ?,
        current_stage_name = ?,
        payment_status = ?,
        total_biaya = ?,
        biaya_jasa = ?,
        biaya_antar_jemput = ?,
        nama_penerima_keluar = ?,
        bank_uang_keluar = ?,
        metode_pembayaran_keluar = ?,
        alasan_pending = ?,
        data_json = ?,
        service_id = ?,
        tanggal_masuk_berkas = ?,
        samsat_asal = ?,
        samsat_tujuan = ?,
        is_cost_verified = ?,
        cost_completeness_status = ?,
        cost_verified_at = ?,
        cost_verified_by = ?,
        updated_at = datetime('now')
      WHERE order_no = ?
    `);

    const res = stmt.run(
      resolvedCustomer,
      resolvedNomorHP,
      resolvedLayanan,
      resolvedNopol,
      resolvedStep,
      resolvedStageName,
      resolvedPaymentStatus,
      resolvedTotalBiaya,
      resolvedBiayaJasa,
      resolvedBiayaAntarJemput,
      resolvedNamaPenerimaKeluar,
      resolvedBankUangKeluar,
      resolvedMetodePembayaranKeluar,
      resolvedAlasanPending,
      JSON.stringify(synchronizedMerged),
      resolvedServiceId,
      resolvedTanggalMasukBerkas,
      resolvedSamsatAsal,
      resolvedSamsatTujuan,
      resolvedIsCostVerified,
      resolvedCostCompletenessStatus,
      resolvedCostVerifiedAt,
      resolvedCostVerifiedBy,
      orderNo
    );

    return res.changes > 0;
  }

  /**
   * Records an explicit status transition in order_status_history.
   * Atomically called inside runInTransaction.
   */
  public recordStatusHistory(
    orderNo: string,
    stepSebelumnya: number,
    stepBaru: number,
    stageName: string,
    catatan: string | null = null,
    actorEmployeeId?: string | null
  ): void {
    const histStmt = db.prepare(`
      INSERT INTO order_status_history (
        order_no, step_sebelumnya, step_baru, stage_name, catatan, diubah_oleh_employee_id, waktu_transisi
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    histStmt.run(
      orderNo,
      stepSebelumnya,
      stepBaru,
      stageName,
      catatan,
      actorEmployeeId || null
    );
  }

  public getStatusHistoryByOrderNo(orderNo: string): Array<{
    id: number;
    order_no: string;
    step_sebelumnya: number;
    step_baru: number;
    stage_name: string;
    catatan: string | null;
    diubah_oleh_employee_id: string | null;
    waktu_transisi: string;
    actor_nama?: string | null;
    actor_jabatan?: string | null;
  }> {
    const stmt = db.prepare(`
      SELECT 
        osh.id,
        osh.order_no,
        osh.step_sebelumnya,
        osh.step_baru,
        osh.stage_name,
        osh.catatan,
        osh.diubah_oleh_employee_id,
        osh.waktu_transisi,
        e.nama_lengkap as actor_nama,
        e.jabatan as actor_jabatan
      FROM order_status_history osh
      LEFT JOIN employees e ON osh.diubah_oleh_employee_id = e.id
      WHERE UPPER(osh.order_no) = UPPER(?) OR osh.order_no = ?
      ORDER BY osh.id ASC
    `);
    return stmt.all(orderNo, orderNo) as any[];
  }

  public advanceOrder(
    orderNo: string, 
    targetStage: StageName, 
    updates: Partial<OperationalOrder> = {},
    actorEmployeeId?: string | null
  ): boolean {
    const existing = this.getByOrderNo(orderNo);
    if (!existing) return false;

    const stageIndex = (STAGES as readonly string[]).indexOf(targetStage);
    const newStep = stageIndex >= 0 ? stageIndex + 1 : existing.currentStep;

    const nowIso = new Date().toISOString();
    const eventDates: Partial<OperationalOrder> = {};
    if (newStep >= 3 && !existing.tanggalMasukBerkas && !updates.tanggalMasukBerkas) {
      eventDates.tanggalMasukBerkas = nowIso;
    }
    if (newStep >= 5 && !existing.tanggalProsesSamsat && !updates.tanggalProsesSamsat) {
      eventDates.tanggalProsesSamsat = nowIso;
    }
    if (updates.tanggalPengeluaranSamsat) {
      eventDates.tanggalPengeluaranSamsat = updates.tanggalPengeluaranSamsat;
    }

    const stageDefaults: Partial<OperationalOrder> = {};
    if (targetStage === "Proses Samsat" && !existing.samsatStatus && !updates.samsatStatus) {
      stageDefaults.samsatStatus = "Belum Terjadwal";
      stageDefaults.isSamsatScheduled = false;
    }

    const updated = this.updateOrder(orderNo, {
      ...updates,
      ...eventDates,
      ...stageDefaults,
      currentStageName: targetStage,
      currentStep: newStep,
    });

    if (updated) {
      this.recordStatusHistory(
        orderNo,
        existing.currentStep,
        newStep,
        targetStage,
        updates.catatanPenjadwalan || (updates as any).catatan || null,
        actorEmployeeId || null
      );
    }

    return updated;
  }

  public rollbackOrder(
    orderNo: string, 
    targetStage: StageName, 
    updates: Partial<OperationalOrder> = {},
    actorEmployeeId?: string | null
  ): boolean {
    const existing = this.getByOrderNo(orderNo);
    if (!existing) return false;

    const stageIndex = (STAGES as readonly string[]).indexOf(targetStage);
    const newStep = stageIndex >= 0 ? stageIndex + 1 : existing.currentStep;

    const updated = this.updateOrder(orderNo, {
      ...updates,
      currentStageName: targetStage,
      currentStep: newStep,
    });

    if (updated) {
      this.recordStatusHistory(
        orderNo,
        existing.currentStep,
        newStep,
        targetStage,
        (updates as any).catatanPenjadwalan || (updates as any).catatan || "Rollback stage",
        actorEmployeeId || null
      );
    }

    return updated;
  }

  public archiveOrder(orderNo: string): boolean {
    const existing = this.getByOrderNo(orderNo);
    if (!existing) return false;

    const isCancelled = existing.isCancelled || existing.currentStageName === "Dibatalkan";
    const synchronizedJson = {
      ...existing,
      isArchived: true,
      currentStageName: isCancelled ? "Dibatalkan" : "Selesai (Arsip)",
      currentStep: isCancelled ? existing.currentStep : 8,
    };

    const stmt = db.prepare("UPDATE orders SET is_archived = 1, data_json = ?, updated_at = datetime('now') WHERE order_no = ?");
    const res = stmt.run(JSON.stringify(synchronizedJson), orderNo);
    return res.changes > 0;
  }

  public deleteArchivedOrder(orderNo: string): boolean {
    const existing = this.getByOrderNo(orderNo);
    const synchronizedJson = existing ? JSON.stringify({ ...existing, isArchived: 2 }) : null;
    const stmt = synchronizedJson
      ? db.prepare("UPDATE orders SET is_archived = 2, data_json = ?, updated_at = datetime('now') WHERE order_no = ? AND is_archived = 1")
      : db.prepare("UPDATE orders SET is_archived = 2, updated_at = datetime('now') WHERE order_no = ? AND is_archived = 1");
    const res = synchronizedJson ? stmt.run(synchronizedJson, orderNo) : stmt.run(orderNo);
    return res.changes > 0;
  }

  public hardDeleteOrder(orderNo: string): boolean {
    const cleanNo = (orderNo || "").trim().toUpperCase();
    if (!cleanNo) return false;

    return runInTransaction(() => {
      // 1. Delete invoice payments referencing order_no or matching invoice_no of order
      try {
        db.prepare("DELETE FROM invoice_payments WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
        db.prepare(
          "DELETE FROM invoice_payments WHERE invoice_no IN (SELECT invoice_no FROM finance_invoices WHERE UPPER(order_no) = ? OR order_no = ?)"
        ).run(cleanNo, cleanNo);
      } catch (e) {
        console.warn("[DbOrderRepository] invoice_payments cleanup warning:", e);
      }

      // 2. Delete finance invoices
      try {
        db.prepare("DELETE FROM finance_invoices WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch (e) {
        console.warn("[DbOrderRepository] finance_invoices cleanup warning:", e);
      }

      // 3. Delete order documents
      try {
        db.prepare("DELETE FROM order_documents WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch (e) {
        console.warn("[DbOrderRepository] order_documents cleanup warning:", e);
      }

      // 4. Delete order status history & timeline
      try {
        db.prepare("DELETE FROM order_status_history WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch (e) {
        console.warn("[DbOrderRepository] order_status_history cleanup warning:", e);
      }
      try {
        db.prepare("DELETE FROM order_timeline_processes WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch (e) {
        console.warn("[DbOrderRepository] order_timeline_processes cleanup warning:", e);
      }

      // 5. Delete messenger tasks
      try {
        db.prepare("DELETE FROM order_messenger_tasks WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch {
        // ignore
      }

      // 6. Nullify or delete kas_kantor / pengeluaran references
      try {
        db.prepare("DELETE FROM pengeluaran WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch {
        // ignore
      }
      try {
        db.prepare("UPDATE kas_kantor SET order_no = NULL WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      } catch {
        // ignore
      }

      // 7. Finally delete from orders table
      const res = db.prepare("DELETE FROM orders WHERE UPPER(order_no) = ? OR order_no = ?").run(cleanNo, cleanNo);
      return res.changes > 0;
    });
  }

  public clearArchivedOrders(): number {
    const stmt = db.prepare("UPDATE orders SET is_archived = 2, updated_at = datetime('now') WHERE is_archived = 1");
    const res = stmt.run();
    return Number(res.changes);
  }
}

export const dbOrderRepository = new DbOrderRepository();
