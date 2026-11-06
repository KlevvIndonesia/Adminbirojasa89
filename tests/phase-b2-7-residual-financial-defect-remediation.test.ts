import "./setup-test-portal-shim";
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

import {
  calculateInvoiceProfitMetrics,
  validateDocumentFinancialData,
} from "../src/domain/finance/types";
import { financeStore } from "../src/app/data/financeStore";

test("Phase B2.7: Residual Financial Defect Remediation Test Suite", async (t) => {
  const { FinanceDetailPage } = await import("../src/app/components/FinanceDetailPage");

  const renderWithRouter = (ui: React.ReactElement) => {
    return renderToStaticMarkup(
      React.createElement(MemoryRouter, null, ui)
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP A: REVENUE RECOGNITION & DEFECT-UAT-02 REMEDIATION
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEFECT-UAT-02 / Case 1: Configured invoice with overpayment isolates customer overpayment from recognized revenue", () => {
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 1200000,
      totalTagihan: 1000000,
      biayaSamsat: 700000,
      biayaAntarJemput: 50000,
      cashback: 50000,
    });

    assert.strictEqual(metrics.recognizedRevenue, 1000000, "Recognized revenue must be capped at totalTagihan (Rp 1.000.000)");
    assert.strictEqual(metrics.grossServiceMargin, 300000, "Gross service margin = 1.000.000 - 700.000 = Rp 300.000");
    assert.strictEqual(metrics.netTransactionMargin, 200000, "Net transaction margin = 300.000 - 50.000 - 50.000 = Rp 200.000");
    assert.strictEqual(metrics.isGrossDeficit, false, "Margin is positive");
    assert.strictEqual(metrics.isNetDeficit, false, "Net margin is positive");
    assert.strictEqual(metrics.isConfigured, true, "Invoice is configured");
  });

  await t.test("DEFECT-UAT-02 / Case 2: Unconfigured invoice with payment MUST NOT recognize revenue or produce false positive gross margin", () => {
    // Reproduction of DEFECT-UAT-02:
    // Prior implementation returned recognizedRevenue = 500.000 and grossServiceMargin = 500.000
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 500000,
      totalTagihan: 0,
      biayaSamsat: undefined,
      isExplicitZero: false,
    });

    assert.strictEqual(metrics.recognizedRevenue, 0, "Recognized revenue must be Rp 0 on unconfigured invoices");
    assert.strictEqual(metrics.grossServiceMargin, 0, "Gross service margin must be Rp 0 (NEVER positive Rp 500.000)");
    assert.strictEqual(metrics.netTransactionMargin, 0, "Net transaction margin must be Rp 0");
    assert.strictEqual(metrics.isGrossDeficit, false, "Not a deficit when no Samsat cost");
    assert.strictEqual(metrics.isNetDeficit, false, "Not a net deficit");
    assert.strictEqual(metrics.costClassification, "UNCONFIGURED", "Classification must be UNCONFIGURED");
    assert.strictEqual(metrics.isConfigured, false, "Invoice is unconfigured");
  });

  await t.test("DEFECT-UAT-02 / Case 2b: Unconfigured invoice with actual Samsat expense reflects operational deficit", () => {
    // When Samsat cost is paid upfront but invoice total is unconfigured
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 500000,
      totalTagihan: 0,
      biayaSamsat: 250000,
      isExplicitZero: false,
    });

    assert.strictEqual(metrics.recognizedRevenue, 0, "Recognized revenue is 0");
    assert.strictEqual(metrics.grossServiceMargin, -250000, "Gross service margin is -250.000 (deficit)");
    assert.strictEqual(metrics.netTransactionMargin, -250000, "Net transaction margin is -250.000 (deficit)");
    assert.strictEqual(metrics.isGrossDeficit, true, "isGrossDeficit must be true");
    assert.strictEqual(metrics.isNetDeficit, true, "isNetDeficit must be true");
  });

  await t.test("DEFECT-UAT-02 / Case 3: Explicit zero promotional order recognizes Rp0 revenue and zero margin", () => {
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 0,
      totalTagihan: 0,
      biayaSamsat: 0,
      isExplicitZero: true,
    });

    assert.strictEqual(metrics.recognizedRevenue, 0, "Recognized revenue is 0");
    assert.strictEqual(metrics.grossServiceMargin, 0, "Gross margin is 0");
    assert.strictEqual(metrics.netTransactionMargin, 0, "Net margin is 0");
    assert.strictEqual(metrics.isGrossDeficit, false, "Not a deficit");
    assert.strictEqual(metrics.costClassification, "EXPLICIT_ZERO", "Cost classification is EXPLICIT_ZERO");
    assert.strictEqual(metrics.isConfigured, true, "Explicit zero is a configured state");
  });

  await t.test("DEFECT-UAT-02 / Case 3b: Explicit zero promotional order with absorbed Samsat cost produces operating deficit", () => {
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 0,
      totalTagihan: 0,
      biayaSamsat: 200000,
      isExplicitZero: true,
    });

    assert.strictEqual(metrics.recognizedRevenue, 0, "Recognized revenue is 0");
    assert.strictEqual(metrics.grossServiceMargin, -200000, "Gross margin is -200.000");
    assert.strictEqual(metrics.netTransactionMargin, -200000, "Net margin is -200.000");
    assert.strictEqual(metrics.isGrossDeficit, true, "isGrossDeficit must be true");
    assert.strictEqual(metrics.isNetDeficit, true, "isNetDeficit must be true");
  });

  await t.test("DEFECT-UAT-02 / Case 4: Deficit invoice (Samsat cost exceeds total bill) preserves negative margin", () => {
    const metrics = calculateInvoiceProfitMetrics({
      dibayar: 800000,
      totalTagihan: 800000,
      biayaSamsat: 1000000,
    });

    assert.strictEqual(metrics.recognizedRevenue, 800000, "Revenue recognized is 800.000");
    assert.strictEqual(metrics.grossServiceMargin, -200000, "Gross margin is -200.000");
    assert.strictEqual(metrics.netTransactionMargin, -200000, "Net margin is -200.000");
    assert.strictEqual(metrics.isGrossDeficit, true, "isGrossDeficit must be true");
    assert.strictEqual(metrics.isNetDeficit, true, "isNetDeficit must be true");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP B: DEFECT-UAT-01 REMEDIATION IN FINANCEDETAILPAGE
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("DEFECT-UAT-01: FinanceDetailPage resolves canonical properties from Profit table and renders profit correctly", () => {
    // Navigation from Profit table passes canonical item fields:
    // item.biayaSamsat, item.totalTagihan, item.uangMasuk
    const profitItem = {
      id: 101,
      invoice: "INV-2024-0101",
      customer: "PT Berkah Abadi",
      nopol: "B 1234 BCD",
      jenisLayanan: "Perpanjangan STNK",
      uangMasuk: 1000000,
      biayaSamsat: 700000,
      totalTagihan: 1000000,
      profit: 300000,
      status: "Lunas",
    };

    const markup = renderWithRouter(
      React.createElement(FinanceDetailPage, {
        subTabTitle: "Profit",
        item: profitItem,
        columns: [],
        onBack: () => {},
      })
    );

    // Verify that Total Uang Masuk is rendered
    assert.ok(markup.includes("1.000.000"), "Must render 1.000.000 for total tagihan / uang masuk");
    // Verify that Biaya Pokok Samsat is rendered in ledger row
    assert.ok(markup.includes("700.000"), "Must render 700.000 for Biaya Pokok Samsat");
    // Verify that Estimasi Profit is rendered as 300.000 and NOT Rp 0
    assert.ok(markup.includes("300.000"), "Must render 300.000 for Estimasi Profit");
  });

  await t.test("DEFECT-UAT-01: FinanceDetailPage preserves operating deficit (-Rp 250.000) and renders (Defisit) tag in rose red", () => {
    // Deficit row from Profit table
    const deficitItem = {
      id: 102,
      invoice: "INV-2024-0102",
      customer: "CV Maju Jaya",
      nopol: "B 5678 EFG",
      jenisLayanan: "Balik Nama",
      uangMasuk: 750000,
      biayaSamsat: 1000000,
      totalTagihan: 750000,
      profit: -250000,
      isGrossDeficit: true,
      isNetDeficit: true,
      status: "Lunas",
    };

    const markup = renderWithRouter(
      React.createElement(FinanceDetailPage, {
        subTabTitle: "Profit",
        item: deficitItem,
        columns: [],
        onBack: () => {},
      })
    );

    // Verify deficit display: must contain (Defisit) and rose color class
    assert.ok(markup.includes("(Defisit)"), "Must render '(Defisit)' label on operating deficit");
    assert.ok(markup.includes("text-rose-600"), "Must style deficit in text-rose-600");
    assert.ok(markup.includes("250.000"), "Must render 250.000 deficit nominal");
  });

  await t.test("DEFECT-UAT-01: FinanceDetailPage isolates overpayment into Kelebihan Bayar card and does not inflate profit", () => {
    const overpaidItem = {
      id: 103,
      invoice: "INV-2024-0103",
      customer: "Ibu Ratna",
      nopol: "D 9999 XYZ",
      jenisLayanan: "Pajak 5 Tahunan",
      uangMasuk: 1200000,
      biayaSamsat: 700000,
      totalTagihan: 1000000,
      overpayment: 200000,
      status: "Kelebihan Bayar",
    };

    const markup = renderWithRouter(
      React.createElement(FinanceDetailPage, {
        subTabTitle: "Profit",
        item: overpaidItem,
        columns: [],
        onBack: () => {},
      })
    );

    // Overpayment of 200.000 rendered
    assert.ok(markup.includes("200.000"), "Must display overpayment of 200.000");
    // Profit must be 300.000 (1.000.000 - 700.000), not 500.000
    assert.ok(markup.includes("300.000"), "Profit must be 300.000 (excluding overpayment)");
  });

  await t.test("DEFECT-UAT-01: FinanceDetailPage renders explicit zero promotional order as Lunas (Rp 0)", () => {
    const promoItem = {
      id: 104,
      invoice: "INV-2024-0104",
      customer: "Klinik Sehat",
      nopol: "B 1111 PRO",
      jenisLayanan: "Konsultasi Berkas",
      uangMasuk: 0,
      biayaSamsat: 0,
      totalTagihan: 0,
      isExplicitZero: true,
      status: "Lunas",
    };

    const markup = renderWithRouter(
      React.createElement(FinanceDetailPage, {
        subTabTitle: "Profit",
        item: promoItem,
        columns: [],
        onBack: () => {},
      })
    );

    assert.ok(markup.includes("Lunas (Rp 0)"), "Must render 'Lunas (Rp 0)' for explicit zero promotional order");
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // GROUP C: REGRESSION & STORE INTEGRATION VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════════

  await t.test("Regression-1: financeStore getProfitList preserves deficit margins across list iterations", () => {
    const profitList = financeStore.getProfitList();
    assert.ok(Array.isArray(profitList), "Profit list must be an array");

    // Check that every item in profitList has grossServiceMargin computed without throwing
    profitList.forEach((item) => {
      assert.strictEqual(typeof item.grossServiceMargin, "number");
      if (item.isGrossDeficit) {
        assert.ok(item.grossServiceMargin < 0, "Gross margin must be negative when isGrossDeficit is true");
      }
    });
  });

  await t.test("Regression-2: validateDocumentFinancialData rejects unconfigured invoices with Rp0 total", () => {
    const unconfiguredData = {
      orderNo: "ORD-9999",
      customer: "Pak Budi",
      nopol: "B 9999 TEST",
      totalTagihan: 0,
      dibayar: 500000,
      isExplicitZero: false,
    };

    const validation = validateDocumentFinancialData(unconfiguredData);
    assert.strictEqual(validation.isValidToPrint, false, "Unconfigured invoice must not be valid to print");
    assert.strictEqual(validation.isLunas, false, "Unconfigured invoice must not be marked lunas");
    assert.strictEqual(validation.isNoSnapshot, true, "Must flag missing snapshot");
  });
});
