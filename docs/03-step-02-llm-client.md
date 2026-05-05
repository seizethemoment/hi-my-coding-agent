# 03. 第二步：打通模型调用层

## 本步目标

实现一个最小可用的 LLM client，能稳定调用：

- `https://coding.dashscope.aliyuncs.com/v1`
- `model = qwen3.6-plus`

并且支持后续 agent 需要的三种能力：

- 普通文本回复
- tool calling
- 流式输出

## 本步交付

- `src/llm/client.ts`
- `src/llm/protocol.ts`
- `src/llm/stream.ts`

## 为什么这里先用原生 `fetch`

因为这一步的重点是“看清协议”。

你至少应该亲手明确这些东西：

- 请求 URL
- `Authorization` header
- `model`
- `messages`
- `tools`
- `stream`
- 返回体里的 `tool_calls`

如果一上来就用 SDK，这些最关键的结构会被包起来，不利于教学。

## 协议层应该怎么拆

### `protocol.ts`

定义最小需要的类型：

- `ChatMessage`
- `ToolDefinition`
- `ToolCall`
- `ChatCompletionRequest`
- `ChatCompletionResponse`

这里不要求把整个 OpenAI schema 建满，只定义当前教程要用的部分。

### `client.ts`

负责：

- 发送请求
- 处理非流式响应
- 统一错误结构

### `stream.ts`

负责：

- 解析 SSE 或 provider 的流式响应
- 输出文本增量
- 收集最终消息

这一层要尽量做成“后面 CLI 和 agent loop 都能复用”的基础能力。

## 关键设计决定

### 1. 不要把 provider 特性写死

虽然当前目标是 DashScope，但 client 最好预留：

- `extraHeaders?: Record<string, string>`
- `extraBody?: Record<string, unknown>`

原因：

- 不同 OpenAI 兼容服务经常需要附加字段
- 后面接别的模型时不用重写整个 client

### 2. 先支持非流式，再补流式

建议顺序：

1. 先写普通请求
2. 确认能拿到文本
3. 再加流式

不要同时调两个问题。

### 3. 先让工具结构“能透传”

本步先不执行工具，但请求体里要支持 `tools`，并能从响应里识别出 `tool_calls`。

## 本步验收标准

完成后至少要做到：

1. 发送一句 `"hello"` 能收到模型回复
2. 开启 `stream` 时能收到文本增量
3. 当请求体里带 `tools` 时，能正确解析工具调用结构
4. 失败时能打印有用错误，而不是一团 `unknown`

## 常见坑

### 1. 过早把 client 设计成“全能框架”

现在只需要一层清晰的 HTTP 封装，不要做成 provider 平台。

### 2. 错误处理不留原始响应

一旦 provider 返回 400/401/500，原始响应文本非常重要。

### 3. 流式解析和 CLI 输出绑死

流式解析属于 LLM 层；终端打印属于 CLI 层。不要混。

## 和阿里云文档的关系

这一步有两点要严格遵守：

- `baseURL` 必须是 `https://coding.dashscope.aliyuncs.com/v1`
- `api key` 必须是 Coding Plan 专属 key，而不是普通 `sk-...`

这一点阿里云 FAQ 已经写得很明确。

## 下一步

下一篇开始做工具系统：定义工具 schema，并把工具调用和本地执行对接起来。

