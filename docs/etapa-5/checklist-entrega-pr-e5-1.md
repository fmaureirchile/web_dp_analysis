# Checklist final de entrega PR - E5.1

## Objetivo

Asegurar que un PR de cierre E5.1 quede listo para revision y merge sin brechas tecnicas ni documentales.

## Cuando usar este checklist

- Al abrir PR de cierre E5.1.
- Al actualizar PR despues de cambios solicitados.
- Antes de aprobar y mergear.

## Checklist tecnico minimo

1. El comando npm run lab:e5-1:gate pasa en local.
2. El contrato OpenAPI valida sin errores.
3. El typecheck global no reporta errores.
4. La integracion Stage 5 ejecuta 6 archivos y 11 tests en verde.
5. El endpoint POST /api/v1/crawler/passive/single-page responde resultado controlado.
6. El endpoint GET /api/v1/crawler/passive/single-page/{executionId}/result recupera resultado persistido por executionId.

## Checklist documental minimo

1. Guia de gate E5.1 actualizada: docs/etapa-5/guia-gate-cierre-e5-1.md.
2. Acta de cierre E5.1 actualizada: docs/etapa-5/acta-cierre-etapa-5-1.md.
3. Revision de coherencia E5.1 actualizada: docs/etapa-5/revision-coherencia-etapa-5-1.md.
4. Nota de release corta E5.1 actualizada: docs/etapa-5/nota-release-e5-1.md.

## Evidencia obligatoria en el PR

1. Salida del comando npm run lab:e5-1:gate con estado exitoso.
2. Resultado de CI post-merge con linea unica de resumen:
E5.1 gate result: integration_files_passed=6/6; integration_tests_passed=11/11.
3. Referencia a la nota de release E5.1.

## Plantilla de comentario final de PR

CI post-merge en verde: workflow validate ejecutado con estado Success.
Gate E5.1 ejecutado correctamente, incluyendo reporte de cobertura ampliada en logs.
Resumen final del gate: E5.1 gate result: integration_files_passed=6/6; integration_tests_passed=11/11.
Evidencia documental actualizada en docs/etapa-5/nota-release-e5-1.md.
