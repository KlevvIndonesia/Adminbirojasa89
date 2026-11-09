import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  deriveMessengerTasksFromOrders,
  isTaskAssignedMessenger,
  MessengerTaskItem,
} from "../src/app/data/messengerTaskAdapter";
import { OperationalOrder } from "../src/domain/order/types";
import { StageName } from "../src/app/data/orderStore";

function createMockOrder(orderNo: string, overrides: Partial<OperationalOrder> = {}): OperationalOrder {
  return {
    orderNo,
    customer: "Budi Santoso",
    namaPemilik: "Budi Santoso",
    nomorHP: "081234567890",
    layanan: "Perpanjangan STNK Tahunan",
    tipeLayanan: "Perorangan",
    nopol: "B 1234 ABC",
    wilayahSamsatAsal: "Jakarta Timur",
    currentStep: 2,
    currentStageName: "Penjadwalan",
    status: "Dalam Proses",
    tanggalMasukBerkas: "2026-11-01",
    totalBiaya: 500000,
    payment: {
      statusPembayaran: "Belum Bayar",
      totalTagihan: 500000,
      totalDibayar: 0,
      sisaTagihan: 500000,
      metodePembayaran: "Transfer Bank",
    },
    ...overrides,
  } as OperationalOrder;
}

function wrapActiveOrders(orders: OperationalOrder[]): Record<StageName, OperationalOrder[]> {
  const result: Record<StageName, OperationalOrder[]> = {
    "Pendaftaran Order": [],
    "Penjadwalan": [],
    "Verifikasi Dokumen": [],
    "Proses Samsat": [],
    "Verifikasi Ulang": [],
    "Supervisi": [],
    "Pengantaran": [],
    "Dokumen Telah Diterima": [],
  };
  for (const o of orders) {
    const stage = o.currentStageName || "Penjadwalan";
    if (result[stage]) {
      result[stage].push(o);
    } else {
      result["Penjadwalan"].push(o);
    }
  }
  return result;
}

// Mirror the authoritative logic implemented in MessengerTask.tsx
function evaluateTaskLockState(task: MessengerTaskItem) {
  const isAssigned = isTaskAssignedMessenger(task);

  const isTaskLocked = Boolean(
    isAssigned && (
      task.isLocked ||
      task.acceptanceStatus === "ACCEPTED" ||
      task.status === "Dalam Proses" ||
      task.lifecycleStatus === "DITERIMA" ||
      task.lifecycleStatus === "SEDANG_DIKERJAKAN" ||
      task.acceptanceStatus === "SUPERSEDED"
    )
  );

  return { isAssigned, isTaskLocked };
}

