# Backlog - Etapa 5.2 (consolidacion operacional crawler pasivo)

## Objetivo del subcorte

Consolidar el flujo E5.1 para operacion continua: persistencia robusta, observabilidad operativa, y endurecimiento de pruebas de regresion.

## Criterio de salida E5.2

E5.2 se considera apta cuando:

1. Existe persistencia no volatil de resultado y evidencia minima requerida.
2. Existen endpoints de consulta operativa con paginacion o filtros basicos.
3. Existen pruebas E2E ampliadas (exito, fuera de alcance, timeout, non-html, size-limit).
4. Existe gate unico E5.2 reproducible local y CI.

## E5-2-T01 - Persistencia durable de resultado E5.1

- Objetivo unico: mover resultado de crawl de memoria a almacenamiento persistente del proyecto.
- Dependencias: cierre E5.1.
- Archivos afectados: apps/api/src, database/migrations, prisma/schema.prisma.
- Criterio de aceptacion: GET de resultado sobrevive reinicio de proceso.
- Pruebas desde inicio:
  - Integracion: resultado disponible luego de reinicio simulado.

## E5-2-T02 - Persistencia durable de evidencia HTML minima

- Objetivo unico: almacenar referencia durable de evidencia asociada a executionId.
- Dependencias: E5-2-T01.
- Archivos afectados: apps/api/src, prisma/schema.prisma, database/migrations.
- Criterio de aceptacion: evidenceId consultable y consistente con resultado.
- Pruebas desde inicio:
  - Integracion: evidenceId recuperable por executionId.

## E5-2-T03 - Endpoint de consulta operativa por estado de ejecucion

- Objetivo unico: exponer consulta de ejecuciones con filtros por estado y ventana temporal.
- Dependencias: E5-2-T01.
- Archivos afectados: apps/api/src, docs/contracts/openapi.yaml.
- Criterio de aceptacion: permite listar ejecuciones COMPLETED/FAILED con metadatos basicos.
- Pruebas desde inicio:
  - Integracion: filtros devuelven subconjunto correcto.

## E5-2-T04 - Endurecimiento de errores controlados de fetch

- Objetivo unico: estabilizar respuestas para timeout, non-html y size-limit con mensajes consistentes.
- Dependencias: E5-1-T02.
- Archivos afectados: apps/worker-crawler/src, apps/api/src, packages/contracts/src.
- Criterio de aceptacion: errores mapeados de forma deterministica.
- Pruebas desde inicio:
  - Integracion: casos dedicados por tipo de error.

## E5-2-T05 - E2E laboratorio ampliada

- Objetivo unico: ampliar E2E con matriz de escenarios minimos de operacion pasiva.
- Dependencias: E5-2-T04.
- Archivos afectados: tests/integration, test-lab/sites.
- Criterio de aceptacion: suite E2E cubre exito + 4 fallos controlados.
- Pruebas desde inicio:
  - stage5-e2e-lab-extended.integration.test.ts en verde.

## E5-2-T06 - Observabilidad minima de pipeline crawler

- Objetivo unico: registrar trazas operativas minimas por executionId y correlationId.
- Dependencias: E5-2-T01.
- Archivos afectados: apps/api/src.
- Criterio de aceptacion: logs estructurados permiten reconstruir ciclo de ejecucion.
- Pruebas desde inicio:
  - Integracion: presencia de eventos de inicio, resultado y error.

## E5-2-T07 - Gate de cierre E5.2

- Objetivo unico: definir comando unico E5.2 para contrato, typecheck y suites nuevas.
- Dependencias: E5-2-T05 y E5-2-T06.
- Archivos afectados: package.json, docs/etapa-5, .github/workflows/ci.yml.
- Criterio de aceptacion: comando reproducible local y en CI.
- Pruebas desde inicio:
  - Ejecucion de gate completo en local.
  - Paso dedicado en workflow validate.
