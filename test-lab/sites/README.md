# Laboratorio sintetico - Scaffold inicial (E4-T01)

Este directorio contiene los 6 sitios sinteticos base de Etapa 4 y un servidor unico para exponerlos localmente.

## Sitios incluidos

1. Sitio A: formulario simple.
2. Sitio B: cookies correctas.
3. Sitio C: tracking defectuoso.
4. Sitio D: SPA dinamica.
5. Sitio E: datos sensibles.
6. Sitio F: extranet.

## Arranque local

Comando:

```powershell
npm run lab:start
```

Puerto por defecto:

- 4310

Variable opcional:

- LAB_PORT para cambiar el puerto.

## Endpoints de salud

- General: /health
- Catalogo sitios: /sites
- Por sitio:
  - /sitio-a/health
  - /sitio-b/health
  - /sitio-c/health
  - /sitio-d/health
  - /sitio-e/health
  - /sitio-f/health
