import type { DecisionProviderResult, DecisionResolutionRequest } from "./types.js";

/** Technology port implemented by source-specific adapters outside the core capability. */
export interface DecisionProvider {
  readonly id: string;
  resolve(request: DecisionResolutionRequest): Promise<DecisionProviderResult>;
}
