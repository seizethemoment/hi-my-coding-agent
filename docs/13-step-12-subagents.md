# 13. 第十二步：Subagents 与并行探索

## 这一章的定位

这是增强项，不是起步项。

只有当前面 10 步已经稳定时，才建议走到这里。

## 本步目标

让主 agent 可以把某些子任务交给“新上下文的子 agent”处理。

最先适合 subagent 的任务，不是写代码，而是：

- 只读探索
- 仓库扫描
- 搜索多个候选点
- 汇总结果

## 本步交付

- `src/agents/subagent.ts`
- `src/agents/taskQueue.ts`

## 为什么 subagent 先做只读

因为这是风险最低、收益最直接的路线。

只读 subagent 可以：

- 用新上下文独立搜索
- 避免污染主对话
- 把结论摘要回主 agent

这和 `learn-claude-code` 里强调的“context isolation”是一致的。

## 第一版 subagent 的设计原则

### 1. 新上下文

子 agent 不继承完整消息历史，只接收任务说明和必要上下文。

### 2. 共享工作区，但默认只读

先不让它直接改文件。

### 3. 返回摘要，而不是返回整段历史

主 agent 需要的是结论，不是另一份冗长 transcript。

### 4. 不急着做真正并发写入

先支持多个只读子任务并发，已经够有价值。

## 什么场景最适合试 subagent

### 场景一：定位改动点

主 agent 让两个子 agent 分别扫描：

- 后端入口
- 前端入口

然后回收两份摘要。

### 场景二：多文件搜索

让子 agent 并行找：

- 某个函数定义
- 某个配置来源
- 某个错误日志出现位置

## 本步验收标准

完成后至少要做到：

1. 主 agent 能发起子任务
2. 子 agent 使用独立消息历史
3. 子 agent 返回结构化摘要
4. 主 agent 能根据摘要继续决策

## 常见坑

### 1. 让子 agent 继承全部上下文

那就失去 subagent 的意义了。

### 2. 一开始就做并发写文件

复杂度会陡增。

### 3. 把 subagent 当成“更强模型”

subagent 的核心价值是上下文隔离，不是凭空变聪明。

## 完成这一步之后

你的系统就已经从“基础 coding agent”进入“可扩展 agent harness”阶段了。

接下来再往上走，才适合考虑：

- task graph
- worktree isolation
- background jobs
- remote workers
- branch / PR automation

但这些都应该建立在当前 12 步已经清楚、稳定、可测的前提上。

