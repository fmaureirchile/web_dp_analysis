# Checklist final de entrega PR - E5.2

## Objetivo

Asegurar que un PR de cierre E5.2 quede listo para revision y merge sin brechas tecnicas ni documentales.

## Cuando usar este checklist

- Al abrir PR de cierre E5.2.
- Al actualizar PR despues de cambios solicitados.
- Antes de aprobar y mergear.

## Checklist tecnico minimo

1. El comando npm run lab:e5-2:gate pasa en local.
2. El contrato OpenAPI valida sin errores.
3. El typecheck global no reporta errores.
4. La integracion Stage 5 ejecuta 9 archivos y 23 tests en verde.
5. El endpoint POST /api/v1/crawler/passive/single-page responde resultado controlado para exito y errores tipificados.
6. El endpoint GET /api/v1/crawler/passive/single-page/{executionId}/result recupera resultado persistido por executionId tras reinicio simulado.
7. El endpoint GET /api/v1/crawler/passive/executions/operational aplica filtros de estado/ventana/limite correctamente.
8. La observabilidad minima registra eventos estructurados por executionId/correlationId en exito y error.

## Checklist documental minimo

1. Guia de gate E5.2 actualizada: docs/etapa-5/guia-gate-cierre-e5-2.md.
2. Acta de cierre E5.2 actualizada: docs/etapa-5/acta-cierre-etapa-5-2.md.
3. Revision de coherencia E5.2 actualizada: docs/etapa-5/revision-coherencia-etapa-5-2.md.
4. Nota de release corta E5.2 actualizada: docs/etapa-5/nota-release-e5-2.md.

## Evidencia obligatoria en el PR

1. Salida del comando npm run lab:e5-2:gate con estado exitoso.
2. Resultado de CI post-merge con linea unica de resumen:
E5.2 gate result: integration_files_passed=9/9; integration_tests_passed=23/23.
3. Referencia a la nota de release E5.2.

## Evidencia final post-merge (lectura rapida)

1. Aplicar lectura rapida definida en docs/etapa-5/guia-gate-cierre-e5-2.md.
2. Guardar URL del run CI y la linea final del step Report Stage 5.2 gate result.
3. Confirmar presencia de steps Report Stage 5.2 gate coverage, Stage 5.2 gate E5-2 y Report Stage 5.2 gate result.

## Plantilla de comentario final de PR

CI post-merge en verde: workflow validate ejecutado con estado Success.
Gate E5.2 ejecutado correctamente, incluyendo reporte de cobertura y resumen validado en logs.
Resumen final del gate: E5.2 gate result: integration_files_passed=9/9; integration_tests_passed=23/23.
Evidencia documental actualizada en docs/etapa-5/nota-release-e5-2.md.
