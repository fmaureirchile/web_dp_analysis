# Guia Operativa - Gate de cierre E5.3

## Objetivo

Definir y operar un comando unico para validar el cierre E5.3, consolidando control funcional Stage 5 y no regresion de observabilidad.

## Cuando usar esta guia

- Antes de cerrar cambios de E5.3 en rama de trabajo.
- Antes de abrir o actualizar PRs que toquen runner, observabilidad o controles de calidad Stage 5.
- Como verificacion rapida de estabilidad operativa antes de merge.

## Comando unico de gate

Comando:

```bash
npm run lab:e5-3:gate
```

Ubicacion:

- Script definido en package.json dentro de scripts.

## Que valida exactamente el gate

El comando ejecuta 2 controles encadenados:

1. Gate funcional Stage 5 (E5.2)
- Comando interno: npm run lab:e5-2:gate
- Cobertura esperada: 9 archivos y 26 tests en verde.
- Proposito: asegurar que la base funcional Stage 5 no se degrada.

2. Regresion de observabilidad E5.3
- Comando interno: npm run lab:e5-3:obs-regression
- Cobertura esperada: 1 archivo y 4 tests en verde.
- Proposito: asegurar trazabilidad de eventos por executionId/correlationId (orden, detalle y aislamiento).

## Parametros y entradas

El comando no requiere parametros CLI obligatorios.

Entradas funcionales principales:

- Contrato API: docs/contracts/openapi.yaml
- API Stage 5: apps/api/src
- Worker crawler: apps/worker-crawler/src
- Laboratorio sintetico: test-lab/sites
- Pruebas de control:
  - tests/integration/stage5-scope-gate.integration.test.ts
  - tests/integration/stage5-passive-fetch.integration.test.ts
  - tests/integration/stage5-e2e-lab.integration.test.ts
  - tests/integration/stage5-e2e-lab-extended.integration.test.ts
  - tests/integration/stage5-evidence-recovery.integration.test.ts
  - tests/integration/stage5-operational-query.integration.test.ts
  - tests/integration/stage5-fetch-errors.integration.test.ts
  - tests/integration/stage5-result-recovery.integration.test.ts
  - tests/integration/stage5-observability.integration.test.ts

## Salidas y evidencia operativa

Salidas directas en terminal:

- Resultado del gate funcional Stage 5.
- Resultado de regresion de observabilidad.

Evidencia recomendada para cierre E5.3:

1. Log de ejecucion exitosa de npm run lab:e5-3:gate.
2. Referencia a commit/PR donde se ejecuto el gate.
3. En CI, presencia de pasos Stage 5.3 gate coverage, Stage 5.3 gate E5-3 y Stage 5.3 gate result.
4. Linea final esperada en CI:
   E5.3 gate result: stage5_gate_files=9/9; stage5_gate_tests=26/26; obs_regression_files=1/1; obs_regression_tests=4/4

## Criterio de aceptacion de E5-3-T04

E5-3-T04 se considera cumplida cuando:

1. Existe comando unico npm run lab:e5-3:gate en package.json.
2. El workflow de CI ejecuta y valida el gate E5.3 con resultados esperados.
3. Esta guia describe uso, alcance, entradas, salidas y evidencia de cierre.
4. El gate es reproducible localmente y en CI con resultados consistentes.

## Resolucion de fallos frecuentes

1. Falla en gate funcional Stage 5
- Ejecutar npm run lab:e5-2:gate para identificar la suite exacta fallida.
- Corregir causa raiz y repetir npm run lab:e5-3:gate.

2. Falla en regresion de observabilidad
- Ejecutar npm run lab:e5-3:obs-regression para ver asercion puntual.
- Revisar eventos en flujo crawler (inicio, resultado, orden temporal y correlationId).
- Repetir gate completo.

3. Falla por estabilidad de runner
- Verificar decision y criterio de rollback en docs/adr/ADR-007-estabilidad-runner-vitest-gate-e5-2.md.
- Mantener configuracion --pool=forks mientras no se cumpla criterio de rollback.

