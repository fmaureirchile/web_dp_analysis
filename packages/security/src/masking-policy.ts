import { type DataClassificationLabel } from "../../contracts/src";

export const MASKING_POLICY_BY_LABEL: Record<DataClassificationLabel, boolean> = {
  HEALTH_DATA: true,
  AUTH_SECRET: true,
  GOV_IDENTIFIER: true,
  CONTACT_DATA: true,
  FINANCIAL_DATA: true,
  BEHAVIORAL_DATA: false,
  TECHNICAL_DATA: false,
  UNCLASSIFIED: false
};

export function requiresMaskingByLabel(label: DataClassificationLabel): boolean {
  return MASKING_POLICY_BY_LABEL[label];
}
