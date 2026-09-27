import type { DecisionReference } from "../domain/index.js";
import type { GraphEngine, GraphNode } from "../graph/index.js";
import type { EntityReference } from "../visualization/index.js";
import type { DecisionProvider } from "./decision-provider.js";
import type {
  DecisionDetailDescriptor,
  DecisionResolutionContext,
  DecisionWarning,
  RelatedDecisionContext,
} from "./types.js";

const entityReference = (node: GraphNode): EntityReference => ({
  entityType: node.entityType,
  entityId: node.entityId,
});

function snapshot(reference: DecisionReference) {
  return {
    id: reference.id,
    title: reference.title,
    status: reference.status,
    reference: reference.reference,
    ...(reference.description === undefined ? {} : { description: reference.description }),
  };
}

function direct(reference: DecisionReference) {
  return reference.affectedObjects.map((affected) => ({
    classification: "DIRECTLY_AFFECTED" as const,
    reference: { entityType: affected.entityType, entityId: affected.entityId },
  }));
}

function related(
  graph: GraphEngine,
  reference: DecisionReference,
  context: DecisionResolutionContext | undefined,
): readonly RelatedDecisionContext[] {
  if (!context?.relatedContext || context.relatedContext.maxDepth <= 0) return [];
  const directImpact = direct(reference);
  const directKeys = new Set<string>();
  for (const item of directImpact) {
    const node = graph.getNode(item.reference.entityType, item.reference.entityId);
    if (node.success) directKeys.add(node.value.key);
  }
  const decisionNode = graph.getNode("DecisionReference", reference.id);
  const candidates = new Map<string, RelatedDecisionContext>();
  for (const item of directImpact) {
    const origin = graph.getNode(item.reference.entityType, item.reference.entityId);
    if (!origin.success) continue;
    const traversed = graph.traverse(origin.value.key, {
      ...context.relatedContext,
      includeStart: false,
    });
    if (!traversed.success) continue;
    for (const node of traversed.value.nodes) {
      if (
        directKeys.has(node.key) ||
        (decisionNode.success && node.key === decisionNode.value.key) ||
        candidates.has(node.key)
      )
        continue;
      const path = graph.findPath(origin.value.key, node.key, context.relatedContext);
      if (!path.success || path.value.status !== "found") continue;
      candidates.set(node.key, {
        classification: "RELATED_CONTEXT",
        reference: entityReference(node),
        fromDirectlyAffected: item.reference,
        path: {
          nodes: path.value.nodes.map(entityReference),
          steps: path.value.steps.map((step) => structuredClone(step)),
        },
      });
    }
  }
  return [...candidates.values()].sort((a, b) =>
    `${a.reference.entityType}:${a.reference.entityId}`.localeCompare(
      `${b.reference.entityType}:${b.reference.entityId}`,
    ),
  );
}

export function createDecisionService(options: {
  readonly graph: GraphEngine;
  readonly providers?: readonly DecisionProvider[];
}): import("./types.js").DecisionService {
  const providers = new Map((options.providers ?? []).map((provider) => [provider.id, provider]));
  return Object.freeze({
    async resolve(
      reference: DecisionReference,
      context?: DecisionResolutionContext,
    ): Promise<DecisionDetailDescriptor> {
      const base = {
        decisionReference: snapshot(reference),
        directlyAffected: direct(reference),
        relatedContext: related(options.graph, reference, context),
      };
      if (!context) {
        return {
          ...base,
          resolution: {
            status: "UNRESOLVED" as const,
            message: "No provider resolution context is configured.",
          },
          warnings: [],
        };
      }
      const provider = providers.get(context.providerId);
      if (!provider) {
        return {
          ...base,
          resolution: {
            status: "UNRESOLVED" as const,
            message: "The configured decision provider is not available.",
          },
          warnings: context.request.sourceRevision
            ? []
            : [
                {
                  code: "LATEST_UNPINNED" as const,
                  message:
                    "Resolution requested the provider's current representation without a pinned revision.",
                },
              ],
        };
      }
      const result = await provider.resolve(structuredClone(context.request));
      const warnings: DecisionWarning[] = [];
      if (!context.request.sourceRevision)
        warnings.push({
          code: "LATEST_UNPINNED",
          message: "The resolved current representation is not pinned to a source revision.",
        });
      if (result.status !== "RESOLVED") return { ...base, resolution: { ...result }, warnings };
      const reportedStatus =
        result.artifact.lifecycleStatus.normalized ?? result.artifact.lifecycleStatus.raw;
      if (reportedStatus !== reference.status)
        warnings.push({
          code: "STATUS_MISMATCH",
          message:
            "Architecture snapshot status differs from the external decision lifecycle status.",
        });
      return {
        ...base,
        resolution: {
          status: "RESOLVED" as const,
          artifact: structuredClone(result.artifact),
        },
        warnings,
      };
    },
  });
}
