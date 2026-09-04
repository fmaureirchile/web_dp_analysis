# Cadencia operativa de corridas piloto E2E

Fecha: 2026-09-03

## Objetivo

Definir una cadencia estandar por cliente para ejecutar corridas piloto E2E con evidencia minima obligatoria, limpieza post-corrida y criterio uniforme de cierre.

## Cuando usarlo

1. Al activar un cliente en fase piloto controlada.
2. Al planificar la agenda semanal de pruebas de compliance tecnico.
3. Al acordar ventana de retencion y responsables de operacion.
4. Antes de escalar de piloto controlado a operacion recurrente.

## Cadencia estandar recomendada

1. Corrida semanal por cliente: 1 corrida completa cada semana.
2. Corrida extraordinaria: solo ante cambio relevante en frontend, backend, politica legal o hallazgo critico.
3. Horario sugerido: ventana fija fuera de picos operativos del cliente.
4. Duracion objetivo de ventana: 30 a 90 minutos por corrida controlada.

## Ventana de retencion recomendada

1. Valor base: windowMinutes=1440 (24 horas) para piloto controlado.
2. Estados incluidos: COMPLETED, COMPLETED_WITH_WARNINGS, FAILED.
3. Ajuste por riesgo:
- Riesgo bajo: 720 minutos.
- Riesgo medio: 1440 minutos.
- Riesgo alto o investigacion activa: 4320 minutos.
4. Regla de aprobacion: cualquier desviacion requiere validacion humana de compliance.

## Checklist ejecutable por corrida

### 1) Pre-ejecucion

1. Confirmar alcance autorizado vigente y sin cambios no aprobados.
2. Ejecutar npm run docs:stage17:runbook.
3. Ejecutar npm run lab:e17:gate.
4. Ejecutar npm run docs:stage17:evidence.
5. Preparar credenciales temporales y contacto de kill switch.

Salida esperada:

1. docs:stage17:runbook en OK.
2. lab:e17:gate en verde.
3. docs:stage17:evidence en OK.
4. Ventana y responsables documentados para la corrida.

### 2) Ejecucion

1. Ejecutar corrida controlada con npm run pilot:e2e:stage17.
2. Verificar HTTP 200 en baselineRun, currentRun, comparison, purge y retention.
3. Guardar executionIds y resumen operativo.

Salida esperada:

1. Evidencia JSON generada en docs/etapa-17/evidencias/.
2. Resultado de comparacion con estado de alerta trazable.
3. Purga y retencion con ok=true.

### 3) Post-ejecucion

1. Emitir bitacora fechada usando plantilla oficial.
2. Confirmar cierre de credenciales temporales.
3. Verificar candidateExecutions y purgedExecutions segun ventana.
4. Registrar decision final de corrida: APTO, APTO_CON_OBSERVACIONES o NO_APTO.

Salida esperada:

1. Bitacora y JSON enlazados en evidencia del dia.
2. Limpieza post-corrida verificable.
3. Trazabilidad completa por executionId.

## Roles y responsables minimos

1. Operador tecnico: ejecuta comandos, captura evidencia y redacta bitacora.
2. Revisor compliance: valida alcance, retencion y cierre de credenciales.
3. Aprobador de corrida: confirma decision final y habilita siguiente ventana.

## Evidencia minima obligatoria

1. Archivo JSON de corrida controlada.
2. Bitacora fechada por corrida.
3. Registro de cierre de credenciales.
4. Resultado de validaciones docs:stage17:runbook, docs:stage17:evidence y lab:e17:gate.

## Criterio de suspension temporal

1. Fallo de gate Stage 17.
2. Alcance no autorizado o ambiguo.
3. Incidente de seguridad o fuga potencial de secretos.
4. Imposibilidad de confirmar limpieza post-corrida.

## Comandos de referencia

1. npm run docs:stage17:runbook
Cuando usarlo: al inicio de cada ventana y tras cambios documentales.

2. npm run lab:e17:gate
Cuando usarlo: previo a cualquier corrida piloto controlada.

3. npm run docs:stage17:evidence
Cuando usarlo: para confirmar que existe evidencia JSON y bitacora real antes de cierre.

4. npm run pilot:e2e:stage17
Cuando usarlo: para ejecutar una corrida completa con evidencia concreta.
