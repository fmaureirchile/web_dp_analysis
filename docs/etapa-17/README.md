# Etapa 17 - Hardening y productizacion

## Documentos de trabajo

1. acta-inicio-etapa-17.md
2. backlog-etapa-17.md
3. runbook-operativo-piloto.md
4. acta-cierre-etapa-17.md
5. checklist-piloto-e2e-autorizado.md
6. bitacora-simulacro-piloto-e2e-2026-09-03.md
7. plan-primera-corrida-piloto-e2e.md
8. bitacora-corrida-piloto-e2e-2026-09-03.md
9. evidencias/piloto-e2e-controlado-2026-09-03.json
10. plantilla-bitacora-corrida-piloto-e2e.md
11. cadencia-operativa-corridas-piloto.md
12. programacion-corrida-piloto.md

## Comando de validacion consolidado E17-T04

```bash
npm run lab:e17:gate
```

## Comando historico por corte

```bash
npm run lab:e17-1:gate
npm run lab:e17-2:gate
npm run lab:e17-3:gate
npm run docs:stage17:runbook
npm run docs:stage17:evidence
npm run docs:stage17:evidence:json
```

## Cuando usarlo

1. Despues de modificar el endpoint de purga de datos por ejecucion.
2. Despues de modificar la retencion por ventana temporal y estados de ejecucion.
3. Despues de modificar el runbook operativo inicial de piloto.
4. En CI para validar hardening inicial Stage 17 con una unica invocacion.
5. Para verificar que resultados purgados dejan trazas de error esperadas al consultar evidencia eliminada.
