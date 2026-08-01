# Matriz de modalidades de evaluacion (Etapa 0)

| Modalidad | Requiere autenticacion | Uso de credenciales | Interaccion con formularios | Limites tecnicos minimos | Evidencia minima | Riesgo residual principal |
| --- | --- | --- | --- | --- | --- | --- |
| Externa pasiva | No | No | No envio | Lista blanca, limite de profundidad, rate limit, timeout maximo | E2: inventario de URLs, formularios visibles, scripts y politicas detectadas | Falsos negativos por funcionalidades no visibles sin interaccion |
| Externa activa no destructiva | No | No | Si, solo con datos sinteticos y flujos permitidos | Browser context aislado, concurrencia limitada, stop inmediato, rutas prohibidas | E2: screenshots, DOM, cookies, storage, red antes/despues | Riesgo de interferencia baja si no se respetan limites |
| Analisis de consentimiento por escenarios | No | No | Si, solo controles de consentimiento | Escenarios separados, persistencia controlada, auditoria de acciones | E2: comparativa de trafico/cookies/storage por escenario | Interpretacion incorrecta sin revision humana |
| Evaluacion autenticada autorizada | Si | Si, via referencia segura | Si, bajo flujo definido | Vault de secretos, sesiones por rol, pasos autorizados, STOP_BEFORE_SUBMIT | E2/E3: evidencia de flujos por rol y separacion de sesiones | Exposicion de credenciales o acciones no deseadas |
| Analisis estatico autorizado de codigo | Opcional | No | No aplica | Solo lectura, sin ejecucion de scripts no autorizados | E1: ubicaciones de codigo, reglas, fragmentos minimos | Falsos positivos por inferencia estatica |

## Notas operativas

1. Ninguna modalidad permite conclusiones juridicas automaticas.
2. Toda modalidad exige separacion por organizacion (tenant).
3. Cualquier cambio de modalidad requiere nueva validacion de alcance.
