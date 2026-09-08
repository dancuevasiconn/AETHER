import type { EntityId, EntityKind } from "./identifiers.js";

export type NonEmptyReadonlyArray<Value> = readonly [Value, ...Value[]];

export interface NamedEntity<Kind extends EntityKind> {
  readonly id: EntityId<Kind>;
  readonly name: string;
  readonly description?: string;
}
