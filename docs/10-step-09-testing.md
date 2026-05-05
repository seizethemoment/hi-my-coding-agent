# 10. 第九步：测试与 Smoke Eval

## 本步目标

给这套 coding agent 加上最基本的“可回归能力”。

如果没有测试，你每次改：

- prompt
- tool schema
- message 拼装
- 审批逻辑

都很容易把已有行为改坏。

## 本步交付

- `tests/tools.test.ts`
- `tests/agent-loop.test.ts`
- `tests/fixtures/`
- `tests/smoke/`

## 这一步建议分两类测试

### 1. 单元测试

目标：

- 不依赖真实模型
- 直接测工具和 loop 编排

重点测：

- 路径解析
- `bash` 输出截断
- 工具注册表
- tool result 追加逻辑

### 2. smoke eval

目标：

- 用少量真实任务验证系统没有塌

比如：

- 读取文件并总结
- 创建文件
- 修改一个小函数

建议通过环境变量控制是否跑 live eval，避免 CI 默认打真实模型。

## 为什么要做 fixtures

建议把一些典型 LLM 响应存成 fixture：

- 普通文本回复
- 单个 tool call
- 多个 tool call
- 错误响应

这样很多 loop 问题不需要每次都打真实模型。

## 本步验收标准

完成后至少要做到：

1. `npm test` 能测工具层和 loop 层
2. 不调用真实模型也能测大部分核心逻辑
3. 有至少 2 到 3 条 smoke 用例

## 常见坑

### 1. 只测工具，不测 loop

真正最容易坏的是消息编排。

### 2. 所有测试都打真实模型

慢、贵、不稳定。

### 3. 不留典型响应样本

后面修流式或 tool parsing 时会很难回归。

## 下一步

下一篇会把工程打包成真正的 CLI 入口，让它从“开发态脚本”升级成“可以分发的工具”。

