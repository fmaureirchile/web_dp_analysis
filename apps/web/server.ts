import express from "express";
import path from "node:path";

type AnalysisMode = "passive" | "dynamic";

type AnalyzeRequestBody = {
  urls?: string[];
  mode?: AnalysisMode;
  timeoutMs?: number;
  deepNavigation?: boolean;
  maxDepth?: number;
  maxPages?: number;
  sameDomainOnly?: boolean;
  includePaths?: string[];
  excludePaths?: string[];
  activeFormProbe?: boolean;
  maxFormProbes?: number;
  probeIncludePaths?: string[];
  probeExcludePaths?: string[];
  probeBlockSensitiveEndpoints?: boolean;
};

type ExecutiveSummaryRequestBody = {
  analysis?: {
    data?: {
      mode?: AnalysisMode;
      total?: number;
      okCount?: number;
      failedCount?: number;
      elapsedMs?: number;
      results?: AnalyzeResultItem[];
    };
  };
  language?: string;
  model?: string;
};

type AnalyzeResultItem = {
  url: string;
  mode: AnalysisMode;
  ok: boolean;
  executionId?: string;
  analyzedAt: string;
  statusHttp?: number;
  title?: string;
  evidenceId?: string;
  contentType?: string;
  contentLength?: number;
  formDetected?: boolean;
  formCount?: number;
  potentialPiiFields?: string[];
  captureSignals?: CaptureSignals;
  activeFormProbe?: {
    attempted: boolean;
    submitRequestObserved: boolean;
    method?: string;
    actionUrl?: string;
    statusHttp?: number;
    note?: string;
  };
  networkRequests?: number;
  storageEvents?: number;
  interactionEvents?: number;
  errorCode?: string;
  message?: string;
  raw?: unknown;
};

type CaptureSignals = {
  evidenceLevel: "none" | "potential" | "confirmed";
  formsDetected: number;
  potentialPiiFields: string[];
  cookieCount: number;
  analyticsDetected: boolean;
  analyticsVendors: string[];
  chatDetected: boolean;
  chatVendors: string[];
  thirdPartyDomains: string[];
  behaviorSignals: string[];
};

const app = express();

const repoRoot = process.cwd();
const webRoot = path.join(repoRoot, "apps", "web");
const publicDir = path.join(webRoot, "public");
const apiBaseUrl = process.env.ANALYSIS_API_BASE_URL ?? "http://localhost:3000/api/v1";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

const DEFAULT_MAX_DEPTH = 1;
const DEFAULT_MAX_PAGES = 10;
const ABSOLUTE_MAX_DEPTH = 4;
const ABSOLUTE_MAX_PAGES = 50;

type DeepNavigationConfig = {
  enabled: boolean;
  maxDepth: number;
  maxPages: number;
  sameDomainOnly: boolean;
  includePaths: string[];
  excludePaths: string[];
};

type DynamicProbeConfig = {
  activeFormProbe: boolean;
  maxFormProbes: number;
  probeIncludePaths: string[];
  probeExcludePaths: string[];
  probeBlockSensitiveEndpoints: boolean;
};

type CrawlQueueItem = {
  url: string;
  depth: number;
};

type DomainExecutiveInput = {
  domain: string;
  mode: AnalysisMode;
  totalUrls: number;
  okCount: number;
  failedCount: number;
  elapsedMs: number;
  pages: Array<{
    url: string;
    path: string;
    ok: boolean;
    statusHttp?: number;
    title?: string;
    contentLength?: number;
    formDetected?: boolean;
    formCount?: number;
    potentialPiiFields?: string[];
    captureSignals?: CaptureSignals;
    errorCode?: string;
    message?: string;
  }>;
};

type PassiveFormSignals = {
  formDetected: boolean;
  formCount: number;
  potentialPiiFields: string[];
};