test("Messenger Task UI Density & Assignment Lock State Invariants", async (t) => {
  await t.test("1. Valid messenger name and valid employee ID: isAssigned is true", () => {
    const task: Partial<MessengerTaskItem> = {
      id: "ORD-001",
      messenger: "Budi Santoso",
      assignedMessengerId: "emp-0004",
    };
    assert.equal(
      isTaskAssignedMessenger(task as MessengerTaskItem),
      true,
      "Task with valid name and ID must be assigned"
    );
  });

  await t.test("2. Empty messenger name but valid assignedMessengerId: isAssigned is true", () => {
    const task: Partial<MessengerTaskItem> = {
      id: "ORD-002",
      messenger: "",
      assignedMessengerId: "emp-0004",
    };
    assert.equal(
      isTaskAssignedMessenger(task as MessengerTaskItem),
      true,
      "Task with empty name but valid employee ID must be detected as assigned"
    );

    const taskWithDash: Partial<MessengerTaskItem> = {
      id: "ORD-002B",
      messenger: "-",
      assignedMessengerId: "emp-0005",
    };
    assert.equal(
      isTaskAssignedMessenger(taskWithDash as MessengerTaskItem),
      true,
      "Task with placeholder '-' name but valid employee ID must be detected as assigned"
    );
  });

  await t.test("3. Placeholder messenger name and invalid ID: isAssigned is false (Unassigned)", () => {
    const taskPlaceholder: Partial<MessengerTaskItem> = {
      id: "ORD-003",
      messenger: "Belum Ditugaskan",
      assignedMessengerId: "-",
    };
    assert.equal(
      isTaskAssignedMessenger(taskPlaceholder as MessengerTaskItem),
      false,
      "Task with placeholder name and '-' ID must be unassigned"
    );

    const taskWalkIn: Partial<MessengerTaskItem> = {
      id: "ORD-003B",
      messenger: "Datang Langsung (Loket)",
      assignedMessengerId: "",
    };
    assert.equal(
      isTaskAssignedMessenger(taskWalkIn as MessengerTaskItem),
      false,
      "Walk-in loket task without courier ID must be unassigned for messenger field table"
    );
  });

  await t.test("4. Task unassigned: isAssigned is false, isTaskLocked is false (Tugaskan button active)", () => {
    const order = createMockOrder("ORD-UNASSIGNED-01", {
      messenger: undefined,
      isScheduled: false,
    });
    const tasks = deriveMessengerTasksFromOrders(wrapActiveOrders([order]));
    assert.equal(tasks.length, 1);
    const task = tasks[0];

    const { isAssigned, isTaskLocked } = evaluateTaskLockState(task);
    assert.equal(isAssigned, false, "Unassigned task must not be treated as assigned");
    assert.equal(isTaskLocked, false, "Unassigned task must never be locked");
  });

  await t.test("5. Task assigned but pending (belum diambil oleh kurir): isAssigned is true, isTaskLocked is FALSE (Alihkan & Ambil Alih ACTIVE)", () => {
    const order = createMockOrder("ORD-PENDING-01", {
      messenger: "Budi Messenger",
      assignedMessengerName: "Budi Messenger",
      assignedMessengerId: "emp-budi",
      isScheduled: true,
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "PENDING",
          courierId: "emp-budi",
          courierName: "Budi Messenger",
          isLocked: false,
        },
      },
    });
    const tasks = deriveMessengerTasksFromOrders(wrapActiveOrders([order]));
    assert.equal(tasks.length, 1);
    const task = tasks[0];

    const { isAssigned, isTaskLocked } = evaluateTaskLockState(task);
    assert.equal(isAssigned, true, "Task with assigned messenger is assigned");
    assert.equal(isTaskLocked, false, "Pending task (belum diambil) must NOT be locked");
    assert.equal(task.acceptanceStatus, "PENDING");
  });

  await t.test("6. Task accepted by courier (sudah diambil/terkunci): isTaskLocked is TRUE (Alihkan & Ambil Alih DISABLED with Lock icon)", () => {
    const order = createMockOrder("ORD-ACCEPTED-01", {
      messenger: "Eko Prasetyo",
      assignedMessengerName: "Eko Prasetyo",
      assignedMessengerId: "emp-eko",
      isScheduled: true,
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "ACCEPTED",
          courierId: "emp-eko",
          courierName: "Eko Prasetyo",
          isLocked: true,
          acceptedAt: new Date().toISOString(),
        },
      },
    });
    const tasks = deriveMessengerTasksFromOrders(wrapActiveOrders([order]));
    assert.equal(tasks.length, 1);
    const task = tasks[0];

    const { isAssigned, isTaskLocked } = evaluateTaskLockState(task);
    assert.equal(isAssigned, true);
    assert.equal(isTaskLocked, true, "Task accepted by courier must be locked");
    assert.equal(task.isLocked, true);
    assert.equal(task.acceptanceStatus, "ACCEPTED");

    // Also verify task in progress
    const orderInProgress = createMockOrder("ORD-INPROGRESS-01", {
      messenger: "Ahmad Courier",
      assignedMessengerName: "Ahmad Courier",
      assignedMessengerId: "emp-ahmad",
      isScheduled: true,
      messengerTaskStatus: "Sedang Dijemput",
      startedAt: new Date().toISOString(),
    });
    const inProgressTasks = deriveMessengerTasksFromOrders(wrapActiveOrders([orderInProgress]));
    const inProgressTask = inProgressTasks[0];
    const evaluatedInProgress = evaluateTaskLockState(inProgressTask);
    assert.equal(evaluatedInProgress.isAssigned, true);
    assert.equal(evaluatedInProgress.isTaskLocked, true, "Task in progress must be locked");
    assert.equal(inProgressTask.status, "Dalam Proses");
  });

  await t.test("7. Reassigned task maintains previous courier info while staying operable if pending (SUPERSEDED isolation)", () => {
    const order = createMockOrder("ORD-REASSIGNED-01", {
      messenger: "Candra Wijaya",
      assignedMessengerName: "Candra Wijaya",
      assignedMessengerId: "emp-candra",
      isScheduled: true,
      taskAcceptance: {
        ["Jemput Dokumen"]: {
          status: "PENDING",
          courierId: "emp-candra",
          courierName: "Candra Wijaya",
          isLocked: false,
          reassignedFrom: "Budi Messenger",
          reassignReason: "Kendaraan kurir mogok",
          reassignedAt: new Date().toISOString(),
        },
      },
    });
    const tasks = deriveMessengerTasksFromOrders(wrapActiveOrders([order]));
    assert.equal(tasks.length, 1);
    const task = tasks[0];

    const { isAssigned, isTaskLocked } = evaluateTaskLockState(task);
    assert.equal(isAssigned, true);
    assert.equal(isTaskLocked, false, "Newly reassigned task in pending state must be operable");
    assert.equal(task.reassignedFrom, "Budi Messenger");
    assert.equal(task.reassignReason, "Kendaraan kurir mogok");
  });

  await t.test("8. Codebase inspection: Diterima (Terkunci) label is removed from MessengerTask.tsx", () => {
    const filePath = path.resolve(process.cwd(), "src/app/components/MessengerTask.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Must NOT contain "Diterima (Terkunci)"
    assert.equal(
      content.includes("Diterima (Terkunci)"),
      false,
      "MessengerTask.tsx must not contain 'Diterima (Terkunci)' badge"
    );
  });

  await t.test("9. Codebase inspection: Disabled lock buttons have Lock icon and cursor-not-allowed", () => {
    const filePath = path.resolve(process.cwd(), "src/app/components/MessengerTask.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Both disabled buttons must show Lock icon and cursor-not-allowed
    assert.ok(
      content.includes('title="Tugas sudah diambil kurir (Terkunci)"'),
      "Must have locked title on disabled buttons"
    );
    assert.ok(
      content.includes("cursor-not-allowed"),
      "Must have cursor-not-allowed styling on locked buttons"
    );
    assert.ok(
      content.includes("<Lock className="),
      "Must have Lock icon rendered for locked action buttons"
    );
  });

  await t.test("10. Codebase inspection: Typography and spacing refinements applied", () => {
    const filePath = path.resolve(process.cwd(), "src/app/components/MessengerTask.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Summary cards must use text-xl font-semibold instead of text-2xl font-bold
    assert.ok(
      content.includes("text-xl font-semibold font-mono tabular-nums text-foreground"),
      "Summary cards must use text-xl font-semibold"
    );
    assert.equal(
      content.includes("text-2xl font-bold font-mono tabular-nums text-foreground"),
      false,
      "Oversized text-2xl font-bold must be removed from summary cards"
    );

    // Table headers must use font-medium (500)
    assert.ok(
      content.includes("text-[11px] font-medium text-muted-foreground uppercase tracking-wider"),
      "Table headers must use font-medium (500)"
    );

    // Table rows must use compact height h-9
    assert.ok(
      content.includes("border-b border-border/60 last:border-0 h-9"),
      "Table rows must use compact h-9 height"
    );

    // Table cells must use compact padding px-2.5 py-1.5
    assert.ok(
      content.includes("px-2.5 py-1.5"),
      "Table cells must use compact padding px-2.5 py-1.5"
    );
  });

  await t.test("11. Codebase inspection: isAssigned uses canonical isTaskAssignedMessenger(task)", () => {
    const filePath = path.resolve(process.cwd(), "src/app/components/MessengerTask.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(
      content.includes("const isAssigned = isTaskAssignedMessenger(task);"),
      "MessengerTask.tsx must use canonical isTaskAssignedMessenger(task)"
    );
  });
});
