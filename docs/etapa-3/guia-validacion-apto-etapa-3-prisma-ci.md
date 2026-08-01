# Guia rapida - Validacion APTO Etapa 3 en modo CI

Fecha base: 2026-07-31  
Duracion objetivo: 10 a 15 minutos (incluye ejecucion de pipeline)

## Objetivo

Validar Etapa 3 con persistencia Prisma sobre PostgreSQL efimero de CI, sin depender de credenciales locales fijas.

## Cuando usar esta guia

- Antes de aprobar PRs que afecten salvaguardas de Etapa 3.
- Antes de marcar un hito como APTO en entorno compartido.
- Cuando se necesite evidencia reproducible de integracion en runners limpios.

## Alcance de validacion

Esta corrida valida en CI:

1. Entorno y contratos tecnicos (lint, typecheck, OpenAPI, tests).
2. Migraciones Prisma sobre PostgreSQL efimero.
3. Integracion en modo USE_PRISMA_PERSISTENCE=true a traves de DATABASE_URL del workflow.

## Pre-requisitos

1. Repositorio con workflow activo en .github/workflows/ci.yml.
2. Permisos para abrir PR o hacer push a rama de trabajo.
3. Dependencias de Node y scripts npm ya definidas en package.json.

## Variables relevantes en CI

Definidas por workflow para el job de validacion:

- NODE_ENV=test
- APP_PORT=3000
- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/web_analysis_ci?schema=public
- REDIS_URL=redis://localhost:6379

Definidas para el job de migraciones:

- Servicio postgres:16 efimero.
- POSTGRES_DB=web_analysis_ci
- POSTGRES_USER=postgres
- POSTGRES_PASSWORD=postgres

## Secuencia CI (pipeline oficial)

### Paso 1 - Disparar ejecucion

Opciones:

1. Abrir/actualizar Pull Request.
2. Hacer push a rama main o develop.

Para que sirve:

- Ejecuta automaticamente el workflow CI definido en el repositorio.

Salida esperada:

- Workflow CI iniciado con jobs validate y db-migration.

### Paso 2 - Verificar job validate

Comandos ejecutados por el workflow (referencia):

1. npm ci
2. npm run db:generate
3. npm run openapi:validate
4. npm run env:validate
5. npm run secret:check
6. npm run lint
7. npm run typecheck
8. npm test
9. npm run test:integration
10. npm run build

Para que sirve:

- Verifica calidad base y regresiones funcionales con una configuracion controlada.

Salida esperada:

- Job validate en estado Success.

### Paso 3 - Verificar job db-migration

Comandos clave:

1. npm ci
2. npm run db:generate
3. npm run db:migrate:deploy

Para que sirve:

- Certifica que migraciones son aplicables en una base limpia de PostgreSQL.

Salida esperada:

- Job db-migration en estado Success.

## Criterio APTO en CI

Declarar APTO de Etapa 3 en CI cuando:

1. validate = Success.
2. db-migration = Success.
3. Sin reintentos manuales por fallas de schema o credenciales.

## Evidencia que se debe registrar

1. URL de la corrida de workflow.
2. Commit SHA validado.
3. Estado final de ambos jobs.
4. Fecha/hora del cierre de validacion.

## Troubleshooting rapido

### Falla en db:migrate:deploy (P3018)

Posible causa:

- SQL de migracion con codificacion invalida (por ejemplo BOM al inicio).

Accion:

1. Regrabar migration.sql en UTF-8 sin BOM.
2. Reejecutar pipeline desde nuevo commit.

### Falla por campo desconocido en Prisma Client

Posible causa:

- Cliente Prisma desalineado con schema.

Accion:

1. Ejecutar npm run db:generate en cambios locales.
2. Confirmar que los archivos generados estan alineados antes de push.

### Falla de tests de integracion por dependencia de estado

Posible causa:

- Datos o supuestos no aislados por prueba.

Accion:

1. Verificar reset de store y aislamiento en each test.
2. Repetir ejecucion de tests localmente con USE_PRISMA_PERSISTENCE=true.
