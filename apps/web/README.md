# Front web local para analisis

## Objetivo

Entregar una interfaz web operativa para ejecutar analisis sobre una URL o varias URLs (separadas por coma o salto de linea), visualizar resultados en pantalla y descargar evidencia en JSON o CSV.

## Que hace este front

1. Recibe una o varias URLs desde la UI.
2. Llama al backend local de esta app (`/api/analyze`).
3. El backend de esta app orquesta las llamadas al API real (`/api/v1`):
   - crea organizacion
   - crea proyecto
   - crea autorizacion
   - crea target
   - crea execution
   - ejecuta analisis pasivo o dinamico
4. Retorna un resumen por URL y lo muestra en tabla.
5. Permite descargar el resultado en JSON y CSV.
6. Permite generar resumen ejecutivo por dominio con asistencia OpenAI (o fallback local).

## Comandos de arranque

Comando unico (API + Front):
- `npm run dev:analysis:start`

Comando principal:
- `npm run web:analysis:start`

Alias corto:
- `npm run web:analysis`

Compatibilidad con comando anterior:
- `npm run web:kanban:start`
- `npm run web:kanban`

Cuando usar cada uno:
- Usa `dev:analysis:start` cuando quieras levantar todo el stack local de una sola vez para uso diario.
- Usa `web:analysis:start` cuando quieras iniciar explicitamente el front de analisis.
- Usa `web:analysis` cuando quieras un alias corto equivalente.
- Usa `web:kanban:*` solo si tienes automatizaciones antiguas que aun apuntan a ese nombre.

Resultado esperado:
- Front disponible en `http://localhost:4173` (o el puerto indicado por variable de entorno).
- Endpoint interno del front disponible en `/api/analyze`.

## Contrato operativo del endpoint interno

Endpoint:
- `POST /api/analyze`

Endpoint adicional:
- `POST /api/executive-summary`
  - Recibe `analysis` (payload tecnico previo) y `language`.
  - Devuelve `data.summaries[]` con resumen ejecutivo por dominio.

Parametros de entrada (body JSON):
- `urls` (obligatorio): arreglo de URLs `http/https`.
- `mode` (opcional): `passive` o `dynamic`.
  - Valor por defecto: `passive`.
- `timeoutMs` (opcional): timeout total por URL.
  - Rango aplicado por servidor: minimo `5000`, maximo `120000`.
  - Valor por defecto: `30000`.

Validaciones de entrada:
- Si `urls` no contiene al menos una URL valida, responde `400`.
- Si una URL no cumple protocolo `http/https`, responde `400`.
- Si una URL viene sin protocolo (por ejemplo `www.beai.cl`), el front intenta normalizarla como `https://www.beai.cl`.

Opciones de navegacion profunda (opcionales):
- `deepNavigation`: `true/false`.
  - Activa recorrido adicional de subpaginas descubiertas desde las URLs semilla.
- `maxDepth`: profundidad maxima de descubrimiento.
  - Rango aplicado por servidor: `1` a `4`.
- `maxPages`: maximo total de URLs a analizar (incluye semillas + descubiertas).
  - Rango aplicado por servidor: `1` a `50`.
- `sameDomainOnly`: restringe el descubrimiento al mismo dominio.
  - Valor recomendado: `true`.
- `includePaths`: lista de prefijos de ruta a priorizar.
  - Ejemplo: `/conversemos`, `/insights`.
- `excludePaths`: lista de prefijos de ruta a omitir.
  - Ejemplo: `/assets`, `/blog`.
- `activeFormProbe`: activa un probe controlado de envio de formulario en modo `dynamic`.
  - Default: `false`.
- `maxFormProbes`: cantidad maxima de formularios a probar por URL en modo `dynamic`.
  - Rango aplicado: `1` a `3`.
- `probeIncludePaths`: allowlist opcional de prefijos de ruta para limitar el probe.
  - Si se define, el probe solo intenta envios en rutas que comiencen con esos prefijos.
- `probeExcludePaths`: denylist opcional de prefijos de ruta para bloquear probe.
  - Tiene prioridad sobre `probeIncludePaths`.
