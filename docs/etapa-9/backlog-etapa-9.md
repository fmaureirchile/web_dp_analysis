# Backlog - Etapa 9 (repositorio de evidencias y revision)

## Objetivo

Consolidar consulta y uso operativo de evidencias para revision trazable y preparacion de reportes.

## Orden recomendado

1. E9-T01 -> E9-T02 -> E9-T03 -> E9-T04

## E9-T01 - Consulta trazable por executionId y kind

- Objetivo unico: exponer endpoint de lectura de evidencias con filtros basicos.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: consulta devuelve evidencias esperadas y errores de entrada invalidos.

## E9-T02 - Paginacion y ventana temporal

- Objetivo unico: agregar from/to y cursor simple para exploracion operativa.
- Criterio de aceptacion: resultados reproducibles en corridas consecutivas.

## E9-T03 - Vista de revision minima

- Objetivo unico: exponer agregado de evidencias + observaciones por ejecucion.
- Criterio de aceptacion: payload apto para consumo de consola de revision.

## E9-T04 - Gate consolidado Etapa 9

- Objetivo unico: comando unico de validacion E9 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E9-T01: completada (consulta por executionId/kind con prueba de integracion y validaciones de entrada).
2. E9-T02: completada (paginacion con cursor simple y ventana temporal from/to en consulta de evidencias).
3. E9-T03: completada (vista de revision minima con agregado de evidencias + observaciones por ejecucion).
4. E9-T04: pendiente.
