import request from "supertest";
import { describe, expect, it } from "vitest";

import { buildLaboratoryServer } from "../../test-lab/sites/lab-server";

describe("Etapa 4 laboratorio - Sitio F extranet", () => {
  const app = buildLaboratoryServer();
  const clientId = "integration-site-f-client";

  it("inicia sin autenticar y bloquea profile", async () => {
    const session = await request(app).get("/sitio-f/session/status").set("x-synthetic-client-id", clientId);

    expect(session.status).toBe(200);
    expect(session.body.session.authenticated).toBe(false);
    expect(session.body.session.lastAction).toBe("initial");

    const profile = await request(app).get("/sitio-f/profile").set("x-synthetic-client-id", clientId);

    expect(profile.status).toBe(401);
    expect(profile.body.error).toBe("session_not_authenticated");
  });

  it("permite login como cliente y retorna flujo cliente", async () => {
    const loginCliente = await request(app)
      .post("/sitio-f/auth/login")
      .set("x-synthetic-client-id", clientId)
      .send({
        username: "cliente_sintetico",
        password: "clave_sintetica",
        role: "cliente"
      });

    expect(loginCliente.status).toBe(200);
    expect(loginCliente.body.session.authenticated).toBe(true);
    expect(loginCliente.body.session.role).toBe("cliente");

    const profileCliente = await request(app).get("/sitio-f/profile").set("x-synthetic-client-id", clientId);

    expect(profileCliente.status).toBe(200);
    expect(profileCliente.body.profile.role).toBe("cliente");
    expect(profileCliente.body.profile.panel).toBe("cliente");
    expect(profileCliente.body.profile.syntheticDataAccess).toBe("own_only");
  });

  it("permite login como supervisor y retorna flujo supervisor", async () => {
    const loginSupervisor = await request(app)
      .post("/sitio-f/auth/login")
      .set("x-synthetic-client-id", clientId)
      .send({
        username: "supervisor_sintetico",
        password: "clave_sintetica",
        role: "supervisor"
      });

    expect(loginSupervisor.status).toBe(200);
    expect(loginSupervisor.body.session.authenticated).toBe(true);
    expect(loginSupervisor.body.session.role).toBe("supervisor");

    const profileSupervisor = await request(app).get("/sitio-f/profile").set("x-synthetic-client-id", clientId);

    expect(profileSupervisor.status).toBe(200);
    expect(profileSupervisor.body.profile.role).toBe("supervisor");
    expect(profileSupervisor.body.profile.panel).toBe("supervisor");
    expect(profileSupervisor.body.profile.syntheticDataAccess).toBe("aggregated");
  });

  it("permite logout y vuelve a bloquear profile", async () => {
    const logout = await request(app).post("/sitio-f/auth/logout").set("x-synthetic-client-id", clientId).send();

    expect(logout.status).toBe(200);
    expect(logout.body.session.authenticated).toBe(false);
    expect(logout.body.session.lastAction).toBe("logout");

    const profileAfterLogout = await request(app).get("/sitio-f/profile").set("x-synthetic-client-id", clientId);

    expect(profileAfterLogout.status).toBe(401);
    expect(profileAfterLogout.body.error).toBe("session_not_authenticated");
  });

  it("rechaza rol no soportado", async () => {
    const invalidRole = await request(app)
      .post("/sitio-f/auth/login")
      .set("x-synthetic-client-id", clientId)
      .send({
        username: "usuario_sintetico",
        password: "clave_sintetica",
        role: "auditor"
      });

    expect(invalidRole.status).toBe(400);
    expect(invalidRole.body.error).toBe("role_not_supported");
  });
});
