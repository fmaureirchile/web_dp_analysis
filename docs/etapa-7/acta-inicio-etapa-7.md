# Acta de inicio - Etapa 7

Fecha: 2026-08-31
Precondicion: Etapa 6 cerrada con gate E6 en verde.

## Estado de habilitacion

1. Etapa 7 habilitada para ejecucion.
2. Inicio autorizado para clasificacion inicial de datos observados.

## Objetivo de la etapa

Clasificar de forma inicial los datos detectados en formularios, red y storage para priorizar enmascaramiento y revision.

## Alcance aprobado (primer corte)

1. Contrato minimo de clasificacion en packages/contracts.
2. Motor baseline por reglas keyword-based en packages/classification.
3. Prueba unitaria dedicada para casos health/auth/contact/unclassified.
4. Gate corto reproducible de etapa inicial E7-T01.

## Restricciones de ejecucion

1. No reemplazar aun el pipeline de observacion de Etapa 6.
2. No almacenar valores sensibles en texto plano durante clasificacion.
3. Mantener cambios de bajo costo y baja complejidad.

## Criterio de salida inicial

1. Contrato de clasificacion exportado.
2. Motor de clasificacion baseline ejecutable.
3. Test unitario verde del motor.
4. Script de gate E7-T01 en verde local.
