# Step 06: Session Logging

本章代码对应 `docs/07-step-06-session-logging.md`。

目标：

- 为 agent 运行过程增加 JSONL session 日志
- 记录请求、响应、工具调用、工具结果和错误
- 汇总 `input_tokens`、`output_tokens`、`total_tokens`

运行：

```bash
npm install
npm run verify
npm run dev -- agent-once "创建 hello.txt，内容是 hello agent"
npm run dev -- chat
```

`verify` 使用 mock 模型并检查生成的 JSONL。真实运行需要配置 `.env`。
