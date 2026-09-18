import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };
import {
  APS_LAYERS,
  createGraph,
  createVisualization,
  getInformationDescriptor,
  loadArchitectureFromJson,
  VISUALIZATION_RULES_VERSION,
} from "../src/index.js";
import type {
  EntityKind,
  EntityReference,
  ViewState,
  ViewType,
  VisualizationProjection,
  VisualizationResult,
  VisualizationView,
} from "../src/index.js";

const ref = (entityType: EntityKind, entityId: string): EntityReference => ({
  entityType,
  entityId,
});
const process = ref("Process", "process-1");
const flow = ref("Flow", "flow-1");
const family = ref("FlowFamily", "family-1");
const entry = ref("Element", "entry");
const rule = ref("BusinessRule", "rule-1");
function value<T>(result: VisualizationResult<T>): T {
  if (!result.success) throw new Error(JSON.stringify(result.error));
  return result.value;
}
function setup(input = fixture) {
  const loaded = loadArchitectureFromJson(JSON.stringify(input));
  if (!loaded.success) throw new Error(JSON.stringify(loaded));
  const created = createGraph(loaded.architecture);
  if (!created.success) throw new Error(JSON.stringify(created));
  return { graph: created.value, architecture: loaded.architecture };
}
function project(state: Partial<ViewState> = {}, g = setup().graph): VisualizationProjection {
  return value(createVisualization(g, { viewId: "test view", viewType: "FULL_MAP", ...state }));
}
function node(view: VisualizationView, id: string) {
  const found = view.nodes.find((n) => n.entityId === id);
  if (!found) throw new Error(`Node absent: ${id}`);
  return found;
}
function visible(view: VisualizationView) {
  return view.nodes.filter((n) => n.visibility === "VISIBLE");
}
function freeze(input: unknown): void {
  if (typeof input !== "object" || input === null) return;
  for (const child of Object.values(input)) freeze(child);
  Object.freeze(input);
}
function reverse(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((v: unknown) => reverse(v)).reverse();
  if (typeof input === "object" && input !== null)
    return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, reverse(v)]));
  return input;
}
const views: readonly (readonly [ViewType, EntityReference | undefined])[] = [
  ["FULL_MAP", undefined],
  ["FOCUS", process],
  ["FLOW", flow],
  ["FLOW_FAMILY", family],
];
const kinds: readonly (readonly [EntityKind, string])[] = [
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

describe("Visualization Model v0.1", () => {
  it.each(views)("builds %s using one projection contract", (viewType, focus) => {
    const { view } = project({ viewType, ...(focus ? { focus } : {}) });
    expect(view.viewType).toBe(viewType);
    expect(
      Object.keys(view)
        .filter((k) => k !== "focus")
        .sort(),
    ).toEqual(
      [
        "viewId",
        "viewType",
        "architectureRef",
        "nodes",
        "edges",
        "routes",
        "activeFilters",
        "selectionContext",
        "semanticFrame",
        "projectionMetadata",
      ].sort(),
    );
    expect(view.architectureRef).toEqual(ref("Architecture", fixture.architecture.id));
  });
  it.each(kinds)("projects %s without copying Domain Entity", (kind, id) => {
    const { view } = project();
    const n = node(view, id);
    expect(n.entityType).toBe(kind);
    expect(n.key).toBe(n.graphNodeKey);
    expect(Object.keys(n).sort()).toEqual(
      [
        "key",
        "graphNodeKey",
        "entityType",
        "entityId",
        "label",
        "exposure",
        "visibility",
        "emphasis",
        "semanticPosition",
        "selected",
        "focused",
        "representationRole",
      ]
        .filter((k) => k !== "label" || n.label !== undefined)
        .sort(),
    );
    expect(n).not.toHaveProperty("entity");
  });
  it.each(views)("%s edges preserve real orientation type and provenance", (viewType, focus) => {
    const { graph: g } = setup();
    const { view } = project({ viewType, ...(focus ? { focus } : {}) }, g);
    for (const e of view.edges) {
      const original = g.getOutgoing(e.sourceVisualNodeKey);
      if (!original.success) throw new Error("Missing source");
      const edge = original.value.find((x) => x.key === e.graphEdgeKey);
      expect(edge).toBeDefined();
      expect(e.targetVisualNodeKey).toBe(edge!.target);
      expect(e.edgeType).toBe(edge!.edgeType);
      expect(e.provenance).toEqual(edge!.provenance);
      expect(view.nodes.some((n) => n.key === e.targetVisualNodeKey)).toBe(true);
    }
  });
  it("keeps focus identity and independent selection", () => {
    const { view, viewState } = project({
      viewType: "FLOW_FAMILY",
      focus: family,
      selection: entry,
    });
    expect(view.focus).toEqual(family);
    expect(view.selectionContext.selection).toEqual(entry);
    expect(node(view, "entry").selected).toBe(true);
    expect(node(view, "family-1").focused).toBe(true);
    expect(viewState.focus).toEqual(family);
  });
  it("clears selection outside recovered context", () => {
    const { view, viewState } = project({
      viewType: "FOCUS",
      focus: entry,
      context: { maxDepth: 0, direction: "both" },
      selection: process,
    });
    expect(view.selectionContext).toEqual({ selectionCleared: true });
    expect(viewState.selection).toBeUndefined();
  });
  it("filters take precedence over selection: no latent selection", () => {
    const { view, viewState } = project({
      selection: entry,
      filters: { entityTypes: ["Process"] },
    });
    expect(viewState.selection).toBeUndefined();
    expect(view.selectionContext.selectionCleared).toBe(true);
    expect(node(view, "entry").selected).toBe(false);
  });
  it("has explicit PRIMARY SECONDARY HIDDEN classifications", () => {
    const { view } = project();
    expect(node(view, "entry").exposure).toBe("PRIMARY");
    expect(node(view, "relationship-1").exposure).toBe("SECONDARY");
    expect(node(view, "core").exposure).toBe("HIDDEN");
  });
  it("expansion reveals SECONDARY without promoting its exposure", () => {
    const { view } = project({ expansions: [entry] });
    expect(node(view, "relationship-1")).toMatchObject({
      exposure: "SECONDARY",
      visibility: "VISIBLE",
    });
  });
  it("selection reveals a valid secondary entity without changing focus", () => {
    const { view } = project({ selection: rule });
    expect(node(view, "rule-1")).toMatchObject({
      exposure: "SECONDARY",
      visibility: "VISIBLE",
      selected: true,
    });
    expect(view.focus).toBeUndefined();
  });
  it.each([process, ref("Role", "role-1"), ref("BusinessCapability", "capability-1")])(
    "BUSINESS presentation for $entityType never becomes declared ArchitectureLevel",
    (reference) => {
      const { graph: g, architecture: a } = setup();
      const before = structuredClone(a);
      const { view } = project({}, g);
      expect(node(view, reference.entityId).semanticPosition).toEqual({
        presentationLevel: "BUSINESS",
        provenance: [
          {
            property: "presentationLevel",
            source: "VISUAL_RULE",
            rule: `${reference.entityType}.businessPresentation`,
          },
        ],
        positioningState: "PARTIALLY_POSITIONED",
      });
      expect(a).toEqual(before);
    },
  );
  it("FlowFamily is external context without matrix positioning", () => {
    const { view } = project({ viewType: "FLOW_FAMILY", focus: family });
    expect(node(view, "family-1")).toMatchObject({
      representationRole: "CONTEXT",
      semanticPosition: { positioningState: "NOT_APPLICABLE", provenance: [] },
    });
    expect(node(view, "family-1").semanticPosition.apsLayer).toBeUndefined();
  });
  it("Flow is selectable and has an ordered end-to-end descriptor", () => {
    const { view } = project({ viewType: "FLOW", focus: flow, selection: flow });
    expect(node(view, "flow-1").selected).toBe(true);
    expect(view.routes).toHaveLength(1);
    expect(view.routes[0]!.flow).toEqual(flow);
    expect(view.routes[0]!.segments.map((s) => s.sequence)).toEqual([1, 2]);
    expect(view.routes[0]!.segments[0]!.source).toEqual(entry);
    expect(view.routes[0]!.segments[1]!.target).toEqual(ref("Element", "end"));
    expect(view.routes[0]!.visibility).toBe("VISIBLE");
  });
  it("FlowSegment descriptor preserves membership endpoints payload relationship and real edge references", () => {
    const { graph: g } = setup();
    const { view } = project({ viewType: "FLOW", focus: flow }, g);
    const s = view.routes[0]!.segments[0]!;
    expect(s.flow).toEqual(flow);
    expect(s.reference).toEqual(ref("FlowSegment", "segment-1"));
    expect(s.relationship).toEqual(ref("Relationship", "relationship-1"));
    expect(s.dataObjects).toEqual([ref("DataObject", "request")]);
    const actual = new Set(view.edges.map((e) => e.graphEdgeKey));
    expect(s.graphEdgeKeys.every((k) => actual.has(k))).toBe(true);
  });
  it("FLOW DataObjects are PRIMARY", () => {
    expect(node(project({ viewType: "FLOW", focus: flow }).view, "request")).toMatchObject({
      exposure: "PRIMARY",
      visibility: "VISIBLE",
    });
  });
  it("Process FOCUS direct DataObjects are PRIMARY", () => {
    expect(node(project({ viewType: "FOCUS", focus: process }).view, "request").exposure).toBe(
      "PRIMARY",
    );
  });
  it("other DataObjects remain SECONDARY without invented position", () => {
    expect(node(project().view, "request")).toMatchObject({
      exposure: "SECONDARY",
      visibility: "HIDDEN",
      semanticPosition: { positioningState: "NOT_APPLICABLE" },
    });
  });
  it("Relationship stays secondary and is not replaced with Element to Element shortcut", () => {
    const { view } = project({ expansions: [entry] });
    expect(node(view, "relationship-1").exposure).toBe("SECONDARY");
    const source = node(view, "entry").key;
    const target = node(view, "middle").key;
    expect(
      view.edges.some((e) => e.sourceVisualNodeKey === source && e.targetVisualNodeKey === target),
    ).toBe(false);
    expect(
      view.edges
        .filter((e) => e.edgeType.startsWith("Relationship."))
        .map((e) => e.edgeType)
        .sort(),
    ).toEqual(["Relationship.sourceElement", "Relationship.targetElement"]);
  });
  it("preserves 8x3 semantic frame and declared Element positioning", () => {
    const { view } = project();
    expect(view.semanticFrame).toEqual({
      apsLayers: APS_LAYERS,
      architectureLevels: ["BUSINESS", "APPLICATION", "TECHNOLOGY"],
    });
    expect(node(view, "entry").semanticPosition).toMatchObject({
      apsLayer: "CORE",
      architectureLevel: "APPLICATION",
      positioningRole: "DIRECT",
      positioningState: "POSITIONED",
      layer: ref("Layer", "core"),
    });
    expect(view.nodes.some((n) => ["ApsLayer", "ArchitectureLevel"].includes(n.entityType))).toBe(
      false,
    );
  });
  it("unpositioned Elements remain valid and unpositioned", () => {
    expect(node(project().view, "middle").semanticPosition).toEqual({
      positioningRole: "DIRECT",
      provenance: [],
      positioningState: "UNPOSITIONED",
    });
  });
  it.each(["layer", "level"])("partial Element with only %s is not completed", (property) => {
    const input = structuredClone(fixture);
    if (property === "layer")
      Reflect.deleteProperty(input.architecture.elements[0]!, "architectureLevel");
    else Reflect.deleteProperty(input.architecture.elements[0]!, "layerId");
    const { view } = project({}, setup(input).graph);
    expect(node(view, "entry").semanticPosition.positioningState).toBe("PARTIALLY_POSITIONED");
    expect(
      property === "layer"
        ? node(view, "entry").semanticPosition.architectureLevel
        : node(view, "entry").semanticPosition.apsLayer,
    ).toBeUndefined();
  });
  it("LOGICAL and ACTUAL positions stay distinct without inherited level", () => {
    const { view } = project();
    expect(node(view, "rule-1").semanticPosition).toMatchObject({
      apsLayer: "GOVERNANCE_POLICIES_DECISIONS",
      positioningRole: "LOGICAL",
      positioningState: "PARTIALLY_POSITIONED",
    });
    expect(node(view, "rule-1").semanticPosition.architectureLevel).toBeUndefined();
    expect(node(view, "implementation-1").semanticPosition).toMatchObject({
      apsLayer: "CORE",
      architectureLevel: "TECHNOLOGY",
      positioningRole: "ACTUAL",
    });
  });
  it("does not inherit implementation layer from executors", () => {
    const input = structuredClone(fixture);
    Reflect.deleteProperty(input.architecture.ruleImplementations[0]!, "actualLayerId");
    const { view } = project({}, setup(input).graph);
    expect(node(view, "implementation-1").semanticPosition.apsLayer).toBeUndefined();
    expect(node(view, "implementation-1").semanticPosition.architectureLevel).toBe("TECHNOLOGY");
  });
  it("unclassified Layer does not imply APS", () => {
    const input = structuredClone(fixture);
    Reflect.deleteProperty(input.architecture.layers[2]!, "apsLayer");
    const { view } = project({}, setup(input).graph);
    expect(node(view, "entry").semanticPosition.layer).toEqual(ref("Layer", "core"));
    expect(node(view, "entry").semanticPosition.apsLayer).toBeUndefined();
  });
  const filterCases: readonly (readonly [string, Partial<ViewState>, readonly string[]])[] = [
    ["entityType", { filters: { entityTypes: ["Element"] } }, ["end", "entry", "middle"]],
    ["APS", { filters: { apsLayers: ["CORE"] } }, ["entry"]],
    ["ArchitectureLevel", { filters: { architectureLevels: ["APPLICATION"] } }, ["entry"]],
    [
      "FlowFamily",
      { filters: { flowFamilies: [family], entityTypes: ["Element"] } },
      ["end", "entry", "middle"],
    ],
    ["positioningRole", { filters: { positioningRoles: ["DIRECT"] } }, ["end", "entry", "middle"]],
    ["Layer", { filters: { layers: [ref("Layer", "core")] } }, ["entry"]],
    [
      "elementType",
      { filters: { elementTypes: ["EXAMPLE_COMPONENT"] } },
      ["end", "entry", "middle"],
    ],
    [
      "OR",
      { filters: { entityTypes: ["Element", "Process"] } },
      ["end", "entry", "middle", "process-1"],
    ],
    ["AND", { filters: { entityTypes: ["Element"], apsLayers: ["CORE"] } }, ["entry"]],
  ];
  it.each(filterCases)("filter %s has deterministic visible results", (_name, state, expected) => {
    expect(
      visible(project(state).view)
        .map((n) => n.entityId)
        .sort(),
    ).toEqual(expected);
  });
  it("edge filter preserves graph semantics without forcing hidden endpoints", () => {
    const { view } = project({
      expansions: [process],
      filters: { edgeTypes: ["Process.initiatesFlow", "Process.usesFlow"] },
    });
    const shown = view.edges.filter((e) => e.visibility === "VISIBLE");
    expect(shown.map((e) => e.edgeType).sort()).toEqual([
      "Process.initiatesFlow",
      "Process.usesFlow",
    ]);
    expect(new Set(shown.map((e) => e.targetVisualNodeKey)).size).toBe(1);
  });
  it.each([
    "entityTypes",
    "apsLayers",
    "architectureLevels",
    "flowFamilies",
    "edgeTypes",
    "positioningRoles",
    "layers",
    "elementTypes",
  ] as const)("empty %s selects zero visible results", (field) => {
    const { view } = project({ filters: { [field]: [] } });
    expect(visible(view)).toEqual([]);
    expect(view.edges.some((e) => e.visibility === "VISIBLE")).toBe(false);
  });
  it("declared ArchitectureLevel filter does not treat presentation BUSINESS as domain level", () => {
    expect(visible(project({ filters: { architectureLevels: ["BUSINESS"] } }).view)).toEqual([]);
  });
  it("FOCUS with zero depth recovers only focus", () => {
    const { view } = project({
      viewType: "FOCUS",
      focus: entry,
      context: { maxDepth: 0, direction: "both" },
    });
    expect(view.nodes.map((n) => n.entityId)).toEqual(["entry"]);
  });
  it("FOCUS attenuates explicit unrelated orientation base while preserving visibility", () => {
    const { view } = project({
      viewType: "FOCUS",
      focus: entry,
      context: { maxDepth: 0, direction: "both" },
      orientationBase: [process],
    });
    expect(node(view, "process-1")).toMatchObject({
      visibility: "VISIBLE",
      emphasis: "ATTENUATED",
      exposure: "PRIMARY",
    });
  });
  it("explicit filters can hide orientation base", () => {
    const { view } = project({
      viewType: "FOCUS",
      focus: entry,
      context: { maxDepth: 0, direction: "both" },
      orientationBase: [process],
      filters: { entityTypes: ["Element"] },
    });
    expect(node(view, "process-1")).toMatchObject({ visibility: "HIDDEN", exposure: "HIDDEN" });
  });
  it("direct FOCUS does not enumerate complete Architecture", () => {
    const g = setup().graph;
    const getNodesByType = vi.fn(g.getNodesByType.bind(g));
    project(
      { viewType: "FOCUS", focus: entry, context: { maxDepth: 0, direction: "both" } },
      { ...g, getNodesByType },
    );
    expect(getNodesByType.mock.calls.map((c) => c[0])).toEqual(["Architecture"]);
  });
  it("FLOW adds only route composition and named direct context", () => {
    const { view } = project({ viewType: "FLOW", focus: flow });
    expect(
      view.nodes.some(
        (n) =>
          n.entityType === "Position" ||
          n.entityType === "Responsibility" ||
          n.entityType === "DecisionReference",
      ),
    ).toBe(false);
    expect(view.projectionMetadata.scope).toBe("FLOW_COMPOSITION");
  });
  it("FLOW_FAMILY derives participants via public bounded context", () => {
    const g = setup().graph;
    const getContext = vi.fn(g.getContext.bind(g));
    const { view } = project({ viewType: "FLOW_FAMILY", focus: family }, { ...g, getContext });
    expect(getContext).toHaveBeenCalled();
    expect(
      view.nodes
        .filter((n) => n.entityType === "Element")
        .map((n) => n.entityId)
        .sort(),
    ).toEqual(["end", "entry", "middle"]);
    expect(view.projectionMetadata.context).toMatchObject({ maxDepth: 3, direction: "both" });
  });
  it("hidden endpoints prohibit visible VisualEdges", () => {
    const { view } = project();
    const byKey = new Map(view.nodes.map((n) => [n.key, n]));
    for (const edge of view.edges)
      if (edge.visibility === "VISIBLE") {
        expect(byKey.get(edge.sourceVisualNodeKey)!.visibility).toBe("VISIBLE");
        expect(byKey.get(edge.targetVisualNodeKey)!.visibility).toBe("VISIBLE");
      }
  });
  it("Information descriptor preserves identity relations and decisions", () => {
    const g = setup().graph;
    const { view } = project({ selection: entry }, g);
    const info = value(getInformationDescriptor(g, view, entry));
    expect(info.reference).toEqual(entry);
    expect(info.label).toBe("Entry Component");
    expect(info.selected).toBe(true);
    expect(info.decisions).toEqual([ref("DecisionReference", "decision-1")]);
    expect(info.specific).toEqual({ elementType: "EXAMPLE_COMPONENT" });
    expect(info.relations.length).toBeGreaterThan(0);
  });
  it("BusinessRule information separates logical from actual implementation positioning", () => {
    const g = setup().graph;
    const info = value(getInformationDescriptor(g, project({}, g).view, rule));
    expect(info.semanticPosition.positioningRole).toBe("LOGICAL");
    expect(info.implementations).toHaveLength(1);
    expect(info.implementations[0]!.semanticPosition).toMatchObject({
      positioningRole: "ACTUAL",
      apsLayer: "CORE",
    });
  });
  it("Flow information preserves full route and sequence", () => {
    const g = setup().graph;
    const info = value(getInformationDescriptor(g, project({}, g).view, flow));
    expect(info.route!.segments.map((s) => s.sequence)).toEqual([1, 2]);
  });
  it("descriptor does not invent missing names", () => {
    const g = setup().graph;
    expect(
      value(getInformationDescriptor(g, project({}, g).view, ref("Relationship", "relationship-1")))
        .label,
    ).toBeUndefined();
  });
  it.each(views)("%s is deterministic for same graph and View State", (viewType, focus) => {
    const g = setup().graph;
    const state = { viewType, ...(focus ? { focus } : {}) };
    expect(project(state, g)).toEqual(project(state, g));
  });
  it("array reordering duplicate references and filter ordering do not change projection", () => {
    const loaded = loadArchitectureFromJson(JSON.stringify(reverse(fixture)));
    if (!loaded.success) throw new Error("Invalid fixture");
    const created = createGraph(loaded.architecture);
    if (!created.success) throw new Error("Invalid graph");
    expect(project({ filters: { entityTypes: ["Process", "Element"] } })).toEqual(
      project({ filters: { entityTypes: ["Element", "Process", "Element"] } }, created.value),
    );
  });
  it("Flow composition array order never replaces sequence", () => {
    const input = structuredClone(fixture);
    input.architecture.flowSegments.reverse();
    input.architecture.flows[0]!.flowSegmentIds.reverse();
    expect(project({ viewType: "FLOW", focus: flow }, setup(input).graph)).toEqual(
      project({ viewType: "FLOW", focus: flow }),
    );
  });
  it("viewId is supplied and rules version distinct metadata", () => {
    const { view } = project({ viewId: "caller supplied" });
    expect(view.viewId).toBe("caller supplied");
    expect(view.projectionMetadata.rulesVersion).toBe(VISUALIZATION_RULES_VERSION);
    expect(view.projectionMetadata).not.toHaveProperty("schemaVersion");
  });
  it("does not mutate frozen Domain Model Graph or View State", () => {
    const { graph: g, architecture: a } = setup();
    const state: ViewState = {
      viewId: "immutable",
      viewType: "FOCUS",
      focus: process,
      selection: entry,
      orientationBase: [ref("Element", "end")],
      filters: { entityTypes: ["Element", "Process"] },
    };
    const before = structuredClone(state);
    const original = structuredClone(a);
    freeze(state);
    freeze(a);
    const outgoing = g.getOutgoing(g.getNodesByType("Process")[0]!.key);
    value(createVisualization(g, state));
    expect(state).toEqual(before);
    expect(a).toEqual(original);
    expect(g.getOutgoing(g.getNodesByType("Process")[0]!.key)).toEqual(outgoing);
  });
  it("returned projection can be edited without altering later results", () => {
    const g = setup().graph;
    const first = project({}, g);
    Object.assign(first.view.nodes[0]!, { label: "Edited" });
    expect(project({}, g)).not.toEqual(first);
  });
  it("activeRoute enriches a view without changing focus", () => {
    const { view } = project({ viewType: "FOCUS", focus: process, activeRoute: flow });
    expect(view.focus).toEqual(process);
    expect(view.routes[0]!.flow).toEqual(flow);
  });
  it("expansions expose one canonical neighborhood without creating edges", () => {
    const { view } = project({ expansions: [ref("Role", "role-1")] });
    expect(node(view, "position-1").visibility).toBe("VISIBLE");
    expect(
      view.edges.some((e) => e.edgeType === "Role.position" && e.visibility === "VISIBLE"),
    ).toBe(true);
  });
  it("output contains no rendering analysis or dataset-specific contracts", () => {
    const { view } = project({ viewType: "FLOW", focus: flow });
    const keys: string[] = [];
    function inspect(x: unknown): void {
      if (Array.isArray(x)) {
        for (const item of x as unknown[]) inspect(item);
      } else if (typeof x === "object" && x !== null)
        for (const [k, v] of Object.entries(x)) {
          keys.push(k);
          inspect(v);
        }
    }
    inspect(view);
    expect(
      keys.some((k) =>
        [
          "x",
          "y",
          "color",
          "opacity",
          "shape",
          "layout",
          "style",
          "gap",
          "risk",
          "score",
          "lem",
          "adn",
        ].includes(k),
      ),
    ).toBe(false);
  });
  it("FOCUS on Flow preserves complete end-to-end composition", () => {
    const { view } = project({
      viewType: "FOCUS",
      focus: flow,
      context: { maxDepth: 0, direction: "both" },
    });
    expect(view.routes[0]!.segments.map((s) => s.sequence)).toEqual([1, 2]);
    expect(node(view, "end").entityType).toBe("Element");
    expect(node(view, "end").depth).toBeUndefined();
  });
  it("context edge/type restrictions reach terminal results without generic expansion", () => {
    const { view } = project({
      viewType: "FOCUS",
      focus: process,
      context: {
        maxDepth: 4,
        direction: "outgoing",
        edgeTypes: ["Process.usesFlow", "Flow.segment"],
        expansionEntityTypes: [],
      },
    });
    expect(view.nodes.map((n) => n.entityType).sort()).toEqual(["Flow", "Process"]);
  });
  it("reference normalization removes payload and duplicate orientation entries", () => {
    const state: ViewState = {
      viewId: "references",
      viewType: "FOCUS",
      focus: { ...process, name: "Not authoritative" } as EntityReference,
      orientationBase: [entry, entry],
      context: { maxDepth: 0, direction: "both" },
    };
    const result = value(createVisualization(setup().graph, state));
    expect(result.view.focus).toEqual(process);
    expect(result.viewState.orientationBase).toEqual([entry]);
    expect(node(result.view, "process-1").label).toBe("Example Process");
  });
  it("Graph query failures retain cause without returning partial visualization", () => {
    const g = setup().graph;
    expect(
      createVisualization(
        {
          ...g,
          getContext: () => ({
            success: false,
            error: { code: "NODE_NOT_FOUND", message: "Graph query failed" },
          }),
        },
        { viewId: "failed", viewType: "FOCUS", focus: process },
      ),
    ).toEqual({
      success: false,
      error: {
        code: "GRAPH_ERROR",
        message: "Graph query failed",
        graphError: { code: "NODE_NOT_FOUND", message: "Graph query failed" },
      },
    });
  });
  it("a foreign active route cannot override FLOW_FAMILY membership", () => {
    const input = structuredClone(fixture);
    input.architecture.flowFamilies.push({ id: "other-family", name: "Other Family" });
    const g = setup(input).graph;
    expect(
      createVisualization(g, {
        viewId: "conflict",
        viewType: "FLOW_FAMILY",
        focus: ref("FlowFamily", "other-family"),
        activeRoute: flow,
      }),
    ).toMatchObject({ success: false, error: { code: "INVALID_ACTIVE_ROUTE" } });
  });
  it("a different active route cannot override focal Flow", () => {
    const input = structuredClone(fixture);
    const otherFlow = structuredClone(input.architecture.flows[0]!);
    otherFlow.id = "other-flow";
    otherFlow.flowSegmentIds = ["other-segment-1", "other-segment-2"];
    input.architecture.flows.push(otherFlow);
    for (const segment of fixture.architecture.flowSegments)
      input.architecture.flowSegments.push({
        ...segment,
        id: `other-${segment.id}`,
        flowId: "other-flow",
      });
    expect(
      createVisualization(setup(input).graph, {
        viewId: "conflict",
        viewType: "FLOW",
        focus: flow,
        activeRoute: ref("Flow", "other-flow"),
      }),
    ).toMatchObject({ success: false, error: { code: "INVALID_ACTIVE_ROUTE" } });
  });
  const errors: readonly (readonly [string, Partial<ViewState>, string])[] = [
    ["missing focus", { viewType: "FOCUS" }, "FOCUS_REQUIRED"],
    ["missing Flow focus", { viewType: "FLOW" }, "FOCUS_REQUIRED"],
    ["wrong Flow focus", { viewType: "FLOW", focus: entry }, "INVALID_FOCUS_TYPE"],
    ["wrong family focus", { viewType: "FLOW_FAMILY", focus: flow }, "INVALID_FOCUS_TYPE"],
    ["missing entity", { viewType: "FOCUS", focus: ref("Element", "absent") }, "FOCUS_NOT_FOUND"],
    ["missing selection", { selection: ref("Element", "absent") }, "INVALID_SELECTION"],
    ["viewType", { viewType: "OTHER" as ViewType }, "INVALID_VIEW_TYPE"],
    ["viewId", { viewId: "" }, "INVALID_PARAMETERS"],
    ["bad APS", { filters: { apsLayers: ["INVALID" as never] } }, "INVALID_FILTERS"],
    ["bad Layer", { filters: { layers: [entry] } }, "INVALID_FILTERS"],
    ["unknown filter", { filters: { other: [] } as never }, "INVALID_FILTERS"],
    [
      "negative depth",
      { viewType: "FOCUS", focus: process, context: { maxDepth: -1, direction: "both" } },
      "INVALID_CONTEXT",
    ],
    [
      "fractional depth",
      { viewType: "FOCUS", focus: process, context: { maxDepth: 0.5, direction: "both" } },
      "INVALID_CONTEXT",
    ],
    [
      "infinite depth",
      { viewType: "FOCUS", focus: process, context: { maxDepth: Infinity, direction: "both" } },
      "INVALID_CONTEXT",
    ],
    [
      "context wrong perspective",
      { context: { maxDepth: 1, direction: "both" } },
      "INVALID_CONTEXT",
    ],
    ["bad activeRoute", { activeRoute: entry }, "INVALID_ACTIVE_ROUTE"],
    [
      "unrecovered expansion",
      {
        viewType: "FOCUS",
        focus: entry,
        context: { maxDepth: 0, direction: "both" },
        expansions: [process],
      },
      "INVALID_REFERENCE",
    ],
  ];
  it.each(errors)("rejects %s explicitly", (_name, state, code) => {
    expect(
      createVisualization(setup().graph, { viewId: "errors", viewType: "FULL_MAP", ...state }),
    ).toMatchObject({ success: false, error: { code } });
  });
});
