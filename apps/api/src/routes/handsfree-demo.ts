import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type HtmlHandlerResult = {
  status: number;
  body: string;
  contentType: string;
};

export async function handsfreeDemoRoute(): Promise<HtmlHandlerResult> {
  try {
    const htmlPath = path.resolve(__dirname, "../static/handsfree-demo.html");
    const html = readFileSync(htmlPath, "utf8");
    return {
      status: 200,
      body: html,
      contentType: "text/html; charset=utf-8",
    };
  } catch (error) {
    return {
      status: 500,
      body: `<h1>Error cargando demo handsfree</h1><pre>${String(error)}</pre>`,
      contentType: "text/html; charset=utf-8",
    };
  }
}
