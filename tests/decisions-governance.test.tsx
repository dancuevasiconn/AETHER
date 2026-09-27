import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/example-architecture-v0.1.json" with { type: "json" };
import {
  createDecisionService,
  createGraph,
  createNavigationState,
  loadArchitectureFromJson,
  validateArchitecture,
} from "../src/index.js";
import type {
  DecisionArtifact,
  DecisionDetailDescriptor,
  DecisionProvider,
  DecisionProviderResult,
  DecisionReference,
  DecisionResolutionContext,
} from "../src/index.js";
import { InformationCard } from "../src/ui/InformationCard.js";

function setup() {
  const loaded = loadArchitectureFromJson(JSON.stringify(fixture));
  if (!loaded.success) throw new Error(JSON.stringify(loaded));
  const created = createGraph(loaded.architecture);
  if (!created.success) throw new Error(JSON.stringify(created));
  const node = created.value.getNode("DecisionReference", "decision-1");
  if (!node.success) throw new Error(JSON.stringify(node));
  const entity = created.value.getEntity(node.value.key);
  if (!entity.success) throw new Error(JSON.stringify(entity));
  return {
    architecture: loaded.architecture,
    graph: created.value,
    reference: entity.value as DecisionReference,
  };
}

const artifact: DecisionArtifact = {
  identity: { sourceId: "test-source", externalDecisionId: "ADR-001" },
  title: "External decision",
  lifecycleStatus: { raw: "example", scheme: "test-lifecycle" },
  summary: "External authoritative summary.",
  sections: [{ key: "arbitrary", title: "Provider section", content: "Neutral content" }],
  relationships: [
    {
      type: "depends_on",
      target: { sourceId: "test-source", externalDecisionId: "ADR-000" },
      evidence: "SOURCE_DECLARED",
    },
  ],
  provenance: {
    sourceId: "test-source",
    providerId: "fake",
    locator: "opaque-locator",
    sourceRevision: "revision-7",
    contentVersion: "content-2",
  },
};

function provider(result: DecisionProviderResult): DecisionProvider {
  return { id: "fake", resolve: vi.fn(() => Promise.resolve(structuredClone(result))) };
}

function context(sourceRevision?: string): DecisionResolutionContext {
  return {
    providerId: "fake",
    request: {
      sourceId: "test-source",
      externalDecisionId: "ADR-001",
      locator: "opaque-locator",
      ...(sourceRevision === undefined ? {} : { sourceRevision }),
    },
    relatedContext: { maxDepth: 1, direction: "both" },
  };
}

describe("Decisions & Governance v0.1 resolution", () => {
  it("resolves an artifact and preserves optional content, relationships and provenance", async () => {
    const { graph, reference } = setup();
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact })],
    }).resolve(reference, context("revision-7"));
    expect(detail.resolution).toEqual({ status: "RESOLVED", artifact });
    expect(detail.warnings).toEqual([]);
  });

  it("returns UNRESOLVED when context or provider configuration is absent", async () => {
    const { graph, reference } = setup();
    const service = createDecisionService({ graph });
    expect((await service.resolve(reference)).resolution.status).toBe("UNRESOLVED");
    expect((await service.resolve(reference, context())).resolution.status).toBe("UNRESOLVED");
  });

  it.each(["NOT_FOUND", "SOURCE_UNAVAILABLE", "ACCESS_DENIED", "INVALID_ARTIFACT"] as const)(
    "represents expected %s without throwing or invalidating Architecture",
    async (status) => {
      const { architecture, graph, reference } = setup();
      expect(validateArchitecture(architecture).valid).toBe(true);
      const detail = await createDecisionService({
        graph,
        providers: [provider({ status, message: "Observable outcome" })],
      }).resolve(reference, context("revision-7"));
      expect(detail.resolution).toEqual({ status, message: "Observable outcome" });
      expect(validateArchitecture(architecture).valid).toBe(true);
    },
  );

  it("keeps ACCESS_DENIED distinct from SOURCE_UNAVAILABLE", async () => {
    const { graph, reference } = setup();
    const denied = await createDecisionService({
      graph,
      providers: [provider({ status: "ACCESS_DENIED" })],
    }).resolve(reference, context("revision-7"));
    const unavailable = await createDecisionService({
      graph,
      providers: [provider({ status: "SOURCE_UNAVAILABLE" })],
    }).resolve(reference, context("revision-7"));
    expect(denied.resolution.status).toBe("ACCESS_DENIED");
    expect(unavailable.resolution.status).toBe("SOURCE_UNAVAILABLE");
  });

  it("reports STATUS_MISMATCH without changing either status", async () => {
    const { graph, reference } = setup();
    const changed = { ...artifact, lifecycleStatus: { raw: "Accepted" } };
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact: changed })],
    }).resolve(reference, context("revision-7"));
    expect(detail.warnings.map((warning) => warning.code)).toContain("STATUS_MISMATCH");
    expect(detail.decisionReference.status).toBe("example");
    expect(
      detail.resolution.status === "RESOLVED" && detail.resolution.artifact.lifecycleStatus.raw,
    ).toBe("Accepted");
  });

  it("preserves raw status and honors only provider-supplied normalization", async () => {
    const { graph, reference } = setup();
    const mapped = {
      ...artifact,
      lifecycleStatus: { raw: "Ejemplo", scheme: "localized", normalized: "example" },
    };
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact: mapped })],
    }).resolve(reference, context("revision-7"));
    expect(detail.warnings).toEqual([]);
    expect(
      detail.resolution.status === "RESOLVED" && detail.resolution.artifact.lifecycleStatus,
    ).toEqual(mapped.lifecycleStatus);
  });

  it("passes an exact pinned revision to the provider", async () => {
    const { graph, reference } = setup();
    const requests: DecisionResolutionContext["request"][] = [];
    const fake: DecisionProvider = {
      id: "fake",
      resolve: (request) => {
        requests.push(request);
        return Promise.resolve({ status: "RESOLVED", artifact });
      },
    };
    const detail = await createDecisionService({ graph, providers: [fake] }).resolve(
      reference,
      context("revision-7"),
    );
    expect(requests).toEqual([expect.objectContaining({ sourceRevision: "revision-7" })]);
    expect(detail.warnings.map((warning) => warning.code)).not.toContain("LATEST_UNPINNED");
  });

  it("marks a latest lookup LATEST_UNPINNED", async () => {
    const { graph, reference } = setup();
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact })],
    }).resolve(reference, context());
    expect(detail.warnings.map((warning) => warning.code)).toContain("LATEST_UNPINNED");
  });

  it("does not invent unavailable provenance", async () => {
    const { graph, reference } = setup();
    const minimal = {
      ...artifact,
      provenance: { sourceId: "test-source", providerId: "fake", locator: "opaque" },
    };
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact: minimal })],
    }).resolve(reference, context("revision-7"));
    if (detail.resolution.status !== "RESOLVED") throw new Error("Expected resolution");
    expect(detail.resolution.artifact.provenance).toEqual(minimal.provenance);
    expect(detail.resolution.artifact.provenance).not.toHaveProperty("retrievedAt");
  });

  it("keeps artifact identity independent from locator and revision", () => {
    expect(artifact.identity).toEqual({ sourceId: "test-source", externalDecisionId: "ADR-001" });
    expect(artifact.identity).not.toHaveProperty("locator");
    expect(artifact.identity).not.toHaveProperty("sourceRevision");
  });
});

