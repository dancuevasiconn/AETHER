import { APS_LAYERS, type ArchitectureLevel, type EntityKind } from "../domain/index.js";
import type { ValidationError, ValidationErrorCode, ValidationResult } from "./errors.js";

type UnknownEntity = Record<string, unknown>;

const ARCHITECTURE_LEVELS = new Set<ArchitectureLevel>(["BUSINESS", "APPLICATION", "TECHNOLOGY"]);
const APS_LAYER_VALUES = new Set<string>(APS_LAYERS);
const GOVERNANCE_LAYER = "GOVERNANCE_POLICIES_DECISIONS";

const COLLECTIONS: ReadonlyArray<readonly [string, EntityKind]> = [
  ["businessCapabilities", "BusinessCapability"],
  ["elements", "Element"],
  ["relationships", "Relationship"],
  ["layers", "Layer"],
  ["processes", "Process"],
  ["dataObjects", "DataObject"],
  ["flows", "Flow"],
  ["flowSegments", "FlowSegment"],
  ["flowFamilies", "FlowFamily"],
  ["roles", "Role"],
  ["positions", "Position"],
  ["responsibilities", "Responsibility"],
  ["businessRules", "BusinessRule"],
  ["ruleImplementations", "RuleImplementation"],
  ["decisionReferences", "DecisionReference"],
];

const NAMED_ENTITY_TYPES = new Set<EntityKind>([
  "BusinessCapability",
  "Element",
  "Layer",
  "Process",
  "DataObject",
  "Flow",
  "FlowFamily",
  "Role",
  "Position",
  "Responsibility",
  "BusinessRule",
]);

