# Plan corto de continuidad - Stage 5

Fecha: 2026-07-31

## Objetivo

Registrar deuda tecnica y acciones prioritarias para reducir riesgo operacional en la transicion E5.1 -> E5.2.

## Riesgos y deuda detectada

1. Persistencia aun no durable para todo el ciclo de evidencia y resultado (riesgo de perdida tras reinicio).
2. Observabilidad operativa limitada para auditoria de ejecuciones por correlationId.
3. Cobertura E2E ampliada pendiente para matriz de fallos de fetch en laboratorio.
4. Contrato y errores controlados requieren mantener consistencia al endurecer fetch.

## Acciones prioritarias (orden recomendado)

1. Implementar persistencia durable de resultados y evidencia (E5-2-T01, E5-2-T02).
2. Exponer consulta operativa con filtros por estado/ventana temporal (E5-2-T03).
3. Endurecer mapeo deterministico de errores de fetch (E5-2-T04).
4. Ampliar matriz E2E de laboratorio con escenarios de timeout/non-html/size-limit (E5-2-T05).
5. Incorporar trazas operativas minimas por executionId y correlationId (E5-2-T06).

## Criterio de done por accion

1. Cada accion debe agregar o actualizar al menos una prueba de integracion verificable.
2. Cada accion debe pasar gate minimo inicial E5.2 antes de merge.
3. Cambios de contrato deben reflejarse en docs/contracts/openapi.yaml y validarse.

## Comando operativo recomendado durante ejecucion E5.2

npm run openapi:validate && npm run typecheck && npm run test:integration -- --run tests/integration/stage5-scope-gate.integration.test.ts tests/integration/stage5-passive-fetch.integration.test.ts tests/integration/stage5-e2e-lab.integration.test.ts tests/integration/stage5-evidence-recovery.integration.test.ts tests/integration/stage5-operational-query.integration.test.ts tests/integration/stage5-fetch-errors.integration.test.ts
