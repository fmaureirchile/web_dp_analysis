# Estrategia de pruebas inicial (Etapa 1)

## Objetivo

Asegurar que la base tecnica del repositorio se ejecuta de forma consistente antes de desarrollo funcional.

## Capas

1. Unitarias: validan utilidades y contratos locales.
2. Integracion: validan acoplamiento entre modulos.
3. Humo: validan que pipeline local minima este operativo.

## Criterio minimo de merge

1. lint exitoso.
2. typecheck exitoso.
3. test unitario exitoso.
4. test integracion exitoso (si aplica al cambio).
