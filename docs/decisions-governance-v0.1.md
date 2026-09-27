# Decisions & Governance v0.1

## Purpose and boundaries

Decisions & Governance is a read-only application capability connecting canonical architectural `DecisionReference` objects to externally resolved decision artifacts. `DecisionReference` remains part of, and authoritative in, the Architecture Model. `DecisionArtifact` remains an external-source representation and is not a canonical Architecture entity. It contains no copied Elements, Flows, BusinessRules or other complete Architecture entities.

The capability preserves the chain Architecture object → DecisionReference → resolution → DecisionArtifact → provenance, as well as the reverse interpretation from an artifact through its DecisionReference to explicitly affected Architecture objects. A decision is neither a BusinessRule nor a RuleImplementation, NavigationEntry or AuditEvent.

v0.1 is observational. It implements no editing, approval workflow, signatures, enforcement, policies, source writes, Git writes, audit subsystem, Detective Mode, scores, recommendations or automatic reconciliation.

## Source of truth and identity

The hybrid source model is authoritative:

- AETHER stores the canonical DecisionReference and its minimal architectural snapshot metadata.
- An external source stores the complete DecisionArtifact, lifecycle, content, decision relationships and provenance.

The identities remain separate: `DecisionReference.id` identifies the canonical Architecture reference; `(sourceId, externalDecisionId)` identifies an external artifact; `locator` describes retrieval; `sourceRevision` describes the resolved source revision. A path, human ADR number/title, locator change or source-revision change does not redefine logical artifact identity.

No production provider is selected. In particular, the capability assumes neither RDA, filesystem, Git, GitHub, Markdown nor HTTP. Provider configuration must be supplied externally; tests use in-memory fakes.

## Contracts and lifecycle

`DecisionArtifact` exposes identity, title, source-neutral lifecycle status, optional summary, optional extensible sections, optional source-declared decision relationships and provenance. Sections have no universal v0.1 taxonomy and do not assume Markdown. Future versions may enrich artifacts with metadata, evidence, structured content, lifecycle data, relationships and governance information without making them canonical Architecture entities.

Lifecycle status contains the exact source `raw` value, optional taxonomy `scheme`, and optional `normalized` value. Normalization is accepted only when a provider supplies an explicit approved mapping; core logic performs no heuristic mapping. `DecisionReference.status` and artifact lifecycle status may differ. Their difference emits `STATUS_MISMATCH` as evidence, never mutation or invalidation.

Decision relationships use extensible string types and identify targets by source ID plus external decision ID. They remain source-declared semantic decision-network evidence, not Architecture `Relationship` objects and not necessarily a hierarchy. Strong meanings such as `supersedes` or `conflicts_with` are never inferred from dates, status, titles, content similarity, shared impact or graph proximity.

## Provider and service

`DecisionProvider` is a technological port. A source adapter interprets source-specific locators, accesses a source, maps its physical representation to `DecisionArtifact`, supplies observed provenance and reports typed outcomes. The port depends on no React, SVG, Visualization or Navigation capability.

`DecisionService` is the application coordinator. It selects an externally configured provider, coordinates resolution, combines the canonical reference with external evidence, exposes direct impact and related architectural context, and creates a framework-neutral `DecisionDetailDescriptor`. It never accesses filesystem, Git, GitHub or APIs directly and never merges conflicting sources into synthetic truth.

The provider mechanism may grow to support new source types, authentication strategies, formats, revisions, offline behavior and specialized adapters without changing this conceptual model. Credentials and authentication material must never enter Architecture, artifact, public provenance, UI or repository content.

## Resolution and revision semantics

Resolution is a discriminated result. Normal source outcomes are values rather than exceptions:

- `RESOLVED`: retrieved and interpreted successfully.
- `UNRESOLVED`: insufficient provider/configuration information for a definitive attempt.
- `NOT_FOUND`: source queried successfully but artifact absent.
- `SOURCE_UNAVAILABLE`: source unavailable or unreachable.
- `ACCESS_DENIED`: source exists/responded but current authorization prevents retrieval.
- `INVALID_ARTIFACT`: retrieved content cannot satisfy the artifact contract.

