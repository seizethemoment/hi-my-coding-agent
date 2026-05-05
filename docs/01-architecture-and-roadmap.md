# 01. 技术选型与路线图

## 教程目标

这套教程最终要交付的是一个基础版 coding agent：

- 在本地终端启动
- 连接 OpenAI 兼容模型接口
- 支持自然语言任务输入
- 能调用文件和 shell 工具
- 具备标准的 tool loop
- 具备基础安全边界
- 具备 session 日志

如果把第一版压缩成一句话，就是：

`做一个本地单 agent CLI，让模型真正能“看代码、改代码、跑命令”。`

## 为什么主实现选 TypeScript + Node.js

### 选型结论

本教程主实现选：

- TypeScript
- Node.js 20+
- 原生 `fetch`
- OpenAI 兼容 `chat/completions`

### 这样选的原因

#### 1. 和你当前模型服务最匹配

你现在提供的服务是：

- `baseURL = https://coding.dashscope.aliyuncs.com/v1`
- `model = qwen3.6-plus`

阿里云文档已经明确说明，这条入口是 OpenAI 兼容地址，且 `qwen3.6-plus` 是 Coding Plan 支持的模型。

所以第一版没有必要强上专有 SDK 或复杂抽象层。

#### 2. 和参考项目的主流工程形态一致

从参考项目看：

- `Gemini CLI`：Node.js / TypeScript
- `Qwen Code`：基于 Gemini Code 二开
- `pi`：TypeScript monorepo
- `Cline`：TypeScript + VS Code extension

用 TypeScript 实现，后续想扩展到：

- TUI
- IDE 插件
- dashboard
- skills / extensions

都更顺。

#### 3. 先用原生 `fetch`，不急着上 SDK

第一版教程故意不依赖重型 SDK，原因很现实：

- 你要先理解协议本身，而不是被 SDK 包住
- OpenAI 兼容服务经常带有 provider 自定义字段
- 用原生 `fetch` 更容易看清楚请求体、响应体、流式事件和工具调用结构

等闭环跑顺，再决定是否换成 SDK。

## 为什么不直接选 Python

不是因为 Python 不好，而是因为：

- 这次的目标不是“最快写完 demo”
- 而是要做一套后续能继续扩展成真实 CLI 工程的教程

Python 仍然是最好的概念学习语言之一，所以我们会借鉴 `learn-claude-code` 的章节结构；但主实现还是落在 TypeScript。

## 为什么不一开始就选 Rust

Rust 非常适合成熟产品核心层，`codex-main` 就是典型参考。

但 Rust 不适合这次的第一步，因为：

- 你现在要的是低门槛搭起闭环
- 不是高性能生产内核
- tool loop、session、prompt、安全边界这些问题，和 Rust 没有必然关系

所以路线应该是：

1. 先用 TypeScript 把机制做透
2. 再决定哪些模块值得迁移到 Rust

## 为什么先走 `chat/completions` 而不是 Responses API

这是一个工程兼容性决策，不是技术信仰问题。

### 本教程先用 `chat/completions`

原因：

- 对 OpenAI 兼容服务最稳
- 主流第三方兼容实现更常见
- 工具调用足够支持基础 coding agent
- 更适合做“从零理解协议”的教学

### 后续可以加一层 provider adapter

等第一版稳定后，可以再补：

- OpenAI Responses API adapter
- Anthropic Messages API adapter
- provider-specific extras adapter

但这些不应该妨碍第一版出闭环。

## 我们的目标架构

第一版目标架构不复杂，但边界要清楚：

```text
src/
  config/
    env.ts
  llm/
    client.ts
    protocol.ts
    stream.ts
  tools/
    types.ts
    index.ts
    readFile.ts
    writeFile.ts
    bash.ts
  safety/
    workspace.ts
    commandPolicy.ts
    approval.ts
  agent/
    messageState.ts
    agentLoop.ts
  cli/
    repl.ts
    render.ts
    commands.ts
  storage/
    jsonl.ts
    sessionStore.ts
  context/
    repoContext.ts
    ignore.ts
  prompt/
    systemPrompt.ts
  index.ts
tests/
```

这个结构有几个原则：

- `llm/` 只管模型协议，不管工具执行
- `tools/` 只管工具定义和实现，不管 loop
- `agent/` 只管消息编排和 tool loop
- `cli/` 只管交互
- `safety/` 独立，不和工具逻辑混在一起
- `storage/` 独立，保证日志和会话可审计

