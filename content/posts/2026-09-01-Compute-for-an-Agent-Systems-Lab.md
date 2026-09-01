---
title: "Compute for an Agent Systems Lab"
latex: true
---

> **Buy iteration. Pool capability. Lease topology. Rent scale.**

如果实验室研究的是 Long-Horizon Agents，并希望未来进入 Continual Learning / Agentic RL，那么算力建设**不应该简单复制传统 AI Lab 的做法**。

问题不只是“需要多少 GPU”。

更根本的问题是：

> **Agent workload 的计算形态正在改变。**

传统 LLM serving 可以近似看成：

$$
Request  
\rightarrow  
GPU  
\rightarrow  
Response  
$$

而一个持续数小时乃至更久的 Agent 更接近：

$$
LLM  
\rightarrow  
Tool  
\rightarrow  
Environment  
\rightarrow  
Storage  
\rightarrow  
LLM  
$$

模型负责 reasoning，但真正的 trajectory 会不断经过 Python、shell、compiler、browser、filesystem、database、sandbox 和 network。

因此 Agent Infra 的资源模型不是 GPU-centric，而是：

$$
GPU  
\leftrightarrow  
CPU  
\leftrightarrow  
Memory  
\leftrightarrow  
Storage  
\leftrightarrow  
Network  
$$

更重要的是，bottleneck 会随着 trajectory 的 phase 改变。

Long-horizon execution 可能首先受 CPU、sandbox density 和 snapshot I/O 限制；Memory systems 会进一步把 DRAM、NVMe 和 network 拉入 critical path；真正进入 Continual Learning / RL 后，rollout、training 和 model synchronization 才会让高速 GPU fabric 成为主要问题。

所以实验室真正应该建设的，不是一座小型 GPU farm，而是一个可以复现不同 computational regimes 的 systems testbed。

---

## Start Generic, Then Specialize


$$
Profile  
\rightarrow  
Hypothesis  
\rightarrow  
Buy  
\rightarrow  
Re\text{-}profile  
$$

第一批机器首先是一种 **measurement instrument**。

我们应该先跑真实的 coding / research / browser agents，再测清楚：
$$
T_{LLM}  
+  
T_{tool}  
+  
T_{sandbox}  
+  
T_{storage}  
+  
T_{network}  
$$

例如，如果 50 条 coding trajectories 中 GPU utilization 只有 40%，而 compiler、browser 和 sandbox execution 占据大量 sequential critical path，那么第二张 GPU 很可能几乎无法改善 end-to-end performance。

相反，如果 32GB VRAM 已经持续限制 long-context experiment，那么 large-memory GPU 才是合理的下一笔采购。

如果只有跨 GPU synchronization 后性能才开始恶化，那么需要解决的也不是“更多 GPU”，而是 GPU fabric。

这意味着：

> **The first machine should be generic enough to reveal the workload.  
> The next machine should be specialized enough to exploit what we learned.**

采购本身应该成为 workload characterization 的结果。

---

# Personal Compute: Optimize Iteration

Personal Node 的目标不是训练大模型，而是让研究者能够随时：

> 修改 runtime、启动模型、运行 Agent、profile 系统，而不需要排队。

现阶段，一个合理的 minimum useful node 是：

$$
\text{Strong CPU}  
+  
1\times 32GB\text{-class GPU}  
+  
128\text{–}256GB RAM  
+  
Fast\ NVMe  
$$

以当前硬件为例，这很自然地对应一台高端 CPU + 单 RTX 5090 的 desktop。

它看起来更像 enthusiast / gaming PC，而不是传统 workstation。

传统 workstation 通常为了大量 PCIe lanes、多 GPU、超大 ECC memory、专业认证和 enterprise lifecycle 付出很高成本。

但 Agent researcher 的 Personal Node 首先优化的是：

$$
\frac{\text{Research Iterations}}{\text{Day}}  
$$

我们需要高单线程 CPU、一张足够强的 GPU、大内存和快速本地状态，而不是第一天就拥有 96 个 CPU cores 和四张专业卡。

---

## Why Desktop, Not Laptop?

高端 gaming laptop 很适合做开发终端：