`ACCESS_DENIED` and `SOURCE_UNAVAILABLE` remain distinct, and public results contain no sensitive details. This taxonomy is revisable: experience may add, consolidate, rename or remove statuses while preserving lifecycle status ≠ resolution status.

An explicit requested `sourceRevision` is passed unchanged to a capable provider and can support pinned reproducibility. Without one, the provider's current representation is requested and `LATEST_UNPINNED` records that it is not reproducible. `retrievedAt` is operational metadata, not semantic identity. v0.1 has no `STALE` status or heuristic detection.

Unresolved evidence never invalidates Architecture, DecisionReference or affected objects. Domain structural validity remains the Domain Validator's responsibility; external resolution remains this capability's responsibility.

## Provenance, impact and context

Resolved artifacts expose observed minimum provenance: `sourceId`, `providerId` and `locator`. `sourceRevision`, `retrievedAt` and `contentVersion` appear only when actually known. The service never manufactures provenance. Future provenance may add integrity evidence, signatures, authorship, retrieval context and traceability while distinguishing observation from inference.

Only `DecisionReference.affectedObjects` is labeled `DIRECTLY_AFFECTED`. `RELATED_CONTEXT` is derived through Graph Engine public traversal and path APIs. Each related result preserves its originating direct object, nodes and Graph steps as explanatory evidence. The capability owns no second traversal engine, duplicate inverse graph or Graph semantics.

## UI, visualization and navigation

The right-side Information Card receives a prepared Decision Detail descriptor and may show the canonical snapshot, resolution, artifact identity/title/lifecycle, summary, optional sections, impact, related context, relationships, provenance and warnings. It performs no resolution, source access, traversal or semantic inference. Its placement is revisable.

The React coordinator owns only temporary loading/result state and ignores stale asynchronous responses after selection changes. Missing configuration renders `UNRESOLVED`; it does not fail the application. No canonical or persistent `DecisionState` is introduced.

There remains one Navigation engine, one NavigationState and one history. Existing intents and Graph relationships navigate canonical DecisionReference objects. Artifact resolution is not architectural navigation and creates no history entry; v0.1 adds no `OPEN_DECISION`. Decisions may form a parallel contextual projection of the same semantic navigation without pretending contextual updates were separate user movements.

Visualization semantics are unchanged. v0.1 adds no canvas badge, governance indicator, decision filter, invented position or renderer-owned governance logic. Counts/details remain in the Information Card.

## Warnings and determinism

`STATUS_MISMATCH` and `LATEST_UNPINNED` are extensible descriptive warnings, not scores, grades, corrections or enforcement. For identical reference, provider configuration, explicit revision and source content, resolution descriptors are deterministic. Provider-supplied operational timestamps are preserved but excluded from semantic identity.

## Deliberately deferred and future investigation

The following are explicitly outside v0.1 and require later architectural review:

1. A richer DecisionArtifact contract, evidence and structured content.
2. A richer provider ecosystem, authentication and offline strategies.
3. Revision of the mutable resolution-status taxonomy.
4. An objective `STALE` model using explicit comparison anchors such as Architecture version, expected/pinned and retrieved revisions, or content version—not merely noticing newer content.
5. Richer provenance, integrity, signatures and authorship.
6. A formal measurement model for strong decisions/relationships using approved observable dimensions such as scope, impact, precedence, dependency and obligatoriness.
7. Decision Detail evaluation metrics.
8. An explicit canvas indicator/badge model defining what is measured, ownership, Visualization input and renderer meaning.
9. Semantically mature decision/governance filters.
10. An approved descriptive governance/coverage model. Absence of DecisionReference does not equal a governance gap; v0.1 calculates no coverage, maturity or grade.
11. Whether persistent/canonical DecisionState is justified by snapshots, historical reconstruction, persisted evaluation, workflow, collaboration or audit requirements.
12. A multidimensional contextual-navigation model: projections, synchronization, primary versus contextual movement, influence direction, identity and history across governance, evidence, telemetry and processes.
13. Concrete production provider selection.

Decision artifacts, providers and resolution taxonomy are designed to evolve. None of these future areas authorizes current inference, scoring or a second source of truth.
