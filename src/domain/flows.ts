import type { NamedEntity, NonEmptyReadonlyArray } from "./common.js";
import type {
  BusinessCapabilityId,
  DataObjectId,
  ElementId,
  FlowFamilyId,
  FlowId,
  FlowSegmentId,
  ProcessId,
  RelationshipId,
} from "./identifiers.js";

export interface Flow extends NamedEntity<"Flow"> {
  readonly description: string;
  readonly flowFamilyId: FlowFamilyId;
  readonly processIds?: readonly ProcessId[];
  readonly dataObjectIds: NonEmptyReadonlyArray<DataObjectId>;
  readonly startElementId: ElementId;
  readonly endElementId: ElementId;
  readonly flowSegmentIds: NonEmptyReadonlyArray<FlowSegmentId>;
}

export interface FlowSegment {
  readonly id: FlowSegmentId;
  readonly flowId: FlowId;
  readonly sequence: number;
  readonly sourceElementId: ElementId;
  readonly targetElementId: ElementId;
  readonly dataObjectIds: NonEmptyReadonlyArray<DataObjectId>;
  readonly relationshipId?: RelationshipId;
  readonly name?: string;
  readonly description?: string;
}

export interface FlowFamily extends NamedEntity<"FlowFamily"> {
  readonly businessCapabilityIds?: readonly BusinessCapabilityId[];
  readonly flowIds?: readonly FlowId[];
}
