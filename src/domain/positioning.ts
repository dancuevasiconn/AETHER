import type { NamedEntity } from "./common.js";
import type { LayerId } from "./identifiers.js";

export type ArchitectureLevel = "BUSINESS" | "APPLICATION" | "TECHNOLOGY";

export interface Layer extends NamedEntity<"Layer"> {
  readonly code?: string;
  readonly order?: number;
  readonly parentLayerId?: LayerId;
}
