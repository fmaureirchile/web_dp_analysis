# Kanban web local de backlog

## Objetivo

Visualizar y actualizar el backlog consolidado del proyecto en una interfaz kanban local, con persistencia en JSON versionable dentro del repositorio.

## Comando de arranque

`npm run web:kanban:start`

Cuando usarlo:
- Cuando necesites revisar avance por columnas (To Do, In Progress, Done).
- Cuando quieras actualizar estado de tarjetas y guardar cambios en un archivo del repo.

Resultado esperado:
- Servidor local activo en `http://localhost:4173`.
- Interfaz kanban disponible en navegador.

## Alias disponible

`npm run web:kanban`

Cuando usarlo:
- Igual que `web:kanban:start`; es un alias corto.

## Parametros operativos

Variable de entorno opcional:
- `KANBAN_PORT`: cambia el puerto de escucha.

Ejemplo:
- PowerShell: `$env:KANBAN_PORT=4300; npm run web:kanban:start`

## Persistencia de datos

Archivo persistente:
- `apps/web/data/kanban-backlog.json`

Que guarda:
- `meta`: metadatos de version y fecha de actualizacion.
- `columns`: columnas del tablero.
- `cards`: tarjetas del backlog con etapa, prioridad y estado.

Cuando se actualiza:
- Al presionar `Guardar cambios` en la UI.

## Campos de cada tarjeta

- `id`: identificador unico.
- `title`: nombre breve de la tarea.
- `description`: detalle operativo.
- `stage`: etapa del roadmap (o `ops`).
- `priority`: `P1`, `P2` o `P3`.
- `status`: `todo`, `in_progress`, `done`.
- `source`: documento de referencia que respalda el item.

## Filtros disponibles en UI

- Filtro por etapa.
- Filtro por prioridad.
- Busqueda por texto en titulo/descripcion.

## Flujo de uso recomendado

1. Levantar el tablero con `npm run web:kanban:start`.
2. Filtrar por etapa o prioridad segun ventana de trabajo.
3. Mover estados de tarjetas desde el selector de cada card.
4. Guardar cambios para persistir en JSON.
5. Versionar el JSON en commit cuando corresponda.
