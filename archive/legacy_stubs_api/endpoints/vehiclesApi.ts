/**
 * Vehicles API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse } from "../types/common";
import { VehicleDto, RegisterVehicleRequest, SamsatRegionDto } from "../types/vehicle";
import { PaginationQuery } from "../types/common";

export interface VehiclesApiContract {
  getVehicles(query?: PaginationQuery): Promise<ApiResponse<PaginatedResponse<VehicleDto>>>;
  getVehicleByNopol(nopol: string): Promise<ApiResponse<VehicleDto>>;
  registerVehicle(payload: RegisterVehicleRequest): Promise<ApiResponse<VehicleDto>>;
  getSamsatRegions(): Promise<ApiResponse<SamsatRegionDto[]>>;
}
