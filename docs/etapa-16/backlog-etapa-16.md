# Backlog - Etapa 16 (monitoreo continuo y comparacion de versiones)

## Objetivo

Detectar cambios entre ejecuciones y distinguir variaciones tecnicas que requieren validacion.

## Orden recomendado

1. E16-T01 -> E16-T02 -> E16-T03 -> E16-T04

## E16-T01 - Comparacion minima baseline vs actual

- Objetivo unico: comparar terceros y cookies entre dos ejecuciones.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: salida con cambios detectados y alerta resumida con causa probable.
- Estado: completada.

## E16-T02 - Deteccion de nuevos endpoints

- Objetivo unico: detectar nuevos endpoints entre versiones comparadas.
- Criterio de aceptacion: salida reproducible con delta de endpoints.

## E16-T03 - Alerta por cambio documental/tecnico

- Objetivo unico: agregar clasificacion preliminar de causa probable por tipo de cambio.
- Criterio de aceptacion: alerta explicita sin afirmaciones concluyentes.

## E16-T04 - Gate consolidado Etapa 16

- Objetivo unico: comando unico de validacion E16 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E16-T01: completada.
2. E16-T02: pendiente.
3. E16-T03: pendiente.
4. E16-T04: pendiente.
