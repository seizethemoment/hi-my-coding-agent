# 04. 第三步：建立工具系统

## 本步目标

给模型一双真正能干活的手。

如果没有工具，模型只能“说它会改代码”；有了工具，它才能真正：

- 读文件
- 写文件
- 跑命令

## 本步交付

- `src/tools/types.ts`
- `src/tools/index.ts`
- `src/tools/readFile.ts`
- `src/tools/writeFile.ts`
- `src/tools/bash.ts`
- `src/safety/workspace.ts`

## 第一版只做哪些工具

建议第一版只做 3 个：

1. `read_file`
2. `write_file`
3. `bash`

原因：

- 已经足够完成基本 coding task
- 容易把 loop 讲清楚
- 安全边界最容易先收住

`edit_file`、`glob`、`grep` 可以放后面。

## 工具系统要拆成两层

### 第一层：工具描述

也就是暴露给模型看的内容：

- 名称
- 描述
- JSON schema

### 第二层：工具执行器

也就是本地真正跑的代码：

- `read_file(path)`
- `write_file(path, content)`
- `bash(command)`

这两层不要混写。

模型只应该看见“描述”，执行器只应该接收结构化参数。

## 为什么要做执行注册表

建议在 `src/tools/index.ts` 里统一维护：

- `toolDefinitions`
- `toolExecutors`

也就是类似：

```ts
{
  read_file: executeReadFile,
  write_file: executeWriteFile,
  bash: executeBash,
}
```

这样第四步做 agent loop 时，逻辑会非常清楚。

## 安全边界从这一步就开始

### 路径边界

所有文件类工具都必须：

- 基于 `workdir` 解析路径
- `resolve()` 后确认没有逃出工作区

### 命令边界

`bash` 在这一版先做：

- 超时
- 输出截断
- 危险命令 denylist

真正的审批放到第七步，但基础防线从这一步就要存在。

## 本步验收标准

完成后至少要做到：

1. `read_file` 能读取工作区内文件
2. `write_file` 能创建或覆盖工作区内文件
3. `bash` 能执行简单命令，如 `pwd`、`ls`
4. 工作区外路径被拒绝
5. 危险命令至少有基本拦截

## 常见坑

### 1. 把工具输入做成自然语言字符串

不要这样。工具参数必须是结构化对象。

### 2. 在工具里读取全局环境到处乱跑

工具最好只接收明确参数和上下文对象。

### 3. 让 `bash` 默认拥有完全能力

第一版必须保守。

## 和参考项目的对应关系

- `learn-claude-code` 的关键启发：loop 本身不用变，只是加 tool handlers
- `pi` 的关键启发：工具和 runtime 要拆开
- `Cline` 的关键启发：工具执行与审批是两回事

## 下一步

下一篇会把消息历史、模型调用和工具执行接起来，做出最关键的 agent loop。

