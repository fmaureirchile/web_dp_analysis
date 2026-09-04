# Runbook operativo inicial - Etapa 17

Fecha: 2026-09-03

## Objetivo

Operar pilotos controlados con trazabilidad, reduciendo riesgo de retencion excesiva y asegurando cierre seguro de ejecuciones.

## Alcance

1. Preparacion de validaciones antes de piloto.
2. Ejecucion de controles de hardening inicial (purga y retencion).
3. Verificacion de salidas y evidencia operativa minima.
4. Cierre seguro al finalizar una corrida o ventana de pruebas.

## Flujo operativo recomendado

1. Ejecutar gate incremental de hardening Etapa 17.
2. Ejecutar purga por executionId cuando se cierre una corrida puntual.
3. Aplicar retencion por ventana temporal al cierre diario o por lote.
4. Verificar respuestas de no disponibilidad para datos purgados.
5. Registrar evidencia de ejecucion y cierre en PR o bitacora operativa.

## Comandos operativos

### 1) Gate incremental de hardening

Comando:

```bash
npm run lab:e17:gate
```

Cuando usar:

1. Antes de abrir, actualizar o mergear PRs que toquen flujos de privacidad de Stage 17.
2. Antes de ejecutar pilotos con datos sinteticos o entornos de homologacion.

Parametros:

1. No recibe parametros.

Salida esperada:

1. Exit code 0.
2. Suites Stage 17 en verde:
- tests/integration/stage17-execution-data-purge.integration.test.ts (2/2)
- tests/integration/stage17-retention-window.integration.test.ts (2/2)

Archivo de evidencia:

1. Log local del comando.
2. En CI: bloque Stage 17 gate result.

### 4) Checklist de corrida piloto E2E

Documento:

- docs/etapa-17/checklist-piloto-e2e-autorizado.md

Cuando usar:

1. Antes de iniciar la corrida para validar alcance y credenciales.
2. Al finalizar la corrida para confirmar purga/retencion y cierre seguro.

### 5) Plan de primera corrida piloto E2E

Documento:

- docs/etapa-17/plan-primera-corrida-piloto-e2e.md

Cuando usar:

1. Para preparar la primera corrida real post-simulacro.
2. Para documentar parametros, evidencia y cierre de credenciales en un formato unico.

### 6) Validacion de evidencia minima de piloto

Comando:

```bash
npm run docs:stage17:evidence
```

Cuando usar:

1. Antes de cerrar una ventana de piloto en PR o corte diario.
2. Despues de generar una corrida real con evidencia JSON y bitacora.

Parametros:

1. No recibe parametros.

Salida esperada:

1. Exit code 0.
2. Mensaje [docs:stage17:evidence] OK.
3. Confirmacion de existencia de:
- docs/etapa-17/evidencias/piloto-e2e-controlado-YYYY-MM-DD.json
- docs/etapa-17/bitacora-corrida-piloto-e2e-YYYY-MM-DD.md
4. Validacion de estructura minima del ultimo JSON de evidencia:
- executedAt valido
- executionIds baseline/current/retention
- status baselineRun/currentRun/retentionRun/comparison/purge/retention
- comparisonSummary.ok, purgeSummary.ok y retentionSummary.ok
- retentionSummary.candidateExecutions y retentionSummary.purgedExecutions
5. Confirmacion de bitacora asociada a la fecha del ultimo JSON.

Archivo de evidencia:

1. Log local del comando.
2. Gate Stage 17 en CI/local con validacion documental reforzada.

### 7) Corrida diaria semiautomatica (validacion + piloto + bitacora)

Comando:

```bash
npm run pilot:e2e:stage17:daily
```

Cuando usar:

1. Para ejecucion recurrente diaria de piloto controlado.
2. Cuando se requiere un solo comando para prechecks, corrida y evidencia.

Parametros:

1. No recibe parametros.

Salida esperada:

1. Exit code 0.
2. Evidencia JSON diaria y bitacora diaria generadas.
3. Validadores docs:stage17:runbook y docs:stage17:evidence en OK.

Archivo de evidencia:

1. docs/etapa-17/evidencias/piloto-e2e-controlado-YYYY-MM-DD.json
2. docs/etapa-17/bitacora-corrida-piloto-e2e-YYYY-MM-DD.md
3. docs/etapa-17/programacion-corrida-piloto.md

### 2) Purga puntual por executionId

Comando:

```bash
curl -X POST "http://localhost:3000/api/v1/privacy/executions/<executionId>/purge"
```

Cuando usar:

1. Al finalizar una corrida de prueba individual.
2. Cuando se detecta necesidad de retirar artefactos operativos de una ejecucion.

Parametros:

1. executionId:
- Identificador de ejecucion a purgar.

Salida esperada:

1. HTTP 200 con ok=true.
2. Campo deletedCounts con conteos por tipo de artefacto eliminado.
3. Mensaje no concluyente que exige validacion de politica.

Archivo de evidencia:

1. Respuesta JSON de la purga.
2. Correlation id de la solicitud.

### 3) Retencion por ventana temporal

Comando:

```bash
curl -X POST "http://localhost:3000/api/v1/privacy/retention/apply" \
  -H "content-type: application/json" \
  -d '{"windowMinutes": 60, "states": ["COMPLETED", "FAILED"]}'
```

Cuando usar:

1. En cierre diario de pruebas.
2. En tareas programadas de limpieza operativa.

Parametros:

1. windowMinutes:
- Ventana en minutos para conservar ejecuciones recientes.
- Rango valido: 1 a 525600.
2. states:
- Estados elegibles para retencion.
- Permitidos: COMPLETED, COMPLETED_WITH_WARNINGS, FAILED.
- Si se omite, se usan los tres estados por defecto.

Salida esperada:

1. HTTP 200 con ok=true.
2. candidateExecutions y purgedExecutions coherentes con la ventana.
3. deletedTotals agregado por tipo de artefacto.

Archivo de evidencia:

1. Respuesta JSON de retencion aplicada.
2. Log de job o terminal que ejecuta la accion.

## Matriz de decision rapida

1. Caso: purga puntual exitosa.
- Accion: validar consulta posterior de resultados purgados (debe devolver no disponible).

2. Caso: retencion sin candidatos.
- Accion: confirmar ventana configurada y estados seleccionados.

3. Caso: invalid_window_minutes.
- Accion: corregir a entero entre 1 y 525600 y reintentar.

4. Caso: invalid_states.
- Accion: ajustar lista de estados permitidos.

## Checklist de cierre seguro

1. Gate E17-T02 en verde.
2. Purga puntual aplicada a corridas finalizadas, cuando corresponda.
3. Retencion aplicada por ventana y estados aprobados.
4. Evidencia de respuestas guardada (log y JSON).
5. Validacion humana de politica de retencion por cliente.
