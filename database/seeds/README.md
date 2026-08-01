# Seeds de dominio - Etapa 2

## Objetivo

Crear datos sinteticos minimos para probar la cadena de dominio de Etapa 2.

## Script

- Archivo: database/seeds/stage2.seed.ts
- Comando: npm run db:seed

## Cadena incluida

Organization -> Project -> Authorization -> Target -> Execution -> Page -> FormField -> DataObservation -> Evidence -> Finding -> ReviewDecision

## Reglas

1. Solo datos sinteticos.
2. No reutilizar secretos reales.
3. correlationId fijo para trazabilidad de seed.
