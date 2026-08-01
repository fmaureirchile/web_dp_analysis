# Modelo de estados inicial (Etapa 0)

Este modelo define estados minimos para entidades con ciclo de vida en etapas posteriores.

## Estado de ejecucion (Execution)

DRAFT -> VALIDATED -> QUEUED -> RUNNING -> PAUSED -> COMPLETED
                                            -> COMPLETED_WITH_WARNINGS
                                            -> FAILED
                                            -> CANCELLED

## Estado de observacion (DataObservation)

DETECTED -> CLASSIFIED -> PENDING_REVIEW -> CONFIRMED | REJECTED | RECLASSIFIED

## Estado de hallazgo (Finding)

PROPOSED -> CONFIRMED -> REPORTED -> CLOSED

## Reglas de coherencia

1. Un hallazgo no puede existir sin observacion en estado CONFIRMED o RECLASSIFIED.
2. Una observacion no puede pasar a CONFIRMED sin evidencia vinculada.
3. Toda transicion debe registrar actor, timestamp y correlation_id.
4. Los estados son de dominio comun para evitar estructuras paralelas por modulo.
