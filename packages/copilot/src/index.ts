import { answerCopilotQuestion } from "./answerQuestion";
import { buildStructuredPrompt } from "./prompt";
import type { CopilotQuestionInput, CopilotResponse } from "./types";

export type CopilotEngineOutput = {
  response: CopilotResponse;
  prompt: ReturnType<typeof buildStructuredPrompt>;
};

export function runCopilot(input: CopilotQuestionInput): CopilotEngineOutput {
  const prompt = buildStructuredPrompt(input);
  const response = answerCopilotQuestion(input);

  return {
    response,
    prompt,
  };
}

export type * from "./types";
