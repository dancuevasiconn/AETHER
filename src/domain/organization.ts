import type { NamedEntity } from "./common.js";
import type {
  BusinessCapabilityId,
  BusinessRuleId,
  DataObjectId,
  DecisionReferenceId,
  ElementId,
  FlowId,
  FlowSegmentId,
  PositionId,
  ProcessId,
  ResponsibilityId,
  RoleId,
  RuleImplementationId,
} from "./identifiers.js";

export interface Role extends NamedEntity<"Role"> {
  readonly positionIds?: readonly PositionId[];
  readonly processIds?: readonly ProcessId[];
  readonly flowIds?: readonly FlowId[];
  readonly flowSegmentIds?: readonly FlowSegmentId[];
  readonly responsibilityIds?: readonly ResponsibilityId[];
  readonly ownedBusinessRuleIds?: readonly BusinessRuleId[];
  readonly ruleImplementationIds?: readonly RuleImplementationId[];
  readonly dataObjectIds?: readonly DataObjectId[];
  readonly decisionReferenceIds?: readonly DecisionReferenceId[];
}

export interface Position extends NamedEntity<"Position"> {
  readonly roleIds?: readonly RoleId[];
}

export interface Responsibility extends NamedEntity<"Responsibility"> {
  readonly businessCapabilityIds?: readonly BusinessCapabilityId[];
  readonly processIds?: readonly ProcessId[];
  readonly roleIds?: readonly RoleId[];
  readonly elementIds?: readonly ElementId[];
  readonly businessRuleIds?: readonly BusinessRuleId[];
}
