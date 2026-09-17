import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import physicalSchema from "../src/schema/architecture-v0.1.schema.json" with { type: "json" };

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(physicalSchema);

function minimalDocument(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "0.1",
    architecture: {
      id: "architecture-1",
      name: "Example Architecture",
      modelVersion: "0.1",
      metadata,
    },
  };
}

function documentWith(collection: string, entity: unknown): Record<string, unknown> {
  const document = minimalDocument();
  const architecture = document.architecture as Record<string, unknown>;
  architecture[collection] = [entity];
  return document;
}

function isValid(document: unknown): boolean {
  return validate(document);
}

describe("AETHER Physical Schema v0.1", () => {
  it.each([
    ["businessCapabilities", "responsibilityIds"],
    ["processes", "responsibilityIds"],
    ["processes", "businessRuleIds"],
    ["responsibilities", "businessRuleIds"],
  ])("rejects redundant physical field %s.%s", (collection, field) => {
    expect(
      isValid(
        documentWith(collection, { id: "entity-1", name: "Example", [field]: ["related-1"] }),
      ),
    ).toBe(false);
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "additionalProperties",
          instancePath: `/architecture/${collection}/0`,
          params: { additionalProperty: field },
        }),
      ]),
    );
  });

  it.each([
    ["responsibilities", "businessCapabilityIds", { id: "entity-1", name: "Example" }],
    ["responsibilities", "processIds", { id: "entity-1", name: "Example" }],
    [
      "businessRules",
      "processIds",
      { id: "entity-1", name: "Example", logicalLayerId: "governance" },
    ],
    [
      "businessRules",
      "responsibilityIds",
      { id: "entity-1", name: "Example", logicalLayerId: "governance" },
    ],
  ])("accepts canonical physical field %s.%s", (collection, field, entity) => {
    expect(isValid(documentWith(collection, { ...entity, [field]: ["related-1"] }))).toBe(true);
  });

  it("accepts a minimal document", () => {
    expect(isValid(minimalDocument())).toBe(true);
  });

  it("rejects an incorrect schemaVersion", () => {
    expect(isValid({ ...minimalDocument(), schemaVersion: "0.2" })).toBe(false);
  });

  it("rejects a missing architecture", () => {
    expect(isValid({ schemaVersion: "0.1" })).toBe(false);
  });

  it("rejects an unknown root property", () => {
    expect(isValid({ ...minimalDocument(), unexpected: true })).toBe(false);
  });

  it("rejects an unknown property inside an entity", () => {
    expect(
      isValid(
        documentWith("elements", {
          id: "element-1",
          name: "Element",
          elementType: "Application",
          coordinates: { x: 0, y: 0 },
        }),
      ),
    ).toBe(false);
  });

  it("rejects a Flow without dataObjectIds", () => {
    expect(
      isValid(
        documentWith("flows", {
          id: "flow-1",
          name: "Flow",
          description: "Flow description",
          flowFamilyId: "family-1",
          startElementId: "element-1",
          endElementId: "element-2",
          flowSegmentIds: ["segment-1"],
        }),
      ),
    ).toBe(false);
  });

  it("rejects a Flow with empty dataObjectIds", () => {
    expect(
      isValid(
        documentWith("flows", {
          id: "flow-1",
          name: "Flow",
          description: "Flow description",
          flowFamilyId: "family-1",
          dataObjectIds: [],
          startElementId: "element-1",
          endElementId: "element-2",
          flowSegmentIds: ["segment-1"],
        }),
      ),
    ).toBe(false);
  });

  it("rejects a Flow without flowSegmentIds", () => {
    expect(
      isValid(
        documentWith("flows", {
          id: "flow-1",
          name: "Flow",
          description: "Flow description",
          flowFamilyId: "family-1",
          dataObjectIds: ["data-1"],
          startElementId: "element-1",
          endElementId: "element-2",
        }),
      ),
    ).toBe(false);
  });

  it("rejects FlowSegment sequence zero", () => {
    expect(
      isValid(
        documentWith("flowSegments", {
          id: "segment-1",
          flowId: "flow-1",
          sequence: 0,
          sourceElementId: "element-1",
          targetElementId: "element-2",
          dataObjectIds: ["data-1"],
        }),
      ),
    ).toBe(false);
  });

  it("rejects an invalid ArchitectureLevel", () => {
    expect(
      isValid(
        documentWith("elements", {
          id: "element-1",
          name: "Element",
          elementType: "Application",
          architectureLevel: "INFORMATION",
        }),
      ),
    ).toBe(false);
  });

  it("rejects an invalid ApsLayer", () => {
    expect(
      isValid(
        documentWith("layers", {
          id: "layer-1",
          name: "Layer",
          apsLayer: "CUSTOM",
        }),
      ),
    ).toBe(false);
  });

  it("rejects an invalid ProcessFlowReference kind", () => {
    expect(
      isValid(
        documentWith("processes", {
          id: "process-1",
          name: "Process",
          flowReferences: [{ flowId: "flow-1", kind: "owns" }],
        }),
      ),
    ).toBe(false);
  });

  it("rejects empty DecisionReference affectedObjects", () => {
    expect(
      isValid(
        documentWith("decisionReferences", {
          id: "decision-1",
          title: "Decision",
          status: "accepted",
          reference: "ADR-0001",
          affectedObjects: [],
        }),
      ),
    ).toBe(false);
  });

  it("rejects an affected object without entityType", () => {
    expect(
      isValid(
        documentWith("decisionReferences", {
          id: "decision-1",
          title: "Decision",
          status: "accepted",
          reference: "ADR-0001",
          affectedObjects: [{ entityId: "element-1" }],
        }),
      ),
    ).toBe(false);
  });

  it("rejects a non-canonical affected object entityType", () => {
    expect(
      isValid(
        documentWith("decisionReferences", {
          id: "decision-1",
          title: "Decision",
          status: "accepted",
          reference: "ADR-0001",
          affectedObjects: [{ entityType: "Application", entityId: "element-1" }],
        }),
      ),
    ).toBe(false);
  });

  it("accepts an Element without layerId", () => {
    expect(
      isValid(
        documentWith("elements", {
          id: "element-1",
          name: "Element",
          elementType: "Application",
          architectureLevel: "APPLICATION",
        }),
      ),
    ).toBe(true);
  });

  it("accepts an Element without architectureLevel", () => {
    expect(
      isValid(
        documentWith("elements", {
          id: "element-1",
          name: "Element",
          elementType: "Application",
          layerId: "layer-1",
        }),
      ),
    ).toBe(true);
  });

  it("accepts a BusinessRule without ownerRoleIds", () => {
    expect(
      isValid(
        documentWith("businessRules", {
          id: "rule-1",
          name: "Rule",
          logicalLayerId: "layer-governance",
        }),
      ),
    ).toBe(true);
  });

  it("accepts a RuleImplementation without actualLayerId", () => {
    expect(
      isValid(
        documentWith("ruleImplementations", {
          id: "implementation-1",
          businessRuleId: "rule-1",
          implementationType: "MANUAL",
          executingRoleIds: ["role-1"],
        }),
      ),
    ).toBe(true);
  });

  it("accepts nested descriptive JSON metadata", () => {
    expect(
      isValid(
        minimalDocument({
          purpose: "Demonstration",
          reviewed: true,
          confidence: 0.8,
          notes: ["first", null, { source: "workshop" }],
        }),
      ),
    ).toBe(true);
  });

  it("rejects a RuleImplementation without either executor collection", () => {
    expect(
      isValid(
        documentWith("ruleImplementations", {
          id: "implementation-1",
          businessRuleId: "rule-1",
          implementationType: "MANUAL",
        }),
      ),
    ).toBe(false);
  });

  it("rejects a RuleImplementation with only empty executor collections", () => {
    expect(
      isValid(
        documentWith("ruleImplementations", {
          id: "implementation-1",
          businessRuleId: "rule-1",
          implementationType: "MANUAL",
          executingElementIds: [],
          executingRoleIds: [],
        }),
      ),
    ).toBe(false);
  });

  it("allows an empty optional Architecture collection", () => {
    const document = minimalDocument();
    const architecture = document.architecture as Record<string, unknown>;
    architecture.elements = [];
    expect(isValid(document)).toBe(true);
  });
});
