import type { NamedEntity } from "./common.js";
import type {
  BusinessCapabilityId,
  BusinessRuleId,
  DataObjectId,
  DecisionReferenceId,
  ElementId,
  FlowId,
  ProcessId,
  ResponsibilityId,
  RoleId,
} from "./identifiers.js";

export type ProcessFlowRelationKind = "initiates" | "uses";

export interface ProcessFlowReference {
  readonly flowId: FlowId;
  readonly kind: ProcessFlowRelationKind;
}

export interface Process extends NamedEntity<"Process"> {
  readonly businessCapabilityIds?: readonly BusinessCapabilityId[];
  readonly dataObjectIds?: readonly DataObjectId[];
  readonly flowReferences?: readonly ProcessFlowReference[];
  readonly roleIds?: readonly RoleId[];
  readonly elementIds?: readonly ElementId[];
  readonly responsibilityIds?: readonly ResponsibilityId[];
  readonly businessRuleIds?: readonly BusinessRuleId[];
  readonly decisionReferenceIds?: readonly DecisionReferenceId[];
}

export interface DataObject extends NamedEntity<"DataObject"> {
  readonly domain?: string;
  readonly ownership?: string;
  readonly schemaReference?: string;
  readonly classification?: string;
  readonly processIds?: readonly ProcessId[];
  readonly flowIds?: readonly FlowId[];
  readonly elementIds?: readonly ElementId[];
  readonly businessRuleIds?: readonly BusinessRuleId[];
}
