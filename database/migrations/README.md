# Estrategia de migraciones local (Etapa 1 - E1-T07)

Herramienta seleccionada: Prisma Migrate.

## Objetivo

Versionar cambios de esquema de base de datos y aplicarlos de manera consistente en desarrollo local y CI.

## Comandos

1. Generar cliente Prisma:
- npm run db:generate

2. Crear y aplicar migracion en desarrollo local:
- npm run db:migrate:dev -- --name init

3. Aplicar migraciones existentes en entorno objetivo:
- npm run db:migrate:deploy

4. Visualizar base y modelos:
- npm run db:studio

## Notas operativas

1. DATABASE_URL debe apuntar a PostgreSQL local.
2. No editar migraciones aplicadas en ramas compartidas.
3. Todo cambio de esquema debe quedar versionado y revisado por PR.
