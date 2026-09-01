import {
  type ClassifyDataPointDto,
  type DataClassificationLabel,
  type DataClassificationResultDto
} from "../../contracts/src";
import { requiresMaskingByLabel } from "../../security/src";

type ClassificationRule = {
  label: DataClassificationLabel;
  confidence: number;
  reason: string;
  pattern: RegExp;
};

const RULES: ClassificationRule[] = [
  {
    label: "HEALTH_DATA",
    confidence: 0.95,
    reason: "keyword_health_or_medical",
    pattern: /(health|salud|medical|medic|diagnos|patient|enfermedad)/i
  },
  {
    label: "AUTH_SECRET",
    confidence: 0.95,
    reason: "keyword_auth_secret",
    pattern: /(password|passwd|token|secret|session|authorization|api[_-]?key|bearer)/i
  },
  {
    label: "GOV_IDENTIFIER",
    confidence: 0.9,
    reason: "keyword_government_identifier",
    pattern: /(dni|cedula|passport|ssn|tax[_-]?id|documento)/i
  },
  {
    label: "FINANCIAL_DATA",
    confidence: 0.9,
    reason: "keyword_financial",
    pattern: /(card|credit|debit|iban|swift|account|cvv)/i
  },
  {
    label: "CONTACT_DATA",
    confidence: 0.8,
    reason: "keyword_contact",
    pattern: /(email|phone|telefono|mobile|address|direccion|contact|nombre|name)/i
  },
  {
    label: "BEHAVIORAL_DATA",
    confidence: 0.7,
    reason: "keyword_behavioral",
    pattern: /(consent|tracking|analytics|event|campaign|utm)/i
  }
];

function normalizeText(input: ClassifyDataPointDto): string {
  const key = input.key.trim();
  const value = (input.valueSample ?? "").trim();
  return `${input.source} ${key} ${value}`.toLowerCase();
}

export function classifyDataPoint(input: ClassifyDataPointDto): DataClassificationResultDto {
  const normalized = normalizeText(input);

  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        source: input.source,
        key: input.key,
        label: rule.label,
        confidence: rule.confidence,
        reason: rule.reason,
        requiresMasking: requiresMaskingByLabel(rule.label)
      };
    }
  }

  return {
    source: input.source,
    key: input.key,
    label: "UNCLASSIFIED",
    confidence: 0.4,
    reason: "no_rule_match",
    requiresMasking: requiresMaskingByLabel("UNCLASSIFIED")
  };
}
