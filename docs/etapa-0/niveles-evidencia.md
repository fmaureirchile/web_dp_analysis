# Niveles de evidencia y trazabilidad minima (Etapa 0)

## Definiciones

| Nivel | Definicion | Fuentes tipicas | Reproducibilidad | Uso permitido |
| --- | --- | --- | --- | --- |
| E1 | Evidencia estatica o documental | Politicas, contratos API, fragmentos de codigo autorizados, configuraciones declaradas | Alta (versionada) | Contexto, trazabilidad, soporte documental |
| E2 | Evidencia dinamica observable en ejecucion | Screenshots, DOM, requests/responses enmascarados, cookies, storage, trazas de navegador | Media/Alta (segun escenario) | Observaciones tecnicas comparables y auditables |
| E3 | Evidencia validada por revision humana | Decision de revisor con comentario y referencias a E1/E2 | Alta (auditable) | Base para hallazgos y reporte controlado |

## Metadatos minimos por evidencia

1. evidence_id unico.
2. execution_id y project_id.
3. timestamp UTC.
4. tipo de evidencia.
5. origen (herramienta/modulo).
6. hash o firma de integridad.
7. ubicacion segura de almacenamiento.
8. politica de retencion aplicable.
9. enmascaramiento aplicado (si/no y tipo).
10. correlation_id.

## Regla de trazabilidad

Toda observacion debe enlazar al menos una evidencia E2 o E1, y todo hallazgo confirmado debe enlazar evidencia E3 con referencias a su soporte tecnico.

## Regla de prudencia

Sin evidencia suficiente, la salida debe clasificarse como "requiere revision" y no como hallazgo confirmado.
