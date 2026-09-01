# Backlog - Etapa 6 (navegador automatizado y observacion dinamica)

## Objetivo del subcorte inicial

Habilitar observacion dinamica controlada con evidencia trazable y sin desviaciones de alcance ni presupuesto.

## Criterio de salida Etapa 6

Etapa 6 se considera apta cuando:

1. Se captura DOM renderizado y screenshot por pagina visitada.
2. Se registra red basica con correlacion pagina-accion-ejecucion.
3. Se registra storage basico (cookies/localStorage/sessionStorage) por ejecucion.
4. Existe gate Etapa 6 en verde en local y CI.
5. El desvio de presupuesto se mantiene dentro de tolerancia definida.

## Orden de ejecucion recomendado

1. E6-T01 -> E6-T02 -> E6-T03 -> E6-T04 -> E6-T05 -> E6-T06.
2. Exigir evidencia por tarea en el primer commit.

## E6-T01 - Contrato de observacion dinamica minima

- Objetivo unico: definir DTOs y eventos minimos de salida para render, red y storage.
- Archivos objetivo: packages/contracts/, docs/contracts/openapi.yaml, docs/etapa-6/.
- Criterio de aceptacion: contratos versionados y validados por openapi:validate.
- Pruebas desde inicio:
  - Validacion de contrato OpenAPI.
  - Typecheck sin errores.
- Estimacion: 28 horas, 120k a 180k tokens.

## E6-T02 - Renderizado + captura DOM/screenshot

- Objetivo unico: ejecutar carga de pagina y almacenar evidencia de DOM y screenshot.
- Archivos objetivo: apps/worker-browser/, apps/api/, packages/evidence/, tests/integration/.
- Criterio de aceptacion: evidencias DOM/screenshot disponibles y consultables por executionId.
- Pruebas desde inicio:
  - Integracion en sitio sintetico (camino feliz).
  - Caso de timeout controlado.
- Estimacion: 52 horas, 260k a 340k tokens.

## E6-T03 - Captura de red basica

- Objetivo unico: capturar request/response metadata de fetch/XHR y asociarla a pagina/accion.
- Archivos objetivo: apps/worker-browser/, packages/domain/, tests/integration/.
- Criterio de aceptacion: inventario de requests por ejecucion con third-party y estado HTTP.
- Pruebas desde inicio:
  - Caso con terceros permitidos.
  - Caso con redirecciones y filtros de alcance.
- Estimacion: 58 horas, 300k a 390k tokens.

## E6-T04 - Captura de storage basica

- Objetivo unico: registrar cookies/localStorage/sessionStorage con metadatos seguros.
- Archivos objetivo: apps/worker-browser/, packages/domain/, packages/security/, tests/integration/.
- Criterio de aceptacion: artefactos de storage disponibles con politica de minimizacion/enmascaramiento.
- Pruebas desde inicio:
  - Presencia/ausencia por escenario de consentimiento.
  - Verificacion de enmascaramiento.
- Estimacion: 46 horas, 240k a 320k tokens.

## E6-T05 - Eventos de interaccion y SPA minimo

- Objetivo unico: trazar interacciones basicas (click/navigation/modal) y su efecto en red/storage.
- Archivos objetivo: apps/worker-browser/, packages/domain/, tests/integration/, test-lab/sites/.
- Criterio de aceptacion: timeline minimo por ejecucion con correlacion de eventos.
- Pruebas desde inicio:
  - Flujo SPA con cambio de vista.
  - Apertura de modal con requests asociados.
- Estimacion: 44 horas, 230k a 300k tokens.

## E6-T06 - Gate de cierre Etapa 6

- Objetivo unico: consolidar comando unico de gate E6 con pruebas y reporte operativo.
- Archivos objetivo: package.json, .github/workflows/ci.yml, docs/etapa-6/, tools/.
- Criterio de aceptacion: gate E6 reproducible en local y CI con resumen unico de resultados.
- Pruebas desde inicio:
  - Ejecucion limpia del gate en local.
  - Evidencia de corrida CI en verde.
- Estimacion: 32 horas, 150k a 220k tokens.

## Estimacion acumulada Etapa 6

1. Horas humanas: 260.
2. Tokens aproximados: 1,30M a 1,75M.
3. Colchon de riesgo recomendado: +15% (horas y tokens) para incidentes de infraestructura/browser.

## Estado de cumplimiento parcial

1. E6-T01: completada (contrato minimo definido en contracts y OpenAPI).
2. E6-T02: completada (captura minima DOM/screenshot + endpoint start/result con prueba de integracion).
3. E6-T03: completada (inventario minimo de red por ejecucion con status HTTP y deteccion third-party por hostname).
4. E6-T04: completada (captura basica de cookies con minimizacion y enmascaramiento por defecto).
5. E6-T05: completada (timeline SPA minimo con eventos de interaccion y correlacion en red/storage).
6. E6-T06: pendiente.

## Riesgos principales y mitigacion

1. Flakiness de navegador en CI.
- Mitigacion: timeouts controlados, retries acotados y fixtures deterministas.

2. Sobrecaptura de datos sensibles.
- Mitigacion: minimizacion por defecto, enmascaramiento y revision de seguridad por tarea.

3. Desviacion de presupuesto por retrabajo.
- Mitigacion: checkpoints semanales de alcance y congelamiento de contrato por sprint.
