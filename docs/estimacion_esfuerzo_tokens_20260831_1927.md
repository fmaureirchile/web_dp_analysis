# Estimacion de esfuerzo humano y consumo de tokens para proyecto completo

Fecha de registro: 2026-08-31 19:27
Base de estado actual: docs/avance_20260831_1923.md
Roadmap de referencia: Antecedentes/roadmap_extraido.txt

## 1) Supuestos de estimacion

1. Alcance: completar Etapas 6 a 17 del roadmap.
2. Metodo: estimacion por etapa pendiente con rango minimo-maximo para reflejar incertidumbre tecnica.
3. Equipo humano de referencia (asistencia):
- 1 ingeniero full-time
- 0,5 QA automation
- 0,25 analista privacidad/compliance
- 0,25 DevOps/SRE
4. Flujo de trabajo: desarrollo asistido por IA con revisiones humanas obligatorias en contratos, seguridad, consentimiento y evidencia.
5. Tokens considerados: suma aproximada de interacciones IA (prompt + respuesta + iteraciones de correccion y validacion), no costo de CI.

## 2) Estimacion base por etapa pendiente

| Etapa | Semanas estimadas | Horas humanas estimadas | Tokens estimados |
|---|---:|---:|---:|
| 6. Navegador automatizado y observacion dinamica | 4 a 5 | 260 | 1,5M a 2,0M |
| 7. Clasificacion inicial de datos | 3 a 4 | 180 | 1,0M a 1,4M |
| 8. Escenarios de consentimiento | 4 a 5 | 280 | 1,6M a 2,2M |
| 9. Repositorio de evidencias y revision | 3 a 4 | 220 | 1,2M a 1,7M |
| 10. Reportes e inventarios | 3 a 4 | 180 | 1,0M a 1,4M |
| 11. Evaluacion autenticada | 4 a 6 | 320 | 1,8M a 2,6M |
| 12. Analisis de codigo frontend | 4 a 5 | 260 | 1,4M a 2,0M |
| 13. Analisis backend, APIs, BD y logs | 5 a 7 | 380 | 2,2M a 3,1M |
| 14. Correlacion y linaje integral | 4 a 6 | 340 | 1,9M a 2,7M |
| 15. Motor legal-tecnico y discrepancias | 4 a 5 | 260 | 1,5M a 2,1M |
| 16. Monitoreo continuo y comparacion | 3 a 4 | 220 | 1,2M a 1,7M |
| 17. Hardening y productizacion | 5 a 7 | 420 | 2,4M a 3,4M |
| Total restante (6 a 17) | 46 a 62 | 3320 | 17,7M a 24,3M |

## 3) Escenarios de programa (restante)

| Escenario | Duracion calendario | Horas humanas | Tokens aproximados |
|---|---:|---:|---:|
| Optimista | 36 a 44 semanas | 2600 a 3200 | 12M a 17M |
| Base | 46 a 62 semanas | 3320 a 4200 | 17,7M a 24,3M |
| Conservador | 58 a 76 semanas | 4200 a 5600 | 24M a 35M |

## 4) Lectura de avance total del proyecto

1. Avance por conteo de etapas: 6/18 = 33,3%.
2. Avance por esfuerzo total (ponderado): aprox. 20% a 30%, porque las etapas 11 a 17 concentran mayor complejidad tecnica y validacion.
3. Restante de esfuerzo total: aprox. 70% a 80%.

## 5) Factores que pueden mover la estimacion

1. Disponibilidad de entornos de pruebas autenticadas y datos sinteticos realistas.
2. Complejidad de correlacion de linaje extremo a extremo (Etapa 14).
3. Madurez de criterios legales-tecnicos y volumen de reglas de discrepancia (Etapa 15).
4. Nivel de hardening exigido para pilotos reales (Etapa 17).
5. Tasa de retrabajo por cambios de contrato o ajustes de alcance.

## 6) Recomendacion operativa

1. Planificar en dos olas:
- Ola A (Etapas 6 a 10): observacion dinamica + consentimiento + evidencia/reporte.
- Ola B (Etapas 11 a 17): autenticado + analisis de codigo/sistemas + linaje + hardening.
2. Definir baseline de consumo de tokens por sprint para ajustar la prediccion cada 2 semanas.
3. Mantener gates tecnicos y documentales para controlar costo por retrabajo.
