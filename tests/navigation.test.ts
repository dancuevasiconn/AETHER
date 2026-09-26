import { describe, expect, it } from "vitest";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };
import {
  assessNavigationProjection,
  canNavigate,
  commitNavigation,
  createGraph,
  createNavigationState,
  createVisualization,
  getBreadcrumbs,
  getNavigationOptions,
  loadArchitectureFromJson,
  planNavigation,
} from "../src/index.js";
import type {
  EntityKind,
  EntityReference,
  NavigationIntent,
  NavigationResult,
  NavigationState,
  NavigationTarget,
  ViewState,
} from "../src/index.js";

const reference = (entityType: EntityKind, entityId: string): EntityReference => ({
  entityType,
  entityId,
});
const target = (entityType: EntityKind, entityId: string): NavigationTarget => ({
  reference: reference(entityType, entityId),
});
const capability = target("BusinessCapability", "capability-1"),
  process = target("Process", "process-1"),
  flow = target("Flow", "flow-1"),
  family = target("FlowFamily", "family-1"),
  entry = target("Element", "entry"),
  rule = target("BusinessRule", "rule-1"),
  implementation = target("RuleImplementation", "implementation-1"),
  data = target("DataObject", "request");
function setup() {
  const loaded = loadArchitectureFromJson(JSON.stringify(fixture));
  if (!loaded.success) throw new Error(JSON.stringify(loaded));
  const created = createGraph(loaded.architecture);
  if (!created.success) throw new Error(JSON.stringify(created));
  return created.value;
}
function initial(viewState: ViewState = { viewId: "navigation-test", viewType: "FULL_MAP" }) {
  return createNavigationState(viewState);
}
function planned(result: NavigationResult) {
  if (result.status !== "success") throw new Error(JSON.stringify(result));
  return result;
}
function execute(state: NavigationState, intent: NavigationIntent) {
  const graph = setup(),
    plan = planNavigation(graph, state, intent);
  if (plan.status !== "success") return plan;
  const projection = createVisualization(graph, plan.transition.viewState);
  if (!projection.success) return plan;
  const assessed = assessNavigationProjection(plan, projection.value);
  if (assessed.status !== "success") return assessed;
  return {
    result: assessed,
    state: commitNavigation(state, assessed.transition, projection.value.viewState),
    projection: projection.value,
  };
}
function openRelated(from: EntityReference, to: EntityReference) {
  const options = getNavigationOptions(setup(), from);
  if (!options.success) throw new Error(JSON.stringify(options));
  const option = options.options.find(
    (candidate) =>
      candidate.target.reference.entityType === to.entityType &&
      candidate.target.reference.entityId === to.entityId,
  );
  if (!option) throw new Error("Related option absent");
  return { type: "OPEN_RELATED", from, target: option.target, viaEdgeKey: option.edgeKey } as const;
}

