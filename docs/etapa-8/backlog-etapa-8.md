# Backlog - Etapa 8 (motor de consentimiento)

## Objetivo

Introducir evaluacion baseline de consentimiento sobre evidencia sintetica y observaciones dinamicas previas.

## Orden recomendado

1. E8-T01 -> E8-T02 -> E8-T03 -> E8-T04

## E8-T01 - Evaluador baseline de consentimiento

- Objetivo unico: crear contrato y evaluador deterministico para escenarios basicos.
- Archivos objetivo: packages/contracts/, packages/domain/, tests/unit/.
- Criterio de aceptacion: escenarios baseline cubiertos por pruebas unitarias y gate E8-T01 en verde.

## E8-T02 - Adaptador desde laboratorio (sitio B/C)

- Objetivo unico: traducir senales del laboratorio a entradas del evaluador.
- Criterio de aceptacion: salida de evaluacion consistente para escenarios correcto/defectuoso.

## E8-T03 - Integracion con observacion dinamica

- Objetivo unico: publicar evaluacion de consentimiento junto a resultados de ejecucion.
- Criterio de aceptacion: endpoint/result incluye bloque de consentimiento.

## E8-T04 - Gate consolidado Etapa 8

- Objetivo unico: comando unico de validacion E8 para local/CI.
- Criterio de aceptacion: pipeline reproducible y resumen operativo.

## Estado de cumplimiento parcial

1. E8-T01: completada (contrato + evaluador baseline + tests unitarios + gate corto).
2. E8-T02: completada (adaptador de senales laboratorio sitio B/C hacia evaluador baseline).
3. E8-T03: pendiente.
4. E8-T04: pendiente.
