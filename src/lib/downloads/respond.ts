import type { PhotoStorage } from "@/lib/storage/types";
import { attachmentDisposition } from "./disposition";

// How long a download link works: long enough for the browser to follow the redirect,
// short enough that a copied link is soon useless (D33).
export const DOWNLOAD_LINK_SECONDS = 60;
const PROBE_TIMEOUT_MS = 3000;
const NOT_FOUND = 404;
const FOUND = 302;
const NO_STORE = { "Cache-Control": "no-store" };
const NO_SNIFF = { "X-Content-Type-Options": "nosniff" };

type Fetcher = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<Response>;

// R2's GetObject documentation lists no response-header override, so ask the link for one
// byte and see whether the answer says "attachment". Any failure counts as "no": the app
// then sends the file itself and the download still works.
export async function linkCarriesAttachment(
  url: string,
  fetcher: Fetcher = fetch,
): Promise<boolean> {
  try {
    const response = await fetcher(url, {
      headers: { Range: "bytes=0-0" },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const disposition = response.headers.get("content-disposition") ?? "";
    await response.body?.cancel().catch(() => undefined);
    return disposition.toLowerCase().startsWith("attachment");
  } catch {
    return false;
  }
}

type DownloadInput = {
  storage: PhotoStorage;
  key: string;
  fileName: string;
  contentType: string;
  probe?: (url: string) => Promise<boolean>;
};

// The response for a download the caller has already checked belongs to the user: a redirect
// to a signed link that saves the file, or the file itself when the link would only show it.
export async function downloadResponse({
  storage,
  key,
  fileName,
  contentType,
  probe = linkCarriesAttachment,
}: DownloadInput): Promise<Response> {
  const contentDisposition = attachmentDisposition(fileName);
  const url = await storage.signedUrl(key, DOWNLOAD_LINK_SECONDS, {
    contentDisposition,
  });
  if (await probe(url)) {
    return new Response(null, {
      status: FOUND,
      headers: { Location: url, ...NO_STORE },
    });
  }
  const body = await storage.get(key);
  if (!body) return new Response("Not found", { status: NOT_FOUND });
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDisposition,
      "Content-Length": String(body.byteLength),
      ...NO_STORE,
      ...NO_SNIFF,
    },
  });
}
