# Reporte one-shot - Validacion APTO Etapa 3

- Fecha: 2026-07-31 17:16:37
- Estado final: APTO
- Duracion total (s): 10.38

## Parametros de ejecucion

- NODE_ENV: test
- APP_PORT: 3000
- REDIS_URL: redis://localhost:6379
- DATABASE_URL: postgresql://postgres:***@localhost:5432/web_analysis?schema=public
- USE_PRISMA_PERSISTENCE: true
- SkipConnectivityCheck: False

## Resultado por paso

| Paso | Comando | Estado | Exit code | Duracion (s) | Log |
|---|---|---|---:|---:|---|
| Conectividad DB | Test-NetConnection host/port de DATABASE_URL | OK | 0 | 3.51 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171626-conectividad-db.log |
| Validar entorno | npm run env:validate | OK | 0 | 0.68 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171626-validar-entorno.log |
| Aplicar migraciones | npm run db:migrate:deploy | OK | 0 | 1.64 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171626-aplicar-migraciones.log |
| Generar cliente Prisma | npm run db:generate | OK | 0 | 1.92 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171626-generar-cliente-prisma.log |
| Tests integracion | npm run test:integration | OK | 0 | 2.39 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171626-tests-integracion.log |

## Criterio APTO

APTO requiere todos los pasos en estado OK.
