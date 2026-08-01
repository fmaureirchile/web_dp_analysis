import fs from "node:fs";
import path from "node:path";

type Manifest = {
  manifestVersion: string;
  stage: string;
  meta: {
    siteId: string;
    slug: string;
    name: string;
    scenarioType: string;
  };
  description: string;
  routes: Record<string, string>;
  expectedSignals: string[];
  assertions: Record<string, unknown>;
  negativeExpectations: string[];
};

type Fixture = {
  scenarioId: string;
  stage: string;
  site: string;
  request: {
    method: string;
    path: string;
    payload: Record<string, unknown>;
  };
  expected: {
    status: number;
    signal: string;
  };
  manifestRef: string;
};

const rootDir = process.cwd();
const goldenDir = path.join(rootDir, "test-lab", "golden-results");
const fixtureDir = path.join(rootDir, "test-lab", "fixtures");

function fail(message: string): never {
  throw new Error(`[lab:manifests:validate] ${message}`);
}

function readJsonFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function ensure(condition: unknown, message: string): void {
  if (!condition) {
    fail(message);
  }
}

function validateManifest(filePath: string, manifest: Manifest): void {
  ensure(/^\d+\.\d+\.\d+$/.test(manifest.manifestVersion), `${filePath}: manifestVersion invalida`);
  ensure(manifest.stage === "E4", `${filePath}: stage debe ser E4`);
  ensure(/^[A-F]$/.test(manifest.meta.siteId), `${filePath}: meta.siteId invalido`);
  ensure(manifest.meta.slug.length > 2, `${filePath}: meta.slug vacio o invalido`);
  ensure(manifest.meta.name.length > 2, `${filePath}: meta.name vacio o invalido`);
  ensure(manifest.meta.scenarioType.length > 2, `${filePath}: meta.scenarioType vacio o invalido`);
  ensure(manifest.description.length >= 10, `${filePath}: description demasiado corta`);

  ensure(typeof manifest.routes.entry === "string" && manifest.routes.entry.startsWith("/"), `${filePath}: routes.entry invalida`);
  ensure(typeof manifest.routes.health === "string" && manifest.routes.health.startsWith("/"), `${filePath}: routes.health invalida`);

  for (const [key, value] of Object.entries(manifest.routes)) {
    ensure(typeof value === "string" && value.startsWith("/"), `${filePath}: routes.${key} debe iniciar con /`);
  }

  ensure(Array.isArray(manifest.expectedSignals) && manifest.expectedSignals.length > 0, `${filePath}: expectedSignals debe tener al menos un item`);
  ensure(typeof manifest.assertions === "object" && manifest.assertions !== null && Object.keys(manifest.assertions).length > 0, `${filePath}: assertions vacio`);
  ensure(Array.isArray(manifest.negativeExpectations), `${filePath}: negativeExpectations debe ser array`);
}

function validateFixture(filePath: string, fixture: Fixture): void {
  ensure(fixture.stage === "E4", `${filePath}: stage debe ser E4`);
  ensure(fixture.scenarioId.length > 4, `${filePath}: scenarioId invalido`);
  ensure(fixture.site.length > 2, `${filePath}: site invalido`);
  ensure(["GET", "POST", "PUT", "PATCH", "DELETE"].includes(fixture.request.method.toUpperCase()), `${filePath}: request.method invalido`);
  ensure(fixture.request.path.startsWith("/"), `${filePath}: request.path debe iniciar con /`);
  ensure(Number.isInteger(fixture.expected.status) && fixture.expected.status >= 100, `${filePath}: expected.status invalido`);
  ensure(fixture.expected.signal.length > 2, `${filePath}: expected.signal invalido`);
  ensure(fixture.manifestRef.endsWith("expected-manifest.json"), `${filePath}: manifestRef invalido`);

  const manifestPath = path.join(rootDir, fixture.manifestRef.replaceAll("/", path.sep));
  ensure(fs.existsSync(manifestPath), `${filePath}: manifestRef no existe (${fixture.manifestRef})`);
}

function collectManifestPaths(): string[] {
  const entries = fs.readdirSync(goldenDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("sitio-"))
    .map((entry) => path.join(goldenDir, entry.name, "expected-manifest.json"));
}

function collectFixturePaths(): string[] {
  const entries = fs.readdirSync(fixtureDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("sitio-"))
    .map((entry) => path.join(fixtureDir, entry.name, "fixture.json"));
}

function main(): void {
  const schemaPath = path.join(goldenDir, "manifest.schema.json");
  ensure(fs.existsSync(schemaPath), "No existe test-lab/golden-results/manifest.schema.json");

  const manifestPaths = collectManifestPaths();
  ensure(manifestPaths.length === 6, `Se esperaban 6 manifests y se encontraron ${manifestPaths.length}`);

  for (const manifestPath of manifestPaths) {
    ensure(fs.existsSync(manifestPath), `Falta manifest: ${manifestPath}`);
    const manifest = readJsonFile<Manifest>(manifestPath);
    validateManifest(manifestPath, manifest);
  }

  const fixturePaths = collectFixturePaths();
  ensure(fixturePaths.length === 6, `Se esperaban 6 fixtures y se encontraron ${fixturePaths.length}`);

  for (const fixturePath of fixturePaths) {
    ensure(fs.existsSync(fixturePath), `Falta fixture: ${fixturePath}`);
    const fixture = readJsonFile<Fixture>(fixturePath);
    validateFixture(fixturePath, fixture);
  }

  process.stdout.write("[lab:manifests:validate] OK\n");
}

main();