const ANALYTICS_PATTERNS: Array<{ vendor: string; pattern: RegExp }> = [
  { vendor: "Google Analytics", pattern: /google-analytics|googletagmanager|gtag\(|ga\(/i },
  { vendor: "Meta Pixel", pattern: /connect\.facebook\.net|fbq\(/i },
  { vendor: "Hotjar", pattern: /hotjar/i },
  { vendor: "Clarity", pattern: /clarity\.ms|clarity\(/i },
  { vendor: "Segment", pattern: /segment\.com|analytics\.js/i },
  { vendor: "Mixpanel", pattern: /mixpanel/i }
];

const CHAT_PATTERNS: Array<{ vendor: string; pattern: RegExp }> = [
  { vendor: "Intercom", pattern: /intercom/i },
  { vendor: "Zendesk", pattern: /zendesk|zopim/i },
  { vendor: "Drift", pattern: /drift\.com|driftt/i },
  { vendor: "HubSpot Chat", pattern: /hubspot|hs-script-loader|messagesUtk/i },
  { vendor: "Tawk", pattern: /tawk\.to/i },
  { vendor: "Crisp", pattern: /crisp\.chat/i }
];

const DEFAULT_SENSITIVE_PROBE_PATH_PREFIXES = [
  "/logout",
  "/signout",
  "/delete",
  "/remove",
  "/admin",
  "/auth/reset",
  "/billing",
  "/payment",
  "/checkout",
  "/unsubscribe"
];

type ExecutiveSummaryOutput = {
  domain: string;
  totalUrls: number;
  okCount: number;
  failedCount: number;
  summaryMarkdown: string;
  source: "openai" | "fallback";
  model: string;
};

function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const intValue = Math.trunc(value);
  if (intValue < min) {
    return min;
  }
  if (intValue > max) {
    return max;
  }
  return intValue;
}

function parseDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid-domain";
  }
}

function resolveThirdPartyDomain(entryUrl: string, observedUrl: string): string | undefined {
  try {
    const entryHost = new URL(entryUrl).hostname.toLowerCase();
    const observedHost = new URL(observedUrl).hostname.toLowerCase();
    return entryHost === observedHost ? undefined : observedHost;
  } catch {
    return undefined;
  }
}

function toDomainInputs(data: {
  mode?: AnalysisMode;
  total?: number;
  okCount?: number;
  failedCount?: number;
  elapsedMs?: number;
  results?: AnalyzeResultItem[];
}): DomainExecutiveInput[] {
  const mode = data.mode === "dynamic" ? "dynamic" : "passive";
  const elapsedMs = typeof data.elapsedMs === "number" ? data.elapsedMs : 0;
  const results = Array.isArray(data.results) ? data.results : [];
  const grouped = new Map<string, AnalyzeResultItem[]>();

  for (const item of results) {
    const domain = parseDomain(item.url);
    const current = grouped.get(domain) ?? [];
    current.push(item);
    grouped.set(domain, current);
  }

  const inputs: DomainExecutiveInput[] = [];
  for (const [domain, items] of grouped.entries()) {
    const okCount = items.filter((item) => item.ok).length;
    const failedCount = items.length - okCount;
    inputs.push({
      domain,
      mode,
      totalUrls: items.length,
      okCount,
      failedCount,
      elapsedMs,
      pages: items.map((item) => {
        let pathName = "/";
        try {
          pathName = new URL(item.url).pathname || "/";
        } catch {
          pathName = "/";
        }

        return {
          url: item.url,
          path: pathName,
          ok: item.ok,
          statusHttp: item.statusHttp,
          title: item.title,
          contentLength: item.contentLength,
          formDetected: item.formDetected,
          formCount: item.formCount,
          potentialPiiFields: item.potentialPiiFields,
          captureSignals: item.captureSignals,
          errorCode: item.errorCode,
          message: item.message
        };
      })
    });
  }

  return inputs;
}

function buildFallbackSummary(input: DomainExecutiveInput): string {
  const titles = Array.from(new Set(input.pages.map((item) => item.title).filter((item): item is string => Boolean(item)))).slice(0, 5);
  const failed = input.pages.filter((item) => !item.ok);
  const keyPaths = input.pages.map((item) => item.path.toLowerCase());
  const hasPrivacy = keyPaths.some((pathName) => pathName.includes("privacidad") || pathName.includes("privacy"));
  const hasCookies = keyPaths.some((pathName) => pathName.includes("cookie"));
  const hasContact = keyPaths.some((pathName) => pathName.includes("conversemos") || pathName.includes("contact"));
  const pagesWithForms = input.pages.filter((item) => item.formDetected);
  const piiFieldSet = Array.from(
    new Set(
      input.pages
        .flatMap((item) => (Array.isArray(item.potentialPiiFields) ? item.potentialPiiFields : []))
        .map((item) => item.toLowerCase())
    )
  );
  const analyticsVendors = Array.from(
    new Set(
      input.pages.flatMap((item) => item.captureSignals?.analyticsVendors ?? []).map((item) => item.toLowerCase())
    )
  );
  const chatVendors = Array.from(
    new Set(
      input.pages.flatMap((item) => item.captureSignals?.chatVendors ?? []).map((item) => item.toLowerCase())
    )
  );
  const thirdPartyDomains = Array.from(
    new Set(
      input.pages.flatMap((item) => item.captureSignals?.thirdPartyDomains ?? []).map((item) => item.toLowerCase())
    )
  );
  const behaviorSignals = Array.from(
    new Set(
      input.pages.flatMap((item) => item.captureSignals?.behaviorSignals ?? []).map((item) => item.toLowerCase())
    )
  );
  const cookieCount = input.pages.reduce((acc, item) => acc + Number(item.captureSignals?.cookieCount ?? 0), 0);
  const evidenceLevel: CaptureSignals["evidenceLevel"] = input.pages.some((item) => item.captureSignals?.evidenceLevel === "confirmed")
    ? "confirmed"
    : input.pages.some((item) => item.captureSignals?.evidenceLevel === "potential")
      ? "potential"
      : "none";

  const lines: string[] = [];
  lines.push(`# Resumen ejecutivo - ${input.domain}`);
  lines.push("");
  lines.push("## Sintesis");
  lines.push(
    `Se ejecuto una exploracion en modo ${input.mode} sobre ${input.totalUrls} URL(s). Resultado: ${input.okCount} exitosas y ${input.failedCount} fallidas en ${input.elapsedMs} ms.`
  );
  lines.push("");
  lines.push("## Cobertura observada");
  lines.push(`Se identificaron rutas operativas del dominio con respuesta tecnica util para trazabilidad.`);
  if (titles.length > 0) {
    lines.push(`Titulos detectados: ${titles.join(" | ")}.`);
  }
  lines.push("");
  lines.push("## Senales para negocio");
  lines.push(`- Disponibilidad del dominio: ${input.okCount > 0 ? "confirmada" : "no confirmada"}.`);
  lines.push(`- Cobertura de contacto/formulario: ${hasContact ? "presente" : "no evidenciada en este corte"}.`);
  lines.push(
    `- Senal tecnica de formularios (modo pasivo): ${pagesWithForms.length > 0 ? `${pagesWithForms.length} pagina(s) con formularios` : "no detectada"}.`
  );
  lines.push(`- Campos potencialmente sensibles detectados: ${piiFieldSet.length > 0 ? piiFieldSet.join(", ") : "sin evidencia en HTML estatico"}.`);
  lines.push(`- Analytics detectado: ${analyticsVendors.length > 0 ? analyticsVendors.join(", ") : "no evidenciado"}.`);
  lines.push(`- Chat/widget detectado: ${chatVendors.length > 0 ? chatVendors.join(", ") : "no evidenciado"}.`);
  lines.push(`- Cookies observadas: ${cookieCount}.`);
  lines.push(`- Dominios de terceros observados: ${thirdPartyDomains.length > 0 ? thirdPartyDomains.join(", ") : "no evidenciados"}.`);
  lines.push(`- Senales de comportamiento: ${behaviorSignals.length > 0 ? behaviorSignals.join(", ") : "sin senales"}.`);
  lines.push(`- Nivel de evidencia de captura: ${evidenceLevel}.`);
  lines.push(`- Cobertura de privacidad: ${hasPrivacy ? "presente" : "no evidenciada en este corte"}.`);
  lines.push(`- Cobertura de cookies: ${hasCookies ? "presente" : "no evidenciada en este corte"}.`);
  lines.push("");
  lines.push("## Riesgo preliminar y lectura");
  if (failed.length === 0) {
    lines.push("No se observaron fallas tecnicas en el corte, por lo que la evidencia es util como linea base operativa.");
  } else {
    lines.push(
      `Se registraron ${failed.length} fallas tecnicas. Esto requiere reintento y no debe leerse como incumplimiento regulatorio por si solo.`
    );
  }
  if (pagesWithForms.length > 0) {
    lines.push(
      "La presencia de formularios en HTML sugiere captura potencial de datos, pero no confirma envio efectivo hasta correr observacion dinamica y/o pruebas de submit controlado."
    );
  }
  lines.push("");
  lines.push("## Proximos pasos recomendados");
  lines.push("1. Ejecutar modo dinamico sobre rutas con formularios para capturar comportamiento runtime.");
  lines.push("2. Priorizar revision humana sobre evidencia de contacto, privacidad y cookies.");
  lines.push("3. Mantener este resumen como baseline y comparar en corridas futuras.");

  return lines.join("\n");
}

function extractOpenAiText(payload: any): string | undefined {
  if (typeof payload?.output_text === "string" && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === "string" && block.text.trim().length > 0) {
        chunks.push(block.text.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n\n") : undefined;
}

async function generateSummaryWithOpenAi(input: DomainExecutiveInput, language: string, requestedModel?: string): Promise<ExecutiveSummaryOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model =
    typeof requestedModel === "string" && requestedModel.trim().length > 0
      ? requestedModel.trim()
      : process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey) {
    return {
      domain: input.domain,
      totalUrls: input.totalUrls,
      okCount: input.okCount,
      failedCount: input.failedCount,
      summaryMarkdown: `${buildFallbackSummary(input)}\n\n> Nota: resumen generado sin OpenAI (OPENAI_API_KEY no configurada).`,
      source: "fallback",
      model: "fallback"
    };
  }

  const promptPayload = {
    domain: input.domain,
    mode: input.mode,
    totalUrls: input.totalUrls,
    okCount: input.okCount,
    failedCount: input.failedCount,
    elapsedMs: input.elapsedMs,
    pages: input.pages.slice(0, 20)
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_output_tokens: 1200,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Eres analista tecnico de privacidad para una plataforma de evaluacion de captura de datos personales. Redacta en espanol claro, con foco ejecutivo-tecnico, usando SOLO evidencia observada en la salida tecnica. No entregues asesoria legal ni conclusiones juridicas definitivas. Distingue siempre entre: (a) captura potencial por estructura HTML (formularios/campos/scripts) y (b) captura confirmada por evidencia runtime (envio/red/interaccion). Cuando menciones Ley 21.719 de Chile, hazlo en terminos orientativos de estandar esperado y controles tecnicos verificables."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  `Genera un informe ejecutivo-tecnico de maximo una pagina para el dominio analizado. Idioma: ${language}. Usa Markdown y EXACTAMENTE estas secciones: 1) Sintesis ejecutiva, 2) Cobertura y evidencia tecnica, 3) Matriz de captura de datos, 4) Brechas y riesgo (referencia Ley 21.719, orientativo), 5) Plan de mejoras concreto, 6) Nivel de evidencia de captura.\n\nReglas obligatorias:\n- No inventes datos. Baseate solo en el JSON entregado.\n- Cita rutas, campos y senales tecnicas concretas cuando existan (por ejemplo URL, formCount, potentialPiiFields, behaviorSignals, thirdPartyDomains).\n- Distingue explicitamente datos personales vs datos potencialmente sensibles segun el contexto tecnico observado (sin afirmar categoria legal definitiva).\n- 'Nivel de evidencia de captura' debe ser solo: none, potencial o confirmada.\n- Si solo hay modo passive con senales estructurales, reporta potencial.\n- Si hay evidencia runtime de envio/interaccion (POST/PUT/PATCH o submit observado), reporta confirmada.\n\nFormato minimo esperado por seccion:\n1) Sintesis ejecutiva: 3 a 5 bullets con hallazgos clave.\n2) Cobertura y evidencia tecnica: tabla breve con URL/ruta, evidencia observada, confianza (alta/media/baja).\n3) Matriz de captura de datos: estado por categoria (formularios, cookies, analytics, chat/widgets, comportamiento runtime) + observaciones tecnicas.\n4) Brechas y riesgo (Ley 21.719, orientativo): lista de brechas tecnicas detectables (minimo 3 si hay evidencia suficiente), cada una con impacto operativo y nivel de prioridad (alta/media/baja).\n5) Plan de mejoras concreto: lista accionable con medidas tecnicas verificables (quick wins 0-30 dias, corto plazo 30-60 dias, medio plazo 60-90 dias). Cada accion debe incluir: objetivo, cambio tecnico sugerido, evidencia esperada para validar cumplimiento.\n6) Nivel de evidencia de captura: linea unica con el valor final y una justificacion tecnica en una frase.\n\nBaseate solo en este JSON:\n${JSON.stringify(promptPayload)}`
              }
            ]
          }
        ]
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fallback = buildFallbackSummary(input);
      return {
        domain: input.domain,
        totalUrls: input.totalUrls,
        okCount: input.okCount,
        failedCount: input.failedCount,
        summaryMarkdown: `${fallback}\n\n> Nota: OpenAI respondio con error HTTP ${response.status}. Se uso resumen fallback.`,
        source: "fallback",
        model
      };
    }

    const text = extractOpenAiText(payload);
    if (!text) {
      return {
        domain: input.domain,
        totalUrls: input.totalUrls,
        okCount: input.okCount,
        failedCount: input.failedCount,
        summaryMarkdown: `${buildFallbackSummary(input)}\n\n> Nota: OpenAI no devolvio texto util. Se uso resumen fallback.`,
        source: "fallback",
        model
      };
    }

    return {
      domain: input.domain,
      totalUrls: input.totalUrls,
      okCount: input.okCount,
      failedCount: input.failedCount,
      summaryMarkdown: text,
      source: "openai",
      model
    };
  } catch (error) {
    const reason = (error as Error).name === "AbortError" ? "timeout" : (error as Error).message;
    return {
      domain: input.domain,
      totalUrls: input.totalUrls,
      okCount: input.okCount,
      failedCount: input.failedCount,
      summaryMarkdown: `${buildFallbackSummary(input)}\n\n> Nota: OpenAI no disponible (${reason}). Se uso resumen fallback.`,
      source: "fallback",
      model
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseDeepNavigationConfig(body: AnalyzeRequestBody): DeepNavigationConfig {
  const enabled = Boolean(body?.deepNavigation);

  const includePaths = Array.isArray(body?.includePaths)
    ? body.includePaths.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];
  const excludePaths = Array.isArray(body?.excludePaths)
    ? body.excludePaths.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];

  return {
    enabled,
    maxDepth: parseBoundedInt(body?.maxDepth, DEFAULT_MAX_DEPTH, 1, ABSOLUTE_MAX_DEPTH),
    maxPages: parseBoundedInt(body?.maxPages, DEFAULT_MAX_PAGES, 1, ABSOLUTE_MAX_PAGES),
    sameDomainOnly: body?.sameDomainOnly !== false,
    includePaths,
    excludePaths
  };
}