- `probeBlockSensitiveEndpoints`: bloquea rutas sensibles en probe (`true` por defecto).
  - Evita intentos en rutas como logout, admin, billing, payment y checkout.

Salida principal (respuesta JSON):
- `data.mode`: modo ejecutado.
- `data.deepNavigation`: configuracion efectiva de profundidad y conteos de descubrimiento.
- `data.total`: cantidad de URLs procesadas.
- `data.okCount`: cantidad de analisis exitosos.
- `data.failedCount`: cantidad de analisis fallidos.
- `data.elapsedMs`: tiempo total de ejecucion.
- `data.results[]`: detalle por URL (estado, `executionId`, metadatos o error).
  - En modo `passive` incluye senales de formulario:
    - `formDetected`
    - `formCount`
    - `potentialPiiFields`

Interpretacion de captura:
- `passive` detecta captura potencial (estructura HTML: formularios/campos).
- La captura confirmada requiere evidencia runtime (modo `dynamic` + interacciones/envios observables).
- Con `activeFormProbe=true`, el front puede emitir un request de prueba controlado al endpoint de formulario (mismo dominio), elevando evidencia a `confirmed` cuando el request se observa correctamente.

## Dependencias operativas

Este front requiere que el API real este levantado.

Comando del API real:
- `npm run api:start`

Endpoint de salud recomendado:
- `http://localhost:3000/health`

Si el API real no esta activo, el front mostrara errores de conexion en los resultados.

## Variables de entorno

- `WEB_PORT`: puerto recomendado del front web.
  - Ejemplo PowerShell: `$env:WEB_PORT='4180'; npm run web:analysis:start`
- `KANBAN_PORT`: alias legacy del puerto (compatibilidad con scripts anteriores).
- `ANALYSIS_API_BASE_URL`: base del API real.
  - Default: `http://localhost:3000/api/v1`
  - Ejemplo: `$env:ANALYSIS_API_BASE_URL='http://localhost:3000/api/v1'; npm run web:analysis:start`
- `OPENAI_API_KEY`: clave para habilitar salida asistida por OpenAI.
  - Si no esta definida, el sistema genera resumen fallback local.
- `OPENAI_MODEL`: modelo OpenAI para resumen ejecutivo.
  - Default: `gpt-4o-mini`
  - Ejemplo: `$env:OPENAI_MODEL='gpt-4o-mini'; npm run web:analysis:start`

Ejemplo PowerShell con OpenAI habilitado:
- `$env:OPENAI_API_KEY='sk-***'`
- `$env:OPENAI_MODEL='gpt-4o-mini'`
- `npm run web:analysis:start`

## Resumen ejecutivo asistido por OpenAI

Control de UI:
- Boton `Generar resumen ejecutivo`.
- Boton `Descargar resumen MD`.

Comportamiento:
- Agrupa resultados por dominio y genera 1 resumen ejecutivo por cada dominio analizado.
- Si OpenAI esta configurado, intenta generar resumen con modelo base.
- Si OpenAI no esta configurado o falla, aplica fallback local sin bloquear la operacion.

Salida esperada:
- `data.summaries[]` con:
  - `domain`
  - `summaryMarkdown`
  - `source` (`openai` o `fallback`)
  - `model`
  - `totalUrls`, `okCount`, `failedCount`

## Modo de analisis

La UI permite dos modos:

- `passive`:
  - Usa `POST /crawler/passive/single-page`.
  - Devuelve estado HTTP, titulo, evidencia y metadatos de contenido.
  - Recomendado para chequeos rapidos y bajo costo.

- `dynamic`:
  - Usa `POST /browser/observations/start`.
  - Devuelve metricas de red, storage y eventos de interaccion.
  - Recomendado para revisar comportamiento runtime del sitio.

## Navegacion profunda (opcional)

Control de UI:
- Checkbox `Navegacion profunda (subpaginas del mismo dominio)`.
- Campos `Profundidad maxima` y `Maximo de paginas`.
- Campos `Include paths` y `Exclude paths` (separados por coma o salto de linea).

Cuando usarla:
- Cuando necesitas ampliar cobertura sobre un dominio con multiples secciones internas.
- Cuando buscas detectar formularios o rutas relevantes fuera de la URL inicial.
- Cuando necesitas concentrar el rastreo en secciones criticas con `includePaths`.

