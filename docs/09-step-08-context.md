# 09. 第八步：上下文治理与项目指令

## 本步目标

解决一个最容易被低估的问题：

`不是把更多文件塞给模型就更聪明，而是要让它拿到真正相关的上下文。`

## 本步交付

- `src/prompt/systemPrompt.ts`
- `src/context/repoContext.ts`
- `src/context/ignore.ts`

## 这一章要解决的三件事

### 1. system prompt

定义 agent 的基本行为边界，比如：

- 你是本地 coding agent
- 优先读文件再改文件
- 变更前先理解上下文
- 尽量验证结果

### 2. 项目级指令

建议支持类似：

- `AGENTS.md`
- 或者 `CODING_AGENT.md`

它的作用类似 `CLAUDE.md`、`GEMINI.md`、`QWEN.md` 这类项目上下文文件。

### 3. ignore 规则

最基础应该忽略：

- `node_modules`
- `.git`
- `dist`
- `build`
- 大型二进制文件

否则模型和工具很容易把上下文浪费在无关内容上。

## 第一版怎么做上下文，不要过度设计

先做下面这组最小策略：

1. system prompt 固定
2. 启动时加载项目指令文件
3. 工具默认只看工作区
4. 忽略明显噪音目录

先不要一上来做：

- repo map
- embedding 检索
- 自动摘要数据库
- 长会话 compaction

这些都是后续增强项。

## 一个很重要的原则

`少给一点，让 agent 自己去读；比先塞满上下文更稳。`

这其实也是很多成熟产品在走的方向。

## 本步验收标准

完成后至少要做到：

1. agent 启动时能读取项目级指令文件
2. agent 默认不会去翻明显无关目录
3. system prompt 能稳定约束 agent 行为
4. 面对已有项目时，agent 会优先读相关文件而不是盲写

## 常见坑

### 1. 把整个 repo 树一股脑塞给模型

这样很快就会把上下文用爆。

### 2. 项目指令和 system prompt 混成一个大字符串

后续很难维护。

### 3. ignore 规则只在工具层做，不在上下文层做

最好两个层面都考虑。

## 和参考项目的对应关系

- `Claude Code`：`CLAUDE.md`
- `Gemini CLI`：`GEMINI.md`
- `Qwen Code`：`QWEN.md`
- `pi`：`AGENTS.md`

这说明“项目级指令文件”已经是事实标准之一，第一版就应该支持。

## 下一步

下一篇会把整个项目补上测试和 smoke eval，避免后面每改一次 loop 就凭感觉回归。

