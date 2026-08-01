# Backlog - Etapa 2 (modelo de dominio y evidencia)

## E2-T01 - Lenguaje comun de dominio

- Objetivo unico: definir entidades, enums y relaciones base en packages/domain.
- Dependencias: cierre Etapa 1.
- Archivos afectados: packages/domain/src/*.
- Criterio de aceptacion: entidades iniciales disponibles sin duplicacion de enums.

## E2-T02 - Contratos de entrada/salida

- Objetivo unico: definir DTO iniciales compartidos para API de cadena funcional.
- Dependencias: E2-T01.
- Archivos afectados: packages/contracts/src/*.
- Criterio de aceptacion: contratos tipados para crear/consultar recursos base.

## E2-T03 - API minima de cadena

- Objetivo unico: implementar endpoints para crear y consultar Organization, Project, Authorization, Target, Execution, Page, FormField, Observation, Evidence, Finding y ReviewDecision.
- Dependencias: E2-T01 y E2-T02.
- Archivos afectados: apps/api/src/*.
- Criterio de aceptacion: flujo completo verificable por prueba de integracion.

## E2-T04 - Modelo de arquitectura y decisiones

- Objetivo unico: documentar modelo de dominio y decisiones criticas de identificadores y enmascaramiento.
- Dependencias: E2-T01.
- Archivos afectados: docs/architecture, docs/adr.
- Criterio de aceptacion: documentos consistentes y sin contradicciones.

## E2-T05 - Persistencia inicial

- Objetivo unico: extender schema y migraciones para entidades base de la cadena.
- Dependencias: E2-T01.
- Archivos afectados: prisma/schema.prisma, prisma/migrations.
- Criterio de aceptacion: migracion aplicable con db:migrate:deploy.

## E2-T06 - Seeds minimos

- Objetivo unico: proveer datos sinteticos minimos para pruebas funcionales locales.
- Dependencias: E2-T05.
- Archivos afectados: database/seeds.
- Criterio de aceptacion: seed reproducible sin datos reales.

## E2-T07 - Revision de coherencia Etapa 2

- Objetivo unico: verificar consistencia de entidades, contratos, estados y trazabilidad.
- Dependencias: E2-T01 a E2-T06.
- Archivos afectados: docs/etapa-2.
- Criterio de aceptacion: sin hallazgos criticos para pasar a Etapa 3.
