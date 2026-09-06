# Backlog - Etapa 5.5 (continuidad operativa y cobertura reforzada)

## Objetivo del subcorte

Disminuir riesgo operacional residual de Stage 5 fortaleciendo control de tendencia temporal de gates, ampliando cobertura E2E de fallos de fetch y reforzando coherencia documental.

## Criterio de salida E5.5

E5.5 se considera apta cuando:

1. Existe historico minimo utilizable para comparar tiempos del gate E5.3 por corrida.
2. Existe regla documentada y aplicada para recalibrar el umbral operativo de 480 segundos.
3. La matriz E2E cubre timeout, non-html y size-limit sin romper gates previos.
4. El control documental detecta y bloquea incoherencias criticas de metricas Stage 5.

## Inicio operativo recomendado E5.5

1. Confirmar baseline E5.4 en verde con npm run lab:e5-4:gate.
2. Ejecutar tareas en orden E5-5-T01 -> E5-5-T02 -> E5-5-T03 -> E5-5-T04.
3. Exigir evidencia por tarea desde el primer commit.

## Gate minimo inicial propuesto para E5.5

Objetivo: mantener continuidad funcional de Stage 5 y forzar coherencia operativa mientras se ejecuta deuda residual.

Comando recomendado provisional:

npm run lab:e5-4:gate

Cuando usarlo:

1. Antes de mergear PRs de E5.5.
2. Antes de cambios en CI, scripts de gate o documentos de cierre Stage 5.
3. Como validacion obligatoria para cerrar cada tarea E5-5-T01..T04.

## E5-5-T01 - Historico minimo de tiempos del gate E5.3

- Objetivo unico: conservar y reportar evidencia temporal comparativa por corrida.
- Dependencias: cierre E5.4.
- Archivos objetivo: .github/workflows/ci.yml, tools/, docs/etapa-5/.
- Criterio de aceptacion: existe salida CI con valor actual y referencia previa legible para seguimiento.
- Pruebas desde inicio:
  - Validar presencia de campos de tiempo actual y previo en salida CI.
  - Verificar no regresion del gate funcional de Stage 5.

## E5-5-T02 - Recalibracion operativa del umbral

- Objetivo unico: formalizar regla de recalibracion del threshold de advertencia.
- Dependencias: E5-5-T01.
- Archivos objetivo: docs/etapa-5/, .github/workflows/ci.yml.
- Criterio de aceptacion: existe criterio documentado, reproducible y verificable en CI.
- Pruebas desde inicio:
  - Simular corrida sobre umbral para validar warning controlado.
  - Verificar coherencia entre guia, checklist y resumen CI.

## E5-5-T03 - Matriz E2E ampliada para fallos de fetch

- Objetivo unico: ampliar cobertura de laboratorio sin degradar estabilidad.
- Dependencias: E5-5-T01.
- Archivos objetivo: tests/integration/, test-lab/fixtures/.
- Criterio de aceptacion: escenarios timeout/non-html/size-limit cubiertos con resultados deterministas.
- Pruebas desde inicio:
  - Ejecutar suite Stage 5 E2E de laboratorio.
  - Verificar gates previos en verde tras agregar casos.

## E5-5-T04 - Refuerzo de coherencia documental Stage 5

- Objetivo unico: ampliar controles para bloquear desalineaciones de metricas y mensajes de cierre.
- Dependencias: E5-5-T02.
- Archivos objetivo: tools/validate-stage5-doc-coherence.ts, docs/etapa-5/, package.json.
- Criterio de aceptacion: el validador falla con incoherencias relevantes adicionales y pasa en estado alineado.
- Pruebas desde inicio:
  - Ejecutar npm run docs:stage5:coherence en local.
  - Verificar ejecucion del control en CI dentro del job validate.

## Entregables esperados de cierre E5.5

1. Acta de cierre E5.5.
2. Revision de coherencia E5.5.
3. Nota de release corta E5.5.
4. Checklist final de entrega PR E5.5.