describe("Navigation v0.1 semantic transitions", () => {
  it.each([
    ["FOCUS_ENTITY", { type: "FOCUS_ENTITY", target: entry }, "FOCUS", "entry"],
    ["OPEN_FLOW", { type: "OPEN_FLOW", target: flow }, "FLOW", "flow-1"],
    ["OPEN_FLOW_FAMILY", { type: "OPEN_FLOW_FAMILY", target: family }, "FLOW_FAMILY", "family-1"],
  ] as const)("%s produces the approved perspective", (_name, intent, viewType, id) => {
    const result = planned(planNavigation(setup(), initial(), intent));
    expect(result.transition.viewState).toMatchObject({ viewType, focus: { entityId: id } });
  });
  it("OPEN_CONTEXT produces FOCUS with explicit context", () => {
    const context = { maxDepth: 2, direction: "incoming" as const };
    expect(
      planned(
        planNavigation(setup(), initial(), { type: "OPEN_CONTEXT", target: process, context }),
      ).transition.viewState,
    ).toMatchObject({ viewType: "FOCUS", focus: process.reference, context });
  });
  it("rejects invalid context", () =>
    expect(
      planNavigation(setup(), initial(), {
        type: "OPEN_CONTEXT",
        target: process,
        context: { maxDepth: -1, direction: "both" },
      }),
    ).toMatchObject({ status: "failure", error: { code: "INVALID_CONTEXT" } }));
  it("HOME returns a complete Architecture Overview", () => {
    const state = createNavigationState({
      viewId: "same",
      viewType: "FLOW",
      focus: flow.reference,
      selection: entry.reference,
      filters: { entityTypes: ["Element"] },
      expansions: [entry.reference],
      activeRoute: flow.reference,
    });
    const result = planned(planNavigation(setup(), state, { type: "HOME" }));
    expect(result.transition.viewState).toEqual({ viewId: "same", viewType: "FULL_MAP" });
  });
  it("normal navigation preserves filters but clears local narrowing", () => {
    const state = initial({
      viewId: "same",
      viewType: "FOCUS",
      focus: process.reference,
      selection: entry.reference,
      filters: { entityTypes: ["Element"] },
      context: { maxDepth: 1, direction: "both" },
      expansions: [entry.reference],
      activeRoute: flow.reference,
    });
    const next = planned(
      planNavigation(setup(), state, { type: "FOCUS_ENTITY", target: capability }),
    ).transition.viewState;
    expect(next.filters).toEqual({ entityTypes: ["Element"] });
    expect(next).not.toHaveProperty("selection");
    expect(next).not.toHaveProperty("context");
    expect(next).not.toHaveProperty("expansions");
    expect(next).not.toHaveProperty("activeRoute");
    expect(next.viewId).toBe("same");
  });
  it("CLEAR_ALL clears filters only when explicit", () => {
    const state = initial({
      viewId: "same",
      viewType: "FULL_MAP",
      filters: { entityTypes: ["Element"] },
    });
    const preserve = planned(
      planNavigation(setup(), state, { type: "FOCUS_ENTITY", target: process }),
    );
    expect(preserve.transition.viewState.filters).toBeDefined();
    const clear = planned(
      planNavigation(setup(), state, {
        type: "FOCUS_ENTITY",
        target: process,
        filterPolicy: "CLEAR_ALL",
      }),
    );
    expect(clear.transition.viewState.filters).toBeUndefined();
  });
  it("OPEN_FLOW sets activeRoute and other navigation removes it", () => {
    const opened = planned(planNavigation(setup(), initial(), { type: "OPEN_FLOW", target: flow }));
    expect(opened.transition.viewState.activeRoute).toEqual(flow.reference);
    const next = planned(
      planNavigation(setup(), opened.transition.navigationState, {
        type: "FOCUS_ENTITY",
        target: entry,
      }),
    );
    expect(next.transition.viewState.activeRoute).toBeUndefined();
  });
  it("EntityReference is authoritative and nodeKey is optional", () => {
    expect(planNavigation(setup(), initial(), { type: "FOCUS_ENTITY", target: entry }).status).toBe(
      "success",
    );
    const key = setup().getNode("Element", "entry");
    if (!key.success) throw new Error("missing");
    expect(
      planNavigation(setup(), initial(), {
        type: "FOCUS_ENTITY",
        target: { ...entry, nodeKey: key.value.key },
      }).status,
    ).toBe("success");
    expect(
      planNavigation(setup(), initial(), {
        type: "FOCUS_ENTITY",
        target: { ...entry, nodeKey: "conflict" },
      }),
    ).toMatchObject({ status: "failure", error: { code: "INVALID_TARGET_TYPE" } });
  });
  it.each([
    [{ type: "OPEN_FLOW", target: entry }, "INVALID_TARGET_TYPE"],
    [{ type: "OPEN_FLOW_FAMILY", target: flow }, "INVALID_TARGET_TYPE"],
    [{ type: "FOCUS_ENTITY", target: { ...entry, perspective: "FLOW" } }, "INVALID_PERSPECTIVE"],
    [{ type: "FOCUS_ENTITY", target: target("Element", "absent") }, "TARGET_NOT_FOUND"],
  ] as const)("rejects invalid target case %#", (intent, code) =>
    expect(planNavigation(setup(), initial(), intent)).toMatchObject({
      status: "failure",
      error: { code },
    }),
  );
});

