import { type AddressInfo, type Server } from "node:net";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { app as apiApp } from "../../apps/api/src/server";
import { resetStore } from "../../apps/api/src/stage2/in-memory-store";
import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

let apiServer: Server | undefined;
let labServer: ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]> | undefined;
let labBaseUrl = "";
let webApp: import("express").Express;

beforeAll(async () => {
  process.env.USE_PRISMA_PERSISTENCE = "false";

  apiServer = await new Promise<Server>((resolve, reject) => {
    const started = apiApp.listen(0, "127.0.0.1", () => resolve(started));
    started.on("error", reject);
  });

  const address = apiServer.address() as AddressInfo;
  process.env.ANALYSIS_API_BASE_URL = `http://127.0.0.1:${address.port}/api/v1`;

  ({ app: webApp } = await import("../../apps/web/server.js"));
});

beforeEach(async () => {
  resetStore();

  const labApp = buildLaboratoryServer();
  labServer = await new Promise<ReturnType<ReturnType<typeof buildLaboratoryServer>["listen"]>>((resolve, reject) => {
    const started = labApp.listen(0, "127.0.0.1", () => resolve(started));
    started.on("error", reject);
  });

  const address = labServer.address() as AddressInfo;
  labBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!labServer) {
      resolve();
      return;
    }

    labServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  labServer = undefined;
  labBaseUrl = "";
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    if (!apiServer) {
      resolve();
      return;
    }

    apiServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  apiServer = undefined;
});

describe("web analyzer dynamic probe guardrails", () => {
  it("allows controlled probe when action matches allowlist and not denylisted", async () => {
    const response = await request(webApp)
      .post("/api/analyze")
      .send({
        urls: [`${labBaseUrl}/sitio-a`],
        mode: "dynamic",
        activeFormProbe: true,
        maxFormProbes: 1,
        probeIncludePaths: ["/sitio-a"],
        probeExcludePaths: [],
        probeBlockSensitiveEndpoints: true
      });

    expect(response.status).toBe(200);
    expect(response.body.data.dynamicProbe).toMatchObject({
      activeFormProbe: true,
      maxFormProbes: 1,
      probeIncludePaths: ["/sitio-a"],
      probeExcludePaths: [],
      probeBlockSensitiveEndpoints: true
    });

    const result = response.body.data.results[0];
    expect(result.ok).toBe(true);
    expect(result.activeFormProbe.attempted).toBe(true);
    expect(result.activeFormProbe.submitRequestObserved).toBe(true);
    expect(result.activeFormProbe.note).toBe("probe_request_sent");
    expect(String(result.activeFormProbe.actionUrl)).toContain("/sitio-a/submit");
    expect(result.captureSignals.evidenceLevel).toBe("confirmed");
  });

  it("blocks controlled probe when endpoint matches explicit probe denylist", async () => {
    const response = await request(webApp)
      .post("/api/analyze")
      .send({
        urls: [`${labBaseUrl}/sitio-a`],
        mode: "dynamic",
        activeFormProbe: true,
        maxFormProbes: 1,
        probeIncludePaths: ["/sitio-a"],
        probeExcludePaths: ["/sitio-a/submit"],
        probeBlockSensitiveEndpoints: true
      });

    expect(response.status).toBe(200);
    expect(response.body.data.dynamicProbe).toMatchObject({
      activeFormProbe: true,
      maxFormProbes: 1,
      probeIncludePaths: ["/sitio-a"],
      probeExcludePaths: ["/sitio-a/submit"],
      probeBlockSensitiveEndpoints: true
    });

    const result = response.body.data.results[0];
    expect(result.ok).toBe(true);
    expect(result.activeFormProbe.attempted).toBe(false);
    expect(result.activeFormProbe.submitRequestObserved).toBe(false);
    expect(result.activeFormProbe.note).toBe("no_form_candidates_after_probe_filters");
    expect(result.activeFormProbe.actionUrl ?? null).toBeNull();
    expect(result.captureSignals.evidenceLevel).toBe("potential");
  });
});
