# Backlog - Etapa 7 (clasificacion inicial de datos)

## Objetivo

Introducir una clasificacion inicial, trazable y segura para datos observados en etapas previas.

## Orden recomendado

1. E7-T01 -> E7-T02 -> E7-T03 -> E7-T04

## E7-T01 - Contrato y motor baseline

- Objetivo unico: crear contrato DTO y motor por reglas iniciales para clasificar datos.
- Archivos objetivo: packages/contracts/, packages/classification/, tests/unit/.
- Criterio de aceptacion: rule engine cubre health/auth/contact/unclassified y gate E7-T01 en verde.
- Pruebas desde inicio:
  - test unitario de clasificacion inicial.

## E7-T02 - Integracion con observacion dinamica

- Objetivo unico: aplicar clasificacion sobre items de storage/red/form.
- Criterio de aceptacion: resultado de observacion incluye etiquetas de clasificacion.

## E7-T03 - Politica de enmascaramiento por label

- Objetivo unico: definir y aplicar matriz label -> requiresMasking.
- Criterio de aceptacion: sin fuga de valores sensibles en evidencias operativas.

## E7-T04 - Gate inicial Etapa 7

- Objetivo unico: consolidar verificacion reproducible para clasificacion.
- Criterio de aceptacion: comando unico de gate E7 en verde.

## Estado de cumplimiento parcial

1. E7-T01: completada (contrato + engine baseline + test unitario + gate corto).
2. E7-T02: completada (observacion dinamica expone etiquetas de clasificacion en network/storage).
3. E7-T03: completada (politica central label -> requiresMasking aplicada por modulo security).
4. E7-T04: pendiente.
