# Punto de control - 2026-09-17

## Estado de continuidad validado hoy

1. Gate Stage 17 en verde: npm run lab:e17:gate.
2. Validadores documentales Stage 17 en verde:
- npm run docs:stage17:runbook
- npm run docs:stage17:evidence
3. Stage 5 continua en verde en esta ventana:
- npm run docs:stage5:coherence
- npm run lab:e5-4:gate
4. Gate Stage 16 revalidado en verde: npm run lab:e16:gate.
5. Typecheck revalidado en verde: npm run typecheck.

## Objetivo operativo inmediato

Cerrar B-007 y B-008 con trazabilidad limpia de cambios, evitando mezclar paquetes heterogeneos.

## Estado local detectado

Working tree con cambios distribuidos en:

1. Bloque tecnico historico de persistencia/contratos/tests:
- apps/api/src/stage2/prisma-persistence.ts
- packages/contracts/src/stage2-dto.ts
- prisma/schema.prisma
- tests/integration/stage3-safeguards.integration.test.ts

2. Bloque de estabilizacion de gates:
- package.json
- vitest.integration.config.ts

3. Bloque documental de cierres 11-16 y resumen:
- docs/avance_20260904_1200.md
- docs/etapa-11/README.md
- docs/etapa-12/README.md
- docs/etapa-13/README.md
- docs/etapa-14/README.md
- docs/etapa-15/README.md
- docs/etapa-16/README.md
- docs/etapa-11/acta-cierre-etapa-11.md
- docs/etapa-12/acta-cierre-etapa-12.md
- docs/etapa-13/acta-cierre-etapa-13.md
- docs/etapa-14/acta-cierre-etapa-14.md
- docs/etapa-15/acta-cierre-etapa-15.md
- docs/etapa-16/acta-cierre-etapa-16.md

4. Bloque web kanban local:
- apps/web/

5. Documentos de control historicos sin integrar:
- docs/punto-control_20260901.md
- docs/punto-control_20260904.md
- docs/punto-control_20260905.md

## Propuesta de consolidacion por bloques

### Bloque A - Kanban y seguimiento operativo

Incluye:
- apps/web/
- docs/punto-control_20260917.md
- docs/avance_20260904_1200.md

Validacion previa:
1. npm run typecheck

### Bloque B - Cierres formales 11 a 16

Incluye:
- docs/etapa-11/README.md + acta-cierre-etapa-11.md
- docs/etapa-12/README.md + acta-cierre-etapa-12.md
- docs/etapa-13/README.md + acta-cierre-etapa-13.md
- docs/etapa-14/README.md + acta-cierre-etapa-14.md
- docs/etapa-15/README.md + acta-cierre-etapa-15.md
- docs/etapa-16/README.md + acta-cierre-etapa-16.md

Validacion previa:
1. npm run lab:e16:gate

### Bloque C - Estabilizacion de gates

Incluye:
- package.json
- vitest.integration.config.ts

Validacion previa:
1. npm run lab:e17:gate

### Bloque D - Cambios tecnicos historicos stage2/3

Incluye:
- apps/api/src/stage2/prisma-persistence.ts
- packages/contracts/src/stage2-dto.ts
- prisma/schema.prisma
- tests/integration/stage3-safeguards.integration.test.ts

Validacion previa:
1. npm run typecheck
2. npm run test:integration -- --run tests/integration/stage3-safeguards.integration.test.ts

## Criterio de cierre operativo

1. B-007 pasa a done cuando Bloques A, B y C quedan integrados con validaciones en verde.
2. B-008 pasa a done cuando se define destino de Bloque D y punto-control historicos (integrar o descartar explicitamente), quedando working tree ordenado para retoma.

## Estado actualizado de tarjetas

1. B-007: DONE (criterio cumplido con validaciones en verde en esta ventana).
2. B-008: DONE (higiene de gestion cerrada con destino explicito por bloques).
3. B-013: DONE (warnings npm/pnpm mitigados en helper de reintentos y validacion Stage 5 en verde sin ruido).

