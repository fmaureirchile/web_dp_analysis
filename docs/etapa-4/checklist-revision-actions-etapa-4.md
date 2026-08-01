# Mini checklist - Revision de GitHub Actions para cierre remoto de Etapa 4

Fecha: 2026-07-31
Objetivo: confirmar en ejecucion remota de CI que el cierre de Etapa 4 puede aceptarse formalmente.

## Cuando usar este checklist

1. Despues de push o PR que incluya cambios de Etapa 4.
2. Antes de aceptar cierre remoto definitivo de Etapa 4.
3. Antes de habilitar inicio de Etapa 5.1 con evidencia de pipeline.

## Precondicion

1. Workflow CI ejecutado sobre el commit objetivo.
2. Deben existir los jobs validate y db-migration.

## Checklist rapido

### A. Job validate

1. Estado final del job:
- Debe estar en Success.

2. Paso Laboratory gate E4-B1:
- Debe ejecutarse y quedar en Success.
- Debe incluir ejecucion de:
  - npm run lab:manifests:validate
  - npm run lab:test

3. Paso Integration tests:
- Debe estar en Success.
- Debe mostrar suite de integracion completa en verde.

4. Paso Build:
- Debe estar en Success.

5. Paso Validate OpenAPI contract:
- Debe estar en Success.

6. Paso Validate environment variables:
- Debe estar en Success.

7. Paso Check hardcoded secrets:
- Debe estar en Success.

### B. Job db-migration

1. Estado final del job:
- Debe estar en Success.

2. Servicio postgres:
- Debe iniciar correctamente.
- Health check de postgres sin errores.

3. Paso Apply migrations:
- Debe estar en Success.
- No debe haber errores de migracion (P3009, P3018, P1001, P1000).

## Criterio de aceptacion remoto

Aceptar cierre remoto de Etapa 4 solo si:

1. validate = Success.
2. db-migration = Success.
3. Laboratory gate E4-B1 ejecutado y en Success.
4. Sin reruns manuales para ocultar fallas del mismo commit.

## Evidencia minima a registrar

1. URL de la corrida en GitHub Actions.
2. Commit SHA validado.
3. Resultado de validate.
4. Resultado de db-migration.
5. Captura o extracto textual del paso Laboratory gate E4-B1.
6. Fecha y responsable de la revision.

## Fallas bloqueantes (no aceptar cierre)

1. Laboratory gate E4-B1 omitido o en fallo.
2. validate en rojo aunque db-migration este en verde.
3. db-migration en rojo aunque validate este en verde.
4. Errores de migracion o conectividad en job db-migration.

## Accion recomendada si falla

1. Corregir en rama.
2. Re-ejecutar workflow en nuevo commit.
3. Reaplicar este checklist sobre la nueva corrida.
