# Build a Basic Coding Agent

这份仓库先放技术方案和教程路线，不急着一上来堆代码。

目标很明确：从零开始，逐步做出一个“基础但完整”的 coding agent。它能在本地终端里接收自然语言任务，调用模型，读写工作区文件，执行受控命令，并把工具结果继续喂回模型，直到任务结束。

本教程的实现路线选型如下：

- 语言：TypeScript
- 运行时：Node.js 20+
- 模型协议：OpenAI 兼容 `chat/completions`
- 模型服务：阿里云百炼 Coding Plan / DashScope 兼容入口
- 初期目标：本地单 agent、本地工作区、少量核心工具、可审计日志

为什么先这样选：

- 你现在已有的模型服务就是 OpenAI 兼容入口，直接适配最省路径。
- `Gemini CLI`、`Qwen Code`、`pi`、`Cline` 这些公开实现大多都在 Node/TypeScript 生态。
- `Codex` 的 Rust 路线很值得学，但不适合“从零入门”的第一版。
- `learn-claude-code` 的 Python 版本非常适合学概念，我们会借它的章节顺序，但落地实现选择 TypeScript。

本教程默认通过环境变量配置模型，不在文档或代码里写死真实密钥：

```bash
CODING_AGENT_API_KEY=your_key
CODING_AGENT_BASE_URL=https://coding.dashscope.aliyuncs.com/v1
CODING_AGENT_MODEL=qwen3.6-plus
```

阅读顺序：

1. [docs/00-preface-industry-landscape.md](./docs/00-preface-industry-landscape.md)
2. [docs/01-architecture-and-roadmap.md](./docs/01-architecture-and-roadmap.md)
3. [docs/02-step-01-bootstrap.md](./docs/02-step-01-bootstrap.md)
4. [docs/03-step-02-llm-client.md](./docs/03-step-02-llm-client.md)
5. [docs/04-step-03-tool-system.md](./docs/04-step-03-tool-system.md)
6. [docs/05-step-04-agent-loop.md](./docs/05-step-04-agent-loop.md)
7. [docs/06-step-05-cli.md](./docs/06-step-05-cli.md)
8. [docs/07-step-06-session-logging.md](./docs/07-step-06-session-logging.md)
9. [docs/08-step-07-safety.md](./docs/08-step-07-safety.md)
10. [docs/09-step-08-context.md](./docs/09-step-08-context.md)
11. [docs/10-step-09-testing.md](./docs/10-step-09-testing.md)
12. [docs/11-step-10-packaging.md](./docs/11-step-10-packaging.md)
13. [docs/12-step-11-skills-mcp.md](./docs/12-step-11-skills-mcp.md)
14. [docs/13-step-12-subagents.md](./docs/13-step-12-subagents.md)

本轮已完成的内容：

- 业界 coding agent 现状分析
- 技术选型与总路线
- 12 个开发步骤的独立文档

本轮暂不做的事：

- 不提前写一堆代码骨架
- 不过早引入多 agent、远程执行、浏览器自动化
- 不直接复制 Claude Code / Codex 的完整复杂度

本仓库当前最重要的文档是：

- [docs/00-preface-industry-landscape.md](./docs/00-preface-industry-landscape.md)
- [docs/01-architecture-and-roadmap.md](./docs/01-architecture-and-roadmap.md)

