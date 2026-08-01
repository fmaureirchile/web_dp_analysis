# ADR-001 - Arquitectura tecnologica base

- Estado: Aprobado
- Fecha: 2026-07-26

## Contexto

Se requiere una base de desarrollo modular para una plataforma de analisis web con evidencia trazable y evolucion por etapas.

## Decision

1. Monorepo con pnpm workspaces.
2. TypeScript estricto para apps y paquetes compartidos.
3. Estructura inicial:
   - apps: web, api, worker-crawler, worker-browser.
   - packages: domain, contracts, evidence, classification, security, shared.
4. Pruebas con Vitest (unit e integration).
5. Linting con ESLint.

## Consecuencias

- Facilita reutilizacion de contratos y dominio.
- Reduce duplicacion de modelos y utilidades.
- Permite separar workers fisicamente en etapas posteriores sin romper lenguaje de dominio.
