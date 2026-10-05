import { postJson, ProviderError } from "../http";
import { LlmProvider, LlmRequest } from "../types";

/** OpenAI Chat Completions with strict structured outputs (json_schema). */
export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = "https://api.openai.com",
  ) {}

  async completeJson(req: LlmRequest): Promise<unknown> {
    const json = await postJson({
      provider: this.name,
      url: `${this.baseUrl}/v1/chat/completions`,
      headers: { authorization: `Bearer ${this.apiKey}` },
      body: {
        model: this.model,
        // Reasoning models spend part of this budget thinking, so it is deliberately generous.
        max_completion_tokens: Math.max(req.maxTokens, 8000),
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: req.schemaName, strict: true, schema: req.schema },
        },
      },
    });
    const message = json?.choices?.[0]?.message;
    if (message?.refusal) throw new ProviderError(this.name, "the model declined to evaluate this");
    if (typeof message?.content !== "string") throw new ProviderError(this.name, "no structured result returned");
    try {
      return JSON.parse(message.content);
    } catch {
      throw new ProviderError(this.name, "result was not valid JSON");
    }
  }
}
