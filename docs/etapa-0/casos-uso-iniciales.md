# Casos de uso iniciales (Etapa 0)

## CU-01 Registrar autorizacion de evaluacion

- Actor principal: Administrador de organizacion.
- Flujo principal:
1. Define dominio, subdominios y ambientes autorizados.
2. Define fechas de vigencia y ventanas de ejecucion.
3. Define acciones permitidas/prohibidas y limites tecnicos.
4. Adjunta evidencia documental de autorizacion.
- Resultado esperado: autorizacion validada para ejecucion.

## CU-02 Ejecutar exploracion externa pasiva

- Actor principal: Analista tecnico.
- Flujo principal:
1. Selecciona proyecto y perfil de escaneo pasivo.
2. Ejecuta descubrimiento de superficie en alcance aprobado.
3. Registra paginas, formularios y recursos detectados.
- Resultado esperado: inventario inicial y evidencia E2 asociada.

## CU-03 Ejecutar exploracion activa no destructiva

- Actor principal: Analista tecnico.
- Flujo principal:
1. Carga perfil con datos sinteticos.
2. Ejecuta escenarios permitidos sin operaciones destructivas.
3. Captura trafico, cookies, storage y terceros.
- Resultado esperado: observaciones tecnicas comparables por escenario.

## CU-04 Revisar observaciones y decidir hallazgos

- Actor principal: Revisor legal/compliance.
- Flujo principal:
1. Filtra observaciones por severidad y confianza.
2. Revisa evidencia tecnica y documental vinculada.
3. Confirma, rechaza o reclasifica.
- Resultado esperado: hallazgos controlados por revision humana.

## CU-05 Generar reporte tecnico trazable

- Actor principal: Analista tecnico/Revisor legal.
- Flujo principal:
1. Selecciona ejecucion y decisiones revisadas.
2. Genera reporte con lenguaje prudente.
3. Exporta artefactos autorizados.
- Resultado esperado: reporte reproducible sin conclusiones juridicas automaticas.

## Criterios transversales

1. Cada observacion debe vincularse a evidencia.
2. No se reporta como hallazgo sin revision humana.
3. No se puede ejecutar fuera del alcance autorizado.
