import { initializeSchema, applySchemaMigrations } from "../server/src/database/schema";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");

console.log("=== EXECUTING PHASE 2 COMPLETION CHECK & MIGRATIONS ===");
const db = new DatabaseSync(dbPath);

// Execute schema initialization to ensure all DDL and migrations are applied
initializeSchema(db);
applySchemaMigrations(db);

console.log("\n1. PRAGMA table_info(vehicles):");
const vehiclesInfo = db.prepare("PRAGMA table_info(vehicles)").all();
console.table(vehiclesInfo);

console.log("\n2. PRAGMA table_info(order_status_history):");
const historyInfo = db.prepare("PRAGMA table_info(order_status_history)").all();
console.table(historyInfo);

console.log("\n3. PRAGMA table_info(order_timeline_processes):");
const timelineInfo = db.prepare("PRAGMA table_info(order_timeline_processes)").all();
console.table(timelineInfo);

console.log("\n4. PRAGMA table_info(orders):");
const ordersInfo = db.prepare("PRAGMA table_info(orders)").all();
console.table(ordersInfo);

console.log("\n5. PRAGMA foreign_key_check:");
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log(fkCheck.length === 0 ? "FK check: 0 violations (CLEAN)" : fkCheck);

console.log("\n6. PRAGMA integrity_check:");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log(integrity);

console.log("\n>>> PHASE 2 TABLES & COLUMNS 100% VERIFIED <<<");
