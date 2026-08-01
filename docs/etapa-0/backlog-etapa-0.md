# Backlog ejecutable - Etapa 0

Este backlog sigue el criterio de tareas entre medio dia y dos dias.

## E0-T01 - Vision y limites del producto

- Objetivo unico: definir proposito, problema, no-objetivos y resultado esperado.
- Dependencias: ninguna.
- Entradas: requerimientos base y roadmap.
- Salidas: vision aprobable para equipo tecnico y legal.
- Pruebas: revision cruzada de consistencia terminologica.
- Criterio de aceptacion: existe una declaracion explicita de lo que la plataforma no hara.

## E0-T02 - Alcance y exclusiones operativas

- Objetivo unico: delimitar tipos de evaluacion permitidos y fuera de alcance.
- Dependencias: E0-T01.
- Entradas: vision y marco legal.
- Salidas: tabla de alcance con exclusiones y justificacion.
- Pruebas: checklist de no ambiguedad por modalidad.
- Criterio de aceptacion: no hay conflicto entre alcance y restricciones de seguridad.

## E0-T03 - Glosario y modelo conceptual inicial

- Objetivo unico: unificar lenguaje del dominio para evitar entidades duplicadas en etapas futuras.
- Dependencias: E0-T01 y E0-T02.
- Entradas: vision y alcance.
- Salidas: glosario con definiciones operativas y ejemplo.
- Pruebas: deteccion de sinonimos conflictivos.
- Criterio de aceptacion: cada termino critico tiene una unica definicion.

## E0-T04 - Mapa de actores y responsabilidades

- Objetivo unico: identificar actores y permisos base (analista, admin, auditor, cliente).
- Dependencias: E0-T02.
- Entradas: alcance y restricciones.
- Salidas: mapa de actores, responsabilidades y limites.
- Pruebas: matriz RACI simplificada.
- Criterio de aceptacion: cada accion critica tiene responsable definido.

## E0-T05 - Modalidades de evaluacion y salvaguardas

- Objetivo unico: documentar modos de ejecucion (pasivo, activo no destructivo, autenticado autorizado).
- Dependencias: E0-T02 y E0-T04.
- Entradas: alcance y actores.
- Salidas: matriz modalidad x permisos x controles.
- Pruebas: validacion de controles minimos obligatorios.
- Criterio de aceptacion: ninguna modalidad queda sin limite tecnico.

## E0-T06 - Niveles de evidencia y trazabilidad minima

- Objetivo unico: definir E1, E2, E3 y su relacion con observaciones.
- Dependencias: E0-T03.
- Entradas: glosario.
- Salidas: especificacion de evidencia y metadatos minimos.
- Pruebas: ejemplos de mapeo observacion -> evidencia.
- Criterio de aceptacion: toda observacion puede apuntar a evidencia concreta.

## E0-T07 - Taxonomia inicial y severidades

- Objetivo unico: definir categorias iniciales de datos y severidad de discrepancias tecnicas.
- Dependencias: E0-T03 y E0-T06.
- Entradas: glosario y evidencia.
- Salidas: tabla de categorias, confianza y severidades.
- Pruebas: casos ejemplo con clasificacion esperada.
- Criterio de aceptacion: no se mezcla clasificacion tecnica con conclusion legal.

## E0-T08 - Registro de riesgos inicial

- Objetivo unico: levantar riesgos tecnicos, de seguridad, privacidad y operacion.
- Dependencias: E0-T02, E0-T05 y E0-T06.
- Entradas: alcance, salvaguardas y evidencia.
- Salidas: riesgo, impacto, probabilidad, mitigacion y responsable.
- Pruebas: cobertura minima de riesgos criticos.
- Criterio de aceptacion: existe plan de mitigacion para riesgos altos.

## E0-T09 - Revision de coherencia de cierre de Etapa 0

- Objetivo unico: validar coherencia entre todos los documentos de etapa.
- Dependencias: E0-T01 a E0-T08.
- Entradas: todos los entregables de etapa.
- Salidas: informe de consistencia y lista de ajustes.
- Pruebas: checklist de contradicciones y vacios.
- Criterio de aceptacion: aprobacion para iniciar Etapa 1.
