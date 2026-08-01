# Plantilla unica de comentario PR - E5.3 (pre-merge y post-merge)

## Objetivo

Estandarizar el comentario de PR para E5.3 con trazabilidad de validacion tecnica, evidencia operativa y referencia a estabilidad de runner (ADR-007).

## Uso recomendado

1. Publicar el bloque pre-merge antes de solicitar aprobacion final.
2. Publicar el bloque post-merge al validar la corrida remota de CI.
3. Completar placeholders con datos reales de la corrida.

## Bloque pre-merge (copiar y pegar)

E5.3 pre-merge listo para revision final.
Gate unico ejecutado en local: npm run lab:e5-3:gate en verde.
Sin desalineaciones contra backlog E5.3; evidencia y alcance documentados en docs/etapa-5/backlog-etapa-5-3.md.
Nota de estabilidad runner aplicada segun ADR-007 (pool forks activo; rollback condicionado a evidencia CI/local).

## Bloque post-merge (copiar y pegar)

E5.3 post-merge validado en CI: run {{URL_RUN}} en estado Success.
Steps confirmados: Report Stage 5.3 gate coverage, Stage 5.3 gate E5-3, Report Stage 5.3 gate result.
Resumen final observado: E5.3 gate result: stage5_gate_files={{STAGE5_FILES}}/{{STAGE5_FILES_TOTAL}}; stage5_gate_tests={{STAGE5_TESTS}}/{{STAGE5_TESTS_TOTAL}}; obs_regression_files={{OBS_FILES}}/{{OBS_FILES_TOTAL}}; obs_regression_tests={{OBS_TESTS}}/{{OBS_TESTS_TOTAL}}.
Evidencia registrada y consistente con guia operativa + ADR-007 (decision --pool=forks y criterio de rollback).

## Checklist rapido de placeholders

1. {{URL_RUN}}: URL de la corrida CI post-merge.
2. {{STAGE5_FILES}}/{{STAGE5_FILES_TOTAL}}: conteo de archivos del gate funcional Stage 5.
3. {{STAGE5_TESTS}}/{{STAGE5_TESTS_TOTAL}}: conteo de tests del gate funcional Stage 5.
4. {{OBS_FILES}}/{{OBS_FILES_TOTAL}}: conteo de archivos del bloque de observabilidad.
5. {{OBS_TESTS}}/{{OBS_TESTS_TOTAL}}: conteo de tests del bloque de observabilidad.

## Referencias

1. docs/etapa-5/backlog-etapa-5-3.md
2. docs/etapa-5/guia-gate-cierre-e5-3.md
3. docs/etapa-5/checklist-entrega-pr-e5-3.md
4. docs/adr/ADR-007-estabilidad-runner-vitest-gate-e5-2.md
