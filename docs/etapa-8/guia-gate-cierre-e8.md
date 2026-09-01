# Guia operativa - Gate de cierre E8

## Objetivo

Validar con un comando unico que el motor de consentimiento baseline, su adaptador de laboratorio y la publicacion en observacion dinamica se mantienen estables.

## Comando unico

```bash
corepack pnpm run lab:e8:gate
```

## Que ejecuta internamente

1. lab:e8-1:gate
- Incluye typecheck global.
- Ejecuta unit test de consentimiento baseline:
  - tests/unit/stage8-consent-scenarios.test.ts

2. Integracion adaptador laboratorio
- Ejecuta:
  - tests/integration/stage8-consent-adapter.integration.test.ts
- Verifica traduccion de senales desde sitio B/C.

3. Integracion observacion dinamica
- Ejecuta:
  - tests/integration/stage6-dynamic-observation.integration.test.ts
- Verifica publicacion de consentEvaluation por executionId.

## Cuando usarlo

1. Antes de abrir PR con cambios en consentimiento.
2. Despues de tocar contratos Stage 8 o adaptadores de dominio.
3. Antes de merge para asegurar no regresion de E6/E7/E8.

## Salida esperada

1. Unit consentimiento baseline: Test Files 1 passed y Tests 4 passed.
2. Integracion adaptador B/C: Test Files 1 passed y Tests 3 passed.
3. Integracion observacion dinamica: Test Files 1 passed y Tests 6 passed.

## Criterio de aprobacion

El gate E8 aprueba solo si las tres corridas de prueba y typecheck finalizan en verde.

## Fallos comunes y accion recomendada

1. Error de tipos:
- Ejecutar corepack pnpm run typecheck y corregir archivo reportado.

2. Falla adaptador B/C:
- Ejecutar npx vitest run --config vitest.integration.config.ts --run tests/integration/stage8-consent-adapter.integration.test.ts

3. Falla publicacion en observacion:
- Ejecutar npx vitest run --config vitest.integration.config.ts --run tests/integration/stage6-dynamic-observation.integration.test.ts