describe("History breadcrumbs and commit", () => {
  function journey() {
    let state = initial();
    for (const item of [capability, process, flow]) {
      const intent: NavigationIntent =
        item === flow
          ? { type: "OPEN_FLOW", target: item }
          : { type: "FOCUS_ENTITY", target: item };
      const executed = execute(state, intent);
      if (!("state" in executed)) throw new Error("failed");
      state = executed.state;
    }
    return state;
  }
  it("pushes meaningful navigation into an unlimited in-memory history", () => {
    const state = journey();
    expect(state.past).toHaveLength(3);
    expect(state).not.toHaveProperty("maxHistoryEntries");
    expect(JSON.stringify(state)).not.toContain("viewport");
  });
  it("Back restores previous entry without duplicates", () => {
    const state = journey(),
      back = planned(planNavigation(setup(), state, { type: "BACK" }));
    expect(back.transition.navigationState.current.target?.reference).toEqual(process.reference);
    expect(back.transition.navigationState.future[0]?.target?.reference).toEqual(flow.reference);
    expect(back.transition.navigationState.past).toHaveLength(2);
  });
  it("Forward restores the next entry", () => {
    const state = journey(),
      back = planned(planNavigation(setup(), state, { type: "BACK" })).transition.navigationState,
      forward = planned(planNavigation(setup(), back, { type: "FORWARD" }));
    expect(forward.transition.navigationState.current.target?.reference).toEqual(flow.reference);
    expect(forward.transition.navigationState.future).toHaveLength(0);
  });
  it("new navigation after Back clears future", () => {
    const state = journey(),
      back = planned(planNavigation(setup(), state, { type: "BACK" })).transition.navigationState,
      next = planned(planNavigation(setup(), back, { type: "FOCUS_ENTITY", target: entry }));
    expect(next.transition.navigationState.future).toEqual([]);
  });
  it.each(["BACK", "FORWARD"] as const)("%s at history boundary is no-op and immutable", (type) => {
    const state = initial(),
      before = structuredClone(state),
      result = planNavigation(setup(), state, { type });
    expect(result.status).toBe("no-op");
    expect(state).toEqual(before);
  });
  it("breadcrumbs represent the journey and can restore an entry", () => {
    const state = journey(),
      crumbs = getBreadcrumbs(state);
    expect(crumbs.map((item) => item.label)).toEqual([
      "Architecture Overview",
      "BusinessCapability capability-1",
      "Process process-1",
      "Flow flow-1",
    ]);
    const result = planned(
      planNavigation(setup(), state, { type: "GO_TO_ENTRY", entryId: crumbs[1]!.entryId }),
    );
    expect(result.transition.navigationState.current.target?.reference).toEqual(
      capability.reference,
    );
    expect(result.transition.navigationState.future).toHaveLength(2);
  });
  it("historical labels are descriptive rather than identity", () => {
    const state = journey(),
      changed = { ...state, current: { ...state.current, label: "Anything" } };
    expect(changed.current.target?.reference).toEqual(flow.reference);
  });
  it("plan is only a candidate and commit accepts the effective ViewState", () => {
    const state = initial(),
      plan = planned(planNavigation(setup(), state, { type: "FOCUS_ENTITY", target: entry }));
    expect(state.past).toEqual([]);
    const effective = { ...plan.transition.viewState, selection: entry.reference };
    const committed = commitNavigation(state, plan.transition, effective);
    expect(committed.current.viewState).toEqual(effective);
    expect(state.past).toEqual([]);
  });
  it("a projection failure can be abandoned without recording history", () => {
    const state = initial(),
      plan = planned(planNavigation(setup(), state, { type: "FOCUS_ENTITY", target: entry }));
    expect(plan.transition.navigationState).not.toBe(state);
    expect(state).toEqual(initial());
  });
});

