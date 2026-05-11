# 章节配套代码

这里放第 1 步到第 6 步的独立可运行代码。

每个目录都是一个单独的 TypeScript 小工程，可以单独进入目录学习和运行：

```bash
cd chapter-code/step-01-bootstrap
npm install
npm run verify
npm run dev
```

仓库根目录也提供一键验收：

```bash
npm run chapter:verify
```

说明：

- `verify` 默认走本地 mock 或本地工具，不依赖真实模型服务。
- 需要真实调用模型时，复制对应目录里的 `.env.example` 为 `.env`，填入 `CODING_AGENT_API_KEY` 后运行 `npm run dev`。
- 每一章都只包含该章需要理解的最小代码，后一章会在前一章能力上继续增加。
