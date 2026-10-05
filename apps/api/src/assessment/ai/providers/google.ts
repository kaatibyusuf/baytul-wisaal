import { postJson, ProviderError } from "../http";
import { LlmProvider, LlmRequest } from "../types";

/** Google Gemini generateContent with a JSON response schema. */
export class GoogleProvider implements LlmProvider {
  readonly name = "google";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta",
  ) {}

  async completeJson(req: LlmRequest): Promise<unknown> {
    const json = await postJson({
      provider: this.name,
      url: `${this.baseUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      headers: { "x-goog-api-key": this.apiKey },
      body: {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: req.schema,
          maxOutputTokens: Math.max(req.maxTokens, 8000),
        },
      },
    });
    if (json?.promptFeedback?.blockReason) {
      throw new ProviderError(this.name, `blocked by the provider's safety filter (${json.promptFeedback.blockReason})`);
    }
    const parts = json?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? "").join("") : "";
    if (!text) throw new ProviderError(this.name, `no result returned (finish reason: ${json?.candidates?.[0]?.finishReason ?? "unknown"})`);
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError(this.name, "result was not valid JSON");
    }
  }
}
