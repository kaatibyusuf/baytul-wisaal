import { parseJsonLoose, postJson } from "../http";
import { LlmProvider, LlmRequest, ProviderError } from "../types";

/** Google Gemini generateContent REST API in JSON mode. */
export class GoogleProvider implements LlmProvider {
  readonly name = "google";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateJson(req: LlmRequest): Promise<unknown> {
    const data = await postJson(
      this.name,
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      { "x-goog-api-key": this.apiKey },
      {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxTokens },
      },
    );
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "";
    if (!text.trim()) {
      const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason;
      throw new ProviderError(this.name, `empty response${reason ? ` (${reason})` : ""}`, true);
    }
    return parseJsonLoose(this.name, text);
  }
}
