# Punto de control - 2026-09-06

## Estado operativo de la ventana

1. `npm run lab:e17:gate` no disponible en el package actual (`Missing script`).
2. Validacion alternativa ejecutada: `npm run lab:e4b1:gate` en verde (exit code 0).
3. Evidencia de `lab:e4b1:gate`:
- `lab:manifests:validate`: OK.
- `lab:test` (vitest lab): 6 archivos y 23 tests en verde.

## Estado de repositorio

1. Rama: `main`.
2. HEAD: `a142055`.
3. Working tree: 30 archivos modificados y 6 no trackeados.

## Causa de desvio respecto de Stage 17

1. El script `lab:e17:gate` no existe hoy en `package.json`.
2. Para mantener continuidad de validacion se uso el siguiente gate disponible y estable del repo (`lab:e4b1:gate`).

## Comandos de continuidad recomendados

1. `npm run lab:e4b1:gate`
Cuando usarlo: para validacion rapida de manifiestos + test lab en la ventana actual.
Resultado esperado: exit code 0, manifests OK, tests en verde.

2. `npm run docs:stage5:coherence`
Cuando usarlo: despues de cambios documentales en Stage 5.
Resultado esperado: `[docs:stage5:coherence] OK`.

## Siguiente verificacion sugerida

1. Confirmar en historial de Git cuando se removio `lab:e17:gate` y documentar el reemplazo oficial en `package.json`.

## Resultado de verificacion historica (opcion 2)

1. No existe commit alcanzable que elimine `lab:e17:gate`; en `HEAD` el script sigue definido.
2. Evidencia en `HEAD:package.json`:
- `lab:e17:gate`: `npm run lab:e17-3:gate`.
- aliases: `lab:e17:legacy` y `lab:e17`.
- validadores relacionados: `docs:stage17:runbook`, `docs:stage17:evidence`, `docs:stage17:evidence:json`.
3. Causa del fallo observado hoy: eliminacion local no confirmada en el working tree actual (bloque `- "lab:e17*"` visible en `git diff -- package.json`).
4. Trazabilidad de incorporacion/ajuste historico:
- `25449fc` agrega `lab:e17:gate` (Stage 17 T01).
- `e36b07b` consolida alias `lab:e17:legacy` y `lab:e17` (Stage 17 T04).

## Continuacion precisa (restauracion y validacion)

1. Se restauro en `package.json` el bloque de scripts removidos para etapas E6-E17, incluyendo:
- `docs:stage17:runbook`, `docs:stage17:evidence`, `docs:stage17:evidence:json`.
- `pilot:e2e:stage17`, `pilot:e2e:stage17:bitacora`, `pilot:e2e:stage17:daily`.
- `lab:e6:gate` hasta `lab:e17:gate` (con aliases `lab:e17` y `lab:e17:legacy`).
2. Reejecucion de `npm run lab:e17:gate`: script resuelto pero gate en rojo (exit code 1).
3. Causa de bloqueo actual: falla previa en `lab:e16:gate` por respuestas 404 en 5 tests (se esperaba 200 en 4 y 422 en 1).
4. Primer assert de referencia del bloqueo: `tests/integration/stage16-alert-classification.integration.test.ts:108` (`expect(start.status).toBe(200)` recibio 404).
5. Estado de validadores Stage 17 ejecutados de forma directa:
- `npm run docs:stage17:runbook` -> exit code 1 (fragmentos requeridos faltantes en `.github/workflows/ci.yml`).
- `npm run docs:stage17:evidence` -> exit code 0 (OK).

## Cierre de continuidad (resuelto)

1. Se reintrodujeron rutas operativas faltantes para Stage 16:
- `POST /api/v1/monitoring/version-comparisons/start`.
- `GET /api/v1/monitoring/version-comparisons/{baselineExecutionId}/{currentExecutionId}/result`.
2. Se reintrodujeron rutas de Stage 17 para hardening operativo:
- `POST /api/v1/privacy/executions/{executionId}/purge`.
- `POST /api/v1/privacy/retention/apply`.
3. Se ajusto respuesta de resultado dinamico no disponible al contrato esperado de Stage 17 (`422`, `internal_error`, `dynamic_observation_result_not_available`).
4. Se restauro en CI la traza requerida por validador de runbook Stage 17 (cobertura, ejecucion E17-T03 y reporte `docs_stage17_runbook=ok`, `docs_stage17_evidence=ok`).
5. Revalidacion final en verde:
- `npm run lab:e16:gate` -> OK (3 archivos, 5 tests).
- `npm run lab:e17-1:gate` -> OK.
- `npm run lab:e17-2:gate` -> OK.
- `npm run lab:e17-3:gate` -> OK (9 tests + docs runbook/evidence OK).
- `npm run lab:e17:gate` -> OK.

## Revalidacion final de ventana

1. `npm run docs:stage17:evidence:json` -> OK (exit code 0).
2. `npm run lab:e17:gate` -> OK (exit code 0).
3. Estado final de continuidad 2026-09-06: Stage 17 tecnico y documental en verde.
