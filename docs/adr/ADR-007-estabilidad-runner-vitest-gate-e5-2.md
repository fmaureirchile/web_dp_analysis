# ADR-007 - Estabilidad de runner Vitest para gate E5.2

## Estado

Aprobado

## Fecha

2026-07-31

## Contexto

Durante la ejecucion del gate E5.2 se observo inestabilidad intermitente en el runner de tests de integracion con error de worker inesperado (tinypool). El gate consolidado E5.2 ejecuta 9 archivos y 23 tests, lo que aumenta sensibilidad del pool por defecto en este entorno.

## Decision

1. Forzar el pool de ejecucion de Vitest a forks para el comando baseline/gate E5.2.
2. Mantener el control estricto de cobertura esperada en CI (9/9 archivos y 26/26 tests).

Implementacion de la decision:

- package.json: lab:e5-2:baseline usa argumento --pool=forks.
- .github/workflows/ci.yml: mantiene steps dedicados de coverage, ejecucion y summary validado de E5.2.

## Consecuencias

Positivas:

1. Reduce riesgo de fallos intermitentes por workers en ejecucion integrada de Stage 5.
2. Mejora reproducibilidad local y en CI del gate unico E5.2.

Negativas:

1. Puede incrementar tiempo total de ejecucion respecto al pool por defecto.
2. Introduce una configuracion especifica de runner a revisar en futuros upgrades de Vitest.

## Criterio de rollback

Revertir a configuracion sin --pool=forks solo si se cumplen todas las condiciones:

1. Tres corridas consecutivas del gate E5.2 en CI sin errores de worker.
2. Tres corridas consecutivas del gate E5.2 en local sin errores de worker.
3. No se detectan regresiones de tiempos fuera de umbral operativo acordado.

## Seguimiento

1. Revisar esta decision en el siguiente subcorte de Etapa 5 al evaluar upgrades de Vitest.
2. Registrar en notas de release cualquier cambio del pool de ejecucion del gate.

## Actualizacion operativa (2026-08-01)

1. Se endurece configuracion base de integracion en vitest.integration.config.ts con pool=forks y limites min/max de forks (1..4).
2. Se mantiene ejecucion de gates E5.2/E5.3 en verde tras el ajuste.
3. Se conserva criterio de rollback vigente de esta ADR para futuros cambios de runner.
