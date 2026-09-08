declare const entityIdBrand: unique symbol;

export type EntityKind =
  | "Architecture"
  | "BusinessCapability"
  | "Element"
  | "Relationship"
  | "Layer"
  | "Process"
  | "DataObject"
  | "Flow"
  | "FlowSegment"
  | "FlowFamily"
  | "Role"
  | "Position"
  | "Responsibility"
  | "BusinessRule"
  | "RuleImplementation"
  | "DecisionReference";

/** A stable string whose contents are opaque to product logic. */
export type EntityId<Kind extends EntityKind> = string & {
  readonly [entityIdBrand]: Kind;
};

export type ArchitectureId = EntityId<"Architecture">;
export type BusinessCapabilityId = EntityId<"BusinessCapability">;
export type ElementId = EntityId<"Element">;
export type RelationshipId = EntityId<"Relationship">;
export type LayerId = EntityId<"Layer">;
export type ProcessId = EntityId<"Process">;
export type DataObjectId = EntityId<"DataObject">;
export type FlowId = EntityId<"Flow">;
export type FlowSegmentId = EntityId<"FlowSegment">;
export type FlowFamilyId = EntityId<"FlowFamily">;
export type RoleId = EntityId<"Role">;
export type PositionId = EntityId<"Position">;
export type ResponsibilityId = EntityId<"Responsibility">;
export type BusinessRuleId = EntityId<"BusinessRule">;
export type RuleImplementationId = EntityId<"RuleImplementation">;
export type DecisionReferenceId = EntityId<"DecisionReference">;

export type AnyEntityId = EntityId<EntityKind>;
