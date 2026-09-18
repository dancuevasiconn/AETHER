# Visualization Model v0.1

## Authority and boundaries

This implements the approved Step 10 decisions and implementation instructions,
under AETHER-ADR-0001, AETHER-ADR-0002 and visualization-v0.1.md. The documentary
sources remain operational authority even though their documentary status is Proposal.

Domain Model != Graph Engine != Visualization Model != Visualization Engine.
Graph snapshot + View State + versioned projection rules -> VisualizationView.
The visualization is a derived in-memory projection, never new architectural truth.
No Architecture input, private graph indexes, or domain inverse arrays are used.
Only public GraphEngine methods supply nodes, entities, positioning and connectivity.
No input is mutated, and every projection returns new containers.

## Public API and contracts

- `createVisualization(graph, viewState)` returns a `VisualizationResult` whose
  success value contains `view` and the normalized effective `viewState`.
- `getInformationDescriptor(graph, view, reference)` returns contextual information.
  The caller supplies the same graph snapshot that produced the view.
- `VISUALIZATION_RULES_VERSION` is `0.1`, independent from the domain, physical
  schema and graph versions. The projection reports this in its metadata.

One entry point selects the perspective through `viewType`; redundant perspective
wrappers are intentionally omitted. All four perspectives share one view contract.
The caller supplies a nonempty `viewId`; projection generates no IDs or timestamps.

`VisualizationView` contains identity, perspective, architecture reference, optional
focus, candidate nodes, edges, routes, filters, selection context, semantic frame and
projection metadata. Hidden recovered candidates may remain in these arrays: these
are not arrays of exclusively rendered objects. Entities not recovered remain only
in the graph. Display membership means `visibility === VISIBLE`.

`VisualNode` uses graph identity for both its view key and graph reference. It contains
type, ID, optional label, exposure, visibility, emphasis, positioning, selection/focus,
representation role and optional minimum BFS depth. It never embeds a domain entity.
ENTITY, CONTEXT and SUPPORT are representation roles, not domain types or shapes.
Architecture and FlowFamily are context; Layer, Position, Responsibility,
DecisionReference and FlowSegment are support. A support record is not an instruction
to draw an independent box. Layers are represented by the semantic frame by default.

`VisualEdge` preserves graph key, oriented endpoints, edge type and copied provenance,
along with exposure/visibility/emphasis. Both endpoints must exist in the projection.
No inverse duplicates, merged initiates/uses, contractions or shortcuts are created.

## State, precedence and errors

View State contains viewId/type, optional focus and selection, filters, expansions,
orientationBase, activeRoute and context override. It is not persisted or globally stored.
Reference arrays and set-like filters are deduplicated and sorted; references contain
only entityType/entityId. Input arrays and references are never changed.

Operational precedence, approved for conservative implementation:

1. Validate perspective, IDs, all supplied references, filters and context parameters.
   FOCUS requires focus; FLOW requires Flow; FLOW_FAMILY requires FlowFamily.
2. Recover perspective scope and explicit orientation base. Direct FOCUS has no
   implicit full-map base: only its bounded context and the always-present 8x3 frame.
3. Enrich from route composition. Active route must be a Flow; FLOW cannot select a
   different active Flow, and FLOW_FAMILY requires membership in its focal family.
4. Apply explicitly requested expansions, one graph neighborhood per reference.
   Each expansion must identify an already recovered candidate. Expansion order
   follows canonical reference order, allowing deterministic chained expansions.
5. Apply filters and exposure/visibility rules. Neither focus, route nor expansion
   overrides a failing explicit filter. A filtered focus keeps its identity but is hidden.
6. Resolve selection: existing matching secondary candidates may be revealed by
   selection. An entity outside the recovered candidates or rejected by filters is
   cleared, with `selectionCleared` reported and selection removed from effective state.
7. Project edges and route visibility. Hidden endpoints never yield a visible edge.

