import { runCopilot, type CopilotQuestionInput } from "@damm/copilot";

export type HandlerResult = {
  status: number;
  body: unknown;
};

export async function copilotRoute(body: unknown): Promise<HandlerResult> {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: { error: "Body JSON invalido" },
    };
  }

  const input = body as CopilotQuestionInput;
  if (!input.currentStopId || !input.question) {
    return {
      status: 400,
      body: { error: "Faltan campos obligatorios: currentStopId y question" },
    };
  }

  const output = runCopilot(input);

  return {
    status: 200,
    body: output,
  };
}
