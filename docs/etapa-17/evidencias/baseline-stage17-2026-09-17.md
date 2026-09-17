# Registro baseline Stage 17

- generated_at: 2026-09-17T04:05:46.801Z
- status: OK
- commands:
  - npm run lab:e17:gate
  - npm run docs:stage17:evidence:json

## lab:e17:gate - OK

- exit_code: 0
- duration_ms: 10025

### stdout
```text
> web-analysis@0.1.0 lab:e17:gate
> npm run lab:e17-3:gate


> web-analysis@0.1.0 lab:e17-3:gate
> npm run lab:e17-2:gate && npm run docs:stage17:runbook && npm run docs:stage17:evidence


> web-analysis@0.1.0 lab:e17-2:gate
> npm run lab:e17-1:gate && vitest run --config vitest.integration.config.ts --run --pool=forks tests/integration/stage17-retention-window.integration.test.ts


> web-analysis@0.1.0 lab:e17-1:gate
> npm run lab:e16:gate && vitest run --config vitest.integration.config.ts --run --pool=forks tests/integration/stage17-execution-data-purge.integration.test.ts


> web-analysis@0.1.0 lab:e16:gate
> vitest run --config vitest.integration.config.ts --run --pool=forks tests/integration/stage16-version-comparison.integration.test.ts tests/integration/stage16-endpoint-delta.integration.test.ts tests/integration/stage16-alert-classification.integration.test.ts


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mC:/Users/TECH/OneDrive/Documentos/BE_AI_Consulting/Web_Analysis[39m

 [32m✓[39m tests/integration/stage16-alert-classification.integration.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 338[2mms[22m[39m
 [32m✓[39m tests/integration/stage16-version-comparison.integration.test.ts [2m([22m[2m2 tests[22m[2m)[22m[90m 273[2mms[22m[39m
 [32m✓[39m tests/integration/stage16-endpoint-delta.integration.test.ts [2m([22m[2m1 test[22m[2m)[22m[90m 220[2mms[22m[39m

[2m Test Files [22m [1m[32m3 passed[39m[22m[90m (3)[39m
[2m      Tests [22m [1m[32m5 passed[39m[22m[90m (5)[39m
[2m   Start at [22m 01:05:38
[2m   Duration [22m 2.80s[2m (transform 244ms, setup 0ms, collect 1.20s, tests 831ms, environment 1ms, prepare 258ms)[22m


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mC:/Users/TECH/OneDrive/Documentos/BE_AI_Consulting/Web_Analysis[39m

 [32m✓[39m tests/integration/stage17-execution-data-purge.integration.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 367[2mms[22m[39m
   [33m[2m✓[22m[39m Etapa 17 T01 purga de datos por ejecucion[2m > [22melimina resultados y artefactos de una ejecucion manteniendo trazabilidad de error esperada [33m354[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m   Start at [22m 01:05:42
[2m   Duration [22m 1.17s[2m (transform 183ms, setup 0ms, collect 540ms, tests 367ms, environment 0ms, prepare 88ms)[22m


[1m[7m[36m RUN [39m[27m[22m [36mv2.1.9 [39m[90mC:/Users/TECH/OneDrive/Documentos/BE_AI_Consulting/Web_Analysis[39m

 [32m✓[39m tests/integration/stage17-retention-window.integration.test.ts [2m([22m[2m2 tests[22m[2m)[22m[90m 217[2mms[22m[39m

[2m Test Files [22m [1m[32m1 passed[39m[22m[90m (1)[39m
[2m      Tests [22m [1m[32m2 passed[39m[22m[90m (2)[39m
[2m   Start at [22m 01:05:43
[2m   Duration [22m 1.02s[2m (transform 180ms, setup 0ms, collect 545ms, tests 217ms, environment 0ms, prepare 82ms)[22m


> web-analysis@0.1.0 docs:stage17:runbook
> tsx tools/validate-stage17-runbook.ts

[docs:stage17:runbook] OK

> web-analysis@0.1.0 docs:stage17:evidence
> tsx tools/validate-stage17-pilot-evidence.ts

[docs:stage17:evidence] OK
```

### stderr
```text
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m
[33mThe CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.[39m
```
## docs:stage17:evidence:json - OK

- exit_code: 0
- duration_ms: 565

### stdout
```text
> web-analysis@0.1.0 docs:stage17:evidence:json
> tsx tools/validate-stage17-pilot-evidence.ts --json

{
  "ok": true,
  "checkedAt": "2026-09-17T04:05:46.759Z",
  "latestEvidenceFile": "piloto-e2e-controlado-2026-09-04.json",
  "expectedBitacoraFile": "bitacora-corrida-piloto-e2e-2026-09-04.md",
  "issues": [],
  "checks": {
    "stage17DirExists": true,
    "evidenceDirExists": true,
    "hasEvidenceJson": true,
    "hasAnyBitacora": true,
    "latestEvidenceJsonValid": true,
    "latestBitacoraExists": true
  }
}
```

### stderr
```text

```
