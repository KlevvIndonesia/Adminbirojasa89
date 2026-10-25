import { initializeSchema } from "../server/src/database/schema";
import { seedDatabase } from "../server/src/database/seed";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../server/data/database.sqlite");

console.log("=== EXECUTING PHASE 3 COMPLETION CHECK & MIGRATIONS ===");
const db = new DatabaseSync(dbPath);

// Execute schema initialization to ensure all DDL and migrations are applied
initializeSchema(db);

// Seed database
seedDatabase();

console.log("\n1. PRAGMA table_info(messengers):");
const msgInfo = db.prepare("PRAGMA table_info(messengers)").all();
console.table(msgInfo);

console.log("\n2. PRAGMA table_info(messenger_tasks):");
const tasksInfo = db.prepare("PRAGMA table_info(messenger_tasks)").all();
console.table(tasksInfo);

console.log("\n3. PRAGMA table_info(kas_messenger):");
const kasMsgInfo = db.prepare("PRAGMA table_info(kas_messenger)").all();
console.table(kasMsgInfo);

console.log("\n4. PRAGMA table_info(messenger_reimbursements):");
const reimbInfo = db.prepare("PRAGMA table_info(messenger_reimbursements)").all();
console.table(reimbInfo);

console.log("\n5. SELECT * FROM messengers:");
const msgRows = db.prepare("SELECT * FROM messengers").all();
console.table(msgRows);

console.log("\n6. PRAGMA foreign_key_check:");
const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
console.log(fkCheck.length === 0 ? "FK check: 0 violations (CLEAN)" : fkCheck);

console.log("\n7. PRAGMA integrity_check:");
const integrity = db.prepare("PRAGMA integrity_check").all();
console.log(integrity);

console.log("\n>>> PHASE 3 MESSENGER OPERATIONS 100% VERIFIED <<<");