Selection is independent of focus. A nonexistent selection is INVALID_SELECTION;
an existing selection outside display membership is cleared, never retained latently.
Errors also distinguish FOCUS_REQUIRED, INVALID_FOCUS_TYPE, FOCUS_NOT_FOUND,
INVALID_VIEW_TYPE, INVALID_FILTERS, INVALID_CONTEXT, INVALID_REFERENCE,
INVALID_ACTIVE_ROUTE, INVALID_PARAMETERS, GRAPH_ERROR and INTERNAL_ERROR.
Graph query errors preserve the graph error as a cause; failures return no partial view.

## Perspective catalog and context defaults

| Perspective | Scope/defaults                                                                                               | Primary entities                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| FULL_MAP    | Enumerate all canonical kinds; no generic traversal or context override                                      | Elements, BusinessCapabilities, Processes                                                               |
| FOCUS       | BFS maxDepth 2, both directions, all canonical edge types                                                    | Elements, BusinessCapabilities, Processes, Roles, BusinessRules, Flows, focus                           |
| FLOW        | Complete focal Flow composition plus explicitly named one-hop context; no generic traversal/context override | Flow, FlowSegments, participant Elements, Flow payloads                                                 |
| FLOW_FAMILY | BFS maxDepth 3, both directions, restricted family edge catalog                                              | Elements, BusinessCapabilities, Processes, Roles, BusinessRules, Flows; family remains external context |

Architecture and FlowFamily context records are exposed without making them principal
canvas entities. Layer support is HIDDEN by default. Other kinds are SECONDARY unless
they are the focus or a perspective-specific primary DataObject.
Primary normally means visible; secondary normally means hidden until expansion or
selection. SECONDARY remains SECONDARY when revealed. Explicit filters set failing
candidates to HIDDEN exposure/visibility. Visibility and emphasis are independent:
VISIBLE/HIDDEN vs NORMAL/HIGHLIGHTED/ATTENUATED, without rendering instructions.

FOCUS BFS expands BusinessCapability, Element, Relationship, Process, Flow,
FlowSegment, Role, Responsibility, BusinessRule and RuleImplementation. DataObject,
Layer, FlowFamily, Position and DecisionReference are terminal unless the caller
explicitly overrides permitted expansion kinds. Graph BFS preserves minimum depths
and cycle safety. Caller overrides must specify a finite integer maxDepth >= 0 and
an explicit direction; omitted edge/type filters inherit the perspective default.

FLOW_FAMILY BFS expands only Flow, FlowSegment and BusinessCapability after the
explicit family start. Its edge catalog is defined in `rules.ts`: family membership,
flow composition/endpoints/payloads, segment endpoints/payloads/relationship,
capability family/process/role, responsibility capability, process initiates/uses,
role flow/segment, and business-rule flow/segment. Terminal processes and roles do
not continue generic traversal into unrelated systems. Family filter membership uses
this same fixed bounded catalog, not unrestricted connected-component membership.

FOCUS on a Flow also preserves its full route descriptor. Routes enrich recovered Flows by their complete finite composition, even if a route
contains more segments than BFS depth. This is not generic traversal or inferred
connectivity. Minimum depth is reported only for actual BFS visits, not invented for
route enrichment, explicit expansions or orientation-only nodes. FLOW context adds
only family, initiating/using Processes, associated Roles and BusinessRules through
named immediate graph edges. Active route enrichment uses the same finite rules.

FOCUS and FLOW_FAMILY preserve caller-supplied previously visible orientation entities.
Unrelated base candidates remain VISIBLE/ATTENUATED unless filters reject them.
The caller supplies references, never the previous Architecture or domain objects.
v0.1 uses attenuation as the base Focus behavior; future fade/transition/preservation
modes are not implemented. FULL_MAP imposes no arbitrary numeric budget.

## Positioning and filters

The semantic frame always contains the approved eight APS columns and BUSINESS,
APPLICATION, TECHNOLOGY levels. These are axes, not additional nodes or coordinates.

