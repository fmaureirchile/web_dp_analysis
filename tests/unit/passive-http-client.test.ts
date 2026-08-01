import { createServer, type RequestListener, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";

import { fetchPassiveSinglePageHtml } from "../../apps/worker-crawler/src/passive-http-client";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        })
    )
  );
});

async function withServer(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("fetchPassiveSinglePageHtml", () => {
  it("descarga HTML cuando el endpoint cumple restricciones", async () => {
    const baseUrl = await withServer((_req, res) => {
      const html = "<html><head><title>sitio a</title></head><body>ok</body></html>";
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(Buffer.byteLength(html))
      });
      res.end(html);
    });

    const result = await fetchPassiveSinglePageHtml({
      executionId: "exec-1",
      entryUrl: `${baseUrl}/ok`
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success result");
    expect(result.data.statusHttp).toBe(200);
    expect(result.data.html).toContain("<title>sitio a</title>");
    expect(result.data.contentType).toContain("text/html");
  });

  it("rechaza respuesta no HTML", async () => {
    const baseUrl = await withServer((_req, res) => {
      const payload = JSON.stringify({ ok: true });
      res.writeHead(200, {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload))
      });
      res.end(payload);
    });

    const result = await fetchPassiveSinglePageHtml({
      executionId: "exec-2",
      entryUrl: `${baseUrl}/json`
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.errorCode).toBe("http_non_html_content");
    expect(result.error.message).toBe("http_non_html_content:content_type_not_allowed");
  });

  it("aplica timeout de red", async () => {
    const baseUrl = await withServer((_req, res) => {
      setTimeout(() => {
        const html = "<html><body>late</body></html>";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
      }, 80);
    });

    const result = await fetchPassiveSinglePageHtml({
      executionId: "exec-3",
      entryUrl: `${baseUrl}/slow`,
      timeoutMs: 25
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.errorCode).toBe("http_timeout");
    expect(result.error.message).toBe("http_timeout:request_timed_out");
  });

  it("bloquea respuesta mayor al limite de bytes", async () => {
    const baseUrl = await withServer((_req, res) => {
      const html = `<html><body>${"x".repeat(256)}</body></html>`;
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(Buffer.byteLength(html))
      });
      res.end(html);
    });

    const result = await fetchPassiveSinglePageHtml({
      executionId: "exec-4",
      entryUrl: `${baseUrl}/big`,
      maxResponseBytes: 64
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.errorCode).toBe("response_size_limit_exceeded");
    expect(result.error.message).toBe("response_size_limit_exceeded:max_response_bytes_exceeded");
  });

  it("rechaza entryUrl invalida", async () => {
    const result = await fetchPassiveSinglePageHtml({
      executionId: "exec-5",
      entryUrl: "ftp://example.com/resource"
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected error result");
    expect(result.error.errorCode).toBe("invalid_entry_url");
    expect(result.error.message).toBe("invalid_entry_url:unsupported_protocol");
  });
});
