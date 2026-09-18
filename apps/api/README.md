# API local para analisis

## Objetivo

Proveer un backend HTTP para ejecutar el ciclo de analisis y exponer evidencia, reportes y vistas de revision bajo el prefijo `/api/v1`.

## Que hace esta API

1. Administra entidades base: organizaciones, proyectos, autorizaciones, targets y ejecuciones.
2. Ejecuta analisis pasivo y observacion dinamica.
3. Expone consultas operativas y reportes por ejecucion.
4. Publica endpoints de etapas avanzadas (lineage, legal, monitoreo, privacidad y code-analysis).

## Comando de arranque

Comando principal:
- `npm run api:start`

Para que sirve:
- Inicia `apps/api/src/server.ts` con Express.

Salida esperada:
- Log `API listening on port <APP_PORT>`.
- Endpoint de salud activo en `GET /health`.

## Variables de entorno requeridas

Definidas en `apps/api/src/env.ts` y validadas al iniciar.

- `NODE_ENV`
  - Valores permitidos: `development`, `test`, `production`.
  - Proposito: ajustar comportamiento por ambiente.

- `APP_PORT`
  - Entero entre `1` y `65535`.
  - Proposito: puerto HTTP de la API.

- `DATABASE_URL`
  - Connection string de Postgres.
  - Proposito: persistencia cuando se habilita Prisma.

- `REDIS_URL`
  - URL de Redis.
  - Proposito: soporte de componentes que requieren cache/cola (segun etapa).

Variable adicional usada en persistencia:
- `USE_PRISMA_PERSISTENCE`
  - `true` para activar persistencia Prisma en Stage 2.
  - Si no esta en `true`, usa almacenamiento en memoria.

Ejemplo PowerShell:
- `$env:NODE_ENV='development'`
- `$env:APP_PORT='3000'`
- `$env:DATABASE_URL='postgresql://postgres:pass@localhost:5432/web_analysis?schema=public'`
- `$env:REDIS_URL='redis://localhost:6379'`
- `$env:USE_PRISMA_PERSISTENCE='false'`
- `npm run api:start`

## Endpoints clave

Base path:
- `/api/v1`

Salud:
- `GET /health`

Ciclo base de ejecucion:
- `POST /organizations`
- `POST /projects`
- `POST /authorizations`
- `POST /targets`
- `POST /executions`

Analisis:
- `POST /crawler/passive/single-page`
- `GET /crawler/passive/single-page/:executionId/result`
- `POST /browser/observations/start`
- `GET /browser/observations/:executionId/result`

Consultas y reportes:
- `GET /evidences`
- `GET /reports/executions/:executionId/executive-summary`
- `GET /reports/executions/:executionId/form-inventory`
- `GET /reports/executions/:executionId/tracking-inventory`

## Cuando usar esta API

- Cuando necesites backend local para la app web de analisis.
- Cuando ejecutes pruebas de integracion por etapas (`tests/integration/*`).
- Cuando debas validar contratos y flujos antes de automatizar en pipelines.

## Verificaciones recomendadas

- `npm run env:validate`
  - Verifica variables de entorno y configuracion minima del repo.

- `npm run typecheck`
  - Confirma coherencia de tipos antes de ejecutar pruebas.

- `npm run test:integration`
  - Ejecuta suite de integracion (puede tomar tiempo).

## Diagnostico rapido

- Error `Missing required environment variables`:
  - Definir `NODE_ENV`, `APP_PORT`, `DATABASE_URL`, `REDIS_URL` en la sesion actual.

- Error de persistencia Prisma:
  - Verificar `DATABASE_URL` y migraciones (`npm run db:migrate:deploy`).
  - Si corresponde, regenerar cliente (`npm run db:generate`).

- Error de rutas `404` en crawler/browser:
  - Confirmar que la API iniciada corresponde a este repo y que responde bajo `/api/v1`.
