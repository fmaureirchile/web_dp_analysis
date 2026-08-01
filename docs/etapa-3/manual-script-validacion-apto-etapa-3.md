# Manual - Script one-shot de validacion APTO Etapa 3

Script: tools/run-stage3-apto-validation.ps1

## Objetivo

Ejecutar en una sola invocacion la validacion APTO de Etapa 3 en modo Prisma persistente y generar reporte Markdown con resultados por paso.

## Cuando usar

- Antes de actualizar acta de cierre de Etapa 3.
- Como pre-check local antes de abrir PR.
- Cuando se requiere evidencia compacta de una corrida completa.

## Comando base

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-stage3-apto-validation.ps1 -DatabaseUrl "postgresql://usuario:password@localhost:5432/web_analysis?schema=public"
```

## Parametros

1. -DatabaseUrl (obligatorio)
- Que hace: define la conexion PostgreSQL usada por Prisma.
- Formato esperado: URL valida postgresql://... con host, puerto y base.

2. -RedisUrl (opcional)
- Default: redis://localhost:6379
- Que hace: completa variable requerida por env:validate.

3. -NodeEnv (opcional)
- Default: test
- Valores validos: test, development, production.
- Que hace: define entorno de ejecucion para la corrida.

4. -AppPort (opcional)
- Default: 3000
- Rango valido: 1..65535.
- Que hace: completa variable requerida por env:validate.

5. -SkipConnectivityCheck (opcional, switch)
- Que hace: omite prueba inicial de Test-NetConnection a host/puerto de DATABASE_URL.
- Cuando usar: si la red tiene restricciones de probe, pero Prisma conecta igual.

6. -OutputReportPath (opcional)
- Que hace: define ruta exacta del reporte Markdown.
- Default: test-lab/golden-results/stage3-apto-validation-<timestamp>.md

## Pasos ejecutados por el script

1. Conectividad DB (si no se usa -SkipConnectivityCheck).
2. npm run env:validate.
3. npm run db:migrate:deploy.
4. npm run db:generate.
5. npm run test:integration.

## Archivos de salida

1. Reporte principal
- Ruta: test-lab/golden-results/stage3-apto-validation-<timestamp>.md (o -OutputReportPath).
- Contenido: estado final, parametros de corrida, tabla por paso con exit code y duracion.

2. Logs por paso
- Ruta: test-lab/golden-results/logs/stage3-apto-<timestamp>-<paso>.log
- Contenido: salida completa de cada comando.

## Criterio de exito

- Exit code 0 del script.
- Estado final APTO en el reporte.
- Todos los pasos en estado OK.

## Ejemplos

Ejemplo 1 - Corrida estandar:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-stage3-apto-validation.ps1 -DatabaseUrl "postgresql://postgres:pass@localhost:5432/web_analysis?schema=public"
```

Ejemplo 2 - Definir reporte explicito:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-stage3-apto-validation.ps1 `
  -DatabaseUrl "postgresql://postgres:pass@localhost:5432/web_analysis?schema=public" `
  -OutputReportPath "test-lab/golden-results/stage3-apto-validation-manual.md"
```

Ejemplo 3 - Omitir probe TCP:

```powershell
powershell -ExecutionPolicy Bypass -File tools/run-stage3-apto-validation.ps1 `
  -DatabaseUrl "postgresql://postgres:pass@localhost:5432/web_analysis?schema=public" `
  -SkipConnectivityCheck
```
