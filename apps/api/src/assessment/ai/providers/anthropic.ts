import { postJson, ProviderError } from "../http";
import { LlmProvider, LlmRequest } from "../types";

/** Anthropic Messages API. Structured output is forced through a single tool call. */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly baseUrl = "https://api.anthropic.com",
  ) {}

  async completeJson(req: LlmRequest): Promise<unknown> {
    const json = await postJson({
      provider: this.name,
      url: `${this.baseUrl}/v1/messages`,
      headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: {
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: req.schemaName, description: "Record the structured evaluation.", input_schema: req.schema }],
        tool_choice: { type: "tool", name: req.schemaName },
      },
    });
    const block = (json?.content ?? []).find((b: any) => b?.type === "tool_use");
    if (!block?.input) throw new ProviderError(this.name, "no structured result returned");
    return block.input;
  }
}
