# 00. 背景前言与业界现状

## 这份教程要解决什么问题

很多人现在已经会“调用一个模型”，但还不会“做一个 coding agent”。

两者不是一回事。

一个真正能工作的 coding agent，最少要具备下面这条闭环：

1. 接收用户目标
2. 调用模型生成下一步动作
3. 当模型请求工具时，执行工具
4. 把工具结果回传给模型
5. 反复循环，直到模型停止调用工具

这就是最小 agent loop。

本教程不从“产品宣传语”出发，而是从这条最小闭环出发，一步一步把一个基础 coding agent 做出来。

## 截至 2026-04-21，coding agent 的行业格局

截至 2026 年 4 月 21 日，coding agent 已经不是实验性玩具，而是软件工程的新执行层。

有两个现象值得先记住：

- 研究层面，2026 年 4 月更新的一篇 GitHub 大规模研究指出，coding agent 在 128,018 个项目上的估计采用率已经达到 `22.20%--28.66%`，而且还在增长。
- 产品层面，主流形态已经分化成三类：本地终端 agent、IDE 内 agent、云端后台 agent。

也就是说，coding agent 已经不是“会不会出现”的问题，而是“你要做哪一类、做到哪一层”的问题。

## 三条主路线

### 1. 本地终端 agent

代表：Claude Code、Codex CLI、Gemini CLI、Qwen Code、Aider、pi。

特点：

- 工作在开发者自己的机器上
- 能直接访问当前 repo、文件系统、shell
- 交互成本最低，最适合作为第一版教程的落地形态

### 2. IDE 内 agent

代表：Cline、Copilot Agent Mode、Cursor foreground agent。

特点：

- 距离编辑器最近
- 更强调可视化审批、diff 预览、编辑器态上下文
- 工具执行通常要穿过 IDE 扩展层

### 3. 云端后台 agent

代表：Codex Cloud、GitHub Copilot cloud agent、Cursor Background Agents、OpenHands Cloud。

特点：

- 每个任务在隔离环境里跑
- 更适合长任务、并行任务、自动提 PR
- 安全、权限、网络、仓库接入复杂度明显更高

## 代表性产品与技术实现

下面这个表是本教程最关心的部分：不是比谁更强，而是看“各家是怎么实现 harness 的”。

| 产品/项目 | 运行形态 | 开放性 | 公开可见的实现/技术栈 | 适合学习的点 |
| --- | --- | --- | --- | --- |
| Claude Code | 终端、本地、GitHub 集成 | 核心未完整开源 | 官方文档公开了 `MCP`、`skills`、`hooks`、`agent teams`、`CLAUDE.md` 等机制；完整源码未公开 | 权限治理、技能系统、团队协作、上下文文件 |
| Codex | CLI、本地、IDE、云端 | CLI 开源，云端闭源 | 从本地参考仓库 `codex-main` 可见：`codex-cli` 为 JS 启动层，主体是大规模 Rust workspace | agent loop 分层、状态管理、sandbox、工程化程度 |
| Gemini CLI | 终端 | 开源 | 从公开仓库结构可见是 Node.js/TypeScript 路线，含 `package.json`、`tsconfig.json`、`esbuild.config.js` | terminal-first 设计、MCP 接入、配置体系 |
| Qwen Code | 终端、IDE | 开源 | Qwen 官方明确说明其“基于 Gemini Code 二次开发”，本质也是 Node.js/TypeScript 生态 | 模型适配层、prompt/tool 协议适配 |
| Aider | 终端 | 开源 | Python 为主，PyPI 分发，强调 repo map、git 工作流 | 最小可用闭环、git 友好、对已有项目很实用 |
| Cline | VS Code 扩展 | 开源 | 从公开仓库结构可见是 TypeScript + VS Code 扩展 + webview UI | 人在回路里的审批机制、IDE 插件化工具调用 |
| OpenHands | CLI、GUI、Cloud | 核心开源，企业版 source-available | 官方 README 直接写明 SDK 是 Python library，仓库同时包含前端和本地 GUI | 从“coding agent”扩展到“agent platform”的路线 |
| GitHub Copilot cloud agent | GitHub 云端 | 闭源 | 官方文档明确说明它运行在 GitHub Actions 驱动环境里 | issue -> plan -> branch -> PR 的后台执行链路 |
| Cursor Background Agents | 远程后台环境 | 闭源 | 官方文档说明它运行在隔离 Ubuntu 机器里，可克隆 GitHub repo、跑命令、推分支 | 远程环境快照、后台 agent、安全权衡 |
| pi | 终端、SDK、RPC | 开源 | 本地参考仓库 `pi-mono` 显示其是 TypeScript monorepo，拆成 AI、agent core、coding-agent、TUI 等模块 | 模块边界清晰、SDK-first、可扩展性强 |

说明：

- 表中开源项目的语言/框架信息，若官方 README 没有直接写死，我会明确按“仓库结构推断”处理，不把推断写成官方结论。
- 对闭源产品，我只写官方公开文档能确认的机制，不臆测内部实现细节。

## 现在业界已经形成的共识

### 共识一：coding agent 不是一个 prompt，而是一套 harness

主流产品的共同点不是“提示词写得多花”，而是把下面这些东西做成了稳定系统：

- 工具层：读文件、写文件、shell、搜索、浏览器、git
- 状态层：会话、日志、上下文压缩、resume
- 安全层：沙箱、审批、权限边界、工作区限制
- 扩展层：MCP、skills、hooks、instructions

模型负责决策，harness 负责落地。

