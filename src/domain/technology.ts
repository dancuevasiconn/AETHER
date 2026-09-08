import type { NamedEntity } from "./common.js";
import type {
  DataObjectId,
  DecisionReferenceId,
  ElementId,
  FlowSegmentId,
  LayerId,
  ProcessId,
  RelationshipId,
  ResponsibilityId,
  RuleImplementationId,
} from "./identifiers.js";
import type { ArchitectureLevel } from "./positioning.js";

/** Extensible classification; its definitive taxonomy remains open. */
export type ElementType = string;

export interface Element extends NamedEntity<"Element"> {
  readonly elementType: ElementType;
  readonly layerId?: LayerId;
  readonly architectureLevel?: ArchitectureLevel;
  readonly responsibilityIds?: readonly ResponsibilityId[];
  readonly processIds?: readonly ProcessId[];
  readonly flowSegmentIds?: readonly FlowSegmentId[];
  readonly dataObjectIds?: readonly DataObjectId[];
  readonly ruleImplementationIds?: readonly RuleImplementationId[];
  readonly decisionReferenceIds?: readonly DecisionReferenceId[];
}

/** Extensible classification; ADR examples do not constitute a closed taxonomy. */
export type RelationshipType = string;

export interface Relationship {
  readonly id: RelationshipId;
  readonly relationshipType: RelationshipType;
  readonly sourceElementId: ElementId;
  readonly targetElementId: ElementId;
  readonly name?: string;
  readonly description?: string;
}
