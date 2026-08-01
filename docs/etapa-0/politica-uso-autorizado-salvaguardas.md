# Politica de uso autorizado y salvaguardas (Etapa 0)

## Condicion previa obligatoria

No se inicia ninguna evaluacion sin autorizacion verificable del responsable y sin alcance aprobado.

## Requisitos minimos de autorizacion

1. Identificacion del solicitante y responsable.
2. Dominios/subdominios y ambientes permitidos.
3. Fecha de inicio/termino y ventanas horarias.
4. Tipos de evaluacion habilitados.
5. Operaciones HTTP permitidas.
6. Uso de credenciales (si aplica) mediante referencia segura.
7. Contacto tecnico de emergencia y mecanismo de detencion.

## Salvaguardas tecnicas obligatorias

1. Lista blanca de dominios.
2. Lista de rutas prohibidas.
3. Limite de profundidad de navegacion.
4. Limite de requests por segundo.
5. Limite de concurrencia.
6. Tiempo maximo por ejecucion.
7. Boton de detencion inmediata.
8. Registro de acciones con correlation_id.

## Salvaguardas de privacidad y seguridad

1. Minimizar recoleccion de datos y evidencias.
2. Enmascarar datos sensibles en logs y reportes.
3. Segregar evidencia por organizacion.
4. Control de acceso por roles (RBAC).
5. No exponer rutas internas de almacenamiento.
6. Uso de URLs firmadas y de corta duracion para descarga de evidencia.

## Acciones estrictamente prohibidas

1. Ejecutar fuera del alcance autorizado.
2. Realizar pagos, compras o eliminaciones de datos reales.
3. Guardar credenciales en texto plano.
4. Reutilizar sesiones entre roles sin autorizacion.
5. Compartir evidencia entre tenants.

## Manejo de incidentes operativos

1. Detener ejecucion inmediatamente.
2. Notificar contacto tecnico y responsable de seguridad.
3. Preservar trazabilidad de evento.
4. Aplicar analisis de causa raiz y plan de mitigacion.
