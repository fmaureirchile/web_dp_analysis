# Handoff operativo diario - Stage 5

Fecha: 2026-08-31

## Objetivo

Entregar una guia de operacion diaria para mantener continuidad de Stage 5, detectar degradaciones tempranas y responder incidentes sin perder trazabilidad.

## Alcance

1. Operacion local antes de abrir o actualizar PR.
2. Lectura rapida de resultados CI.
3. Criterio de accion ante warning o falla.
4. Evidencia minima obligatoria para auditoria tecnica y documental.

## Flujo diario recomendado

1. Ejecutar precondicion de entorno local.
2. Ejecutar gate operativo completo.
3. Verificar salida de tendencia temporal.
4. Validar coherencia documental.
5. Registrar evidencia en PR si hubo warning o ajuste.

## Comandos operativos

### 1) Generar cliente Prisma

Comando:

```bash
corepack pnpm run db:generate
```

Cuando usar:

1. Al iniciar la jornada o despues de actualizar dependencias.
2. Antes de ejecutar suites de integracion si aparece error de inicializacion de @prisma/client.

Parametros:

1. No recibe parametros.

Salida esperada:

1. Exit code 0.
2. Cliente Prisma generado sin errores.

Archivo de evidencia:

1. Salida de terminal local o log CI del step Generate Prisma client.

### 2) Gate operativo de continuidad Stage 5

Comando:

```bash
corepack pnpm run lab:e5-4:gate
```

Cuando usar:

1. Antes de abrir, actualizar o mergear PRs que toquen Stage 5.
2. Antes de cambios en CI, tests, fixtures o documentos de cierre.

Parametros:

1. No recibe parametros directos.
2. Usa internamente scripts encadenados:
- lab:e5-3:gate
- docs:stage5:coherence

Salida esperada:

1. Exit code 0.
2. Resultado funcional Stage 5.2: 10/10 archivos y 23/23 tests.
3. Resultado observabilidad E5.3: 1/1 archivo y 3/3 tests.
4. Coherencia documental: [docs:stage5:coherence] OK.
5. Resumen CI E5.4 con campos temporales:
- last_stage5_3_gate_duration_seconds
- previous_stage5_3_gate_duration_seconds
- stage5_3_gate_delta_seconds

Archivo de evidencia:

1. Log de ejecucion local.
2. En CI: resumen de step Report Stage 5.4 gate result.

### 3) Validacion documental aislada

Comando:

```bash
corepack pnpm run docs:stage5:coherence
```

Cuando usar:

1. Despues de editar documentos en docs/etapa-5.
2. Antes de commitear cambios de governance o release notes.

Parametros:

1. No recibe parametros.

Salida esperada:

1. [docs:stage5:coherence] OK.
2. Si falla, lista exacta de fragmentos faltantes u obsoletos.

Archivo de evidencia:

1. Salida de terminal local.
2. En CI: step Validate Stage 5 docs coherence.

## Parametros operativos de tendencia temporal

Fuente: workflow CI.

1. warning_threshold_seconds
- Valor actual: 480.
- Uso: define si el trend sale como status=ok o status=warning.

2. duration_seconds
- Definicion: duracion actual del gate E5.3 en segundos.
- Uso: linea base de la corrida actual.

3. previous_duration_seconds
- Definicion: ultimo valor historico previo disponible.
- Uso: comparar tendencia corrida a corrida.

4. delta_seconds
- Definicion: duration_seconds - previous_duration_seconds.
- Uso: cuantificar mejora o degradacion.

## Archivos de salida de tendencia

1. .ci/timing-history/e5_3_gate_history.log
- Contenido: historico con timestamp, run_id y duration_seconds.
- Uso: referencia longitudinal para recalibracion.

2. e5_3_gate_timing_history.log
- Contenido: resumen de la corrida actual (actual, previo, delta, umbral).
- Uso: lectura rapida en CI y adjunto en PR.

3. Artifact CI: stage5-gate-timing-history
- Contenido: historico y resumen de corrida.
- Uso: auditoria y recuperacion de evidencia.

## Matriz de decision rapida

1. Caso: Gate en verde y trend status=ok.
- Accion: continuar flujo normal de PR.
- Evidencia minima: resumen E5.4 + docs coherence OK.

2. Caso: Gate en verde y trend status=warning.
- Accion: documentar analisis en PR; revisar cambios recientes de suites, runner y fixtures.
- Evidencia minima: duration, previous, delta, threshold.

3. Caso: Falla docs:stage5:coherence.
- Accion: corregir documentos Stage 5 o snippets de coherencia esperados.
- Evidencia minima: salida de error y commit correctivo.

4. Caso: Falla por @prisma/client no inicializado.
- Accion: ejecutar corepack pnpm run db:generate y repetir gate.
- Evidencia minima: salida exitosa de db:generate + rerun del gate.

## Regla de recalibracion del umbral

Aplicar solo si hay 3 corridas consecutivas con status=warning y sin fallas funcionales.

1. Abrir tarea de recalibracion.
2. Calcular mediana de ultimas 10 corridas.
3. Proponer nuevo umbral = mediana + 20%.
4. Adjuntar evidencia y no mezclar con cambios funcionales grandes.

## Checklist diario de salida

1. db:generate ejecutado si corresponde.
2. lab:e5-4:gate en verde.
3. docs:stage5:coherence en verde.
4. Trend temporal revisado (actual, previo, delta, umbral).
5. Evidencia registrada en PR cuando aplica.
