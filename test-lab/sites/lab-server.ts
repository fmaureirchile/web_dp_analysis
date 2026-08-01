import path from "node:path";
import { randomUUID } from "node:crypto";
import express, { type Express } from "express";

type SiteDefinition = {
  id: string;
  slug: string;
  basePath: string;
  name: string;
  description: string;
  expectedBehaviors: string[];
};

type SiteBConsentState = {
  clientId: string;
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  revoked: boolean;
  lastAction: "initial" | "accept_all" | "reject_all" | "customize" | "revoke";
  updatedAt: string;
};

type SiteCTrackingEvent = {
  type: string;
  timestamp: string;
  metadata?: Record<string, string | boolean | number>;
};

type SiteCSessionState = {
  clientId: string;
  rejected: boolean;
  events: SiteCTrackingEvent[];
  updatedAt: string;
};

type SiteDSessionState = {
  clientId: string;
  dynamicRendered: boolean;
  currentRoute: string;
  renderCount: number;
  storage: {
    localStorage: Record<string, string>;
  };
  updatedAt: string;
};

type SiteESubmission = {
  id: string;
  clientId: string;
  receivedAt: string;
  contentType: string;
  multipartDetected: boolean;
  payloadBytes: number;
  healthCondition: {
    provided: boolean;
    value?: string;
  };
  medicalDocument: {
    provided: boolean;
    filename?: string;
  };
  sensitivity: {
    category: "HEALTH_DATA";
    syntheticOnly: boolean;
  };
};

type SiteFRole = "cliente" | "supervisor";

type SiteFSessionState = {
  clientId: string;
  authenticated: boolean;
  username?: string;
  role?: SiteFRole;
  lastAction: "initial" | "login" | "logout";
  updatedAt: string;
};

const siteDefinitions: SiteDefinition[] = [
  {
    id: "A",
    slug: "sitio-a-formulario-simple",
    basePath: "/sitio-a",
    name: "Sitio A - formulario simple",
    description: "Formulario basico con datos de contacto y casilla de privacidad.",
    expectedBehaviors: ["formulario_visible", "campo_oculto_presente", "privacy_checkbox_presente"]
  },
  {
    id: "B",
    slug: "sitio-b-cookies-correctas",
    basePath: "/sitio-b",
    name: "Sitio B - cookies correctas",
    description: "Banner de consentimiento con aceptar, rechazar y configurar.",
    expectedBehaviors: [
      "analytics_desactivada_por_defecto",
      "aceptar_habilita_analytics",
      "rechazar_bloquea_analytics",
      "revocar_restablece_preferencias"
    ]
  },
  {
    id: "C",
    slug: "sitio-c-tracking-defectuoso",
    basePath: "/sitio-c",
    name: "Sitio C - tracking defectuoso",
    description: "Tracking activo antes y despues de rechazar consentimiento.",
    expectedBehaviors: ["tracking_previo", "tracking_post_rechazo"]
  },
  {
    id: "D",
    slug: "sitio-d-spa-dinamica",
    basePath: "/sitio-d",
    name: "Sitio D - SPA dinamica",
    description: "Aplicacion con render dinamico y estado en localStorage.",
    expectedBehaviors: ["render_dinamico", "navegacion_sin_recarga", "api_json_local"]
  },
  {
    id: "E",
    slug: "sitio-e-datos-sensibles",
    basePath: "/sitio-e",
    name: "Sitio E - datos sensibles",
    description: "Formulario sintetico con salud y carga de documento.",
    expectedBehaviors: ["campo_salud", "multipart_local", "aviso_especifico"]
  },
  {
    id: "F",
    slug: "sitio-f-extranet",
    basePath: "/sitio-f",
    name: "Sitio F - extranet",
    description: "Login sintetico con roles cliente y supervisor.",
    expectedBehaviors: ["login_sintetico", "rol_cliente", "rol_supervisor"]
  }
];

