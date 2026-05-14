# CODE_RULES — 语言级编码规范

> 来源：SCALE OS v10.0 · HERMES.md
> 适用范围：新项目开发

## 通用

- `[ENFORCED]` 禁止空 catch 块
- `[ENFORCED]` 禁止硬编码密钥、token、password、private key

## TypeScript / React / Next.js

- `[ENFORCED]` TypeScript 代码禁止 any，必须通过 typecheck
- `[ENFORCED]` React 组件使用函数式组件和 Hooks
- `[ENFORCED]` Next.js 使用 App Router，客户端组件显式标记 use client

## Python

- `[ENFORCED]` Python 函数必须有参数和返回类型标注

## Go

- `[ENFORCED]` Go 错误必须显式处理，禁止忽略 error

## C++

- `[ENFORCED]` RAII 资源管理：禁止裸 new/delete，使用智能指针
- `[ENFORCED]` const 正确性：能加 const 就加，参数优先 const 引用传递
- `[ENFORCED]` 内存安全：边界检查，Valgrind/ASan 验证无泄漏

## Java / C#

- `[ENFORCED]` 依赖注入使用构造器注入，禁止字段注入
- `[ENFORCED]` 异常处理：业务异常与系统异常分离，全局异常处理
- `[ENFORCED]` Nullable 引用类型启用，消除 NRE 风险
- `[ENFORCED]` async/await 正确使用，禁止 .Result 死锁
