# Backlog - Etapa 10 (reportes e inventarios)

## Objetivo

Transformar resultados tecnicos en reportes e inventarios trazables para consumo operativo.

## Orden recomendado

1. E10-T01 -> E10-T02 -> E10-T03 -> E10-T04

## E10-T01 - Reporte ejecutivo por ejecucion

- Objetivo unico: exponer resumen ejecutivo JSON por executionId con trazabilidad por evidenceIds.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: endpoint retorna conteos y referencias de evidencia verificables.

## E10-T02 - Inventario minimo de formularios

- Objetivo unico: consolidar observaciones por pagina/campo en formato de inventario.
- Criterio de aceptacion: inventario navegable por executionId y pageId.

## E10-T03 - Inventario minimo de terceros y cookies

- Objetivo unico: exponer resumen de terceros/cookies observadas para revision.
- Criterio de aceptacion: salida reproducible sobre laboratorio sintetico.

## E10-T04 - Gate consolidado Etapa 10

- Objetivo unico: comando unico de validacion E10 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E10-T01: completada (reporte ejecutivo inicial por executionId con trazabilidad por evidenceIds).
2. E10-T02: completada (inventario minimo de formularios por executionId con filtro opcional pageId).
3. E10-T03: completada (inventario minimo de terceros y cookies observadas desde observacion dinamica).
4. E10-T04: completada (gate consolidado unico Etapa 10 para validacion local/CI con resumen operativo).
