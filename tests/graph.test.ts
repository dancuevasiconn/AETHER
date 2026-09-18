import { describe, expect, it } from "vitest";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };
import {
  createGraph,
  EDGE_TYPES,
  loadArchitectureFromJson,
  validateArchitecture,
} from "../src/index.js";
import type {
  Architecture,
  EntityKind,
  GraphEngine,
  GraphResult,
  TraversalOptions,
} from "../src/index.js";

function value<T>(result: GraphResult<T>): T {
  if (!result.success) throw new Error(result.error.message);
  return result.value;
}
function architecture(input = fixture): Architecture {
  const loaded = loadArchitectureFromJson(JSON.stringify(input));
  if (!loaded.success) throw new Error(JSON.stringify(loaded));
  return loaded.architecture;
}
function graph(a = architecture()): GraphEngine {
  return value(createGraph(a));
}
function key(g: GraphEngine, type: EntityKind, id: string): string {
  return value(g.getNode(type, id)).key;
}
function allEdges(g: GraphEngine) {
  return entityCases.flatMap(([type]) =>
    g.getNodesByType(type).flatMap((node) => value(g.getOutgoing(node.key))),
  );
}
const entityCases: readonly (readonly [EntityKind, string])[] = [
  ["Architecture", "example architecture"],
  ["BusinessCapability", "capability-1"],
  ["Element", "entry"],
  ["Relationship", "relationship-1"],
  ["Layer", "core"],
  ["Process", "process-1"],
  ["DataObject", "request"],
  ["Flow", "flow-1"],
  ["FlowSegment", "segment-1"],
  ["FlowFamily", "family-1"],
  ["Role", "role-1"],
  ["Position", "position-1"],
  ["Responsibility", "responsibility-1"],
  ["BusinessRule", "rule-1"],
  ["RuleImplementation", "implementation-1"],
  ["DecisionReference", "decision-1"],
];
const relationshipTypes = ["Relationship.sourceElement", "Relationship.targetElement"] as const;
const familyTypes = [
  "Flow.flowFamily",
  "Flow.segment",
  "FlowSegment.sourceElement",
  "FlowSegment.targetElement",
] as const;
function reverseArrays(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item: unknown) => reverseArrays(item)).reverse();
  if (typeof input === "object" && input !== null)
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, reverseArrays(v)]));
  return input;
}
function freeze(input: unknown): void {
  if (typeof input !== "object" || input === null) return;
  for (const child of Object.values(input)) freeze(child);
  Object.freeze(input);
}

