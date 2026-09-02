# Backlog - Etapa 13 (analisis backend, APIs, bases y logs)

## Objetivo

Extender el descubrimiento a sistemas internos con trazabilidad desde endpoint hasta procesamiento/persistencia.

## Orden recomendado

1. E13-T01 -> E13-T02 -> E13-T03 -> E13-T04

## E13-T01 - Indexacion minima de APIs backend

- Objetivo unico: indexar artefactos OpenAPI, GraphQL, rutas y DTO por executionId.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: payload reproducible con conteo por tipo y resultado consultable.

## E13-T02 - Deteccion inicial de puntos de procesamiento backend

- Objetivo unico: identificar controladores/servicios/integraciones asociados a rutas.
- Criterio de aceptacion: salida por archivo con regla y fragmento minimo.

## E13-T03 - Vista minima de recorrido API -> procesamiento

- Objetivo unico: exponer resumen consolidado por executionId para correlacion preliminar.
- Criterio de aceptacion: payload apto para evolucion a linaje de Etapa 14.

## E13-T04 - Gate consolidado Etapa 13

- Objetivo unico: comando unico de validacion E13 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E13-T01: completada (indexacion minima de APIs backend con evidencia y consulta).
2. E13-T02: completada (deteccion inicial de puntos de procesamiento backend por archivo).
3. E13-T03: pendiente.
4. E13-T04: pendiente.
