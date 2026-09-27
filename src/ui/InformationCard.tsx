import type { DecisionDetailDescriptor } from "../decisions-governance/index.js";
import type { NavigationOption } from "../navigation/index.js";
import type { EntityReference, InformationDescriptor } from "../visualization/index.js";

export interface InformationCardProps {
  readonly descriptor?: InformationDescriptor;
  readonly navigationOptions?: readonly NavigationOption[];
  readonly onOpen?: (reference: EntityReference) => void;
  readonly onFocus?: (reference: EntityReference) => void;
  readonly onOpenContext?: (reference: EntityReference) => void;
  readonly onOpenRelated?: (option: NavigationOption) => void;
  readonly decisionDetail?: DecisionDetailDescriptor;
  readonly decisionLoading?: boolean;
}
export function InformationCard({
  descriptor,
  navigationOptions = [],
  onOpen,
  onFocus,
  onOpenContext,
  onOpenRelated,
  decisionDetail,
  decisionLoading = false,
}: InformationCardProps) {
  if (!descriptor)
    return (
      <section className="information-card" aria-label="Information">
        <h2>Information</h2>
        <p>Select an entity to inspect it.</p>
      </section>
    );
  return (
    <section className="information-card" aria-label="Information">
      <h2>{descriptor.label ?? descriptor.reference.entityId}</h2>
      <p className="entity-type">{descriptor.reference.entityType}</p>
      {descriptor.description && <p>{descriptor.description}</p>}
      <div className="information-actions">
        <button onClick={() => onOpen?.(descriptor.reference)}>Open</button>
        <button onClick={() => onFocus?.(descriptor.reference)}>Focus</button>
        <button onClick={() => onOpenContext?.(descriptor.reference)}>Show context</button>
      </div>
      <dl>
        <dt>Position</dt>
        <dd>
          {descriptor.semanticPosition.apsLayer ?? "APS not specified"} /{" "}
          {descriptor.semanticPosition.architectureLevel ??
            descriptor.semanticPosition.presentationLevel ??
            "level not specified"}
        </dd>
        <dt>Relations</dt>
        <dd>{descriptor.relations.length}</dd>
        <dt>Decisions</dt>
        <dd>{descriptor.decisions.length}</dd>
      </dl>
      {navigationOptions.length > 0 && (
        <details>
          <summary>Related destinations</summary>
          <ul className="related-list">
            {navigationOptions.map((option) => (
              <li
                key={`${option.edgeKey}:${option.target.reference.entityType}:${option.target.reference.entityId}`}
              >
                <button onClick={() => onOpenRelated?.(option)}>
                  {option.direction === "inverse" ? "←" : "→"} {option.target.reference.entityType}:{" "}
                  {option.target.reference.entityId}
                </button>
                <small>{option.edgeType}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
      {descriptor.route && (
        <details>
          <summary>Flow route</summary>
          <ol>
            {descriptor.route.segments.map((segment) => (
              <li key={segment.graphNodeKey}>
                Segment {segment.sequence}: {segment.source.entityId} → {segment.target.entityId}
              </li>
            ))}
          </ol>
        </details>
      )}
      {descriptor.reference.entityType === "DecisionReference" && (
        <section className="decision-detail" aria-label="Decision Detail">
          <h3>Decision Detail</h3>
          {decisionLoading && <p role="status">Resolving external decision…</p>}
          {!decisionLoading && decisionDetail && (
            <>
              <dl>
                <dt>Resolution</dt>
                <dd>{decisionDetail.resolution.status}</dd>
                <dt>Architecture status</dt>
                <dd>{decisionDetail.decisionReference.status}</dd>
                {decisionDetail.resolution.status === "RESOLVED" && (
                  <>
                    <dt>Artifact</dt>
                    <dd>{decisionDetail.resolution.artifact.title}</dd>
                    <dt>Artifact identity</dt>
                    <dd>
                      {decisionDetail.resolution.artifact.identity.sourceId} /{" "}
                      {decisionDetail.resolution.artifact.identity.externalDecisionId}
                    </dd>
                    <dt>Lifecycle status</dt>
                    <dd>{decisionDetail.resolution.artifact.lifecycleStatus.raw}</dd>
                  </>
                )}
                <dt>Directly affected</dt>
                <dd>{decisionDetail.directlyAffected.length}</dd>
                <dt>Related context</dt>
                <dd>{decisionDetail.relatedContext.length}</dd>
              </dl>
              {decisionDetail.resolution.status !== "RESOLVED" &&
                decisionDetail.resolution.message && <p>{decisionDetail.resolution.message}</p>}
              {decisionDetail.resolution.status === "RESOLVED" &&
                decisionDetail.resolution.artifact.summary && (
                  <p>{decisionDetail.resolution.artifact.summary}</p>
                )}
              {decisionDetail.resolution.status === "RESOLVED" &&
                decisionDetail.resolution.artifact.sections && (
                  <div className="decision-sections">
                    {decisionDetail.resolution.artifact.sections.map((section) => (
                      <section key={section.key}>
                        {section.title && <h4>{section.title}</h4>}
                        <p>{section.content}</p>
                      </section>
                    ))}
                  </div>
                )}
              {decisionDetail.directlyAffected.length > 0 && (
                <details>
                  <summary>Directly affected objects</summary>
                  <ul>
                    {decisionDetail.directlyAffected.map((item) => (
                      <li key={`${item.reference.entityType}:${item.reference.entityId}`}>
                        {item.reference.entityType}: {item.reference.entityId}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {decisionDetail.relatedContext.length > 0 && (
                <details>
                  <summary>Related architectural context</summary>
                  <ul>
                    {decisionDetail.relatedContext.map((item) => (
                      <li key={`${item.reference.entityType}:${item.reference.entityId}`}>
                        {item.reference.entityType}: {item.reference.entityId} (
                        {item.path.steps.length} graph step{item.path.steps.length === 1 ? "" : "s"}
                        )
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {decisionDetail.resolution.status === "RESOLVED" &&
                decisionDetail.resolution.artifact.relationships &&
                decisionDetail.resolution.artifact.relationships.length > 0 && (
                  <details>
                    <summary>Decision relationships</summary>
                    <ul>
                      {decisionDetail.resolution.artifact.relationships.map((relationship) => (
                        <li
                          key={`${relationship.type}:${relationship.target.sourceId}:${relationship.target.externalDecisionId}`}
                        >
                          {relationship.type}: {relationship.target.sourceId} /{" "}
                          {relationship.target.externalDecisionId}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              {decisionDetail.resolution.status === "RESOLVED" && (
                <details>
                  <summary>Provenance</summary>
                  <dl>
                    <dt>Source</dt>
                    <dd>{decisionDetail.resolution.artifact.provenance.sourceId}</dd>
                    <dt>Provider</dt>
                    <dd>{decisionDetail.resolution.artifact.provenance.providerId}</dd>
                    <dt>Locator</dt>
                    <dd>{decisionDetail.resolution.artifact.provenance.locator}</dd>
                    {decisionDetail.resolution.artifact.provenance.sourceRevision && (
                      <>
                        <dt>Source revision</dt>
                        <dd>{decisionDetail.resolution.artifact.provenance.sourceRevision}</dd>
                      </>
                    )}
                  </dl>
                </details>
              )}
              {decisionDetail.warnings.length > 0 && (
                <ul className="decision-warnings">
                  {decisionDetail.warnings.map((warning) => (
                    <li key={warning.code}>{warning.code}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}
    </section>
  );
}
