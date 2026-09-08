import type { NamedEntity, NonEmptyReadonlyArray } from "./common.js";
import type {
  BusinessRuleId,
  DataObjectId,
  DecisionReferenceId,
  ElementId,
  FlowId,
  FlowSegmentId,
  LayerId,
  ProcessId,
  ResponsibilityId,
  RoleId,
  RuleImplementationId,
} from "./identifiers.js";
import type { ArchitectureLevel } from "./positioning.js";

export interface BusinessRule extends NamedEntity<"BusinessRule"> {
  readonly logicalLayerId: LayerId;
  readonly processIds?: readonly ProcessId[];
  readonly dataObjectIds?: readonly DataObjectId[];
  readonly flowIds?: readonly FlowId[];
  readonly flowSegmentIds?: readonly FlowSegmentId[];
  readonly responsibilityIds?: readonly ResponsibilityId[];
  readonly ownerRoleIds?: readonly RoleId[];
  readonly ruleImplementationIds?: readonly RuleImplementationId[];
  readonly decisionReferenceIds?: readonly DecisionReferenceId[];
}

export type KnownRuleImplementationType =
  | "GOVERNED"
  | "HARDCODED"
  | "CONFIGURATION"
  | "MANUAL"
  | "DATA_LOGIC"
  | "INTEGRATION_LOGIC"
  | "WORKFLOW"
  | "UNKNOWN";

/** Known initial values remain extensible until the taxonomy is formally governed. */
export type RuleImplementationType = KnownRuleImplementationType | (string & {});

interface RuleImplementationCore {
  readonly id: RuleImplementationId;
  readonly businessRuleId: BusinessRuleId;
  readonly implementationType: RuleImplementationType;
  readonly name?: string;
  readonly description?: string;
  readonly status?: string;
  readonly mechanism?: string;
  readonly actualLayerId?: LayerId;
  readonly architectureLevel?: ArchitectureLevel;
}

type ElementExecution = {
  readonly executingElementIds: NonEmptyReadonlyArray<ElementId>;
  readonly executingRoleIds?: readonly RoleId[];
};

type RoleExecution = {
  readonly executingElementIds?: readonly ElementId[];
  readonly executingRoleIds: NonEmptyReadonlyArray<RoleId>;
};

/** Requires at least one executing Element or Role without adding runtime validation. */
export type RuleImplementation = RuleImplementationCore & (ElementExecution | RoleExecution);
