import { describe, expect, it } from "vitest";

import { validateArchitecture } from "../src/validation/index.js";

type TestEntity = Record<string, unknown>;

interface Model extends TestEntity {
  layers: TestEntity[];
  elements: TestEntity[];
  dataObjects: TestEntity[];
  flowFamilies: TestEntity[];
  flows: TestEntity[];
  flowSegments: TestEntity[];
  roles: TestEntity[];
  businessRules: TestEntity[];
  ruleImplementations: TestEntity[];
  decisionReferences: TestEntity[];
}

function validModel(): Model {
  return {
    id: "architecture-1",
    name: "AETHER test architecture",
    modelVersion: "0.1",
    metadata: {},
    layers: [
      {
        id: "layer-governance",
        name: "Gobierno / Políticas / Decisiones",
        apsLayer: "GOVERNANCE_POLICIES_DECISIONS",
      },
      { id: "layer-policy", name: "Policy", parentLayerId: "layer-governance" },
      { id: "layer-core", name: "Core", apsLayer: "CORE" },
    ],
    elements: [
      { id: "element-1", name: "Source", elementType: "Application" },
      { id: "element-2", name: "Middle", elementType: "Application" },
      { id: "element-3", name: "Target", elementType: "Application" },
    ],
    dataObjects: [
      { id: "data-1", name: "Order" },
      { id: "data-2", name: "Receipt" },
    ],
    flowFamilies: [{ id: "family-1", name: "Order lifecycle", flowIds: ["flow-1"] }],
    flows: [
      {
        id: "flow-1",
        name: "Submit order",
        description: "Linear order submission",
        flowFamilyId: "family-1",
        dataObjectIds: ["data-1"],
        startElementId: "element-1",
        endElementId: "element-3",
        flowSegmentIds: ["segment-1", "segment-2"],
      },
    ],
    flowSegments: [
      {
        id: "segment-1",
        flowId: "flow-1",
        sequence: 1,
        sourceElementId: "element-1",
        targetElementId: "element-2",
        dataObjectIds: ["data-1"],
      },
      {
        id: "segment-2",
        flowId: "flow-1",
        sequence: 2,
        sourceElementId: "element-2",
        targetElementId: "element-3",
        dataObjectIds: ["data-1"],
      },
    ],
    roles: [{ id: "role-1", name: "Policy owner" }],
    businessRules: [
      {
        id: "rule-1",
        name: "Order policy",
        logicalLayerId: "layer-policy",
        ownerRoleIds: ["role-1"],
        ruleImplementationIds: ["implementation-1"],
      },
    ],
    ruleImplementations: [
      {
        id: "implementation-1",
        businessRuleId: "rule-1",
        implementationType: "manual",
        executingRoleIds: ["role-1"],
      },
    ],
    decisionReferences: [
      {
        id: "decision-1",
        title: "Use linear flows",
        status: "accepted",
        reference: "ADR-0002",
        affectedObjects: [{ entityType: "Flow", entityId: "flow-1" }],
      },
    ],
  };
}

function expectError(model: unknown, code: string): void {
  const result = validateArchitecture(model);
  expect(result.valid).toBe(false);
  expect(result.errors.map((error) => error.code)).toContain(code);
}

