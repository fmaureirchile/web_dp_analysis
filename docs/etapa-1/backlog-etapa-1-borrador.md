# Backlog borrador - Etapa 1 (fundacion de repositorio y gobierno tecnico)

Este backlog solo se ejecuta despues de cerrar Etapa 0.

## E1-T01 - Estructura de monorepo

- Objetivo unico: crear estructura base /apps /packages /docs /database /test-lab.
- Dependencias: cierre de Etapa 0.
- Salidas: arbol inicial de carpetas.
- Criterio de aceptacion: estructura validada y documentada.

## E1-T02 - Herramientas de calidad

- Objetivo unico: configurar lint, formato y tipado estricto.
- Dependencias: E1-T01.
- Salidas: configuraciones versionadas y ejecutables.
- Criterio de aceptacion: comandos de calidad ejecutan sin errores en plantilla base.

## E1-T03 - Pruebas base

- Objetivo unico: habilitar framework de pruebas unitarias e integracion.
- Dependencias: E1-T02.
- Salidas: suites base y al menos una prueba de humo.
- Criterio de aceptacion: pipeline local verde.

## E1-T04 - Pipeline CI

- Objetivo unico: crear pipeline con install, lint, typecheck, test, build.
- Dependencias: E1-T02 y E1-T03.
- Salidas: flujo CI reproducible.
- Criterio de aceptacion: ejecucion automatica en cada PR.

## E1-T05 - Convenciones de contribucion

- Objetivo unico: definir convenciones para PR, ADR, commits y versionado.
- Dependencias: E1-T01.
- Salidas: plantillas y guia de contribucion.
- Criterio de aceptacion: cualquier colaborador puede abrir PR con plantilla valida.

## E1-T06 - Estrategia de entorno y secretos

- Objetivo unico: definir variables de entorno y politica de secretos.
- Dependencias: E1-T01.
- Salidas: archivo de ejemplo y politica de carga segura.
- Criterio de aceptacion: no hay secretos hardcodeados.

## E1-T07 - Base de datos y migraciones iniciales

- Objetivo unico: configurar motor de migraciones y DB local.
- Dependencias: E1-T01.
- Salidas: primera migracion vacia y guia de uso.
- Criterio de aceptacion: crear y aplicar migracion en entorno local.

## E1-T08 - OpenAPI y contratos iniciales

- Objetivo unico: habilitar generacion de contratos API versionados.
- Dependencias: E1-T01.
- Salidas: endpoint de salud y contrato base.
- Criterio de aceptacion: contrato se genera automaticamente.

## E1-T09 - Cierre de etapa y coherencia

- Objetivo unico: ejecutar revision de coherencia hasta Etapa 1.
- Dependencias: E1-T01 a E1-T08.
- Salidas: informe de hallazgos y ajustes.
- Criterio de aceptacion: listo para iniciar Etapa 2.
