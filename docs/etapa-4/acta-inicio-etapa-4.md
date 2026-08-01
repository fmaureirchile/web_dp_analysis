# Acta de inicio - Etapa 4

Fecha: 2026-07-31
Precondicion: Etapa 3 cerrada en estado APTO.

## Objetivo de Etapa 4

Construir un laboratorio sintetico local y reproducible para validar capacidades del sistema sin depender de sitios externos.

## Alcance del inicio aprobado

1. Definir estructura base de sitios sinteticos A-F en test-lab/sites.
2. Definir fixtures y resultados dorados por sitio en test-lab/fixtures y test-lab/golden-results.
3. Definir pruebas de salud automatizadas para cada sitio.
4. Definir integracion de laboratorio en CI para ejecucion consistente.

## Primer bloque de implementacion propuesto (E4-B1)

En este bloque se implementara la base operativa minima del laboratorio:

1. E4-T01: scaffold de 6 sitios sinteticos con endpoint de salud.
2. E4-T02: convencion de fixtures y golden manifests por sitio.
3. E4-T03: pruebas de health de laboratorio ejecutables por npm run test:integration.
4. E4-T04: documentacion de comportamiento esperado inicial por sitio.

## Restricciones de etapa

1. No usar servicios externos reales para tracking o terceros.
2. No usar datos reales de personas.
3. Mantener datos sinteticos inequívocos.
4. No iniciar crawler real ni browser automation aun (corresponde a Etapa 5+).

## Criterio de salida preliminar de E4-B1

1. Los seis sitios levantan localmente con mecanismo documentado.
2. Cada sitio responde health check.
3. Existe un manifiesto de expected behavior por sitio.
4. El pipeline ejecuta salud del laboratorio sin errores.

## Actualizacion de avance

Fecha: 2026-07-31

1. E4-T01 implementada: scaffold inicial de 6 sitios en test-lab/sites.
2. Se incorpora servidor de laboratorio unico con endpoints /health, /sites y /sitio-x/health.
3. Validacion manual ejecutada en local: salud general y salud por sitio en estado ok para A-F.
4. E4-T02 implementada para Sitio A: formulario completo con endpoint local /sitio-a/submit.
5. Se crea manifiesto esperado inicial de Sitio A en test-lab/golden-results/sitio-a-formulario-simple/expected-manifest.json.
6. Primera prueba automatizada de laboratorio en verde: tests/integration/lab-health.integration.test.ts.
7. E4-T03 implementada para Sitio B: flujo de consentimiento correcto con endpoints /sitio-b/consent/status y /sitio-b/consent/action.
8. Se crea manifiesto esperado inicial de Sitio B en test-lab/golden-results/sitio-b-cookies-correctas/expected-manifest.json.
9. Pruebas asociadas en verde: tests/integration/lab-site-b-consent.integration.test.ts.
10. E4-T04 implementada para Sitio C: event log y endpoints /sitio-c/tracking/boot, /sitio-c/tracking/events, /sitio-c/tracking/ping y /sitio-c/consent/reject.
11. Se crea manifiesto esperado inicial de Sitio C en test-lab/golden-results/sitio-c-tracking-defectuoso/expected-manifest.json.
12. Pruebas negativas controladas en verde: tests/integration/lab-site-c-tracking.integration.test.ts.
13. E4-T05 implementada para Sitio D: estado SPA con endpoints /sitio-d/spa/state, /sitio-d/spa/bootstrap, /sitio-d/spa/navigate y API local /sitio-d/api/profile.
14. Se crea manifiesto esperado inicial de Sitio D en test-lab/golden-results/sitio-d-spa-dinamica/expected-manifest.json.
15. Pruebas comparativas de render dinamico vs storage en verde: tests/integration/lab-site-d-spa.integration.test.ts.
16. E4-T06 implementada para Sitio E: endpoint multipart sintetico /sitio-e/upload y consulta de envios /sitio-e/submissions.
17. Se crea manifiesto esperado inicial de Sitio E en test-lab/golden-results/sitio-e-datos-sensibles/expected-manifest.json.
18. Pruebas de campos y flujo esperado en verde: tests/integration/lab-site-e-sensitive.integration.test.ts.
19. E4-T07 implementada para Sitio F: login sintetico por rol con endpoints /sitio-f/auth/login, /sitio-f/auth/logout, /sitio-f/session/status y /sitio-f/profile.
20. Se crea manifiesto esperado inicial de Sitio F en test-lab/golden-results/sitio-f-extranet/expected-manifest.json.
21. Pruebas de flujos diferenciados cliente/supervisor en verde: tests/integration/lab-site-f-extranet.integration.test.ts.
22. E4-T08 implementada: manifests A-F normalizados a estructura común (meta, routes, expectedSignals, assertions, negativeExpectations).
23. Se crea esquema común en test-lab/golden-results/manifest.schema.json y fixtures homogéneos en test-lab/fixtures/sitio-*/fixture.json.
24. Se incorpora validación automatizada de esquema/consistencia con npm run lab:manifests:validate (resultado OK).
25. E4-T09 implementada: prueba de health ampliada a cobertura completa A-F validando catálogo de sitios y rutas /sitio-x/health.
26. Se agrega suite dedicada de laboratorio con vitest.lab.config.ts y comando npm run lab:test.
27. Criterio de salida E4-B1 automatizado con npm run lab:e4b1:gate (manifests + tests de laboratorio) en estado OK.
28. E4-T10 implementada: workflow CI incorpora paso "Laboratory gate E4-B1" ejecutando npm run lab:e4b1:gate en job validate.
