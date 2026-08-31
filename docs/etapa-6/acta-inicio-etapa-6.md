# Acta de inicio - Etapa 6

Fecha: 2026-08-31
Precondicion: Etapa 5.5 cerrada con estado APTO.

## Estado de habilitacion

1. Etapa 6 habilitada para ejecucion.
2. Inicio autorizado para observacion dinamica con navegador automatizado.

## Objetivo de la etapa

Observar comportamiento dinamico no visible por crawling HTTP pasivo, manteniendo trazabilidad por executionId y correlationId.

## Alcance aprobado (Etapa 6)

1. Renderizado de pagina y captura DOM/screenshot.
2. Captura de red (request/response metadata) vinculada a pagina y accion.
3. Captura de storage (cookies/localStorage/sessionStorage).
4. Captura minima de eventos de interaccion y navegacion SPA.
5. Cobertura inicial de protocolos fetch/XHR/Beacon.

## Restricciones de ejecucion

1. No ejecutar acciones irreversibles ni transaccionales.
2. Respetar salvaguardas de alcance de Etapa 3.
3. No degradar gates consolidados de Etapa 5.
4. No introducir estructuras paralelas de evidencia fuera del modelo comun.

## Dependencias tecnicas

1. Playwright operativo en worker-browser.
2. Persistencia de evidencias compatible con entidades actuales.
3. Contratos de salida versionados en packages/contracts.
4. Gate de validacion reproducible en CI para Etapa 6.

## Presupuesto de referencia (base)

1. Duracion: 4 a 5 semanas.
2. Esfuerzo humano: 260 horas.
3. Tokens de asistencia IA: 1,5M a 2,0M.

## Criterio de salida inicial

1. Backlog de Etapa 6 definido con tareas y pruebas desde inicio.
2. Plan de control de presupuesto (horas/tokens) publicado.
3. Definicion de gate minimo Etapa 6 para ejecutar en local y CI.
4. Primer corte vertical (render + red + storage minimo) definido y medible.
