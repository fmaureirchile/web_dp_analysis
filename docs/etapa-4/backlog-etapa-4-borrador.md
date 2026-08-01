# Backlog - Etapa 4 (laboratorio sintetico y pruebas doradas)

## E4-T01 - Estructura base del laboratorio

- Objetivo unico: crear estructura inicial de sitios sinteticos A-F en test-lab/sites.
- Dependencias: cierre APTO de Etapa 3.
- Archivos afectados: test-lab/sites, apps/web (si se usa host unificado), package.json (scripts de arranque).
- Criterio de aceptacion: existen seis sitios con descripcion minima y ruta de salud.

## E4-T02 - Sitio A formulario simple

- Objetivo unico: implementar sitio A con nombre, correo, telefono, casilla de privacidad y campo oculto.
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-a-formulario-simple/*.
- Criterio de aceptacion: formulario renderiza consistentemente y expone endpoint local sintetico.

## E4-T03 - Sitio B cookies correctas

- Objetivo unico: implementar sitio B con consentimiento correcto (aceptar/rechazar/configurar/revocar).
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-b-cookies-correctas/*.
- Criterio de aceptacion: analitica desactivada por defecto y comportamiento diferenciado por opcion.

## E4-T04 - Sitio C tracking defectuoso

- Objetivo unico: implementar sitio C que ejecute tracking antes de interaccion y persista tracking tras rechazo.
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-c-tracking-defectuoso/*.
- Criterio de aceptacion: comportamiento defectuoso reproducible en pruebas.

## E4-T05 - Sitio D SPA dinamica

- Objetivo unico: implementar sitio D dinamico (render en cliente, formulario dinamico, API JSON local, localStorage).
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-d-spa-dinamica/*.
- Criterio de aceptacion: diferencias observables entre HTML inicial y estado renderizado.

## E4-T06 - Sitio E datos sensibles

- Objetivo unico: implementar sitio E con campo salud, carga de archivo y texto informativo especifico.
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-e-datos-sensibles/*.
- Criterio de aceptacion: formulario multipart sintetico y mensajes claros del escenario.

## E4-T07 - Sitio F extranet con roles

- Objetivo unico: implementar sitio F con login sintetico y dos roles con flujos diferenciados.
- Dependencias: E4-T01.
- Archivos afectados: test-lab/sites/sitio-f-extranet/*.
- Criterio de aceptacion: flujos cliente/supervisor diferenciables y documentados.

## E4-T08 - Fixtures y golden manifests

- Objetivo unico: definir fixtures y resultados dorados por cada sitio.
- Dependencias: E4-T02 a E4-T07.
- Archivos afectados: test-lab/fixtures/*, test-lab/golden-results/*.
- Criterio de aceptacion: cada sitio tiene expected forms, cookies, requests y consent states esperados.

## E4-T09 - Pruebas de salud del laboratorio

- Objetivo unico: crear pruebas de health para los seis sitios.
- Dependencias: E4-T01 a E4-T07.
- Archivos afectados: tests/integration/*lab*.test.ts.
- Criterio de aceptacion: suite valida disponibilidad de sitios y rutas de salud.

## E4-T10 - Integracion CI del laboratorio

- Objetivo unico: ejecutar salud de laboratorio en pipeline.
- Dependencias: E4-T09.
- Archivos afectados: .github/workflows/ci.yml, package.json.
- Criterio de aceptacion: CI en verde con etapa de laboratorio incluida.

## E4-T11 - Revision de coherencia Etapa 4

- Objetivo unico: verificar consistencia entre sitios, fixtures, resultados dorados y pruebas.
- Dependencias: E4-T01 a E4-T10.
- Archivos afectados: docs/etapa-4/*.
- Criterio de aceptacion: sin hallazgos criticos para habilitar Etapa 5.1.
