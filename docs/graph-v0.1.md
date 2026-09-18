# Graph Engine v0.1

## Integrity and scope

The Domain Model is the canonical source of architectural truth. The Graph Engine
is a reconstructible in-memory projection, not another Architecture or persistence
model. Canonical model → single source → derived projections.

Only the approved canonical fields produce edges. Loader-generated inverse fields
are never additional inputs. There is no bilateral merge, reconciliation, inference,
or correction. Context follows existing edges through traversal; contextual
shortcuts such as FlowFamily → Element are not materialized.

## Snapshot consistency

`createGraph` first calls the existing Domain Validator. Invalid input returns its
errors without producing a partial graph. Valid input is cloned once into a private
snapshot. Nodes and edges (including provenance) are frozen; returned lists are
separate containers. `getEntity` and `getFlowSegments` return independent copies,
never private entity references. Neither external input changes nor edits to query
results can affect the private snapshot. Build a new graph to reflect changes.
There is no incremental update.

## Identity and direction

Nodes contain only `entityType`, `entityId`, and `key`. Keys encode the pair as a
JSON array, preserving opaque IDs without delimiter ambiguity. Architecture is a
node but has no artificial containment edges. ApsLayer and ArchitectureLevel are
indexes, never nodes.

Edges use `Owner.relation` types and encode type/source/target in their keys.
Provenance identifies the owner node and domain field, without array offsets.
One logical edge is referenced by both adjacency indexes. Inverse traversal returns
the same oriented edge with an explicit `inverse` step. Distinct initiates/uses
connections coexist; identical repeated references do not multiply edges.

Relationship is a domain entity and a graph node, not a Graph Edge. In v0.1 its
projection is source Element → Relationship → target Element. No direct duplicate
Element → Element shortcut is added. This can be reevaluated in future versions
only if actual navigation, performance, visualization, or requirements justify it.

Flow membership/composition is the approved exception: `flowSegmentIds` and
`flowId` support one edge with evidence from both fields. Segment sequence remains
in the snapshot; `getFlowSegments` follows Flow composition and sorts by sequence.

## Positioning

Layer and APS indexes distinguish DIRECT (Element), LOGICAL (BusinessRule), and
ACTUAL (RuleImplementation). Layer queries match exact declared Layer; APS queries
derive membership through Layer ancestors. `getLayersByApsLayer` includes the root
and descendants. ArchitectureLevel includes only explicit Element and
RuleImplementation values, without defaults or artificial positioning.

## Search and determinism

Navigation defaults to outgoing, except context requires explicit direction.
BFS requires finite integer `maxDepth >= 0`, expands each node at most once, and
records minimum depths. Result type filters affect output only. Expansion type
filters allow a reached node to appear as a terminal node but prevent expanding it;
the explicit start remains expandable. Empty filter arrays select nothing.
`includeStart` applies to traversal; context always retains its explicit focus.

Traversal steps retain explored connections, including intermediaries excluded by
result filters. Context instead includes only allowed edges with both endpoints in
its returned node set. It never adds external endpoints.

Unweighted shortest paths report found, not-found after exhausting the permitted
reachable region, or depth-limit-reached when eligible unvisited nodes remain beyond
the limit. Filters and direction define the scope: connectivity is not causality,
data movement, architectural quality, or a finding.

Ordinal comparisons (never locale or names), sorted adjacency, stable BFS order,
stable path tie-breaking, and deduplication ensure same input → same graph → same
query result. Reordering arrays without graph ordering semantics has no effect;
FlowSegment.sequence is respected. General graph cycles are valid and cycle-safe.

## Errors and boundaries

Public queries return `GraphResult`: success/value or failure/error. Errors distinguish
INVALID_ARCHITECTURE (preserving validator errors), NODE_NOT_FOUND, INVALID_PARAMETERS,
and INTERNAL_ERROR. An isolated existing node returns success with an empty neighborhood.
No internal index Maps are exposed.

v0.1 paths are exclusively connectivity. Future versions may use a separate LEM
engine for weights, costs, value, and economic metrics over routes; none is implemented.
No visualization, analysis, gaps, scoring, query language, databases, or dataset-specific
knowledge belongs to this engine.
