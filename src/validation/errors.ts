import type { EntityKind } from "../domain/index.js";

export type ValidationErrorCode =
  | "INVALID_ARCHITECTURE_ROOT"
  | "INVALID_REQUIRED_FIELD"
  | "INVALID_FIELD_TYPE"
  | "INVALID_ID"
  | "DUPLICATE_ID"
  | "INVALID_COLLECTION"
  | "INVALID_REFERENCE"
  | "INVALID_REFERENCE_TYPE"
  | "INVALID_ARCHITECTURE_LEVEL"
  | "INVALID_APS_LAYER"
  | "DUPLICATE_APS_LAYER"
  | "APS_LAYER_NOT_ROOT"
  | "INVALID_LAYER_HIERARCHY"
  | "RELATIONSHIP_SELF_REFERENCE"
  | "INVALID_FLOW_SEQUENCE"
  | "FLOW_CONTINUITY_ERROR"
  | "FLOW_DATAOBJECT_MISMATCH"
  | "INVALID_BUSINESSRULE_LOGICAL_LAYER"
  | "RULEIMPLEMENTATION_WITHOUT_EXECUTOR"
  | "INVALID_DECISION_REFERENCE";

export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly entityType?: EntityKind | undefined;
  readonly entityId?: string | undefined;
  readonly field?: string | undefined;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
}
