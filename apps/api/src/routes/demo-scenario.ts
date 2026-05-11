import { readFileSync } from "fs";
import path from "path";

export type HandlerResult = {
  status: number;
  body: unknown;
};

export async function demoScenarioRoute(): Promise<HandlerResult> {
  const demoPath = path.resolve(
    process.cwd(),
    "packages/mock-data/demo-scenario.json",
  );

  try {
    const raw = readFileSync(demoPath, "utf8");
    return {
      status: 200,
      body: JSON.parse(raw),
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        error: "No se pudo cargar demo-scenario.json",
        details: String(error),
      },
    };
  }
}
