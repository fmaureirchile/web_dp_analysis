# Apps

Este directorio agrupa los procesos ejecutables del sistema. Cada app resuelve una responsabilidad operativa distinta y se integra con los paquetes compartidos en `packages/*`.

## Mapa rapido

### `api`

Rol:
- Backend principal expuesto en `/api/v1`.
- Orquesta ciclo de analisis, evidencia, reportes y vistas de revision.

Cuando usarlo:
- Cuando necesites exponer endpoints para UI, pruebas de integracion o workers.

### `web`

Rol:
- Front local para disparar analisis por URL y revisar resultados.
- Expone endpoint interno `/api/analyze` y sirve assets estaticos.

Cuando usarlo:
- Para operacion diaria de analisis manual y exportacion JSON/CSV.

### `worker-crawler`

Rol:
- Descubrimiento pasivo de superficie HTTP/contenido.

Cuando usarlo:
- Para analisis `passive` o extraccion de metadatos sin navegacion activa.

### `worker-browser`

Rol:
- Observacion dinamica con eventos de red, storage e interacciones.

Cuando usarlo:
- Para analisis `dynamic` y trazabilidad de comportamiento runtime.

## Comandos operativos

Ejecutar desde la raiz del repositorio.

| Comando | Para que sirve | Parametros practicos | Salida esperada |
| --- | --- | --- | --- |
| `npm run api:start` | Inicia el backend API. | Requiere variables de entorno de API (`NODE_ENV`, `APP_PORT`, `DATABASE_URL`, `REDIS_URL`). | API escuchando en `http://localhost:<APP_PORT>` y `GET /health` en estado `ok`. |
| `npm run web:analysis:start` | Inicia la app web local de analisis. | Opcional `WEB_PORT`, `KANBAN_PORT`, `ANALYSIS_API_BASE_URL`. | Front disponible en `http://localhost:<puerto>` y log de base URL de API usada. |
| `npm run dev:analysis:start` | Levanta stack local (API + Web) en paralelo. | Sin parametros directos; usa variables de entorno ya definidas en la sesion. | Ambos procesos activos con logs separados en terminal. |

## Flujo recomendado de arranque

1. Validar entorno con `npm run env:validate`.
2. Levantar stack con `npm run dev:analysis:start`.
3. Comprobar salud API en `http://localhost:3000/health` (o puerto configurado).
4. Operar UI web para disparar analisis y exportar evidencia.

## Documentacion especifica por app

- `apps/api/README.md`: contrato operativo del backend y variables requeridas.
- `apps/web/README.md`: operacion de la UI, modos de analisis y exportaciones.
