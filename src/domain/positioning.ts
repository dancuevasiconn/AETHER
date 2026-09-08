import type { NamedEntity } from "./common.js";
import type { LayerId } from "./identifiers.js";

export type ArchitectureLevel = "BUSINESS" | "APPLICATION" | "TECHNOLOGY";

export const APS_LAYERS = [
  "EXPERIENCE_CUSTOMER_INTERACTION",
  "GOVERNANCE_POLICIES_DECISIONS",
  "INTEGRATION_ORCHESTRATION",
  "CORE",
  "SATELLITES",
  "SECURITY",
  "OBSERVABILITY_CONTROL",
  "DATA_ANALYTICS",
] as const;

export type ApsLayer = (typeof APS_LAYERS)[number];

export interface Layer extends NamedEntity<"Layer"> {
  readonly code?: string;
  readonly order?: number;
  readonly parentLayerId?: LayerId;
  readonly apsLayer?: ApsLayer;
}
