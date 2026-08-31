# Backlog - Etapa 5.3 (estabilidad operativa y control continuo)

## Objetivo del subcorte

Fortalecer robustez de ejecucion, gobernanza de calidad y evidencia operativa de Stage 5 manteniendo cobertura funcional E5.2.

## Criterio de salida E5.3

E5.3 se considera apta cuando:

1. Existe politica operativa documentada para estabilidad del runner (decision + rollback aplicable).
2. Existe evidencia estandarizada post-merge para gates de Stage 5.
3. Existen pruebas y/o controles de no regresion para el flujo de observabilidad y cierre.
4. Existe gate minimo E5.3 reproducible en local y CI.

## Inicio operativo recomendado E5.3

1. Confirmar baseline E5.2 en verde con npm run lab:e5-2:gate.
2. Ejecutar tareas en orden E5-3-T01 -> E5-3-T02 -> E5-3-T03 -> E5-3-T04.
3. Exigir evidencia de validacion por tarea desde el primer commit.

## Gate minimo inicial propuesto para E5.3

Objetivo: mantener cobertura funcional completa mientras se introducen mejoras operativas.

Comando recomendado provisional:

npm run lab:e5-2:gate

Cuando usarlo:

1. Antes de mergear PRs de E5.3.
2. Antes de cambios en configuracion del runner de pruebas.
3. Como validacion obligatoria para cerrar cada tarea E5-3-T01..T04.

## E5-3-T01 - Politica de estabilidad del runner Stage 5

- Objetivo unico: formalizar decision tecnica de pool/ejecucion y criterio de rollback.
- Dependencias: cierre E5.2.
- Archivos afectados: docs/adr, package.json, .github/workflows/ci.yml.
- Criterio de aceptacion: decision aprobada y trazable con condiciones de rollback.
- Pruebas desde inicio:
  - Verificacion de gate E5.2 en local.
  - Verificacion de gate E5.2 en CI.

## E5-3-T02 - Estandar de evidencia post-merge

- Objetivo unico: unificar checklist y comentario final post-merge para Stage 5.
- Dependencias: E5-3-T01.
- Archivos afectados: docs/etapa-5.
- Criterio de aceptacion: paquete de merge con evidencia minima obligatoria operable.
- Pruebas desde inicio:
  - Simulacion de lectura rapida en run CI y captura de datos requeridos.

Estado de arranque:

- Plantilla unica pre-merge/post-merge disponible en docs/etapa-5/plantilla-comentario-pr-e5-3.md.

## E5-3-T03 - Control de no regresion de observabilidad

- Objetivo unico: asegurar que eventos por executionId/correlationId no se degraden.
- Dependencias: E5-2-T06.
- Archivos afectados: apps/api/src, tests/integration.
- Criterio de aceptacion: pruebas de observabilidad mantienen consistencia en exito y error.
- Pruebas desde inicio:
  - Ejecutar tests/integration/stage5-observability.integration.test.ts en verde.

Estado de arranque:

- Cobertura ampliada en tests/integration/stage5-observability.integration.test.ts (orden temporal, detalle de eventos y aislamiento por executionId/correlationId).
- Comando dedicado: npm run lab:e5-3:obs-regression.
- Paso dedicado en CI: Stage 5.3 observability regression.

## E5-3-T04 - Gate de cierre E5.3

- Objetivo unico: definir comando unico E5.3 con validaciones operativas adicionales.
- Dependencias: E5-3-T02 y E5-3-T03.
- Archivos afectados: package.json, docs/etapa-5, .github/workflows/ci.yml.
- Criterio de aceptacion: gate reproducible local/CI y documentado.
- Pruebas desde inicio:
  - Ejecucion de gate completo en local.
  - Paso dedicado en workflow validate.

Estado de arranque:

- Comando unico definido: npm run lab:e5-3:gate.
- CI actualizado con pasos dedicados: coverage, ejecucion y resumen validado de E5.3.
- Guia operativa disponible en docs/etapa-5/guia-gate-cierre-e5-3.md.

## Cierre documental E5.3

Estado: COMPLETADO.

Paquete documental de cierre generado y versionado:

1. Acta de cierre: docs/etapa-5/acta-cierre-etapa-5-3.md.
2. Revision de coherencia: docs/etapa-5/revision-coherencia-etapa-5-3.md.
3. Nota de release corta: docs/etapa-5/nota-release-e5-3.md.
4. Checklist final de entrega PR: docs/etapa-5/checklist-entrega-pr-e5-3.md.

Evidencia administrativa asociada:

1. Gate local ejecutado en verde: npm run lab:e5-3:gate.
2. Resumen esperado para CI: E5.3 gate result: stage5_gate_files=9/9; stage5_gate_tests=26/26; obs_regression_files=1/1; obs_regression_tests=4/4.

