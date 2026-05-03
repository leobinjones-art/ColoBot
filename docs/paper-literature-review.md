# ColoBot 论文文献综述

## 论文一：面向普通用户的异构智能体架构设计

### 一、Agent框架与架构建模

#### 【1】LLM-Agent-UMF: LLM-based Agent Unified Modeling Framework

- **来源**：ScienceDirect，2025年10月
- **核心论点**：现有LLM Agent开发缺乏统一的软件架构，存在模块化不足和术语不一致的问题。该文提出了LLM-Agent-UMF框架，明确区分了LLM、工具和core-agent三个层次，其中core-agent包含规划、记忆、画像、行动和安全五个模块，并特别指出安全模块在以往工作中常被忽视。框架进一步将core-agent按权威性分为主动型（active）和被动型（passive），以此为基础提出了多种多core-agent架构设计。
- **与ColoBot的关联**：该框架对"安全作为Agent一等模块"的强调，直接支撑ColoBot将Sentinel设计为独立安全Agent的决策。core-agent的主动/被动分类也与ColoBot中"父Agent主动决策 + 子Agent被动执行"的异构设计高度一致。
- **可用位置**：论文一第2章（相关工作：Agent架构统一建模），第3章（架构设计：core-agent分层模型）。

#### 【2】SemaClaw: A Step Towards General-Purpose Personal AI Agents through Harness Engineering

- **来源**：arXiv 2604.11548，2026年4月
- **核心论点**：该文提出了Harness Engineering的概念——随着模型能力趋同，Agent框架的差异化竞争从"模型本身"转移到"基础设施层"。SemaClaw的核心贡献包括：DAG-based两阶段混合Agent编队协作方法、PermissionBridge行为安全系统、三层上下文管理架构、以及用于自动个人知识库构建的Agentic Wiki。
- **与ColoBot的关联**：SemaClaw是ColoBot在个人AI Agent方向上最直接的学术对标。其PermissionBridge安全系统可与Sentinel形成对比讨论；三层上下文管理与ColoBot的七维上下文有对话空间。
- **可用位置**：论文一第2章（相关工作:个人AI Agent框架），第5章（讨论：与SemaClaw的架构对比）。

#### 【3】Sophia: A Persistent Agent Framework of Artificial Life

- **来源**：arXiv 2512.18202，2025年12月
- **核心论点**：该文指出现有Agent架构缺乏一个持久化的元层来维持身份认同、验证推理、对齐短期行动与长期目标。作者提出System 3层，映射心理学概念到计算模块，实现了叙事记忆、用户与自我建模、混合奖励系统。实验表明，元认知持久化使高复杂度任务成功率提升40%。
- **与ColoBot的关联**：Sophia的"持久化身份"和"用户建模"概念与ColoBot的七维实时评估+长期记忆机制高度相关。心理状态、习惯、成长目标等维度的追踪，本质上就是Sophia所称的"User and Self Modeling"。
- **可用位置**：论文一第3章（长期记忆与用户画像：Sophia的System 3视角），第5章（讨论：持久化Agent架构对比）。

#### 【4】Safeguarding AI Agents: Developing and Analyzing Safety Architectures

- **来源**：arXiv 2409.03793，2024年9月
- **核心论点**：该文提出并评估了三种AI Agent安全框架：LLM驱动的输入输出过滤器、系统内集成的安全Agent、以及基于层级委派的内嵌安全检查系统。结论是这些框架可以显著增强AI Agent系统的安全性和安全性。
- **与ColoBot的关联**：其中"安全Agent内嵌于系统"的方案与Sentinel的部分职能有直接对应，但ColoBot更进一步将其做成独立旁路架构。
- **可用位置**：论文一第3章（异构智能体层：安全Agent的角色设计），第4章（安全机制设计对比）。

#### 【5】TB-CSPN: Beyond Prompt Chaining

