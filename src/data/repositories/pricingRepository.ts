/**
 * Pricing Repository Interface and Implementation
 * Admin SUN89 — Biro Jasa Management System
 */

import {
  SamsatCostItem,
  ServicePackageConfig,
  OrderCostSnapshot,
} from "../../domain/pricing/types";
import { pricingStore } from "../../app/data/pricingStore";
import { mockPricingProvider, IPricingDataProvider } from "../mock/mockPricingProvider";
import { ApiPricingProvider } from "../api/apiPricingProvider";

export interface IPricingRepository {
  getSamsatItems(): SamsatCostItem[];
  getSamsatItemById(id: string): SamsatCostItem | undefined;
  updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): Promise<boolean> | boolean;
  addSamsatItem(item: Omit<SamsatCostItem, "id">): SamsatCostItem;
  getServiceConfigs?(): any[];
  getSamsatOffices?(): any[];
  getAvailableServices?(): string[];
  updateServicePricing?(id: string, config: any): Promise<boolean> | boolean;
  createServicePricing?(config: any): Promise<any> | any;
  deleteServicePricing?(id: string): Promise<boolean> | boolean;
  getServicePackages(): Record<string, ServicePackageConfig>;
  getServicePackage(serviceNameOrId: string): ServicePackageConfig | undefined;
  updateServicePackage(serviceNameOrId: string, updates: Partial<ServicePackageConfig>): boolean;
  calculateOrderCost(params: {
    serviceName?: string;
    serviceId?: string;
    samsatId?: string;
    wilayahSamsat?: string;
    metodeLayanan: "Antar Jemput" | "Datang Langsung";
    pkb?: number;
    swdkllj?: number;
    dendaSwdkllj?: number;
    customComponents?: Record<string, boolean>;
    customItemToggles?: Record<string, boolean>;
  }): OrderCostSnapshot;
  subscribe(listener: () => void): () => void;
  setProvider?(provider: IPricingDataProvider): void;
  getProvider?(): IPricingDataProvider;
  isLoading?(): boolean;
  getError?(): Error | null;
  initFromApi?(): Promise<void>;
  getSamsatOperationalTariffs?(samsatId?: string): Promise<any[]>;
  updateSamsatOperationalTariff?(samsatId: string, itemKey: string, payload: any): Promise<any>;
  updateSamsatOperationalTariffsBatch?(samsatId: string, tariffs: any[]): Promise<any>;
  deleteSamsatOperationalTariff?(idOrParams: string | { samsatId: string; pricingItemId: string }): Promise<boolean>;
  batchReplicateServicePricing?(params: any): Promise<any>;
}

export class PricingRepository implements IPricingRepository {
  private provider: IPricingDataProvider;

