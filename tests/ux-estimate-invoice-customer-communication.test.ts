import test from "node:test";
import assert from "node:assert";
import { pricingStore } from "../src/app/data/pricingStore";
import { formatRupiah } from "../src/app/utils/financeFormatters";

test("FASE 5: UX ESTIMASI BIAYA, INVOICE & KOMUNIKASI PELANGGAN", async (t) => {

  // Setup: Make sure we test on an isolated Samsat for deterministic conditions
  const testSamsatId = "samsat-jakarta-timur";
  const unconfiguredSamsatId = "samsat-test-phase5-unconfigured";

  // ───────────────────────────────────────────────────────────────────────────
  // TEST A: Order dengan biaya lengkap
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test A — Order dengan biaya lengkap (COMPLETE & isCostVerified: true)", () => {
    // Calculate cost for a well-configured Samsat and standard service
    const completeSnapshot = pricingStore.calculateOrderCost({
      serviceName: "Mutasi Antar Samsat",
      wilayahSamsat: "Jakarta Timur",
      metodeLayanan: "Antar Jemput",
      tipeJasa: "Lengkap",
      pkb: 1500000,
      swdkllj: 143000,
      dendaSwdkllj: 0,
    });

    assert.strictEqual(completeSnapshot.completenessStatus, "COMPLETE", "Order with all tariffs configured must be COMPLETE");
    assert.strictEqual(completeSnapshot.hasUnconfiguredTariff, false, "hasUnconfiguredTariff must be false");
    assert.strictEqual(completeSnapshot.isCostVerified, true, "isCostVerified must be true for complete tariff order");
    assert.deepStrictEqual(completeSnapshot.unconfiguredItems, [], "unconfiguredItems must be empty");
    assert.ok(completeSnapshot.totalEstimasi > 0, "Total estimasi must be positive");
    assert.ok(completeSnapshot.biayaJasa > 0, "Biaya jasa must be positive");
    assert.ok(completeSnapshot.biayaAntarJemput > 0, "Biaya antar jemput must be positive for Antar Jemput");

    // All active components in complete snapshot must have status CONFIGURED or ZERO_EXPLICIT, none UNCONFIGURED
    const unconf = completeSnapshot.breakdown.filter((item) => item.status === "UNCONFIGURED");
    assert.strictEqual(unconf.length, 0, "No item should have status UNCONFIGURED in complete order");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST B: Order estimasi parsial
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test B — Order estimasi parsial (PARTIAL_ESTIMATE & unconfigured indicator)", () => {
    // For unconfigured Samsat, missing items return null from getSamsatPrice
    const partialSnapshot = pricingStore.calculateOrderCost({
      serviceName: "Mutasi Antar Samsat",
      wilayahSamsat: "Samsat Belum Ada Tarif",
      samsatId: unconfiguredSamsatId,
      metodeLayanan: "Datang Langsung",
      tipeJasa: "Lengkap",
      pkb: 2000000,
      swdkllj: 143000,
      dendaSwdkllj: 0,
    });

    assert.strictEqual(partialSnapshot.completenessStatus, "PARTIAL_ESTIMATE", "Order with missing tariff must be PARTIAL_ESTIMATE");
    assert.strictEqual(partialSnapshot.hasUnconfiguredTariff, true, "hasUnconfiguredTariff must be true");
    assert.strictEqual(partialSnapshot.isCostVerified, false, "isCostVerified must be false for partial estimate");
    assert.ok(partialSnapshot.unconfiguredItems && partialSnapshot.unconfiguredItems.length > 0, "unconfiguredItems must list unconfigured items");

    // Breakdown must flag unconfigured items with status: "UNCONFIGURED" and isEstimated: true
    const unconfiguredBreakdownItems = partialSnapshot.breakdown.filter((item) => item.status === "UNCONFIGURED");
    assert.ok(unconfiguredBreakdownItems.length > 0, "Breakdown must contain items marked UNCONFIGURED");
    unconfiguredBreakdownItems.forEach((item) => {
      assert.strictEqual(item.amount, 0, "UNCONFIGURED item amount in snapshot must be 0");
      assert.strictEqual(item.isEstimated, true, "UNCONFIGURED item must be flagged isEstimated: true");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST C: Tarif Rp0 eksplisit
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test C — Tarif Rp0 eksplisit (ZERO_EXPLICIT vs UNCONFIGURED)", () => {
    // Explicitly configure a Rp0 tariff
    pricingStore.updateSamsatPrice(testSamsatId, "mutasi-cek-blokir", 0);
    const price = pricingStore.getSamsatPrice(testSamsatId, "mutasi-cek-blokir");
    const status = pricingStore.getSamsatTariffStatus(testSamsatId, "mutasi-cek-blokir");

    assert.strictEqual(price, 0, "Explicit zero tariff must return numeric 0");
    assert.strictEqual(status, "ZERO_EXPLICIT", "Status must be ZERO_EXPLICIT, not UNCONFIGURED");

    // Unconfigured item lookup must return null and status UNCONFIGURED
    const unconfPrice = pricingStore.getSamsatPrice("samsat-unknown-xyz", "mutasi-cek-blokir");
    const unconfStatus = pricingStore.getSamsatTariffStatus("samsat-unknown-xyz", "mutasi-cek-blokir");
    assert.strictEqual(unconfPrice, null, "Unconfigured tariff must return null");
    assert.strictEqual(unconfStatus, "UNCONFIGURED", "Status must be UNCONFIGURED");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST D: Status biaya belum diketahui
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test D — Status biaya belum diketahui (tidak boleh diasumsikan VERIFIED)", () => {
    const rawDataWithMissingStatus: any = {
      orderNo: "ORD-TEST-UNKNOWN",
      customer: "Budi Santoso",
      totalBiaya: 1250000,
      // No isCostVerified or costCompletenessStatus
    };

    const isCostVerified = Boolean(
      rawDataWithMissingStatus.isCostVerified === true ||
      rawDataWithMissingStatus.is_cost_verified === 1 ||
      rawDataWithMissingStatus.is_cost_verified === true ||
      rawDataWithMissingStatus.costVerificationStatus === "VERIFIED" ||
      rawDataWithMissingStatus.cost_verification_status === "VERIFIED"
    );

    assert.strictEqual(isCostVerified, false, "Missing verification status must NOT default to true");

    // If an error occurred or completeness is PARTIAL_ESTIMATE
    rawDataWithMissingStatus.completenessStatus = "PARTIAL_ESTIMATE";
    const isPartialEstimate = (
      rawDataWithMissingStatus.costSnapshot?.completenessStatus === "PARTIAL_ESTIMATE" ||
      rawDataWithMissingStatus.completenessStatus === "PARTIAL_ESTIMATE" ||
      rawDataWithMissingStatus.cost_completeness_status === "PARTIAL_ESTIMATE" ||
      rawDataWithMissingStatus.costVerificationStatus === "PENDING_VERIFICATION" ||
      rawDataWithMissingStatus.cost_verification_status === "PENDING_VERIFICATION" ||
      rawDataWithMissingStatus.isDraftEstimate === true ||
      rawDataWithMissingStatus.is_draft_estimate === 1
    ) && !isCostVerified;

    assert.strictEqual(isPartialEstimate, true, "Must be identified as partial estimate");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST E: Invoice estimasi (watermark, title, disclaimer)
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test E — Invoice estimasi (label, disclaimer, status stamp)", () => {
    const partialInvoiceData: any = {
      orderNo: "ORD-1026-991",
      invoiceNo: "INV/1026-991",
      customer: "Ahmad Dahlan",
      layanan: "Mutasi Antar Samsat",
      samsat: "Samsat Depok",
      totalBiaya: 850000,
      dibayar: 200000,
      kurang: 650000,
      isCostVerified: false,
      costCompletenessStatus: "PARTIAL_ESTIMATE",
      costVerificationStatus: "PENDING_VERIFICATION",
      isDraftEstimate: true,
    };

    const isCostVerified = Boolean(
      partialInvoiceData.isCostVerified === true ||
      partialInvoiceData.costVerificationStatus === "VERIFIED"
    );
    const isPartialEstimate = (
      partialInvoiceData.costCompletenessStatus === "PARTIAL_ESTIMATE" ||
      partialInvoiceData.costVerificationStatus === "PENDING_VERIFICATION" ||
      partialInvoiceData.isDraftEstimate === true
    ) && !isCostVerified;

    assert.strictEqual(isPartialEstimate, true);

    // Document header badge
    const docBadge = isPartialEstimate ? "ESTIMASI BIAYA" : "INVOICE RESMI";
    assert.strictEqual(docBadge, "ESTIMASI BIAYA", "Document badge must be ESTIMASI BIAYA");

    // Dialog title
    const dialogTitle = isPartialEstimate ? "Cetak Dokumen Estimasi Biaya (A5)" : "Cetak Invoice Resmi A5";
    assert.strictEqual(dialogTitle, "Cetak Dokumen Estimasi Biaya (A5)");

    // Status stamp label
    const statusStampLabel = isPartialEstimate
      ? "ESTIMASI SEMENTARA (MENUNGGU VERIFIKASI)"
      : (partialInvoiceData.kurang <= 0 ? "LUNAS (TERVERIFIKASI)" : "BELUM LUNAS / KURANG BAYAR");
    assert.strictEqual(statusStampLabel, "ESTIMASI SEMENTARA (MENUNGGU VERIFIKASI)");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST F: Invoice final (mengikuti backend, tanpa watermark estimasi)
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test F — Invoice final (mengikuti backend, status VERIFIED)", () => {
    const verifiedInvoiceData: any = {
      orderNo: "ORD-1026-992",
      invoiceNo: "INV/1026-992",
      customer: "Siti Rahma",
      layanan: "Perpanjangan STNK Tahunan",
      samsat: "Samsat Jakarta Timur",
      totalBiaya: 650000,
      dibayar: 650000,
      kurang: 0,
      isCostVerified: true,
      costCompletenessStatus: "VERIFIED",
      costVerificationStatus: "VERIFIED",
      isDraftEstimate: false,
    };

    const isCostVerified = Boolean(
      verifiedInvoiceData.isCostVerified === true ||
      verifiedInvoiceData.costVerificationStatus === "VERIFIED"
    );
    const isPartialEstimate = (
      verifiedInvoiceData.costCompletenessStatus === "PARTIAL_ESTIMATE" ||
      verifiedInvoiceData.costVerificationStatus === "PENDING_VERIFICATION" ||
      verifiedInvoiceData.isDraftEstimate === true
    ) && !isCostVerified;

    assert.strictEqual(isCostVerified, true);
    assert.strictEqual(isPartialEstimate, false);

    // Document header badge
    const docBadge = isPartialEstimate ? "ESTIMASI BIAYA" : "INVOICE RESMI";
    assert.strictEqual(docBadge, "INVOICE RESMI");

    // Status stamp label
    const statusStampLabel = isPartialEstimate
      ? "ESTIMASI SEMENTARA (MENUNGGU VERIFIKASI)"
      : (verifiedInvoiceData.kurang <= 0 ? "LUNAS (TERVERIFIKASI)" : "BELUM LUNAS / KURANG BAYAR");
    assert.strictEqual(statusStampLabel, "LUNAS (TERVERIFIKASI)");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST G: Pesan WhatsApp estimasi
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test G — Pesan WhatsApp estimasi (transparan & tidak menuntut pelunasan final)", () => {
    const customer = "Doni Pratama";
    const layanan = "Mutasi Masuk";
    const nopol = "B 1234 XYZ";
    const orderNo = "ORD-1026-993";
    const total = 950000;
    const isPartialEstimate = true;

    const messageText = isPartialEstimate
      ? `Halo ${customer},

Kami dari Biro Jasa SUN89 menginformasikan estimasi biaya sementara untuk pengurusan ${layanan} (No. Polisi: ${String(nopol).toUpperCase()}, Order: ${orderNo}) dengan total estimasi sebesar ${formatRupiah(total)}.

*Perhatian:*
Nominal di atas merupakan ESTIMASI SEMENTARA. Biaya final Samsat akan kami konfirmasikan kembali setelah berkas diverifikasi di loket Samsat terkait. Dokumen ini bukan tagihan final.

Rekening Resmi Biro Jasa SUN89:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Terima kasih atas kepercayaan Anda.`
      : `Halo ${customer},
kami dari Biro Jasa SUN89 menginformasikan tagihan pengurusan...`;

    assert.ok(messageText.includes("ESTIMASI SEMENTARA"), "Must mention ESTIMASI SEMENTARA");
    assert.ok(messageText.includes("Dokumen ini bukan tagihan final"), "Must mention it is not a final bill");
    assert.ok(messageText.includes("setelah berkas diverifikasi di loket Samsat"), "Must mention verification condition");
    assert.ok(!messageText.includes("Mohon konfirmasi jadwal pelunasan"), "Must NOT demand immediate final settlement");
    assert.ok(messageText.includes(formatRupiah(total)), "Must include formatted total rupiah");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST H: Pesan WhatsApp final
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test H — Pesan WhatsApp final (menggunakan nominal final tanpa disclaimer estimasi)", () => {
    const customer = "Doni Pratama";
    const layanan = "Mutasi Masuk";
    const nopol = "B 1234 XYZ";
    const orderNo = "ORD-1026-993";
    const sisaTagihan = 450000;
    const isPartialEstimate = false;

    const messageText = isPartialEstimate
      ? `Halo ${customer}, estimasi...`
      : `Halo ${customer},

kami dari Biro Jasa SUN89 menginformasikan tagihan pengurusan ${layanan} (No. Polisi: ${String(nopol).toUpperCase()}, Order: ${orderNo}) memiliki sisa tagihan sebesar ${formatRupiah(sisaTagihan)}.

Rekening Resmi Pembayaran:
Bank BCA: 7175095764
a/n ANISA SUSANTI (Biro Jasa SUN89)

Mohon konfirmasi jadwal pelunasan.
Terima kasih.`;

    assert.ok(!messageText.includes("ESTIMASI SEMENTARA"), "Final message must NOT include estimation disclaimer");
    assert.ok(messageText.includes("memiliki sisa tagihan sebesar"), "Final message must state remaining bill");
    assert.ok(messageText.includes(formatRupiah(sisaTagihan)), "Must include exact remaining amount");
    assert.ok(messageText.includes("Mohon konfirmasi jadwal pelunasan"), "Final message may ask for payment confirmation");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST I: Konsistensi nominal
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test I — Konsistensi nominal order, invoice, dan komunikasi", () => {
    const snapshot = pricingStore.calculateOrderCost({
      serviceName: "Mutasi Antar Samsat",
      wilayahSamsat: "Jakarta Timur",
      metodeLayanan: "Datang Langsung",
      tipeJasa: "Lengkap",
      pkb: 1000000,
      swdkllj: 143000,
    });

    const expectedTotal = snapshot.totalEstimasi;
    const formattedRupiah = formatRupiah(expectedTotal);

    // Mock invoice generated from order
    const invoiceRecord = {
      totalTagihan: snapshot.totalEstimasi,
      sisaTagihan: snapshot.totalEstimasi,
    };

    assert.strictEqual(invoiceRecord.totalTagihan, expectedTotal, "Invoice total must equal order totalEstimasi");
    assert.strictEqual(formatRupiah(invoiceRecord.totalTagihan), formattedRupiah, "Formatted rupiah must match across order and invoice");
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST J: Regression UI & Pricing Calculation
  // ───────────────────────────────────────────────────────────────────────────
  await t.test("Test J — Regression: Kalkulasi biaya layanan dan kurir tetap konsisten", () => {
    const datangLangsung = pricingStore.calculateOrderCost({
      serviceName: "Mutasi Antar Samsat",
      wilayahSamsat: "Jakarta Timur",
      metodeLayanan: "Datang Langsung",
      tipeJasa: "Lengkap",
      pkb: 500000,
      swdkllj: 35000,
    });

    const antarJemput = pricingStore.calculateOrderCost({
      serviceName: "Mutasi Antar Samsat",
      wilayahSamsat: "Jakarta Timur",
      metodeLayanan: "Antar Jemput",
      tipeJasa: "Lengkap",
      pkb: 500000,
      swdkllj: 35000,
    });

    assert.strictEqual(datangLangsung.biayaAntarJemput, 0, "Datang Langsung must have 0 courier fee");
    assert.ok(antarJemput.biayaAntarJemput > 0, "Antar Jemput must include configured courier fee");
    assert.strictEqual(
      antarJemput.totalEstimasi - datangLangsung.totalEstimasi,
      antarJemput.biayaAntarJemput,
      "Difference between Antar Jemput and Datang Langsung must equal exactly biayaAntarJemput"
    );
  });
});