$$
Coding + SSH + API + Small\ Models  
$$

但它不应该成为实验室的 reference compute node。

原因不是笔记本“不能跑 AI”，而是移动版旗舰 GPU 和桌面卡在显存、持续功耗和散热预算上并不属于同一档能力。

对于 20–30B 级模型，24GB 与 32GB 显存的差异尤其明显。模型权重能够塞进去，并不意味着还有足够空间留给 KV cache、runtime workspace、长 context 和 experiment headroom。

所以更合理的分工是：

> **Laptop is the interface. Desktop is the instrument.**

研究者用笔记本移动开发，通过 SSH 连接自己的计算节点；真正持续运行 inference、profiling 和 systems experiment 的是 desktop。

---

## Why One GPU?

单张 32GB GPU 已经跨过一个很关键的门槛。

27B 级模型的 BF16 权重大约需要 54GB，但经过量化后，已经能够进入单卡 32GB GPU 的实用范围。

因此每位研究者都可以拥有完整的：

$$
Model  
\rightarrow  
vLLM/SGLang  
\rightarrow  
Agent\ Harness  
\rightarrow  
Sandbox  
\rightarrow  
Trajectory  
$$

本地 loop。

这已经足够研究：

- checkpoint / replay
- Agent memory
- runtime scheduling
- sandbox integration
- inference instrumentation
- small-scale rollout

Personal GPU 的价值不是“在本地复刻 frontier model”，而是：

> **拥有一个完全可控、可以每天反复破坏和重构的 execution substrate。**

---

## Why Not Dual 5090?

双 GPU 当然有价值。

例如：

```
GPU 0 → policy / rollout
GPU 1 → evaluator / judge
```

但它并不等价于一张统一大显存 GPU，也没有提供真正的数据中心级 GPU fabric。

更现实的问题是 power density。

当 GPU 功耗超过 1kW 后，再加 CPU、RAM、SSD 和 cooling，一台“个人电脑”很快开始具有 server 的供电、散热和噪音特征。

因此一个很自然的设计边界是个人节点保持简单；复杂能力集中到机房。

---

# CPU Is a First-Class Resource

Agent Infra 也不应该继续沿用：

> GPU 是计算，CPU 只是负责喂数据

的思维。

Agent trajectory 中大量行为天然运行在 CPU：

$$
Python,\ compiler,\ shell,\ browser,\ database,\ filesystem  
$$

而且其中很多步骤不可被大规模 batch，直接位于 sequential critical path。

随着模型 inference 变快，Amdahl's law 反而会让 CPU-side execution 来越显眼。

因此 Personal Node 更需要：

> **strong single-thread performance + enough cores**

而不是简单追求最大 core count。

第一代机器使用高端 mainstream CPU，反而是一个很好的 neutral baseline。

如果后续 profiling 表明真正的问题是：

- 数十个 VM；
- 256GB+ memory；
- 多 NIC；
- 大量 NVMe；
- FPGA / DPU；
- PCIe topology；

再进入 Threadripper / workstation platform。

也就是说：

$$
Commodity\ CPU  
\rightarrow  
Measure  
$$

$$
Workstation\ CPU  
\rightarrow  
Solve\ a\ measured\ I/O\ problem  
$$

而不是提前猜测。

---

# Shared Systems Pool: Pool Throughput

Personal Node optimizes latency, Shared infrastructure optimizes throughput.

Long-horizon workload 很可能出现：

$$
1\ GPU + 50\ sandboxes  
$$

而不是：

$$
50\ GPUs + 1\ process  
$$

因此一个 Agent Systems Lab 很可能比传统 ML Lab 更早需要 CPU-heavy shared nodes。

这些节点承担：

- containers / microVMs
- browsers
- compilers
- databases
- simulations
- reward environments

同时，大量 trajectory、snapshot、VM image、checkpoint 和 trace 会持续进入 storage。

所以 NVMe 和 network 不应该被视为“GPU 服务器的配套设施”。

它们本身就是研究对象。

理想 testbed 应该允许我们主动构造：

$$
GPU  
\leftrightarrow  
CPU  
\leftrightarrow  
Storage  
\leftrightarrow  
Network  
$$

