# ADR-005 - Estrategia de identificadores

- Estado: Aprobado
- Fecha: 2026-07-26

## Contexto

La Etapa 2 requiere entidades correlacionables entre API, evidencia y auditoria sin acoplarse a IDs secuenciales de base de datos.

## Decision

1. Usar UUID v4 para identificadores de entidades en capa de aplicacion.
2. Incluir correlation_id por operacion para trazar llamadas y cambios.
3. Mantener IDs opacos sin semantica de negocio.

## Consecuencias

1. Facilita correlacion entre eventos distribuidos.
2. Reduce riesgo de enumeracion predecible.
3. Permite migrar almacenamiento sin romper referencias externas.