### 共识二：核心永远是 agent loop

OpenAI 在 2026 年 1 月的工程文章里，直接把 `agent loop` 定义成 Codex 的核心逻辑。

所以无论你最后做的是：

- 本地终端 agent
- VS Code agent
- GitHub issue 后台 agent
- 多 agent 团队系统

都必须先把单 agent 的 loop 做扎实。

### 共识三：本地 agent 和云端 agent 是两种产品，不是一种产品的“开关”

本地 agent 的重点是：

- 低延迟
- 高交互密度
- 开发者可控

云端 agent 的重点是：

- 隔离环境
- 并行
- branch / PR handoff
- 长任务

第一版教程应该先做本地终端 agent，因为它最容易把本质讲透。

### 共识四：安全不是补丁，而是结构

从 Claude Code、Codex、Cline、Cursor 到 Copilot cloud agent，大家都把安全前置到了架构层：

- 工作区路径限制
- 命令审批
- 网络隔离或默认关闭
- 日志可追踪
- 远程环境隔离

这不是“以后再加”的功能，而是从第一版就要设计进去的边界。

### 共识五：多 agent 不是起点，而是后期增强

很多人一上来就想做：

- subagents
- task graph
- agent team
- mailbox
- background workers

但业界成熟产品真正稳定的前提，是先把下面五件事做好：

1. 单 agent loop
2. 工具协议
3. 安全边界
4. 会话日志
5. 上下文治理

本教程也会遵循这个顺序。

## 本教程为什么选 TypeScript，而不是 Python 或 Rust

### Python 的优点

- 最短路径
- 教学代码最简洁
- `learn-claude-code` 的章节组织非常适合学习 agent harness

### 但本教程最终不选 Python 作为主实现

原因不是 Python 不行，而是这次你的上下文更适合 TypeScript：

- 你的模型服务是 OpenAI 兼容入口，前期用 Node 原生 `fetch` 很顺
- `Gemini CLI`、`Qwen Code`、`pi`、`Cline` 都更接近 TS/Node 生态
- 后面如果要做 TUI、IDE 插件、技能加载、前端面板，TS 迁移成本更低

### Rust 的优点

- 性能好
- 状态管理与并发边界更严谨
- 很适合做成熟产品核心层

### 但本教程也不选 Rust 作为第一版

原因也很直接：

- 你现在要的是“从零开始理解并做出来”
- Rust 会把大量精力消耗在工程和语言复杂度上
- 第一版教程的重点不是吞吐量，而是把 harness 机制讲明白

结论：

- 学概念时，参考 Python 路线
- 做第一版实现时，落在 TypeScript
- 等闭环稳定后，再考虑是否把核心层迁移到 Rust

## 本地参考资料应该怎么用

这次可直接利用的本地资料非常好：

- `claude-code`
  - 更适合观察插件、skills、命令、文档组织方式
- `learn-claude-code`
  - 最适合借章节顺序和“先 loop，再 tools，再 context，再 subagent”的教学节奏
- `pi-mono`
  - 最适合学习 TypeScript 下如何把 agent core、tools、TUI、SDK 分层
- `~/Downloads/codex-main`
  - 最适合学习成熟产品如何把 CLI 壳层和高性能核心拆开
- 微信文章《赛博鸡生蛋，7小时用Claude Vibe Coding一个Mini-Claude》
  - 最适合参考“最小可用路径”：API -> tools -> session manager -> CLI -> dashboard

本教程会综合这些资料，但不会机械照抄任何一个项目。

## 这份教程的产品边界

我们要做的是：

- 一个基础的本地 terminal coding agent
- 单 agent
- OpenAI 兼容模型接入
- 4 到 6 个核心工具
- 明确的安全边界
- 可重放的 session 日志

我们暂时不做：

- 浏览器自动化
- 远程容器
- GitHub App 集成
- 长期记忆数据库
- 真正的 MCP 全量协议实现
- 大规模多 agent 编排

不是这些东西不重要，而是它们都应该建立在“基础闭环稳定”之后。

## 这份教程的总判断

如果用一句话概括 2026 年的 coding agent 现状，就是：

`模型能力已经够用，真正拉开差距的是 harness 工程。`

所以这份教程的核心立场非常明确：

- 不做神秘化解释
- 不堆空泛的“智能体概念”
- 不拿一堆 workflow 图替代真实实现
- 先把最小闭环做出来，再逐层增强

下一篇文档会把整个教程的技术选型、项目结构和 12 个步骤的路线图固定下来。

## 参考来源

外部资料：

- [Anthropic Claude Code Docs](https://code.claude.com/docs/en)
- [OpenAI: Unrolling the Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [OpenAI Codex](https://openai.com/codex)
- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [Qwen3-Coder 官方博客](https://qwenlm.github.io/zh/blog/qwen3-coder/)
- [阿里云百炼 Qwen Code 文档](https://help.aliyun.com/zh/model-studio/qwen-code-coding-plan)
- [阿里云百炼 Coding Plan FAQ](https://help.aliyun.com/zh/model-studio/coding-plan-faq)
- [Aider 官方站点](https://aider.chat/)
- [Cline GitHub 仓库](https://github.com/cline/cline)
- [OpenHands GitHub 仓库](https://github.com/OpenHands/OpenHands)
- [GitHub Copilot cloud agent docs](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)
- [Cursor Background Agents docs](https://docs.cursor.com/en/background-agent)
- [Agentic Much? Adoption of Coding Agents on GitHub](https://arxiv.org/abs/2601.18341)
