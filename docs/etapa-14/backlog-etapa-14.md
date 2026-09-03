# Backlog - Etapa 14 (correlacion y linaje integral)

## Objetivo

Unificar resultados frontend y backend en enlaces de linaje explicables con estado de confianza.

## Orden recomendado

1. E14-T01 -> E14-T02 -> E14-T03 -> E14-T04

## E14-T01 - Correlacion inicial por endpoint

- Objetivo unico: correlacionar endpoints observados entre frontend y backend por executionId.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: payload con correlaciones, estado y confianza minima reproducible.

## E14-T02 - Correlacion inicial por artefacto DTO/controlador

- Objetivo unico: enlazar DTO y procesamiento backend por nombre/esquema basico.
- Criterio de aceptacion: salida por enlace con confianza explicita y evidencia asociada.
- Estado: completada.

## E14-T03 - Vista minima de linaje consolidado

- Objetivo unico: exponer vista de nodos/aristas preliminar por executionId.
- Criterio de aceptacion: payload apto para evolucion a niveles de confirmacion humana.
- Estado: completada.

## E14-T04 - Gate consolidado Etapa 14

- Objetivo unico: comando unico de validacion E14 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.
- Estado: completada.

## Estado de cumplimiento parcial

1. E14-T01: completada (correlacion inicial frontend-backend por endpoint).
2. E14-T02: completada (correlacion DTO/procesamiento por nombre/esquema basico).
3. E14-T03: completada (vista preliminar de nodos/aristas consolidada por executionId).
4. E14-T04: completada (gate consolidado local/CI).
