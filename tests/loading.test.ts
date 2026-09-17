import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  loadArchitectureFromJson,
  type Architecture,
  type ArchitectureId,
  type Element,
  type FlowFamilyId,
  type ProcessId,
  type AffectedObjectReference,
} from "../src/index.js";
import { parseArchitectureJson } from "../src/loading/json-parser.js";
import * as mapper from "../src/loading/mapper.js";
import { validatePhysicalArchitecture } from "../src/loading/physical-validation.js";
import { validateArchitecture } from "../src/validation/index.js";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };

type Fixture = typeof fixture;

function validated(input: unknown = fixture) {
  const result = validatePhysicalArchitecture(input);
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.document;
}

function mapped(): Architecture {
  return mapper.mapPhysicalToDomain(validated());
}

function freezeDeep(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
}

describe("JSON parser", () => {
  it("parses valid JSON as an unknown value", () => {
    const result = parseArchitectureJson('{"example":1}');
    expect(result).toEqual({ success: true, value: { example: 1 } });
    if (result.success) expectTypeOf(result.value).toEqualTypeOf<unknown>();
  });

  it("reports invalid syntax without schema validation", () => {
    const result = parseArchitectureJson('{"example":');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.stage).toBe("json-parse");
  });

  it("accepts generic JSON values independently of the architecture contract", () => {
    expect(parseArchitectureJson("null")).toEqual({ success: true, value: null });
    expect(parseArchitectureJson("[1,true]")).toEqual({ success: true, value: [1, true] });
  });
});

describe("physical validation integration", () => {
  it("rejects an incorrect schemaVersion", () => {
    const result = validatePhysicalArchitecture({ ...fixture, schemaVersion: "0.2" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          stage: "physical-schema",
          path: "/schemaVersion",
          keyword: "const",
        }),
      );
  });

  it("rejects an invalid physical structure with a document path", () => {
    const result = validatePhysicalArchitecture({
      schemaVersion: "0.1",
      architecture: { id: "example" },
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "/architecture/metadata", keyword: "required" }),
      );
  });

  it("rejects unknown properties without removing them", () => {
    const input = { ...fixture, extra: true };
    const result = validatePhysicalArchitecture(input);
    expect(result.success).toBe(false);
    expect(input.extra).toBe(true);
  });

  it("returns detached error records across repeated validations", () => {
    const first = validatePhysicalArchitecture(null);
    const snapshot = structuredClone(first);
    validatePhysicalArchitecture({});
    expect(first).toEqual(snapshot);
  });
});