describe("Selection and FlowSegment navigation", () => {
  function flowState() {
    const opened = execute(initial(), { type: "OPEN_FLOW", target: flow });
    if (!("state" in opened)) throw new Error("failed");
    return opened.state;
  }
  it("Inspect changes selection without history or focus", () => {
    const state = flowState(),
      result = planned(planNavigation(setup(), state, { type: "INSPECT_ENTITY", target: entry }));
    expect(result.transition.viewState.selection).toEqual(entry.reference);
    expect(result.transition.viewState.focus).toEqual(flow.reference);
    expect(result.transition.navigationState.past).toEqual(state.past);
  });
  it("navigating focus clears selection", () => {
    const selected = planned(
        planNavigation(setup(), flowState(), { type: "INSPECT_ENTITY", target: entry }),
      ).transition.navigationState,
      next = planned(planNavigation(setup(), selected, { type: "FOCUS_ENTITY", target: process }));
    expect(next.transition.viewState.selection).toBeUndefined();
    expect(next.transition.viewState.focus).toEqual(process.reference);
  });
  it("SELECT_FLOW_SEGMENT selects but does not focus or add history", () => {
    const state = flowState(),
      result = planned(
        planNavigation(setup(), state, {
          type: "SELECT_FLOW_SEGMENT",
          target: target("FlowSegment", "segment-1"),
        }),
      );
    expect(result.transition.viewState.selection).toEqual(reference("FlowSegment", "segment-1"));
    expect(result.transition.viewState.focus).toEqual(flow.reference);
    expect(result.transition.navigationState.past).toEqual(state.past);
  });
  it("NEXT and PREVIOUS change only segment selection", () => {
    let state = flowState();
    state = planned(
      planNavigation(setup(), state, {
        type: "SELECT_FLOW_SEGMENT",
        target: target("FlowSegment", "segment-1"),
      }),
    ).transition.navigationState;
    const next = planned(planNavigation(setup(), state, { type: "NEXT_FLOW_SEGMENT" }));
    expect(next.transition.viewState.selection).toEqual(reference("FlowSegment", "segment-2"));
    expect(next.transition.viewState.focus).toEqual(flow.reference);
    expect(next.transition.navigationState.past).toEqual(state.past);
    const previous = planned(
      planNavigation(setup(), next.transition.navigationState, { type: "PREVIOUS_FLOW_SEGMENT" }),
    );
    expect(previous.transition.viewState.selection).toEqual(reference("FlowSegment", "segment-1"));
  });
  it("segment boundaries are no-op", () => {
    let state = flowState();
    state = planned(
      planNavigation(setup(), state, {
        type: "SELECT_FLOW_SEGMENT",
        target: target("FlowSegment", "segment-1"),
      }),
    ).transition.navigationState;
    expect(planNavigation(setup(), state, { type: "PREVIOUS_FLOW_SEGMENT" })).toMatchObject({
      status: "no-op",
      reason: "FIRST_FLOW_SEGMENT",
    });
    state = planned(planNavigation(setup(), state, { type: "NEXT_FLOW_SEGMENT" })).transition
      .navigationState;
    expect(planNavigation(setup(), state, { type: "NEXT_FLOW_SEGMENT" })).toMatchObject({
      status: "no-op",
      reason: "LAST_FLOW_SEGMENT",
    });
  });
  it("segment source and target become semantic focus destinations", () => {
    let state = flowState();
    state = planned(
      planNavigation(setup(), state, {
        type: "SELECT_FLOW_SEGMENT",
        target: target("FlowSegment", "segment-1"),
      }),
    ).transition.navigationState;
    expect(
      planned(planNavigation(setup(), state, { type: "OPEN_SEGMENT_SOURCE" })).transition.viewState
        .focus,
    ).toEqual(entry.reference);
    expect(
      planned(planNavigation(setup(), state, { type: "OPEN_SEGMENT_TARGET" })).transition.viewState
        .focus,
    ).toEqual(reference("Element", "middle"));
  });
  it("segment navigation fails without active route or valid selection", () => {
    expect(planNavigation(setup(), initial(), { type: "NEXT_FLOW_SEGMENT" })).toMatchObject({
      status: "failure",
      error: { code: "FLOW_NOT_AVAILABLE" },
    });
    expect(planNavigation(setup(), flowState(), { type: "NEXT_FLOW_SEGMENT" })).toMatchObject({
      status: "failure",
      error: { code: "FLOW_SEGMENT_NOT_FOUND" },
    });
  });
});

