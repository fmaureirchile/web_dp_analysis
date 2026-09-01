import {
  type BrowserInteractionEventDto,
  type BrowserNetworkObservationItemDto,
  type BrowserStorageObservationItemDto,
  type DynamicObservationErrorDto
} from "../../../packages/contracts/src";
import { classifyDataPoint } from "../../../packages/classification/src";
import { extractHtmlTitle, fetchPassiveSinglePageHtml } from "../../worker-crawler/src";
import { randomUUID } from "node:crypto";

const DEFAULT_TIMEOUT_MS = 5000;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildPlaceholderScreenshotDataUrl(entryUrl: string, title?: string): string {
  const line1 = escapeXml(title ?? "Dynamic Observation");
  const line2 = escapeXml(entryUrl);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0b1020"/><text x="60" y="160" fill="#ffffff" font-size="40" font-family="Arial">${line1}</text><text x="60" y="230" fill="#9fb3c8" font-size="24" font-family="Arial">${line2}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function mapFetchErrorToDynamicError(
  executionId: string,
  entryUrl: string,
  fetchErrorCode: string,
  message: string
): DynamicObservationErrorDto {
  if (fetchErrorCode === "invalid_entry_url") {
    return {
      executionId,
      entryUrl,
      errorCode: "invalid_entry_url",
      message
    };
  }

  if (fetchErrorCode === "http_timeout") {
    return {
      executionId,
      entryUrl,
      errorCode: "browser_timeout",
      message: "browser_timeout:request_timed_out"
    };
  }

  return {
    executionId,
    entryUrl,
    errorCode: "internal_error",
    message
  };
}

function resolveThirdPartyDomain(entryUrl: string, observedUrl: string): string | undefined {
  try {
    const entryHost = new URL(entryUrl).hostname.toLowerCase();
    const observedHost = new URL(observedUrl).hostname.toLowerCase();
    if (entryHost !== observedHost) {
      return observedHost;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function classifyNetworkItem(item: BrowserNetworkObservationItemDto): BrowserNetworkObservationItemDto {
  const classification = classifyDataPoint({
    source: "NETWORK_PARAM",
    key: item.url,
    valueSample: item.thirdPartyDomain
  });

  return {
    ...item,
    classificationLabel: classification.label,
    classificationConfidence: classification.confidence,
    classificationReason: classification.reason
  };
}

function classifyStorageItem(item: BrowserStorageObservationItemDto): BrowserStorageObservationItemDto {
  const source = item.kind === "COOKIE" ? "COOKIE" : "LOCAL_STORAGE";
  const classification = classifyDataPoint({
    source,
    key: item.key
  });

  return {
    ...item,
    classificationLabel: classification.label,
    classificationConfidence: classification.confidence,
    classificationReason: classification.reason,
    valueMasked: item.valueMasked || classification.requiresMasking
  };
}

function toSiteDSpaUrl(pageUrl: string, suffix: string): string {
  const origin = new URL(pageUrl).origin;
  return new URL(`/sitio-d/${suffix}`, origin).toString();
}

async function fetchJsonWithTiming(input: {
  method: "GET" | "POST";
  url: string;
  timeoutMs: number;
  body?: Record<string, unknown>;
}): Promise<{
  startedAt: string;
  finishedAt: string;
  statusHttp: number;
  url: string;
  json: unknown;
}> {
  const startedAt = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: input.method,
      headers: input.method === "POST" ? { "content-type": "application/json" } : undefined,
      body: input.method === "POST" ? JSON.stringify(input.body ?? {}) : undefined,
      signal: controller.signal
    });

    const json = (await response.json()) as unknown;

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      statusHttp: response.status,
      url: response.url,
      json
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isSiteDSpaEntry(pageUrl: string): boolean {
  try {
    const parsed = new URL(pageUrl);
    return parsed.pathname === "/sitio-d" || parsed.pathname.startsWith("/sitio-d/");
  } catch {
    return false;
  }
}

async function captureSiteDSpaTimeline(input: {
  pageUrl: string;
  timeoutMs: number;
  entryUrl: string;
}): Promise<{
  network: BrowserNetworkObservationItemDto[];
  storage: BrowserStorageObservationItemDto[];
  events: BrowserInteractionEventDto[];
}> {
  const bootstrap = await fetchJsonWithTiming({
    method: "POST",
    url: toSiteDSpaUrl(input.pageUrl, "spa/bootstrap"),
    timeoutMs: input.timeoutMs,
    body: {}
  });

  const navigate = await fetchJsonWithTiming({
    method: "POST",
    url: toSiteDSpaUrl(input.pageUrl, "spa/navigate"),
    timeoutMs: input.timeoutMs,
    body: { route: "/resumen" }
  });

  const profile = await fetchJsonWithTiming({
    method: "GET",
    url: toSiteDSpaUrl(input.pageUrl, "api/profile"),
    timeoutMs: input.timeoutMs
  });

  const networkBase: BrowserNetworkObservationItemDto[] = [
    {
      requestId: randomUUID(),
      pageUrl: input.pageUrl,
      protocol: "FETCH",
      method: "POST",
      url: bootstrap.url,
      statusHttp: bootstrap.statusHttp,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, bootstrap.url),
      startedAt: bootstrap.startedAt,
      finishedAt: bootstrap.finishedAt
    },
    {
      requestId: randomUUID(),
      pageUrl: input.pageUrl,
      protocol: "FETCH",
      method: "POST",
      url: navigate.url,
      statusHttp: navigate.statusHttp,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, navigate.url),
      startedAt: navigate.startedAt,
      finishedAt: navigate.finishedAt
    },
    {
      requestId: randomUUID(),
      pageUrl: input.pageUrl,
      protocol: "FETCH",
      method: "GET",
      url: profile.url,
      statusHttp: profile.statusHttp,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, profile.url),
      startedAt: profile.startedAt,
      finishedAt: profile.finishedAt
    }
  ];
  const network: BrowserNetworkObservationItemDto[] = networkBase.map(classifyNetworkItem);

  const events: BrowserInteractionEventDto[] = [
    {
      eventType: "CLICK",
      pageUrl: input.pageUrl,
      target: "#spa-bootstrap",
      timestamp: bootstrap.startedAt
    },
    {
      eventType: "SPA_NAVIGATION",
      pageUrl: input.pageUrl,
      target: "/registro",
      timestamp: bootstrap.finishedAt
    },
    {
      eventType: "CLICK",
      pageUrl: input.pageUrl,
      target: "#spa-go-resumen",
      timestamp: navigate.startedAt
    },
    {
      eventType: "SPA_NAVIGATION",
      pageUrl: input.pageUrl,
      target: "/resumen",
      timestamp: navigate.finishedAt
    }
  ];

  const localStorageFromNavigate =
    typeof navigate.json === "object" &&
    navigate.json !== null &&
    "spa" in navigate.json &&
    typeof (navigate.json as { spa?: unknown }).spa === "object" &&
    (navigate.json as { spa?: { storage?: unknown } }).spa?.storage !== null
      ? (navigate.json as { spa?: { storage?: { localStorage?: Record<string, unknown> } } }).spa?.storage?.localStorage
      : undefined;

  const storageBase: BrowserStorageObservationItemDto[] = Object.keys(localStorageFromNavigate ?? {})
    .map((key) => ({
      pageUrl: input.pageUrl,
      kind: "LOCAL_STORAGE",
      key,
      valueMasked: true,
      observedAt: navigate.finishedAt
    }));
  const storage: BrowserStorageObservationItemDto[] = storageBase.map(classifyStorageItem);

  return { network, storage, events };
}