## 第一版功能边界

### 必做

- `read_file`
- `write_file`
- `bash`
- 单 agent loop
- 流式输出
- workspace 边界
- shell 审批
- session JSONL 日志

### 可选

- `edit_file`
- `glob`
- `grep`
- `/model` 和 `/resume`

### 后置增强

- `skills`
- `MCP`
- subagents
- task graph
- dashboard
- Git / PR integration

## 12 步路线图

下面这 12 步，就是接下来真正的开发顺序。

| 步骤 | 文档 | 目标 | 本步是否属于第一版闭环 |
| --- | --- | --- | --- |
| 1 | [02-step-01-bootstrap.md](./02-step-01-bootstrap.md) | 建立工程骨架、脚本和配置入口 | 是 |
| 2 | [03-step-02-llm-client.md](./03-step-02-llm-client.md) | 打通 OpenAI 兼容模型调用 | 是 |
| 3 | [04-step-03-tool-system.md](./04-step-03-tool-system.md) | 建立工具描述与执行注册表 | 是 |
| 4 | [05-step-04-agent-loop.md](./05-step-04-agent-loop.md) | 完成 tool loop 闭环 | 是 |
| 5 | [06-step-05-cli.md](./06-step-05-cli.md) | 做可交互 CLI | 是 |
| 6 | [07-step-06-session-logging.md](./07-step-06-session-logging.md) | 把每次请求和工具调用记下来 | 是 |
| 7 | [08-step-07-safety.md](./08-step-07-safety.md) | 增加审批、路径限制、命令策略 | 是 |
| 8 | [09-step-08-context.md](./09-step-08-context.md) | 管理上下文、项目指令和忽略规则 | 是 |
| 9 | [10-step-09-testing.md](./10-step-09-testing.md) | 加测试和 smoke eval | 是 |
| 10 | [11-step-10-packaging.md](./11-step-10-packaging.md) | 把它打包成真正可运行 CLI | 是 |
| 11 | [12-step-11-skills-mcp.md](./12-step-11-skills-mcp.md) | 做轻量技能系统与 MCP 适配层 | 否，增强项 |
| 12 | [13-step-12-subagents.md](./13-step-12-subagents.md) | 引入 subagent 与并行探索 | 否，增强项 |

## 每一阶段的验收标准

### 阶段 A：最小闭环

完成步骤 1 到 5 后，必须能做到：

- 输入“读取某个文件并总结”
- agent 能自己调用 `read_file`
- 返回总结

再进一步：

- 输入“创建一个 hello.ts 并运行它”
- agent 能调用 `write_file`
- agent 能调用 `bash`
- 最终给出结果

### 阶段 B：基础工程化

完成步骤 6 到 10 后，必须做到：

- 每次会话有日志
- 危险命令会被拦截或审批
- 会读取项目指令文件
- 有最基本的测试和打包方式

### 阶段 C：增强能力

完成步骤 11 到 12 后，才算开始进入“更像现代 coding agent”的阶段：

- 动态加载技能
- 连接外部工具系统
- 派生子 agent 做只读探索

## 对参考资料的借鉴策略

### 向 `learn-claude-code` 学什么

- 章节顺序
- 对 harness 的抽象方式
- 先 loop 再 tools 再 context 再 subagent 的节奏

### 向 `pi-mono` 学什么

- TypeScript 下的模块拆分
- `agent core` 和 `coding agent` 的边界
- 将来做 SDK 化的可能性

### 向 `codex-main` 学什么

- 成熟产品如何做多模块分层
- 状态、配置、sandbox、tooling 不混在一起

### 向 `Mini-Claude` 学什么

- 最小实现顺序很对
- 先打 API
- 再加 tools
- 再做 manager
- 再接 CLI

只是本教程会比它更强调工程边界和安全层。

## 这一章的最终决策

我们把这套教程定死为下面这条路线：

- 主实现语言：TypeScript
- 主运行时：Node.js 20+
- 主协议：OpenAI 兼容 `chat/completions`
- 主产品形态：本地 terminal coding agent
- 开发顺序：loop 优先，工程化第二，多 agent 最后

从下一篇开始，每一步都是独立文档，且每一步都要明确：

- 目标
- 本步交付
- 代码文件范围
- 验收标准

