import type {
  AnyEntityId,
  Architecture,
  BusinessCapability,
  BusinessRule,
  DataObject,
  DecisionReference,
  Element,
  Flow,
  FlowFamily,
  FlowSegment,
  Layer,
  Position,
  Process,
  Relationship,
  Responsibility,
  Role,
  RuleImplementation,
} from "../domain/index.js";

/** IDs have no runtime brand. Tuple cardinalities and closed classifications stay intact. */
export type Physical<T> = T extends AnyEntityId
  ? string
  : T extends readonly [unknown, ...unknown[]]
    ? { readonly [K in keyof T]: Physical<T[K]> }
    : T extends readonly (infer Item)[]
      ? readonly Physical<Item>[]
      : T extends object
        ? { readonly [K in keyof T]: Physical<T[K]> }
        : T;

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | JsonObject;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface PhysicalArchitecture extends Physical<
  Pick<Architecture, "id" | "name" | "modelVersion" | "description">
> {
  readonly metadata: JsonObject;
  readonly businessCapabilities?: readonly Physical<
    Pick<
      BusinessCapability,
      "id" | "name" | "description" | "processIds" | "flowFamilyIds" | "roleIds"
    >
  >[];
  readonly elements?: readonly Physical<
    Pick<Element, "id" | "name" | "elementType" | "description" | "layerId" | "architectureLevel">
  >[];
  readonly relationships?: readonly Physical<Relationship>[];
  readonly layers?: readonly Physical<Layer>[];
  readonly processes?: readonly Physical<
    Pick<
      Process,
      "id" | "name" | "description" | "dataObjectIds" | "flowReferences" | "roleIds" | "elementIds"
    >
  >[];
  readonly dataObjects?: readonly Physical<
    Pick<
      DataObject,
      | "id"
      | "name"
      | "description"
      | "domain"
      | "ownership"
      | "schemaReference"
      | "classification"
      | "elementIds"
    >
  >[];
  readonly flows?: readonly Physical<Omit<Flow, "processIds">>[];
  readonly flowSegments?: readonly Physical<FlowSegment>[];
  readonly flowFamilies?: readonly Physical<Pick<FlowFamily, "id" | "name" | "description">>[];
  readonly roles?: readonly Physical<
    Pick<
      Role,
      "id" | "name" | "description" | "positionIds" | "flowIds" | "flowSegmentIds" | "dataObjectIds"
    >
  >[];
  readonly positions?: readonly Physical<Pick<Position, "id" | "name" | "description">>[];
  readonly responsibilities?: readonly Physical<Omit<Responsibility, "businessRuleIds">>[];
  readonly businessRules?: readonly Physical<
    Omit<BusinessRule, "ruleImplementationIds" | "decisionReferenceIds">
  >[];
  readonly ruleImplementations?: readonly Physical<RuleImplementation>[];
  readonly decisionReferences?: readonly Physical<DecisionReference>[];
}

export interface PhysicalDocument {
  readonly schemaVersion: "0.1";
  readonly architecture: PhysicalArchitecture;
}

declare const validatedPhysicalBrand: unique symbol;
/** Only the physical validation layer may introduce this proof marker. */
export type ValidatedPhysicalDocument = PhysicalDocument & {
  readonly [validatedPhysicalBrand]: true;
};
