# Backlog - Etapa 5.1 (crawler pasivo una pagina)

## E5-1-T01 - Contrato minimo de entrada/salida

- Objetivo unico: definir request/response para ejecucion de crawler pasivo una pagina.
- Dependencias: acta inicio Etapa 5.
- Archivos afectados: packages/contracts/src, docs/contracts/openapi.yaml.
- Criterio de aceptacion: contrato incluye entryUrl, executionId, statusHttp, title, evidenceId y errores controlados.

## E5-1-T02 - Cliente HTTP pasivo seguro

- Objetivo unico: implementar fetch HTTP GET con timeout y limite de tamano de respuesta.
- Dependencias: E5-1-T01.
- Archivos afectados: apps/worker-crawler/src.
- Criterio de aceptacion: descarga HTML sintetico con restricciones activas y manejo de fallos.

## E5-1-T03 - Gate de alcance previo al fetch

- Objetivo unico: validar URL de entrada contra autorizacion de Etapa 3 antes de ejecutar crawler.
- Dependencias: E5-1-T01.
- Archivos afectados: apps/api/src, apps/worker-crawler/src.
- Criterio de aceptacion: URL fuera de alcance se rechaza sin iniciar fetch.

## E5-1-T04 - Parseo minimo de HTML

- Objetivo unico: extraer titulo y metadatos basicos del HTML sin ejecutar JS.
- Dependencias: E5-1-T02.
- Archivos afectados: apps/worker-crawler/src.
- Criterio de aceptacion: titulo presente cuando existe etiqueta title.

## E5-1-T05 - Persistencia de evidencia HTML

- Objetivo unico: guardar evidencia HTML y metadatos vinculados a execution.
- Dependencias: E5-1-T02 y E5-1-T04.
- Archivos afectados: packages/evidence, apps/api/src/stage2/in-memory-store.ts.
- Criterio de aceptacion: evidencia consultable por executionId.

## E5-1-T06 - Orquestacion de estados de ejecucion

- Objetivo unico: aplicar transicion VALIDATED -> QUEUED -> RUNNING -> COMPLETED y fallback a FAILED.
- Dependencias: E5-1-T03 y E5-1-T05.
- Archivos afectados: apps/api/src, apps/worker-crawler/src.
- Criterio de aceptacion: transiciones consistentes y trazables por correlation_id.

## E5-1-T07 - Endpoint de resultados E5.1

- Objetivo unico: exponer resultado sintetico del corte vertical por API.
- Dependencias: E5-1-T05 y E5-1-T06.
- Archivos afectados: apps/api/src.
- Criterio de aceptacion: respuesta incluye statusHttp, title y evidencia asociada.

## E5-1-T08 - Pruebas E2E en laboratorio

- Objetivo unico: validar Sitio A en modo pasivo sin seguir enlaces ni enviar formulario.
- Dependencias: E5-1-T07.
- Archivos afectados: tests/integration.
- Criterio de aceptacion: pruebas en verde para caso exitoso y caso fuera de alcance.

## E5-1-T09 - Gate de cierre E5.1

- Objetivo unico: definir comando unico para validar contratos, alcance y pruebas del corte vertical.
- Dependencias: E5-1-T08.
- Archivos afectados: package.json, docs/etapa-5.
- Criterio de aceptacion: comando reproducible en local y CI.
