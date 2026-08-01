# Registro inicial de riesgos (Etapa 0)

| ID | Riesgo | Tipo | Impacto | Probabilidad | Mitigacion | Responsable | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | Escaneo fuera de alcance autorizado | Seguridad/Operacion | Alto | Media | Lista blanca de dominios, rutas prohibidas y boton de detencion inmediata | Lider tecnico | Abierto |
| R-002 | Exposicion de datos sensibles en evidencia o logs | Privacidad/Seguridad | Alto | Media | Enmascaramiento obligatorio, minimizacion y control de acceso por organizacion | Lider de seguridad | Abierto |
| R-003 | Falsos positivos por clasificacion automatica | Tecnico | Medio | Alta | Puntaje de confianza, trazabilidad de evidencia y revision humana previa a hallazgo | Lider de datos | Abierto |
| R-004 | Confundir observacion tecnica con conclusion juridica | Cumplimiento | Alto | Media | Reglas de lenguaje prudente y validacion legal en flujo de revision | Responsable legal | Abierto |
| R-005 | Dependencia excesiva de un solo navegador o motor | Tecnico | Medio | Media | Estrategia multi-motor progresiva y corpus de pruebas sinteticas | Arquitecto de plataforma | Abierto |