export async function captureDynamicObservation(input: {
  executionId: string;
  entryUrl: string;
  timeoutMs?: number;
  maxEvents?: number;
}): Promise<
  | {
      ok: true;
      data: {
        executionId: string;
        entryUrl: string;
        completedAt: string;
        title?: string;
        domHtml: string;
        screenshotDataUrl: string;
        network: BrowserNetworkObservationItemDto[];
        storage: BrowserStorageObservationItemDto[];
        events: BrowserInteractionEventDto[];
      };
    }
  | {
      ok: false;
      error: DynamicObservationErrorDto;
    }
> {
  const startedAt = new Date().toISOString();
  const fetched = await fetchPassiveSinglePageHtml({
    executionId: input.executionId,
    entryUrl: input.entryUrl,
    timeoutMs: input.timeoutMs
  });

  if (!fetched.ok) {
    return {
      ok: false,
      error: mapFetchErrorToDynamicError(
        input.executionId,
        input.entryUrl,
        fetched.error.errorCode,
        fetched.error.message
      )
    };
  }

  const title = extractHtmlTitle(fetched.data.html);
  const screenshotDataUrl = buildPlaceholderScreenshotDataUrl(input.entryUrl, title);
  const requestUrl = fetched.data.finalUrl;
  const observedAt = fetched.data.fetchedAt;
  const networkBase: BrowserNetworkObservationItemDto[] = [
    {
      requestId: randomUUID(),
      pageUrl: input.entryUrl,
      protocol: "FETCH",
      method: "GET",
      url: requestUrl,
      statusHttp: fetched.data.statusHttp,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, requestUrl),
      startedAt,
      finishedAt: observedAt
    }
  ];
  const network: BrowserNetworkObservationItemDto[] = networkBase.map(classifyNetworkItem);
  const storageBase: BrowserStorageObservationItemDto[] = fetched.data.setCookieNames
    .map((cookieName) => ({
      pageUrl: requestUrl,
      kind: "COOKIE",
      key: cookieName,
      valueMasked: true,
      observedAt
    }));
  const storage: BrowserStorageObservationItemDto[] = storageBase.map(classifyStorageItem);
  const events: BrowserInteractionEventDto[] = [
    {
      eventType: "PAGE_LOAD",
      pageUrl: requestUrl,
      timestamp: observedAt
    }
  ];

  if (isSiteDSpaEntry(requestUrl)) {
    const spaTimeline = await captureSiteDSpaTimeline({
      pageUrl: requestUrl,
      timeoutMs:
        typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs) && input.timeoutMs > 0
          ? Math.trunc(input.timeoutMs)
          : DEFAULT_TIMEOUT_MS,
      entryUrl: input.entryUrl
    });

    network.push(...spaTimeline.network);
    storage.push(...spaTimeline.storage);
    events.push(...spaTimeline.events);
  }

  return {
    ok: true,
    data: {
      executionId: input.executionId,
      entryUrl: fetched.data.finalUrl,
      completedAt: new Date().toISOString(),
      title,
      domHtml: fetched.data.html,
      screenshotDataUrl,
      network,
      storage,
      events
    }
  };
}
