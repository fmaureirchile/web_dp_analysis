# Guia Operativa - Gate de cierre E5.4

## Objetivo

Operar un comando unico de cierre para E5.4, asegurando estabilidad funcional Stage 5, coherencia documental y trazabilidad operativa de tiempos.

## Cuando usar esta guia

- Antes de abrir o actualizar PRs que toquen CI, scripts de gate o documentos de cierre Stage 5.
- Antes de aprobar y mergear tareas E5-4-T01..T04.
- Como verificacion final de cierre E5.4 en local y CI.

## Comando unico de cierre E5.4

Comando:

```bash
npm run lab:e5-4:gate
```

Proposito del comando:

1. Revalida cobertura funcional Stage 5.2 sin regresion.
2. Revalida no regresion de observabilidad E5.3.
3. Valida coherencia documental critica de Stage 5.

## Entradas operativas

1. Scripts de package.json:
- lab:e5-2:gate
- lab:e5-3:obs-regression
- lab:e5-3:gate
- docs:stage5:coherence
- lab:e5-4:gate

2. Workflow de CI:
- .github/workflows/ci.yml

3. Documentacion Stage 5:
- docs/etapa-5/

## Salidas y evidencia esperada

1. Ejecucion exitosa del comando unico en local.
2. Run de CI en verde para el job validate.
3. Resumen final de gate E5.4 en CI con formato unico:
E5.4 gate result: stage5_gate_files=10/10; stage5_gate_tests=23/23; obs_regression_files=1/1; obs_regression_tests=3/3; docs_stage5_coherence=ok; last_stage5_3_gate_duration_seconds=15.
4. Registro visible de duracion del gate E5.3 en segundos dentro de CI.
5. Registro visible de comparacion minima de tendencia E5.3 en CI:
E5.3 gate timing trend: status={ok|warning}; duration_seconds={actual}; previous_duration_seconds={previo|na}; delta_seconds={delta|na}; threshold_seconds=480.
6. Confirmacion de que no hay desalineaciones entre resumen esperado del gate y documentos de cierre activos.

## Tendencia de tiempos del gate E5.3 (E5-4-T03)

Paso CI de referencia:

- Report Stage 5.3 gate timing trend

Regla operativa minima:

1. Umbral operativo de advertencia: 480 segundos.
2. Si duration_seconds <= 480, estado esperado: ok.
3. Si duration_seconds > 480, estado esperado: warning (no bloqueante) con recomendacion de revision.

Criterio de accion ante degradacion:

1. Si aparece warning, revisar en el mismo PR cambios sobre suites, runner y fixtures.
2. Si el warning se repite en corridas consecutivas, abrir tarea de ajuste de rendimiento de gate Stage 5.
3. Mantener evidencia en comentario post-merge con el valor duration_seconds observado.

## Controles incluidos por el gate final E5.4

1. Validacion funcional Stage 5.2 (10/10 archivos y 23/23 tests esperados).
2. Regresion de observabilidad E5.3 (1/1 archivo y 3/3 tests esperados).
3. Validacion automatizada de coherencia documental Stage 5.
4. Reporte operativo de tendencia de tiempo del gate E5.3.

## Fallos frecuentes y respuesta operativa

1. Falla de lab:e5-3:gate.
- Uso: aislar primero si la falla es funcional Stage 5.2 o de observabilidad E5.3.
- Accion: ejecutar por separado lab:e5-2:gate y lab:e5-3:obs-regression.

2. Falla de docs:stage5:coherence.
- Uso: aplicar cuando existe desalineacion entre CI y documentos Stage 5.
- Accion: revisar y corregir referencias de metricas y resumenes en docs/etapa-5 y workflow CI.

3. Inconsistencia entre CI y documentos.
- Uso: aplicar cuando el resumen esperado no coincide con acta/backlog/guia.
- Accion: corregir fuente oficial definida por el equipo y sincronizar referencias en docs/etapa-5.

4. Degradacion de tiempo de ejecucion.
- Uso: aplicar cuando el gate tarda sostenidamente mas que la referencia historica.
- Accion: revisar cambios recientes de suites, runner y fixtures antes de mergear y tratar como alerta operativa si supera 480 segundos.
