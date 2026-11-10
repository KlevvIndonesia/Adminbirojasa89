# PHASE 3A — ROLE-BASED ACCESS CONTROL (RBAC) & ACCESS CONTROL AUDIT
**SUN89 / SUNBiroJasa Admin Platform**  
**Audit Mode:** STRICT READ-ONLY AUDIT  
**Baseline Database Hash:** `898C0C7127D49392D40CA3A6AB73BA16E1F92C67E2C6E8D95EF5D81FEEC7B12C` (Size: 1,441,792 bytes)  
**Uploads Manifest Hash:** `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5` (51 files, 1,525,984 bytes)  
**Date:** 2026-11-10

---

## 1. EXECUTIVE SUMMARY

An exhaustive, read-only architectural security audit of the Role-Based Access Control (RBAC) and access control implementation across the SUN89 / SUNBiroJasa admin platform was conducted. The audit inspected:
- All 17 backend Express route definitions (`server/src/routes/*.ts`)
- All authentication and authorization middleware (`server/src/middleware/auth.ts`, `crypto.ts`, `validation.ts`)
- Core services and repositories (`authService.ts`, `userService.ts`, `orderService.ts`, `documentService.ts`, `dbUserRepository.ts`, `dbPermissionRepository.ts`)
- The frontend permission architecture (`permissionStore.ts`, `routeConfig.ts`, `navigationConfig.ts`, `App.tsx`, `AccessManagement.tsx`, `AuditLog.tsx`, `OrderTracking.tsx`, `Finance.tsx`, `ManajemenPengguna.tsx`, `MessengerWorkspace.tsx`)
- Active SQLite operational database schema, users, employees, and role permission tables.

### Key Audit Conclusions
1. **Backend as Single Source of Truth (SSoT) Disconnect:**  
   While the application presents an "Access Management" UI (`/manajemen/hak-akses`) and persists dynamic role configurations in SQLite (`role_permissions` table), **backend Express middleware does not evaluate dynamic permissions at all**. All backend route enforcement relies on hardcoded role arrays in `requireRoles(...)`. Dynamic permission changes made by administrators in the UI affect only frontend visibility and client-side guards.
2. **Critical Audit Log Deletion Bypass (GAP-RBAC-01):**  
   A route mounting mismatch between `/api/audit-logs` and `/api/audit` in Express allows an `admin` role user to completely delete all system audit logs via `DELETE /api/audit` or `POST /api/audit-logs/clear`, directly bypassing the intended superadmin restriction.
3. **Privilege Escalation via Unsafe Role Fallback (GAP-RBAC-02):**  
   In `authService.login`, unknown or empty `jabatan` values default to `"admin"` via `roleMap[userEntity.jabatan] || "admin"`. If a user account is provisioned with an arbitrary or empty title, it receives full administrative privileges.
4. **Order Hard-Deletion by Non-Operational Roles (GAP-RBAC-04):**  
   `DELETE /api/orders/:orderNo` explicitly permits `finance` and `admin` roles to permanently destroy order records and cascading relational data, despite Finance having no operational mandate over order lifecycles in frontend configurations.
5. **Global Order PII Exposure to Couriers (GAP-RBAC-05):**  
   `GET /api/orders` lacks courier identity scoping. Any courier with a valid token can query the full operational database, viewing sensitive customer personal data, phone numbers, addresses, and transaction amounts.
6. **Supervisor Stage 6 Approval Bypass (GAP-RBAC-06):**  
   `POST /api/orders/:orderNo/rollback` allows an `admin` to roll back orders currently at Stage 7 (Pengantaran) or Stage 8 (Diterima) to Stage 1. This revokes Stage 6 Supervisor approvals without requiring Supervisor authority.

---

## 2. SYSTEM IDENTITY & ROLE ARCHITECTURE

### 2.1 Backend Role & Jabatan Mapping
In SQLite table `users`, accounts have both a `role` column and a `jabatan` column.
During authentication (`server/src/services/authService.ts`), the JWT token payload is generated as follows:

```typescript
const roleMap: Record<string, 'administrator' | 'finance' | 'admin' | 'messenger'> = {
  SVP: "administrator",
  ADMIN: "admin",
  FINANCE: "finance",
  MESSENGER: "messenger",
};
const role = roleMap[userEntity.jabatan] || "admin";
```

#### Observations & Anomalies:
- **`users.role` is completely ignored during login**: The database column `users.role` is superseded by `users.jabatan`.
- **Identity Inconsistency in `authService.getMe`**: When `/api/auth/me` is called, `authService.getMe` merges `{ ...tokenPayload, ...(user || {}) }`. Because `user` comes from `dbUserRepository.getById`, `user.role` (from `users.role`) overwrites `tokenPayload.role`. For User 1 (`jabatan: "SVP"`, `role: "svp"`), the JWT token carries `role: "administrator"`, but `getMe` returns `role: "svp"`.
- **Phantom / Orphan Roles in Middleware**:
  Multiple backend routes specify role guards for roles that cannot be issued by `authService`:
  - `"supervisor"` and `"spv"` (used in `financeRoutes.ts`, `messengerRoutes.ts`, `orderRoutes.ts`, `orderCorrectionRoutes.ts`)
  - `"staff"` (used in `orderRoutes.ts`)
  Any user holding these job titles is mapped to `"admin"` by `roleMap`, effectively locking them out of endpoints requiring `"supervisor"`, while granting them administrative permissions on other endpoints.