DIRECT = Element; LOGICAL = BusinessRule; ACTUAL = RuleImplementation. Layer links
come from graph edges; APS membership comes from public positioning indexes, including
inheritance through Layer ancestors. Domain ArchitectureLevel is copied only when
explicitly declared. BusinessRule never inherits a level from RuleImplementation;
RuleImplementation never inherits a Layer from its executors.

Process, Role and BusinessCapability receive `presentationLevel: BUSINESS`, with
VISUAL_RULE evidence, not `architectureLevel`. They receive no inferred APS. The
BusinessCapability fixed BUSINESS/grouping treatment is revisable in future versions.
FlowFamily remains external context without matrix position; that base-v0.1 decision
is also revisable, not changed here.

Position evidence records property, source and domain field/entity or visual rule.
POSITIONED means APS plus declared level; PARTIALLY_POSITIONED means only one axis
or BUSINESS presentation without APS; UNPOSITIONED means neither available for an
architecturally positioned entity. NOT_APPLICABLE covers context/support entities
without matrix positioning. A declared Layer without resolvable APS does not invent
a column. Incompleteness is valid, never a projection error.

Filters support entityTypes, apsLayers, architectureLevels, flowFamilies, edgeTypes,
positioningRoles, layers and elementTypes. OR within a filter; AND across filters;
absent means unrestricted; empty means zero visible results. Matching nodes remain
subject to disclosure: a type filter alone does not reveal secondary detail.
Positional filters exclude candidates missing the requested property, including
NOT_APPLICABLE entities. architectureLevels matches declared domain levels only,
never presentationLevel. layers matches exact declared Layer, not ancestors;
elementTypes excludes other kinds. Nonempty edgeTypes filters edges, not traversal
intermediaries or isolated nodes; an empty edgeTypes filter selects nothing.

The explicit primary edge catalog in `rules.ts` covers narrative, process/data/flow,
flow composition/endpoints/payloads, segment endpoints/payloads and Relationship
topology. Other canonical edges are secondary and require expansion or selection
at an endpoint. Node retrieval filters never reinterpret architectural semantics.
Context edgeTypes controls BFS expansion; View State filter edgeTypes controls the
projected edge set. No edge with hidden endpoint is visible regardless of priority.

## Flows, relationships and information

FlowRoute is a separate descriptor, never VisualEdge. It preserves Flow identity and
ordered FlowSegment descriptors with owner, sequence, source, target, payloads,
optional Relationship and supporting real graph-edge keys. Sequence exclusively
determines route order. Routes do not create Element -> Element graph shortcuts.
A route is hidden when filters reject its Flow/elements/payloads or exclude its
supporting edges; the complete descriptor remains available without dataset correction.
Hidden Relationship detail alone does not suppress a route.

Flow payload DataObjects are primary in FLOW (and when explicitly activating that
route); direct Process DataObjects are primary in Process FOCUS. Other DataObjects
are secondary. They inherit no positioning from producers/consumers, and no
transformation is invented. Relationship is secondary/initially hidden and revealed
from Element or FlowSegment. Its topology remains Element -> Relationship -> Element.
This representation is revisable in future versions only if navigation, performance,
visualization or new requirements justify it; no contraction is implemented now.

Information descriptors are read on demand from graph identity/entity/neighbors.
They include optional name/title/description, focused/selected states, position and
evidence, immediate relevant canonical relationships and their direction/provenance,
specific scalar descriptive fields, and related DecisionReferences. Missing names
are not invented. BusinessRule descriptors list logical position separately from
each implementation's actual position/type. Flow descriptors retain full route and
sequence. No gaps, findings, scores, calculated risks or economic metrics are added.

## Determinism and exclusions

Ordinal ordering, stable graph identity, normalized set-like state, explicit rule
catalogs and segment sequence guarantee reproducibility. No locale, random ID,
timestamp or accidental array order defines output. Graph and input state are unchanged.
Projection outputs are independent containers, not a global store or persistent model.

No dependencies, dataset-specific ADN logic, Visualization Engine, UI, layout,
coordinates, styles, rendering technologies, search, saved views, persistence,
Gap/Analysis Engine, LEM or Detective Mode are implemented.
