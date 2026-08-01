# Reporte one-shot - Validacion APTO Etapa 3

- Fecha: 2026-07-31 17:13:20
- Estado final: FAILED
- Duracion total (s): 5.74

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
| Conectividad DB | Test-NetConnection host/port de DATABASE_URL | OK | 0 | 3.2 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171314-conectividad-db.log |
| Validar entorno | npm run env:validate | OK | 0 | 0.71 | C:\Users\TECH\OneDrive\Documentos\BE_AI_Consulting\Web_Analysis\test-lab\golden-results\logs\stage3-apto-20260731-171314-validar-entorno.log |

## Criterio APTO

APTO requiere todos los pasos en estado OK.