describe("Physical → Domain mapper", () => {
  it("maps the Architecture root and all fifteen entity collections", () => {
    const a = mapped();
    expect(a.id).toBe(fixture.architecture.id);
    expect(a.name).toBe("Example Architecture");
    expect(a.modelVersion).toBe("0.1");
    expect(a.metadata).toEqual(fixture.architecture.metadata);
    for (const collection of [
      "businessCapabilities",
      "layers",
      "elements",
      "relationships",
      "processes",
      "dataObjects",
      "flowFamilies",
      "flows",
      "flowSegments",
      "roles",
      "positions",
      "responsibilities",
      "businessRules",
      "ruleImplementations",
      "decisionReferences",
    ] as const) {
      expect(a[collection]?.length).toBe(fixture.architecture[collection].length);
    }
  });

  it("assigns nominal types without changing ID strings", () => {
    const a = mapped();
    expectTypeOf(a.id).toEqualTypeOf<ArchitectureId>();
    expectTypeOf(a.flows![0]!.flowFamilyId).toEqualTypeOf<FlowFamilyId>();
    expectTypeOf(a.processes![0]!.id).toEqualTypeOf<ProcessId>();
    expectTypeOf(a.elements).toEqualTypeOf<readonly Element[] | undefined>();
    expect(a.id).toBe("example architecture");
  });

  it("preserves opaque IDs including whitespace and case", () => {
    const input = {
      schemaVersion: "0.1",
      architecture: { id: "  Mixed ID /  ", name: "Example", modelVersion: "0.1", metadata: {} },
    };
    expect(mapper.mapPhysicalToDomain(validated(input)).id).toBe("  Mixed ID /  ");
  });

  it("maps Layer and apsLayer without looking at names", () => {
    expect(mapped().layers).toEqual(fixture.architecture.layers);
    expect(mapped().layers?.[2]?.order).toBe(1.5);
  });

  it("maps Element and ArchitectureLevel", () => {
    expect(mapped().elements?.[0]).toMatchObject(fixture.architecture.elements[0]!);
    expect(mapped().elements?.[0]?.architectureLevel).toBe("APPLICATION");
  });

  it("maps Flow composition without embedding segments", () => {
    expect(mapped().flows?.[0]).toMatchObject(fixture.architecture.flows[0]!);
    expect(mapped().flows?.[0]?.flowSegmentIds).toEqual(["segment-1", "segment-2"]);
  });

  it("maps FlowSegment identities, sequence and optional Relationship", () => {
    expect(mapped().flowSegments).toEqual(fixture.architecture.flowSegments);
  });

  it("preserves both initiates and uses and derives Flow.processIds", () => {
    const a = mapped();
    expect(a.processes?.[0]?.flowReferences).toEqual(
      fixture.architecture.processes[0]!.flowReferences,
    );
    expect(a.flows?.[0]?.processIds).toEqual(["process-1"]);
  });

  it("maps BusinessRule independently of RuleImplementation", () => {
    expect(mapped().businessRules?.[0]).toMatchObject(fixture.architecture.businessRules[0]!);
    expect(mapped().businessRules?.[0]?.logicalLayerId).toBe("policy");
  });

  it("maps RuleImplementation without closing its taxonomy or changing its placement", () => {
    const a = mapped();
    expect(a.ruleImplementations).toEqual(fixture.architecture.ruleImplementations);
    expect(a.ruleImplementations?.[0]?.actualLayerId).toBe("core");
    expect(a.ruleImplementations?.[0]?.implementationType).toBe("EXAMPLE_IMPLEMENTATION");
    expect(validateArchitecture(a).valid).toBe(true);
  });

  it("preserves the typed affectedObjects union", () => {
    const references = mapped().decisionReferences![0]!.affectedObjects;
    expectTypeOf(references[0]).toEqualTypeOf<AffectedObjectReference>();
    expect(references).toEqual(fixture.architecture.decisionReferences[0]!.affectedObjects);
    const root = references.find((reference) => reference.entityType === "Architecture");
    if (!root) throw new Error("Missing root reference");
    expectTypeOf(root.entityId).toEqualTypeOf<ArchitectureId>();
  });

  it("derives Capability.responsibilityIds only from Responsibility.businessCapabilityIds", () => {
    expect(mapped().businessCapabilities?.[0]?.responsibilityIds).toEqual(["responsibility-1"]);
  });

  it("derives Process.responsibilityIds only from Responsibility.processIds", () => {
    expect(mapped().processes?.[0]?.responsibilityIds).toEqual(["responsibility-1"]);
  });

  it("derives Process.businessRuleIds only from BusinessRule.processIds", () => {
    expect(mapped().processes?.[0]?.businessRuleIds).toEqual(["rule-1"]);
  });

  it("derives Responsibility.businessRuleIds only from BusinessRule.responsibilityIds", () => {
    expect(mapped().responsibilities?.[0]?.businessRuleIds).toEqual(["rule-1"]);
  });

  it("does not mutate the physical input, its arrays or metadata", () => {
    const input = structuredClone(fixture);
    const snapshot = structuredClone(input);
    freezeDeep(input);
    const a = mapper.mapPhysicalToDomain(validated(input));
    expect(input).toEqual(snapshot);
    expect(a.metadata).not.toBe(input.architecture.metadata);
    expect(a.flows?.[0]?.flowSegmentIds).not.toBe(input.architecture.flows[0]!.flowSegmentIds);
    expect(a.businessCapabilities?.[0]).not.toBe(input.architecture.businessCapabilities[0]);
    expect(a.processes?.[0]?.flowReferences).not.toBe(
      input.architecture.processes[0]!.flowReferences,
    );
  });

  it("derives the other inverse views present in the Domain Model", () => {
    const a = mapped();
    expect(a.processes?.[0]?.businessCapabilityIds).toEqual(["capability-1"]);
    expect(a.elements?.[0]).toMatchObject({
      processIds: ["process-1"],
      responsibilityIds: ["responsibility-1"],
      dataObjectIds: ["request"],
      ruleImplementationIds: ["implementation-1"],
      flowSegmentIds: ["segment-1"],
      decisionReferenceIds: ["decision-1"],
    });
    expect(a.dataObjects?.[0]).toMatchObject({
      processIds: ["process-1"],
      flowIds: ["flow-1"],
      businessRuleIds: ["rule-1"],
    });
    expect(a.flowFamilies?.[0]).toMatchObject({
      flowIds: ["flow-1"],
      businessCapabilityIds: ["capability-1"],
    });
    expect(a.roles?.[0]).toMatchObject({
      processIds: ["process-1"],
      responsibilityIds: ["responsibility-1"],
      ownedBusinessRuleIds: ["rule-1"],
      ruleImplementationIds: ["implementation-1"],
    });
    expect(a.positions?.[0]?.roleIds).toEqual(["role-1"]);
    expect(a.businessRules?.[0]?.ruleImplementationIds).toEqual(["implementation-1"]);
    for (const entity of [
      a.businessCapabilities?.[0],
      a.processes?.[0],
      a.roles?.[0],
      a.businessRules?.[0],
    ])
      expect(entity?.decisionReferenceIds).toEqual(["decision-1"]);
  });

  it("does not invent context fields not present in the Domain Model", () => {
    const a = mapped();
    expect(Object.keys(a.flowFamilies![0]!).sort()).toEqual([
      "businessCapabilityIds",
      "flowIds",
      "id",
      "name",
    ]);
    expect(a.dataObjects?.[0]).not.toHaveProperty("flowSegmentIds");
    expect(a.layers?.[0]).not.toHaveProperty("childLayerIds");
    expect(a.relationships?.[0]).not.toHaveProperty("flowSegmentIds");
    expect(a.flows?.[0]).not.toHaveProperty("roleIds");
  });

  it("does not create entities for unresolved inverse targets", () => {
    const input = structuredClone(fixture);
    input.architecture.responsibilities[0]!.businessCapabilityIds = ["missing-capability"];
    const a = mapper.mapPhysicalToDomain(validated(input));
    expect(a.businessCapabilities).toHaveLength(1);
    expect(a.businessCapabilities?.[0]?.responsibilityIds).toBeUndefined();
    expect(a.responsibilities?.[0]?.businessCapabilityIds).toEqual(["missing-capability"]);
  });
});

