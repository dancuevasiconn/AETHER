import { useCallback, useMemo, useRef, useState } from "react";
import type { GraphEngine } from "../graph/index.js";
import { createVisualization, getInformationDescriptor } from "../visualization/index.js";
import type { EntityReference, ViewState } from "../visualization/index.js";
import type {
  ViewportState,
  VisualizationEngineEvent,
  VisualizationRenderer,
} from "../visualization-engine/index.js";
import { InformationCard } from "./InformationCard.js";
import { VisualizationCanvas } from "./VisualizationCanvas.js";

const withoutSelection = (state: ViewState): ViewState => {
  const { selection: unused, ...rest } = state;
  void unused;
  return rest;
};
export function App({ graph }: { readonly graph: GraphEngine }) {
  const [state, setState] = useState<ViewState>({ viewId: "browser-view", viewType: "FULL_MAP" }),
    [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 }),
    [locate, setLocate] = useState<EntityReference | undefined>();
  const rendererRef = useRef<VisualizationRenderer | null>(null);
  const projection = useMemo(() => createVisualization(graph, state), [graph, state]);
  const information = useMemo(
    () =>
      projection.success && projection.value.viewState.selection
        ? getInformationDescriptor(
            graph,
            projection.value.view,
            projection.value.viewState.selection,
          )
        : undefined,
    [graph, projection],
  );
  const handleEvent = useCallback((event: VisualizationEngineEvent) => {
    switch (event.type) {
      case "selectionRequested":
      case "flowSelected":
      case "flowSegmentSelected":
        setState((current) => ({ ...current, selection: event.reference }));
        break;
      case "selectionCleared":
        setState(withoutSelection);
        break;
      case "focusRequested":
        setState((current) => ({
          ...withoutSelection(current),
          viewType:
            event.reference.entityType === "Flow"
              ? "FLOW"
              : event.reference.entityType === "FlowFamily"
                ? "FLOW_FAMILY"
                : "FOCUS",
          focus: event.reference,
        }));
        break;
      case "expansionRequested":
        setState((current) => ({
          ...current,
          expansions: [
            ...new Map(
              [...(current.expansions ?? []), event.reference].map((reference) => [
                `${reference.entityType}:${reference.entityId}`,
                reference,
              ]),
            ).values(),
          ],
        }));
        break;
      case "viewportChanged":
        setViewport(event.viewport);
        break;
      case "edgeInspected":
        break;
    }
  }, []);
  const families = graph
    .getNodesByType("FlowFamily")
    .map((node) => ({ entityType: node.entityType, entityId: node.entityId }));
  if (!projection.success)
    return (
      <main className="fatal">
        <h1>AETHER</h1>
        <p>Unable to create visualization: {projection.error.message}</p>
      </main>
    );
  const effective = projection.value,
    selection = effective.viewState.selection;
  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="eyebrow">AETHER v0.1</p>
          <h1>Architecture Explorer</h1>
        </div>
        <div className="toolbar">
          <button onClick={() => rendererRef.current?.fitToView()}>Fit view</button>
          <button onClick={() => effective.view.focus && setLocate(effective.view.focus)}>
            Locate focus
          </button>
          <button onClick={() => selection && setLocate(selection)}>Locate selection</button>
        </div>
      </header>
      <aside className="left-panel">
        <h2>Flow families</h2>
        <button
          className={state.viewType === "FULL_MAP" ? "active" : ""}
          onClick={() => setState({ viewId: state.viewId, viewType: "FULL_MAP" })}
        >
          All architecture
        </button>
        {families.map((family) => (
          <button
            key={family.entityId}
            className={state.focus?.entityId === family.entityId ? "active" : ""}
            onClick={() =>
              setState({ viewId: state.viewId, viewType: "FLOW_FAMILY", focus: family })
            }
          >
            {effective.view.nodes.find((node) => node.entityId === family.entityId)?.label ??
              family.entityId}
          </button>
        ))}
        <h2>Filters</h2>
        <p className="muted">
          Filters are coordinated through View State. No visual filter mutates the architecture.
        </p>
        <button
          onClick={() =>
            setState((current) => ({ ...current, filters: { entityTypes: ["Element"] } }))
          }
        >
          Elements only
        </button>
        <button
          onClick={() =>
            setState((current) => {
              const { filters: unused, ...rest } = current;
              void unused;
              return rest;
            })
          }
        >
          Clear filters
        </button>
      </aside>
      <section className="canvas-panel">
        <VisualizationCanvas
          view={effective.view}
          viewport={viewport}
          onEvent={handleEvent}
          rendererRef={rendererRef}
          {...(locate ? { locate } : {})}
        />
      </section>
      <aside className="right-panel">
        {information?.success ? (
          <InformationCard descriptor={information.value} />
        ) : (
          <InformationCard />
        )}
      </aside>
    </main>
  );
}
