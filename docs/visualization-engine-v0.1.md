# Visualization Engine v0.1

## Purpose and boundary

The Visualization Engine converts an already projected `VisualizationView` into an interactive, read-only graphical representation. The dependency direction is:

`Architecture → Graph Engine → Visualization Model → VisualizationView → Visualization Engine → UI shell`

The engine owns layout, geometry, native SVG rendering, graphical interactions, simple routing, pan/zoom, fit-to-view, locate and intent events. It does not query the Domain Model, Architecture, Graph Engine or `InformationDescriptor`; traverse the graph; decide membership, exposure or visibility; infer positions or relationships; edit architecture; or perform analysis.

The engine's sole architectural input is `VisualizationView`. React is used only by the application shell, and the core remains independent of React.

## Public API

`createSvgRenderer(container, configuration)` mounts a renderer. The resulting renderer supports `render(view)`, `updateViewport(viewport)`, `getViewport()`, `getScene()`, `fitToView()`, `locate(reference)`, `onEvent(handler)` and `destroy()`.

Events are an explicit intent boundary: selection requested/cleared, focus requested, expansion requested, viewport changed, Flow selected, FlowSegment selected and edge inspected. Payloads contain only references, keys, IDs or viewport values—never complete domain entities. The shell owns the semantic `ViewState` and durable `ViewportState`; the renderer keeps only transient gesture state.

## SVG and React

v0.1 uses native SVG for inspectable identities, labels, accessible DOM integration, arrowheads and the explicit APS matrix. React composes the three-panel shell: FlowFamily/filter controls on the left, the engine in the center, and the Information Card on the right. The shell asks the Visualization Model for `InformationDescriptor`; the engine never does.

Both SVG and React are **revisable**. A future Canvas, WebGL, specialized graphical engine, different framework or graphical platform can replace them without changing the Domain Model, Graph Engine or Visualization Model. UI panel sizes, collapse behavior, placement and responsive composition are also revisable.

## APS layout and positioning

The initial configuration supplies eight ordered APS columns and three ordered levels (`BUSINESS`, `APPLICATION`, `TECHNOLOGY`). The layout iterates a column/level configuration and is not structurally coupled to eight columns. Columns can later be added, removed or redefined by configuration.

Each cell uses deterministic key ordering and a simple vertical list. Resizing changes geometry, never semantic assignment. Empty cells remain present for orientation. Auxiliary regions preserve incomplete positioning without inference:

- known level only: level band outside APS columns;
- known APS only: column band below levels;
- `UNPOSITIONED`: explicit “Position not provided” tray;
- `NOT_APPLICABLE`: context/support region.

Presentation of Process, Role or BusinessCapability in BUSINESS remains a visual presentation and never becomes a declared `ArchitectureLevel`.

## Visual objects and connections

The engine uses a small family of representations rather than one shape per canonical entity. A normal entity is a node, DataObject is initially a light chip, and Relationship/FlowSegment can be markers. Labels use a stable type/ID fallback, explicit truncation, and a complete SVG `<title>`/accessible label.

Every rendered object exposes top, right, bottom and left graphical anchors independently of its current shape. Geometry chooses anchors and draws deterministic quadratic routes. Anchor count, placement and styling are revisable.

Visible `VisualEdge` values retain identity, source, target, direction, type and emphasis, with explicit arrowheads. Multiple edges between the same endpoints are never merged: stable ordering and curve offsets keep each identity. No edge bundling is performed. Exact arrow and line styles are revisable.

When visible, Relationship remains an explicit node in `Element → Relationship → Element`; the engine creates no Element shortcut. This visual treatment remains revisable in later versions, but v0.1 preserves the canonical distinction.

## Flow, FlowSegment and DataObject

`FlowRoute` is rendered as an identifiable, selectable, ordered end-to-end route, not converted into a graph edge. Every FlowSegment retains identity, sequence, source, target and direction and is selectable as a route segment. Missing graphical evidence yields an explicit incomplete segment; the engine never skips a real intermediate endpoint to invent a shortcut.

A visible DataObject is a contextual chip with anchors and no invented APS position. Hidden DataObjects are not rendered. DataObject, Flow and FlowSegment styling are revisable.

## State and interaction

Focus is persistent and distinct from selection and keyboard focus. Selection identifies the inspected entity; when the Visualization Model clears an out-of-view selection, the engine receives no selected node and creates no latent selection. Focus, selection and keyboard focus use separate border/badge/focus styles, not color alone.

A known focus filtered from the effective view is shown as a degraded ghost: lower opacity, dashed styling and a focus badge. It remains a visual orientation reference, not semantic reintroduction. The same degraded vocabulary can represent real, known route components that are not fully available. Degraded fade/color styling is revisable.

Hover is local and transient. It changes neither selection, focus, expansion nor `ViewState`, reveals no hidden item and is not the only means to access an action. Click/Enter requests selection; `F` requests focus; `E` requests expansion; Escape requests selection clearing. Essential actions do not depend on double-click.

Wheel zoom is geometric and pointer drag pans. `fitToView` uses the entire rendered scene, including auxiliary regions and ghosts. `locate` centers an existing rendered reference. Camera operations emit viewport intent and never change focus or exposure. The shell stores viewport state; v0.1 persists none of it.

## Progressive disclosure and perspectives

The engine obeys `PRIMARY`, `SECONDARY`, `HIDDEN`, visibility and emphasis exactly as supplied. It never recalculates them. Hidden objects are omitted; visible secondary objects retain secondary styling; ATTENUATED remains visible and interactive.

FULL_MAP keeps the complete APS frame but does not automatically render the entire snapshot. FOCUS preserves APS orientation and supplied context. FLOW prioritizes the ordered route and visible DataObjects. FlowFamily stays outside the main canvas and is presented by the shell selector in v0.1; that treatment is revisable.

## Information Card and future search

The Information Card belongs to the React shell. On selection, the shell calls the approved Visualization Model API and renders its `InformationDescriptor`. Future card-to-canvas actions must use explicit events/contracts and cannot make the card a parallel semantic source.

Search is not implemented. A future search result may be converted by the shell into selection/focus, a newly projected view and a locate action.

## Accessibility

The SVG has an application role and label. Interactive nodes, routes, segments and edges expose roles, accessible labels and keyboard focus. Full labels remain available, architectural focus and selection have textual badges, and degraded/attenuated/primary/secondary states combine opacity, border, pattern or line style. Hover is supplementary. Enterprise-complete accessibility remains future work.

## Determinism, density and performance

For the same `VisualizationView`, initial viewport and configuration, semantic layout is stable through key ordering. This is logical determinism, not a pixel-perfect cross-platform promise.

Spaghetti diagrams are not only a drawing problem. Dense crossings can signal either a need for better routing or an over-granular view that should use focus, filters, perspective or less detail. The engine does not “solve” density by altering semantics.

v0.1 intentionally avoids premature benchmarks, advanced routing, force layout, packing, bundling, semantic zoom, viewport culling and virtualization. Future culling must never change semantic visibility. Performance will be measured with neutral representative datasets using visible node, edge, segment and label counts.

## Explicitly revisable decisions

The following are revisable after v0.1: SVG; React; the complete graphical platform; shapes; edge and arrow styles; Relationship treatment; DataObject treatment; Flow styling; routing strategy; anchors; panel composition; degraded styling; the number and definition of APS columns; semantic zoom; virtualization/culling; responsive breakpoints; and richer Information Card interaction.

The engine remains read-only and adds no persistence, Graph traversal, architectural editing, Gap Engine, LEM, scoring, risk, recommendations or ADN-specific logic.
