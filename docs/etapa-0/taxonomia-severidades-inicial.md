# Taxonomia inicial y severidades tecnicas (Etapa 0)

## Version de taxonomia y clasificacion

- Version: 0.1.0
- Fecha: 2026-07-26
- Compatibilidad: Etapa 0
- Regla de cambios:
	- Cambio mayor: rompe categorias o semantica existente.
	- Cambio menor: agrega categorias compatibles.
	- Parche: corrige definiciones sin alterar estructura.

## Taxonomia inicial de categorias de datos

| Categoria | Ejemplos | Sensibilidad | Evidencia minima sugerida |
| --- | --- | --- | --- |
| Identificacion basica | nombre, apellido, RUT, documento, username | Alta | E2 con campo y contexto + clasificacion con confianza |
| Contacto | email, telefono, direccion | Alta | E2 de captura/transmision |
| Demograficos | fecha nacimiento, edad, genero declarado | Media/Alta | E2 de captura + contexto de finalidad |
| Ubicacion | geolocalizacion, ciudad inferida por GPS/IP | Alta | E2 de permiso/captura/transmision |
| Financieros | cuenta, medio de pago tokenizado, renta | Alta | E2/E3 reforzada |
| Salud | antecedentes medicos, condicion de salud | Muy alta | E2 con minimizacion estricta + revision reforzada |
| Biometrico | huella, rostro, voz | Muy alta | E2 con control reforzado |
| Credenciales y secretos | password, token, authorization, cookie de sesion | Critica | E2 enmascarada, nunca valor completo |
| Identificadores tecnicos | IP, device_id, ad_id, fingerprint | Alta | E2 antes/despues por escenario |
| Conductual/perfilamiento | eventos, tracking, score, segmentos | Alta | E2 de scripts, endpoints y payloads |

## Escala de confianza de clasificacion

| Nivel | Rango sugerido | Significado |
| --- | --- | --- |
| Alta | >= 0.85 | Coincidencia fuerte por nombre, contexto y patron de valor |
| Media | 0.60 - 0.84 | Coincidencia probable, requiere verificacion puntual |
| Baja | < 0.60 | Señal insuficiente, requiere revision manual |

## Severidades tecnicas de observacion/discrepancia

| Severidad | Criterio tecnico | Ejemplo |
| --- | --- | --- |
| Critica | Exposicion potencial de secreto o dato sensible en claro, o accion fuera de autorizacion | Token completo visible en log o reporte |
| Alta | Captura/transmision relevante sin mecanismo observable esperado o con rechazo inefectivo | Tracking antes de eleccion o tras rechazo |
| Media | Inconsistencia parcial de informacion, control incompleto, o evidencia insuficiente | Politica no accesible en una ruta secundaria |
| Baja | Hallazgo de higiene o mejora de trazabilidad sin impacto directo alto | Etiqueta ambigua de campo |
| Informativa | Observacion contextual sin discrepancia evidente | Tecnologia de terceros detectada pero no ejecutada |

## Regla de no conclusion juridica automatica

La severidad expresa prioridad tecnica de revision; no determina por si sola licitud o ilicitud legal.