describe("Decisions & Governance impact and boundaries", () => {
  it("labels only affectedObjects as DIRECTLY_AFFECTED and Graph discoveries as RELATED_CONTEXT", async () => {
    const { graph, reference } = setup();
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact })],
    }).resolve(reference, context("revision-7"));
    expect(detail.directlyAffected).toEqual(
      reference.affectedObjects.map((item) => ({
        classification: "DIRECTLY_AFFECTED",
        reference: { entityType: item.entityType, entityId: item.entityId },
      })),
    );
    expect(detail.relatedContext.length).toBeGreaterThan(0);
    expect(detail.relatedContext.every((item) => item.classification === "RELATED_CONTEXT")).toBe(
      true,
    );
    expect(
      detail.relatedContext.every(
        (item) => item.path.nodes.length >= 2 && item.path.steps.length >= 1,
      ),
    ).toBe(true);
  });

  it("preserves source-declared decision relationships and infers none", async () => {
    const { graph, reference } = setup();
    const noRelations = { ...artifact, relationships: [] };
    const detail = await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact: noRelations })],
    }).resolve(reference, context("revision-7"));
    if (detail.resolution.status !== "RESOLVED") throw new Error("Expected resolution");
    expect(detail.resolution.artifact.relationships).toEqual([]);
  });

  it("is deterministic for pinned identical inputs and does not mutate them", async () => {
    const { graph, reference } = setup();
    const before = structuredClone(reference);
    const service = createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact })],
    });
    expect(await service.resolve(reference, context("revision-7"))).toEqual(
      await service.resolve(reference, context("revision-7")),
    );
    expect(reference).toEqual(before);
  });

  it("does not change Navigation history merely by resolving an artifact", async () => {
    const { graph, reference } = setup();
    const navigation = createNavigationState({ viewId: "test", viewType: "FULL_MAP" });
    const before = structuredClone(navigation);
    await createDecisionService({
      graph,
      providers: [provider({ status: "RESOLVED", artifact })],
    }).resolve(reference, context("revision-7"));
    expect(navigation).toEqual(before);
  });

  it("renders resolved and unresolved Decision Detail in the Information Card", () => {
    const descriptor = {
      reference: { entityType: "DecisionReference", entityId: "decision-1" },
      graphNodeKey: "DecisionReference:decision-1",
      label: "Example Decision",
      focused: false,
      selected: true,
      semanticPosition: { provenance: [], positioningState: "NOT_APPLICABLE" },
      relations: [],
      specific: {},
      decisions: [],
      implementations: [],
    } as const;
    const unresolved: DecisionDetailDescriptor = {
      decisionReference: {
        id: "decision-1",
        title: "Example Decision",
        status: "example",
        reference: "Example reference",
      },
      resolution: { status: "UNRESOLVED" },
      directlyAffected: [],
      relatedContext: [],
      warnings: [],
    };
    const markup = renderToStaticMarkup(
      <InformationCard descriptor={descriptor} decisionDetail={unresolved} />,
    );
    expect(markup).toContain("Decision Detail");
    expect(markup).toContain("UNRESOLVED");
    expect(markup).not.toContain("decision badge");
  });
});