describe("validateArchitecture", () => {
  it("accepts a structurally valid minimal model", () => {
    expect(validateArchitecture(validModel())).toEqual({ valid: true, errors: [] });
  });

  it("rejects duplicate IDs across entity types", () => {
    const model = validModel();
    model.roles[0]!.id = "element-1";
    expectError(model, "DUPLICATE_ID");
  });

  it("rejects a missing reference", () => {
    const model = validModel();
    model.flows[0]!.flowFamilyId = "missing-family";
    expectError(model, "INVALID_REFERENCE");
  });

  it("rejects a reference that resolves to the wrong entity type", () => {
    const model = validModel();
    model.elements[0]!.layerId = "role-1";
    expectError(model, "INVALID_REFERENCE_TYPE");
  });

  it("rejects a Flow without segments", () => {
    const model = validModel();
    model.flows[0]!.flowSegmentIds = [];
    expectError(model, "INVALID_REQUIRED_FIELD");
  });

  it("rejects a non-contiguous FlowSegment sequence", () => {
    const model = validModel();
    model.flowSegments[1]!.sequence = 3;
    expectError(model, "INVALID_FLOW_SEQUENCE");
  });

  it("rejects broken Flow continuity", () => {
    const model = validModel();
    model.flowSegments[1]!.sourceElementId = "element-1";
    expectError(model, "FLOW_CONTINUITY_ERROR");
  });

  it("rejects a segment DataObject not declared by its Flow", () => {
    const model = validModel();
    model.flowSegments[0]!.dataObjectIds = ["data-2"];
    expectError(model, "FLOW_DATAOBJECT_MISMATCH");
  });

  it("rejects a Flow DataObject unused by all its segments", () => {
    const model = validModel();
    model.flows[0]!.dataObjectIds = ["data-1", "data-2"];
    expectError(model, "FLOW_DATAOBJECT_MISMATCH");
  });

  it("rejects a Layer hierarchy cycle", () => {
    const model = validModel();
    model.layers[0]!.apsLayer = undefined;
    model.layers[0]!.parentLayerId = "layer-policy";
    expectError(model, "INVALID_LAYER_HIERARCHY");
  });

  it("rejects a self-referencing Relationship", () => {
    const model = validModel();
    model.relationships = [
      {
        id: "relationship-1",
        relationshipType: "depends-on",
        sourceElementId: "element-1",
        targetElementId: "element-1",
      },
    ];
    expectError(model, "RELATIONSHIP_SELF_REFERENCE");
  });

  it("rejects a BusinessRule outside Governance ancestry", () => {
    const model = validModel();
    model.businessRules[0]!.logicalLayerId = "layer-core";
    expectError(model, "INVALID_BUSINESSRULE_LOGICAL_LAYER");
  });

  it("rejects a RuleImplementation without an executor", () => {
    const model = validModel();
    model.ruleImplementations[0]!.executingRoleIds = [];
    expectError(model, "RULEIMPLEMENTATION_WITHOUT_EXECUTOR");
  });

  it("rejects a DecisionReference whose affected object does not exist", () => {
    const model = validModel();
    const affectedObjects = model.decisionReferences[0]!.affectedObjects as TestEntity[];
    affectedObjects[0]!.entityId = "missing-flow";
    expectError(model, "INVALID_DECISION_REFERENCE");
  });

  it("accepts an Element without direct Layer positioning", () => {
    const model = validModel();
    expect(model.elements[0]!.layerId).toBeUndefined();
    expect(validateArchitecture(model).valid).toBe(true);
  });

  it("accepts a BusinessRule without owner Role", () => {
    const model = validModel();
    delete model.businessRules[0]!.ownerRoleIds;
    expect(validateArchitecture(model).valid).toBe(true);
  });

  it("accepts a Role without Position", () => {
    const model = validModel();
    expect(model.roles[0]!.positionIds).toBeUndefined();
    expect(validateArchitecture(model).valid).toBe(true);
  });

  it("accepts a RuleImplementation without actualLayer", () => {
    const model = validModel();
    expect(model.ruleImplementations[0]!.actualLayerId).toBeUndefined();
    expect(validateArchitecture(model).valid).toBe(true);
  });

  it("rejects assigning the same APS concept to two root Layers", () => {
    const model = validModel();
    model.layers.push({ id: "layer-core-2", name: "Other core", apsLayer: "CORE" });
    expectError(model, "DUPLICATE_APS_LAYER");
  });

  it("rejects declaring an APS concept on a child Layer", () => {
    const model = validModel();
    model.layers[1]!.apsLayer = "SECURITY";
    expectError(model, "APS_LAYER_NOT_ROOT");
  });

  it("accepts a non-APS root Layer", () => {
    const model = validModel();
    model.layers.push({ id: "layer-custom", name: "Custom" });
    expect(validateArchitecture(model).valid).toBe(true);
  });
});
