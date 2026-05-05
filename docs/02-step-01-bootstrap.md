# 02. 第一步：搭工程骨架

## 本步目标

把项目从空目录变成“能承载后续 agent 代码”的 TypeScript CLI 工程。

这一阶段不追求 agent 能干活，只追求三件事：

- 目录结构清晰
- 配置入口稳定
- 启动方式固定

## 本步交付

- `package.json`
- `tsconfig.json`
- `.gitignore`
- `.env.example`
- `src/index.ts`
- `src/config/env.ts`

## 推荐依赖策略

第一步尽量少装依赖。

建议只保留：

- `typescript`
- `tsx`
- `@types/node`
- `dotenv`

此时不要急着装：

- TUI 框架
- OpenAI SDK
- 数据库存储
- MCP 相关依赖

## 建议目录

```text
src/
  config/
    env.ts
  index.ts
```

## 环境变量约定

建议第一版统一下面这组变量：

```bash
CODING_AGENT_API_KEY=
CODING_AGENT_BASE_URL=https://coding.dashscope.aliyuncs.com/v1
CODING_AGENT_MODEL=qwen3.6-plus
CODING_AGENT_WORKDIR=.
```

说明：

- 不把真实密钥写进仓库
- `WORKDIR` 默认就是当前目录
- 后面所有工具都只允许在这个工作区里活动

## `env.ts` 要解决什么

它至少要负责：

- 读取 `.env`
- 校验必要变量是否存在
- 给出默认值
- 导出统一配置对象

不要把环境变量读取散落在各个文件里，否则后续很难管。

## `index.ts` 现在先做什么

第一步的 `src/index.ts` 很简单：

- 加载配置
- 打印启动 banner
- 打印当前模型与工作目录

第一步不需要启动 REPL，不需要调用模型。

## 本步验收标准

完成后至少满足：

1. `npm run dev` 能启动
2. 缺少关键环境变量时能明确报错
3. 能看到当前 `baseURL`、`model`、`workdir`
4. 项目已经是 ESM + TypeScript CLI 工程

## 常见坑

### 1. 一上来就装太多依赖

依赖越多，第一步越容易模糊问题边界。

### 2. 把真实 key 写进代码

这一点必须从第一步就禁掉。

### 3. 目录结构先乱写，后面再重构

第一版当然会重构，但基础边界要一开始就立住。

## 和参考项目的对应关系

- `learn-claude-code`：概念代码通常单文件起步，适合学 loop
- `pi-mono`：从一开始就强调模块边界
- `codex-main`：更激进，直接多 crate / 多包拆分

本教程会取中间路线：一开始就分目录，但不做过度抽象。

## 下一步

下一篇会做真正的模型调用层：手写一个 OpenAI 兼容的 LLM client。