之间的 placement、contention、migration 和 failure。

---

# Shared GPU Pool: Buy Different Capability

当每位研究者已经拥有一张单卡 GPU 后，共享 GPU 层不应该只是：

> 再买更多相同的卡。

Shared Pool 应该提供 Personal Node **无法提供的能力**。

例如 96GB-class PCIe GPU 可以解决：

- BF16 20–30B models
- 70B-class inference
- long context
- large KV cache
- VLM
- high-concurrency rollout

初期甚至不需要一次采购八张。

2–4 张 large-memory GPU 已经可以同时承担两种角色。

对于 checkpoint、memory、sandbox 等 inference layer 以上的研究，可以部署统一的 Lab Model API，让不同课题共享同一个 reference model。

对于 vLLM、SGLang、KV cache、scheduler 或 CUDA 等 inference system 本身的研究，则直接分配 exclusive GPU，避免 noisy neighbor 污染 measurement。

所以 Shared GPU Pool 购买的是：

> **memory capacity and inference capability**

而不是简单的 GPU count。

---

# Lease Topology

Large-memory PCIe GPU 仍然不能替代 HGX。

当研究进入 Continual Learning / Agentic RL：

$$
Rollout  
\rightarrow  
Reward  
\rightarrow  
Training  
\rightarrow  
Weight\ Update  
$$

系统开始频繁进行 tensor parallel、FSDP、collective communication 和 policy synchronization。

这时候真正昂贵而且稀缺的资源变成：

$$
\text{GPU Fabric}  
$$

也就是 NVLink / NVSwitch 这样的 topology。

因此 HGX 更适合在 workload 已经证明需要之后，再进行长期 reservation 或租赁。

我们付的钱不是为了“拥有八张卡”。

而是为了获得：

> **一种 Personal Node 和 PCIe GPU Pool 无法复现的 communication regime。**

---

# Rent Scale

最后才是 16、32、64 GPU 甚至更大的 multi-node cluster。

它们用于验证：

- scaling
- distributed rollout
- actor / learner separation
- network scheduling
- node failure
- heterogeneous placement

而不是开发。

正确路径应该是：

$$
Personal  
\rightarrow  
Shared  
\rightarrow  
HGX  
\rightarrow  
Cloud  
$$

越往上，experiment frequency 越低、成本越高，也越接近论文最终 evaluation。

---

# A Practical Build Order

对于一个刚开始做 Long-Horizon Agent Systems 的实验室，最好首先建设一批 commodity research desktops，而不是立即购买复杂 multi-GPU workstation。

它们只需要跨过 minimum useful threshold：

|Layer|Role|Typical Capability|
|---|---|---|
|Personal Node|iteration|strong CPU + 1×32GB GPU|
|CPU / Storage Pool|environment throughput|many cores + large RAM + NVMe|
|Shared GPU Pool|memory / inference capacity|96GB-class GPUs|
|HGX|GPU fabric|NVLink / NVSwitch|
|Cloud Cluster|scale|multi-node GPUs|

第一阶段最重要的产出，属于 Agent Workload Characterization

它告诉我们 CPU critical path、GPU utilization、VRAM demand、RAM working set、NVMe traffic、sandbox density 和 network behavior。

然后再让这些 measurement 决定下一代 testbed。

---

# The Larger Principle

这套设计真正解耦的是四件不同的事情：

$$
Iteration  
\neq  
Throughput  
\neq  
Topology  
\neq  
Scale  
$$

Personal Node 不应该是一台缩小版 server。

Shared Server 也不应该只是放大版 Personal Node。

同样地，Laptop、Desktop、CPU Pool、large-memory GPU、HGX 和 Cloud Cluster 都不需要承担相同职责。

最终，我们想建设的不是一座 GPU farm，而是一个能够不断改变 bottleneck、state placement 和 execution topology 的：

> **heterogeneous systems playground for long-lived intelligence.**

因此最值得保留的两条原则是：

> **Buy iteration. Pool capability. Lease topology. Rent scale.**

以及：

> **Start generic. Profile the workload. Let the next machine be an experimental conclusion.**
