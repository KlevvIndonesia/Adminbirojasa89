/**
 * User Repository Interface and Implementation
 * Admin SUN89 — Biro Jasa Management System
 */

import { SystemUser, IUserDataProvider, AuthUserSession, AuthResult, AuthErrorCode } from "../../domain/user/types";
import { ApiUserProvider } from "../api/apiUserProvider";

export type { AuthUserSession, AuthErrorCode, AuthResult };


export interface IUserRepository {
  getAll(): SystemUser[];
  getById(id: number | string): SystemUser | undefined;
  getByEmail(email: string): SystemUser | undefined;
  createUser(user: Omit<SystemUser, "id">): SystemUser;
  updateUser(id: number | string, updates: Partial<SystemUser>): boolean;
  deleteUser(id: number | string): boolean;
  subscribe(listener: () => void): () => void;
  authenticate(email: string, password: string): Promise<AuthUserSession | null>;
  authenticateDetailed(email: string, password: string): Promise<AuthResult>;
  resetPassword?(id: number | string): Promise<{ success: boolean; message?: string }>;
  isLoading?(): boolean;
  getError?(): string | null;
  setProvider?(provider: IUserDataProvider): void;
  getProvider?(): IUserDataProvider;
}

export class UserRepository implements IUserRepository {
  private provider: IUserDataProvider;

  constructor(provider?: IUserDataProvider) {
    this.provider = provider || new ApiUserProvider();
  }

  public setProvider(provider: IUserDataProvider): void {
    this.provider = provider;
  }

  public getProvider(): IUserDataProvider {
    return this.provider;
  }

  public getAll(): SystemUser[] {
    return this.provider.getAll();
  }

  public getById(id: number | string): SystemUser | undefined {
    return this.provider.getById(id);
  }

  public getByEmail(email: string): SystemUser | undefined {
    return this.provider.getByEmail(email);
  }

  public createUser(userData: Omit<SystemUser, "id">): SystemUser {
    return this.provider.createUser(userData);
  }

  public updateUser(id: number | string, updates: Partial<SystemUser>): boolean {
    return this.provider.updateUser(id, updates);
  }

  public deleteUser(id: number | string): boolean {
    return this.provider.deleteUser(id);
  }

  public subscribe(listener: () => void): () => void {
    return this.provider.subscribe(listener);
  }

  public async resetPassword(id: number | string): Promise<{ success: boolean; message?: string }> {
    if (this.provider.resetPassword) {
      return await this.provider.resetPassword(id);
    }
    return { success: true, message: "OK" };
  }

  public async authenticateDetailed(email: string, password: string): Promise<AuthResult> {
    if (typeof this.provider.authenticateDetailed === "function") {
      return await this.provider.authenticateDetailed(email, password);
    }
    const session = await this.provider.authenticate(email, password);
    if (session) {
      return { success: true, session };
    }
    return {
      success: false,
      errorCode: "INVALID_CREDENTIALS",
      errorMessage: "Email atau password yang Anda masukkan tidak sesuai. Periksa kembali data login Anda.",
    };
  }

  public async authenticate(email: string, password: string): Promise<AuthUserSession | null> {
    const res = await this.authenticateDetailed(email, password);
    return res.session || null;
  }

  public isLoading(): boolean {
    return typeof (this.provider as any).isLoading === "function"
      ? (this.provider as any).isLoading()
      : false;
  }

  public getError(): string | null {
    return typeof (this.provider as any).getError === "function"
      ? (this.provider as any).getError()
      : null;
  }
}

export const InMemoryUserRepository = UserRepository;
export const userRepository = new UserRepository();
