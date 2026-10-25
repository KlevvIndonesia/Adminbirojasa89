/**
 * Orders API Contract Signatures
 * Admin SUN89 — Biro Jasa Management System
 * 
 * NOTE: Future contract interface only. Not called at runtime during Phase 1.
 */

import { ApiResponse, PaginatedResponse } from "../types/common";
import {
  CreateOrderRequest,
  UpdateOrderRequest,
  AdvanceOrderRequest,
  OrderResponse,
  OrderListQuery,
} from "../types/order";

export interface OrdersApiContract {
  getOrders(query?: OrderListQuery): Promise<ApiResponse<PaginatedResponse<OrderResponse>>>;
  getOrder(orderNo: string): Promise<ApiResponse<OrderResponse>>;
  createOrder(payload: CreateOrderRequest): Promise<ApiResponse<OrderResponse>>;
  updateOrder(orderNo: string, payload: UpdateOrderRequest): Promise<ApiResponse<OrderResponse>>;
  advanceOrder(orderNo: string, payload: AdvanceOrderRequest): Promise<ApiResponse<OrderResponse>>;
  rollbackOrder(orderNo: string): Promise<ApiResponse<OrderResponse>>;
  archiveOrder(orderNo: string): Promise<ApiResponse<void>>;
}
