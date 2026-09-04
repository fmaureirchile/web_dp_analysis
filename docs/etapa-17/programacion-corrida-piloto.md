# Programacion de corrida piloto E2E (task programable)

Fecha: 2026-09-03

## Objetivo

Definir una tarea programable para ejecutar validaciones Stage 17, corrida piloto controlada y generacion semiautomatica de bitacora diaria.

## Cuando usarlo

1. Cuando el equipo requiere ejecucion recurrente sin disparo manual.
2. Cuando se necesita evidencia diaria consistente para auditoria operativa.
3. Cuando se define una ventana fija por cliente en fase de piloto controlado.

## Comando consolidado diario

Comando:

```bash
npm run pilot:e2e:stage17:daily
```

Que ejecuta en cadena:

1. npm run docs:stage17:runbook
2. npm run lab:e17:gate
3. npm run pilot:e2e:stage17
4. npm run pilot:e2e:stage17:bitacora
5. npm run docs:stage17:evidence

Salida esperada:

1. Exit code 0.
2. Evidencia JSON diaria en docs/etapa-17/evidencias/piloto-e2e-controlado-YYYY-MM-DD.json.
3. Bitacora diaria en docs/etapa-17/bitacora-corrida-piloto-e2e-YYYY-MM-DD.md.
4. Mensajes OK en validadores documentales.

## Parametros operativos

1. El comando no recibe parametros obligatorios.
2. Para regenerar bitacora de un JSON especifico:

```bash
npm run pilot:e2e:stage17:bitacora -- --evidence=docs/etapa-17/evidencias/piloto-e2e-controlado-YYYY-MM-DD.json
```

Salida esperada:

1. Mensaje [pilot:e2e:stage17:bitacora] OK.
2. Ruta de evidence_file y bitacora_file en consola.

## Programacion en Windows (Task Scheduler)

Comando de alta de tarea diaria (ejemplo 07:30):

```powershell
schtasks /Create /TN "BEAI-Stage17-Pilot-Daily" /SC DAILY /ST 07:30 /TR "powershell -NoProfile -ExecutionPolicy Bypass -Command \"Set-Location 'C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis'; npm run pilot:e2e:stage17:daily\"" /F
```

Cuando usarlo:

1. En equipos Windows con operacion local programada.
2. Cuando se necesita evidencia diaria en horario fijo.

Salida esperada:

1. Confirmacion SUCCESS de creacion de tarea.
2. Ejecuciones visibles en historial de Task Scheduler.

## Programacion en Linux/macOS (cron)

Entrada sugerida de crontab (ejemplo 07:30 diario):

```bash
30 7 * * * cd /ruta/al/repo/Web_Analysis && npm run pilot:e2e:stage17:daily >> logs/stage17-pilot-daily.log 2>&1
```

Cuando usarlo:

1. En runners o estaciones Unix-like.
2. Cuando el control operativo depende de cron corporativo.

Salida esperada:

1. Log append diario en logs/stage17-pilot-daily.log.
2. Artefactos diarios JSON y bitacora en docs/etapa-17.

## Verificacion post-programacion

1. Ejecutar una corrida manual de prueba del comando consolidado diario.
2. Validar que se generaron ambos artefactos del dia.
3. Revisar que cierre de credenciales quede completado en bitacora.
