# Backlog - Etapa 11 (evaluacion autenticada)

## Objetivo

Habilitar recorridos autenticados sinteticos con sesiones aisladas, evidencia trazable y control operativo.

## Orden recomendado

1. E11-T01 -> E11-T02 -> E11-T03 -> E11-T04

## E11-T01 - Flujo autenticado minimo por rol

- Objetivo unico: ejecutar login sintetico, consulta de perfil y logout por executionId.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: resultado autenticado exitoso con evidencia minima de sesion.

## E11-T02 - Sesiones aisladas por rol

- Objetivo unico: validar aislamiento de sesion entre roles/recorridos.
- Criterio de aceptacion: no hay reutilizacion de estado entre ejecuciones.

## E11-T03 - Evidencia de flujo autenticado

- Objetivo unico: consolidar evidencia navegable del flujo autenticado para revision.
- Criterio de aceptacion: cada paso relevante referencia evidencia verificable.

## E11-T04 - Gate consolidado Etapa 11

- Objetivo unico: comando unico de validacion E11 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E11-T01: completada (login sintetico + perfil + logout con evidencia minima por executionId).
2. E11-T02: completada (aislamiento de sesion entre ejecuciones/roles con scope explicito y prueba dedicada).
3. E11-T03: completada (evidencia navegable por pasos login/profile/logout con referencias verificables).
4. E11-T04: completada (gate consolidado unico Etapa 11 para validacion local/CI con resumen operativo).
