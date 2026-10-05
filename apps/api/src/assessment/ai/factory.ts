import { Logger } from "@nestjs/common";
import { AnthropicProvider } from "./providers/anthropic";
import { GoogleProvider } from "./providers/google";
import { OpenAiProvider } from "./providers/openai";
import { LlmProvider } from "./types";

/**
 * Model names change often, so they are configuration, not code. The defaults below are only
 * starting points: confirm each against the vendor's current model list before going live.
 */
export const DEFAULT_MODELS = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.5",
  google: "gemini-3-flash-preview",
};

export function providersFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider[] {
  const log = new Logger("AI");
  const order = (env.AI_PROVIDERS ?? "anthropic,openai,google")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const out: LlmProvider[] = [];
  for (const name of order) {
    if (name === "anthropic" && env.ANTHROPIC_API_KEY) {
      out.push(new AnthropicProvider(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || DEFAULT_MODELS.anthropic));
    } else if (name === "openai" && env.OPENAI_API_KEY) {
      out.push(new OpenAiProvider(env.OPENAI_API_KEY, env.OPENAI_MODEL || DEFAULT_MODELS.openai));
    } else if (name === "google" && env.GOOGLE_API_KEY) {
      out.push(new GoogleProvider(env.GOOGLE_API_KEY, env.GOOGLE_MODEL || DEFAULT_MODELS.google));
    } else if (["anthropic", "openai", "google"].includes(name)) {
      log.warn(`AI provider "${name}" is listed but has no API key, so it is skipped.`);
    }
  }
  if (out.length === 0) {
    log.warn("No AI providers are configured. Every scenario answer will go to human review.");
  } else {
    log.log(`AI providers: ${out.map((p) => `${p.name} (${p.model})`).join(", ")}`);
  }
  return out;
}
