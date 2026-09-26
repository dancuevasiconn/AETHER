import { useCallback, useMemo, useRef, useState } from "react";
import type { GraphEngine } from "../graph/index.js";
import {
  assessNavigationProjection,
  commitNavigation,
  createNavigationState,
  getBreadcrumbs,
  getNavigationOptions,
  planNavigation,
} from "../navigation/index.js";
import type {
  NavigationIntent,
  NavigationOption,
  NavigationState,
  NavigationTarget,
} from "../navigation/index.js";
import { createVisualization, getInformationDescriptor } from "../visualization/index.js";
import type { EntityReference, ViewState } from "../visualization/index.js";
import type {
  ViewportState,
  VisualizationEngineEvent,
  VisualizationRenderer,
} from "../visualization-engine/index.js";
import { InformationCard } from "./InformationCard.js";
import { VisualizationCanvas } from "./VisualizationCanvas.js";

const initialViewState: ViewState = { viewId: "browser-view", viewType: "FULL_MAP" };
const asTarget = (reference: EntityReference): NavigationTarget => ({ reference });
export function App({ graph }: { readonly graph: GraphEngine }) {
  const [navigation, setNavigation] = useState<NavigationState>(() =>
      createNavigationState(initialViewState),
    ),
    [viewport, setViewport] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 }),
    [locate, setLocate] = useState<EntityReference | undefined>(),
    [notice, setNotice] = useState<string>();
  const rendererRef = useRef<VisualizationRenderer | null>(null);
  const state = navigation.current.viewState;
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
  const replaceCurrent = useCallback(
    (update: (current: ViewState) => ViewState) =>
      setNavigation((current) => ({
        ...current,
        current: { ...current.current, viewState: update(current.current.viewState) },
      })),
    [],
  );
  const navigate = useCallback(
    (intent: NavigationIntent) => {
      const planned = planNavigation(graph, navigation, intent);
      if (planned.status !== "success") {
        if (planned.status === "failure") setNotice(planned.error.message);
        return;
      }
      const projected = createVisualization(graph, planned.transition.viewState);
      if (!projected.success) {
        setNotice(projected.error.message);
        return;
      }
      const assessed = assessNavigationProjection(planned, projected.value);
      if (assessed.status !== "success") return;
      setNotice(assessed.warnings[0]?.message);
      setNavigation(commitNavigation(navigation, assessed.transition, projected.value.viewState));
    },
    [graph, navigation],
  );
  const handleEvent = useCallback(
    (event: VisualizationEngineEvent) => {
      switch (event.type) {
        case "selectionRequested":
          navigate({ type: "INSPECT_ENTITY", target: asTarget(event.reference) });
          break;
        case "flowSelected":
          navigate({ type: "OPEN_FLOW", target: asTarget(event.reference) });
          break;
        case "flowSegmentSelected":
          navigate({ type: "SELECT_FLOW_SEGMENT", target: asTarget(event.reference) });
          break;
        case "selectionCleared":
          navigate({ type: "INSPECT_ENTITY" });
          break;
        case "focusRequested":
          navigate({ type: "FOCUS_ENTITY", target: asTarget(event.reference) });
          break;
        case "expansionRequested":
          replaceCurrent((current) => ({
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
    },
    [navigate, replaceCurrent],
  );
  const families = graph
    .getNodesByType("FlowFamily")
    .map((node) => ({ entityType: node.entityType, entityId: node.entityId }));
  const breadcrumbs = getBreadcrumbs(navigation),
    selection = projection.success ? projection.value.viewState.selection : undefined;
  const options = useMemo(
    () => (selection ? getNavigationOptions(graph, selection) : undefined),
    [graph, selection],
  );
  const openOption = useCallback(
    (option: NavigationOption) => {
      if (selection)
        navigate({
          type: "OPEN_RELATED",
          from: selection,
          target: option.target,
          viaEdgeKey: option.edgeKey,
        });
    },
    [navigate, selection],
  );
  if (!projection.success)
    return (
      <main className="fatal">
        <h1>AETHER</h1>
        <p>Unable to create visualization: {projection.error.message}</p>
      </main>
    );
  const effective = projection.value;
  return (
    <main className="app-shell">
      <header>
        <div>
          <p className="eyebrow">AETHER v0.1</p>
          <h1>Architecture Explorer</h1>
        </div>
        <nav className="history-controls" aria-label="Semantic navigation">
          <button
            onClick={() => navigate({ type: "BACK" })}
            disabled={navigation.past.length === 0}
          >
            Back
          </button>
          <button
            onClick={() => navigate({ type: "FORWARD" })}
            disabled={navigation.future.length === 0}
          >
            Forward
          </button>
          <button onClick={() => navigate({ type: "HOME" })}>Home</button>
          <button onClick={() => navigate({ type: "PREVIOUS_FLOW_SEGMENT" })}>
            Previous segment
          </button>
          <button onClick={() => navigate({ type: "NEXT_FLOW_SEGMENT" })}>Next segment</button>
        </nav>
        <div className="toolbar">
          <button onClick={() => rendererRef.current?.fitToView()}>Fit view</button>
          <button onClick={() => effective.view.focus && setLocate(effective.view.focus)}>
            Locate focus
          </button>
          <button onClick={() => selection && setLocate(selection)}>Locate selection</button>
        </div>
      </header>
      <nav className="breadcrumbs" aria-label="Navigation journey">
        {breadcrumbs.map((breadcrumb, index) => (
          <span key={breadcrumb.entryId}>
            {index > 0 && <span aria-hidden="true"> → </span>}
            <button
              aria-current={breadcrumb.current ? "page" : undefined}
              onClick={() => navigate({ type: "GO_TO_ENTRY", entryId: breadcrumb.entryId })}
            >
              {breadcrumb.label}
            </button>
          </span>
        ))}
      </nav>
      <aside className="left-panel">
        <h2>Flow families</h2>
        <button
          className={state.viewType === "FULL_MAP" ? "active" : ""}
          onClick={() => navigate({ type: "HOME" })}
        >
          All architecture
        </button>
        {families.map((family) => (
          <button
            key={family.entityId}
            className={state.focus?.entityId === family.entityId ? "active" : ""}
            onClick={() => navigate({ type: "OPEN_FLOW_FAMILY", target: asTarget(family) })}
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
            replaceCurrent((current) => ({ ...current, filters: { entityTypes: ["Element"] } }))
          }
        >
          Elements only
        </button>
        <button
          onClick={() =>
            replaceCurrent((current) => {
              const { filters: unused, ...rest } = current;
              void unused;
              return rest;
            })
          }
        >
          Clear filters
        </button>
        {notice && (
          <p className="navigation-notice" role="status">
            {notice}
          </p>
        )}
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
          <InformationCard
            descriptor={information.value}
            navigationOptions={options?.success ? options.options : []}
            onFocus={(reference) => navigate({ type: "FOCUS_ENTITY", target: asTarget(reference) })}
            onOpen={(reference) =>
              navigate(
                reference.entityType === "Flow"
                  ? { type: "OPEN_FLOW", target: asTarget(reference) }
                  : reference.entityType === "FlowFamily"
                    ? { type: "OPEN_FLOW_FAMILY", target: asTarget(reference) }
                    : { type: "FOCUS_ENTITY", target: asTarget(reference) },
              )
            }
            onOpenContext={(reference) =>
              navigate({
                type: "OPEN_CONTEXT",
                target: asTarget(reference),
                context: { maxDepth: 2, direction: "both" },
              })
            }
            onOpenRelated={openOption}
          />
        ) : (
          <InformationCard />
        )}
      </aside>
    </main>
  );
}
