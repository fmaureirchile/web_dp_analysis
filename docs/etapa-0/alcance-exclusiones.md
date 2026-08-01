# Alcance y exclusiones (Etapa 0)

## Alcance incluido
1. Evaluacion externa pasiva sin autenticacion.
2. Evaluacion externa activa no destructiva con datos sinteticos.
3. Analisis de consentimiento en escenarios controlados.
4. Evaluacion autenticada solo bajo autorizacion explicita.
5. Correlacion de evidencia tecnica y documental para revision humana.

## Alcance excluido
1. Emision automatica de conclusiones juridicas definitivas.
2. Ejecucion de operaciones destructivas (pagos, eliminaciones, cambios de perfil real).
3. Escaneo fuera de dominios y subdominios autorizados.
4. Reutilizacion de credenciales o sesiones fuera del flujo autorizado.
5. Exposicion de secretos, tokens o datos sensibles completos en logs o reportes.

## Acciones permitidas
1. Descubrimiento de superficie web dentro de lista blanca.
2. Inventario de formularios, campos y endpoints observables.
3. Captura de evidencia: screenshot, DOM, cookies, storage y trafico.
4. Clasificacion tecnica de datos con confianza y trazabilidad.
5. Revision humana de observaciones antes de confirmar hallazgos.

## Acciones prohibidas
1. Envio de formularios productivos no autorizados.
2. Crawling ilimitado sin control de profundidad y concurrencia.
3. Ataques activos o pruebas intrusivas fuera de alcance acordado.
4. Acceso cruzado de evidencia entre organizaciones.
5. Persistir credenciales en texto plano.

## Justificacion
El alcance definido permite observar comportamiento tecnico real con riesgo controlado, manteniendo separacion entre observacion tecnica y conclusion juridica. Las exclusiones reducen riesgo operacional, legal y reputacional, y aseguran alineacion con el principio de uso autorizado y minimizacion.
