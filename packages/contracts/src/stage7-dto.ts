export type ClassificationSource = "FORM_FIELD" | "COOKIE" | "LOCAL_STORAGE" | "NETWORK_PARAM" | "NETWORK_HEADER";

export type DataClassificationLabel =
  | "HEALTH_DATA"
  | "AUTH_SECRET"
  | "GOV_IDENTIFIER"
  | "CONTACT_DATA"
  | "FINANCIAL_DATA"
  | "BEHAVIORAL_DATA"
  | "TECHNICAL_DATA"
  | "UNCLASSIFIED";

export interface ClassifyDataPointDto {
  source: ClassificationSource;
  key: string;
  valueSample?: string;
}

export interface DataClassificationResultDto {
  source: ClassificationSource;
  key: string;
  label: DataClassificationLabel;
  confidence: number;
  reason: string;
  requiresMasking: boolean;
}
