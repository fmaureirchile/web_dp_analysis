# Backlog - Etapa 3 (autorizacion, alcance y salvaguardas)

## E3-T01 - Contrato de autorizacion ampliado

- Objetivo unico: ampliar Authorization para expresar alcance permitido, restricciones y limites operativos.
- Dependencias: cierre de Etapa 2.
- Archivos afectados: packages/domain/src, packages/contracts/src.
- Criterio de aceptacion: autorizacion incluye dominios, rutas excluidas, operaciones, vigencia y kill switch.

## E3-T02 - Normalizacion y validacion de URL

- Objetivo unico: validar dominio y ruta en target y ejecucion mediante normalizacion consistente.
- Dependencias: E3-T01.
- Archivos afectados: apps/api/src/stage2/in-memory-store.ts.
- Criterio de aceptacion: se rechazan dominios no autorizados y rutas excluidas.

## E3-T03 - Gate previo de ejecucion

- Objetivo unico: bloquear ejecuciones fuera de vigencia, con operaciones no permitidas o con kill switch activo.
- Dependencias: E3-T01 y E3-T02.
- Archivos afectados: apps/api/src/stage2/in-memory-store.ts, apps/api/src/stage2/routes.ts.
- Criterio de aceptacion: ejecucion invalida devuelve error de alcance especifico.

## E3-T04 - Simulacion de alcance sin escaneo

- Objetivo unico: habilitar endpoint para verificar alcance de URL/operacion sin lanzar scan.
- Dependencias: E3-T02.
- Archivos afectados: apps/api/src/stage2/routes.ts, apps/api/src/stage2/in-memory-store.ts.
- Criterio de aceptacion: respuesta con allowed y razones cuando se bloquea.

## E3-T05 - Auditoria de solicitudes de alcance

- Objetivo unico: registrar solicitudes permitidas/bloqueadas para trazabilidad.
- Dependencias: E3-T03 y E3-T04.
- Archivos afectados: apps/api/src/stage2/in-memory-store.ts, apps/api/src/stage2/routes.ts.
- Criterio de aceptacion: existe listado de auditoria en API minima.

## E3-T06 - Pruebas de integracion de criterios de salida

- Objetivo unico: cubrir rechazos obligatorios y caso de kill switch en suite automatizada.
- Dependencias: E3-T01 a E3-T05.
- Archivos afectados: tests/integration/stage3-safeguards.integration.test.ts.
- Criterio de aceptacion: pruebas en verde para dominios, vigencia, rutas excluidas, autorizacion inexistente y redireccion fuera de alcance.
