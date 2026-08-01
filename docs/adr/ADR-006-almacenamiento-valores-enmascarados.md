# ADR-006 - Almacenamiento de valores enmascarados

- Estado: Aprobado
- Fecha: 2026-07-26

## Contexto

La plataforma debe permitir observacion tecnica sin exponer valores sensibles completos en evidencia o logs.

## Decision

1. Definir modo de almacenamiento para artefactos sensibles: OMITTED o MASKED.
2. Evitar persistir valores completos por defecto en etapas iniciales.
3. Registrar metadatos de evidencia y ubicacion sin incluir secretos en claro.

## Consecuencias

1. Menor riesgo de fuga de datos en repositorio y pipeline.
2. Posible perdida de detalle para analisis forense fino, mitigable con autorizacion explicita posterior.
3. Alineacion con principios de minimizacion y privacidad por defecto.
