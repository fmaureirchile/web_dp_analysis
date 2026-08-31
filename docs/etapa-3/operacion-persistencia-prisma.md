# Operacion - Persistencia Prisma para salvaguardas de Etapa 3

Esta guia explica cuando activar la persistencia real de salvaguardas, que comando ejecutar y que salida esperar.

## Cuando usar este modo

- Usar cuando se requiere que autorizaciones, ejecuciones y auditoria de alcance sobrevivan reinicios.
- Usar antes de pruebas de certificacion o cierre formal de Etapa 3.
- No es obligatorio para pruebas locales rapidas sin base de datos.

## Variable de entorno

- Nombre: USE_PRISMA_PERSISTENCE
- Valores:
  - true: habilita escritura y validaciones de rate limiting/concurrencia contra base de datos.
  - false (o sin definir): mantiene comportamiento in-memory.

## Secuencia recomendada

1. Verificar dependencias
- Comando: npm install
- Para que sirve: asegura que Prisma CLI y cliente esten disponibles.
- Resultado esperado: instalacion de dependencias sin errores.

2. Aplicar migraciones de Etapa 3
- Comando: npm run db:migrate:deploy
- Para que sirve: crea columnas de salvaguardas y tabla ScopeAuditRequest.
- Resultado esperado: migracion 20260727225000_stage3_scope_safeguards aplicada.

3. (Opcional) Generar cliente Prisma actualizado
- Comando: npm run db:generate
- Para que sirve: regenerar tipos/cliente al cambiar schema.
- Resultado esperado: Prisma Client generated.

4. Levantar API con persistencia habilitada
- Comando (PowerShell): $env:USE_PRISMA_PERSISTENCE="true"; npm run api:start
- Para que sirve: activa validaciones y escrituras en DB para autorizacion, target, ejecucion y auditoria.
- Resultado esperado: API listening on port <APP_PORT>.

5. Ejecutar pruebas de integracion
- Comando: npm run test:integration
- Para que sirve: valida que criterios de Etapa 2 y Etapa 3 sigan en verde.
- Resultado esperado: 4 test files passed, 7 tests passed.

## Que entidades quedan persistidas en modo Prisma

- Organization y Project (para integridad de claves foraneas).
- Authorization con campos de alcance y limites de Etapa 3.
- Target y Execution con metadata de operacion/URL.
- ScopeAuditRequest para trazabilidad de solicitudes de alcance.

## Señales de falla frecuentes

- Error de conexion a base de datos: revisar DATABASE_URL.
- Error por migracion faltante: ejecutar db:migrate:deploy antes de iniciar API.
- Error por FK al crear autorizacion/target: verificar que Organization y Project existan en la misma ejecucion.
