/**
 * Local Disk Document Storage Implementation
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Secure persistent filesystem storage adapter with cryptographic naming,
 * strict directory traversal prevention, and SHA-256 hashing.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { IDocumentStorageAdapter, StoredFileResult } from "./documentStorageAdapter";
import { CONFIG } from "../config/env";

export class LocalDiskDocumentStorage implements IDocumentStorageAdapter {
  private readonly uploadDir: string;

  constructor(customUploadDir?: string) {
    this.uploadDir = path.resolve(customUploadDir || CONFIG.UPLOAD_DIR);
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true, mode: 0o750 });
    }
  }

  /**
   * Validates and resolves storageName, preventing path traversal attacks.
   */
  public getFilePath(storageName: string): string {
    if (!storageName || typeof storageName !== "string") {
      throw new Error("Invalid storage filename: name must be a non-empty string.");
    }

    // Disallow path separators, null bytes, or traversal tokens
    if (
      storageName.includes("..") ||
      storageName.includes("/") ||
      storageName.includes("\\") ||
      storageName.includes("\0")
    ) {
      throw new Error("Directory traversal detected: invalid characters in storage name.");
    }

    const resolvedPath = path.resolve(this.uploadDir, storageName);

    // Verify resolved path is strictly within uploadDir
    if (!resolvedPath.startsWith(this.uploadDir + path.sep) && resolvedPath !== this.uploadDir) {
      throw new Error("Security violation: target path lies outside designated upload directory.");
    }

    return resolvedPath;
  }

  public async saveFile(buffer: Buffer, safeExtension: string): Promise<StoredFileResult> {
    this.ensureUploadDir();

    // Sanitize and strictly whitelist extension (e.g. '.pdf', '.png', '.jpg', '.webp')
    const rawExt = safeExtension.startsWith(".")
      ? safeExtension.toLowerCase().replace(/[^a-z0-9.]/g, "")
      : `.${safeExtension.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    const ALLOWED_STORAGE_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);
    if (!ALLOWED_STORAGE_EXTENSIONS.has(rawExt)) {
      throw new Error(`Security violation: Storage extension '${safeExtension}' is not allowed.`);
    }
    const sanitizedExt = rawExt;

    // Cryptographically generated storage name
    const storageName = `${crypto.randomUUID()}${sanitizedExt}`;
    const destinationPath = this.getFilePath(storageName);

    // Compute SHA-256 hash
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Write file atomically to disk
    await fs.promises.writeFile(destinationPath, buffer, { mode: 0o640 });

    return {
      storageName,
      filePath: destinationPath,
      sizeBytes: buffer.length,
      sha256,
    };
  }

  public async readFile(storageName: string): Promise<Buffer> {
    const filePath = this.getFilePath(storageName);
    return await fs.promises.readFile(filePath);
  }

  public getReadStream(storageName: string): Readable {
    const filePath = this.getFilePath(storageName);
    return fs.createReadStream(filePath);
  }

  public async deleteFile(storageName: string): Promise<void> {
    const filePath = this.getFilePath(storageName);
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        console.error(`[LocalDiskDocumentStorage] Error unlinking file at '${filePath}':`, err);
        throw err;
      }
    }
  }

  public async exists(storageName: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(storageName);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }
}

// Default singleton instance using application CONFIG
export const localDiskDocumentStorage = new LocalDiskDocumentStorage();
