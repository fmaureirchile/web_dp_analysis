import {
  type BrowserNetworkObservationItemDto,
  type DynamicObservationErrorDto
} from "../../../packages/contracts/src";
import { extractHtmlTitle, fetchPassiveSinglePageHtml } from "../../worker-crawler/src";
import { randomUUID } from "node:crypto";

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
  const network: BrowserNetworkObservationItemDto[] = [
    {
      requestId: randomUUID(),
      pageUrl: input.entryUrl,
      protocol: "FETCH",
      method: "GET",
      url: requestUrl,
      statusHttp: fetched.data.statusHttp,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, requestUrl),
      startedAt,
      finishedAt: fetched.data.fetchedAt
    }
  ];

  return {
    ok: true,
    data: {
      executionId: input.executionId,
      entryUrl: fetched.data.finalUrl,
      completedAt: new Date().toISOString(),
      title,
      domHtml: fetched.data.html,
      screenshotDataUrl,
      network
    }
  };
}
