# Step 02: LLM Client

本章代码对应 `docs/03-step-02-llm-client.md`。

目标：

- 手写 OpenAI-compatible HTTP client
- 支持普通响应、tool calling 结构和流式 SSE
- 不依赖 SDK，先看清协议

运行：

```bash
npm install
npm run verify
npm run dev -- ping "hello"
npm run dev -- stream "hello"
```

`verify` 使用本地 fake fetch，不需要真实 API key。真实调用需要配置 `.env`。
