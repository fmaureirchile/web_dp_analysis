import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - Sitio D SPA dinamica", () => {
  const app = buildLaboratoryServer();
  const clientId = "integration-site-d-client";

  it("inicia sin render dinamico ni storage SPA", async () => {
    const initial = await request(app).get("/sitio-d/spa/state").set("x-synthetic-client-id", clientId);

    expect(initial.status).toBe(200);
    expect(initial.body.spa.dynamicRendered).toBe(false);
    expect(initial.body.spa.currentRoute).toBe("/");
    expect(initial.body.spa.renderCount).toBe(0);
    expect(initial.body.spa.storage.localStorage).toEqual({});
  });

  it("bootstrap activa render dinamico y sincroniza storage", async () => {
    const bootstrap = await request(app).post("/sitio-d/spa/bootstrap").set("x-synthetic-client-id", clientId).send();

    expect(bootstrap.status).toBe(200);
    expect(bootstrap.body.spa.dynamicRendered).toBe(true);
    expect(bootstrap.body.spa.renderCount).toBe(1);
    expect(bootstrap.body.spa.currentRoute).toBe("/registro");
    expect(bootstrap.body.spa.storage.localStorage.synthetic_spa_boot).toBe("true");
    expect(bootstrap.body.spa.storage.localStorage.synthetic_spa_route).toBe("/registro");
  });

  it("navegacion sin recarga actualiza ruta y storage asociado", async () => {
    const navigate = await request(app)
      .post("/sitio-d/spa/navigate")
      .set("x-synthetic-client-id", clientId)
      .send({ route: "/resumen" });

    expect(navigate.status).toBe(200);
    expect(navigate.body.spa.currentRoute).toBe("/resumen");
    expect(navigate.body.spa.storage.localStorage.synthetic_spa_route).toBe("/resumen");

    const apiProfile = await request(app).get("/sitio-d/api/profile").set("x-synthetic-client-id", clientId);

    expect(apiProfile.status).toBe(200);
    expect(apiProfile.body.source).toBe("sitio-d-api-local");
    expect(apiProfile.body.profile.mode).toBe("synthetic");
    expect(apiProfile.body.profile.currentRoute).toBe("/resumen");
  });
});
