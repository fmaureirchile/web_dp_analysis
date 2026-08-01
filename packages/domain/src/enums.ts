export enum ExecutionState {
  DRAFT = "DRAFT",
  VALIDATED = "VALIDATED",
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  COMPLETED = "COMPLETED",
  COMPLETED_WITH_WARNINGS = "COMPLETED_WITH_WARNINGS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}

export enum ReviewState {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
  RECLASSIFIED = "RECLASSIFIED"
}

export enum EvidenceLevel {
  E1 = "E1",
  E2 = "E2",
  E3 = "E3"
}

export enum DataStorageMode {
  OMITTED = "OMITTED",
  MASKED = "MASKED"
}
