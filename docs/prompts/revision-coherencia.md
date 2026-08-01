# Prompt de revision de coherencia (post-etapa)

Realiza una revision de coherencia arquitectonica del repositorio hasta la Etapa <NUMERO>.
No implementes funcionalidad nueva.

Revisa como minimo:
1. Duplicacion de entidades, tipos y utilidades.
2. Contratos inconsistentes o incompatibles.
3. Estados incompatibles en el dominio.
4. Evidencias sin ejecucion asociada.
5. Observaciones tratadas como hallazgos sin revision humana.
6. Clasificaciones sin version o sin confianza.
7. Datos sensibles sin enmascaramiento.
8. Errores sin correlation_id.
9. Dependencias innecesarias o acoplamiento excesivo.
10. Codigo de etapas futuras incorporado prematuramente.

Entrega:
1. Hallazgos ordenados por severidad.
2. Archivo y linea.
3. Impacto.
4. Recomendacion.
5. Cambios minimos necesarios.
6. Aspectos que no requieren correccion.

Regla:
No proponer refactorizacion masiva sin justificar necesidad.
