// What the app needs from photo storage. R2 implements this for real use,
// and an in-memory version implements it for tests, so the rest of the
// app never depends on R2 directly.
export interface PhotoStorage {
  /** Saves the bytes under this key, replacing any file already there. */
  put(key: string, body: Buffer, contentType: string): Promise<void>;

  /** Reads the file, or returns null when there is no file under this key. */
  get(key: string): Promise<Buffer | null>;

  /** Removes the file. Deleting a key that doesn't exist is not an error. */
  delete(key: string): Promise<void>;

  /** A link that shows the file until it expires. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
