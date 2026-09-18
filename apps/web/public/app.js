const state = {
  apiBaseUrl: "",
  openAiConfigured: false,
  openAiModel: "unknown",
  running: false,
  summarizing: false,
  lastPayload: null,
  lastSummaryPayload: null,
  items: [],
  filters: {
    status: "all",
    httpGte400: false
  }
};

const elements = {
  urlsInput: document.getElementById("urls-input"),
  urlsFileInput: document.getElementById("urls-file-input"),
  modeSelect: document.getElementById("mode-select"),
  deepNavigationToggle: document.getElementById("deep-navigation-toggle"),
  deepMaxDepth: document.getElementById("deep-max-depth"),
  deepMaxPages: document.getElementById("deep-max-pages"),
  includePathsInput: document.getElementById("include-paths-input"),
  excludePathsInput: document.getElementById("exclude-paths-input"),
  summaryModelInput: document.getElementById("summary-model-input"),
  summaryLanguageInput: document.getElementById("summary-language-input"),
  activeFormProbeToggle: document.getElementById("active-form-probe-toggle"),
  maxFormProbesInput: document.getElementById("max-form-probes-input"),
  probeIncludePathsInput: document.getElementById("probe-include-paths-input"),
  probeExcludePathsInput: document.getElementById("probe-exclude-paths-input"),
  probeBlockSensitiveToggle: document.getElementById("probe-block-sensitive-toggle"),
  apiBase: document.getElementById("api-base"),
  aiConfigHint: document.getElementById("ai-config-hint"),
  analyzeBtn: document.getElementById("analyze-btn"),
  generateSummaryBtn: document.getElementById("generate-summary-btn"),
  downloadSummaryBtn: document.getElementById("download-summary-btn"),
  downloadJsonBtn: document.getElementById("download-json-btn"),
  downloadCsvBtn: document.getElementById("download-csv-btn"),
  statusGrid: document.getElementById("status-grid"),
  runMeta: document.getElementById("run-meta"),
  resultStatusFilter: document.getElementById("result-status-filter"),
  resultHttpFilter: document.getElementById("result-http-filter"),
  resultEmpty: document.getElementById("result-empty"),
  resultTableWrap: document.getElementById("result-table-wrap"),
  resultBody: document.getElementById("result-body"),
  jsonOutput: document.getElementById("json-output"),
  summaryMeta: document.getElementById("summary-meta"),
  summaryOutput: document.getElementById("summary-output")
};

