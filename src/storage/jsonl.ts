import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export async function ensureParentDir(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export async function appendJsonlRecord(
  filePath: string,
  record: unknown,
): Promise<void> {
  await ensureParentDir(filePath);
  await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
}
