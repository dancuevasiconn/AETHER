import type { DecisionReference } from "../domain/index.js";
import type { GraphStep } from "../graph/index.js";
import type { EntityReference } from "../visualization/index.js";

export type DecisionResolutionStatus =
  | "RESOLVED"
  | "UNRESOLVED"
  | "NOT_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "ACCESS_DENIED"
  | "INVALID_ARTIFACT";

export interface DecisionArtifactIdentity {
  readonly sourceId: string;
  readonly externalDecisionId: string;
}

export interface DecisionLifecycleStatus {
  /** Exact value reported by the authoritative source. */
  readonly raw: string;
  readonly scheme?: string;
  /** Present only when a provider applies an explicit, approved mapping. */
  readonly normalized?: string;
}

export interface DecisionArtifactSection {
  readonly key: string;
  readonly title?: string;
  readonly content: string;
  readonly mediaType?: string;
}

export interface DecisionArtifactRelationship {
  readonly type: string;
  readonly target: DecisionArtifactIdentity;
  readonly evidence: "SOURCE_DECLARED";
  readonly description?: string;
}

export interface DecisionProvenance {
  readonly sourceId: string;
  readonly providerId: string;
  readonly locator: string;
  readonly sourceRevision?: string;
  readonly retrievedAt?: string;
  readonly contentVersion?: string;
}

/** Read-only external decision representation; it is not an Architecture entity. */
export interface DecisionArtifact {
  readonly identity: DecisionArtifactIdentity;
  readonly title: string;
  readonly lifecycleStatus: DecisionLifecycleStatus;
  readonly summary?: string;
  readonly sections?: readonly DecisionArtifactSection[];
  readonly relationships?: readonly DecisionArtifactRelationship[];
  readonly provenance: DecisionProvenance;
}

export interface DecisionResolutionRequest extends DecisionArtifactIdentity {
  readonly locator: string;
  readonly sourceRevision?: string;
}

export type DecisionProviderResult =
  | { readonly status: "RESOLVED"; readonly artifact: DecisionArtifact }
  | {
      readonly status: Exclude<DecisionResolutionStatus, "RESOLVED" | "UNRESOLVED">;
      readonly message?: string;
    };

export interface DecisionResolutionContext {
  readonly providerId: string;
  readonly request: DecisionResolutionRequest;
  readonly relatedContext?: {
    readonly maxDepth: number;
    readonly direction: "outgoing" | "incoming" | "both";
  };
}

export type DecisionWarningCode = "STATUS_MISMATCH" | "LATEST_UNPINNED";
export interface DecisionWarning {
  readonly code: DecisionWarningCode;
  readonly message: string;
}

export interface RelatedDecisionContext {
  readonly classification: "RELATED_CONTEXT";
  readonly reference: EntityReference;
  readonly fromDirectlyAffected: EntityReference;
  readonly path: {
    readonly nodes: readonly EntityReference[];
    readonly steps: readonly GraphStep[];
  };
}

export interface DecisionReferenceSnapshot {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly reference: string;
  readonly description?: string;
}

export interface DecisionDetailDescriptor {
  readonly decisionReference: DecisionReferenceSnapshot;
  readonly resolution:
    | { readonly status: "RESOLVED"; readonly artifact: DecisionArtifact }
    | {
        readonly status: Exclude<DecisionResolutionStatus, "RESOLVED">;
        readonly message?: string;
      };
  readonly directlyAffected: readonly {
    readonly classification: "DIRECTLY_AFFECTED";
    readonly reference: EntityReference;
  }[];
  readonly relatedContext: readonly RelatedDecisionContext[];
  readonly warnings: readonly DecisionWarning[];
}

export interface DecisionService {
  resolve(
    reference: DecisionReference,
    context?: DecisionResolutionContext,
  ): Promise<DecisionDetailDescriptor>;
}
