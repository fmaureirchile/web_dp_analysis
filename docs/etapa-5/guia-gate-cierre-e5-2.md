# Guia Operativa - Gate de cierre E5.2

## Objetivo

Definir y operar un comando unico para validar el cierre E5.2 (consolidacion operacional del crawler pasivo) en local y CI.

## Cuando usar esta guia

- Antes de cerrar cambios de E5.2 en rama de trabajo.
- Antes de abrir o actualizar PRs que toquen API, worker-crawler, test-lab o contratos Stage 5.
- Como verificacion rapida de no regresion despues de cambios en persistencia, filtros operativos, errores controlados, E2E o observabilidad.

## Comando unico de gate

Comando:

```bash
npm run lab:e5-2:gate
```

Ubicacion:

- Script definido en package.json dentro de scripts.

## Que valida exactamente el gate

El comando ejecuta 3 validaciones en secuencia:

1. Contrato OpenAPI
- Comando interno: npm run openapi:validate
- Proposito: asegurar coherencia de paths/schemas de contrato API.
- Resultado esperado: validacion exitosa sin errores de lint OpenAPI.

2. Consistencia de tipos TypeScript
- Comando interno: npm run typecheck
- Proposito: detectar errores de tipado antes de ejecutar suites de integracion.
- Resultado esperado: ejecucion sin errores.

3. Integracion Stage 5 (cobertura E5.1 + E5.2)
- Comando interno:
  npm run test:integration -- --run tests/integration/stage5-scope-gate.integration.test.ts tests/integration/stage5-passive-fetch.integration.test.ts tests/integration/stage5-e2e-lab.integration.test.ts tests/integration/stage5-e2e-lab-extended.integration.test.ts tests/integration/stage5-evidence-recovery.integration.test.ts tests/integration/stage5-operational-query.integration.test.ts tests/integration/stage5-fetch-errors.integration.test.ts tests/integration/stage5-result-recovery.integration.test.ts tests/integration/stage5-observability.integration.test.ts
- Proposito: validar en conjunto alcance, fetch, errores controlados, recuperacion durable, consulta operacional, matriz E2E ampliada y observabilidad minima.
- Resultado esperado: 9 archivos y 26 tests en verde.

## Parametros y entradas

El comando no requiere parametros CLI obligatorios.

Entradas funcionales principales:

- Contrato API: docs/contracts/openapi.yaml
- API Stage 5: apps/api/src
- Worker crawler: apps/worker-crawler/src
- Laboratorio sintetico: test-lab/sites
- Pruebas de integracion Stage 5:
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

- Resultado de openapi:validate.
- Resultado de typecheck.
- Resultado de test:integration con conteo de archivos y tests.

Evidencia recomendada para cierre E5.2:

1. Log de ejecucion exitosa de npm run lab:e5-2:gate.
2. Referencia a commit/PR donde se ejecuto el gate.
3. En CI, presencia de pasos Stage 5.2 gate coverage, Stage 5.2 gate E5-2 y Stage 5.2 gate result.
4. Linea final esperada en CI:
  E5.2 gate result: integration_files_passed=9/9; integration_tests_passed=26/26

## Criterio de aceptacion de E5-2-T07

E5-2-T07 se considera cumplida cuando:

1. Existe comando unico npm run lab:e5-2:gate en package.json.
2. El workflow de CI ejecuta y valida el gate E5.2 con cobertura esperada.
3. Esta guia describe uso, alcance, entradas, salidas y evidencia de cierre.
4. El gate es reproducible localmente y en CI con resultados consistentes.

## Resolucion de fallos frecuentes

1. Falla en openapi:validate
- Revisar cambios recientes en docs/contracts/openapi.yaml.
- Corregir inconsistencias de schema/path y repetir el gate completo.

2. Falla en typecheck
- Corregir error reportado por tsc.
- Re-ejecutar gate completo para asegurar no regresion.

3. Falla en integracion Stage 5
- Identificar archivo y asercion fallida.
- Corregir la causa raiz en API/worker/lab y repetir el gate completo.
- Verificar que el resumen final esperado se mantenga en 9/9 y 26/26.

## Lectura rapida post-merge E5.2 (run CI)

Usar este flujo para validar el run remoto en menos de 1 minuto:

1. Confirmar que el job validate termina en estado Success.
2. Revisar el step Report Stage 5.2 gate coverage y validar que liste 9 archivos esperados.
3. Revisar el step Stage 5.2 gate E5-2 y confirmar ejecucion exitosa.
4. Revisar el step Report Stage 5.2 gate result y ubicar una sola linea con formato:
  E5.2 gate result: integration_files_passed=X/Y; integration_tests_passed=A/B
5. Validar valores esperados de cierre E5.2: integration_files_passed=9/9 e integration_tests_passed=26/26.
6. Registrar evidencia minima en PR: URL del run, linea final del resumen y referencia a docs/etapa-5/guia-gate-cierre-e5-2.md.