- **来源**：Future Internet 2025, 17(8), 363
- **核心论点**：该文指出LangGraph和AutoGen等框架将语义推理与协作逻辑混为一谈，每次协作决策都需要LLM推理，造成性能瓶颈。TB-CSPN通过混合架构将语义处理与协作逻辑分离，实现了处理速度提升62.5%、API调用减少66.7%、吞吐量提升167%。框架支持三种Agent角色——LLM顾问（语义理解）、人类监督者（战略监督）、专业AI工作者（操作执行）。
- **与ColoBot的关联**：TB-CSPN的"编排与推理分离"思想与ColoBot的父Agent纯编排器+子Agent执行模式高度呼应。三种角色分工也可与ColoBot的异构三Agent（主Agent、子Agent、Sentinel）进行架构对比讨论。
- **可用位置**：论文一第2章（相关工作：编排架构），第3章（Orchestrator设计：编排与推理的分离）。

### 二、面向普通用户的 Agent 设计

#### 【6】AIAP: A No-Code Workflow Builder for Non-Experts

- **来源**：arXiv 2508.02470，2025年8月
- **核心论点**：该文指出非专家用户在AI设计中面临表达意图和应对系统复杂度的双重挑战。AIAP通过多Agent协作将模糊指令分解为模块化步骤，并通过统一界面隐藏底层系统复杂度。一项32人用户研究表明，AI生成的建议、模块化工作流和自动数据/行为/上下文识别显著提升了用户直观开发服务的能力。
- **与ColoBot的关联**：AIAP直接为此论文的"零概念/零配置"核心创新点提供了有力的文献支撑和可参照的基线数据（32人用户研究的实验范式）。
- **可用位置**：论文一第2章（相关工作：面向非技术用户的Agent设计），第4章（评估：参考其用户实验范式设计ColoBot的用户实验）。

#### 【7】ADEPTS: A Capability Framework for Human-Centered Agent Design

- **来源**：arXiv（aitopics.org收录），2025年7月
- **核心论点**：该文指出现有的UX启发式、工程分类法和伦理检查表分别描述Agent的不同侧面，缺乏统一的、用户面向的能力语言。ADEPTS基于六条以人为本的Agent设计原则，定义了Agent在用户面前应具备的最基本能力——可理解、可控制、可信赖。
- **与ColoBot的关联**：ADEPTS为ColoBot的界面设计思想提供了理论背书。"用户需要可理解、可控制、可信赖的Agent"这个框架，正好对应ColoBot的安全日志+开关式定制+数据本地化的设计语言。
- **可用位置**：论文一第2章（相关工作：HCI视角的Agent设计），第3章（用户界面层设计：ADEPTS原则的对齐）。

#### 【8】Agentic AI Frameworks: Architectures, Protocols, and Design Challenges

- **来源**：arXiv 2508.10146，2025年8月
- **核心论点**：该文对主流Agentic AI框架（CrewAI、LangGraph、AutoGen、Semantic Kernel、Google ADK、MetaGPT等）进行了系统综述和比较分析，评估维度包括架构原则、通信机制、记忆管理、安全护栏、以及对面向服务计算范式的对齐。研究发现各框架普遍缺乏端到端安全护栏设计，安全机制以事后补丁的形式存在。
- **可用位置**：论文一第2章（相关工作：主流框架安全能力对比），可由此引出ColoBot"安全原生"的设计定位。

#### 【9】Designing for Autonomy: UX Principles for Agentic AI

- **来源**：UX Matters，2025年12月
- **核心论点**：该文指出Agentic AI带来的最大UX变革是"交互到委托"的转变：用户不再是系统的持续控制者，AI系统开始独立执行计划、做权衡、甚至在用户不知情时做出决策。UX设计师的职责从"设计界面"转向"设计代理行为"——包括问责、伦理、可解释性、信任、治理。"好的设计让自主变成合作，坏的设计让自主变成风险。"
- **与ColoBot的关联**：该文为ColoBot的开关式定制和主动关心功能提供了UX理论支撑。"不是让AI更像一个能说会道的机器，而是像一个会关心你的朋友"的设计哲学，正是该文所论述的"从功能设计到代理行为设计"的转变。
- **可用位置**：论文一第2章（UX原则），第3章（用户界面层设计：代理行为设计理念）。

