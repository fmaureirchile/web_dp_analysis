# Fixtures - Etapa 4

Cada sitio usa una estructura de fixture homogénea:

1. scenarioId
2. stage
3. site
4. request
5. expected
6. manifestRef

Objetivo: describir entrada sintética y verificación esperada sin depender de sitios externos.

## Extension Stage 5 (E5.5-T03)

Se agrega la carpeta `stage5-fetch-failure-matrix` para escenarios E2E de fallos controlados de fetch:

1. `timeout.fixture.json`
2. `non-html.fixture.json`
3. `size-limit.fixture.json`

Uso operativo:

1. Estos fixtures son consumidos por la suite de integracion `tests/integration/stage5-e2e-lab-failure-matrix.integration.test.ts`.
2. Permiten mantener una matriz de casos versionada y auditable para cambios de crawler pasivo.
