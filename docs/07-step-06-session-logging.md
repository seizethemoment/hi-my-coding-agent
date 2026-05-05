# 07. 第六步：加 Session 与日志

## 本步目标

把 coding agent 的运行过程记录下来，方便：

- 调试
- 回放
- 复盘
- 以后做 dashboard

## 本步交付

- `src/storage/jsonl.ts`
- `src/storage/sessionStore.ts`

## 为什么这一步很重要

很多 agent demo 看起来会动，但一出问题就完全没法查。

真正可维护的 coding agent，至少要能回答：

- 这一轮请求发给模型的 body 是什么
- 模型到底返回了什么
- 调了哪些工具
- 每个工具结果是什么
- 为什么最后给出这个回答

如果没有 session 日志，后面改 prompt、改工具、改审批都像蒙眼调试。

## 推荐的存储格式

第一版建议用：

- `JSONL`

优点：

- 一行一个事件，天然适合追加写入
- 出错时容易人工查看
- 后面做 dashboard 也容易解析

## 建议记录哪些事件

至少包括：

- `user_message`
- `assistant_message`
- `tool_call`
- `tool_result`
- `request_start`
- `request_end`
- `error`

如果 provider 返回了 token usage，也建议一起记。

## Session 的最小元数据

建议每个 session 至少有：

- `sessionId`
- `startedAt`
- `cwd`
- `model`
- `baseURL`

这样后面 resume 或复盘才有意义。

## 本步不要做什么

先不要做：

- 数据库
- 向量索引
- 仪表盘
- 分支树状会话

第一版只要“能稳定记录”就够了。

## 本步验收标准

完成后至少要做到：

1. 每次启动新会话都会生成日志文件
2. 每轮请求和工具调用都能被记录
3. 崩溃或中断时，已有日志不会丢
4. 人工打开日志文件时能看懂大概发生了什么

## 常见坑

### 1. 只记最终文本，不记中间工具过程

这会让 agent 几乎不可调试。

### 2. 日志结构随手拼，不做事件类型

后面几乎一定会后悔。

### 3. 日志和 CLI 展示共用同一套字符串

日志应该存结构化数据，不应该只存“打印出来的那段字”。

## 下一步

下一篇会补安全边界。到这里 agent 已经能跑工具了，越往后越不能再拖安全层。

