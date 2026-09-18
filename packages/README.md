# Packages

Este directorio concentra modulos reutilizables para mantener separadas las reglas de negocio, los contratos y las politicas transversales.

## Cuando trabajar en `packages`

- Cuando una regla o tipo se usa en API, workers y/o tests, debe vivir en `packages`.
- Cuando una pieza solo aplica a una app puntual, mantenla en `apps/*` y evita subirla a `packages` de forma temprana.
- Antes de cerrar cambios en `packages`, corre validaciones de tipo y pruebas para evitar regresiones en etapas previas.

## Mapa de paquetes

### `domain`

Ubicacion: `packages/domain/src`

Proposito:
- Modelos de dominio (`entities.ts`, `enums.ts`).
- Escenarios de consentimiento y adaptadores de laboratorio (`consent-scenarios.ts`, `consent-lab-adapter.ts`).

Usalo cuando:
- Necesites expresar estados/transiciones de negocio sin depender de HTTP, DB o framework.
- Quieras compartir semantica de dominio entre API, workers e integraciones.

### `contracts`

Ubicacion: `packages/contracts/src`

Proposito:
- DTOs y tipos de intercambio entre capas/etapas (`stage2-dto.ts`, `stage5-dto.ts`, `stage6-dto.ts`, `stage7-dto.ts`, `stage8-dto.ts`).

Usalo cuando:
- Debas alinear payloads entre endpoints, workers y pruebas de integracion.
- Necesites tipar requests/responses sin arrastrar logica de dominio.

### `classification`

Ubicacion: `packages/classification/src`

Proposito:
- Motor de clasificacion y taxonomia base (`engine.ts`).

Usalo cuando:
- Requieras categorizar datos detectados con reglas reutilizables.
- Vayas a extender etiquetas o heuristicas de clasificacion.

### `security`

Ubicacion: `packages/security/src`

Proposito:
- Politicas de enmascaramiento y controles de exposicion (`masking-policy.ts`).

Usalo cuando:
- Debas controlar que evidencias/salidas no expongan datos sensibles.
- Necesites reglas de seguridad aplicables en API y vistas.

### `evidence`

Estado actual:
- Reservado para consolidar estructuras y utilidades de evidencia en etapas posteriores.

Usalo cuando:
- Se incorporen tipos/helpers de evidencia reutilizables por varias apps.

### `shared`

Estado actual:
- Reservado para utilidades transversales de bajo acoplamiento.

Usalo cuando:
- Exista una utilidad comun que no pertenezca claramente a `domain`, `contracts`, `classification` o `security`.

## Comandos de validacion recomendados

Ejecutar desde la raiz del repo.

| Comando | Para que sirve | Parametros practicos | Salida esperada |
| --- | --- | --- | --- |
| `npm run typecheck` | Verifica tipos TypeScript en todo el workspace, incluyendo `packages`. | Sin parametros. | Sin errores de compilacion por tipos. |
| `npm run lint` | Revisa estilo/calidad estatica (ESLint). | Sin parametros. | Lista de advertencias/errores de lint (idealmente vacia). |
| `npm run test` | Ejecuta la suite base de pruebas unitarias. | Sin parametros. | Reporte de pruebas pasadas/fallidas. |
| `npm run lab:e5-2:gate` | Corre compuerta de regresion de Etapa 5 con reintento controlado para workers. | Sin parametros directos; internamente corre baseline + retry. | Resultado de gate aprobado/fallido y trazas de pruebas. |

## Criterios practicos para agregar codigo nuevo

- Agrega exports en `index.ts` del paquete correspondiente para evitar imports profundos inestables.
- Mantiene la direccion de dependencias: `contracts` y `domain` no deben depender de apps.
- Si introduces un tipo nuevo de intercambio, agrega o actualiza su DTO en `contracts` y ajusta pruebas relacionadas.