function isRecord(value: unknown): value is UnknownEntity {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateArchitecture(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const entities = new Map<EntityKind, UnknownEntity[]>();
  const idsByType = new Map<EntityKind, Map<string, UnknownEntity>>();
  const globalIds = new Map<string, EntityKind>();

  const addError = (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ): void => {
    errors.push({ code, message, entityType, entityId, field });
  };

  if (!isRecord(input)) {
    addError(
      "INVALID_ARCHITECTURE_ROOT",
      "A logical load must contain exactly one Architecture root object.",
      "Architecture",
    );
    return { valid: false, errors };
  }

  const rootId = requiredString(input, "id", "Architecture", errors);
  requiredString(input, "name", "Architecture", errors);
  requiredString(input, "modelVersion", "Architecture", errors, rootId);
  if (!isRecord(input.metadata)) {
    addError(
      "INVALID_REQUIRED_FIELD",
      "Architecture.metadata must be a descriptive object.",
      "Architecture",
      rootId,
      "metadata",
    );
  }

  if (rootId !== undefined) {
    globalIds.set(rootId, "Architecture");
    idsByType.set("Architecture", new Map([[rootId, input]]));
  }

  for (const [field, entityType] of COLLECTIONS) {
    const value = input[field];
    if (value === undefined) {
      entities.set(entityType, []);
      idsByType.set(entityType, new Map());
      continue;
    }
    if (!Array.isArray(value)) {
      addError(
        "INVALID_COLLECTION",
        `Architecture.${field} must be an array when present.`,
        "Architecture",
        rootId,
        field,
      );
      entities.set(entityType, []);
      idsByType.set(entityType, new Map());
      continue;
    }

    const validEntities: UnknownEntity[] = [];
    const typeIds = new Map<string, UnknownEntity>();
    idsByType.set(entityType, typeIds);
    value.forEach((candidate, index) => {
      if (!isRecord(candidate)) {
        addError(
          "INVALID_FIELD_TYPE",
          `${field}[${index}] must be an object.`,
          entityType,
          undefined,
          `${field}[${index}]`,
        );
        return;
      }
      validEntities.push(candidate);
      const id = requiredString(candidate, "id", entityType, errors);
      if (id === undefined) return;
      const existingType = globalIds.get(id);
      if (existingType !== undefined) {
        addError(
          "DUPLICATE_ID",
          `ID '${id}' is already used by ${existingType}.`,
          entityType,
          id,
          "id",
        );
        return;
      }
      globalIds.set(id, entityType);
      typeIds.set(id, candidate);
    });
    entities.set(entityType, validEntities);
  }

  const validateReference = (
    value: unknown,
    expectedType: EntityKind,
    ownerType: EntityKind,
    ownerId: string | undefined,
    field: string,
  ): void => {
    if (typeof value !== "string") {
      addError(
        "INVALID_FIELD_TYPE",
        `${field} must contain a string ID.`,
        ownerType,
        ownerId,
        field,
      );
      return;
    }
    if (idsByType.get(expectedType)?.has(value) === true) return;
    const actualType = globalIds.get(value);
    if (actualType !== undefined) {
      addError(
        "INVALID_REFERENCE_TYPE",
        `Reference '${value}' resolves to ${actualType}, expected ${expectedType}.`,
        ownerType,
        ownerId,
        field,
      );
      return;
    }
    addError(
      "INVALID_REFERENCE",
      `Reference '${value}' does not resolve to an existing ${expectedType}.`,
      ownerType,
      ownerId,
      field,
    );
  };

  const referenceArray = (
    entity: UnknownEntity,
    field: string,
    expectedType: EntityKind,
    ownerType: EntityKind,
    minimum = 0,
  ): readonly unknown[] => {
    const ownerId = stringId(entity);
    const value = entity[field];
    if (!Array.isArray(value)) {
      if (minimum > 0 || value !== undefined) {
        addError(
          minimum > 0 ? "INVALID_REQUIRED_FIELD" : "INVALID_FIELD_TYPE",
          `${ownerType}.${field} must be an array${minimum > 0 ? ` with at least ${minimum} item(s)` : ""}.`,
          ownerType,
          ownerId,
          field,
        );
      }
      return [];
    }
    if (value.length < minimum) {
      addError(
        "INVALID_REQUIRED_FIELD",
        `${ownerType}.${field} must contain at least ${minimum} item(s).`,
        ownerType,
        ownerId,
        field,
      );
    }
    value.forEach((reference, index) =>
      validateReference(reference, expectedType, ownerType, ownerId, `${field}[${index}]`),
    );
    return value;
  };

  for (const [entityType, collection] of entities) {
    for (const entity of collection) {
      const id = stringId(entity);
      if (NAMED_ENTITY_TYPES.has(entityType)) {
        requiredString(entity, "name", entityType, errors, id);
      }
      optionalString(entity, "description", entityType, errors, id);
    }
  }

  validateLayers(entities.get("Layer") ?? [], idsByType, errors, addError);

  for (const entity of entities.get("BusinessCapability") ?? []) {
    referenceArray(entity, "processIds", "Process", "BusinessCapability");
    referenceArray(entity, "flowFamilyIds", "FlowFamily", "BusinessCapability");
    referenceArray(entity, "responsibilityIds", "Responsibility", "BusinessCapability");
    referenceArray(entity, "roleIds", "Role", "BusinessCapability");
    referenceArray(entity, "decisionReferenceIds", "DecisionReference", "BusinessCapability");
  }

  for (const entity of entities.get("Element") ?? []) {
    const id = stringId(entity);
    requiredString(entity, "elementType", "Element", errors, id);
    optionalReference(entity, "layerId", "Layer", "Element", validateReference);
    validateArchitectureLevel(entity, "Element", errors);
    referenceArray(entity, "responsibilityIds", "Responsibility", "Element");
    referenceArray(entity, "processIds", "Process", "Element");
    referenceArray(entity, "flowSegmentIds", "FlowSegment", "Element");
    referenceArray(entity, "dataObjectIds", "DataObject", "Element");
    referenceArray(entity, "ruleImplementationIds", "RuleImplementation", "Element");
    referenceArray(entity, "decisionReferenceIds", "DecisionReference", "Element");
  }

  for (const entity of entities.get("Relationship") ?? []) {
    const id = stringId(entity);
    requiredString(entity, "relationshipType", "Relationship", errors, id);
    validateReference(entity.sourceElementId, "Element", "Relationship", id, "sourceElementId");
    validateReference(entity.targetElementId, "Element", "Relationship", id, "targetElementId");
    if (
      typeof entity.sourceElementId === "string" &&
      entity.sourceElementId === entity.targetElementId
    ) {
      addError(
        "RELATIONSHIP_SELF_REFERENCE",
        "Relationship sourceElementId and targetElementId must be different.",
        "Relationship",
        id,
        "targetElementId",
      );
    }
  }

  validateProcesses(entities.get("Process") ?? [], referenceArray, validateReference, errors);
  validateDataObjects(entities.get("DataObject") ?? [], referenceArray);
  validateOrganizations(entities, referenceArray);
  validateBusinessRules(
    entities.get("BusinessRule") ?? [],
    referenceArray,
    validateReference,
    idsByType,
    addError,
  );
  validateRuleImplementations(
    entities.get("RuleImplementation") ?? [],
    referenceArray,
    validateReference,
    errors,
    addError,
  );
  validateFlowFamilies(entities.get("FlowFamily") ?? [], referenceArray);
  validateFlows(
    entities.get("Flow") ?? [],
    entities.get("FlowSegment") ?? [],
    referenceArray,
    validateReference,
    idsByType,
    errors,
    addError,
  );
  validateDecisionReferences(entities.get("DecisionReference") ?? [], globalIds, errors, addError);

  return { valid: errors.length === 0, errors };
}

type ReferenceValidator = (
  value: unknown,
  expectedType: EntityKind,
  ownerType: EntityKind,
  ownerId: string | undefined,
  field: string,
) => void;

type ReferenceArrayValidator = (
  entity: UnknownEntity,
  field: string,
  expectedType: EntityKind,
  ownerType: EntityKind,
  minimum?: number,
) => readonly unknown[];

function requiredString(
  entity: UnknownEntity,
  field: string,
  entityType: EntityKind,
  errors: ValidationError[],
  entityId?: string,
): string | undefined {
  const value = entity[field];
  if (typeof value === "string") return value;
  errors.push({
    code: field === "id" ? "INVALID_ID" : "INVALID_REQUIRED_FIELD",
    message: `${entityType}.${field} must be a string.`,
    entityType,
    entityId,
    field,
  });
  return undefined;
}

function optionalString(
  entity: UnknownEntity,
  field: string,
  entityType: EntityKind,
  errors: ValidationError[],
  entityId?: string,
): void {
  if (entity[field] !== undefined && typeof entity[field] !== "string") {
    errors.push({
      code: "INVALID_FIELD_TYPE",
      message: `${entityType}.${field} must be a string when present.`,
      entityType,
      entityId,
      field,
    });
  }
}

function stringId(entity: UnknownEntity): string | undefined {
  return typeof entity.id === "string" ? entity.id : undefined;
}

function optionalReference(
  entity: UnknownEntity,
  field: string,
  expectedType: EntityKind,
  ownerType: EntityKind,
  validateReference: ReferenceValidator,
): void {
  if (entity[field] !== undefined) {
    validateReference(entity[field], expectedType, ownerType, stringId(entity), field);
  }
}

function validateArchitectureLevel(
  entity: UnknownEntity,
  entityType: "Element" | "RuleImplementation",
  errors: ValidationError[],
): void {
  const value = entity.architectureLevel;
  if (
    value !== undefined &&
    (typeof value !== "string" || !ARCHITECTURE_LEVELS.has(value as ArchitectureLevel))
  ) {
    errors.push({
      code: "INVALID_ARCHITECTURE_LEVEL",
      message: `${entityType}.architectureLevel must be BUSINESS, APPLICATION, or TECHNOLOGY.`,
      entityType,
      entityId: stringId(entity),
      field: "architectureLevel",
    });
  }
}

function validateLayers(
  layers: readonly UnknownEntity[],
  idsByType: ReadonlyMap<EntityKind, ReadonlyMap<string, UnknownEntity>>,
  errors: ValidationError[],
  addError: (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ) => void,
): void {
  const layerMap = idsByType.get("Layer") ?? new Map<string, UnknownEntity>();
  const apsOwners = new Map<string, string>();

  for (const layer of layers) {
    const id = stringId(layer);
    optionalString(layer, "code", "Layer", errors, id);
    if (layer.order !== undefined && typeof layer.order !== "number") {
      addError("INVALID_FIELD_TYPE", "Layer.order must be a number.", "Layer", id, "order");
    }
    if (layer.parentLayerId !== undefined) {
      if (typeof layer.parentLayerId !== "string") {
        addError(
          "INVALID_FIELD_TYPE",
          "Layer.parentLayerId must be a string ID.",
          "Layer",
          id,
          "parentLayerId",
        );
      } else if (!layerMap.has(layer.parentLayerId)) {
        addError(
          "INVALID_REFERENCE",
          `Layer parent '${layer.parentLayerId}' does not exist.`,
          "Layer",
          id,
          "parentLayerId",
        );
      } else if (layer.parentLayerId === id) {
        addError(
          "INVALID_LAYER_HIERARCHY",
          "A Layer cannot be its own parent.",
          "Layer",
          id,
          "parentLayerId",
        );
      }
    }

    if (layer.apsLayer !== undefined) {
      if (typeof layer.apsLayer !== "string" || !APS_LAYER_VALUES.has(layer.apsLayer)) {
        addError(
          "INVALID_APS_LAYER",
          "Layer.apsLayer must be one of the eight approved APS concepts.",
          "Layer",
          id,
          "apsLayer",
        );
      } else {
        const existing = apsOwners.get(layer.apsLayer);
        if (existing !== undefined) {
          addError(
            "DUPLICATE_APS_LAYER",
            `APS concept '${layer.apsLayer}' is already assigned to Layer '${existing}'.`,
            "Layer",
            id,
            "apsLayer",
          );
        } else if (id !== undefined) {
          apsOwners.set(layer.apsLayer, id);
        }
        if (layer.parentLayerId !== undefined) {
          addError(
            "APS_LAYER_NOT_ROOT",
            "A Layer that declares apsLayer must be a root Layer.",
            "Layer",
            id,
            "parentLayerId",
          );
        }
      }
    }
  }

  for (const layer of layers) {
    const originId = stringId(layer);
    if (originId === undefined) continue;
    const visited = new Set<string>();
    let current: UnknownEntity | undefined = layer;
    while (current !== undefined && typeof current.parentLayerId === "string") {
      if (visited.has(current.parentLayerId)) {
        addError(
          "INVALID_LAYER_HIERARCHY",
          "Layer hierarchy contains a cycle.",
          "Layer",
          originId,
          "parentLayerId",
        );
        break;
      }
      visited.add(current.parentLayerId);
      current = layerMap.get(current.parentLayerId);
    }
  }
}

function validateProcesses(
  processes: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
  validateReference: ReferenceValidator,
  errors: ValidationError[],
): void {
  for (const process of processes) {
    refs(process, "businessCapabilityIds", "BusinessCapability", "Process");
    refs(process, "dataObjectIds", "DataObject", "Process");
    refs(process, "roleIds", "Role", "Process");
    refs(process, "elementIds", "Element", "Process");
    refs(process, "responsibilityIds", "Responsibility", "Process");
    refs(process, "businessRuleIds", "BusinessRule", "Process");
    refs(process, "decisionReferenceIds", "DecisionReference", "Process");
    const flowReferences = process.flowReferences;
    if (flowReferences === undefined) continue;
    if (!Array.isArray(flowReferences)) {
      errors.push({
        code: "INVALID_FIELD_TYPE",
        message: "Process.flowReferences must be an array.",
        entityType: "Process",
        entityId: stringId(process),
        field: "flowReferences",
      });
      continue;
    }
    flowReferences.forEach((reference, index) => {
      if (!isRecord(reference) || (reference.kind !== "initiates" && reference.kind !== "uses")) {
        errors.push({
          code: "INVALID_FIELD_TYPE",
          message: "Process flow reference must have kind 'initiates' or 'uses'.",
          entityType: "Process",
          entityId: stringId(process),
          field: `flowReferences[${index}]`,
        });
        return;
      }
      validateReference(
        reference.flowId,
        "Flow",
        "Process",
        stringId(process),
        `flowReferences[${index}].flowId`,
      );
    });
  }
}

function validateDataObjects(
  dataObjects: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
): void {
  for (const dataObject of dataObjects) {
    refs(dataObject, "processIds", "Process", "DataObject");
    refs(dataObject, "flowIds", "Flow", "DataObject");
    refs(dataObject, "elementIds", "Element", "DataObject");
    refs(dataObject, "businessRuleIds", "BusinessRule", "DataObject");
  }
}

function validateOrganizations(
  entities: ReadonlyMap<EntityKind, readonly UnknownEntity[]>,
  refs: ReferenceArrayValidator,
): void {
  for (const role of entities.get("Role") ?? []) {
    refs(role, "positionIds", "Position", "Role");
    refs(role, "processIds", "Process", "Role");
    refs(role, "flowIds", "Flow", "Role");
    refs(role, "flowSegmentIds", "FlowSegment", "Role");
    refs(role, "responsibilityIds", "Responsibility", "Role");
    refs(role, "ownedBusinessRuleIds", "BusinessRule", "Role");
    refs(role, "ruleImplementationIds", "RuleImplementation", "Role");
    refs(role, "dataObjectIds", "DataObject", "Role");
    refs(role, "decisionReferenceIds", "DecisionReference", "Role");
  }
  for (const position of entities.get("Position") ?? []) {
    refs(position, "roleIds", "Role", "Position");
  }
  for (const responsibility of entities.get("Responsibility") ?? []) {
    refs(responsibility, "businessCapabilityIds", "BusinessCapability", "Responsibility");
    refs(responsibility, "processIds", "Process", "Responsibility");
    refs(responsibility, "roleIds", "Role", "Responsibility");
    refs(responsibility, "elementIds", "Element", "Responsibility");
    refs(responsibility, "businessRuleIds", "BusinessRule", "Responsibility");
  }
}

function validateBusinessRules(
  rules: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
  validateReference: ReferenceValidator,
  idsByType: ReadonlyMap<EntityKind, ReadonlyMap<string, UnknownEntity>>,
  addError: (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ) => void,
): void {
  const layers = idsByType.get("Layer") ?? new Map<string, UnknownEntity>();
  for (const rule of rules) {
    const id = stringId(rule);
    validateReference(rule.logicalLayerId, "Layer", "BusinessRule", id, "logicalLayerId");
    if (
      typeof rule.logicalLayerId === "string" &&
      layers.has(rule.logicalLayerId) &&
      !belongsToGovernance(rule.logicalLayerId, layers)
    ) {
      addError(
        "INVALID_BUSINESSRULE_LOGICAL_LAYER",
        "BusinessRule.logicalLayerId must reference Governance or one of its descendant Layers.",
        "BusinessRule",
        id,
        "logicalLayerId",
      );
    }
    refs(rule, "processIds", "Process", "BusinessRule");
    refs(rule, "dataObjectIds", "DataObject", "BusinessRule");
    refs(rule, "flowIds", "Flow", "BusinessRule");
    refs(rule, "flowSegmentIds", "FlowSegment", "BusinessRule");
    refs(rule, "responsibilityIds", "Responsibility", "BusinessRule");
    refs(rule, "ownerRoleIds", "Role", "BusinessRule");
    refs(rule, "ruleImplementationIds", "RuleImplementation", "BusinessRule");
    refs(rule, "decisionReferenceIds", "DecisionReference", "BusinessRule");
  }
}

function belongsToGovernance(layerId: string, layers: ReadonlyMap<string, UnknownEntity>): boolean {
  const visited = new Set<string>();
  let current = layers.get(layerId);
  while (current !== undefined) {
    if (current.apsLayer === GOVERNANCE_LAYER) return true;
    const currentId = stringId(current);
    if (currentId !== undefined) {
      if (visited.has(currentId)) return false;
      visited.add(currentId);
    }
    if (typeof current.parentLayerId !== "string") return false;
    current = layers.get(current.parentLayerId);
  }
  return false;
}

function validateRuleImplementations(
  implementations: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
  validateReference: ReferenceValidator,
  errors: ValidationError[],
  addError: (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ) => void,
): void {
  for (const implementation of implementations) {
    const id = stringId(implementation);
    validateReference(
      implementation.businessRuleId,
      "BusinessRule",
      "RuleImplementation",
      id,
      "businessRuleId",
    );
    requiredString(implementation, "implementationType", "RuleImplementation", errors, id);
    const elementExecutors = refs(
      implementation,
      "executingElementIds",
      "Element",
      "RuleImplementation",
    );
    const roleExecutors = refs(implementation, "executingRoleIds", "Role", "RuleImplementation");
    if (elementExecutors.length + roleExecutors.length === 0) {
      addError(
        "RULEIMPLEMENTATION_WITHOUT_EXECUTOR",
        "RuleImplementation must reference at least one executing Element or Role.",
        "RuleImplementation",
        id,
        "executingElementIds/executingRoleIds",
      );
    }
    optionalReference(
      implementation,
      "actualLayerId",
      "Layer",
      "RuleImplementation",
      validateReference,
    );
    validateArchitectureLevel(implementation, "RuleImplementation", errors);
  }
}

function validateFlowFamilies(
  families: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
): void {
  for (const family of families) {
    refs(family, "businessCapabilityIds", "BusinessCapability", "FlowFamily");
    refs(family, "flowIds", "Flow", "FlowFamily");
  }
}

function validateFlows(
  flows: readonly UnknownEntity[],
  segments: readonly UnknownEntity[],
  refs: ReferenceArrayValidator,
  validateReference: ReferenceValidator,
  idsByType: ReadonlyMap<EntityKind, ReadonlyMap<string, UnknownEntity>>,
  errors: ValidationError[],
  addError: (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ) => void,
): void {
  const flowMap = idsByType.get("Flow") ?? new Map<string, UnknownEntity>();
  const segmentMap = idsByType.get("FlowSegment") ?? new Map<string, UnknownEntity>();

  for (const segment of segments) {
    const id = stringId(segment);
    validateReference(segment.flowId, "Flow", "FlowSegment", id, "flowId");
    validateReference(segment.sourceElementId, "Element", "FlowSegment", id, "sourceElementId");
    validateReference(segment.targetElementId, "Element", "FlowSegment", id, "targetElementId");
    refs(segment, "dataObjectIds", "DataObject", "FlowSegment", 1);
    optionalReference(segment, "relationshipId", "Relationship", "FlowSegment", validateReference);
    if (
      !Number.isInteger(segment.sequence) ||
      typeof segment.sequence !== "number" ||
      segment.sequence < 1
    ) {
      addError(
        "INVALID_FLOW_SEQUENCE",
        "FlowSegment.sequence must be a positive integer beginning at 1.",
        "FlowSegment",
        id,
        "sequence",
      );
    }
  }

  for (const flow of flows) {
    const id = stringId(flow);
    requiredString(flow, "description", "Flow", errors, id);
    validateReference(flow.flowFamilyId, "FlowFamily", "Flow", id, "flowFamilyId");
    validateReference(flow.startElementId, "Element", "Flow", id, "startElementId");
    validateReference(flow.endElementId, "Element", "Flow", id, "endElementId");
    refs(flow, "processIds", "Process", "Flow");
    const flowDataObjects = refs(flow, "dataObjectIds", "DataObject", "Flow", 1);
    const flowSegmentIds = refs(flow, "flowSegmentIds", "FlowSegment", "Flow", 1);
    const resolvedSegments = flowSegmentIds
      .filter((segmentId): segmentId is string => typeof segmentId === "string")
      .map((segmentId) => segmentMap.get(segmentId))
      .filter((segment): segment is UnknownEntity => segment !== undefined);

    for (const segment of resolvedSegments) {
      if (segment.flowId !== id) {
        addError(
          "INVALID_REFERENCE_TYPE",
          `FlowSegment '${String(segment.id)}' belongs to a different Flow.`,
          "Flow",
          id,
          "flowSegmentIds",
        );
      }
    }

    const ordered = [...resolvedSegments].sort((left, right) =>
      typeof left.sequence === "number" && typeof right.sequence === "number"
        ? left.sequence - right.sequence
        : 0,
    );
    const sequences = ordered.map((segment) => segment.sequence);
    if (
      sequences.length !== new Set(sequences).size ||
      sequences.some((sequence, index) => sequence !== index + 1)
    ) {
      addError(
        "INVALID_FLOW_SEQUENCE",
        "FlowSegment sequence must be unique, contiguous, and begin at 1.",
        "Flow",
        id,
        "flowSegmentIds",
      );
    }

    if (ordered.length > 0) {
      if (ordered[0]?.sourceElementId !== flow.startElementId) {
        addError(
          "FLOW_CONTINUITY_ERROR",
          "The first FlowSegment source must equal Flow.startElementId.",
          "Flow",
          id,
          "startElementId",
        );
      }
      if (ordered.at(-1)?.targetElementId !== flow.endElementId) {
        addError(
          "FLOW_CONTINUITY_ERROR",
          "The last FlowSegment target must equal Flow.endElementId.",
          "Flow",
          id,
          "endElementId",
        );
      }
      for (let index = 0; index < ordered.length - 1; index += 1) {
        if (ordered[index]?.targetElementId !== ordered[index + 1]?.sourceElementId) {
          addError(
            "FLOW_CONTINUITY_ERROR",
            `Flow continuity is broken between sequence ${index + 1} and ${index + 2}.`,
            "Flow",
            id,
            "flowSegmentIds",
          );
        }
      }
    }

    const declaredDataObjects = new Set(
      flowDataObjects.filter((value): value is string => typeof value === "string"),
    );
    const participatingDataObjects = new Set<string>();
    for (const segment of resolvedSegments) {
      if (!Array.isArray(segment.dataObjectIds)) continue;
      for (const dataObjectId of segment.dataObjectIds) {
        if (typeof dataObjectId !== "string") continue;
        participatingDataObjects.add(dataObjectId);
        if (!declaredDataObjects.has(dataObjectId)) {
          addError(
            "FLOW_DATAOBJECT_MISMATCH",
            `FlowSegment '${String(segment.id)}' uses DataObject '${dataObjectId}' not declared by its Flow.`,
            "FlowSegment",
            stringId(segment),
            "dataObjectIds",
          );
        }
      }
    }
    for (const dataObjectId of declaredDataObjects) {
      if (!participatingDataObjects.has(dataObjectId)) {
        addError(
          "FLOW_DATAOBJECT_MISMATCH",
          `Flow DataObject '${dataObjectId}' does not participate in any referenced FlowSegment.`,
          "Flow",
          id,
          "dataObjectIds",
        );
      }
    }
  }

  // The reference check above establishes that every standalone segment names an existing Flow.
  void flowMap;
}

function validateDecisionReferences(
  decisions: readonly UnknownEntity[],
  globalIds: ReadonlyMap<string, EntityKind>,
  errors: ValidationError[],
  addError: (
    code: ValidationErrorCode,
    message: string,
    entityType?: EntityKind,
    entityId?: string,
    field?: string,
  ) => void,
): void {
  const validKinds = new Set<EntityKind>([
    "Architecture",
    ...COLLECTIONS.map(([, entityType]) => entityType),
  ]);
  for (const decision of decisions) {
    const id = stringId(decision);
    requiredString(decision, "title", "DecisionReference", errors, id);
    requiredString(decision, "status", "DecisionReference", errors, id);
    requiredString(decision, "reference", "DecisionReference", errors, id);
    if (!Array.isArray(decision.affectedObjects) || decision.affectedObjects.length === 0) {
      addError(
        "INVALID_DECISION_REFERENCE",
        "DecisionReference.affectedObjects must contain at least one reference.",
        "DecisionReference",
        id,
        "affectedObjects",
      );
      continue;
    }
    decision.affectedObjects.forEach((affectedObject, index) => {
      if (
        !isRecord(affectedObject) ||
        typeof affectedObject.entityType !== "string" ||
        !validKinds.has(affectedObject.entityType as EntityKind) ||
        typeof affectedObject.entityId !== "string"
      ) {
        addError(
          "INVALID_DECISION_REFERENCE",
          "Affected object must include a valid entityType and string entityId.",
          "DecisionReference",
          id,
          `affectedObjects[${index}]`,
        );
        return;
      }
      const actualType = globalIds.get(affectedObject.entityId);
      if (actualType === undefined || actualType !== affectedObject.entityType) {
        addError(
          "INVALID_DECISION_REFERENCE",
          actualType === undefined
            ? `Affected object '${affectedObject.entityId}' does not exist.`
            : `Affected object '${affectedObject.entityId}' is ${actualType}, not ${affectedObject.entityType}.`,
          "DecisionReference",
          id,
          `affectedObjects[${index}]`,
        );
      }
    });
  }
}
