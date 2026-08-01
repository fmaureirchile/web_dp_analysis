# Estrategia de entorno y secretos (E1-T06)

## Objetivo

Definir carga segura de variables de entorno y gestion de secretos para desarrollo local, CI y despliegues posteriores.

## Variables requeridas

1. NODE_ENV: development, test o production.
2. APP_PORT: puerto entero entre 1 y 65535.
3. DATABASE_URL: URL valida de PostgreSQL.
4. REDIS_URL: URL valida de Redis.

## Reglas de seguridad

1. Nunca versionar archivos .env reales.
2. Solo versionar plantillas en .env.example sin secretos reales.
3. Toda credencial productiva debe provenir de un gestor de secretos del entorno.
4. Rotar secretos en incidentes y en cambios de personal con acceso privilegiado.
5. Registrar acceso a secretos mediante auditoria del proveedor de infraestructura.

## Controles automatizados

1. Validacion de entorno: npm run env:validate.
2. Deteccion basica de secretos hardcodeados: npm run secret:check.
3. Ambos controles se ejecutan en CI antes de build.

## Operacion por entorno

1. Desarrollo local:
- Usar valores sinteticos de .env.example.
- No reutilizar credenciales de produccion.

2. CI:
- Inyectar variables por secretos del repositorio/organizacion.
- No imprimir secretos en logs.

3. Produccion (etapas posteriores):
- Cargar secretos desde vault.
- Aplicar acceso minimo por rol.
- Configurar expiracion y rotacion.

## Manejo de incidentes

1. Revocar secreto comprometido.
2. Emitir secreto nuevo y actualizar entorno.
3. Revisar logs y alcance de exposicion.
4. Documentar causa raiz y accion preventiva.
