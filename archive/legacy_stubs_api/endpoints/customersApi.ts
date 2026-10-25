/**
 * Customers API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse } from "../types/common";
import {
  CustomerDto,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerListQuery,
} from "../types/customer";

export interface CustomersApiContract {
  getCustomers(query?: CustomerListQuery): Promise<ApiResponse<PaginatedResponse<CustomerDto>>>;
  getCustomer(id: string | number): Promise<ApiResponse<CustomerDto>>;
  createCustomer(payload: CreateCustomerRequest): Promise<ApiResponse<CustomerDto>>;
  updateCustomer(id: string | number, payload: UpdateCustomerRequest): Promise<ApiResponse<CustomerDto>>;
  deleteCustomer(id: string | number): Promise<ApiResponse<void>>;
}
