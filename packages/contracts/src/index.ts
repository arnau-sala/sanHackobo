/**
 * Re-exports only — keep shared shapes discoverable for frontend/backend without
 * importing internal paths of other packages.
 */
export type {
  CopilotAction,
  CopilotQuestionInput,
  CopilotResponse,
  InputData,
  LoadPlan,
  RoutePlan as CopilotRoutePlan,
} from "@damm/copilot";

export type {
  Depot,
  Driver,
  InputPayload,
  Order,
  RoutePlan,
  ScoringWeights,
  Stop,
  Vehicle,
} from "@damm/optimizer-route";