#### 【10】Don't Vibe Code, Do Skele-Code

- **来源**：arXiv，2026年3月
- **核心论点**：该文提出了Skele-Code，一种面向非技术用户的自然语言+图式界面Agent工作流构建方法。其核心思想是通过增量式、交互式、笔记本式的开发方式，降低Agent开发的门槛。
- **与ColoBot的关联**：支持ColoBot"零概念"的设计主张——用户无需理解技术概念即可定制AI行为。
- **可用位置**：论文一第2章（相关工作：非技术用户的Agent定制）。

---

## 论文二：AI 助手中的多层安全守护机制

### 一、安全架构：Agentic Safety as Architectural Principle

#### 【11】Toward a Safe Internet of Agents

- **来源**：arXiv 2512.00520，2025年11月
- **核心论点**："Agent安全是一个架构原则，而非附加组件。" 该文对Agentic系统进行了自底向上的解构，将每个组件视为双重用途接口，分析跨越三个复杂度层次：单Agent、多Agent系统、可互操作多Agent系统（IMAS）。在每个层次上，识别核心架构组件及其固安全风险，并推导缓解原则。
- **与ColoBot的关联**：此论文是目前与ColoBot安全母Agent设计在思想层面最接近的学术文献。它对Sentinel的合法性和前瞻性提供了最强的学术背书。ColoBot的"异构守护"架构可被视为该文所倡导的"架构原则"在个人AI助手领域的第一个完整工程实现。
- **可用位置**：论文二第2章（相关工作：Agent安全从附加组件到架构原则的范式转移），第5章（讨论：ColoBot对这一理念的工程验证）。同时适用于论文一的安全设计章节。

#### 【12】Safeguarding AI Agents: Developing and Analyzing Safety Architectures

- **来源**：arXiv 2409.03793，2024年9月
- **核心论点**：提出三种安全架构：LLM驱动的输入输出过滤器、系统内集成的安全Agent、层级委派式内嵌安全检查系统。结论是这些框架可以显著增强安全性。但严格来说，这三种都属于"系统内安全"架构（安全组件嵌入在业务Agent内部），与ColoBot的"旁路安全"架构形成本质对比。
- **与ColoBot的关联**：作为论文二中的关键对比对象。ColoBot的Sentinel不同于该文的"安全Agent集成于系统内"——Sentinel是独立旁路、与业务Agent平行的独立进程，拥有自己的心跳、状态同步和接管能力。这一差异恰好可以作为ColoBot的核心创新点来展开论述——从"内嵌安全"到"旁路守护"的架构演进。
- **可用位置**：论文二第2章（相关工作：三种安全架构对比），第3章（Sentinel设计：为什么旁路优于内嵌）。

#### 【13】PlanGuard: Defending Agents against Indirect Prompt Injection

- **来源**：arXiv 2604.10134，2026年4月
- **核心论点**：该文提出了一个关键洞察——现有防御方法主要集中在前置处理阶段，忽视了模型实际行为的运行时监控。PlanGuard基于上下文隔离原则，引入独立的Planner生成仅基于用户指令的合法参考动作集，并通过分层验证机制（硬约束→意图验证器）来检测参数偏差是否属于恶意劫持。在InjecAgent基准上，攻击成功率从72.8%降至0%。
- **与ColoBot的关联**：PlanGuard的"独立的Planner + 分层验证"与ColoBot的"独立Sentinel + 规则引擎/本地模型/LLM三层防线"在思想和架构上有高度共鸣。PlanGuard证明了独立于业务Agent的防御层的有效性，这为Sentinel的旁路设计提供了额外的防御有效性数据支撑。
- **可用位置**：论文二第2章（相关工作：PlanGuard的独立防御层），第3章（Sentinel三层防御与PlanGuard分层验证的对比）。