function parseDynamicProbeConfig(body: AnalyzeRequestBody): DynamicProbeConfig {
  const probeIncludePaths = Array.isArray(body?.probeIncludePaths)
    ? body.probeIncludePaths.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];
  const probeExcludePaths = Array.isArray(body?.probeExcludePaths)
    ? body.probeExcludePaths.map((item) => String(item).trim()).filter((item) => item.length > 0)
    : [];

  return {
    activeFormProbe: Boolean(body?.activeFormProbe),
    maxFormProbes: parseBoundedInt(body?.maxFormProbes, 1, 1, 3),
    probeIncludePaths,
    probeExcludePaths,
    probeBlockSensitiveEndpoints: body?.probeBlockSensitiveEndpoints !== false
  };
}

function normalizePathPrefix(input: string): string {
  let value = input.trim();
  if (value.length === 0) {
    return "";
  }
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }
  return value.replace(/\/+$/g, "") || "/";
}

function ensureUrl(input: string): string {
  let candidate = input.trim();
  if (candidate.length === 0) {
    throw new Error("empty_url");
  }

  // Accept domain/path inputs without protocol and default to https.
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const parsed = new URL(candidate);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("invalid_protocol");
  }

  return parsed.toString();
}

async function postApi<TResponse>(pathname: string, body: unknown, correlationId: string): Promise<TResponse> {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-correlation-id": correlationId
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? "api_error";
    const errorCode = payload?.errorCode;
    throw new Error(errorCode ? `${message} (${errorCode})` : String(message));
  }

  return payload as TResponse;
}