## Decision explicita de destino por bloque

1. Bloque A (kanban y seguimiento operativo): integrar en el siguiente commit operativo.
2. Bloque B (cierres formales 11 a 16): integrar en el siguiente commit documental.
3. Bloque C (estabilizacion de gates): integrar en el siguiente commit tecnico de continuidad.
4. Bloque D (cambios tecnicos historicos stage2/3): diferir explicitamente a un ciclo tecnico dedicado para no mezclar con cierre operativo/documental actual.
5. Punto-control historicos 20260901, 20260904 y 20260905: integrar como respaldo de continuidad documental.

## Cierre de higiene para retoma

1. Se considera B-008 cerrado a nivel de gestion: existe inventario, agrupacion y destino explicito por bloque.
2. La ejecucion de commits queda preparada en secuencia A -> B -> C, dejando Bloque D como pendiente tecnico separado.

## Remediacion tecnica adicional aplicada

1. Se ajusto `tools/run-npm-script-with-worker-retry.ts` para sanitizar variables de entorno conflictivas heredadas por ejecuciones anidadas.
2. Se elimino ruido de warning `Unknown env config` en corridas Stage 5 gatilladas desde helper de reintento.

## Auditoria de Bloque D (Stage2/Stage3)

1. Cambio detectado de alto impacto en volumen: 4 archivos con 7 inserciones y 1188 eliminaciones.
2. Distribucion principal:
- apps/api/src/stage2/prisma-persistence.ts
- packages/contracts/src/stage2-dto.ts
- prisma/schema.prisma
- tests/integration/stage3-safeguards.integration.test.ts
3. Validacion focal ejecutada: `npm run test:integration -- --run tests/integration/stage3-safeguards.integration.test.ts` en verde (4/4).
4. Decision operativa: mantener diferido Bloque D para ciclo tecnico dedicado por riesgo de regresion transversal, aun con test focal en verde.
5. Hallazgo cuantitativo adicional: `packages/contracts/src/stage2-dto.ts` elimina 99 declaraciones exportadas (`interface/type`).
6. Hallazgo de modelo de datos: `prisma/schema.prisma` remueve relacion y modelo `PassiveSinglePageResult`.
7. Hallazgo de pruebas: `tests/integration/stage3-safeguards.integration.test.ts` elimina caso de concurrencia de ejecuciones (`queued/running`).

## B-015 - Ciclo tecnico Stage2/Stage3 (inicio)

1. Estado: IN PROGRESS.
2. Objetivo de esta fase: determinar si Bloque D es limpieza valida o regresion funcional encubierta.
3. Pasos siguientes definidos:
- Revisar referencias cruzadas de DTOs eliminados en capas API/contratos.
- Ejecutar suite ampliada Stage 3 + Stage 5 sobre cambios de Bloque D.
- Documentar decision final: integrar parcial, integrar total o mantener diferido con split de cambios.

## B-015 - Resultado del ciclo tecnico (cierre)

1. Validacion ampliada ejecutada en verde:
- npm run typecheck.
- npm run test:integration -- --run tests/integration/stage3-safeguards.integration.test.ts.
- npm run lab:e5-4:gate.
- npm run lab:e6:gate.
2. Resultado funcional: no se observaron regresiones en Stage 3, Stage 5 ni Stage 6 con el estado actual del Bloque D.
3. Decision tecnica: APTO para integracion en commit tecnico dedicado (sin mezclar con paquetes documentales/kanban).

## B-016 - Consolidacion commit tecnico Bloque D (avance)

1. Estado: DONE.
2. Archivos staged para commit tecnico aislado:
- apps/api/src/stage2/prisma-persistence.ts
- packages/contracts/src/stage2-dto.ts
- prisma/schema.prisma
- tests/integration/stage3-safeguards.integration.test.ts
3. Commit ejecutado: `6004033` - `chore(stage2-3): consolidate deferred technical block D`.
4. Criterio de cierre cumplido: bloque integrado en commit tecnico dedicado con trazabilidad explicita.
