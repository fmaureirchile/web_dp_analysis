import { createServer, type RequestListener, type Server } from "node:http";
import { AddressInfo } from "node:net";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { app } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";

const servers: Server[] = [];

beforeEach(() => {
  resetStore();
});

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

async function getUnusedLocalBaseUrl(): Promise<string> {
  const server = createServer((_req, res) => {
    res.writeHead(204);
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", (error?: Error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  return baseUrl;
}

function isoNowPlus(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function setupExecution(baseUrl: string): Promise<{ executionId: string }> {
  const org = await request(app).post("/api/v1/organizations").send({ name: "Org T04 Errors" });
  const project = await request(app).post("/api/v1/projects").send({ organizationId: org.body.data.id, name: "Project T04 Errors" });

  const authorization = await request(app)
    .post("/api/v1/authorizations")
    .send({
      projectId: project.body.data.id,
      validFrom: isoNowPlus(-60),
      validTo: isoNowPlus(60),
      allowedDomains: ["127.0.0.1"],
      allowSubdomains: false,
      permittedOperations: ["SCAN_PASSIVE"]
    });

  const target = await request(app)
    .post("/api/v1/targets")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      baseUrl: `${baseUrl}/base`
    });

  const execution = await request(app)
    .post("/api/v1/executions")
    .send({
      projectId: project.body.data.id,
      authorizationId: authorization.body.data.id,
      targetId: target.body.data.id,
      state: "VALIDATED",
      operation: "SCAN_PASSIVE",
      entryUrl: `${baseUrl}/base`
    });

  return { executionId: execution.body.data.id as string };
}

describe("Etapa 5.2 T04 errores fetch deterministas", () => {
  it("timeout devuelve error determinista y resultado persistido", async () => {
    const baseUrl = await withServer((_req, res) => {
      setTimeout(() => {
        const html = "<html><body>late</body></html>";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
      }, 120);
    });

    const { executionId } = await setupExecution(baseUrl);

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${baseUrl}/slow`,
        timeoutMs: 25
      });

    expect(run.status).toBe(422);
    expect(run.body.errorCode).toBe("http_timeout");
    expect(run.body.message).toBe("http_timeout:request_timed_out");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.errorCode).toBe("http_timeout");
    expect(result.body.error.message).toBe("http_timeout:request_timed_out");
  });

  it("non-html devuelve error determinista y resultado persistido", async () => {
    const baseUrl = await withServer((_req, res) => {
      const payload = JSON.stringify({ ok: true });
      res.writeHead(200, {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload))
      });
      res.end(payload);
    });

    const { executionId } = await setupExecution(baseUrl);

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${baseUrl}/json`
      });

    expect(run.status).toBe(422);
    expect(run.body.errorCode).toBe("http_non_html_content");
    expect(run.body.message).toBe("http_non_html_content:content_type_not_allowed");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.errorCode).toBe("http_non_html_content");
    expect(result.body.error.message).toBe("http_non_html_content:content_type_not_allowed");
  });

  it("size-limit devuelve error determinista y resultado persistido", async () => {
    const baseUrl = await withServer((_req, res) => {
      const html = `<html><body>${"x".repeat(2048)}</body></html>`;
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": String(Buffer.byteLength(html))
      });
      res.end(html);
    });

    const { executionId } = await setupExecution(baseUrl);

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${baseUrl}/big`,
        maxResponseBytes: 64
      });

    expect(run.status).toBe(422);
    expect(run.body.errorCode).toBe("response_size_limit_exceeded");
    expect(run.body.message).toBe("response_size_limit_exceeded:max_response_bytes_exceeded");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.errorCode).toBe("response_size_limit_exceeded");
    expect(result.body.error.message).toBe("response_size_limit_exceeded:max_response_bytes_exceeded");
  });

  it("fetch fallido devuelve error determinista y resultado persistido", async () => {
    const unreachableBaseUrl = await getUnusedLocalBaseUrl();
    const { executionId } = await setupExecution(unreachableBaseUrl);

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: `${unreachableBaseUrl}/downstream`
      });

    expect(run.status).toBe(422);
    expect(run.body.errorCode).toBe("http_fetch_failed");
    expect(run.body.message).toBe("http_fetch_failed:network_failure");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.errorCode).toBe("http_fetch_failed");
    expect(result.body.error.message).toBe("http_fetch_failed:network_failure");
  });

  it("entryUrl invalida devuelve error determinista y resultado persistido", async () => {
    const baseUrl = await withServer((_req, res) => {
      const html = "<html><body>ok</body></html>";
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    });

    const { executionId } = await setupExecution(baseUrl);

    const run = await request(app)
      .post("/api/v1/crawler/passive/single-page")
      .send({
        executionId,
        entryUrl: "ftp://127.0.0.1/resource"
      });

    expect(run.status).toBe(400);
    expect(run.body.errorCode).toBe("invalid_entry_url");
    expect(run.body.message).toBe("invalid_entry_url:unsupported_protocol");

    const result = await request(app).get(`/api/v1/crawler/passive/single-page/${executionId}/result`);

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(false);
    expect(result.body.error.errorCode).toBe("invalid_entry_url");
    expect(result.body.error.message).toBe("invalid_entry_url:unsupported_protocol");
  });
});
