# Control de presupuesto - Etapa 6

Fecha: 2026-08-31

## Objetivo

Mantener la ejecucion de Etapa 6 dentro de presupuesto estimado, con alertas tempranas de desvio en horas humanas y consumo de tokens.

## Baseline aprobado

1. Duracion objetivo: 4 a 5 semanas.
2. Horas humanas objetivo: 260.
3. Tokens de asistencia IA objetivo: 1,5M a 2,0M.

## Distribucion sugerida por sprint (2 semanas)

1. Sprint 1:
- Horas objetivo: 95 a 110.
- Tokens objetivo: 500k a 700k.
- Entregables: E6-T01, avance mayoritario E6-T02.

2. Sprint 2:
- Horas objetivo: 95 a 110.
- Tokens objetivo: 500k a 700k.
- Entregables: cierre E6-T02, E6-T03, avance E6-T04.

3. Sprint 3 (cierre):
- Horas objetivo: 55 a 70.
- Tokens objetivo: 300k a 500k.
- Entregables: E6-T04, E6-T05, E6-T06.

## KPI de control semanal

1. Burn de horas acumuladas vs plan.
2. Burn de tokens acumulados vs plan.
3. Tasa de retrabajo (commits de correccion sobre tareas cerradas).
4. % tareas E6 cerradas vs plan.
5. Estado de gate Etapa 6 (verde/rojo).

## Umbrales de alerta

1. Amarillo:
- >10% de desvio en horas o tokens.
- 1 semana con gate inestable.

2. Rojo:
- >20% de desvio en horas o tokens.
- 2 semanas consecutivas con gate inestable.

## Protocolo de accion ante desvio

1. Congelar alcance adicional no comprometido.
2. Priorizar cierre tecnico de tarea en curso antes de abrir nueva.
3. Activar revision de causa raiz (infraestructura, contrato, flakiness, performance).
4. Reestimar etapa solo despues de aplicar mitigaciones y medir una semana.

## Registro minimo semanal

1. Horas reales consumidas.
2. Tokens estimados consumidos.
3. Estado de tareas E6-T01..T06.
4. Estado de gate E6 y principales fallas.
5. Decision de continuidad, ajuste o contencion.

## Regla de no desviacion

1. No abrir desarrollo de Etapa 7 mientras Etapa 6 no cumpla criterio de salida.
2. No aceptar cambios de alcance de Etapa 6 sin impacto estimado en horas/tokens y aprobacion explicita.
