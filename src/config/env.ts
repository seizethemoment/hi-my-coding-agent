import path from "node:path";

import dotenv from "dotenv";

dotenv.config();

const DEFAULT_BASE_URL = "https://coding.dashscope.aliyuncs.com/v1";
const DEFAULT_MODEL = "qwen3.6-plus";
const DEFAULT_WORKDIR = ".";

export type AppConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
  workdir: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export function loadConfig(): AppConfig {
  const apiKey = getRequiredEnv("CODING_AGENT_API_KEY");
  const baseURL = getOptionalEnv("CODING_AGENT_BASE_URL", DEFAULT_BASE_URL);
  const model = getOptionalEnv("CODING_AGENT_MODEL", DEFAULT_MODEL);
  const rawWorkdir = getOptionalEnv("CODING_AGENT_WORKDIR", DEFAULT_WORKDIR);
  const workdir = path.resolve(rawWorkdir);

  return {
    apiKey,
    baseURL,
    model,
    workdir,
  };
}
