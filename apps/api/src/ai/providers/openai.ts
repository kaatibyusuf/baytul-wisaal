import { parseJsonLoose, postJson } from "../http";
import { LlmProvider, LlmRequest, ProviderError } from "../types";

/** OpenAI Chat Completions in JSON mode. Newer models require max_completion_tokens. */
export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {}

  async generateJson(req: LlmRequest): Promise<unknown> {
    const data = await postJson(
      this.name,
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        max_completion_tokens: req.maxTokens,
        response_format: { type: "json_object" },
        messages: [
          // JSON mode requires the word "JSON" to appear in the messages.
          { role: "system", content: `${req.system}\n\nRespond with a single JSON object and nothing else.` },
          { role: "user", content: req.user },
        ],
      },
    );
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new ProviderError(this.name, "empty response", true);
    }
    return parseJsonLoose(this.name, text);
  }
}