Buenas practicas de filtros:
- Define `includePaths` para secciones de negocio relevantes (por ejemplo contacto, onboarding, checkout).
- Usa `excludePaths` para recortar ruido en rutas estaticas o de baja prioridad.
- Si usas ambos, prevalece `excludePaths` sobre `includePaths` cuando una ruta calza en ambos filtros.

## Probe controlado de formulario (dynamic)

Control de UI:
- Checkbox `Validar envio de formulario (probe controlado, opcional)`.
- Campo `Max probes de formulario`.
- Campos `Probe include paths (allowlist)` y `Probe exclude paths (denylist)`.
- Checkbox `Bloquear endpoints sensibles en probe (recomendado)`.

Objetivo:
- Obtener evidencia runtime adicional cuando la prioridad es confirmar mecanismos de captura sobre formularios.

Uso recomendado:
- Activarlo solo en dominios y ambientes autorizados.
- Preferir primero corridas `passive` para detectar rutas objetivo, luego `dynamic` con probe en rutas de contacto/formulario.
- Define `Probe include paths` cuando quieras acotar el probe a rutas explicitas (por ejemplo `/conversemos`, `/contacto`).
- Mantener habilitado el bloqueo de endpoints sensibles para reducir riesgo operativo.

Cuando no usarla:
- Monitoreo rapido o corridas frecuentes donde prima costo/tiempo.
- Sitios con alta cantidad de enlaces internos si no definiste limites conservadores.

Reglas de seguridad del probe:
- `probeExcludePaths` y el bloqueo sensible tienen prioridad sobre la allowlist.
- Si ningun formulario calza con los filtros, el probe se omite con nota `no_form_candidates_after_probe_filters`.

## Formatos de salida

- JSON:
  - Contiene payload completo retornado por el backend del front.
  - Util para trazabilidad tecnica.

- CSV:
  - Incluye resumen tabular por URL:
    - url
    - mode
    - ok
    - executionId
    - analyzedAt
    - statusHttp
    - title
    - contentType
    - contentLength
    - networkRequests
    - storageEvents
    - interactionEvents
    - errorCode
    - message
  - Util para reportes operativos y analisis rapido en hojas de calculo.

Nombre sugerido de archivos al exportar:
- JSON: `analysis-results-YYYYMMDD-HHMMSS.json`
- CSV: `analysis-results-YYYYMMDD-HHMMSS.csv`

## Filtros de resultados en pantalla

- `Estado`:
  - `Todos`: muestra todas las filas.
  - `Solo OK`: limita a analisis exitosos.
  - `Solo ERROR`: limita a analisis fallidos.
- `Solo HTTP >= 400`:
  - Muestra solo filas con codigo HTTP de error/alerta.
  - Util para triage rapido de incidencias.

## Carga de URLs desde archivo

Control de UI:
- `Cargar archivo .txt/.csv`

Formato aceptado:
- URLs separadas por coma y/o salto de linea.

Comportamiento:
- Fusiona URLs del archivo con las ya escritas en textarea.
- Elimina duplicados automaticamente.

## Flujo recomendado

1. Levantar API real: `npm run api:start`.
2. Levantar front: `npm run web:analysis:start`.
3. Abrir `http://localhost:4173`.
4. Ingresar URLs (coma o salto de linea).
5. Elegir modo (`passive` o `dynamic`).
6. Ejecutar analisis.
7. Descargar JSON o CSV segun necesidad.

## Diagnostico rapido

- Sintoma: errores de conexion en todas las URLs.
  - Verificar que el API este activo con `npm run api:start`.
  - Comprobar `ANALYSIS_API_BASE_URL` y endpoint de salud (`/health`).

- Sintoma: respuestas por timeout (`analysis_timeout`).
  - Incrementar `timeoutMs` desde UI.
  - Reducir cantidad de URLs por lote para aislar cuellos de botella.

- Sintoma: errores de autorizacion o dominio fuera de alcance.
  - Revisar que el host de la URL sea resolvible y permita `allowedDomains`.
  - Repetir prueba con una URL simple del mismo dominio para confirmar alcance.