  constructor(provider?: IPricingDataProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      const isApi = (typeof process !== "undefined" && process.env?.APP_DATA_PROVIDER === "api") ||
                    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_APP_DATA_PROVIDER === "api");
      this.provider = isApi ? new ApiPricingProvider() : mockPricingProvider;
    }
  }

  public setProvider(provider: IPricingDataProvider): void {
    this.provider = provider;
  }

  public getProvider(): IPricingDataProvider {
    return this.provider;
  }

  getSamsatItems(): SamsatCostItem[] {
    return this.provider.getSamsatItems();
  }

  getSamsatItemById(id: string): SamsatCostItem | undefined {
    return this.provider.getSamsatItemById(id);
  }

  updateSamsatItem(id: string, updates: Partial<SamsatCostItem>): Promise<boolean> | boolean {
    return this.provider.updateSamsatItem(id, updates);
  }

  addSamsatItem(item: Omit<SamsatCostItem, "id">): SamsatCostItem {
    return this.provider.addSamsatItem(item);
  }

  getServiceConfigs(): any[] {
    return this.provider.getServiceConfigs ? this.provider.getServiceConfigs() : [];
  }

  getSamsatOffices(): any[] {
    return this.provider.getSamsatOffices ? this.provider.getSamsatOffices() : [];
  }

  getAvailableServices(): string[] {
    return pricingStore.getAvailableServices();
  }

  async updateServicePricing(id: string, config: any): Promise<boolean> {
    if (this.provider.updateServicePricing) {
      return await this.provider.updateServicePricing(id, config);
    }
    return false;
  }

  async createServicePricing(config: any): Promise<any> {
    if (this.provider.createServicePricing) {
      return await this.provider.createServicePricing(config);
    }
    return null;
  }

  async deleteServicePricing(id: string): Promise<boolean> {
    if (this.provider.deleteServicePricing) {
      return await this.provider.deleteServicePricing(id);
    }
    return true;
  }

  async createSamsatOffice(office: any): Promise<any> {
    if (this.provider.createSamsatOffice) {
      return await this.provider.createSamsatOffice(office);
    }
    return office;
  }

  async updateSamsatOffice(id: string, updates: any): Promise<boolean> {
    if (this.provider.updateSamsatOffice) {
      return await this.provider.updateSamsatOffice(id, updates);
    }
    return true;
  }

  async deleteSamsatOffice(id: string): Promise<boolean> {
    if (this.provider.deleteSamsatOffice) {
      return await this.provider.deleteSamsatOffice(id);
    }
    return true;
  }

  async batchReplicateServicePricing(params: any): Promise<any> {
    if (this.provider.batchReplicateServicePricing) {
      return await this.provider.batchReplicateServicePricing(params);
    }
    return null;
  }

  getServicePackages(): Record<string, ServicePackageConfig> {
    return pricingStore.getServicePackages();
  }

  getServicePackage(serviceNameOrId: string): ServicePackageConfig | undefined {
    return pricingStore.getServicePackage(serviceNameOrId);
  }

  updateServicePackage(serviceNameOrId: string, updates: Partial<ServicePackageConfig>): boolean {
    return pricingStore.updateServicePackage(serviceNameOrId, updates);
  }

  calculateOrderCost(params: any): OrderCostSnapshot {
    return pricingStore.calculateOrderCost(params);
  }

  subscribe(listener: () => void): () => void {
    return this.provider.subscribe(listener);
  }

  public isLoading(): boolean {
    return this.provider.isLoading ? this.provider.isLoading() : false;
  }

  public getError(): Error | null {
    return this.provider.getError ? this.provider.getError() : null;
  }

  public async initFromApi(): Promise<void> {
    if (this.provider && typeof (this.provider as any).initFromApi === "function") {
      await (this.provider as any).initFromApi();
    }
  }

  public async getSamsatOperationalTariffs(samsatId?: string): Promise<any[]> {
    if (this.provider.getSamsatOperationalTariffs) {
      return await this.provider.getSamsatOperationalTariffs(samsatId);
    }
    return [];
  }

  public async updateSamsatOperationalTariff(samsatId: string, itemKey: string, payload: any): Promise<any> {
    if (this.provider.updateSamsatOperationalTariff) {
      return await this.provider.updateSamsatOperationalTariff(samsatId, itemKey, payload);
    }
    return null;
  }

  public async updateSamsatOperationalTariffsBatch(samsatId: string, tariffs: any[]): Promise<any> {
    if (this.provider.updateSamsatOperationalTariffsBatch) {
      return await this.provider.updateSamsatOperationalTariffsBatch(samsatId, tariffs);
    }
    return null;
  }

  public async deleteSamsatOperationalTariff(idOrParams: string | { samsatId: string; pricingItemId: string }): Promise<boolean> {
    if (this.provider.deleteSamsatOperationalTariff) {
      return await this.provider.deleteSamsatOperationalTariff(idOrParams);
    }
    return true;
  }
}

export const InMemoryPricingRepository = PricingRepository;
export const pricingRepository = new PricingRepository();
