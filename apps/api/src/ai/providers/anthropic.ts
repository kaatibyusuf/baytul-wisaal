import { postJson } from "../http";
import { LlmProvider, LlmRequest, ProviderError } from "../types";

/** Anthropic Messages API. Structured output is forced through a single tool call. */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async generateJson(req: LlmRequest): Promise<unknown> {
    const data = await postJson(
      this.name,
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      {
        model: this.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        tools: [
          {
            name: "submit_result",
            description: "Submit the result as a JSON object that follows the schema in the instructions.",
            input_schema: { type: "object", additionalProperties: true },
          },
        ],
        tool_choice: { type: "tool", name: "submit_result" },
      },
    );
    const block = (data?.content ?? []).find((b: { type: string }) => b.type === "tool_use");
    if (!block?.input || typeof block.input !== "object") {
      throw new ProviderError(this.name, "no structured result in response", true);
    }
    return block.input;
  }
}
