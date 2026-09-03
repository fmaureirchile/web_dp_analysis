# Etapa 16 - Monitoreo continuo y comparacion de versiones

## Documentos de trabajo

1. acta-inicio-etapa-16.md
2. backlog-etapa-16.md

## Comando de validacion consolidado

```bash
npm run lab:e16:gate
```

## Comandos historicos por corte

```bash
corepack pnpm run lab:e16-1:gate
corepack pnpm run lab:e16-2:gate
corepack pnpm run lab:e16-3:gate
```

## Cuando usarlo

1. Despues de modificar logica de comparacion baseline/actual.
2. Despues de modificar deteccion de nuevos endpoints observados entre versiones.
3. Despues de ajustar la clasificacion de causa probable documental/tecnica.
4. En CI para validar cobertura Stage 16 (3 suites / 5 tests esperados).
5. Para validar que la alerta reporta cambios como observaciones que requieren validacion.
