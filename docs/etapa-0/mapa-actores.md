# Mapa de actores (Etapa 0)

## Actores principales

| Actor | Objetivo | Permisos base | Restricciones |
| --- | --- | --- | --- |
| Administrador de organizacion | Configurar organizaciones, proyectos y autorizaciones | Crear y cerrar proyectos, aprobar alcance, gestionar usuarios y roles | No altera evidencia tecnica sin trazabilidad de auditoria |
| Analista tecnico | Ejecutar evaluaciones y revisar observaciones | Lanzar escaneos autorizados, etiquetar observaciones, proponer hallazgos | No puede ampliar alcance sin aprobacion |
| Revisor legal/compliance | Evaluar implicancias regulatorias | Revisar observaciones, confirmar/rechazar/reclasificar hallazgos, agregar comentario legal | No modifica evidencia fuente |
| Auditor interno/externo autorizado | Verificar trazabilidad y consistencia | Consultar ejecuciones, evidencia y reportes con acceso de solo lectura | No ejecuta escaneos ni cambia decisiones |
| Operador de seguridad | Monitorear controles y riesgos de plataforma | Revisar logs, alertas, secretos, politicas de retencion y accesos | No accede a evidencia fuera de su tenant |
| Contacto tecnico del cliente | Coordinar ventanas y contingencias | Aprobar ventanas, activar detencion de emergencia, validar exclusiones | No accede a otros clientes ni secretos internos |

## Responsabilidades criticas

1. Aprobacion de autorizacion y alcance: Administrador de organizacion + Contacto tecnico del cliente.
2. Ejecucion tecnica de evaluacion: Analista tecnico.
3. Confirmacion de hallazgos para reporte: Revisor legal/compliance.
4. Monitoreo de seguridad y privacidad: Operador de seguridad.
5. Auditoria independiente de trazabilidad: Auditor autorizado.

## Principio de separacion de funciones

- Quien ejecuta no confirma legalmente.
- Quien confirma legalmente no altera evidencia tecnica.
- Toda accion humana o automatica deja rastro de auditoria con fecha, actor y correlation_id.