describe("Real relation navigation", () => {
  it.each([
    [capability.reference, process.reference],
    [process.reference, flow.reference],
    [family.reference, flow.reference],
    [rule.reference, implementation.reference],
    [implementation.reference, rule.reference],
    [data.reference, flow.reference],
  ])("navigates %o to %o only through a real edge", (from, to) => {
    const intent = openRelated(from, to),
      result = planned(planNavigation(setup(), initial(), intent));
    expect(result.transition.entry.transition?.edgeKey).toBe(intent.viaEdgeKey);
    expect(result.transition.viewState.focus).toEqual(to);
  });
  it("preserves inverse direction without creating an inverse edge", () => {
    const intent = openRelated(process.reference, capability.reference),
      result = planned(planNavigation(setup(), initial(), intent));
    expect(result.transition.entry.transition).toMatchObject({
      direction: "inverse",
      edgeType: "BusinessCapability.process",
    });
  });
  it("getNavigationOptions is stable and contains only real Graph neighbors", () => {
    const graph = setup(),
      result = getNavigationOptions(graph, entry.reference),
      node = graph.getNode("Element", "entry");
    if (!result.success || !node.success) throw new Error("failed");
    const neighborhood = graph.getNeighbors(node.value.key, { direction: "both" });
    if (!neighborhood.success) throw new Error("failed");
    expect(result.options.length).toBeGreaterThan(0);
    expect(result.options).toEqual(
      [...result.options].sort(
        (a, b) =>
          a.edgeKey.localeCompare(b.edgeKey) ||
          `${a.target.reference.entityType}:${a.target.reference.entityId}`.localeCompare(
            `${b.target.reference.entityType}:${b.target.reference.entityId}`,
          ),
      ),
    );
    expect(
      result.options.every((option) =>
        neighborhood.value.steps.some((step) => step.edge.key === option.edgeKey),
      ),
    ).toBe(true);
  });
  it("rejects missing source missing edge and mismatched target", () => {
    const valid = openRelated(capability.reference, process.reference);
    expect(
      planNavigation(setup(), initial(), { ...valid, from: reference("Process", "absent") }),
    ).toMatchObject({ status: "failure", error: { code: "SOURCE_NOT_FOUND" } });
    expect(planNavigation(setup(), initial(), { ...valid, viaEdgeKey: "absent" })).toMatchObject({
      status: "failure",
      error: { code: "RELATION_NOT_FOUND" },
    });
    expect(planNavigation(setup(), initial(), { ...valid, target: entry })).toMatchObject({
      status: "failure",
      error: { code: "RELATION_NOT_FOUND" },
    });
  });
});

describe("Projection assessment and boundaries", () => {
  it("adds TARGET_FILTERED only after the Visualization Model projects hidden focus", () => {
    const state = initial({
        viewId: "filtered",
        viewType: "FULL_MAP",
        filters: { entityTypes: ["Element"] },
      }),
      plan = planned(planNavigation(setup(), state, { type: "FOCUS_ENTITY", target: process })),
      projection = createVisualization(setup(), plan.transition.viewState);
    if (!projection.success) throw new Error("failed");
    const assessed = planned(assessNavigationProjection(plan, projection.value));
    expect(assessed.warnings).toEqual([
      { code: "TARGET_FILTERED", message: "Target is valid but excluded by active filters." },
    ]);
    expect(assessed.transition.viewState.filters).toEqual({ entityTypes: ["Element"] });
    expect(projection.value.view.nodes.find((node) => node.entityId === "process-1")).toMatchObject(
      { focused: true, visibility: "HIDDEN" },
    );
  });
  it("does not warn for a visible target or CLEAR_ALL", () => {
    for (const intent of [
      { type: "FOCUS_ENTITY", target: entry },
      { type: "FOCUS_ENTITY", target: process, filterPolicy: "CLEAR_ALL" },
    ] as const) {
      const base = initial({
          viewId: "filtered",
          viewType: "FULL_MAP",
          filters: { entityTypes: ["Element"] },
        }),
        plan = planned(planNavigation(setup(), base, intent)),
        projection = createVisualization(setup(), plan.transition.viewState);
      if (!projection.success) throw new Error("failed");
      expect(planned(assessNavigationProjection(plan, projection.value)).warnings).toEqual([]);
    }
  });
  it("canNavigate is read-only", () => {
    const state = initial(),
      before = structuredClone(state),
      availability = canNavigate(setup(), state, { type: "FOCUS_ENTITY", target: entry });
    expect(availability.available).toBe(true);
    expect(state).toEqual(before);
  });
  it("same input produces equivalent result and mutates neither input nor Graph", () => {
    const graph = setup(),
      state = initial(),
      intent = { type: "FOCUS_ENTITY", target: entry } as const,
      beforeState = structuredClone(state),
      beforeNeighbors = graph.getNeighbors(graph.getNodesByType("Element")[0]!.key, {
        direction: "both",
      });
    expect(planNavigation(graph, state, intent)).toEqual(planNavigation(graph, state, intent));
    expect(state).toEqual(beforeState);
    expect(
      graph.getNeighbors(graph.getNodesByType("Element")[0]!.key, { direction: "both" }),
    ).toEqual(beforeNeighbors);
  });
  it("NavigationState contains ViewState but no VisualizationView viewport or entities", () => {
    const executed = execute(initial(), { type: "FOCUS_ENTITY", target: entry });
    if (!("state" in executed)) throw new Error("failed");
    const serialized = JSON.stringify(executed.state);
    expect(serialized).not.toContain("semanticFrame");
    expect(serialized).not.toContain("viewport");
    expect(serialized).not.toContain("elementType");
  });
});
