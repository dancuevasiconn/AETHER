import type { NonEmptyReadonlyArray } from "./common.js";
import type { DecisionReferenceId, EntityId, EntityKind } from "./identifiers.js";

export type AffectedObjectReference = {
  readonly [Kind in EntityKind]: {
    readonly entityType: Kind;
    readonly entityId: EntityId<Kind>;
  };
}[EntityKind];

export interface DecisionReference {
  readonly id: DecisionReferenceId;
  readonly title: string;
  readonly status: string;
  readonly reference: string;
  readonly affectedObjects: NonEmptyReadonlyArray<AffectedObjectReference>;
  readonly description?: string;
}
