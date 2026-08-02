# Backlog - Etapa 5.4 (coherencia operativa y cierre confiable)

## Objetivo del subcorte

Cerrar brechas de coherencia entre CI, scripts y documentacion de Stage 5, y formalizar un gate minimo de continuidad para evitar regresiones administrativas y tecnicas.

## Criterio de salida E5.4

E5.4 se considera apta cuando:

1. Las metricas oficiales de Stage 5.2 y E5.3 estan alineadas entre CI, scripts y documentos de etapa.
2. Existe validacion reproducible de coherencia documental minima para cierre Stage 5.
3. Existe evidencia de tendencia basica de tiempos de gate E5.3 y criterio de accion ante degradacion.
4. Existe gate minimo E5.4 reproducible en local y CI.

## Inicio operativo recomendado E5.4

1. Confirmar baseline E5.3 en verde con npm run lab:e5-3:gate.
2. Ejecutar tareas en orden E5-4-T01 -> E5-4-T02 -> E5-4-T03 -> E5-4-T04.
3. Exigir evidencia por tarea desde el primer commit.

## Gate minimo inicial propuesto para E5.4

Objetivo: mantener estabilidad funcional y forzar coherencia operativa durante el subcorte.

Comando recomendado provisional:

npm run lab:e5-3:gate

Cuando usarlo:

1. Antes de mergear PRs de E5.4.
2. Antes de cambios en CI, scripts de gate o documentos de cierre Stage 5.
3. Como validacion obligatoria para cerrar cada tarea E5-4-T01..T04.

## E5-4-T01 - Alineacion de metricas oficiales Stage 5

- Objetivo unico: unificar metricas esperadas (archivos/tests) entre CI y documentacion de Etapa 5.
- Dependencias: cierre E5.3.
- Archivos objetivo: .github/workflows/ci.yml, docs/etapa-5/*.md.
- Criterio de aceptacion: no existen contradicciones entre resultados esperados reportados en CI y documentos de cierre.
- Pruebas desde inicio:
  - Verificacion de baseline con npm run lab:e5-3:gate.
  - Revision cruzada de resultados en CI y documentos oficiales.

## E5-4-T02 - Validacion minima de coherencia documental

- Objetivo unico: definir una comprobacion estandar para detectar desalineaciones de metricas y mensajes de cierre.
- Dependencias: E5-4-T01.
- Archivos objetivo: tools/, docs/etapa-5/, package.json.
- Criterio de aceptacion: existe comando ejecutable que falla si detecta incoherencia critica de cierre Stage 5.
- Pruebas desde inicio:
  - Ejecutar comando de validacion en local.
  - Ejecutar comando en CI dentro del job validate.

## E5-4-T03 - Evidencia de tendencia de tiempos del gate E5.3

- Objetivo unico: registrar de forma minima la duracion del gate E5.3 para detectar degradaciones tempranas.
- Dependencias: E5-4-T02.
- Archivos objetivo: .github/workflows/ci.yml, docs/etapa-5/.
- Criterio de aceptacion: existe registro visible y criterio de accion documentado ante degradacion, incluyendo umbral operativo de advertencia de 480 segundos.
- Pruebas desde inicio:
  - Verificar presencia de tiempo total del gate en salida CI.
  - Verificar guia de interpretacion y umbral operativo.
  - Verificar emision de warning en CI cuando duration_seconds > 480.

## E5-4-T04 - Gate de cierre E5.4 y paquete documental

- Objetivo unico: formalizar cierre E5.4 con gate, checklist y evidencia de continuidad.
- Dependencias: E5-4-T02 y E5-4-T03.
- Archivos objetivo: package.json, .github/workflows/ci.yml, docs/etapa-5/.
- Criterio de aceptacion: gate E5.4 reproducible local/CI y documentos de cierre completos.
- Pruebas desde inicio:
  - Ejecucion de gate completo en local.
  - Paso dedicado en CI para reporte final E5.4.

Estado de implementacion:

- Comando unico definido: npm run lab:e5-4:gate.
- CI actualizado con pasos dedicados: coverage, ejecucion y resumen validado de E5.4.
- Guia operativa final disponible en docs/etapa-5/guia-gate-cierre-e5-4.md.

## Entregables esperados de cierre E5.4

1. Acta de cierre E5.4.
2. Revision de coherencia E5.4.
3. Nota de release corta E5.4.
4. Checklist final de entrega PR E5.4.
