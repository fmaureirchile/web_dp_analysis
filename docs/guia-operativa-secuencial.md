# Guia operativa secuencial para desarrollo por etapas

Esta guia explica como usar los prompts secuenciales para construir el analizador web de manera controlada.

## Objetivo de la guia

- Mantener alcance estricto por etapa.
- Reducir retrabajo por cambios cruzados.
- Mantener trazabilidad y calidad de evidencia.

## Flujo de trabajo por iteracion

1. Cargar Prompt Maestro Permanente.
2. Cargar solo un prompt de etapa o de tarea.
3. Adjuntar contratos vigentes y observaciones previas.
4. Ejecutar implementacion.
5. Ejecutar pruebas de la etapa y anteriores.
6. Ejecutar revision de coherencia.
7. Registrar resultados y riesgos residuales.

## Comandos recomendados para cada iteracion

Los siguientes comandos son una recomendacion para estandarizar ejecucion en este repo cuando exista codigo:

1. Instalacion:
- Comando: pnpm install
- Cuando usar: primera vez o cambio de dependencias.
- Salida esperada: lockfile y modulos instalados.

2. Verificacion de tipos:
- Comando: pnpm typecheck
- Cuando usar: antes de tests para detectar errores tempranos.
- Salida esperada: reporte de errores de tipado por archivo.

3. Lint:
- Comando: pnpm lint
- Cuando usar: en cada PR o cierre de tarea.
- Salida esperada: advertencias y errores de estilo o calidad.

4. Tests unitarios:
- Comando: pnpm test
- Cuando usar: por cada tarea implementada.
- Salida esperada: casos aprobados, fallidos, cobertura.

5. Tests de integracion:
- Comando: pnpm test:integration
- Cuando usar: cambios en contratos, persistencia o workers.
- Salida esperada: validacion de flujos entre modulos.

6. Build:
- Comando: pnpm build
- Cuando usar: antes de release interno.
- Salida esperada: artefactos compilados.

Nota: estos comandos son guia operacional y se habilitaran efectivamente al construir la Etapa 1 del repositorio.

## Archivos de salida esperados por etapa

- Documentos de etapa: definiciones, contratos, decisiones.
- Evidencias tecnicas: screenshots, DOM, red, cookies, storage.
- Resultados de prueba: logs y reporte de ejecucion.
- Reporte de coherencia: hallazgos de arquitectura o alcance.

## Reglas de bloqueo (no continuar)

No avanzar a la siguiente etapa si:
1. Existen ambiguedades de alcance.
2. Falla una prueba critica de etapa actual.
3. Se detecta contradiccion en contratos.
4. No hay trazabilidad suficiente en evidencia.
5. Se introducen capacidades de etapas futuras.

## Primera secuencia recomendada

1. Prompt Maestro.
2. Etapa 0.
3. Revision de coherencia hasta Etapa 0.
4. Etapa 1.
5. Revision de coherencia hasta Etapa 1.
