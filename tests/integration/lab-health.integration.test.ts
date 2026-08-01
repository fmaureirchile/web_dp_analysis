import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - health inicial", () => {
  const app = buildLaboratoryServer();
  const expectedSites = [
    { id: "A", slug: "sitio-a-formulario-simple", healthPath: "/sitio-a/health" },
    { id: "B", slug: "sitio-b-cookies-correctas", healthPath: "/sitio-b/health" },
    { id: "C", slug: "sitio-c-tracking-defectuoso", healthPath: "/sitio-c/health" },
    { id: "D", slug: "sitio-d-spa-dinamica", healthPath: "/sitio-d/health" },
    { id: "E", slug: "sitio-e-datos-sensibles", healthPath: "/sitio-e/health" },
    { id: "F", slug: "sitio-f-extranet", healthPath: "/sitio-f/health" }
  ] as const;

  it("debe responder health general y health de sitios A-F", async () => {
    const health = await request(app).get("/health");

    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");
    expect(health.body.service).toBe("synthetic-lab");
    expect(health.body.sites).toBe(6);

    const catalog = await request(app).get("/sites");

    expect(catalog.status).toBe(200);
    expect(Array.isArray(catalog.body.data)).toBe(true);
    expect(catalog.body.data).toHaveLength(expectedSites.length);

    for (const expectedSite of expectedSites) {
      const inCatalog = catalog.body.data.find(
        (site: { id: string; slug: string; healthPath: string }) => site.id === expectedSite.id
      );

      expect(inCatalog).toBeDefined();
      expect(inCatalog.slug).toBe(expectedSite.slug);
      expect(inCatalog.healthPath).toBe(expectedSite.healthPath);

      const siteHealth = await request(app).get(expectedSite.healthPath);

      expect(siteHealth.status).toBe(200);
      expect(siteHealth.body.status).toBe("ok");
      expect(siteHealth.body.siteId).toBe(expectedSite.id);
      expect(siteHealth.body.slug).toBe(expectedSite.slug);
    }
  });

  it("debe mantener operaciones de health con Sitio A" , async () => {
    const siteA = await request(app).get("/sitio-a/health");

    expect(siteA.status).toBe(200);
    expect(siteA.body.status).toBe("ok");
    expect(siteA.body.slug).toBe("sitio-a-formulario-simple");
  });

  it("debe aceptar submit local sintetico de Sitio A", async () => {
    const submit = await request(app).post("/sitio-a/submit").type("form").send({
      name: "Persona Sintetica",
      email: "persona.sintetica@example.test",
      phone: "+56911111111",
      campaign: "synthetic-a",
      privacyAccepted: "on"
    });

    expect(submit.status).toBe(200);
    expect(submit.body.status).toBe("ok");
    expect(submit.body.siteId).toBe("A");
    expect(submit.body.received.privacyAccepted).toBe(true);
    expect(submit.body.received.campaign).toBe("synthetic-a");
  });
});
