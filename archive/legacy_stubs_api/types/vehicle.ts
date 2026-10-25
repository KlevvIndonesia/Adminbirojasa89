/**
 * Future API Vehicle DTOs
 * Admin SUN89 — Biro Jasa Management System
 */

import { Vehicle, SamsatRegion } from "../../domain/vehicle/types";

export interface RegisterVehicleRequest {
  nopol: string;
  namaPemilik: string;
  kepemilikanKendaraan: string;
  jenisKendaraan: string;
  tahunKendaraan: number | string;
  wilayahSamsatAsal: string;
}

export type VehicleDto = Vehicle;
export type SamsatRegionDto = SamsatRegion;
