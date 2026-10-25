/**
 * Future API Customer DTOs
 * Admin SUN89 — Biro Jasa Management System
 */

import { Customer } from "../../domain/customer/types";
import { PaginationQuery } from "./common";

export interface CreateCustomerRequest {
  nama: string;
  phone: string;
  email?: string;
  alamat?: string;
  kota?: string;
  kategori?: string;
}

export interface UpdateCustomerRequest {
  nama?: string;
  phone?: string;
  email?: string;
  alamat?: string;
  kota?: string;
  kategori?: string;
}

export interface CustomerListQuery extends PaginationQuery {
  kategori?: string;
}

export type CustomerDto = Customer;
