# 05. 第四步：实现 Agent Loop

## 本步目标

做出整个 coding agent 的核心闭环。

这是最关键的一步。没有它，前面的工具系统和模型调用都还是散的。

## 本步交付

- `src/agent/messageState.ts`
- `src/agent/agentLoop.ts`

## 最小 loop 长什么样

核心逻辑只有四步：

1. 把用户消息发给模型
2. 如果模型返回普通文本，就结束
3. 如果模型返回工具调用，就执行工具
4. 把工具结果追加回消息历史，再继续请求模型

用伪代码表示：

```text
while (true) {
  response = llm(messages, tools)
  append assistant response

  if (!hasToolCalls(response)) {
    return finalText
  }

  results = executeToolCalls(response.toolCalls)
  append tool results
}
```

## `messageState.ts` 负责什么

建议专门做一个消息状态层，用来统一管理：

- 用户消息
- assistant 消息
- tool 消息

不要让 `agentLoop.ts` 直接拼原始数组到处操作，否则后面很容易乱。

## `agentLoop.ts` 负责什么

它只负责编排：

- 调模型
- 判断是否有工具调用
- 调执行器
- 追加结果
- 控制最大轮数

它不要负责：

- CLI 打印
- 文件持久化
- 审批 UI

这些都留给后面的层。

## 这一步一定要加的两个保护

### 1. 最大回合数

比如 12 或 16 轮。

否则模型如果陷入错误工具调用，会死循环。

### 2. 单轮错误兜底

如果某个工具执行失败，不要让程序崩掉，而是把错误包装成工具结果回传给模型。

因为很多时候模型自己能修复错误参数。

## 第一版要不要支持并行工具调用

不建议第一版就做。

虽然一些模型会一次返回多个工具调用，但第一版建议：

- 顺序执行
- 保持日志简单
- 先保证闭环正确

并行可以放到第十二步。

## 本步验收标准

完成后至少能做到下面两个任务：

### 任务一

用户输入：

`请读取 README.md 并总结`

预期：

- 模型发起 `read_file`
- 工具读取文件
- 模型基于读取结果输出总结

### 任务二

用户输入：

`创建 hello.txt，内容是 hello agent`

预期：

- 模型发起 `write_file`
- 工具写入成功
- 模型给出完成反馈

## 常见坑

### 1. 不把 assistant 的 tool call 消息也写回历史

这是大坑。模型的工具调用本身也是消息历史的一部分。

### 2. 工具结果消息格式不稳定

工具返回结果必须结构统一，否则后面很难兼容不同工具。

### 3. loop 里混入太多 UI 逻辑

loop 是 runtime 核心，尽量纯一点。

## 这一章的判断

只要第四步做稳了，你的 coding agent 就已经不再是“会聊天的 CLI”，而是真正开始具备执行能力。

## 下一步

下一篇开始把这个 loop 接到终端界面里，做出真正可以操作的 CLI。