function splitUrls(raw) {
  return raw
    .split(/,|\n|\r/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function parseBoundedInt(value, fallback, min, max) {
  const number = Number.parseInt(String(value), 10);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  if (number < min) return min;
  if (number > max) return max;
  return number;
}

function splitPathFilters(raw) {
  return String(raw ?? "")
    .split(/,|\n|\r/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function unique(values) {
  return Array.from(new Set(values));
}

function safeText(value) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function getVisibleItems() {
  return state.items.filter((item) => {
    if (state.filters.status === "ok" && !item.ok) return false;
    if (state.filters.status === "error" && item.ok) return false;

    if (state.filters.httpGte400) {
      const status = Number(item.statusHttp ?? 0);
      if (!Number.isFinite(status) || status < 400) return false;
    }

    return true;
  });
}

function showStatus(data) {
  const visible = getVisibleItems();
  const items = [
    ["Total", String(data?.total ?? 0)],
    ["OK", String(data?.okCount ?? 0)],
    ["Fallidos", String(data?.failedCount ?? 0)],
    ["Visibles", String(visible.length)],
    ["Tiempo", `${data?.elapsedMs ?? 0} ms`]
  ];

  elements.statusGrid.innerHTML = "";
  for (const [label, value] of items) {
    const box = document.createElement("div");
    box.className = "status-box";
    box.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
    elements.statusGrid.appendChild(box);
  }
}

function renderTable(items) {
  elements.resultBody.innerHTML = "";

  for (const item of items) {
    const tr = document.createElement("tr");

    const metricText =
      item.mode === "dynamic"
        ? `net:${item.networkRequests ?? 0} stor:${item.storageEvents ?? 0} evt:${item.interactionEvents ?? 0}`
        : `bytes:${item.contentLength ?? 0} forms:${item.formCount ?? 0} pii:${Array.isArray(item.potentialPiiFields) ? item.potentialPiiFields.length : 0}`;

    const urlTd = document.createElement("td");
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = item.url;
    urlTd.appendChild(link);

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${item.ok ? "ok" : "fail"}`;
    badge.textContent = item.ok ? "OK" : "ERROR";
    statusTd.appendChild(badge);

    const modeTd = document.createElement("td");
    modeTd.textContent = safeText(item.mode);

    const titleTd = document.createElement("td");
    titleTd.textContent = safeText(item.title);

    const httpTd = document.createElement("td");
    httpTd.textContent = safeText(item.statusHttp);

    const metricsTd = document.createElement("td");
    metricsTd.textContent = metricText;

    const detailTd = document.createElement("td");
    detailTd.textContent = safeText(item.message ?? item.errorCode);

    tr.appendChild(urlTd);
    tr.appendChild(statusTd);
    tr.appendChild(modeTd);
    tr.appendChild(titleTd);
    tr.appendChild(httpTd);
    tr.appendChild(metricsTd);
    tr.appendChild(detailTd);
    elements.resultBody.appendChild(tr);
  }

  if (items.length === 0) {
    elements.resultEmpty.classList.remove("hidden");
    elements.resultTableWrap.classList.add("hidden");
  } else {
    elements.resultEmpty.classList.add("hidden");
    elements.resultTableWrap.classList.remove("hidden");
  }
}

function renderJson(payload) {
  elements.jsonOutput.textContent = JSON.stringify(payload, null, 2);
}

function setButtonsState() {
  elements.analyzeBtn.disabled = state.running || state.summarizing;
  elements.analyzeBtn.textContent = state.running ? "Analizando..." : "Ejecutar analisis";

  elements.generateSummaryBtn.disabled = !state.lastPayload || state.running || state.summarizing;
  elements.generateSummaryBtn.textContent = state.summarizing ? "Generando resumen..." : "Generar resumen ejecutivo";

  const hasData = Boolean(state.lastPayload);
  elements.downloadJsonBtn.disabled = !hasData || state.running || state.summarizing;
  elements.downloadCsvBtn.disabled = !hasData || state.running || state.summarizing;
  elements.downloadSummaryBtn.disabled = !state.lastSummaryPayload || state.running || state.summarizing;
}

function renderSummary(payload) {
  const summaries = payload?.data?.summaries;
  if (!Array.isArray(summaries) || summaries.length === 0) {
    elements.summaryMeta.textContent = "Sin resumen generado";
    elements.summaryOutput.textContent = "No hay resumen disponible.";
    return;
  }

  const blocks = [];
  for (const item of summaries) {
    const sourceLine = `Fuente: ${item.source} | Modelo: ${item.model} | URLs: ${item.totalUrls} | OK: ${item.okCount} | Fallidas: ${item.failedCount}`;
    blocks.push(`## Dominio: ${item.domain}\n${sourceLine}\n\n${item.summaryMarkdown}`);
  }

  elements.summaryMeta.textContent = `${new Date().toLocaleString()} | Dominios: ${summaries.length}`;
  elements.summaryOutput.textContent = blocks.join("\n\n---\n\n");
}

async function generateExecutiveSummary() {
  if (!state.lastPayload) {
    throw new Error("Primero ejecuta un analisis para generar resumen");
  }

  const requestedModel = String(elements.summaryModelInput.value ?? "").trim() || state.openAiModel;
  const language = String(elements.summaryLanguageInput.value ?? "").trim() || "es-CL";

  const response = await fetch("/api/executive-summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      analysis: state.lastPayload,
      language,
      model: requestedModel
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error ?? "No se pudo generar el resumen ejecutivo");
  }

  return payload;
}

function toSummaryMarkdown(payload) {
  const summaries = Array.isArray(payload?.data?.summaries) ? payload.data.summaries : [];
  const intro = [
    "# Resumen ejecutivo por dominio",
    "",
    `Generado: ${payload?.data?.generatedAt ?? new Date().toISOString()}`,
    `Dominios: ${payload?.data?.domains ?? summaries.length}`,
    `Idioma: ${payload?.data?.language ?? "es-CL"}`,
    ""
  ];

  const domainBlocks = summaries.map((item) => {
    return [
      `## ${item.domain}`,
      `- Fuente: ${item.source}`,
      `- Modelo: ${item.model}`,
      `- URLs: ${item.totalUrls} | OK: ${item.okCount} | Fallidas: ${item.failedCount}`,
      "",
      item.summaryMarkdown,
      ""
    ].join("\n");
  });

  return [...intro, ...domainBlocks].join("\n");
}

function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(items) {
  const headers = [
    "url",
    "mode",
    "ok",
    "executionId",
    "analyzedAt",
    "statusHttp",
    "title",
    "contentType",
    "contentLength",
    "formDetected",
    "formCount",
    "potentialPiiFields",
    "networkRequests",
    "storageEvents",
    "interactionEvents",
    "errorCode",
    "message"
  ];

  const lines = [headers.join(",")];

  for (const item of items) {
    const row = headers.map((key) => {
      const value = item[key];
      const normalizedValue = Array.isArray(value) ? value.join(";") : value;
      const raw = normalizedValue === undefined || normalizedValue === null ? "" : String(normalizedValue);
      const escaped = raw.replace(/"/g, '""');
      return `"${escaped}"`;
    });
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

async function fetchConfig() {
  const response = await fetch("/api/config");
  if (!response.ok) {
    throw new Error("No se pudo leer la configuracion del frontend");
  }
  return response.json();
}

async function runAnalysis() {
  const urls = unique(splitUrls(elements.urlsInput.value));
  if (urls.length === 0) {
    throw new Error("Ingresa al menos una URL valida");
  }

  const deepNavigation = Boolean(elements.deepNavigationToggle.checked);
  const maxDepth = parseBoundedInt(elements.deepMaxDepth.value, 1, 1, 4);
  const maxPages = parseBoundedInt(elements.deepMaxPages.value, 10, 1, 50);
  const includePaths = splitPathFilters(elements.includePathsInput.value);
  const excludePaths = splitPathFilters(elements.excludePathsInput.value);
  const activeFormProbe = Boolean(elements.activeFormProbeToggle.checked);
  const maxFormProbes = parseBoundedInt(elements.maxFormProbesInput.value, 1, 1, 3);
  const probeIncludePaths = splitPathFilters(elements.probeIncludePathsInput.value);
  const probeExcludePaths = splitPathFilters(elements.probeExcludePathsInput.value);
  const probeBlockSensitiveEndpoints = Boolean(elements.probeBlockSensitiveToggle.checked);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 150000);

  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        urls,
        mode: elements.modeSelect.value,
        timeoutMs: 30000,
        deepNavigation,
        maxDepth,
        maxPages,
        sameDomainOnly: true,
        includePaths,
        excludePaths,
        activeFormProbe,
        maxFormProbes,
        probeIncludePaths,
        probeExcludePaths,
        probeBlockSensitiveEndpoints
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error ?? "Fallo de analisis");
    }

    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La solicitud excedio el tiempo limite");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function showError(message) {
  elements.runMeta.textContent = message;
  elements.runMeta.classList.add("error");
}

function clearError() {
  elements.runMeta.classList.remove("error");
}

function refreshResultView() {
  const data = state.lastPayload?.data ?? { total: 0, okCount: 0, failedCount: 0, elapsedMs: 0 };
  showStatus(data);
  renderTable(getVisibleItems());
}

async function importUrlsFromFile(file) {
  const text = await file.text();
  const imported = splitUrls(text);
  const existing = splitUrls(elements.urlsInput.value);
  const merged = unique([...existing, ...imported]);
  elements.urlsInput.value = merged.join("\n");
}

function attachEvents() {
  elements.analyzeBtn.addEventListener("click", async () => {
    state.running = true;
    setButtonsState();
    clearError();

    try {
      const payload = await runAnalysis();
      const data = payload?.data ?? {};

      state.lastPayload = payload;
      state.lastSummaryPayload = null;
      state.items = Array.isArray(data.results) ? data.results : [];

      const deepMeta = data.deepNavigation;
      const deepText = deepMeta?.enabled
        ? ` | Profundidad: ON (semillas ${deepMeta.seedCount} -> descubiertas ${deepMeta.discoveredCount}, depth ${deepMeta.maxDepth}, maxPages ${deepMeta.maxPages})`
        : " | Profundidad: OFF";

      const includeText = Array.isArray(deepMeta?.includePaths) && deepMeta.includePaths.length > 0
        ? ` | Include: ${deepMeta.includePaths.join(";")}`
        : "";
      const excludeText = Array.isArray(deepMeta?.excludePaths) && deepMeta.excludePaths.length > 0
        ? ` | Exclude: ${deepMeta.excludePaths.join(";")}`
        : "";

      elements.runMeta.textContent = `${new Date().toLocaleString()} | Modo: ${data.mode} | Total: ${data.total}${deepText}${includeText}${excludeText}`;
      refreshResultView();
      renderJson(payload);
      elements.summaryMeta.textContent = "Sin resumen generado";
      elements.summaryOutput.textContent = "Genera el resumen despues de una corrida para obtener interpretacion asistida por OpenAI por dominio.";
    } catch (error) {
      showError(error?.message ?? "Error inesperado");
      state.lastPayload = null;
      state.lastSummaryPayload = null;
      state.items = [];
      showStatus({ total: 0, okCount: 0, failedCount: 0, elapsedMs: 0 });
      renderTable([]);
      renderJson({ error: String(error?.message ?? error) });
      elements.summaryMeta.textContent = "Sin resumen generado";
      elements.summaryOutput.textContent = "No hay resumen disponible.";
    } finally {
      state.running = false;
      setButtonsState();
    }
  });

  elements.downloadJsonBtn.addEventListener("click", () => {
    if (!state.lastPayload) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    downloadFile(`analysis-results-${timestamp}.json`, JSON.stringify(state.lastPayload, null, 2), "application/json");
  });

  elements.downloadCsvBtn.addEventListener("click", () => {
    if (!state.lastPayload) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    downloadFile(`analysis-results-${timestamp}.csv`, toCsv(getVisibleItems()), "text/csv;charset=utf-8");
  });

  elements.generateSummaryBtn.addEventListener("click", async () => {
    state.summarizing = true;
    clearError();
    setButtonsState();

    try {
      const payload = await generateExecutiveSummary();
      state.lastSummaryPayload = payload;
      renderSummary(payload);
    } catch (error) {
      showError(error?.message ?? "No se pudo generar el resumen");
    } finally {
      state.summarizing = false;
      setButtonsState();
    }
  });

  elements.downloadSummaryBtn.addEventListener("click", () => {
    if (!state.lastSummaryPayload) {
      return;
    }

    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    downloadFile(
      `executive-summary-${timestamp}.md`,
      toSummaryMarkdown(state.lastSummaryPayload),
      "text/markdown;charset=utf-8"
    );
  });

  elements.resultStatusFilter.addEventListener("change", (event) => {
    state.filters.status = event.target.value;
    refreshResultView();
  });

  elements.resultHttpFilter.addEventListener("change", (event) => {
    state.filters.httpGte400 = Boolean(event.target.checked);
    refreshResultView();
  });

  elements.deepNavigationToggle.addEventListener("change", (event) => {
    const enabled = Boolean(event.target.checked);
    elements.deepMaxDepth.disabled = !enabled;
    elements.deepMaxPages.disabled = !enabled;
  });

  elements.activeFormProbeToggle.addEventListener("change", (event) => {
    const enabled = Boolean(event.target.checked);
    elements.maxFormProbesInput.disabled = !enabled;
    elements.probeIncludePathsInput.disabled = !enabled;
    elements.probeExcludePathsInput.disabled = !enabled;
    elements.probeBlockSensitiveToggle.disabled = !enabled;
  });

  elements.urlsFileInput.addEventListener("change", async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      await importUrlsFromFile(file);
      clearError();
      elements.runMeta.textContent = `Archivo cargado: ${file.name}`;
    } catch {
      showError("No se pudo leer el archivo cargado");
    } finally {
      input.value = "";
    }
  });
}

async function bootstrap() {
  const config = await fetchConfig();
  state.apiBaseUrl = String(config?.apiBaseUrl ?? "");
  state.openAiConfigured = Boolean(config?.openAiConfigured);
  state.openAiModel = String(config?.openAiModel ?? "gpt-4o-mini");
  elements.apiBase.value = state.apiBaseUrl;
  elements.summaryModelInput.value = state.openAiModel;
  elements.aiConfigHint.textContent = state.openAiConfigured
    ? `OpenAI configurado. Modelo activo: ${state.openAiModel}.`
    : "OpenAI no configurado (se usara fallback local para el resumen).";

  showStatus({ total: 0, okCount: 0, failedCount: 0, elapsedMs: 0 });
  renderTable([]);
  renderJson({});
  renderSummary(null);
  setButtonsState();
  attachEvents();
}

bootstrap().catch((error) => {
  showError(error?.message ?? "No se pudo inicializar la app");
});