### 二、多层防御与分层安全

#### 【14】Securing AI Agents Against Prompt Injection Attacks

- **来源**：arXiv 2511.15759，2025年11月
- **核心论点**：该文提出了提示注入防御的多层防御框架，包含847个对抗测试用例，覆盖五类攻击：直接注入、上下文操纵、指令覆盖、数据窃取、跨上下文污染。三层防御机制（内容过滤+嵌入异常检测、层级系统提示护栏、多阶段响应验证）组合后将攻击成功率从73.2%降至8.7%，同时保持94.3%的基线任务性能。
- **与ColoBot的关联**：验证了"多层防御优于单一防御"的核心论点，可参考其基准测试方法设计Sentinel的验证实验。
- **可用位置**：论文二第2章（相关工作：多层防御），第4章（评估：参考其基准设计）。

#### 【15】How We Built a 100% Effective Multi-Layer Safety Filter

- **来源**：Rapidflare / Edge AI Vision Alliance，2026年4月
- **核心论点**：Rapidflare的3层防御架构与上下文工程管道并行运行，为用户体验增加零延迟。输入安全检查在约100-200ms内完成，在后台线程池中并行运行。五个分类维度：Safe、Jailbreak、Off-Topic、Injection、Harmful Intent。在ToxiGen基准上达到100%拦截率。
- **与ColoBot的关联**：验证了"安全层与业务管道并行运行可实现零延迟"这一关键设计主张的工业可行性。
- **可用位置**：论文二第2章（工业界的多层防御实践），第4章（Sentinel性能评估的参照基线）。

#### 【16】DIESEL: Lightweight Inference-Guidance for Content Filtering

- **来源**：ACL Anthology，2025年
- **核心论点**：DIESEL是一种轻量级推理引导技术，可无缝集成到任何自回归LLM中，在生成过程中语义过滤不良内容。它既可以作为独立的安全防护，也可作为辅助防御层。
- **与ColoBot的关联**：DIESEL可作为Sentinel第二层（本地模型分类器）的替代或补充方案在Related Work中讨论。
- **可用位置**：论文二第2章（相关工作：LLM内容过滤技术）。

### 三、Agent故障容错与恢复

#### 【17】PALADIN: Self-Correcting Language Model Agents to Cure Tool-Failure Cases

- **来源**：arXiv 2509.25238，2025年9月
- **核心论点**：PALADIN提出了一个通用化的框架，为语言Agent赋予鲁棒的故障恢复能力。工具增强的语言Agent在部署中常因执行时工具错误（超时、输出格式错误、静默API失败等）而失败，在多Agent系统中，单个未处理的错误可以跨推理步骤或Agent级联传播，导致死锁或幻觉成功。PALADIN的核心思想是自纠正——当工具调用失败时，Agent自动检测错误、分析原因、重新规划替代路径。
- **与ColoBot的关联**：直接支撑Sentinel接管机制的必要性。PALADIN研究证明：在单Agent上，故障会导致该Agent失败；在多Agent上，故障可能会导致系统性瘫痪。Sentinel的接管机制可以视为从更高的系统架构层面来解决这一问题——不是让Agent自修复，而是独立的安全守护层检测异常并接管。Sentinel在父Agent崩溃或因安全审核陷入阻塞/死循环时进行带上下文接管，可以被定义为一种创新的Agent-level故障恢复范式。
- **可用位置**：论文二第3章（接管机制设计：Agent故障恢复范式的创新），第4章（评估：参考PALADIN设计接管机制的有效性验证实验）。论文一第3章（Orchestrator故障恢复设计）。

---

## 文献综述整理表

### 论文一核心文献

