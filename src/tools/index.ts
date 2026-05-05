import { bashToolDefinition, executeBash } from "./bash.js";
import { executeReadFile, readFileToolDefinition } from "./readFile.js";
import type {
  RegisteredTool,
  ToolExecutionContext,
  ToolExecutionResult,
} from "./types.js";
import { executeWriteFile, writeFileToolDefinition } from "./writeFile.js";

export const toolRegistry = {
  read_file: {
    definition: readFileToolDefinition,
    execute: executeReadFile,
  },
  write_file: {
    definition: writeFileToolDefinition,
    execute: executeWriteFile,
  },
  bash: {
    definition: bashToolDefinition,
    execute: executeBash,
  },
} satisfies Record<string, RegisteredTool>;

export type ToolName = keyof typeof toolRegistry;

export const toolDefinitions = Object.values(toolRegistry).map(
  (tool) => tool.definition,
);

export function isToolName(value: string): value is ToolName {
  return value in toolRegistry;
}

export async function executeTool(
  name: string,
  input: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  if (!isToolName(name)) {
    return {
      ok: false,
      output: `Error: Unknown tool: ${name}`,
    };
  }

  return toolRegistry[name].execute(input, context);
}
