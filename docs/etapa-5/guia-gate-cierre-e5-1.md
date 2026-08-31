# Guia Operativa - Gate de cierre E5.1

## Objetivo

Definir y operar un comando unico para validar el corte vertical E5.1 (crawler pasivo una pagina) antes de dar por cerrada la etapa en local o CI.

## Cuando usar esta guia

- Antes de cerrar cambios de E5.1 en una rama de trabajo.
- Antes de abrir o actualizar un PR que toque crawler pasivo E5.1.
- Como comprobacion rapida de no regresion despues de refactors en API, worker-crawler o pruebas Stage 5.

## Comando unico de gate

Comando:

```bash
npm run lab:e5-1:gate
```

Ubicacion:

- Script definido en package.json dentro de scripts.

## Que valida exactamente el gate

El comando ejecuta 3 validaciones en secuencia:

1. Contrato OpenAPI
- Comando interno: npm run openapi:validate
- Proposito: asegura que docs/contracts/openapi.yaml mantiene estructura y reglas validas.
- Resultado esperado: mensaje de validacion correcta (spec valida).

2. Consistencia de tipos TypeScript
- Comando interno: npm run typecheck
- Proposito: detecta errores de tipado en apps, packages y tests incluidos por tsconfig.
- Resultado esperado: ejecucion sin errores.

3. Integracion Stage 5 (alcance, fetch, resultados, E2E laboratorio)
- Comando interno:
  npm run test:integration -- --run tests/integration/stage5-scope-gate.integration.test.ts tests/integration/stage5-passive-fetch.integration.test.ts tests/integration/stage5-e2e-lab.integration.test.ts
- Proposito: valida el flujo funcional E5.1 completo y casos de error controlado.
- Resultado esperado: tests Stage 5 en verde.

## Parametros y entradas

El comando no recibe parametros CLI obligatorios.

Entradas funcionales que usa el gate:

- Contrato API: docs/contracts/openapi.yaml
- Codigo fuente API: apps/api/src
- Codigo worker crawler: apps/worker-crawler/src
- Pruebas de integracion Stage 5:
  - tests/integration/stage5-scope-gate.integration.test.ts
  - tests/integration/stage5-passive-fetch.integration.test.ts
  - tests/integration/stage5-e2e-lab.integration.test.ts

## Salidas y evidencia operativa

Salidas directas en terminal:

- Resultado de lint OpenAPI (pass/fail).
- Resultado de typecheck (pass/fail).
- Resultado de pruebas Stage 5 (cantidad de tests y estado).

Evidencia recomendada para cierre de etapa:

1. Captura o log de terminal con el comando npm run lab:e5-1:gate en estado exitoso.
2. Referencia al commit/PR donde se ejecuta y pasa el gate.
3. En CI, registro del job que ejecuta el mismo comando.

## Criterio de aceptacion de E5-1-T09

E5-1-T09 se considera cumplida cuando:

1. El comando unico existe en package.json.
2. La guia operativa en docs/etapa-5 describe uso, alcance y salidas.
3. El comando es reproducible localmente y en CI con resultado consistente.

## Resolucion de fallos frecuentes

1. Falla en openapi:validate
- Revisar cambios recientes en docs/contracts/openapi.yaml.
- Corregir schema/paths/responses hasta recuperar validacion.

2. Falla en typecheck
- Corregir el error exacto reportado por tsc.
- Repetir el gate completo, no solo typecheck, para asegurar no regresion.

3. Falla en tests de Stage 5
- Identificar archivo de prueba y asercion fallida.
- Verificar estado de transiciones de ejecucion y resultado persistido por executionId.
- Reintentar el gate completo despues de corregir.
