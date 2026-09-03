# Plan operativo - Primera corrida piloto E2E

Fecha: 2026-09-03

## Objetivo

Ejecutar una primera corrida piloto E2E controlada, con alcance autorizado, evidencia verificable y cierre seguro de credenciales.

## Insumos previos obligatorios

1. Checklist operativo: docs/etapa-17/checklist-piloto-e2e-autorizado.md.
2. Runbook operativo: docs/etapa-17/runbook-operativo-piloto.md.
3. Gate técnico en verde: npm run lab:e17:gate.

## Configuracion minima de corrida

1. Ventana de ejecucion aprobada:
- Fecha/hora inicio:
- Fecha/hora fin:

2. Alcance autorizado:
- organizationId:
- projectId:
- authorizationId:
- targetId:
- dominios permitidos:
- rutas excluidas:

3. Credenciales de prueba:
- owner de credenciales:
- fecha de expiracion:
- estrategia de revocacion:

## Secuencia de ejecucion

### Paso 1) Validacion tecnica previa

Comando:

```bash
npm run lab:e17:gate
```

Criterio de pase:

1. Exit code 0.
2. Confirmacion [docs:stage17:runbook] OK.

### Paso 2) Ejecucion controlada

Acciones:

1. Crear o seleccionar executionId dentro de alcance autorizado.
2. Ejecutar flujo de observacion requerido por el caso piloto.
3. Registrar correlation id y timestamps.

Evidencia minima:

1. executionId.
2. endpoint y payload de inicio.
3. resultado final (ok o error controlado).

### Paso 3) Verificacion post-corrida

Acciones:

1. Consolidar evidencias y validar consistencia de resultados.
2. Registrar incidencias (si las hay) con accion correctiva.

Evidencia minima:

1. resumen de hallazgos por corrida.
2. referencias a logs y respuestas JSON.

### Paso 4) Limpieza y cierre seguro

Purga puntual (si aplica):

```bash
curl -X POST "http://localhost:3000/api/v1/privacy/executions/<executionId>/purge"
```

Retencion por ventana:

```bash
curl -X POST "http://localhost:3000/api/v1/privacy/retention/apply" \
  -H "content-type: application/json" \
  -d '{"windowMinutes": 60, "states": ["COMPLETED", "FAILED"]}'
```

Cierre de credenciales:

1. Revocar o rotar credenciales de prueba usadas.
2. Remover secretos temporales de jobs o shells.

## Criterios de aceptacion de la primera corrida

1. Corrida dentro de alcance autorizado sin bypass.
2. Evidencia minima registrada con trazabilidad completa.
3. Limpieza post-corrida aplicada y comprobada.
4. Cierre de credenciales documentado.
5. Bitacora final emitida con decision operativa.

## Salidas documentales obligatorias

1. Bitacora de corrida real (nuevo archivo fechado en docs/etapa-17/).
2. Actualizacion del avance global con resultado de corrida.
3. Registro de incidencias y decisiones de continuidad.
