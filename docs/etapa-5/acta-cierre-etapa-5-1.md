# Acta de cierre - Etapa 5.1

Fecha: 2026-07-31

## Estado

APTO PARA SIGUIENTE SUBCORTE DE ETAPA 5.

## Alcance cerrado en E5.1

1. Contrato de entrada/salida para crawler pasivo de una pagina.
2. Cliente HTTP pasivo con timeout y limite de tamano de respuesta.
3. Gate de alcance previo al fetch (rechazo fuera de alcance).
4. Parseo minimo de HTML (title) sin ejecucion de JS.
5. Persistencia de evidencia HTML y metadata asociada a executionId.
6. Orquestacion de estados: VALIDATED -> QUEUED -> RUNNING -> COMPLETED/FAILED.
7. Endpoint de resultados E5.1 (POST ejecucion + GET resultado por executionId).
8. Pruebas E2E en laboratorio para caso exitoso y caso fuera de alcance.
9. Comando unico de cierre E5.1 reproducible en local y CI.

## Cumplimiento por tarea

1. E5-1-T01: completada.
2. E5-1-T02: completada.
3. E5-1-T03: completada.
4. E5-1-T04: completada.
5. E5-1-T05: completada.
6. E5-1-T06: completada.
7. E5-1-T07: completada.
8. E5-1-T08: completada.
9. E5-1-T09: completada.

## Evidencias de ejecucion

1. Contrato OpenAPI validado con npm run openapi:validate.
2. Typecheck global en verde con npm run typecheck.
3. Integracion Stage 5 en verde:
- tests/integration/stage5-scope-gate.integration.test.ts
- tests/integration/stage5-passive-fetch.integration.test.ts
- tests/integration/stage5-e2e-lab.integration.test.ts
4. Gate unico E5.1 en verde con npm run lab:e5-1:gate.
5. Guia operativa del gate disponible en docs/etapa-5/guia-gate-cierre-e5-1.md.

## Criterio de salida E5.1

Se considera cumplido cuando:

1. El flujo POST /api/v1/crawler/passive/single-page produce resultado controlado (ok o error) con transiciones trazables.
2. El flujo GET /api/v1/crawler/passive/single-page/{executionId}/result devuelve resultado persistido por executionId.
3. Existen pruebas automatizadas para:
- caso exitoso de laboratorio
- caso fuera de alcance
4. El comando unico de gate valida contrato, tipos y pruebas Stage 5.

## Riesgos residuales

1. El almacenamiento de evidencia en E5.1 es en memoria y sirve para corte vertical; falta consolidacion persistente avanzada en siguientes subcortes.
2. Se recomienda observar al menos una corrida remota de GitHub Actions posterior al merge para evidencia externa del gate E5.1 en runner CI.

## Decision

Se declara cierre formal de Etapa 5.1 y habilitacion para iniciar el siguiente subcorte de Etapa 5.
