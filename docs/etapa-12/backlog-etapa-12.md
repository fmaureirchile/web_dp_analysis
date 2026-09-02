# Backlog - Etapa 12 (analisis de codigo frontend)

## Objetivo

Habilitar ingesta e indexacion de frontend para descubrir capturas potenciales y vincularlas con evidencia.

## Orden recomendado

1. E12-T01 -> E12-T02 -> E12-T03 -> E12-T04

## E12-T01 - Ingesta e indexacion minima

- Objetivo unico: exponer endpoint de indexacion frontend por executionId y repositoryPath.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: resultado indexado reproducible con framework detectado y evidencia minima.

## E12-T02 - Deteccion inicial de patrones de captura

- Objetivo unico: detectar patrones basicos (input, fetch, cookie/storage, analytics) por archivo.
- Criterio de aceptacion: salida por archivo con regla y fragmento minimo.

## E12-T03 - Vista de hallazgos estaticos minimos

- Objetivo unico: exponer resumen de detecciones estaticas por executionId.
- Criterio de aceptacion: payload apto para correlacion preliminar con observacion dinamica.

## E12-T04 - Gate consolidado Etapa 12

- Objetivo unico: comando unico de validacion E12 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E12-T01: completada (indexacion minima frontend con deteccion de framework y resultado consultable).
2. E12-T02: completada (deteccion inicial de patrones de captura por archivo con fragmento minimo).
3. E12-T03: pendiente.
4. E12-T04: pendiente.
