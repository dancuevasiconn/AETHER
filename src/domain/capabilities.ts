import type { NamedEntity } from "./common.js";
import type {
  DecisionReferenceId,
  FlowFamilyId,
  ProcessId,
  ResponsibilityId,
  RoleId,
} from "./identifiers.js";

export interface BusinessCapability extends NamedEntity<"BusinessCapability"> {
  readonly processIds?: readonly ProcessId[];
  readonly flowFamilyIds?: readonly FlowFamilyId[];
  readonly responsibilityIds?: readonly ResponsibilityId[];
  readonly roleIds?: readonly RoleId[];
  readonly decisionReferenceIds?: readonly DecisionReferenceId[];
}
