import type { PhotoStorage } from "./types";

// Keeps files in memory instead of R2. Used by tests, so they run offline
// and can check exactly what was saved or deleted.
export class MemoryStorage implements PhotoStorage {
  readonly files = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    this.files.set(key, { body, contentType });
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return `memory://${key}?expires=${expiresInSeconds}`;
  }
}
