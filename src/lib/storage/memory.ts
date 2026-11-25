import type { PhotoStorage, PutOptions, SignOptions } from "./types";

// Keeps files in memory instead of R2. Used by tests, so they run offline
// and can check exactly what was saved or deleted.
export class MemoryStorage implements PhotoStorage {
  readonly files = new Map<
    string,
    { body: Buffer; contentType: string; contentDisposition?: string }
  >();

  async put(
    key: string,
    body: Buffer,
    contentType: string,
    options: PutOptions = {},
  ): Promise<void> {
    this.files.set(key, {
      body,
      contentType,
      ...(options.contentDisposition && {
        contentDisposition: options.contentDisposition,
      }),
    });
  }

  async get(key: string): Promise<Buffer | null> {
    return this.files.get(key)?.body ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async signedUrl(
    key: string,
    expiresInSeconds: number,
    options: SignOptions = {},
  ): Promise<string> {
    const disposition = options.contentDisposition
      ? `&disposition=${encodeURIComponent(options.contentDisposition)}`
      : "";
    return `memory://${key}?expires=${expiresInSeconds}${disposition}`;
  }
}