describe("loading pipeline", () => {
  it("loads the neutral JSON fixture end-to-end", () => {
    const result = loadArchitectureFromJson(JSON.stringify(fixture));
    expect(result.success).toBe(true);
    if (result.success)
      expect(validateArchitecture(result.architecture)).toEqual({ valid: true, errors: [] });
  });

  it("reports a JSON syntax failure at the parsing stage", () => {
    expect(loadArchitectureFromJson("{")).toMatchObject({ success: false, stage: "json-parse" });
  });

  it("reports physical errors separately from domain errors", () => {
    expect(
      loadArchitectureFromJson(JSON.stringify({ ...fixture, schemaVersion: "0.2" })),
    ).toMatchObject({ success: false, stage: "physical-schema" });
  });

  it("demonstrates physical validity is not domain validity", () => {
    const input = structuredClone(fixture);
    input.architecture.flows[0]!.flowFamilyId = "missing-family";
    const physical = validated(input);
    const a = mapper.mapPhysicalToDomain(physical);
    expect(a.flows?.[0]?.flowFamilyId).toBe("missing-family");
    expect(validateArchitecture(a).errors.map((error) => error.code)).toContain(
      "INVALID_REFERENCE",
    );
    const result = loadArchitectureFromJson(JSON.stringify(input));
    expect(result).toMatchObject({ success: false, stage: "domain-validation" });
  });

  it("reports physically valid but broken Flow continuity in Domain Validator", () => {
    const input = structuredClone(fixture);
    input.architecture.flowSegments[1]!.sourceElementId = "entry";
    expect(validatePhysicalArchitecture(input).success).toBe(true);
    const result = loadArchitectureFromJson(JSON.stringify(input));
    expect(result.success).toBe(false);
    if (!result.success && result.stage === "domain-validation")
      expect(result.errors.map((error) => error.code)).toContain("FLOW_CONTINUITY_ERROR");
    else throw new Error("Expected domain failure");
  });

  it("reports a BusinessRule outside Governance at the domain stage", () => {
    const input = structuredClone(fixture);
    input.architecture.businessRules[0]!.logicalLayerId = "core";
    expect(validatePhysicalArchitecture(input).success).toBe(true);
    const result = loadArchitectureFromJson(JSON.stringify(input));
    if (!result.success && result.stage === "domain-validation")
      expect(result.errors.map((error) => error.code)).toContain(
        "INVALID_BUSINESSRULE_LOGICAL_LAYER",
      );
    else throw new Error("Expected domain failure");
  });

  it("does not repair Flow/FlowSegment membership", () => {
    const input = structuredClone(fixture);
    input.architecture.flowSegments[1]!.flowId = "missing-flow";
    const a = mapper.mapPhysicalToDomain(validated(input));
    expect(a.flowSegments?.[1]?.flowId).toBe("missing-flow");
    expect(a.flows?.[0]?.flowSegmentIds).toEqual(["segment-1", "segment-2"]);
    expect(loadArchitectureFromJson(JSON.stringify(input))).toMatchObject({
      success: false,
      stage: "domain-validation",
    });
  });

  it.each([
    {
      name: "Responsibility.businessCapabilityIds",
      edit: (f: Fixture) => {
        f.architecture.responsibilities[0]!.businessCapabilityIds = ["missing"];
      },
      refs: (a: Architecture) => a.responsibilities?.[0]?.businessCapabilityIds,
    },
    {
      name: "Responsibility.processIds",
      edit: (f: Fixture) => {
        f.architecture.responsibilities[0]!.processIds = ["missing"];
      },
      refs: (a: Architecture) => a.responsibilities?.[0]?.processIds,
    },
    {
      name: "BusinessRule.processIds",
      edit: (f: Fixture) => {
        f.architecture.businessRules[0]!.processIds = ["missing"];
      },
      refs: (a: Architecture) => a.businessRules?.[0]?.processIds,
    },
    {
      name: "BusinessRule.responsibilityIds",
      edit: (f: Fixture) => {
        f.architecture.businessRules[0]!.responsibilityIds = ["missing"];
      },
      refs: (a: Architecture) => a.businessRules?.[0]?.responsibilityIds,
    },
  ])("preserves a missing reference in $name for Domain Validator", ({ edit, refs }) => {
    const input = structuredClone(fixture);
    edit(input);
    const a = mapper.mapPhysicalToDomain(validated(input));
    expect(refs(a)).toEqual(["missing"]);
    expect(a.processes).toHaveLength(1);
    expect(a.businessCapabilities).toHaveLength(1);
    expect(a.responsibilities).toHaveLength(1);
    const result = loadArchitectureFromJson(JSON.stringify(input));
    if (!result.success && result.stage === "domain-validation")
      expect(result.errors.map((error) => error.code)).toContain("INVALID_REFERENCE");
    else throw new Error("Expected domain failure");
  });

  it.each([
    ["businessCapabilities", "responsibilityIds"],
    ["processes", "responsibilityIds"],
    ["processes", "businessRuleIds"],
    ["responsibilities", "businessRuleIds"],
  ])("rejects bilateral physical input %s.%s before mapping", (collection, field) => {
    const input = {
      ...fixture,
      architecture: {
        ...fixture.architecture,
        [collection]: [{ id: "example", name: "Example", [field]: ["missing"] }],
      },
    };
    expect(loadArchitectureFromJson(JSON.stringify(input))).toMatchObject({
      success: false,
      stage: "physical-schema",
    });
  });

  it("preserves permitted incomplete information without inferring fields", () => {
    const input = {
      schemaVersion: "0.1",
      architecture: {
        id: "example",
        name: "Example",
        modelVersion: "0.1",
        metadata: {},
        layers: [{ id: "gov", name: "Governance", apsLayer: "GOVERNANCE_POLICIES_DECISIONS" }],
        elements: [
          { id: "entry", name: "Entry", elementType: "EXAMPLE" },
          { id: "end", name: "End", elementType: "EXAMPLE" },
        ],
        dataObjects: [{ id: "request", name: "Request" }],
        flowFamilies: [{ id: "family", name: "Example Family" }],
        flows: [
          {
            id: "flow",
            name: "Example Flow",
            description: "Example",
            flowFamilyId: "family",
            dataObjectIds: ["request"],
            startElementId: "entry",
            endElementId: "end",
            flowSegmentIds: ["segment"],
          },
        ],
        flowSegments: [
          {
            id: "segment",
            flowId: "flow",
            sequence: 1,
            sourceElementId: "entry",
            targetElementId: "end",
            dataObjectIds: ["request"],
          },
        ],
        roles: [{ id: "role", name: "Example Role" }],
        responsibilities: [{ id: "responsibility", name: "Example Responsibility" }],
        businessRules: [
          { id: "rule", name: "Example Rule", logicalLayerId: "gov" },
          { id: "unimplemented-rule", name: "Another Rule", logicalLayerId: "gov" },
        ],
        ruleImplementations: [
          {
            id: "implementation",
            businessRuleId: "rule",
            implementationType: "MANUAL",
            executingRoleIds: ["role"],
          },
        ],
      },
    };
    const result = loadArchitectureFromJson(JSON.stringify(input));
    if (!result.success) throw new Error(JSON.stringify(result.errors));
    const a = result.architecture;
    expect(a.elements?.[0]?.layerId).toBeUndefined();
    expect(a.elements?.[0]?.architectureLevel).toBeUndefined();
    expect(a.businessRules?.[0]?.ownerRoleIds).toBeUndefined();
    expect(a.businessRules?.[1]?.ruleImplementationIds).toBeUndefined();
    expect(a.roles?.[0]?.positionIds).toBeUndefined();
    expect(a.responsibilities?.[0]?.roleIds).toBeUndefined();
    expect(a.ruleImplementations?.[0]?.actualLayerId).toBeUndefined();
    expect(a.ruleImplementations?.[0]?.architectureLevel).toBeUndefined();
    expect(a.dataObjects?.[0]?.domain).toBeUndefined();
    expect(a.flows?.[0]?.processIds).toBeUndefined();
  });

  it("isolates unexpected internal mapping errors", () => {
    const spy = vi.spyOn(mapper, "mapPhysicalToDomain").mockImplementationOnce(() => {
      throw new Error("Internal test failure");
    });
    try {
      expect(loadArchitectureFromJson(JSON.stringify(fixture))).toMatchObject({
        success: false,
        stage: "mapping",
      });
    } finally {
      spy.mockRestore();
    }
  });
});
