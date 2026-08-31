# Acta de cierre - Etapa 5.2

**Estado documental:** historico de subcorte cerrado (E5.2). No normativo para ejecucion actual.
**Fuente operativa vigente:** docs/etapa-5/guia-gate-cierre-e5-5.md y .github/workflows/ci.yml.

Fecha: 2026-07-31

## Estado

APTO PARA SIGUIENTE SUBCORTE DE ETAPA 5.

## Alcance cerrado en E5.2

1. Persistencia durable de resultado de crawler pasivo por executionId (recuperacion tras reinicio simulado).
2. Persistencia durable de referencia de evidencia HTML por executionId.
3. Endpoint de consulta operativa por estado y ventana temporal, con limite y validacion de filtros.
4. Endurecimiento de errores controlados de fetch con mensajes deterministas por tipo.
5. Suite E2E de laboratorio ampliada con matriz minima: exito, fuera de alcance, timeout, non-html y size-limit.
6. Observabilidad minima del pipeline crawler con eventos estructurados por executionId/correlationId.
7. Comando unico de cierre E5.2 reproducible en local y CI.

## Cumplimiento por tarea

1. E5-2-T01: completada.
2. E5-2-T02: completada.
3. E5-2-T03: completada.
4. E5-2-T04: completada.
5. E5-2-T05: completada.
6. E5-2-T06: completada.
7. E5-2-T07: completada.

## Evidencias de ejecucion

1. Contrato OpenAPI validado con npm run openapi:validate.
2. Typecheck global en verde con npm run typecheck.
3. Integracion Stage 5 en verde (cobertura E5.2):
- tests/integration/stage5-scope-gate.integration.test.ts
- tests/integration/stage5-passive-fetch.integration.test.ts
- tests/integration/stage5-e2e-lab.integration.test.ts
- tests/integration/stage5-e2e-lab-extended.integration.test.ts
- tests/integration/stage5-evidence-recovery.integration.test.ts
- tests/integration/stage5-operational-query.integration.test.ts
- tests/integration/stage5-fetch-errors.integration.test.ts
- tests/integration/stage5-result-recovery.integration.test.ts
- tests/integration/stage5-observability.integration.test.ts
4. Gate unico E5.2 en verde con npm run lab:e5-2:gate.
5. Guia operativa del gate disponible en docs/etapa-5/guia-gate-cierre-e5-2.md.
6. CI actualizado con pasos dedicados de cobertura, ejecucion y resumen final para E5.2.

## Criterio de salida E5.2

Se considera cumplido cuando:

1. Resultado y evidencia minima son recuperables de forma durable por executionId.
2. La consulta operativa devuelve subconjuntos correctos con filtros basicos (estado, ventana y limite).
3. Los errores de fetch se reportan con codigo y mensaje deterministas.
4. La E2E ampliada cubre exito + 4 fallos controlados.
5. El comando unico de gate valida contrato, tipos e integracion Stage 5 y es reproducible en local/CI.

## Riesgos residuales

1. El gate E5.2 depende de estabilidad del runner de integracion; se adopto ejecucion con --pool=forks para mitigar inestabilidad observada en entorno local.
2. Se recomienda observar al menos una corrida remota de GitHub Actions posterior al merge para evidencia externa del gate E5.2.

## Decision

Se declara cierre formal de Etapa 5.2 y habilitacion para iniciar el siguiente subcorte de Etapa 5.
