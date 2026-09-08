import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { validateExternalUrl, type ResolveHostname } from "./ssrfGuard";

const ALLOWED_CONTENT_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "text/html",
  "text/plain",
]);

export interface FetchUrlOptions {
  maxRedirects?: number;
  maxBytes?: number;
  connectTimeoutMs?: number;
  totalTimeoutMs?: number;
  resolver?: ResolveHostname;
  allowedContentTypes?: ReadonlySet<string>;
  userAgent?: string;
}

export interface FetchedUrl {
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Uint8Array;
  text(): string;
}

export class SafeFetchError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export async function fetchUrl(input: string, options: FetchUrlOptions = {}): Promise<FetchedUrl> {
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const connectTimeoutMs = options.connectTimeoutMs ?? 3_000;
  const totalTimeoutMs = options.totalTimeoutMs ?? 8_000;
  const allowedContentTypes = options.allowedContentTypes ?? ALLOWED_CONTENT_TYPES;
  const deadline = Date.now() + totalTimeoutMs;
  let current = input;

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("The request timed out.", "total_timeout");
    let dnsTimer: ReturnType<typeof setTimeout> | undefined;
    const validated = await Promise.race([
      validateExternalUrl(current, options.resolver),
      new Promise<never>((_resolve, reject) => {
        dnsTimer = setTimeout(() => reject(new SafeFetchError("DNS resolution timed out.", "total_timeout")), remaining);
      }),
    ]).finally(() => clearTimeout(dnsTimer));
    const pinned = validated.addresses[0];
    const result = await new Promise<FetchedUrl>((resolve, reject) => {
      const transport = validated.url.protocol === "https:" ? https : http;
      const lookup: LookupFunction = (_hostname, _options, callback) => {
        callback(null, pinned.address, pinned.family);
      };
      const request = transport.request(validated.url, {
        method: "GET",
        headers: {
          Accept: "text/html, application/json;q=0.9, text/plain;q=0.5",
          "Accept-Encoding": "identity",
          "User-Agent": options.userAgent ?? "WatchmarksCaptureBot/2.0 (+https://watchmarks.app)",
        },
        lookup,
      }, (response) => {
        response.once("error", reject);
        response.once("aborted", () => reject(new SafeFetchError("Response interrupted.", "response_aborted")));
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (redirectStatuses.has(status) && location) {
          response.resume();
          resolve({
            url: new URL(location, validated.url).toString(),
            status,
            headers: response.headers,
            body: new Uint8Array(),
            text: () => "",
          });
          return;
        }

        const rawType = String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
        if (!allowedContentTypes.has(rawType)) {
          response.destroy();
          reject(new SafeFetchError("The response content type is not supported.", "content_type"));
          return;
        }
        const declaredLength = Number(response.headers["content-length"] ?? 0);
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          response.destroy();
          reject(new SafeFetchError("The response is too large.", "response_too_large"));
          return;
        }

        const chunks: Buffer[] = [];
        let bytes = 0;
        response.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxBytes) {
            response.destroy(new SafeFetchError("The response is too large.", "response_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({ url: validated.url.toString(), status, headers: response.headers, body, text: () => body.toString("utf8") });
        });
      });

      const totalTimer = setTimeout(() => request.destroy(new SafeFetchError("The request timed out.", "total_timeout")), Math.max(1, deadline - Date.now()));
      request.once("socket", (socket) => {
        const connectTimer = setTimeout(() => request.destroy(new SafeFetchError("The connection timed out.", "connect_timeout")), connectTimeoutMs);
        const connectedEvent = validated.url.protocol === "https:" ? "secureConnect" : "connect";
        socket.once(connectedEvent, () => clearTimeout(connectTimer));
        request.once("close", () => clearTimeout(connectTimer));
      });
      request.once("close", () => clearTimeout(totalTimer));
      request.once("error", reject);
      request.end();
    });

    if (redirectStatuses.has(result.status)) {
      if (redirects === maxRedirects) throw new SafeFetchError("Too many redirects.", "redirect_limit");
      current = result.url;
      continue;
    }
    return result;
  }
  throw new SafeFetchError("Too many redirects.", "redirect_limit");
}