function parseMode(value: unknown): AnalysisMode {
  return value === "dynamic" ? "dynamic" : "passive";
}

function normalizeForSet(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}

function isHttpUrl(candidate: string): boolean {
  return candidate.startsWith("http://") || candidate.startsWith("https://");
}

function isLikelyPageUrl(candidate: string): boolean {
  const parsed = new URL(candidate);
  const pathname = parsed.pathname.toLowerCase();
  const assetExtensions = [
    ".css",
    ".js",
    ".mjs",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".webp",
    ".ico",
    ".pdf",
    ".xml",
    ".json",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".zip",
    ".mp4",
    ".mp3"
  ];

  return !assetExtensions.some((extension) => pathname.endsWith(extension));
}

function pathMatchesFilters(url: string, includePaths: string[], excludePaths: string[]): boolean {
  const pathname = new URL(url).pathname;

  const normalizedIncludes = includePaths.map(normalizePathPrefix).filter((item) => item.length > 0);
  const normalizedExcludes = excludePaths.map(normalizePathPrefix).filter((item) => item.length > 0);

  if (normalizedExcludes.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (normalizedIncludes.length === 0) {
    return true;
  }

  return normalizedIncludes.some((prefix) => pathname.startsWith(prefix));
}

function extractLinksFromHtml(html: string, pageUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]?.trim();
    if (!href) {
      continue;
    }
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      href.startsWith("data:")
    ) {
      continue;
    }

    try {
      const resolved = new URL(href, pageUrl);
      resolved.hash = "";
      links.push(resolved.toString());
    } catch {
      // Ignore malformed links from the source page.
    }
  }

  return links;
}

function extractPassiveFormSignals(html: string): PassiveFormSignals {
  const formMatches = html.match(/<form\b/gi) ?? [];
  const formCount = formMatches.length;

  const possibleFieldTokens: string[] = [];
  const attrRegex = /(name|id|placeholder)\s*=\s*["']([^"']+)["']/gi;
  let attrMatch: RegExpExecArray | null;

  while ((attrMatch = attrRegex.exec(html)) !== null) {
    const value = String(attrMatch[2] ?? "").trim();
    if (value.length > 0) {
      possibleFieldTokens.push(value.toLowerCase());
    }
  }

  const piiPatterns: Array<{ label: string; test: RegExp }> = [
    { label: "email", test: /email|correo|e-mail/ },
    { label: "phone", test: /phone|telefono|celular|movil|whatsapp/ },
    { label: "name", test: /nombre|name|apellido|lastname|firstname/ },
    { label: "id_number", test: /rut|dni|documento|idnumber|cedula/ },
    { label: "address", test: /direccion|address|calle|comuna|ciudad/ },
    { label: "company", test: /empresa|company|organizacion|organization/ },
    { label: "message", test: /mensaje|message|comentario|comment/ }
  ];

  const detected = new Set<string>();
  for (const token of possibleFieldTokens) {
    for (const pattern of piiPatterns) {
      if (pattern.test.test(token)) {
        detected.add(pattern.label);
      }
    }
  }

  return {
    formDetected: formCount > 0,
    formCount,
    potentialPiiFields: Array.from(detected)
  };
}

type FormProbeCandidate = {
  actionUrl: string;
  method: "GET" | "POST";
  fieldNames: string[];
};

type FormProbeResult = {
  attempted: boolean;
  submitRequestObserved: boolean;
  method?: string;
  actionUrl?: string;
  statusHttp?: number;
  note?: string;
  networkDelta: number;
  interactionDelta: number;
  cookieDelta: number;
  thirdPartyDomain?: string;
};

function extractFormProbeCandidates(html: string, pageUrl: string): FormProbeCandidate[] {
  const candidates: FormProbeCandidate[] = [];
  const formRegex = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let formMatch: RegExpExecArray | null;

  while ((formMatch = formRegex.exec(html)) !== null) {
    const attrs = String(formMatch[1] ?? "");
    const inner = String(formMatch[2] ?? "");
    const actionMatch = attrs.match(/action\s*=\s*["']([^"']+)["']/i);
    const methodMatch = attrs.match(/method\s*=\s*["']([^"']+)["']/i);

    const methodRaw = String(methodMatch?.[1] ?? "GET").toUpperCase();
    const method: "GET" | "POST" = methodRaw === "POST" ? "POST" : "GET";
    const actionRaw = String(actionMatch?.[1] ?? "").trim();

    if (actionRaw.startsWith("mailto:") || actionRaw.startsWith("javascript:")) {
      continue;
    }

    const actionUrl = new URL(actionRaw || pageUrl, pageUrl).toString();
    const fieldNames = Array.from(
      new Set(
        Array.from(inner.matchAll(/<(input|textarea|select)\b[^>]*(name|id)\s*=\s*["']([^"']+)["']/gi))
          .map((m) => String(m[3] ?? "").trim())
          .filter((item) => item.length > 0)
      )
    );

    candidates.push({ actionUrl, method, fieldNames });
  }

  return candidates;
}

