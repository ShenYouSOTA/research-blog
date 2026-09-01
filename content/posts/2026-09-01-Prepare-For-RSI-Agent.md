---
title: "从 Long-Horizon Agents 到 RSI AI"
latex: true
---

## 从 Long-Horizon Agents 到 RSI AI

我们正在关注一个比“Agent Infra”更长期的问题：

> **当 AI 从一次性的模型调用，演化为长期运行、持续积累状态，并最终能够从自身经验中学习的计算系统时，Systems stack 应该如何改变？**

传统 LLM infrastructure 围绕相对短暂的 request 构建：

$request \rightarrow Model \rightarrow Response$

而未来的 Agent 更接近一个持续存在的计算过程：

$$
Observe \rightarrow Act \rightarrow Environment  
\rightarrow Observe \rightarrow \cdots
$$

进一步加入记忆和学习之后：

$$
Execute  
\rightarrow  
Remember  
\rightarrow  
Evaluate  
\rightarrow  
Learn  
\rightarrow  
Execute  
$$

我们将这类系统暂时概括为 **RSI(Recursive Self Improvement) Agents**，其中有三个逐渐深入的问题。

| 方向                     | 核心问题                 | 主要 Systems 挑战                                                     |
| ---------------------- | -------------------- | ----------------------------------------------------------------- |
| **Long-Horizon**       | Agent 如何可靠运行数小时甚至数天？ | trajectory、checkpoint、rollback、sandbox、scheduling、fault tolerance |
| **Memory**             | Agent 如何持续保存和复用经验？   | memory hierarchy、semantic caching、storage、consistency、placement   |
| **Continual Learning** | Agent 如何真正根据经验改变自身？  | rollout、RL、training-serving integration、policy versioning         |

尽管这些领域可以并行研究，但也许可以提出一条技术上更为可行的演进路线：

$$
\boxed{  
Long\ Horizon  
\rightarrow  
Persistent\ Memory  
\rightarrow  
Continual\ Learning  
\rightarrow  
Self\text{-}Evolving\ Agent  
}  
$$

## 为什么首先做 Long-Horizon

Long-horizon 的关键并不是“context window 更长”，而是 **trajectory 开始成为一等系统对象**。

一个持续数小时的 coding / research agent 可能产生数千次模型调用、工具调用、文件修改、shell process 和外部副作用。此时一次失败已经不能通过简单的 request retry 解决：

$$
Failure\ Recovery  
\neq  
Request\ Retry  
$$

这使 Agent runtime 很自然地重新连接到经典 Systems 问题：

$$
\text{checkpoint / COW / transaction / replay / scheduling / isolation}  
$$

因此我们更愿意把 long-horizon 看成未来 **persistent intelligence 的 execution substrate**，而不仅仅是一个 Agent feature。

它还有一个现实优势：相比 continual learning，long-horizon systems 可以大量使用现有模型/API，通过 trace replay、小模型和有限 GPU 完成系统研究。对于正在建设中的实验室，这是一个计算资源更友好、同时又能产生 OS / storage / distributed systems 问题的切入口。

## Memory 是下一层，而不是独立终点

长期运行自然会产生越来越多 persistent state：

$$
State =  
Context + KV + Filesystem + ToolState + Memory + Environment  
$$

最终很可能形成类似计算机 memory hierarchy 的 **Agent Memory Hierarchy**：

$$
Context  
\rightarrow  
Working\ Memory  
\rightarrow  
Episodic\ Memory  
\rightarrow  
Semantic\ Memory  
\rightarrow  
Archive  
$$

这里会出现非常自然的 semantic-aware systems 问题：什么状态值得保留？放在哪里？什么时候迁移到 SSD？什么时候压缩？什么信息未来重新使用的价值最高？

因此 Memory 很值得做，但我们倾向于让它从 **long-lived runtime 的真实 bottleneck** 中自然长出来。现在做“Agent Memory”的人，一般处于 RAG、retrieval heuristic 与应用算法之间模糊的边界。

## Continual Learning 更接近 RSI，但昂贵

真正意义上的 self-evolving agent 最终要求：
$$
\pi_{\theta_0}  
\rightarrow  
\pi_{\theta_1}  
\rightarrow  
\pi_{\theta_2}  
\rightarrow \cdots  
$$