export function buildLaboratoryServer(): Express {
  const app = express();
  const currentDir = __dirname;
  const siteBStates = new Map<string, SiteBConsentState>();
  const siteCStates = new Map<string, SiteCSessionState>();
  const siteDStates = new Map<string, SiteDSessionState>();
  const siteESubmissions: SiteESubmission[] = [];
  const siteFSessions = new Map<string, SiteFSessionState>();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  function resolveClientId(raw: unknown): string {
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
    return "anonymous";
  }

  function getSiteBState(clientId: string): SiteBConsentState {
    const existing = siteBStates.get(clientId);
    if (existing) {
      return existing;
    }

    const initialState: SiteBConsentState = {
      clientId,
      necessary: true,
      analytics: false,
      marketing: false,
      revoked: false,
      lastAction: "initial",
      updatedAt: new Date().toISOString()
    };

    siteBStates.set(clientId, initialState);
    return initialState;
  }

  function getSiteCState(clientId: string): SiteCSessionState {
    const existing = siteCStates.get(clientId);
    if (existing) {
      return existing;
    }

    const initialState: SiteCSessionState = {
      clientId,
      rejected: false,
      events: [],
      updatedAt: new Date().toISOString()
    };

    siteCStates.set(clientId, initialState);
    return initialState;
  }

  function appendSiteCEvent(clientId: string, event: SiteCTrackingEvent): SiteCSessionState {
    const current = getSiteCState(clientId);
    const updated: SiteCSessionState = {
      ...current,
      events: [...current.events, event],
      updatedAt: new Date().toISOString()
    };

    siteCStates.set(clientId, updated);
    return updated;
  }

  function getSiteDState(clientId: string): SiteDSessionState {
    const existing = siteDStates.get(clientId);
    if (existing) {
      return existing;
    }

    const initialState: SiteDSessionState = {
      clientId,
      dynamicRendered: false,
      currentRoute: "/",
      renderCount: 0,
      storage: {
        localStorage: {}
      },
      updatedAt: new Date().toISOString()
    };

    siteDStates.set(clientId, initialState);
    return initialState;
  }

  function extractMultipartField(rawBody: Buffer, fieldName: string): string | undefined {
    const source = rawBody.toString("utf8");
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`name="${escapedField}"\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n`);
    const match = pattern.exec(source);
    return match ? match[1] : undefined;
  }

  function extractMultipartFilename(rawBody: Buffer, fieldName: string): string | undefined {
    const source = rawBody.toString("utf8");
    const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`name="${escapedField}"; filename="([^"]*)"`);
    const match = pattern.exec(source);
    return match ? match[1] : undefined;
  }

  function getSiteFSession(clientId: string): SiteFSessionState {
    const existing = siteFSessions.get(clientId);
    if (existing) {
      return existing;
    }

    const initialState: SiteFSessionState = {
      clientId,
      authenticated: false,
      lastAction: "initial",
      updatedAt: new Date().toISOString()
    };

    siteFSessions.set(clientId, initialState);
    return initialState;
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      service: "synthetic-lab",
      version: "0.1.0",
      sites: siteDefinitions.length
    });
  });

  app.get("/sites", (_req, res) => {
    res.status(200).json({
      data: siteDefinitions.map((site) => ({
        id: site.id,
        slug: site.slug,
        basePath: site.basePath,
        name: site.name,
        description: site.description,
        healthPath: `${site.basePath}/health`
      }))
    });
  });

  for (const site of siteDefinitions) {
    const siteRoot = path.join(currentDir, site.slug);

    if (site.id === "A") {
      app.get(`${site.basePath}/slow-html`, (_req, res) => {
        setTimeout(() => {
          const html = "<html><head><title>Sitio A - Slow HTML</title></head><body><h1>slow</h1></body></html>";
          res.writeHead(200, {
            "content-type": "text/html; charset=utf-8",
            "content-length": String(Buffer.byteLength(html))
          });
          res.end(html);
        }, 200);
      });

      app.get(`${site.basePath}/non-html`, (_req, res) => {
        const payload = JSON.stringify({ status: "ok", siteId: site.id, kind: "json" });
        res.writeHead(200, {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(payload))
        });
        res.end(payload);
      });

      app.get(`${site.basePath}/large-html`, (_req, res) => {
        const body = `<html><head><title>Sitio A - Large HTML</title></head><body>${"x".repeat(4096)}</body></html>`;
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "content-length": String(Buffer.byteLength(body))
        });
        res.end(body);
      });

      app.post(`${site.basePath}/submit`, (req, res) => {
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          received: {
            name: req.body.name,
            email: req.body.email,
            phone: req.body.phone,
            campaign: req.body.campaign,
            privacyAccepted: req.body.privacyAccepted === "on" || req.body.privacyAccepted === true
          }
        });
      });
    }

    if (site.id === "B") {
      app.get(`${site.basePath}/consent/status`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const state = getSiteBState(clientId);

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          consent: state
        });
      });

      app.post(`${site.basePath}/consent/action`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const current = getSiteBState(clientId);
        const payload = req.body as {
          action?: "accept_all" | "reject_all" | "customize" | "revoke";
          categories?: {
            analytics?: boolean;
            marketing?: boolean;
          };
        };

        if (!payload.action) {
          res.status(400).json({ error: "consent_action_required" });
          return;
        }

        let nextState: SiteBConsentState;

        if (payload.action === "accept_all") {
          nextState = {
            ...current,
            analytics: true,
            marketing: true,
            revoked: false,
            lastAction: "accept_all",
            updatedAt: new Date().toISOString()
          };
        } else if (payload.action === "reject_all") {
          nextState = {
            ...current,
            analytics: false,
            marketing: false,
            revoked: false,
            lastAction: "reject_all",
            updatedAt: new Date().toISOString()
          };
        } else if (payload.action === "customize") {
          nextState = {
            ...current,
            analytics: payload.categories?.analytics === true,
            marketing: payload.categories?.marketing === true,
            revoked: false,
            lastAction: "customize",
            updatedAt: new Date().toISOString()
          };
        } else if (payload.action === "revoke") {
          nextState = {
            ...current,
            analytics: false,
            marketing: false,
            revoked: true,
            lastAction: "revoke",
            updatedAt: new Date().toISOString()
          };
        } else {
          res.status(400).json({ error: "consent_action_not_supported" });
          return;
        }

        siteBStates.set(clientId, nextState);
        res.setHeader("set-cookie", `synthetic_consent_client=${encodeURIComponent(clientId)}; Path=/; HttpOnly`);
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          consent: nextState
        });
      });
    }

    if (site.id === "C") {
      app.get(`${site.basePath}/tracking/events`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const state = getSiteCState(clientId);

        const eventTypes = state.events.map((event) => event.type);
        const trackingBeforeConsent = eventTypes.includes("tracking_before_choice");
        const rejectedIndex = eventTypes.indexOf("consent_rejected");
        const trackingAfterReject = rejectedIndex >= 0 && eventTypes.slice(rejectedIndex + 1).includes("tracking_after_reject");

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          clientId,
          rejected: state.rejected,
          events: state.events,
          defectFlags: {
            trackingBeforeConsent,
            trackingAfterReject
          }
        });
      });

      app.post(`${site.basePath}/tracking/boot`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);

        const updated = appendSiteCEvent(clientId, {
          type: "tracking_before_choice",
          timestamp: new Date().toISOString(),
          metadata: { source: "boot" }
        });

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          clientId,
          events: updated.events
        });
      });

      app.post(`${site.basePath}/tracking/ping`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);

        const updated = appendSiteCEvent(clientId, {
          type: "tracking_ping",
          timestamp: new Date().toISOString(),
          metadata: { source: "manual_ping" }
        });

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          clientId,
          events: updated.events
        });
      });

      app.post(`${site.basePath}/consent/reject`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const current = getSiteCState(clientId);

        const withReject: SiteCSessionState = {
          ...current,
          rejected: true,
          events: [
            ...current.events,
            { type: "consent_rejected", timestamp: new Date().toISOString(), metadata: { source: "user_action" } },
            { type: "tracking_after_reject", timestamp: new Date().toISOString(), metadata: { source: "defective_behavior" } }
          ],
          updatedAt: new Date().toISOString()
        };

        siteCStates.set(clientId, withReject);

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          clientId,
          rejected: withReject.rejected,
          events: withReject.events
        });
      });
    }

    if (site.id === "D") {
      app.get(`${site.basePath}/spa/state`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const state = getSiteDState(clientId);

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          spa: state
        });
      });

      app.post(`${site.basePath}/spa/bootstrap`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const current = getSiteDState(clientId);

        const nextState: SiteDSessionState = {
          ...current,
          dynamicRendered: true,
          currentRoute: "/registro",
          renderCount: current.renderCount + 1,
          storage: {
            localStorage: {
              ...current.storage.localStorage,
              synthetic_spa_boot: "true",
              synthetic_spa_route: "/registro"
            }
          },
          updatedAt: new Date().toISOString()
        };

        siteDStates.set(clientId, nextState);
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          spa: nextState
        });
      });

      app.post(`${site.basePath}/spa/navigate`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const route = typeof req.body.route === "string" && req.body.route.trim().length > 0 ? req.body.route.trim() : "/";
        const current = getSiteDState(clientId);

        const nextState: SiteDSessionState = {
          ...current,
          currentRoute: route,
          storage: {
            localStorage: {
              ...current.storage.localStorage,
              synthetic_spa_route: route
            }
          },
          updatedAt: new Date().toISOString()
        };

        siteDStates.set(clientId, nextState);
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          spa: nextState
        });
      });

      app.get(`${site.basePath}/api/profile`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const state = getSiteDState(clientId);

        res.status(200).json({
          status: "ok",
          source: "sitio-d-api-local",
          profile: {
            clientId,
            mode: "synthetic",
            currentRoute: state.currentRoute
          }
        });
      });
    }

    if (site.id === "E") {
      app.get(`${site.basePath}/submissions`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);

        const data = siteESubmissions.filter((item) => item.clientId === clientId);

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          clientId,
          count: data.length,
          data
        });
      });

      app.post(`${site.basePath}/upload`, express.raw({ type: () => true, limit: "5mb" }), (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : "";
        const multipartDetected = contentType.toLowerCase().startsWith("multipart/form-data");

        if (!multipartDetected) {
          res.status(415).json({ error: "multipart_content_type_required" });
          return;
        }

        const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
        const healthCondition = extractMultipartField(payload, "healthCondition");
        const filename = extractMultipartFilename(payload, "medicalDocument");

        const submission: SiteESubmission = {
          id: randomUUID(),
          clientId,
          receivedAt: new Date().toISOString(),
          contentType,
          multipartDetected,
          payloadBytes: payload.byteLength,
          healthCondition: {
            provided: typeof healthCondition === "string" && healthCondition.trim().length > 0,
            value: healthCondition
          },
          medicalDocument: {
            provided: typeof filename === "string" && filename.trim().length > 0,
            filename
          },
          sensitivity: {
            category: "HEALTH_DATA",
            syntheticOnly: true
          }
        };

        siteESubmissions.push(submission);

        res.status(201).json({
          status: "ok",
          siteId: site.id,
          submission
        });
      });
    }

    if (site.id === "F") {
      app.get(`${site.basePath}/session/status`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const session = getSiteFSession(clientId);

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          session
        });
      });

      app.post(`${site.basePath}/auth/login`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
        const password = typeof req.body.password === "string" ? req.body.password.trim() : "";
        const roleRaw = typeof req.body.role === "string" ? req.body.role.trim().toLowerCase() : "";

        if (username.length === 0) {
          res.status(400).json({ error: "username_required" });
          return;
        }

        if (password.length === 0) {
          res.status(400).json({ error: "password_required" });
          return;
        }

        if (roleRaw !== "cliente" && roleRaw !== "supervisor") {
          res.status(400).json({ error: "role_not_supported" });
          return;
        }

        const role = roleRaw as SiteFRole;
        const nextSession: SiteFSessionState = {
          clientId,
          authenticated: true,
          username,
          role,
          lastAction: "login",
          updatedAt: new Date().toISOString()
        };

        siteFSessions.set(clientId, nextSession);
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          session: nextSession
        });
      });

      app.post(`${site.basePath}/auth/logout`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);

        const nextSession: SiteFSessionState = {
          clientId,
          authenticated: false,
          lastAction: "logout",
          updatedAt: new Date().toISOString()
        };

        siteFSessions.set(clientId, nextSession);
        res.status(200).json({
          status: "ok",
          siteId: site.id,
          session: nextSession
        });
      });

      app.get(`${site.basePath}/profile`, (req, res) => {
        const queryClientId = typeof req.query.clientId === "string" ? req.query.clientId : undefined;
        const clientId = resolveClientId(req.header("x-synthetic-client-id") ?? queryClientId);
        const session = getSiteFSession(clientId);

        if (!session.authenticated || !session.role || !session.username) {
          res.status(401).json({ error: "session_not_authenticated" });
          return;
        }

        const profile =
          session.role === "cliente"
            ? {
                panel: "cliente",
                sections: ["mis-datos", "mis-tramites"],
                syntheticDataAccess: "own_only"
              }
            : {
                panel: "supervisor",
                sections: ["dashboard", "reporte-agregado"],
                syntheticDataAccess: "aggregated"
              };

        res.status(200).json({
          status: "ok",
          siteId: site.id,
          profile: {
            username: session.username,
            role: session.role,
            ...profile
          }
        });
      });
    }

    app.get(`${site.basePath}/health`, (_req, res) => {
      res.status(200).json({
        status: "ok",
        siteId: site.id,
        slug: site.slug,
        name: site.name,
        expectedBehaviors: site.expectedBehaviors
      });
    });

    app.get(site.basePath, (_req, res) => {
      res.sendFile(path.join(siteRoot, "index.html"));
    });

    app.use(site.basePath, express.static(siteRoot));
  }

  return app;
}

function shouldStartServer(): boolean {
  const executedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
  return path.resolve(__filename) === executedFile;
}

if (shouldStartServer()) {
  const app = buildLaboratoryServer();
  const port = Number(process.env.LAB_PORT ?? 4310);

  app.listen(port, () => {
    process.stdout.write(`[synthetic-lab] listening on port ${port}\n`);
  });
}
