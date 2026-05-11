# Step 03: Tool System

本章代码对应 `docs/04-step-03-tool-system.md`。

目标：

- 定义工具描述和执行器
- 实现 `read_file`、`write_file`、`bash`
- 建立工作区路径边界和基础命令防线

运行：

```bash
npm install
npm run verify
npm run dev -- tool-list
npm run dev -- tool-run write_file '{"path":"tmp/hello.txt","content":"hello"}'
npm run dev -- tool-run read_file '{"path":"tmp/hello.txt"}'
```
