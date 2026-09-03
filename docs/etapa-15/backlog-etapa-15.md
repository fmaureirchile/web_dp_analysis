# Backlog - Etapa 15 (motor legal-tecnico y discrepancias)

## Objetivo

Relacionar comportamiento observado con informacion declarada para identificar posibles discrepancias con validacion humana.

## Orden recomendado

1. E15-T01 -> E15-T02 -> E15-T03 -> E15-T04

## E15-T01 - Discrepancias iniciales terceros/cookies

- Objetivo unico: detectar tercero/cookie observado no declarado.
- Archivos objetivo: apps/api/, packages/contracts/, tests/integration/.
- Criterio de aceptacion: salida reproducible con lenguaje "Existe una posible discrepancia" y "Requiere validacion".
- Estado: completada.

## E15-T02 - Finalidad no encontrada (baseline)

- Objetivo unico: detectar ausencia de finalidad declarada para categoria observada.
- Criterio de aceptacion: salida con estado de validacion requerida y evidencia trazable.

## E15-T03 - Discrepancias de consentimiento observable

- Objetivo unico: detectar tracking posterior al rechazo o captura previa a informacion.
- Criterio de aceptacion: salida sin sentencia juridica automatica.

## E15-T04 - Gate consolidado Etapa 15

- Objetivo unico: comando unico de validacion E15 local/CI.
- Criterio de aceptacion: pipeline reproducible con resumen operativo.

## Estado de cumplimiento parcial

1. E15-T01: completada.
2. E15-T02: pendiente.
3. E15-T03: pendiente.
4. E15-T04: pendiente.
