import {
  type PassiveSinglePageCrawlErrorCode,
  type PassiveSinglePageCrawlErrorDto,
  type StartPassiveSinglePageCrawlDto
} from "../../../packages/contracts/src";

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RESPONSE_BYTES = 1024 * 1024;

const HTML_CONTENT_TYPES = ["text/html", "application/xhtml+xml"];

const ERROR_MESSAGE_INVALID_ENTRY_URL = "invalid_entry_url:unsupported_protocol";
const ERROR_MESSAGE_TIMEOUT = "http_timeout:request_timed_out";
const ERROR_MESSAGE_NON_HTML_CONTENT = "http_non_html_content:content_type_not_allowed";
const ERROR_MESSAGE_SIZE_LIMIT = "response_size_limit_exceeded:max_response_bytes_exceeded";
const ERROR_MESSAGE_FETCH_FAILED = "http_fetch_failed:network_failure";

export interface PassiveHttpFetchSuccess {
  executionId: string;
  entryUrl: string;
  finalUrl: string;
  redirected: boolean;
  setCookieNames: string[];
  statusHttp: number;
  fetchedAt: string;
  contentType?: string;
  contentLength?: number;
  html: string;
}

export type PassiveHttpFetchResult =
  | {
      ok: true;
      data: PassiveHttpFetchSuccess;
    }
  | {
      ok: false;
      error: PassiveSinglePageCrawlErrorDto;
    };

function toError(
  request: StartPassiveSinglePageCrawlDto,
  errorCode: PassiveSinglePageCrawlErrorCode,
  message: string
): PassiveHttpFetchResult {
  return {
    ok: false,
    error: {
      executionId: request.executionId,
      entryUrl: request.entryUrl,
      errorCode,
      message
    }
  };
}

function normalizeLimits(request: StartPassiveSinglePageCrawlDto): {
  timeoutMs: number;
  maxResponseBytes: number;
} {
  const timeoutMs =
    typeof request.timeoutMs === "number" && Number.isFinite(request.timeoutMs) && request.timeoutMs > 0
      ? Math.trunc(request.timeoutMs)
      : DEFAULT_TIMEOUT_MS;

  const maxResponseBytes =
    typeof request.maxResponseBytes === "number" && Number.isFinite(request.maxResponseBytes) && request.maxResponseBytes > 0
      ? Math.trunc(request.maxResponseBytes)
      : DEFAULT_MAX_RESPONSE_BYTES;

  return { timeoutMs, maxResponseBytes };
}

function isSupportedEntryUrl(entryUrl: string): boolean {
  try {
    const url = new URL(entryUrl);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return HTML_CONTENT_TYPES.some((candidate) => normalized.includes(candidate));
}

function extractSetCookieNames(headers: Headers): string[] {
  const fromGetSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const rawSetCookies =
    typeof fromGetSetCookie === "function"
      ? fromGetSetCookie.call(headers)
      : (() => {
          const single = headers.get("set-cookie");
          return single ? [single] : [];
        })();

  return Array.from(
    new Set(
      rawSetCookies
        .map((raw) => raw.split(";")[0]?.trim() ?? "")
        .map((pair) => {
          const equalsAt = pair.indexOf("=");
          return equalsAt > 0 ? pair.slice(0, equalsAt).trim() : "";
        })
        .filter((name) => name.length > 0)
    )
  );
}

async function readBodyWithLimit(response: Response, maxResponseBytes: number): Promise<Uint8Array> {
  const stream = response.body;
  if (!stream) {
    return new Uint8Array();
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const chunk = value ?? new Uint8Array();
    totalBytes += chunk.byteLength;

    if (totalBytes > maxResponseBytes) {
      throw new Error("response_size_limit_exceeded");
    }

    chunks.push(chunk);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
}

export async function fetchPassiveSinglePageHtml(request: StartPassiveSinglePageCrawlDto): Promise<PassiveHttpFetchResult> {
  if (!isSupportedEntryUrl(request.entryUrl)) {
    return toError(request, "invalid_entry_url", ERROR_MESSAGE_INVALID_ENTRY_URL);
  }

  const { timeoutMs, maxResponseBytes } = normalizeLimits(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request.entryUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml"
      }
    });

    const contentType = response.headers.get("content-type");
    if (!isHtmlContentType(contentType)) {
      return toError(request, "http_non_html_content", ERROR_MESSAGE_NON_HTML_CONTENT);
    }

    const contentLengthHeader = response.headers.get("content-length");
    const parsedContentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

    if (typeof parsedContentLength === "number" && Number.isFinite(parsedContentLength) && parsedContentLength > maxResponseBytes) {
      return toError(request, "response_size_limit_exceeded", ERROR_MESSAGE_SIZE_LIMIT);
    }

    const bodyBytes = await readBodyWithLimit(response, maxResponseBytes);
    const html = new TextDecoder().decode(bodyBytes);

    return {
      ok: true,
      data: {
        executionId: request.executionId,
        entryUrl: request.entryUrl,
        finalUrl: response.url,
        redirected: response.redirected,
        setCookieNames: extractSetCookieNames(response.headers),
        statusHttp: response.status,
        fetchedAt: new Date().toISOString(),
        contentType: contentType ?? undefined,
        contentLength: Number.isFinite(parsedContentLength) ? parsedContentLength : bodyBytes.byteLength,
        html
      }
    };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return toError(request, "http_timeout", ERROR_MESSAGE_TIMEOUT);
    }

    if ((error as Error).message === "response_size_limit_exceeded") {
      return toError(request, "response_size_limit_exceeded", ERROR_MESSAGE_SIZE_LIMIT);
    }

    return toError(request, "http_fetch_failed", ERROR_MESSAGE_FETCH_FAILED);
  } finally {
    clearTimeout(timeout);
  }
}
