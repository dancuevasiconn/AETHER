import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };
import {
  createGraph,
  createVisualization,
  DEFAULT_RENDERER_CONFIGURATION,
  getInformationDescriptor,
  layoutVisualization,
  loadArchitectureFromJson,
} from "../src/index.js";
import type {
  EntityKind,
  EntityReference,
  RenderScene,
  ViewState,
  VisualizationView,
} from "../src/index.js";
import { App } from "../src/ui/App.js";
import { InformationCard } from "../src/ui/InformationCard.js";

const reference = (entityType: EntityKind, entityId: string): EntityReference => ({
  entityType,
  entityId,
});
const process = reference("Process", "process-1");
const flow = reference("Flow", "flow-1");
const family = reference("FlowFamily", "family-1");
const entry = reference("Element", "entry");

function graph() {
  const loaded = loadArchitectureFromJson(JSON.stringify(fixture));
  if (!loaded.success) throw new Error(JSON.stringify(loaded));
  const created = createGraph(loaded.architecture);
  if (!created.success) throw new Error(JSON.stringify(created));
  return created.value;
}

function view(state: Partial<ViewState> = {}): VisualizationView {
  const projected = createVisualization(graph(), {
    viewId: "engine-test",
    viewType: "FULL_MAP",
    ...state,
  });
  if (!projected.success) throw new Error(JSON.stringify(projected.error));
  return projected.value.view;
}

function scene(state: Partial<ViewState> = {}): RenderScene {
  return layoutVisualization(view(state));
}

function rendered(result: RenderScene, id: string) {
  const found = result.nodes.find((node) => node.entityId === id);
  if (!found) throw new Error(`Rendered node absent: ${id}`);
  return found;
}