function buildSyntheticFieldValue(fieldName: string): string {
  const key = fieldName.toLowerCase();
  if (/mail|correo|email/.test(key)) return "probe@example.test";
  if (/name|nombre|apellido/.test(key)) return "Probe User";
  if (/phone|telefono|celular|movil/.test(key)) return "+56900000000";
  if (/company|empresa|org/.test(key)) return "Probe Company";
  if (/message|mensaje|comentario/.test(key)) return "Controlled probe message";
  return "probe-value";
}

function getCookieNamesFromHeaders(headers: Headers): string[] {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const setCookies = typeof withSetCookie.getSetCookie === "function" ? withSetCookie.getSetCookie() : [];
  return Array.from(
    new Set(
      setCookies
        .map((raw) => raw.split(";")[0] ?? "")
        .map((pair) => {
          const eq = pair.indexOf("=");
          return eq > 0 ? pair.slice(0, eq).trim() : "";
        })
        .filter((name) => name.length > 0)
    )
  );
}

async function runControlledFormProbe(input: {
  entryUrl: string;
  html: string;
  timeoutMs: number;
  maxFormProbes: number;
  probeIncludePaths: string[];
  probeExcludePaths: string[];
  probeBlockSensitiveEndpoints: boolean;
}): Promise<FormProbeResult> {
  const includePaths = input.probeIncludePaths;
  const excludePaths = [
    ...input.probeExcludePaths,
    ...(input.probeBlockSensitiveEndpoints ? DEFAULT_SENSITIVE_PROBE_PATH_PREFIXES : [])
  ];

  const filteredCandidates = extractFormProbeCandidates(input.html, input.entryUrl).filter((candidate) =>
    pathMatchesFilters(candidate.actionUrl, includePaths, excludePaths)
  );
  const candidates = filteredCandidates.slice(0, input.maxFormProbes);
  if (candidates.length === 0) {
    return {
      attempted: false,
      submitRequestObserved: false,
      note: "no_form_candidates_after_probe_filters",
      networkDelta: 0,
      interactionDelta: 0,
      cookieDelta: 0
    };
  }

  const originHost = new URL(input.entryUrl).hostname.toLowerCase();
  const candidate = candidates[0];
  const actionHost = new URL(candidate.actionUrl).hostname.toLowerCase();
  if (actionHost !== originHost) {
    return {
      attempted: false,
      submitRequestObserved: false,
      method: candidate.method,
      actionUrl: candidate.actionUrl,
      note: "skipped_cross_domain_action",
      networkDelta: 0,
      interactionDelta: 0,
      cookieDelta: 0,
      thirdPartyDomain: actionHost
    };
  }

  const payload = new URLSearchParams();
  for (const name of candidate.fieldNames) {
    payload.set(name, buildSyntheticFieldValue(name));
  }
  payload.set("web_analysis_probe", "true");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(3000, input.timeoutMs));
  const startedAt = new Date().toISOString();

  try {
    const requestUrl =
      candidate.method === "GET"
        ? (() => {
            const parsed = new URL(candidate.actionUrl);
            for (const [k, v] of payload.entries()) {
              parsed.searchParams.set(k, v);
            }
            return parsed.toString();
          })()
        : candidate.actionUrl;

    const response = await fetch(requestUrl, {
      method: candidate.method,
      headers:
        candidate.method === "POST"
          ? {
              "content-type": "application/x-www-form-urlencoded",
              "x-web-analysis-probe": "true"
            }
          : { "x-web-analysis-probe": "true" },
      body: candidate.method === "POST" ? payload.toString() : undefined,
      redirect: "follow",
      signal: controller.signal
    });

    const cookieNames = getCookieNamesFromHeaders(response.headers);
    const _finishedAt = new Date().toISOString();
    void _finishedAt;
    void startedAt;

    return {
      attempted: true,
      submitRequestObserved: true,
      method: candidate.method,
      actionUrl: response.url || candidate.actionUrl,
      statusHttp: response.status,
      note: "probe_request_sent",
      networkDelta: 1,
      interactionDelta: 1,
      cookieDelta: cookieNames.length,
      thirdPartyDomain: resolveThirdPartyDomain(input.entryUrl, response.url || candidate.actionUrl)
    };
  } catch (error) {
    return {
      attempted: true,
      submitRequestObserved: false,
      method: candidate.method,
      actionUrl: candidate.actionUrl,
      note: `probe_failed:${(error as Error).name}`,
      networkDelta: 0,
      interactionDelta: 1,
      cookieDelta: 0
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectVendorsFromText(sourceText: string, patterns: Array<{ vendor: string; pattern: RegExp }>): string[] {
  const found = new Set<string>();
  for (const item of patterns) {
    if (item.pattern.test(sourceText)) {
      found.add(item.vendor);
    }
  }
  return Array.from(found);
}

function extractCaptureSignalsFromHtml(html: string, pageUrl: string): CaptureSignals {
  const formSignals = extractPassiveFormSignals(html);
  const scriptRegex = /<script\b[^>]*src=["']([^"']+)["'][^>]*>|<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const scriptTokens: string[] = [];

  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    const src = scriptMatch[1];
    const inline = scriptMatch[2];
    if (src) {
      try {
        scriptTokens.push(new URL(src, pageUrl).toString());
      } catch {
        scriptTokens.push(src);
      }
    }
    if (inline) {
      scriptTokens.push(inline.slice(0, 500));
    }
  }

  const textCorpus = [html.slice(0, 5000), ...scriptTokens].join("\n");
  const analyticsVendors = detectVendorsFromText(textCorpus, ANALYTICS_PATTERNS);
  const chatVendors = detectVendorsFromText(textCorpus, CHAT_PATTERNS);

  const thirdPartyDomains: string[] = Array.from(
    new Set<string>(
      scriptTokens
        .filter((token) => token.startsWith("http://") || token.startsWith("https://"))
        .map((token): string => {
          try {
            return new URL(token).hostname.toLowerCase();
          } catch {
            return "";
          }
        })
        .filter((token: string) => token.length > 0)
    )
  );

  const behaviorSignals: string[] = [];
  if (/onSubmit|addEventListener\(['"]submit['"]|fetch\(|axios\(|XMLHttpRequest/i.test(html)) {
    behaviorSignals.push("html_submit_or_network_hook_detected");
  }
  if (/localStorage|sessionStorage|document\.cookie/i.test(html)) {
    behaviorSignals.push("html_storage_or_cookie_usage_detected");
  }

  const evidenceLevel: CaptureSignals["evidenceLevel"] =
    formSignals.formCount > 0 || analyticsVendors.length > 0 || chatVendors.length > 0 || behaviorSignals.length > 0
      ? "potential"
      : "none";

  return {
    evidenceLevel,
    formsDetected: formSignals.formCount,
    potentialPiiFields: formSignals.potentialPiiFields,
    cookieCount: 0,
    analyticsDetected: analyticsVendors.length > 0,
    analyticsVendors,
    chatDetected: chatVendors.length > 0,
    chatVendors,
    thirdPartyDomains,
    behaviorSignals
  };
}

function extractCaptureSignalsFromDynamic(observation: any): CaptureSignals {
  const domHtml = typeof observation?.data?.domHtml === "string" ? observation.data.domHtml : "";
  const entryUrl = typeof observation?.data?.entryUrl === "string" ? observation.data.entryUrl : "https://localhost/";
  const fromHtml = extractCaptureSignalsFromHtml(domHtml, entryUrl);

  const network = Array.isArray(observation?.data?.network) ? observation.data.network : [];
  const storage = Array.isArray(observation?.data?.storage) ? observation.data.storage : [];
  const events = Array.isArray(observation?.data?.events) ? observation.data.events : [];

  const thirdPartyDomains: string[] = Array.from(
    new Set<string>(
      network
        .map((item: any): string => (typeof item?.thirdPartyDomain === "string" ? item.thirdPartyDomain.toLowerCase() : ""))
        .filter((item: string) => item.length > 0)
    )
  );

  const networkText = network
    .map((item: any) => `${String(item?.url ?? "")} ${String(item?.method ?? "")}`)
    .join("\n");

  const analyticsFromNetwork = detectVendorsFromText(networkText, ANALYTICS_PATTERNS);
  const chatFromNetwork = detectVendorsFromText(networkText, CHAT_PATTERNS);
  const analyticsVendors = Array.from(new Set([...fromHtml.analyticsVendors, ...analyticsFromNetwork]));
  const chatVendors = Array.from(new Set([...fromHtml.chatVendors, ...chatFromNetwork]));

  const cookieCount = storage.filter((item: any) => String(item?.kind) === "COOKIE").length;
  const behaviorSignals = [...fromHtml.behaviorSignals];

  const hasSubmitEvent = events.some((item: any) => /submit/i.test(String(item?.eventType ?? "")));
  const hasPostLikeRequest = network.some((item: any) => /POST|PUT|PATCH/i.test(String(item?.method ?? "")));

  if (events.length > 1) {
    behaviorSignals.push("runtime_interaction_detected");
  }
  if (hasPostLikeRequest) {
    behaviorSignals.push("runtime_post_like_request_detected");
  }
  if (cookieCount > 0) {
    behaviorSignals.push("runtime_cookie_signal_detected");
  }

  const evidenceLevel: CaptureSignals["evidenceLevel"] =
    hasSubmitEvent || hasPostLikeRequest
      ? "confirmed"
      : fromHtml.formsDetected > 0 || analyticsVendors.length > 0 || chatVendors.length > 0 || behaviorSignals.length > 0
        ? "potential"
        : "none";

  return {
    evidenceLevel,
    formsDetected: fromHtml.formsDetected,
    potentialPiiFields: fromHtml.potentialPiiFields,
    cookieCount,
    analyticsDetected: analyticsVendors.length > 0,
    analyticsVendors,
    chatDetected: chatVendors.length > 0,
    chatVendors,
    thirdPartyDomains,
    behaviorSignals: Array.from(new Set(behaviorSignals))
  };
}

async function inspectPassiveSignals(url: string): Promise<{ formSignals: PassiveFormSignals; captureSignals: CaptureSignals }> {
  const html = await fetchHtmlForDiscovery(url);
  if (!html) {
    return {
      formSignals: {
        formDetected: false,
        formCount: 0,
        potentialPiiFields: []
      },
      captureSignals: {
        evidenceLevel: "none",
        formsDetected: 0,
        potentialPiiFields: [],
        cookieCount: 0,
        analyticsDetected: false,
        analyticsVendors: [],
        chatDetected: false,
        chatVendors: [],
        thirdPartyDomains: [],
        behaviorSignals: []
      }
    };
  }

  return {
    formSignals: extractPassiveFormSignals(html),
    captureSignals: extractCaptureSignalsFromHtml(html, url)
  };
}

async function fetchHtmlForDiscovery(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return undefined;
    }

    const contentType = String(response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) {
      return undefined;
    }

    const html = await response.text();
    return html.slice(0, 1_000_000);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function expandUrlsWithDeepNavigation(seedUrls: string[], config: DeepNavigationConfig): Promise<string[]> {
  if (!config.enabled || config.maxDepth <= 0 || config.maxPages <= seedUrls.length) {
    return seedUrls;
  }

  const visited = new Set<string>();
  const queue: CrawlQueueItem[] = seedUrls.map((url) => ({ url, depth: 0 }));
  const discovered: string[] = [];
  const firstHost = new URL(seedUrls[0]).hostname;
  const seedSet = new Set(seedUrls.map((url) => normalizeForSet(url)));

  while (queue.length > 0 && discovered.length < config.maxPages) {
    const current = queue.shift() as CrawlQueueItem;
    const normalizedCurrent = normalizeForSet(current.url);

    if (visited.has(normalizedCurrent)) {
      continue;
    }
    visited.add(normalizedCurrent);

    if (!isHttpUrl(normalizedCurrent)) {
      continue;
    }

    const currentHost = new URL(normalizedCurrent).hostname;
    if (config.sameDomainOnly && currentHost !== firstHost) {
      continue;
    }

    const isSeed = seedSet.has(normalizedCurrent);
    if (isSeed || pathMatchesFilters(normalizedCurrent, config.includePaths, config.excludePaths)) {
      discovered.push(normalizedCurrent);
    }

    if (current.depth >= config.maxDepth || discovered.length >= config.maxPages) {
      continue;
    }

    const html = await fetchHtmlForDiscovery(normalizedCurrent);
    if (!html) {
      continue;
    }

    const links = extractLinksFromHtml(html, normalizedCurrent);
    for (const link of links) {
      const normalizedLink = normalizeForSet(link);
      if (visited.has(normalizedLink)) {
        continue;
      }
      if (!isLikelyPageUrl(normalizedLink)) {
        continue;
      }
      if (!pathMatchesFilters(normalizedLink, config.includePaths, config.excludePaths)) {
        continue;
      }

      const linkHost = new URL(normalizedLink).hostname;
      if (config.sameDomainOnly && linkHost !== firstHost) {
        continue;
      }

      queue.push({ url: normalizedLink, depth: current.depth + 1 });
    }
  }

  return discovered;
}

async function runSingleAnalysis(
  url: string,
  mode: AnalysisMode,
  index: number,
  probeConfig: DynamicProbeConfig
): Promise<AnalyzeResultItem> {
  const analyzedAt = new Date().toISOString();
  const hostname = new URL(url).hostname;
  const correlationId = `web-ui-${Date.now()}-${index}`;

  try {
    const org = await postApi<{ data: { id: string } }>(
      "/organizations",
      { name: `Auto Org ${hostname}` },
      correlationId
    );

    const project = await postApi<{ data: { id: string } }>(
      "/projects",
      { organizationId: org.data.id, name: `Auto Project ${hostname}` },
      correlationId
    );

    const validFrom = new Date(Date.now() - 60_000).toISOString();
    const validTo = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const authorization = await postApi<{ data: { id: string } }>(
      "/authorizations",
      {
        projectId: project.data.id,
        validFrom,
        validTo,
        allowedDomains: [hostname],
        allowSubdomains: true,
        permittedOperations: ["SCAN_PASSIVE", "OBSERVE_DYNAMIC"],
        maxConcurrentExecutions: 3,
        maxDurationSeconds: 120,
        agentId: "web-analyzer-ui"
      },
      correlationId
    );

    const target = await postApi<{ data: { id: string } }>(
      "/targets",
      {
        projectId: project.data.id,
        authorizationId: authorization.data.id,
        baseUrl: `${new URL(url).origin}/`
      },
      correlationId
    );

    const execution = await postApi<{ data: { id: string } }>(
      "/executions",
      {
        projectId: project.data.id,
        authorizationId: authorization.data.id,
        targetId: target.data.id,
        operation: mode === "dynamic" ? "OBSERVE_DYNAMIC" : "SCAN_PASSIVE",
        entryUrl: url
      },
      correlationId
    );

    if (mode === "dynamic") {
      const observation = await postApi<any>(
        "/browser/observations/start",
        {
          executionId: execution.data.id,
          entryUrl: url,
          timeoutMs: 15_000,
          maxEvents: 150
        },
        correlationId
      );

      if (observation?.ok) {
        const passiveSignals = await inspectPassiveSignals(url);
        const dynamicSignals = extractCaptureSignalsFromDynamic(observation);
        const probeResult = probeConfig.activeFormProbe
          ? await runControlledFormProbe({
              entryUrl: url,
              html: await (await fetchHtmlForDiscovery(url))?.toString() ?? "",
              timeoutMs: 15_000,
              maxFormProbes: probeConfig.maxFormProbes,
              probeIncludePaths: probeConfig.probeIncludePaths,
              probeExcludePaths: probeConfig.probeExcludePaths,
              probeBlockSensitiveEndpoints: probeConfig.probeBlockSensitiveEndpoints
            })
          : {
              attempted: false,
              submitRequestObserved: false,
              note: "probe_disabled",
              networkDelta: 0,
              interactionDelta: 0,
              cookieDelta: 0
            };

        const mergedAnalytics = Array.from(
          new Set([...(passiveSignals.captureSignals.analyticsVendors ?? []), ...(dynamicSignals.analyticsVendors ?? [])])
        );
        const mergedChats = Array.from(
          new Set([...(passiveSignals.captureSignals.chatVendors ?? []), ...(dynamicSignals.chatVendors ?? [])])
        );
        const mergedThirdParties = Array.from(
          new Set([
            ...(passiveSignals.captureSignals.thirdPartyDomains ?? []),
            ...(dynamicSignals.thirdPartyDomains ?? []),
            ...(probeResult.thirdPartyDomain ? [probeResult.thirdPartyDomain] : [])
          ])
        );
        const mergedBehavior = Array.from(
          new Set([
            ...(passiveSignals.captureSignals.behaviorSignals ?? []),
            ...(dynamicSignals.behaviorSignals ?? []),
            ...(probeResult.attempted ? ["controlled_form_probe_attempted"] : []),
            ...(probeResult.submitRequestObserved ? ["controlled_form_probe_request_observed"] : [])
          ])
        );

        const evidenceLevel: CaptureSignals["evidenceLevel"] =
          probeResult.submitRequestObserved || dynamicSignals.evidenceLevel === "confirmed"
            ? "confirmed"
            : passiveSignals.captureSignals.evidenceLevel === "potential" || dynamicSignals.evidenceLevel === "potential"
              ? "potential"
              : "none";

        const captureSignals: CaptureSignals = {
          evidenceLevel,
          formsDetected: Math.max(passiveSignals.formSignals.formCount, dynamicSignals.formsDetected),
          potentialPiiFields: Array.from(
            new Set([...(passiveSignals.captureSignals.potentialPiiFields ?? []), ...(dynamicSignals.potentialPiiFields ?? [])])
          ),
          cookieCount: (dynamicSignals.cookieCount ?? 0) + probeResult.cookieDelta,
          analyticsDetected: mergedAnalytics.length > 0,
          analyticsVendors: mergedAnalytics,
          chatDetected: mergedChats.length > 0,
          chatVendors: mergedChats,
          thirdPartyDomains: mergedThirdParties,
          behaviorSignals: mergedBehavior
        };

        return {
          url,
          mode,
          ok: true,
          executionId: execution.data.id,
          analyzedAt,
          title: observation?.data?.pageSnapshots?.[0]?.title,
          formDetected: captureSignals.formsDetected > 0,
          formCount: captureSignals.formsDetected,
          potentialPiiFields: captureSignals.potentialPiiFields,
          captureSignals,
          activeFormProbe: {
            attempted: probeResult.attempted,
            submitRequestObserved: probeResult.submitRequestObserved,
            method: probeResult.method,
            actionUrl: probeResult.actionUrl,
            statusHttp: probeResult.statusHttp,
            note: probeResult.note
          },
          networkRequests:
            (Array.isArray(observation?.data?.network) ? observation.data.network.length : 0) + probeResult.networkDelta,
          storageEvents:
            (Array.isArray(observation?.data?.storage) ? observation.data.storage.length : 0) + probeResult.cookieDelta,
          interactionEvents:
            (Array.isArray(observation?.data?.events) ? observation.data.events.length : 0) + probeResult.interactionDelta,
          raw: observation
        };
      }

      return {
        url,
        mode,
        ok: false,
        executionId: execution.data.id,
        analyzedAt,
        errorCode: observation?.error?.errorCode,
        message: observation?.error?.message ?? "dynamic_observation_failed",
        raw: observation
      };
    }

    const passive = await postApi<any>(
      "/crawler/passive/single-page",
      {
        executionId: execution.data.id,
        entryUrl: url,
        timeoutMs: 15_000,
        maxResponseBytes: 1_500_000
      },
      correlationId
    );

    if (passive?.ok) {
      const passiveSignals = await inspectPassiveSignals(url);
      return {
        url,
        mode,
        ok: true,
        executionId: execution.data.id,
        analyzedAt,
        statusHttp: passive?.data?.statusHttp,
        title: passive?.data?.title,
        evidenceId: passive?.data?.evidenceId,
        contentType: passive?.data?.contentType,
        contentLength: passive?.data?.contentLength,
        formDetected: passiveSignals.formSignals.formDetected,
        formCount: passiveSignals.formSignals.formCount,
        potentialPiiFields: passiveSignals.formSignals.potentialPiiFields,
        captureSignals: passiveSignals.captureSignals,
        raw: passive
      };
    }

    return {
      url,
      mode,
      ok: false,
      executionId: execution.data.id,
      analyzedAt,
      errorCode: passive?.error?.errorCode,
      message: passive?.error?.message ?? "passive_crawl_failed",
      raw: passive
    };
  } catch (error) {
    return {
      url,
      mode,
      ok: false,
      analyzedAt,
      errorCode: "front_proxy_error",
      message: (error as Error).message
    };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`analysis_timeout_${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

app.get("/api/config", (_req, res) => {
  res.json({
    apiBaseUrl,
    modeDefault: "passive",
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini"
  });
});

app.post("/api/analyze", async (req, res) => {
  const body = req.body as AnalyzeRequestBody;
  const mode = parseMode(body?.mode);
  const deepNavigation = parseDeepNavigationConfig(body);
  const probeConfig = parseDynamicProbeConfig(body);
  const timeoutMs =
    typeof body?.timeoutMs === "number" && Number.isFinite(body.timeoutMs)
      ? Math.max(5_000, Math.min(120_000, Math.trunc(body.timeoutMs)))
      : 30_000;
  const inputUrls = Array.isArray(body?.urls) ? body.urls : [];

  const normalizedUrls: string[] = [];

  try {
    for (const item of inputUrls) {
      normalizedUrls.push(ensureUrl(String(item)));
    }
  } catch (error) {
    res.status(400).json({ error: `invalid_url_input: ${(error as Error).message}` });
    return;
  }

  if (normalizedUrls.length === 0) {
    res.status(400).json({ error: "at_least_one_url_required" });
    return;
  }

  const uniqueUrls = Array.from(new Set(normalizedUrls.map((url) => normalizeForSet(url))));
  const scopedUrls = await expandUrlsWithDeepNavigation(uniqueUrls, deepNavigation);
  const startedAt = Date.now();
  const results: AnalyzeResultItem[] = [];

  for (let index = 0; index < scopedUrls.length; index += 1) {
    const url = scopedUrls[index];
    let result: AnalyzeResultItem;
    try {
      result = await withTimeout(runSingleAnalysis(url, mode, index, probeConfig), timeoutMs);
    } catch (error) {
      result = {
        url,
        mode,
        ok: false,
        analyzedAt: new Date().toISOString(),
        errorCode: "analysis_timeout",
        message: (error as Error).message
      };
    }
    results.push(result);
  }

  const okCount = results.filter((item) => item.ok).length;
  res.json({
    data: {
      mode,
      deepNavigation: {
        enabled: deepNavigation.enabled,
        maxDepth: deepNavigation.maxDepth,
        maxPages: deepNavigation.maxPages,
        sameDomainOnly: deepNavigation.sameDomainOnly,
        includePaths: deepNavigation.includePaths,
        excludePaths: deepNavigation.excludePaths,
        seedCount: uniqueUrls.length,
        discoveredCount: scopedUrls.length
      },
      dynamicProbe: {
        activeFormProbe: probeConfig.activeFormProbe,
        maxFormProbes: probeConfig.maxFormProbes,
        probeIncludePaths: probeConfig.probeIncludePaths,
        probeExcludePaths: probeConfig.probeExcludePaths,
        probeBlockSensitiveEndpoints: probeConfig.probeBlockSensitiveEndpoints
      },
      total: results.length,
      okCount,
      failedCount: results.length - okCount,
      elapsedMs: Date.now() - startedAt,
      results
    }
  });
});

app.post("/api/executive-summary", async (req, res) => {
  const body = req.body as ExecutiveSummaryRequestBody;
  const language = typeof body?.language === "string" && body.language.trim().length > 0 ? body.language.trim() : "es-CL";
  const requestedModel = typeof body?.model === "string" && body.model.trim().length > 0 ? body.model.trim() : undefined;
  const analysisData = body?.analysis?.data;

  if (!analysisData || !Array.isArray(analysisData.results) || analysisData.results.length === 0) {
    res.status(400).json({ error: "analysis_results_required" });
    return;
  }

  const domainInputs = toDomainInputs(analysisData);
  const summaries: ExecutiveSummaryOutput[] = [];

  for (const input of domainInputs) {
    const generated = await generateSummaryWithOpenAi(input, language, requestedModel);
    summaries.push(generated);
  }

  res.json({
    data: {
      generatedAt: new Date().toISOString(),
      language,
      domains: domainInputs.length,
      summaries
    }
  });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

const port = Number(process.env.WEB_PORT ?? process.env.KANBAN_PORT ?? 4173);
export { app };

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[web-analyzer] running on http://localhost:${port}`);
    console.log(`[web-analyzer] using API base ${apiBaseUrl}`);
  });
}
