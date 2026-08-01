# Guia rapida - Validacion APTO Etapa 3 con PostgreSQL local

Fecha base: 2026-07-31  
Duracion objetivo: 8 a 10 minutos

## Objetivo

Ejecutar una validacion completa de Etapa 3 con persistencia real (Prisma + PostgreSQL) y confirmar estado APTO con pruebas de integracion en verde.

## Cuando usar esta guia

- Antes de cerrar formalmente Etapa 3 en un entorno nuevo.
- Cuando se necesita evidencia de que las salvaguardas funcionan contra DB real.
- Cuando un integrante del equipo debe reproducir el resultado APTO en su maquina.

## Resultado esperado

Al finalizar:

1. Migraciones Prisma aplicadas en la base local.
2. Prisma Client regenerado.
3. Suite de integracion en verde con USE_PRISMA_PERSISTENCE=true.
4. Evidencia lista para actualizar el acta de cierre.

## Pre-requisitos

1. Node.js y npm instalados.
2. Servicio PostgreSQL activo en localhost:5432.
3. Dependencias del repo instaladas (node_modules existente o npm install ejecutado).
4. Ubicarse en la raiz del repo.

## Variables de entorno usadas

Estas variables se exportan en sesion PowerShell para evitar dependencia de carga automatica de .env:

- NODE_ENV: define modo de ejecucion (usar test para validacion).
- APP_PORT: puerto de API (3000 recomendado).
- REDIS_URL: requerido por validacion de entorno (valor local valido).
- DATABASE_URL: cadena de conexion PostgreSQL usada por Prisma.
- USE_PRISMA_PERSISTENCE: activa validaciones y escrituras sobre DB real.

Valor de referencia usado en esta validacion:

DATABASE_URL=postgresql://postgres:pass@localhost:5432/web_analysis?schema=public

## Procedimiento paso a paso

### Paso 1 - Confirmar conectividad minima a PostgreSQL

Comando:

```powershell
Test-NetConnection -ComputerName localhost -Port 5432 | Format-List ComputerName,RemotePort,TcpTestSucceeded
```

Para que sirve:

- Verifica que el puerto de PostgreSQL este accesible.

Salida esperada:

- TcpTestSucceeded : True

### Paso 2 - Exportar variables para la sesion

Comando:

```powershell
$env:NODE_ENV='test'
$env:APP_PORT='3000'
$env:REDIS_URL='redis://localhost:6379'
$env:DATABASE_URL='postgresql://postgres:pass@localhost:5432/web_analysis?schema=public'
$env:USE_PRISMA_PERSISTENCE='true'
```

Para que sirve:

- Asegura que todos los comandos siguientes usen la misma configuracion de validacion.

Salida esperada:

- Sin salida de error en terminal.

### Paso 3 - Validar variables requeridas

Comando:

```powershell
npm run env:validate
```

Para que sirve:

- Verifica presencia y formato de variables obligatorias.

Salida esperada:

- [env:validate] OK

### Paso 4 - Aplicar migraciones Prisma

Comando:

```powershell
npm run db:migrate:deploy
```

Para que sirve:

- Aplica migraciones versionadas sobre la base objetivo.

Salida esperada:

- Mensaje final equivalente a: All migrations have been successfully applied.

Archivo/artefacto afectado:

- Estado de migraciones en tabla interna de Prisma (_prisma_migrations) dentro de PostgreSQL.

### Paso 5 - Regenerar Prisma Client

Comando:

```powershell
npm run db:generate
```

Para que sirve:

- Sincroniza cliente Prisma local con el schema aplicado.

Salida esperada:

- Generated Prisma Client (...)

Archivo/artefacto afectado:

- Cliente generado en node_modules/@prisma/client.

### Paso 6 - Ejecutar validacion completa de integracion

Comando:

```powershell
npm run test:integration
```

Para que sirve:

- Ejecuta todos los tests de integracion incluyendo cadena Etapa 2 y salvaguardas Etapa 3 en modo persistente.

Salida esperada (referencia actual):

- 4 test files passed
- 8 tests passed

Archivo/artefacto afectado:

- No genera archivo de reporte por defecto; la evidencia queda en salida de terminal.

## Criterio de aprobacion APTO

Considerar APTO cuando se cumplen todos:

1. env:validate en verde.
2. db:migrate:deploy en verde.
3. db:generate en verde.
4. test:integration en verde con USE_PRISMA_PERSISTENCE=true.

## Troubleshooting rapido

### Error P1001 (no conecta a DB)

Accion:

1. Revisar servicio PostgreSQL en ejecucion.
2. Verificar host/puerto en DATABASE_URL.

### Error P1000 (credenciales invalidas)

Accion:

1. Corregir usuario/password en DATABASE_URL.
2. Reintentar con un SELECT simple via Prisma:

```powershell
"SELECT 1;" | npx prisma db execute --stdin --schema prisma/schema.prisma
```

### Error P3018 con caracter invisible al iniciar migration.sql

Sintoma:

- PostgreSQL reporta error de sintaxis en posicion 1 por caracter invisible.

Accion:

1. Reescribir el archivo migration.sql en UTF-8 sin BOM.
2. Marcar migracion fallida como rollback:

```powershell
npx prisma migrate resolve --rolled-back <migration_name>
```

3. Re-ejecutar npm run db:migrate:deploy.

## Checklist de cierre

- PostgreSQL accesible en localhost:5432.
- Variables de sesion exportadas.
- Migraciones aplicadas.
- Prisma Client regenerado.
- Integracion en verde.
- Acta de cierre actualizada a APTO.