也就是 Agent 不只是保存状态，而是根据过去的 trajectory 改变 policy。

虽然更新方式也可以包括 SFT、distillation、skill synthesis 等，但对于具有长期环境反馈的 Agent，问题一般需要演化成 agentic RL：

$$
Trajectory  
\rightarrow  
Reward  
\rightarrow  
Policy\ Update  
$$


这时 infrastructure 会从单纯的 execution runtime 扩展成：
$$
Rollout  
\rightarrow  
Evaluation  
\rightarrow  
Training  
\rightarrow  
Checkpoint  
\rightarrow  
Deployment  
\rightarrow  
Rollout  
$$
它非常有研究价值，但 compute amplification 也明显更高：大量 rollout 之外，还需要反复训练、evaluation、ablation 和不同 policy version 的管理。

因此可以说，Long-horizon 是更适合当前进入 RSI Systems 的 beachhead；continual learning 则是自然的下一阶段的更难问题。

---

## Long-Horizon Agent Framework 选型

为了真正研究这些问题，framework 最重要的属性不是 benchmark score，而是：

> **能否方便地拆开 Agent runtime，并替换其中的 sandbox、storage、scheduler、trajectory 和 recovery mechanism。**

目前几个有代表性的候选如下。

| Framework                  | 定位                                   | 对 Systems Research 的意义           |
| -------------------------- | ------------------------------------ | -------------------------------- |
| **DeepSeek Harness (DSH)** | 高度插件化 Agent harness                  | **最适合作为主要研究 substrate**          |
| **OpenHands**              | 成熟 software-agent runtime / platform | 最适合作为成熟 baseline 与真实 workload    |
| **NVIDIA Molt**            | Agentic RL framework                 | 适合未来 continual-learning / RL 阶段  |
| SWE-agent 等                | Coding-agent / benchmark oriented    | 适合作为 workload，但不一定适合作为底层 runtime |

### DeepSeek Harness：目前最值得下注

DSH 的设计核心是 **Everything is a Plugin**：model、tool、session、sandbox、storage、agent loop、scheduling 与 UI 都可以作为插件替换；底层 Cordis 主要负责插件依赖、service、event 与生命周期管理。

这恰好符合 systems research 的需求。

例如可以直接实验：
$$
Default\ Storage  
\rightarrow  
Trajectory\text{-}aware\ Storage  
$$

$$
Default\ Sandbox  
\rightarrow  
Checkpointable\ Sandbox  
$$

$$
Default\ Scheduler  
\rightarrow  
Semantic\text{-}aware\ Scheduler  
$$

不必 fork 一个庞大的 Agent codebase 再修改核心逻辑。

因此我们的倾向是：**以 DSH 作为 mechanism research substrate。**

DSH截至目前仍处于 developer preview，官方明确提醒 API 会快速迭代并存在 breaking changes。

### OpenHands：成熟 baseline，不是很好 hack

OpenHands 已经形成较完整的软件 Agent runtime：Agent 通过 event stream 与 sandboxed runtime 交互，runtime 中包含 shell、browser、plugins 等执行环境。

而且 OpenHands 正在进一步把系统拆成 **Harness / Orchestrator / Control Plane**，开始讨论大规模 Agent 的 routing、budget、policy 和 observability。

因此它非常适合回答：

> 一个相对成熟、真实的 software-agent stack 今天是什么样？

我们更倾向于把它作为：

**reference architecture + baseline + workload source**

而不是所有机制创新都直接在 OpenHands 内核里完成。

### Molt：为下一阶段保留

NVIDIA Molt 的定位已经明显进入另一层：它是一个 agentic-first RL framework，以 Ray + vLLM + PyTorch training stack 支持异步 rollout 和 agentic RL。

更自然的路径可能是通过 DSH / OpenHands 研究Long Horizon Execution  

随后把 trajectory / checkpoint / environment substrate 接入 Molt。
最终形成：
$$
\boxed{  
Execution  
\rightarrow  
Memory  
\rightarrow  
Learning  
}  
$$
---

## Research Agenda

因此，可以从以下工作负载入手：

**How do we operate persistent, stateful, and eventually self-evolving intelligence?**

进而研究面向未来的新抽象、接口、架构。
