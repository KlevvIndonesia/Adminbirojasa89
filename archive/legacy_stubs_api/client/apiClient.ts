/**
 * Future API Client Contract
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Strictly a future contract specification.
 * This class DOES NOT execute fetch or axios calls during Phase 1.
 */

import { ApiResponse } from "../types/common";
import { ApiConfig, DEFAULT_API_CONFIG } from "./apiConfig";

export interface IApiClient {
  get<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>>;
  post<T>(url: string, data?: any): Promise<ApiResponse<T>>;
  put<T>(url: string, data?: any): Promise<ApiResponse<T>>;
  patch<T>(url: string, data?: any): Promise<ApiResponse<T>>;
  delete<T>(url: string): Promise<ApiResponse<T>>;
}

export class ContractOnlyApiClient implements IApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig = DEFAULT_API_CONFIG) {
    this.config = config;
  }

  public getConfig(): ApiConfig {
    return this.config;
  }

  async get<T>(_url: string, _params?: Record<string, any>): Promise<ApiResponse<T>> {
    throw new Error(
      "ContractOnlyApiClient: No runtime API calls permitted in Phase 1. Use Repository / In-Memory layer."
    );
  }

  async post<T>(_url: string, _data?: any): Promise<ApiResponse<T>> {
    throw new Error(
      "ContractOnlyApiClient: No runtime API calls permitted in Phase 1. Use Repository / In-Memory layer."
    );
  }

  async put<T>(_url: string, _data?: any): Promise<ApiResponse<T>> {
    throw new Error(
      "ContractOnlyApiClient: No runtime API calls permitted in Phase 1. Use Repository / In-Memory layer."
    );
  }

  async patch<T>(_url: string, _data?: any): Promise<ApiResponse<T>> {
    throw new Error(
      "ContractOnlyApiClient: No runtime API calls permitted in Phase 1. Use Repository / In-Memory layer."
    );
  }

  async delete<T>(_url: string): Promise<ApiResponse<T>> {
    throw new Error(
      "ContractOnlyApiClient: No runtime API calls permitted in Phase 1. Use Repository / In-Memory layer."
    );
  }
}

export const futureApiClient: IApiClient = new ContractOnlyApiClient();
