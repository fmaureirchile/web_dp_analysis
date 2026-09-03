# Etapa 17 - Hardening y productizacion

## Documentos de trabajo

1. acta-inicio-etapa-17.md
2. backlog-etapa-17.md
3. runbook-operativo-piloto.md

## Comando de validacion E17-T03

```bash
npm run lab:e17-3:gate
```

## Comando historico por corte

```bash
npm run lab:e17-1:gate
npm run lab:e17-2:gate
npm run docs:stage17:runbook
```

## Cuando usarlo

1. Despues de modificar el endpoint de purga de datos por ejecucion.
2. Despues de modificar la retencion por ventana temporal y estados de ejecucion.
3. Despues de modificar el runbook operativo inicial de piloto.
4. Antes de avanzar al gate consolidado de Etapa 17 (E17-T04).
5. Para verificar que resultados purgados dejan trazas de error esperadas al consultar evidencia eliminada.
