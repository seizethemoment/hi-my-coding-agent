import "dotenv/config";

import path from "node:path";

export type AppConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  workdir: string;
};

export type EnvSource = Record<string, string | undefined>;

export function loadConfig(
  env: EnvSource = process.env,
  cwd = process.cwd(),
): AppConfig {
  const apiKey = env.CODING_AGENT_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing required env: CODING_AGENT_API_KEY");
  }

  return {
    apiKey,
    baseURL:
      env.CODING_AGENT_BASE_URL?.trim() ??
      "https://coding.dashscope.aliyuncs.com/v1",
    model: env.CODING_AGENT_MODEL?.trim() ?? "qwen3.6-plus",
    workdir: path.resolve(cwd, env.CODING_AGENT_WORKDIR?.trim() || "."),
  };
}