### 2.2 Active Database User Inventory
Inspection of `users` table in operational database:

| ID | Nama | Email | Jabatan (DB) | Role (DB) | Token Role (`authService`) | Status | Employee ID |
|:---|:---|:---|:---|:---|:---|:---|:---|
| 1 | Admin Super (SVP) | `svp@birojasa.com` | `SVP` | `svp` | `administrator` | Aktif | EMP-0001 |
| 2 | Adrian Adhari | `admin@birojasa.com` | `ADMIN` | `admin` | `admin` | Aktif | EMP-0002 |
| 3 | Finance User | `finance@birojasa.com` | `FINANCE` | `finance` | `finance` | Aktif | EMP-0003 |
| 4 | Budi Santoso | `budi.messenger@birojasa.com` | `MESSENGER` | `messenger` | `messenger` | Aktif | EMP-0004 |
| 5 | Andi Pratama | `andi.messenger@birojasa.com` | `MESSENGER` | `messenger` | `messenger` | Aktif | EMP-0005 |
| 6 | Budi Santoso | `messenger@birojasa.com` | `MESSENGER` | `messenger` | `messenger` | Nonaktif | EMP-0006 |

---

## 3. BACKEND AUTHORIZATION ARCHITECTURE

### 3.1 Middleware Spectrum
Authorization in `server/src/middleware/auth.ts` is implemented via 5 functions:

1. **`validateTokenAndUser(token)`**:  
   Verifies HMAC-SHA256 signature and checks real-time database status (`users.status === 'Aktif'`). Revoked or deleted identities are rejected immediately (`REVOKED_IDENTITY` or `ACCOUNT_INACTIVE`).
2. **`authenticateToken(req, res, next)`**:  
   Optional authentication middleware. Sets `req.user` if valid token is provided, but allows anonymous requests to pass (`req.user = null`).
3. **`requireAuth(req, res, next)`**:  
   Mandatory authentication gate. Rejects any request without a verified JWT token.
4. **`requireRoles(...allowedRoles)`**:  
   Checks if `allowedRoles.includes(userRole) || userRole === "administrator" || req.user.jabatan === "SVP"`.  
   *Universal bypass:* An account with `role: "administrator"` or `jabatan: "SVP"` is granted access across all `requireRoles` checkpoints.
5. **`requireStageAuthority(req, res, next)`**:  
   Workflow stage gate.
   - Administrator / SVP: Full authority over all stages.
   - Messenger: Denied Order Tracking mutation access.
   - Finance: Denied operational stage transitions.
   - Admin: Denied Stage 6 (Supervisi) advancement (`currentStageName === "Supervisi"`).
6. **`requireUserSelfOrAdmin(req, res, next)`**:  
   IDOR protection on profile routes. Allows target user, Administrator, or Admin.

### 3.2 Backend Route Inventory & Authorization Matrix

