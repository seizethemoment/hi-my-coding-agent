# Step 04: Agent Loop

本章代码对应 `docs/05-step-04-agent-loop.md`。

目标：

- 管理消息历史
- 把模型调用、工具注册表和工具结果串成闭环
- 加最大轮数保护

运行：

```bash
npm install
npm run verify
npm run dev -- agent-once "创建 hello.txt，内容是 hello agent"
```

`verify` 使用 mock 模型，不需要真实 API key。真实 `agent-once` 需要配置 `.env`。
