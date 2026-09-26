# Navigation v0.1

## Definition and boundary

Navigation is an application layer that transforms semantic intent into a candidate `ViewState`. It remains distinct from Domain Model, Graph Engine, Visualization Model, Visualization Engine and UI Shell. It neither builds `VisualizationView` nor draws, lays out, traverses a copied graph, creates relationships or interprets architecture independently.

Semantic Navigation includes Focus, Open Context, Open Flow, Open FlowFamily, Open Related, Home, Back/Forward, perspective changes, FlowSegment progression and the user's journey. Viewport operations—pan, geometric zoom, fit and locate—belong to Visualization Engine/UI Shell and never enter semantic history.

## Contracts and identity

`NavigationTarget` contains an authoritative `EntityReference`, optional `nodeKey`, optional compatible perspective and optional context request. `nodeKey` is only an optimization; when present it must resolve to the same GraphNode. Targets contain no entity payload and are not Domain entities.

The intent union includes inspection, focus/context, related navigation, Flow/FlowFamily, FlowSegment selection/next/previous/source/target, Home, Back, Forward and breadcrumb activation. `PRESERVE` is the default filter policy; `CLEAR_ALL` is explicit.

`NavigationState` contains `home`, immutable `past`, `current` and `future` entries. The active semantic state is `current.viewState`. It contains neither viewport nor `VisualizationView` nor complete entities. History is unlimited and in memory for v0.1. A new successful journey after Back removes `future`.

`NavigationEntry.label` is descriptive UX metadata for breadcrumbs. It is never identity and can evolve to another label strategy. Entry IDs are deterministic and do not affect architecture semantics.

Results are discriminated as `success`, `no-op` or `failure`; ordinary navigation conditions do not throw. Failures distinguish missing source/target/relation, incompatible perspective/type/context, unavailable Flow/segment, projection and Graph failures.

## Ownership and transition protocol

The UI coordinator owns Navigation State, active View State and Viewport State separately. Navigation is a pure React-independent transition service. Graph Engine validates identity and real connections through public APIs. Visualization Model validates/project View State. Visualization Engine renders and emits intent-like events.

v0.1 uses:

1. `planNavigation(graph, state, intent)` to propose a View State and Navigation transition.
2. `createVisualization(graph, candidateViewState)` to project it.
3. `assessNavigationProjection(result, projection)` to add `TARGET_FILTERED` from the authoritative projected visibility, without duplicating filter rules.
4. `commitNavigation(state, transition, effectiveViewState)` only after projection succeeds.

Projection failure leaves state/history unchanged. This consistency-first protocol is **revisable** for future optimistic navigation, progressive loading, precomputation, lower perceived latency or editing.

## History, breadcrumbs and Home

Focus/perspective changes, Open Flow, Open FlowFamily, Open Context, meaningful Open Related and Home create semantic history. Selection, hover, expansion, segment stepping and all viewport operations do not. Back/Forward restore entries without duplicates; boundary operations are no-ops.

Breadcrumbs are the user's journey, never a Domain hierarchy. Activating a breadcrumb restores that historical entry and moves later entries to `future`. Their visual representation and interaction are future/revisable.

Home creates `FULL_MAP` with the stable `viewId` and removes focus, selection, context, expansions, active route and filters. It does not reload Architecture. Future Home variants may support profiles, alternate overviews or contextual restoration.

## Focus, context, selection and filters

Focus means “make this object the center” and uses the Visualization Model's default context. Open Context is a distinct intent that supplies explicit depth, direction and optional edge/entity restrictions; Navigation never executes traversal. A future UI may contrast Focus and Context graphically.

The formal rule is `selection ≠ focus ≠ navigation target`:

- Inspect changes selection only.
- Open performs semantic navigation.
- Focus produces `FOCUS` and clears selection.
- Open Context produces `FOCUS` plus explicit context and clears selection.
- Open Flow/FlowFamily change perspective/focus and clear selection.
- FlowSegment select/next/previous change selection, not focus/history.

Normal navigation preserves filters, replaces focus, clears selection/context/expansions, and keeps active route only for the opened Flow. Navigation never recalculates orientation base. An explicit `CLEAR_ALL` removes filters. If preserved filters hide a valid focus, projection remains successful and assessment adds `TARGET_FILTERED`; the already-approved ghost/degraded renderer behavior preserves orientation.

## Real relationship navigation

`OPEN_RELATED` requires source, target and `viaEdgeKey`. The service validates that all identities exist and that the exact edge connects them. Reverse navigation preserves the canonical edge and records `direction: inverse`; it never creates an inverse relationship or shortcut.

`getNavigationOptions` calls public Graph APIs and returns deterministic real neighbors only. Business, technical, data and rule journeys are therefore sequences of actual steps, not canonical hierarchies. Examples include Capability → Process → Flow, Element → Relationship → Element, DataObject → Flow → FlowSegment, and BusinessRule ↔ RuleImplementation → executing Element/Role. Logical BusinessRule position, actual RuleImplementation position and executors stay distinct.

## Flow and FlowFamily

Open Flow produces `FLOW`, focuses the Flow and assigns it as active route. Segment order comes from `GraphEngine.getFlowSegments`. Next/previous changes selection only, never wraps, and returns a no-op at boundaries; unavailable or inconsistent sequences fail. Source/target actions open the real endpoint without modifying Flow.

Open FlowFamily produces `FLOW_FAMILY`; FlowFamily stays external context rather than a mandatory canvas node. Back returns from an opened Flow to its prior FlowFamily entry.

## UI integration and public API

The shell exposes neutral Home/Back/Forward controls, journey breadcrumbs, FlowSegment previous/next and Information Card actions. The card emits references/edge keys for Open, Focus, Show Context and related destinations; it does not traverse or own history. Renderer events adapt as follows: focus → Focus intent; Flow selected → Open Flow; FlowSegment selected → local segment selection; viewport change → viewport only; expansion → local View State update.

The public API is `createNavigationState`, `planNavigation`, `assessNavigationProjection`, `commitNavigation`, `getNavigationOptions`, `getBreadcrumbs` and `canNavigate`. It may evolve while preserving ownership, semantic navigation and Graph as the source of real relations.

## Rule dictionary

- EntityReference is authoritative; nodeKey is optional.
- Inspect changes selection; Open navigates; Focus produces FOCUS.
- Open Context produces FOCUS with explicit context.
- Selection, focus and navigation target are distinct.
- FlowSegment next/previous changes selection but not focus/history.
- Filters are preserved by default; CLEAR_ALL is explicit.
- A filtered valid target succeeds with TARGET_FILTERED.
- Navigation history is not viewport history.
- Breadcrumbs represent journey, not hierarchy.
- OPEN_RELATED requires a real identified edge.
- Home is Architecture Overview.
- Navigation creates no canonical shortcuts.

## Future readiness and out of scope

Contracts permit future deep links containing Architecture identity, EntityReference, perspective and validated limited context/filters—not entities, complete history, unvalidated Graph internals or default viewport. Persisted journeys, bookmarks, shared state, richer historical traceability and audit events such as NAVIGATED/FOCUSED/OPENED_FLOW may be added later. Detective Mode may transform questions into targets/intents/journeys/explanations, but v0.1 implements no NLP, LLM, AI, reasoning, automatic discovery or explanation.

Also out of scope: persistence, localStorage/database, React Router/URL routing, Search, Audit Engine, editing, new Domain entities/relationships, private Graph access, independent traversal, viewport history, ADN logic, Gap Engine and LEM.
