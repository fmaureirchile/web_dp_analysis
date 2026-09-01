# Guia operativa - Gate de cierre E7

## Objetivo

Validar en un comando unico que la clasificacion inicial y la politica de enmascaramiento se mantienen estables sin romper la observacion dinamica.

## Comando unico

```bash
corepack pnpm run lab:e7:gate
```

## Que ejecuta internamente

1. `lab:e7-1:gate`
- Incluye `typecheck` global.
- Ejecuta unit tests:
  - `tests/unit/stage7-classification-engine.test.ts`
  - `tests/unit/stage7-masking-policy.test.ts`

2. Integracion de observacion dinamica
- Ejecuta:
  - `tests/integration/stage6-dynamic-observation.integration.test.ts`
- Verifica que la salida integrada sigue incluyendo clasificacion en red/storage.

## Cuando usarlo

1. Antes de abrir PR con cambios en `packages/classification` o `packages/security`.
2. Despues de ajustar DTOs de observacion dinamica o mapping de clasificacion.
3. En validacion local previa a merge cuando Etapa 7 este activa.

## Entradas y parametros

1. No recibe parametros CLI.
2. Requiere dependencias instaladas y workspace actualizado.

## Salida esperada

1. Typecheck sin errores.
2. Unit tests E7: `Test Files 2 passed (2)` y `Tests 6 passed (6)`.
3. Integration suite: `Test Files 1 passed (1)` y `Tests 4 passed (4)`.

## Criterio de aprobacion

El gate E7 aprueba solo cuando las tres verificaciones anteriores finalizan en verde.

## Diagnostico rapido

1. Falla de tipo:
- Ejecutar `corepack pnpm run typecheck` y corregir archivo reportado.

2. Falla unitaria:
- Ejecutar `corepack pnpm run lab:e7-1:gate` y ajustar regla/politica de masking.

3. Falla de integracion:
- Ejecutar `npx vitest run --config vitest.integration.config.ts --run tests/integration/stage6-dynamic-observation.integration.test.ts` y corregir mapeo de salida en worker/API.
