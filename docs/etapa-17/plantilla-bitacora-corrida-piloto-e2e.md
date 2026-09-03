# Plantilla de bitacora - Corrida piloto E2E autorizado

Fecha: [REEMPLAZAR_FECHA_YYYY-MM-DD]

## Cuando usarlo

1. Al cerrar cada corrida piloto E2E controlada en entorno autorizado.
2. Cuando se requiera trazabilidad formal de execution IDs, estados HTTP y resultados de purga/retencion.
3. Antes de actualizar actas, avance global o reportes operativos para direccion/compliance.

## Objetivo de la corrida

[DESCRIBIR_OBJETIVO_OPERATIVO_EN_1_O_2_LINEAS]

## Referencias operativas

1. Checklist: docs/etapa-17/checklist-piloto-e2e-autorizado.md.
2. Runbook: docs/etapa-17/runbook-operativo-piloto.md.
3. Plan de corrida: docs/etapa-17/plan-primera-corrida-piloto-e2e.md.
4. Evidencia JSON: docs/etapa-17/evidencias/[REEMPLAZAR_NOMBRE_ARCHIVO_JSON].json.

## Execution IDs de la corrida

1. baselineExecutionId: [REEMPLAZAR_UUID]
2. currentExecutionId: [REEMPLAZAR_UUID]
3. retentionExecutionId: [REEMPLAZAR_UUID]

## Resultado por fase

1. Observacion baseline: HTTP [REEMPLAZAR_CODIGO].
2. Observacion current: HTTP [REEMPLAZAR_CODIGO].
3. Comparacion baseline vs current: HTTP [REEMPLAZAR_CODIGO], ok=[REEMPLAZAR_BOOL], estado de alerta [REEMPLAZAR_ESTADO].
4. Purga puntual de currentExecutionId: HTTP [REEMPLAZAR_CODIGO], ok=[REEMPLAZAR_BOOL].
5. Retencion por ventana: HTTP [REEMPLAZAR_CODIGO], ok=[REEMPLAZAR_BOOL], candidateExecutions=[REEMPLAZAR_NUMERO], purgedExecutions=[REEMPLAZAR_NUMERO].

## Evidencia de cierre seguro

1. Purga puntual devolvio deletedCounts para artefactos operativos.
2. Retencion elimino ejecuciones fuera de ventana segun politica configurada.
3. Trazabilidad completa conservada mediante executionId y archivo JSON de evidencia.

## Cierre de credenciales

1. [INDICAR_ESTADO_CREDENCIALES_TEMPORALES: REVOCADAS | ROTADAS | NO_APLICA]
2. [INDICAR_EVIDENCIA_O_REFERENCIA_INTERNA_DE_CIERRE]

## Incidencias

1. [DETALLAR_INCIDENCIAS_O_INDICAR_SIN_INCIDENCIAS_BLOQUEANTES]

## Decision

Corrida piloto E2E controlada finalizada en estado [APTO | APTO_CON_OBSERVACIONES | NO_APTO], con evidencia operativa y limpieza post-ejecucion aplicada.
