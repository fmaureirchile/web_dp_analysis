# Checklist operativo - Piloto E2E autorizado

Fecha: 2026-09-03

## Objetivo

Asegurar que cada piloto E2E se ejecute dentro de alcance autorizado, con evidencia verificable y cierre seguro de credenciales.

## Cuando usarlo

1. Antes de iniciar un piloto en entorno de homologacion o preproduccion.
2. Al cierre de cada corrida piloto para confirmar limpieza y trazabilidad.
3. Como criterio de aprobacion para avanzar a una siguiente ventana piloto.

## Checklist pre-ejecucion

1. Alcance autorizado verificado:
- Dominio, subdominio y rutas aprobadas en autorizacion activa.
- Operaciones permitidas alineadas con el plan de prueba.

2. Credenciales y secretos:
- Credenciales de prueba emitidas para ventana acotada.
- No reutilizar credenciales de ambientes productivos.
- Contacto de emergencia definido para kill switch.

3. Validacion tecnica base:
- Ejecutar npm run lab:e17:gate.
- Confirmar salida en verde con docs_stage17_runbook=ok.

4. Preparacion de evidencia:
- Correlation id habilitado en solicitudes operativas.
- Ruta de almacenamiento de logs del piloto definida.

## Checklist durante ejecucion

1. Monitoreo de alcance:
- Bloqueos fuera de alcance registrados sin bypass manual.

2. Evidencia minima por corrida:
- executionId de cada corrida.
- Resultado de observacion dinamica o error controlado.
- Resultado de comparacion/versionado cuando aplique.

3. Señales de incidente:
- Error repetitivo de alcance o autorizacion.
- Comportamiento no esperado del escaner.
- Degradacion que impida cierre seguro.

## Checklist post-ejecucion

1. Purga puntual por corrida cerrada:
- Ejecutar POST /api/v1/privacy/executions/<executionId>/purge cuando corresponda.
- Guardar respuesta con deletedCounts.

2. Retencion por ventana:
- Ejecutar POST /api/v1/privacy/retention/apply con windowMinutes y states aprobados.
- Confirmar candidateExecutions y purgedExecutions.

3. Cierre de credenciales:
- Revocar o rotar credenciales de prueba utilizadas.
- Eliminar secretos temporales de variables de entorno del job.

4. Cierre formal:
- Registrar evidencia (log + respuesta JSON) en bitacora del piloto.
- Documentar incidencias y acciones correctivas.

## Criterio de aprobacion de corrida

1. No hubo ejecuciones fuera de alcance autorizado.
2. Se obtuvo evidencia minima y trazabilidad por executionId.
3. Se aplico limpieza post-corrida (purga y/o retencion) segun politica.
4. Se completó cierre de credenciales temporales.

## Escalamiento minimo

1. Si falla gate E17, bloquear corrida y corregir antes de reintento.
2. Si hay desalineacion de politica de retencion, escalar a responsable legal/compliance.
3. Si se detecta riesgo de seguridad, activar kill switch y notificar contacto de emergencia.
