/**
 * Wilayah & Samsat Office Routes
 * Admin SUN89 — Biro Jasa Management System
 */

import { Router } from "express";
import { wilayahController } from "../controllers/wilayahController";
import { requireAuth, requireRoles } from "../middleware/auth";

export const wilayahRouter = Router();

// Wilayah Administratif Indonesia (38 Provinsi & 514 Kabupaten/Kota)
wilayahRouter.get("/", requireAuth, (req, res) => wilayahController.getWilayahList(req, res));
wilayahRouter.get("/provinces", requireAuth, (req, res) => wilayahController.getProvinces(req, res));
wilayahRouter.get("/:kode", requireAuth, (req, res) => wilayahController.getWilayahByKode(req, res));

// Samsat Offices
export const samsatOfficeRouter = Router();
samsatOfficeRouter.get("/", requireAuth, (req, res) => wilayahController.getSamsatOffices(req, res));
samsatOfficeRouter.post("/", requireAuth, requireRoles("administrator", "admin"), (req, res) =>
  wilayahController.createSamsatOffice(req, res)
);
samsatOfficeRouter.put("/:id", requireAuth, requireRoles("administrator", "admin"), (req, res) =>
  wilayahController.updateSamsatOffice(req, res)
);
samsatOfficeRouter.delete("/:id", requireAuth, requireRoles("administrator", "admin"), (req, res) =>
  wilayahController.deleteSamsatOffice(req, res)
);