| 编号 | 论文 | 年份 | 核心贡献 | 论文一位置 |
|------|------|------|----------|------------|
| 1 | LLM-Agent-UMF | 2025 | Agent架构统一建模，安全模块被忽视 | 第2章、第3章 |
| 2 | SemaClaw | 2026 | Harness Engineering，个人AI Agent框架 | 第2章、第5章 |
| 3 | Sophia | 2025 | System 3持久化身份层，用户建模 | 第3章、第5章 |
| 4 | Safeguarding AI Agents | 2024 | 三种安全架构对比 | 第3章（安全设计） |
| 5 | TB-CSPN | 2025 | 编排与推理分离，三种Agent角色 | 第2章、第3章 |
| 6 | AIAP | 2025 | 面向非专家的No-Code工作流 | 第2章、第4章 |
| 7 | ADEPTS | 2025 | 以人为本Agent能力框架 | 第2章、第3章 |
| 8 | Agentic AI Frameworks Survey | 2025 | 7个主流框架系统综述 | 第2章 |
| 9 | Designing for Autonomy | 2025 | Agentic AI的UX设计原则 | 第2章、第3章 |
| 17 | PALADIN | 2025 | Agent故障恢复 | 第3章 |

### 论文二核心文献

| 编号 | 论文 | 年份 | 核心贡献 | 论文二位置 |
|------|------|------|----------|------------|
| 11 | Toward a Safe Internet of Agents | 2025 | Agent安全是架构原则，非附加组件 | 第2章、第5章 |
| 12 | Safeguarding AI Agents | 2024 | 内嵌式安全Agent三种架构 | 第2章（对比对象） |
| 13 | PlanGuard | 2026 | 独立Planner + 分层验证 | 第2章、第3章 |
| 14 | Securing AI Agents Against Prompt Injection | 2025 | 多层防御框架，847测试用例 | 第2章、第4章 |
| 15 | Multi-Layer Safety Filter (Rapidflare) | 2026 | 工业级三层防御，零延迟并行运行 | 第2章、第4章 |
| 16 | DIESEL | 2025 | 轻量级LLM推理引导内容过滤 | 第2章 |
| 17 | PALADIN | 2025 | Agent工具故障自纠正恢复 | 第3章、第4章 |

### 双重适用文献

| 编号 | 论文 | 适用原因 |
|------|------|----------|
| 11 | Toward a Safe Internet of Agents | 其"安全性是架构原则"的核心理念同时支撑两篇论文 |
| 4/12 | Safeguarding AI Agents | 论文一中用于异构智能体层安全设计，论文二中作为内嵌式安全的对比基线 |
| 17 | PALADIN | 论文一中用于Orchestrator故障恢复，论文二中支撑接管机制设计 |

### 综述类文献

| 编号 | 论文 | 综述范围 | 可用价值 |
|------|------|----------|----------|
| 8 | Agentic AI Frameworks Survey | 7个主流Agentic AI框架 | 论文一第2章 |
| 14 | Securing AI Agents Against Prompt Injection | 847测试用例，5类攻击 | 论文二第2章、第4章 |

---

## 后续建议

### 1. 创建语义关联表格

建议在每篇论文大纲的"相关工作"章节中创建一个矩阵表格：

- X轴：安全实现方式（模型层对齐 / 系统内嵌 / 独立旁路）
- Y轴：用户门槛（开发者 / 非技术用户）

将每篇文献精确定位在矩阵中，ColoBot自然占据"独立旁路 + 非技术用户"的空白格子——用可视化直接展示"为什么ColoBot是独特的"。

### 2. 最优先精读的三篇

1. **Toward a Safe Internet of Agents**（arXiv:2512.00520）——架构级安全哲学，直接背书Sentinel设计理念
2. **LLM-Agent-UMF**——Agent统一建模框架，支撑异构架构的形式化描述
3. **PALADIN**——故障恢复机制，为接管机制提供对比基线和实验范式

### 3. 语言统一

- 英文投稿：引用格式统一为arXiv标准（如 arXiv:2512.00520）或会议标准
- 中文期刊（如《软件学报》《计算机学报》）：需要补充中文核心文献的检索