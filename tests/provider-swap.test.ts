import test from "node:test";
import assert from "node:assert";
import { OrderRepository } from "../src/data/repositories/orderRepository";
import { IOrderDataProvider } from "./fixtures/mock/mockOrderProvider";
import { OperationalOrder, StageName } from "../src/domain/order/types";

// Fake Custom Test Provider implementing IOrderDataProvider (Simulating Phase 7 API Provider)
class FakeCustomOrderProvider implements IOrderDataProvider {
  private fakeStore: Map<string, OperationalOrder> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor(initialOrders: OperationalOrder[] = []) {
    initialOrders.forEach((o) => this.fakeStore.set(o.orderNo, { ...o }));
  }

  getActiveOrders(): Record<StageName, OperationalOrder[]> {
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
    for (const order of this.fakeStore.values()) {
      const stage = order.currentStageName as StageName;
      if (result[stage]) {
        result[stage].push({ ...order });
      }
    }
    return result;
  }

  getArchivedOrders(): OperationalOrder[] {
    return [];
  }

  getAllFlat(): OperationalOrder[] {
    return Array.from(this.fakeStore.values());
  }

  getOrderByNo(orderNo: string): OperationalOrder | undefined {
    const o = this.fakeStore.get(orderNo);
    return o ? { ...o } : undefined;
  }

  getOrdersByStage(stage: StageName): OperationalOrder[] {
    return this.getAllFlat().filter((o) => o.currentStageName === stage);
  }

  addOrder(order: OperationalOrder): void {
    this.fakeStore.set(order.orderNo, { ...order });
    this.notify();
  }

  updateOrder(orderNo: string, updates: Partial<OperationalOrder>): boolean {
    const current = this.fakeStore.get(orderNo);
    if (!current) return false;
    this.fakeStore.set(orderNo, { ...current, ...updates });
    this.notify();
    return true;
  }

  advanceOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder>): boolean {
    const current = this.fakeStore.get(orderNo);
    if (!current) return false;
    this.fakeStore.set(orderNo, {
      ...current,
      ...updates,
      currentStageName: targetStage,
    });
    this.notify();
    return true;
  }

  rollbackOrder(orderNo: string, targetStage: StageName, updates: Partial<OperationalOrder>): boolean {
    return this.advanceOrder(orderNo, targetStage, updates);
  }

  archiveOrder(orderNo: string): boolean {
    return this.fakeStore.delete(orderNo);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

test("Provider Swap - OrderRepository seamlessly works with alternative provider without consumer changes", () => {
  const customSeedOrder: OperationalOrder = {
    orderNo: "CUSTOM-001",
    customer: "Custom Provider Customer",
    nomorHP: "0899999999",
    layanan: "Balik Nama",
    currentStep: 1,
    currentStageName: "Verifikasi",
    createdAt: new Date().toISOString(),
    namaPemilik: "Custom Owner",
    kepemilikanKendaraan: "Milik Sendiri",
    nopol: "B 9999 CST",
    wilayahSamsatAsal: "Jakarta Selatan",
    wilayahSamsatTujuan: "-",
    nominalPkbTerakhir: 500000,
    nominalSwdkllj: 143000,
    biayaJasa: 100000,
    pkb: 500000,
    swdkllj: 143000,
    dendaSwdkllj: 0,
    totalEstimasi: 743000,
    payment: {
      tipePembayaran: "Bayar di Awal",
      metodePembayaran: "Cash",
      statusPembayaran: "Lunas",
      totalBiaya: 743000,
      dibayar: 743000,
      kurang: 0,
    },
    orderSource: "Offline / Loket",
    createdBy: "Admin Loket",
    clientDocuments: {},
    samsatProcesses: [],
  };

  // Instantiating OrderRepository with the fake custom provider
  const customProvider = new FakeCustomOrderProvider([customSeedOrder]);
  const repositoryWithCustomProvider = new OrderRepository(customProvider);

  // 1. Reading from the custom provider
  const fetched = repositoryWithCustomProvider.getByOrderNo("CUSTOM-001");
  assert.ok(fetched, "Order should be read from custom provider");
  assert.strictEqual(fetched?.customer, "Custom Provider Customer");

  // 2. Mutating through repository into the custom provider
  let notified = false;
  repositoryWithCustomProvider.subscribe(() => {
    notified = true;
  });

  const updated = repositoryWithCustomProvider.updateOrder("CUSTOM-001", {
    customer: "Updated Via Custom Provider",
  });
  assert.strictEqual(updated, true, "Update should succeed");
  assert.strictEqual(notified, true, "Subscriber should be notified via custom provider");

  const refreshed = repositoryWithCustomProvider.getByOrderNo("CUSTOM-001");
  assert.strictEqual(refreshed?.customer, "Updated Via Custom Provider");

  // 3. Advancing stage through repository
  repositoryWithCustomProvider.advanceOrder("CUSTOM-001", "Penjadwalan", { currentStep: 2 });
  const advanced = repositoryWithCustomProvider.getByOrderNo("CUSTOM-001");
  assert.strictEqual(advanced?.currentStageName, "Penjadwalan");
  assert.strictEqual(advanced?.currentStep, 2);
});