describe("Visualization Engine v0.1 layout contract", () => {
  it("FULL_MAP preserves the configured APS matrix and empty cells", () => {
    const result = scene();
    expect(result.columns).toHaveLength(8);
    expect(result.levels.map((level) => level.id)).toEqual([
      "BUSINESS",
      "APPLICATION",
      "TECHNOLOGY",
    ]);
    expect(result.regions.filter((region) => region.kind === "CELL")).toHaveLength(24);
  });

  it("derives APS columns from the renderer configuration", () => {
    expect(DEFAULT_RENDERER_CONFIGURATION.columns).toHaveLength(8);
    expect(DEFAULT_RENDERER_CONFIGURATION.columns?.map((column) => column.id)).toEqual(
      view().semanticFrame.apsLayers,
    );
  });

  it("is not structurally coupled to eight columns", () => {
    const result = layoutVisualization(view(), {
      columns: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
    });
    expect(result.columns).toHaveLength(2);
    expect(result.regions.filter((region) => region.kind === "CELL")).toHaveLength(6);
  });

  it.each([
    ["FULL_MAP", undefined],
    ["FOCUS", process],
    ["FLOW", flow],
    ["FLOW_FAMILY", family],
  ] as const)("lays out %s from VisualizationView alone", (viewType, focus) => {
    expect(scene({ viewType, ...(focus ? { focus } : {}) }).nodes.length).toBeGreaterThan(0);
  });

  it("keeps FlowFamily outside the main canvas", () => {
    expect(scene({ viewType: "FLOW_FAMILY", focus: family }).nodes).not.toContainEqual(
      expect.objectContaining({ entityId: "family-1" }),
    );
  });

  it("uses semantic positions without inventing domain classification", () => {
    const result = scene();
    expect(rendered(result, "entry").regionKey).toBe("cell:CORE:APPLICATION");
    expect(rendered(result, "process-1").regionKey).toBe("level:BUSINESS");
    expect(rendered(result, "middle").regionKey).toBe("unpositioned");
  });

  it.each([
    ["process-1", {}],
    ["role-1", { selection: reference("Role", "role-1") }],
    ["capability-1", {}],
  ] as const)("%s remains presentation-only in the BUSINESS band", (id, state) => {
    expect(rendered(scene(state), id).regionKey).toBe("level:BUSINESS");
  });

  it("renders visible SECONDARY without promotion and omits HIDDEN", () => {
    const normal = scene();
    expect(normal.nodes.some((node) => node.entityId === "relationship-1")).toBe(false);
    const expanded = scene({ expansions: [entry] });
    expect(rendered(expanded, "relationship-1").exposure).toBe("SECONDARY");
  });

  it("keeps focus and selection visually independent", () => {
    const result = scene({ viewType: "FOCUS", focus: process, selection: entry });
    expect(rendered(result, "process-1")).toMatchObject({ focused: true, selected: false });
    expect(rendered(result, "entry")).toMatchObject({ focused: false, selected: true });
  });

  it("keeps ATTENUATED visible", () => {
    expect(
      rendered(
        scene({
          viewType: "FOCUS",
          focus: entry,
          context: { maxDepth: 0, direction: "both" },
          orientationBase: [process],
        }),
        "process-1",
      ),
    ).toMatchObject({ attenuated: true, degraded: false });
  });

  it("uses a ghost only for a real known filtered focus", () => {
    const result = scene({
      viewType: "FOCUS",
      focus: process,
      filters: { entityTypes: ["Element"] },
    });
    const ghost = rendered(result, "process-1");
    expect(ghost).toMatchObject({ kind: "ghost", degraded: true, focused: true });
    expect(result.nodes.filter((node) => node.degraded)).toHaveLength(1);
  });

  it("does not retain a selection removed from the effective view", () => {
    expect(
      scene({ selection: entry, filters: { entityTypes: ["Process"] } }).nodes.some(
        (node) => node.selected,
      ),
    ).toBe(false);
  });

  it("gives every rendered representation connection anchors", () => {
    for (const node of scene({ viewType: "FLOW", focus: flow }).nodes)
      expect(Object.keys(node.anchors).sort()).toEqual(["bottom", "left", "right", "top"]);
  });

  it("renders DataObject as a chip without APS position", () => {
    expect(rendered(scene({ viewType: "FLOW", focus: flow }), "request")).toMatchObject({
      kind: "chip",
      regionKey: "support",
    });
  });

  it("renders Relationship explicitly and creates no Element shortcut", () => {
    const result = scene({ expansions: [entry] });
    expect(rendered(result, "relationship-1").kind).toBe("marker");
    const entryKey = rendered(result, "entry").key;
    const middleKey = rendered(result, "middle").key;
    expect(result.edges.some((edge) => edge.source === entryKey && edge.target === middleKey)).toBe(
      false,
    );
  });

  it("preserves edge direction, type and arrowhead", () => {
    for (const edge of scene({ expansions: [entry] }).edges) {
      expect(edge.markerEnd).toBe("edge-arrow");
      expect(edge.path.startsWith("M ")).toBe(true);
      expect(edge.edgeType.length).toBeGreaterThan(0);
    }
  });

  it("does not merge multiedges and offsets their routes", () => {
    const result = scene({ expansions: [process] });
    const edges = result.edges.filter((edge) =>
      ["Process.initiatesFlow", "Process.usesFlow"].includes(edge.edgeType),
    );
    expect(edges).toHaveLength(2);
    expect(new Set(edges.map((edge) => edge.path)).size).toBe(2);
    expect(edges.map((edge) => edge.multiedgeCount)).toEqual([2, 2]);
  });

  it("keeps cross-cell edge endpoints", () => {
    const result = scene({ viewType: "FLOW", focus: flow });
    for (const edge of result.edges) {
      expect(result.nodes.some((node) => node.key === edge.source)).toBe(true);
      expect(result.nodes.some((node) => node.key === edge.target)).toBe(true);
    }
  });

  it("represents FlowRoute separately from graph edges and preserves segment order", () => {
    const result = scene({ viewType: "FLOW", focus: flow });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.segments.map((segment) => segment.sequence)).toEqual([1, 2]);
    expect(result.edges.some((edge) => edge.key === result.routes[0]?.key)).toBe(false);
  });

  it("preserves FlowSegment identity, direction and payload references", () => {
    const segment = scene({ viewType: "FLOW", focus: flow }).routes[0]?.segments[0];
    expect(segment).toMatchObject({
      sequence: 1,
      segment: reference("FlowSegment", "segment-1"),
      source: entry,
      target: reference("Element", "middle"),
      dataObjects: [reference("DataObject", "request")],
    });
  });

  it("marks an unavailable real endpoint incomplete without a shortcut", () => {
    const original = view({ viewType: "FLOW", focus: flow });
    const input: VisualizationView = {
      ...structuredClone(original),
      nodes: original.nodes.filter((node) => node.entityId !== "middle"),
    };
    const result = layoutVisualization(input);
    expect(result.routes[0]?.segments.map((segment) => segment.status)).toContain("INCOMPLETE");
    expect(
      result.routes[0]?.segments.find((segment) => segment.status === "INCOMPLETE")?.path,
    ).toBeUndefined();
  });

  it("is deterministic and does not mutate VisualizationView", () => {
    const input = view({ viewType: "FLOW", focus: flow });
    const before = structuredClone(input);
    expect(layoutVisualization(input)).toEqual(layoutVisualization(input));
    expect(input).toEqual(before);
  });

  it("responsive geometry changes do not change semantic regions", () => {
    const input = view();
    const small = layoutVisualization(input, { cellWidth: 180 });
    const large = layoutVisualization(input, { cellWidth: 360 });
    expect(small.nodes.map((node) => [node.key, node.regionKey])).toEqual(
      large.nodes.map((node) => [node.key, node.regionKey]),
    );
  });

  it("publishes no editing, analysis, persistence, bundling or virtualization output", () => {
    const keys = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) for (const item of value) collect(item);
      else if (typeof value === "object" && value !== null)
        for (const [key, child] of Object.entries(value)) {
          keys.add(key.toLowerCase());
          collect(child);
        }
    };
    collect(scene({ viewType: "FLOW", focus: flow }));
    for (const forbidden of ["editing", "gapengine", "lem", "adn", "bundling", "virtualization"])
      expect(keys).not.toContain(forbidden);
  });
});

describe("UI shell boundaries", () => {
  it("renders the three-panel shell without moving semantic work into React", () => {
    const markup = renderToStaticMarkup(<App graph={graph()} />);
    expect(markup).toContain("left-panel");
    expect(markup).toContain("canvas-panel");
    expect(markup).toContain("right-panel");
    expect(markup).toContain("Flow families");
    expect(markup).toContain("Semantic navigation");
    expect(markup).toContain("Navigation journey");
    expect(markup).toContain("Architecture Overview");
    expect(markup).toContain("Home");
  });

  it("renders InformationDescriptor in the shell", () => {
    const g = graph();
    const visualization = view({ selection: entry });
    const information = getInformationDescriptor(g, visualization, entry);
    if (!information.success) throw new Error(JSON.stringify(information.error));
    const markup = renderToStaticMarkup(<InformationCard descriptor={information.value} />);
    expect(markup).toContain("Entry Component");
    expect(markup).toContain("Open");
    expect(markup).toContain("Focus");
    expect(markup).toContain("Show context");
  });

  it("renders an accessible empty Information Card", () => {
    const markup = renderToStaticMarkup(<InformationCard />);
    expect(markup).toContain('aria-label="Information"');
    expect(markup).toContain("Select an entity");
  });
});
