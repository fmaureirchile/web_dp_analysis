# Acta de inicio - Etapa 5

Fecha: 2026-07-31
Precondicion: Etapa 4 cerrada con estado APTO.

## Estado de habilitacion

1. Etapa 5 habilitada.
2. Inicio autorizado en incremento 5.1 exclusivamente.

## Objetivo de Etapa 5

Descubrir superficie publica de forma pasiva, sin enviar formularios ni ejecutar acciones transaccionales.

## Alcance inmediato aprobado (E5.1)

1. Ingresar URL de inicio autorizada.
2. Obtener HTML de una sola pagina.
3. Guardar estado HTTP y metadatos minimos.
4. Detectar titulo.
5. Guardar evidencia HTML.
6. Exponer resultado por API.

## Restricciones obligatorias de E5.1

1. Solo HTTP GET.
2. Solo una pagina.
3. Sin seguir enlaces.
4. Sin enviar formularios.
5. Sin ejecutar JavaScript de navegador.
6. Sin salir del alcance autorizado de Etapa 3.

## Dependencias tecnicas

1. Reutilizar gate de autorizacion y alcance de Etapa 3.
2. Reutilizar laboratorio sintetico de Etapa 4 para pruebas.
3. Mantener trazabilidad por execution_id y correlation_id.

## Criterio de salida de E5.1

1. Ejecucion pasa por estados VALIDATED, QUEUED, RUNNING y COMPLETED.
2. Se persiste HTML sintetico como evidencia de tipo correspondiente.
3. Se detecta titulo de Sitio A en laboratorio.
4. No se siguen enlaces ni se envian formularios.
5. Pruebas unitarias e integracion en verde para el corte vertical.