describe("Graph Engine v0.1", () => {
  it.each(entityCases)("projects %s with minimal node and pair identity", (type, id) => {
    const g = graph();
    const node = value(g.getNode(type, id));
    expect(node).toEqual({ entityType: type, entityId: id, key: JSON.stringify([type, id]) });
    expect(value(g.getEntity(node.key)).id).toBe(id);
    expect(g.getNodesByType(type)).toContainEqual(node);
  });
  it.each(EDGE_TYPES)("projects canonical %s with traceable shared edge", (type) => {
    const g = graph();
    const matching = allEdges(g).filter((edge) => edge.edgeType === type);
    expect(matching.length).toBeGreaterThan(0);
    for (const edge of matching) {
      expect(edge.key).toBe(JSON.stringify([type, edge.source, edge.target]));
      expect(edge.provenance.length).toBeGreaterThan(0);
      for (const p of edge.provenance) {
        const owner = value(g.getEntity(p.entity));
        expect(Object.hasOwn(owner, p.field)).toBe(true);
        expect(p.field).not.toMatch(/\[\d+\]/);
        const fieldValue: unknown = (owner as unknown as Record<string, unknown>)[p.field];
        const referencedId: unknown = (
          JSON.parse(edge.source === p.entity ? edge.target : edge.source) as unknown[]
        )[1];
        if (typeof fieldValue === "string") expect(fieldValue).toBe(referencedId);
        else if (Array.isArray(fieldValue)) {
          expect(
            fieldValue.some(
              (item: unknown) =>
                item === referencedId ||
                (typeof item === "object" &&
                  item !== null &&
                  (("flowId" in item && item.flowId === referencedId) ||
                    ("entityId" in item && item.entityId === referencedId))),
            ),
          ).toBe(true);
        } else throw new Error("Unexpected canonical reference representation");
      }
      expect(value(g.getIncoming(edge.target)).find((e) => e.key === edge.key)).toBe(edge);
      expect(value(g.getOutgoing(edge.source)).find((e) => e.key === edge.key)).toBe(edge);
    }
  });
  it("does not create containment edges from Architecture", () => {
    const g = graph();
    expect(value(g.getOutgoing(key(g, "Architecture", fixture.architecture.id)))).toEqual([]);
  });
  it("preserves opaque identifiers including separators and quotes", () => {
    const input = structuredClone(fixture);
    input.architecture.id = 'scope:["|\\';
    input.architecture.decisionReferences[0]!.affectedObjects[0]!.entityId = input.architecture.id;
    const g = graph(architecture(input));
    expect(value(g.getNode("Architecture", input.architecture.id)).key).toBe(
      JSON.stringify(["Architecture", input.architecture.id]),
    );
  });
  it("keeps initiates and uses but deduplicates neighbor", () => {
    const g = graph();
    const n = value(
      g.getNeighbors(key(g, "Process", "process-1"), {
        edgeTypes: ["Process.initiatesFlow", "Process.usesFlow"],
      }),
    );
    expect(n.nodes).toHaveLength(1);
    expect(n.edges).toHaveLength(2);
  });
  it("deduplicates repeated canonical references", () => {
    const input = structuredClone(fixture);
    input.architecture.processes[0]!.flowReferences.push({ flowId: "flow-1", kind: "uses" });
    input.architecture.roles[0]!.positionIds.push("position-1");
    expect(allEdges(graph(architecture(input)))).toEqual(allEdges(graph()));
  });
  it("represents Relationship via source node, relationship node, target node", () => {
    const g = graph();
    const p = value(
      g.findPath(key(g, "Element", "entry"), key(g, "Element", "middle"), {
        maxDepth: 2,
        edgeTypes: relationshipTypes,
      }),
    );
    expect(p.status).toBe("found");
    if (p.status === "found")
      expect(p.nodes.map((n) => n.entityType)).toEqual(["Element", "Relationship", "Element"]);
    expect(
      allEdges(g).some(
        (e) => e.source === key(g, "Element", "entry") && e.target === key(g, "Element", "middle"),
      ),
    ).toBe(false);
  });
  it("merges only approved Flow membership evidence into one edge", () => {
    const g = graph();
    const edges = value(g.getOutgoing(key(g, "Flow", "flow-1"), { edgeTypes: ["Flow.segment"] }));
    expect(edges).toHaveLength(2);
    expect(edges[0]!.provenance.map((p) => p.field).sort()).toEqual(["flowId", "flowSegmentIds"]);
  });
  it("orders segments by sequence, not collection or composition order", () => {
    const input = structuredClone(fixture);
    input.architecture.flowSegments.reverse();
    input.architecture.flows[0]!.flowSegmentIds.reverse();
    const g = graph(architecture(input));
    expect(value(g.getFlowSegments(key(g, "Flow", "flow-1"))).map((s) => s.sequence)).toEqual([
      1, 2,
    ]);
  });
  it("reaches Elements from FlowFamily through intermediaries without shortcuts", () => {
    const g = graph();
    const family = key(g, "FlowFamily", "family-1");
    const t = value(
      g.traverse(family, {
        direction: "both",
        maxDepth: 3,
        edgeTypes: familyTypes,
        resultEntityTypes: ["Element"],
      }),
    );
    expect(t.nodes.map((n) => n.entityId).sort()).toEqual(["end", "entry", "middle"]);
    expect(t.visits.every((v) => v.depth === 3)).toBe(true);
    expect(value(g.getOutgoing(family))).toEqual([]);
    expect(value(g.getEntity(family))).toEqual(architecture().flowFamilies![0]);
  });
  it("reaches capability context including canonical incoming Responsibility", () => {
    const g = graph();
    const n = value(
      g.getNeighbors(key(g, "BusinessCapability", "capability-1"), { direction: "both" }),
    );
    expect(n.nodes.map((n) => n.entityType).sort()).toEqual([
      "DecisionReference",
      "FlowFamily",
      "Process",
      "Responsibility",
      "Role",
    ]);
  });
  it("keeps logical and implementation actual routes distinct", () => {
    const g = graph();
    const rule = key(g, "BusinessRule", "rule-1");
    expect(
      value(g.getOutgoing(rule, { edgeTypes: ["BusinessRule.logicalLayer"] }))[0]!.target,
    ).toBe(key(g, "Layer", "policy"));
    const p = value(
      g.findPath(rule, key(g, "Layer", "core"), {
        direction: "both",
        maxDepth: 2,
        edgeTypes: ["RuleImplementation.businessRule", "RuleImplementation.actualLayer"],
      }),
    );
    expect(p.status).toBe("found");
    if (p.status === "found")
      expect(p.steps.map((s) => s.direction)).toEqual(["inverse", "forward"]);
  });
  it("keeps Role Position Responsibility distinct", () => {
    const g = graph();
    expect(
      new Set([
        key(g, "Role", "role-1"),
        key(g, "Position", "position-1"),
        key(g, "Responsibility", "responsibility-1"),
      ]).size,
    ).toBe(3);
  });
  it("DecisionReference connects typed targets including Architecture", () => {
    const g = graph();
    const edges = value(g.getOutgoing(key(g, "DecisionReference", "decision-1")));
    expect(edges).toHaveLength(6);
    expect(edges.some((e) => e.target === key(g, "Architecture", fixture.architecture.id))).toBe(
      true,
    );
  });
  it("separates exact Layer positioning roles", () => {
    const g = graph();
    const core = key(g, "Layer", "core");
    expect(value(g.getNodesByLayer(core, "DIRECT")).map((n) => n.entityType)).toEqual(["Element"]);
    expect(value(g.getNodesByLayer(core, "ACTUAL")).map((n) => n.entityType)).toEqual([
      "RuleImplementation",
    ]);
    expect(value(g.getNodesByLayer(core, "LOGICAL"))).toEqual([]);
    expect(
      value(g.getNodesByLayer(key(g, "Layer", "policy"), "LOGICAL")).map((n) => n.entityType),
    ).toEqual(["BusinessRule"]);
  });
  it("derives APS inheritance without APS nodes or mutation", () => {
    const a = architecture();
    const before = structuredClone(a);
    const g = graph(a);
    expect(
      g
        .getLayersByApsLayer("GOVERNANCE_POLICIES_DECISIONS")
        .map((n) => n.entityId)
        .sort(),
    ).toEqual(["governance", "policy"]);
    expect(
      g.getNodesByApsLayer("GOVERNANCE_POLICIES_DECISIONS", "LOGICAL").map((n) => n.entityType),
    ).toEqual(["BusinessRule"]);
    expect(g.getNodesByApsLayer("CORE", "DIRECT").map((n) => n.entityId)).toEqual(["entry"]);
    expect(g.getNodesByApsLayer("CORE", "ACTUAL").map((n) => n.entityId)).toEqual([
      "implementation-1",
    ]);
    expect(a).toEqual(before);
    expect(g.getNodesByType("ApsLayer" as EntityKind)).toEqual([]);
  });
  it("indexes only declared ArchitectureLevel and creates no extra node", () => {
    const g = graph();
    expect(g.getNodesByArchitectureLevel("APPLICATION").map((n) => n.entityId)).toEqual(["entry"]);
    expect(g.getNodesByArchitectureLevel("TECHNOLOGY", "ACTUAL").map((n) => n.entityId)).toEqual([
      "implementation-1",
    ]);
    expect(g.getNodesByArchitectureLevel("BUSINESS")).toEqual([]);
    expect(g.getNodesByType("ArchitectureLevel" as EntityKind)).toEqual([]);
  });
  it.each(["outgoing", "incoming", "both"] as const)("respects %s orientation", (direction) => {
    const g = graph();
    const flow = key(g, "Flow", "flow-1");
    const n = value(g.getNeighbors(flow, { direction }));
    for (const s of n.steps) {
      expect(s.from).toBe(flow);
      expect(s.direction).toBe(s.edge.source === flow ? "forward" : "inverse");
    }
    if (direction !== "both")
      expect(
        n.steps.every((s) => s.direction === (direction === "outgoing" ? "forward" : "inverse")),
      ).toBe(true);
  });
  it("maxDepth zero does not expand and start can be excluded", () => {
    const g = graph();
    const start = key(g, "Flow", "flow-1");
    expect(value(g.traverse(start, { maxDepth: 0 })).steps).toEqual([]);
    expect(value(g.traverse(start, { maxDepth: 0, includeStart: false })).nodes).toEqual([]);
  });
  it("BFS is bounded cycle-safe and records minimum depths", () => {
    const g = graph();
    const start = key(g, "Flow", "flow-1");
    const t = value(g.traverse(start, { direction: "both", maxDepth: 100 }));
    expect(new Set(t.nodes.map((n) => n.key)).size).toBe(t.nodes.length);
    expect(t.steps.length).toBeLessThanOrEqual(allEdges(g).length * 2);
    expect(t.visits.find((v) => v.node.entityId === "family-1")!.depth).toBe(1);
    expect(
      value(g.traverse(start, { direction: "both", maxDepth: 1 })).visits.every(
        (v) => v.depth <= 1,
      ),
    ).toBe(true);
  });
  it("expansion filter stops intermediaries without changing result filter", () => {
    const g = graph();
    expect(
      value(
        g.traverse(key(g, "FlowFamily", "family-1"), {
          direction: "both",
          maxDepth: 3,
          edgeTypes: familyTypes,
          resultEntityTypes: ["Element"],
          expansionEntityTypes: ["FlowSegment"],
        }),
      ).nodes,
    ).toEqual([]);
  });
  it.each([-1, 0.5, NaN, Infinity, -Infinity])("rejects invalid depth %s", (maxDepth) => {
    const g = graph();
    expect(g.traverse(key(g, "Flow", "flow-1"), { maxDepth })).toMatchObject({
      success: false,
      error: { code: "INVALID_PARAMETERS" },
    });
  });
  it("rejects missing depth and invalid filters/direction", () => {
    const g = graph();
    const start = key(g, "Flow", "flow-1");
    for (const options of [
      {},
      { maxDepth: 1, direction: "sideways" },
      { maxDepth: 1, edgeTypes: ["unknown"] },
      { maxDepth: 1, resultEntityTypes: ["unknown"] },
      { maxDepth: 1, expansionEntityTypes: ["unknown"] },
      { maxDepth: 1, includeStart: 1 },
    ])
      expect(g.traverse(start, options as TraversalOptions)).toMatchObject({
        success: false,
        error: { code: "INVALID_PARAMETERS" },
      });
  });
  it("shortest path returns zero hops for same node", () => {
    const g = graph();
    const start = key(g, "Flow", "flow-1");
    expect(value(g.findPath(start, start, { maxDepth: 0 }))).toMatchObject({
      status: "found",
      nodes: [value(g.getNode("Flow", "flow-1"))],
      edges: [],
      steps: [],
    });
  });
  it("distinguishes exhausted disconnected search from depth-limited search", () => {
    const g = graph();
    expect(
      value(
        g.findPath(key(g, "Architecture", fixture.architecture.id), key(g, "Element", "entry"), {
          maxDepth: 10,
        }),
      ),
    ).toEqual({ status: "not-found" });
    expect(
      value(
        g.findPath(key(g, "Element", "entry"), key(g, "Element", "middle"), {
          maxDepth: 1,
          edgeTypes: relationshipTypes,
        }),
      ),
    ).toEqual({ status: "depth-limit-reached" });
  });
  it("path tie-breaking and all navigation are stable under array reordering", () => {
    const loaded = loadArchitectureFromJson(JSON.stringify(reverseArrays(fixture)));
    if (!loaded.success) throw new Error(JSON.stringify(loaded));
    const a = graph();
    const b = graph(loaded.architecture);
    expect(allEdges(b)).toEqual(allEdges(a));
    const start = key(a, "Process", "process-1");
    const target = key(a, "Flow", "flow-1");
    expect(b.findPath(start, target, { maxDepth: 4, direction: "both" })).toEqual(
      a.findPath(start, target, { maxDepth: 4, direction: "both" }),
    );
    expect(b.traverse(start, { maxDepth: 4, direction: "both" })).toEqual(
      a.traverse(start, { maxDepth: 4, direction: "both" }),
    );
    expect(b.getContext(start, { maxDepth: 2, direction: "both" })).toEqual(
      a.getContext(start, { maxDepth: 2, direction: "both" }),
    );
  });
  it("context is bounded induced subgraph with depths, not Architecture", () => {
    const g = graph();
    const c = value(g.getContext(key(g, "Flow", "flow-1"), { maxDepth: 1, direction: "both" }));
    const keys = new Set(c.nodes.map((n) => n.key));
    expect(c.visits.every((v) => v.depth <= 1)).toBe(true);
    expect(c.edges.every((e) => keys.has(e.source) && keys.has(e.target))).toBe(true);
    expect(c.edges.map((e) => e.key).sort()).toEqual(
      allEdges(g)
        .filter((e) => keys.has(e.source) && keys.has(e.target))
        .map((e) => e.key)
        .sort(),
    );
    expect(Object.keys(c).sort()).toEqual(["edges", "focus", "nodes", "visits"]);
  });
  it("context preserves focus but never adds excluded external endpoints", () => {
    const g = graph();
    const c = value(
      g.getContext(key(g, "FlowFamily", "family-1"), {
        maxDepth: 3,
        direction: "both",
        edgeTypes: familyTypes,
        resultEntityTypes: ["Element"],
      }),
    );
    expect(c.nodes.map((n) => n.entityType).sort()).toEqual([
      "Element",
      "Element",
      "Element",
      "FlowFamily",
    ]);
    expect(c.edges).toEqual([]);
    expect(c.focus.entityType).toBe("FlowFamily");
  });
  it("four canonical relations each produce one edge and ignore inverse views", () => {
    const g = graph();
    for (const t of [
      "Responsibility.businessCapability",
      "Responsibility.process",
      "BusinessRule.process",
      "BusinessRule.responsibility",
    ] as const)
      expect(allEdges(g).filter((e) => e.edgeType === t)).toHaveLength(1);
    const a = architecture();
    const changed: Architecture = {
      ...a,
      responsibilities: a.responsibilities!.map((r) => ({
        ...r,
        businessCapabilityIds: [],
        processIds: [],
      })),
      businessRules: a.businessRules!.map((r) => ({ ...r, processIds: [], responsibilityIds: [] })),
    };
    const reduced = graph(changed);
    for (const t of [
      "Responsibility.businessCapability",
      "Responsibility.process",
      "BusinessRule.process",
      "BusinessRule.responsibility",
    ] as const)
      expect(allEdges(reduced).filter((e) => e.edgeType === t)).toEqual([]);
  });
  it("does not mutate even deeply frozen input", () => {
    const a = architecture();
    const before = structuredClone(a);
    freeze(a);
    const g = graph(a);
    value(g.traverse(key(g, "Flow", "flow-1"), { maxDepth: 3, direction: "both" }));
    expect(a).toEqual(before);
  });
  it("external changes require rebuilding and cannot alter existing snapshot", () => {
    const a = architecture();
    const g = graph(a);
    const start = key(g, "Process", "process-1");
    const before = g.getOutgoing(start);
    Object.assign(a.processes![0]!, { flowReferences: [], name: "Changed" });
    expect(g.getOutgoing(start)).toEqual(before);
    expect(value(g.getEntity(start))).toMatchObject({ name: "Example Process" });
    expect(graph(a).getOutgoing(start)).not.toEqual(before);
  });
  it("returned entities segments and arrays cannot mutate private state", () => {
    const g = graph();
    const start = key(g, "Flow", "flow-1");
    const entity = value(g.getEntity(start));
    Object.assign(entity, { name: "Changed" });
    const segments = value(g.getFlowSegments(start));
    Object.assign(segments[0]!, { sequence: 100 });
    expect(value(g.getFlowSegments(start))[0]!.sequence).toBe(1);
    expect(value(g.getEntity(start))).toMatchObject({ name: "Example Flow" });
    const nodes = g.getNodesByType("Element");
    (nodes as unknown[]).pop();
    expect(g.getNodesByType("Element")).toHaveLength(3);
    const edge = value(g.getOutgoing(start))[0]!;
    expect(Object.isFrozen(edge)).toBe(true);
    expect(Object.isFrozen(edge.provenance)).toBe(true);
    expect(Object.isFrozen(edge.provenance[0])).toBe(true);
  });
  it("rejects invalid Architecture with original validator errors before projection", () => {
    const a = architecture();
    Object.assign(a.elements![0]!, { layerId: "missing" });
    const expected = validateArchitecture(a);
    expect(createGraph(a)).toMatchObject({
      success: false,
      error: { code: "INVALID_ARCHITECTURE", errors: expected.errors },
    });
  });
  it("distinguishes nonexistent node from isolated node", () => {
    const g = graph();
    expect(g.getNeighbors("missing")).toMatchObject({
      success: false,
      error: { code: "NODE_NOT_FOUND" },
    });
    expect(value(g.getNeighbors(key(g, "Architecture", fixture.architecture.id)))).toEqual({
      nodes: [],
      edges: [],
      steps: [],
    });
    expect(g.getFlowSegments(key(g, "Element", "entry"))).toMatchObject({
      success: false,
      error: { code: "INVALID_PARAMETERS" },
    });
  });
  it("same validated snapshot produces identical logical graph", () => {
    const a = architecture();
    expect(allEdges(graph(a))).toEqual(allEdges(graph(a)));
  });
  it("rejects context without explicit direction", () => {
    const g = graph();
    expect(g.getContext(key(g, "Flow", "flow-1"), { maxDepth: 1 } as never)).toMatchObject({
      success: false,
      error: { code: "INVALID_PARAMETERS" },
    });
  });
  it("reports snapshot clone failures without producing a partial graph", () => {
    const a = architecture();
    Object.assign(a, { metadata: { unsupported: () => undefined } });
    expect(createGraph(a)).toMatchObject({ success: false, error: { code: "INTERNAL_ERROR" } });
  });
  it("exposes connectivity only: no ADN analysis visualization or update API", () => {
    const g = graph();
    expect(Object.keys(g).sort()).toEqual(
      [
        "findPath",
        "getContext",
        "getEntity",
        "getFlowSegments",
        "getIncoming",
        "getLayersByApsLayer",
        "getNeighbors",
        "getNode",
        "getNodesByApsLayer",
        "getNodesByArchitectureLevel",
        "getNodesByLayer",
        "getNodesByType",
        "getOutgoing",
        "traverse",
      ].sort(),
    );
    for (const edge of allEdges(g))
      expect(Object.keys(edge).sort()).toEqual([
        "edgeType",
        "key",
        "provenance",
        "source",
        "target",
      ]);
  });
});
