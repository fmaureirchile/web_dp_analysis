# Control de merge E5.4 - 2026-09-06

## Objetivo
Ejecutar control minimo de 3 items previo a merge, manteniendo alcance estricto Stage 5.

## Resultado por item
1. Item 1 - `npm run docs:stage5:coherence`: PASS.
2. Item 2 - `npm run lab:e5-4:gate`: PASS.
3. Item 3 - URL y resumen de workflow `validate` en GitHub Actions: FAIL.

## Evidencia local
1. Commit en remoto: `915d1f1` en `origin/main`.
2. Gate E5.4 en verde con cadena interna completa:
- OpenAPI lint: OK.
- Typecheck: OK.
- Stage 5 baseline E5.2: 9/9 archivos y 20/20 tests.
- Regresion observabilidad E5.3: 1/1 archivo y 3/3 tests.
- Coherencia documental Stage 5: OK.

## Evidencia remota (GitHub Actions)
1. Workflow: CI.
2. Run: #102.
3. URL: https://github.com/fmaureirchile/web_dp_analysis/actions/runs/34041096462
4. Estado: completed.
5. Conclusion: failure.
6. Job fallido: validate.
7. Paso fallido dentro de validate: Lint.

## Evolucion posterior de CI
1. Run #103: https://github.com/fmaureirchile/web_dp_analysis/actions/runs/34043139267
2. Resultado #103: FAIL en Typecheck.
3. Remediacion aplicada: ajuste minimo de tipado en `tests/integration/stage6-dynamic-observation.integration.test.ts`.
4. Run #104: https://github.com/fmaureirchile/web_dp_analysis/actions/runs/34043312770
5. Resultado #104: FAIL en Integration tests (404 en endpoints Stage 10/11).
6. Remediacion aplicada: restauracion minima de rutas Stage 9/10/11 en `apps/api/src/stage2/routes.ts`.
7. Validacion local posterior:
- lint: OK.
- typecheck: OK.
- integration subset Stage 9-11: OK (14 tests).
8. Run #105: https://github.com/fmaureirchile/web_dp_analysis/actions/runs/34048063036
9. Estado #105 al momento de este control: in_progress.
10. Commit de remediacion adicional: `3f55faf` (restauracion minima de contratos de rutas Stage 9-T03, 13-T03, 14 y 15 en `apps/api/src/stage2/routes.ts`).
11. Validacion local previa al push del commit `3f55faf`:
- integration completa: 47/47 archivos, 112/112 tests (ejecucion con `--pool=forks`).
- typecheck: OK.
- lint: OK.
12. Run #107: https://github.com/fmaureirchile/web_dp_analysis/actions/runs/34049053005
13. Resultado #107: FAIL en Integration tests.
14. Causa reproducida localmente con el mismo comando de CI: `Error: Worker exited unexpectedly` (tinypool/Vitest) con tests funcionalmente en verde.
15. Remediacion aplicada para estabilizar CI: ajuste de `test:integration` en `package.json` para usar `--pool=forks`.
16. Validacion local de la remediacion: `npm run test:integration -- --run --reporter=basic` en verde (47/47 archivos, 112/112 tests).

## Remediacion aplicada
1. Se corrigio lint en `apps/worker-crawler/src/passive-http-client.ts` (tipado de headers sin dependencia de global `Headers`).
2. Se corrigio lint en `test-lab/sites/lab-server.ts` (eliminacion de escapes innecesarios en expresiones regulares).
3. Revalidacion local posterior a la correccion:
- `npm run lint`: OK.
- `npm run lab:e5-4:gate`: OK.
- `npm run docs:stage5:coherence`: OK.

## Alcance y control de desvio
1. Este control no incluye ni modifica cierres de Stage 2/3/6.
2. Los cambios fuera de Stage 5 permanecen fuera de este cierre.

## Cierre operativo
Estado del control de merge: APTO CONDICIONADO (remediaciones aplicadas; espera validacion remota final).
Condicion para cierre completo: nuevo run de CI posterior a la remediacion de pool en estado Success y publicacion de resumen final de validate.
