import path from "node:path";

export function resolveWorkspacePath(workdir: string, candidatePath: string): string {
  if (!candidatePath.trim()) {
    throw new Error("Path must be a non-empty string.");
  }

  const absoluteWorkdir = path.resolve(workdir);
  const resolvedPath = path.resolve(absoluteWorkdir, candidatePath);
  const relativePath = path.relative(absoluteWorkdir, resolvedPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escapes workspace: ${candidatePath}`);
  }

  return resolvedPath;
}

export function toWorkspaceRelativePath(workdir: string, absolutePath: string): string {
  const absoluteWorkdir = path.resolve(workdir);
  const relativePath = path.relative(absoluteWorkdir, absolutePath);

  return relativePath || ".";
}
