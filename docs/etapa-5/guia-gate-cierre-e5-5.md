# Guia Operativa - Gate de cierre E5.5

## Objetivo

Operar un gate minimo de continuidad para E5.5, preservando estabilidad funcional Stage 5 y trazabilidad operativa mientras se ejecuta deuda residual.

## Cuando usar esta guia

- Antes de abrir o actualizar PRs que toquen CI, scripts de gate o documentos de cierre Stage 5.
- Antes de aprobar y mergear tareas E5-5-T01..T04.
- Como verificacion de continuidad durante todo el subcorte E5.5.

## Comando minimo de continuidad E5.5

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

1. Ejecucion exitosa del comando minimo en local.
2. Run de CI en verde para el job validate.
3. Resumen final de gate E5.4 en CI con formato unico:
E5.4 gate result: stage5_gate_files=10/10; stage5_gate_tests=23/23; obs_regression_files=1/1; obs_regression_tests=3/3; docs_stage5_coherence=ok; last_stage5_3_gate_duration_seconds=15.

4. Evidencia de historico minimo de tiempos E5.3:
- Archivo de historial en cache/artifact: .ci/timing-history/e5_3_gate_history.log
- Resumen por corrida: e5_3_gate_timing_history.log
- Salida de tendencia: E5.3 gate timing trend con duration_seconds, previous_duration_seconds y delta_seconds.

## Criterio de continuidad E5.5

1. Ninguna tarea E5.5 se considera cerrada sin evidencia de gate en verde.
2. Si surge warning por degradacion temporal de E5.3, se documenta analisis en el PR.
3. Cambios en documentos Stage 5 deben mantener coherencia validada por docs:stage5:coherence.
4. Debe quedar disponible evidencia de tiempo actual y referencia previa en cada corrida CI.

## Fallos frecuentes y respuesta operativa

1. Falla de lab:e5-4:gate.
- Uso: aislar primero si la falla es funcional Stage 5.2, observabilidad E5.3 o coherencia documental.
- Accion: ejecutar por separado lab:e5-2:gate, lab:e5-3:obs-regression y docs:stage5:coherence.

2. Falla de docs:stage5:coherence.
- Uso: aplicar cuando existe desalineacion entre CI y documentos Stage 5.
- Accion: revisar y corregir referencias de metricas y resumenes en docs/etapa-5 y workflow CI.

3. Inconsistencia entre CI y documentos.
- Uso: aplicar cuando el resumen esperado no coincide con acta/backlog/guia.
- Accion: corregir fuente oficial definida por el equipo y sincronizar referencias en docs/etapa-5.
