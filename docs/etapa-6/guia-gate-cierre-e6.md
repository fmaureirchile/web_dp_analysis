# Guia operativa - Gate de cierre E6

## Objetivo

Validar en un solo comando que la Etapa 6 mantiene contrato, tipado y comportamiento minimo de observacion dinamica.

## Comando unico

```bash
corepack pnpm run lab:e6:gate
```

## Que ejecuta internamente

1. `openapi:validate`
- Proposito: confirma que el contrato en `docs/contracts/openapi.yaml` sigue valido.
- Salida esperada: lint sin errores.

2. `typecheck`
- Proposito: valida tipos TypeScript en todo el repositorio.
- Salida esperada: compilacion de tipos sin errores.

3. `vitest` de integracion Stage 6
- Archivo: `tests/integration/stage6-dynamic-observation.integration.test.ts`.
- Proposito: verifica observacion dinamica minima (DOM/screenshot, red, storage y eventos SPA).
- Salida esperada: `Test Files 1 passed (1)` y `Tests 4 passed (4)`.

## Cuando usarlo

1. Antes de abrir PR con cambios de Etapa 6.
2. Despues de modificar `apps/worker-browser`, `apps/api` o fixtures de `test-lab`.
3. Como validacion rapida local para descartar regresiones de alcance E6.

## Parametros y entradas

El comando no recibe parametros CLI.

Entradas implicitas:
1. Estado actual del workspace.
2. Dependencias instaladas (`pnpm install` o `npm ci`).
3. Cliente Prisma generado cuando aplique (`corepack pnpm run db:generate`).

## Archivos de salida y evidencias

1. En ejecucion local no se generan archivos dedicados de reporte.
2. En CI se produce `e6_gate.log` para extraer resumen de cobertura.
3. El resumen CI esperado tiene formato:
- `integration_files_passed=1/1`
- `integration_tests_passed=4/4`
- `openapi=ok`
- `typecheck=ok`

## Criterio de aprobacion

El gate E6 aprueba solo si las tres etapas (OpenAPI, Typecheck, Integracion E6) terminan en verde.

## Fallos comunes y accion recomendada

1. Error de tipos
- Accion: ejecutar `corepack pnpm run typecheck`, corregir archivo reportado y repetir gate.

2. Fallo de test de integracion
- Accion: ejecutar `npx vitest run --config vitest.integration.config.ts --run tests/integration/stage6-dynamic-observation.integration.test.ts` y corregir la asercion o el flujo API/worker.

3. Error de contrato OpenAPI
- Accion: ejecutar `corepack pnpm run openapi:validate`, ajustar contrato y repetir.
