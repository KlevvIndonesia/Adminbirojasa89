/**
 * Service Domain Service
 * Admin SUN89 — Biro Jasa Management System
 */

import { serviceRepository, ServiceEntity } from "../repositories/dbServiceRepository";
import { dbAuditRepository } from "../repositories/dbAuditRepository";
import { ApiError } from "../middleware/errorHandler";
import { TokenPayload } from "../middleware/auth";

export const CANONICAL_SERVICE_IDS = [
  "svc-perp-1th",
  "svc-perp-5th",
  "svc-mut-asal",
  "svc-mut-antar",
  "svc-balik-nama",
  "svc-tarik-berkas",
  "svc-duplikat-stnk",
  "svc-lainnya",
] as const;

export class ServiceService {
  public getAllServices(activeOnly: boolean = false): ServiceEntity[] {
    return activeOnly ? serviceRepository.getActive() : serviceRepository.getAll();
  }

  public getServiceById(id: string): ServiceEntity {
    const service = serviceRepository.getById(id);
    if (!service) {
      throw new ApiError(404, "SERVICE_NOT_FOUND", `Layanan dengan ID '${id}' tidak ditemukan.`);
    }
    return service;
  }

  public updateService(
    id: string,
    payload: {
      nama_layanan?: string;
      deskripsi?: string;
      requirements?: string[];
      status_aktif?: number | boolean;
      urutan?: number;
    },
    user?: TokenPayload | null
  ): ServiceEntity {
    // Enforcement: Pastikan ID layanan adalah salah satu dari 8 layanan resmi
    if (!CANONICAL_SERVICE_IDS.includes(id as any)) {
      throw new ApiError(400, "INVALID_SERVICE_ID", `Layanan '${id}' bukan merupakan layanan resmi yang diizinkan.`);
    }

    const existing = this.getServiceById(id);

    // Enforcement: Nama layanan resmi bersifat tetap (read-only) dan tidak dapat diubah secara bebas
    const lockedNamaLayanan = existing.nama_layanan;

    let cleanRequirements: string[] | undefined = undefined;
    if (payload.requirements !== undefined) {
      if (!Array.isArray(payload.requirements)) {
        throw new ApiError(400, "INVALID_REQUIREMENTS", "Persyaratan dokumen (requirements) harus berupa array of strings.");
      }
      for (const item of payload.requirements) {
        if (typeof item !== "string") {
          throw new ApiError(400, "INVALID_REQUIREMENTS", "Setiap item persyaratan dokumen harus bertipe string.");
        }
      }
      cleanRequirements = payload.requirements
        .map((r) => r.trim())
        .filter((r) => r.length > 0);
    }

    let statusAktifNum: number | undefined = undefined;
    if (payload.status_aktif !== undefined) {
      statusAktifNum = payload.status_aktif === 1 || payload.status_aktif === true ? 1 : 0;
    }

    const updated = serviceRepository.update(id, {
      nama_layanan: lockedNamaLayanan,
      deskripsi: payload.deskripsi,
      requirements: cleanRequirements,
      status_aktif: statusAktifNum,
      urutan: payload.urutan,
    });

    if (!updated) {
      throw new ApiError(500, "UPDATE_FAILED", `Gagal memperbarui data layanan '${id}'.`);
    }

    try {
      dbAuditRepository.save({
        id: `log-svc-upd-${Date.now()}`,
        userId: user?.userId || "usr-admin",
        userName: user?.nama || "Administrator",
        userRole: user?.role || "admin",
        action: "UPDATE",
        module: "Master Layanan",
        createdAt: new Date().toISOString(),
        details: `Memperbarui master layanan '${updated.nama_layanan}' (${id}). Dokumen requirements: ${updated.requirements.length} item.`,
        metadata: {
          serviceId: id,
          oldData: {
            nama_layanan: existing.nama_layanan,
            deskripsi: existing.deskripsi,
            requirements: existing.requirements,
            status_aktif: existing.status_aktif,
          },
          newData: {
            nama_layanan: updated.nama_layanan,
            deskripsi: updated.deskripsi,
            requirements: updated.requirements,
            status_aktif: updated.status_aktif,
          },
        },
      });
    } catch (auditErr) {
      console.warn("[ServiceService] Audit log error:", auditErr);
    }

    return updated;
  }

  public deleteService(id: string, user?: TokenPayload | null): { success: boolean; softDeactivated?: boolean; message?: string } {
    if (CANONICAL_SERVICE_IDS.includes(id as any)) {
      throw new ApiError(400, "CANONICAL_SERVICE_PROTECTED", "Layanan resmi tidak dapat dihapus. Anda hanya dapat menonaktifkan statusnya.");
    }
    this.getServiceById(id);
    const result = serviceRepository.delete(id);

    try {
      dbAuditRepository.save({
        id: `log-svc-del-${Date.now()}`,
        userId: user?.userId || "usr-admin",
        userName: user?.nama || "Administrator",
        userRole: user?.role || "admin",
        action: result.softDeactivated ? "DEACTIVATE" : "DELETE",
        module: "Master Layanan",
        createdAt: new Date().toISOString(),
        details: `${result.softDeactivated ? "Menonaktifkan" : "Menghapus"} master layanan '${id}': ${result.message}`,
        metadata: { serviceId: id, result },
      });
    } catch (auditErr) {
      console.warn("[ServiceService] Audit log error:", auditErr);
    }

    return result;
  }
}

export const serviceService = new ServiceService();