| Route Group | Method & Path | Backend Middleware Protection | Allowed Roles | Findings / Mismatches |
|:---|:---|:---|:---|:---|
| **Auth** | `POST /api/auth/login` | `loginRateLimiter`, `validateLoginPayload` | Public / Anonymous | Rate limited, password hash verified. |
| | `GET /api/auth/me` | `requireAuth` | Authenticated | Overwrites token role with DB `users.role`. |
| | `POST /api/auth/change-password` | `requireAuth` | Authenticated | Self-service password change. |
| **Audit Logs** | `GET /api/audit-logs` / `GET /api/audit` | `requireAuth`, `requireRoles` | `administrator`, `svp`, `admin` | Admin can view audit logs. |
| | `POST /api/audit-logs` / `POST /api/audit` | `requireAuth` | Authenticated | Server verifies actor identity. |
| | `DELETE /api/audit-logs` | `requireAuth`, conditional | `administrator` | Enforced when requested via `/api/audit-logs`. |
| | `DELETE /api/audit` | `requireAuth`, conditional | `administrator`, `svp`, `admin` | **CRITICAL: Admin bypasses deletion restriction via `/api/audit`!** |
| | `POST /api/audit-logs/clear` | `requireAuth`, `requireRoles` | `administrator`, `svp`, `admin` | **CRITICAL: Admin can clear audit logs via POST!** |
| | `POST /api/audit/clear` | `requireAuth`, `requireRoles` | `administrator`, `svp`, `admin` | **CRITICAL: Admin can clear audit logs via POST!** |
| **Orders** | `GET /api/orders` | `requireAuth` | Any Authenticated | **HIGH: Messenger can read all orders and customer PII.** |
| | `POST /api/orders` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `svp` | Idempotent creation with locking. |
| | `PUT /api/orders/:orderNo` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `svp`, `messenger` | **HIGH: Finance has unrestricted field mutation access.** |
| | `POST /api/orders/:orderNo/advance` | `requireAuth`, `requireRoles`, `requireStageAuthority` | `administrator`, `admin`, `svp` | Stage 6 restricted to Supervisor/SVP. |
| | `POST /api/orders/:orderNo/rollback` | `requireAuth`, `requireRoles`, `requireStageAuthority` | `administrator`, `admin`, `svp` | **HIGH: Admin can rollback Stage 7/8, revoking Stage 6 SPV approvals.** |
| | `DELETE /api/orders/:orderNo` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `svp` | **HIGH: Finance and Admin can hard-delete orders.** |
| | `POST /api/orders/:orderNo/verify-payment` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `svp` | Finance / Admin can verify payment. |
| | `POST /api/orders/:orderNo/cancel` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `svp` | Order cancellation endpoint. |
| | `POST /api/orders/:orderNo/request-correction` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `svp`, `finance`, `staff` | `"staff"` is an orphan role. |
| | `POST /api/orders/:orderNo/verify-cost` | `requireAuth`, `requireRoles`, `validatePayload` | `administrator`, `admin`, `svp`, `supervisor`, `spv` | `"supervisor"`, `"spv"` are orphan roles. |
| | `POST /api/orders/:orderNo/approve-documents`| `requireAuth`, `requireRoles` | `administrator`, `admin`, `svp` | Approves Stage 1 and Stage 5 docs. |
| | `POST /api/orders/:orderNo/tasks/:task/accept`| `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Courier task acceptance. |
| | `POST /api/orders/:orderNo/tasks/:task/decline`| `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Courier task rejection (zero free notes). |
| | `POST /api/orders/:orderNo/tasks/:task/reassign`| `requireAuth`, `requireRoles` | `administrator`, `admin`, `svp` | Task reassignment. |
| | `POST /api/orders/:orderNo/samsat/start` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Samsat process initiation. |
| | `POST /api/orders/:orderNo/samsat/complete` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Samsat process completion. |
| | `POST /api/orders/:orderNo/pickup/start` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Pickup task initiation. |
| | `POST /api/orders/:orderNo/pickup/complete` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Pickup task completion. |
| | `POST /api/orders/:orderNo/delivery/start` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Delivery task initiation. |
| | `POST /api/orders/:orderNo/delivery/complete`| `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Delivery task completion. |
| **Finance** | `GET /api/finance/invoices` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `svp`, `admin` | **HIGH: Admin can view all invoices.** |
| | `GET /api/finance/profit` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `svp`, `admin` | **HIGH: Admin can view profit data.** |
| | `GET /api/finance/laba-rugi` / `pnl` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `svp`, `admin` | **HIGH: Admin can view P&L financial data.** |
| | `POST /api/finance/invoices/:id/pay` | `requireAuth`, `requireRoles` | `administrator`, `finance` | Payment processing. |
| | `POST /api/finance/invoices/:id/cashback-payout`| `requireAuth`, `requireRoles`| `administrator`, `finance` | Cashback disbursement. |
| | `POST /api/finance/invoices/:id/complete`| `requireAuth`, `requireRoles` | `administrator`, `finance` | Invoicing closure. |
| | `POST /api/finance/invoices/:id/payments/:pId/void`| `requireAuth`, `requireRoles`| `administrator`, `supervisor`, `spv`, `svp`| Orphan roles `"supervisor"`, `"spv"`. |
| | `GET /api/finance/kas-kantor` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `svp` | Kas kantor read. |
| | `POST /api/finance/kas-kantor` | `requireAuth`, `requireRoles` | `administrator`, `finance` | Kas kantor transaction. |
| | `DELETE /api/finance/kas-kantor/:id` | `requireAuth`, `requireRoles` | `administrator`, `finance` | **MEDIUM: Physical row deletion of cash records.** |
| | `GET /api/finance/pengeluaran` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `svp` | Pengeluaran read. |
| | `POST /api/finance/pengeluaran` | `requireAuth`, `requireRoles` | `administrator`, `finance` | Pengeluaran entry. |
| | `DELETE /api/finance/pengeluaran/:id`| `requireAuth`, `requireRoles` | `administrator`, `finance` | **MEDIUM: Physical row deletion of expense records.** |
| | `GET /api/finance/kas-messenger` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `messenger` | Kas messenger read. |
| | `POST /api/finance/kas-messenger` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `admin` | Kas messenger entry. |
| | `DELETE /api/finance/kas-messenger/:id`| `requireAuth`, `requireRoles`| `administrator`, `finance` | Kas messenger deletion. |
| | `POST /api/finance/transfer/*` | `requireAuth`, `requireRoles` | `administrator`, `finance`, `supervisor`, `svp`, `admin`| Internal cash transfer. |
| **Messenger**| `GET /api/messenger/messengers` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `messenger` | Messenger roster. |
| | `GET /api/messenger/history` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `messenger` | Scoped to caller if role is messenger. |
| | `GET /api/messenger/tasks/:orderNo` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `messenger` | Scoped to assigned courier if role is messenger. |
| | `GET /api/messenger/reimbursements` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance`, `messenger` | Scoped to caller if role is messenger. |
| | `POST /api/messenger/reimbursements` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `messenger` | Submit reimbursement. |
| | `PATCH /api/messenger/reimbursements/:id/review`| `requireAuth`, `requireRoles`| `administrator`, `admin`, `finance` | Review reimbursement. |
| | `POST /api/messenger/reimbursements/:id/pay` | `requireAuth`, `requireRoles`| `administrator`, `finance` | Pay reimbursement. |
| | `POST /api/messenger/reimbursements/:id/void`| `requireAuth`, `requireRoles`| `administrator`, `supervisor`, `svp` | Void reimbursement. |
| **Users** | `GET /api/users` | `requireAuth`, `requireRoles` | `administrator`, `admin` | List system users. |
| | `GET /api/users/:id` | `requireAuth`, `requireUserSelfOrAdmin` | Self, `administrator`, `admin` | View user profile. |
| | `POST /api/users` | `requireAuth`, `requireRoles` | `administrator`, `admin` | **HIGH: Admin can create users with arbitrary jabatan.** |
| | `PUT /api/users/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin` | **HIGH: Admin can modify other Admin accounts.** |
| | `DELETE /api/users/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin` | **HIGH: Admin can deactivate other Admin accounts.** |
| | `POST /api/users/:id/reset-password` | `requireAuth`, `requireRoles` | `administrator`, `admin` | **HIGH: Admin can reset passwords of other Admins.** |
| | `GET /api/users/:id/permanent-erasure-preflight` | `requireAuth`, `requireRoles` | `administrator` | Preflight erasure. |
| | `POST /api/users/:id/permanent-erasure` | `requireAuth`, `requireRoles` | `administrator` | Permanent erasure (Requires superadmin). |
| **Permissions** | `GET /api/permissions` | `requireAuth` | Authenticated | Reads dynamic matrix from SQLite. |
| | `PUT /api/permissions/:role` | `requireAuth`, `requireRoles` | `administrator` | Updates dynamic matrix in SQLite. |
| | `POST /api/permissions/reset` | `requireAuth`, `requireRoles` | `administrator` | Resets dynamic matrix in SQLite. |
| **Documents** | `POST /api/documents/upload` | `requireAuth`, `uploadRateLimiter` | Authenticated | Upload single document. |
| | `GET /api/documents/:id/preview` / `download` | Optional / Access Ticket | Public / Ticket | Stream media. |
| | `DELETE /api/documents/:id` | `requireAuth` | Authenticated | Owner or Admin (Soft delete). |
| **Master Data** | `GET /api/services` / `samsat` / `pricing` | `requireAuth` | Authenticated | Read operations. |
| | `PUT /api/services/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `svp` | Update service metadata. |
| | `DELETE /api/services/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin` | Delete service. |
| | `PUT /api/pricing/samsat/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin` | Update Samsat base prices. |
| | `POST /api/pricing/services` | `requireAuth`, `requireRoles` | `administrator`, `admin` | Create service pricing. |
| | `POST /api/payment-methods` | `requireAuth`, `requireRoles` | `administrator`, `admin`, `finance` | **LOW: Finance can manage payment methods.** |
| **Estimations** | `GET /api/estimation/templates` | `authenticateToken` | Anonymous / Authenticated | **LOW: Anonymous access permitted.** |
| | `PUT /api/estimation/templates/:id` | `requireAuth`, `requireRoles` | `administrator`, `admin` | Update templates. |
| **Public API** | `/api/v1/public/*` | `publicGeneralRateLimiter` | Public / Anonymous | Rate limited, sanitized public API. |

---

## 4. FRONTEND AUTHORIZATION ARCHITECTURE

### 4.1 Permission Store Mechanism
`src/app/data/permissionStore.ts` provides client-side access control with:
- **Roles Defined**: `svp`, `administrator` (alias), `admin`, `finance`, `messenger`.
- **Normalization**: `normalizeRole(role)` maps empty/null to `"admin"`, and `"kurir"` / `"courier"` to `"messenger"`.
- **Granular Matrix**: Each role has `modules: Record<string, { view: boolean; manage: boolean }>` and `stages: StageActionPermissions`.
- **Persistence & API Sync**: Loads from `localStorage`, then calls `GET /api/permissions` via `initFromApi()` upon login.

### 4.2 Frontend vs Backend Access Control Discrepancies

```
+---------------------------+-----------------------------------+-----------------------------------+
| Feature / Endpoint        | Frontend Policy                   | Backend Enforcement               |
+---------------------------+-----------------------------------+-----------------------------------+
| Financial Reports & P&L   | Admin: VIEW = FALSE               | Admin: PERMITTED                  |
| (/finance/profit, laba)   | Module hidden from menu           | requireRoles("..., admin")        |
+---------------------------+-----------------------------------+-----------------------------------+
| Audit Log Management      | Admin: VIEW = FALSE, MANAGE=FALSE | Admin: DELETE & CLEAR PERMITTED   |
| (/manajemen/riwayat-akt.) | Module hidden from menu           | DELETE /api/audit, POST /clear    |
+---------------------------+-----------------------------------+-----------------------------------+
| User Management           | Admin: VIEW = FALSE, MANAGE=FALSE | Admin: FULL MUTATION ACCESS       |
| (/manajemen/pengguna)     | Module hidden from menu           | POST, PUT, DELETE, reset-password |
+---------------------------+-----------------------------------+-----------------------------------+
| Order Deletion            | Finance: VIEW = TRUE, MANAGE=FALSE| Finance: HARD DELETE PERMITTED    |
| (DELETE /api/orders/:no)  | No delete button in UI            | requireRoles("..., finance")      |
+---------------------------+-----------------------------------+-----------------------------------+
| Order Mutation            | Finance: MANAGE = FALSE           | Finance: UNRESTRICTED PUT         |
| (PUT /api/orders/:no)     | Read-only Tracking in UI          | No field restrictions in service  |
+---------------------------+-----------------------------------+-----------------------------------+
| Payment Methods Master    | Finance: VIEW = FALSE, MANAGE=FALSE| Finance: FULL MUTATION PERMITTED |
| (/master-data/metode-pemb)| Hidden in menu                    | POST, PUT, DELETE permitted       |
+---------------------------+-----------------------------------+-----------------------------------+
| Dynamic Permission Matrix | Modifiable in UI for non-SVP      | COMPLETELY IGNORED by backend     |
| (role_permissions table)  | Drives UI visibility              | Express uses hardcoded middleware |
+---------------------------+-----------------------------------+-----------------------------------+
```

---

## 5. ACCESS CONTROL GAP REGISTER

### Summary of Identified Gaps

| Gap ID | Title | Severity | Impacted Component | Vulnerability Class |
|:---|:---|:---|:---|:---|
| **GAP-RBAC-01** | Audit Log Deletion Bypass via Route BaseURL Mismatch and Clear Endpoints | **CRITICAL** | `auditRoutes.ts`, `app.ts` | Privilege Escalation / Log Tampering |
| **GAP-RBAC-02** | Privilege Escalation via Fallback to Admin for Unknown/Empty Jabatan | **CRITICAL** | `authService.ts` | Default Insecure Privilege Assignment |
| **GAP-RBAC-03** | Desynchronization Between `users.role`, `users.jabatan`, and Token `role` | **HIGH** | `authService.ts`, `dbUserRepository.ts` | Identity State Confusion |
| **GAP-RBAC-04** | Unauthorized Operational Order Hard-Deletion by Finance and Admin Roles | **HIGH** | `orderRoutes.ts`, `orderService.ts` | Excessive Privilege / Data Destruction |
| **GAP-RBAC-05** | Missing Courier Scoping on Global Order Listing (`GET /api/orders`) | **HIGH** | `orderRoutes.ts`, `orderController.ts`| BOLA / Unauthorized PII Disclosure |
| **GAP-RBAC-06** | Stage 6 Supervisor Authority Bypass via Rollback from Stage 7/8 | **HIGH** | `orderRoutes.ts`, `auth.ts`, `orderService.ts` | Workflow Governance Violation |
| **GAP-RBAC-07** | Unrestricted Mutation via `PUT /api/orders/:orderNo` for Finance Role | **HIGH** | `orderRoutes.ts`, `orderService.ts` | Data Integrity Violation |
| **GAP-RBAC-08** | Admin Exposure to Confidential Financial P&L and Profit Endpoints | **HIGH** | `financeRoutes.ts` | Sensitive Data Exposure |
| **GAP-RBAC-09** | Orphan and Phantom Roles (`supervisor`, `spv`, `staff`) in Route Middleware | **MEDIUM** | `financeRoutes.ts`, `orderRoutes.ts`, `messengerRoutes.ts` | Broken Access Control Configuration |
| **GAP-RBAC-10** | Permanent Physical Deletion of Cash Ledger Entries by Finance Role | **MEDIUM** | `financeRoutes.ts`, `financeController.ts` | Accounting Integrity Violation |
| **GAP-RBAC-11** | Dynamic `role_permissions` Table Ignored by Backend Middleware | **MEDIUM** | `auth.ts`, `dbPermissionRepository.ts` | Architectural Illusion of Control |
| **GAP-RBAC-12** | Anonymous Access Permitted to Estimation Templates | **LOW** | `estimationRoutes.ts` | Information Disclosure |
| **GAP-RBAC-13** | Master Payment Methods CRUD Allowed for Finance Role on Backend | **LOW** | `paymentMethodRoutes.ts` | Discrepancy with Frontend Policy |
| **GAP-RBAC-14** | Hardcoded Courier Name-Based Identity Fallback in Frontend Shell | **LOW** | `src/app/App.tsx` | Fragile Identity Resolution |

---

### Detailed Gap Profiles

#### GAP-RBAC-01: Audit Log Deletion Bypass via Route BaseURL Mismatch and Clear Endpoints
- **Severity:** **CRITICAL**
- **Affected Files:** `server/src/routes/auditRoutes.ts:31-48`, `server/src/app.ts:40-41`
- **Root Cause:**
  `auditRouter.delete("/")` inspects `req.baseUrl?.includes("audit-logs")`. In `app.ts`, the router is mounted twice:
  ```typescript
  app.use("/api/audit-logs", auditRouter);
  app.use("/api/audit", auditRouter);
  ```
  When an admin issues `DELETE /api/audit`, `req.baseUrl` is `"/api/audit"` (which does not contain `"audit-logs"`). It falls back to `requireRoles("administrator", "svp", "admin")`, successfully deleting all audit logs. Furthermore, `POST /clear` on both paths explicitly allows `admin`.
- **Exploit Scenario:** An admin user who commits unauthorized modifications can clear the audit trail by executing `DELETE /api/audit` or `POST /api/audit/clear` using their JWT token.
- **Recommended Remediation:**
  1. Remove `admin` from `requireRoles` on `auditRouter.delete("/")` and `auditRouter.post("/clear")`.
  2. Restrict audit log deletion strictly to `administrator` / `SVP` across all mounted routes, or prohibit log clearing entirely in production.

#### GAP-RBAC-02: Privilege Escalation via Fallback to Admin for Unknown/Empty Jabatan
- **Severity:** **CRITICAL**
- **Affected Files:** `server/src/services/authService.ts:108-115`
- **Root Cause:**
  ```typescript
  const roleMap: Record<string, 'administrator' | 'finance' | 'admin' | 'messenger'> = {
    SVP: "administrator",
    ADMIN: "admin",
    FINANCE: "finance",
    MESSENGER: "messenger",
  };
  const role = roleMap[userEntity.jabatan] || "admin";
  ```
  If a user has a blank, null, lowercase, or non-standard `jabatan` (e.g. `"Staff"`, `"Operator"`, `"Magang"`), the code assigns them `role = "admin"`.
- **Exploit Scenario:** A low-privilege user provisioned with an informal job title logs in and receives an administrative token with full access to user management, pricing, and system configuration.
- **Recommended Remediation:**
  Do not default to `"admin"`. If `userEntity.jabatan` is not in `roleMap`, either throw `ApiError(403, "UNASSIGNED_ROLE", "Akun belum memiliki peran yang valid.")` or assign a non-privileged guest role.

#### GAP-RBAC-03: Desynchronization Between `users.role`, `users.jabatan`, and Token `role`
- **Severity:** **HIGH**
- **Affected Files:** `server/src/services/authService.ts:167-173`, `server/src/repositories/dbUserRepository.ts:72, 233`
- **Root Cause:**
  The `users` table contains both `jabatan` and `role`. `authService.login` uses `jabatan` to determine token `role`. However, `dbUserRepository.createUser` defaults `role` to `"admin"` in SQLite when not provided. Additionally, `authService.getMe` spreads DB fields over the token payload, causing `users.role` (`"svp"`) to overwrite token `role` (`"administrator"`).
- **Recommended Remediation:**
  Normalize the schema: deprecate `users.role` in favor of canonical `users.jabatan`, or ensure `users.role` and `users.jabatan` are synchronized on every create/update operation.

#### GAP-RBAC-04: Unauthorized Operational Order Hard-Deletion by Finance and Admin Roles
- **Severity:** **HIGH**
- **Affected Files:** `server/src/routes/orderRoutes.ts:119-124`, `server/src/services/orderService.ts:1820-1840`
- **Root Cause:**
  `orderRouter.delete("/:orderNo", requireAuth, requireRoles("administrator", "admin", "finance", "svp"), hardDeleteOrder)` gives `finance` and `admin` the ability to permanently erase orders from the operational database.
- **Recommended Remediation:**
  Restrict `DELETE /api/orders/:orderNo` to `requireRoles("administrator", "svp")`. Finance must never have deletion rights over operational orders.

#### GAP-RBAC-05: Missing Courier Scoping on Global Order Listing (`GET /api/orders`)
- **Severity:** **HIGH**
- **Affected Files:** `server/src/routes/orderRoutes.ts:48`, `server/src/controllers/orderController.ts:13-53`
- **Root Cause:**
  `orderRouter.get("/", requireAuth, getOrders)` enforces authentication but no role gating or caller scoping. A courier holding a valid `messenger` token can call `GET /api/orders` and retrieve all orders in the system.
- **Recommended Remediation:**
  Add caller scoping in `orderController.getOrders`: if `req.user.role === "messenger"`, automatically filter orders by the courier's verified `employeeId`, or restrict `GET /api/orders` to `requireRoles("administrator", "admin", "finance", "svp")` and mandate that messengers use `/api/messenger/*`.

#### GAP-RBAC-06: Stage 6 Supervisor Authority Bypass via Rollback from Stage 7/8
- **Severity:** **HIGH**
- **Affected Files:** `server/src/routes/orderRoutes.ts:98`, `server/src/middleware/auth.ts:193-214`, `server/src/services/orderService.ts:1730-1785`
- **Root Cause:**
  `requireStageAuthority` checks `if (currentStageName === "Supervisi" || req.params?.stage === "Supervisi")` to block Admin. If an order has progressed past Stage 6 into Stage 7 (Pengantaran) or Stage 8 (Diterima), an Admin can execute a rollback to Stage 1. This rolls back the order and wipes Stage 6 supervisor approval without Supervisor authorization.
- **Recommended Remediation:**
  Update `requireStageAuthority` so that if an order has passed Stage 6 (`currentStep > 6`), an Admin cannot roll back to a step prior to Stage 6 (`targetStep <= 6`) without Supervisor / SVP authority.

#### GAP-RBAC-07: Unrestricted Mutation via `PUT /api/orders/:orderNo` for Finance Role
- **Severity:** **HIGH**
- **Affected Files:** `server/src/routes/orderRoutes.ts:62-67`, `server/src/services/orderService.ts:1062-1118`
- **Root Cause:**
  `orderService.updateOrder` contains a role whitelist for `messenger`, but no field filtering for `finance`. A user with the `finance` role can modify any order field (including customer, vehicle, status, and stages) directly via PUT.
- **Recommended Remediation:**
  Remove `finance` from `requireRoles` on `PUT /api/orders/:orderNo`, or enforce field scoping so Finance can only modify financial/billing reconciliation fields.

#### GAP-RBAC-08: Admin Exposure to Confidential Financial P&L and Profit Endpoints
- **Severity:** **HIGH**
- **Affected Files:** `server/src/routes/financeRoutes.ts:41-68`
- **Root Cause:**
  Backend endpoints `/api/finance/profit`, `/api/finance/laba-rugi`, `/api/finance/pnl`, `/api/finance/invoices` include `"admin"` in `requireRoles`. Frontend `permissionStore.ts` marks these modules as `view: false` for Admin.
- **Recommended Remediation:**
  Remove `"admin"` from `requireRoles` on these financial reporting endpoints if the business policy dictates that general Admin staff must not access corporate profitability metrics.

#### GAP-RBAC-09: Orphan and Phantom Roles in Backend Middleware
- **Severity:** **MEDIUM**
- **Affected Files:** `financeRoutes.ts:109, 117, 125, 205, 213`, `orderRoutes.ts:143, 150`, `messengerRoutes.ts:81`
- **Root Cause:**
  Backend routes specify `"supervisor"`, `"spv"`, and `"staff"`. These strings do not exist in `roleMap` or `users.role` enum.
- **Recommended Remediation:**
  Formally define canonical roles. If Supervisor is a distinct operational role from Administrator, add `"supervisor"` to `roleMap` and assign it appropriate permissions. Otherwise, replace occurrences of `"supervisor"` and `"spv"` with `"administrator", "svp"`.

#### GAP-RBAC-10: Permanent Physical Deletion of Cash Ledger Entries by Finance Role
- **Severity:** **MEDIUM**
- **Affected Files:** `server/src/routes/financeRoutes.ts:147-152, 171-176`
- **Root Cause:**
  `DELETE /api/finance/kas-kantor/:id` and `DELETE /api/finance/pengeluaran/:id` execute physical SQL `DELETE` queries.
- **Recommended Remediation:**
  Implement voiding/reversal entries with audit logs rather than hard row deletion to comply with accounting standards.

#### GAP-RBAC-11: Dynamic `role_permissions` Table Ignored by Backend Middleware
- **Severity:** **MEDIUM**
- **Affected Files:** `server/src/middleware/auth.ts`, `server/src/repositories/dbPermissionRepository.ts`
- **Root Cause:**
  The backend maintains a `role_permissions` table and provides `/api/permissions` endpoints, but Express middleware never checks this table.
- **Recommended Remediation:**
  Establish whether dynamic RBAC is an intended feature. If yes, integrate dynamic permission lookups into Express middleware. If no, deprecate the dynamic permission editor in the UI and declare static RBAC.

#### GAP-RBAC-12: Anonymous Access Permitted to Estimation Templates
- **Severity:** **LOW**
- **Affected Files:** `server/src/routes/estimationRoutes.ts:19-20`
- **Root Cause:**
  Uses `authenticateToken` instead of `requireAuth`.
- **Recommended Remediation:**
  Replace `authenticateToken` with `requireAuth` to protect estimation templates from unauthenticated scraping.

#### GAP-RBAC-13: Master Payment Methods CRUD Allowed for Finance Role on Backend
- **Severity:** **LOW**
- **Affected Files:** `server/src/routes/paymentMethodRoutes.ts:23-25`
- **Root Cause:**
  Backend permits `finance` to create, update, and delete payment methods, while frontend conceals the entire Master Data module from Finance.
- **Recommended Remediation:**
  Remove `finance` from mutation routes on `paymentMethodRoutes.ts` to align with frontend policy.

#### GAP-RBAC-14: Hardcoded Courier Name-Based Identity Fallback in Frontend Shell
- **Severity:** **LOW**
- **Affected Files:** `src/app/App.tsx:388`
- **Root Cause:**
  Frontend contains fallback: `employeeId || (userName?.toLowerCase().includes("andi") ? 'EMP-0005' : 'EMP-0004')`.
- **Recommended Remediation:**
  Rely exclusively on canonical `employeeId` returned in JWT payload and `/api/auth/me`. If missing, force re-authentication.

---

## 6. BUSINESS DECISION ALIGNMENT (PRE-PHASE 3B)

Before Phase 3B implementation can begin, the following business decisions must be formally approved:

### BD-RBAC-01: Audit Log Security & Deletion Policy
- **Option A (Strict Superadmin Deletion):** Allow only `administrator` / `SVP` to clear audit logs. Remove `admin` from all audit delete and clear endpoints.
- **Option B (Immutable Audit Trail - Recommended):** Permanently remove audit log deletion endpoints. Audit logs become write-only and cannot be cleared by any user, including SVP.

### BD-RBAC-02: Operational Order Deletion Authority
- **Option A (Superadmin Only - Recommended):** Restrict `DELETE /api/orders/:orderNo` strictly to `administrator` / `SVP`. Completely remove deletion access for `admin` and `finance`.
- **Option B (Admin & Superadmin):** Allow `admin` and `administrator`, but strictly prohibit `finance`.

### BD-RBAC-03: Courier Order Visibility Scope
- **Option A (Strict Scoping - Recommended):** Restrict `GET /api/orders` so that if the caller is a courier (`messenger`), they only receive orders assigned to their `employeeId`.
- **Option B (Route Segregation):** Forbid courier access to `GET /api/orders` entirely; couriers must use dedicated `/api/messenger/*` endpoints.

### BD-RBAC-04: Role Architecture & Supervisor Status
- **Option A (4 Canonical Roles):** Formalize the system into 4 roles: `administrator` (SVP), `admin`, `finance`, `messenger`. Replace all phantom occurrences of `supervisor` and `spv` with `administrator`.
- **Option B (5 Canonical Roles):** Formally introduce `supervisor` as a distinct 5th role in `authService.ts` and `permissionStore.ts`, with specific authority over Stage 6 approvals and cost verifications.

### BD-RBAC-05: Admin Financial Reporting Access
- **Option A (Strict Segregation - Recommended):** Align backend with frontend. Remove `admin` from `GET /api/finance/profit`, `GET /api/finance/laba-rugi`, and `GET /api/finance/pnl`.
- **Option B (Admin Transparency):** Retain Admin read access on backend and update frontend `permissionStore.ts` to allow Admin view access to financial reports.

### BD-RBAC-06: Dynamic vs Static RBAC
- **Option A (Static Role Hardcoding - Recommended):** Acknowledge that permissions are governed by canonical role definitions. Retire or lock down `/manajemen/hak-akses` to view-only documentation.
- **Option B (Dynamic Backend Enforcement):** Refactor Express middleware to actively query and enforce permissions stored in `role_permissions` table on every request.

---

## 7. DATA INTEGRITY & AUDIT VERIFICATION BASELINE

During this audit, zero modifications were made to the database, source code, tests, uploads, or configuration.

- **Operational Database:** `server/data/database.sqlite`  
  - Size: `1,441,792 bytes`  
  - SHA-256 Checksum: `898C0C7127D49392D40CA3A6AB73BA16E1F92C67E2C6E8D95EF5D81FEEC7B12C`  
  - Status: **PRISTINE & UNCHANGED**

- **Uploads Directory:** `server/uploads`  
  - Total Files: `51 files`  
  - Total Size: `1,525,984 bytes`  
  - Canonical Combined Manifest SHA-256: `4FD418787BCC18CBA3A55E78E02D87BDCA0372EBAA3BD8C696DB9C5B8C8242E5`  
  - Status: **PRISTINE & UNCHANGED**

---

## 8. STRICT STOP BOUNDARY
Phase 3A is now complete. In accordance with strict instructions:
**DO NOT PROCEED TO PHASE 3B OR IMPLEMENT ANY CODE/DATABASE CHANGES UNTIL BUSINESS DECISIONS BD-RBAC-01 THROUGH BD-RBAC-06 ARE FORMALLY APPROVED.**
