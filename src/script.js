import { buildPromptAwareMergedAnswer, buildPromptAwareMockResponse } from "./utils/mock-response-utils.mjs";
import { hasLiveProviderConfig } from "./utils/frontend-provider-utils.mjs";
import {
  buildModelTestPrompt,
  describeModelTestFailure
} from "./utils/model-test-utils.mjs";
import {
  buildFallbackSynthesis,
  buildSynthesisPayload,
  buildSynthesisPromptText,
  getDefaultSynthesisSystemPrompt
} from "./utils/synthesis-utils.mjs";
import { buildScopedStorageKey, normalizeLocalAccount } from "./utils/account-scope-utils.mjs";
import {
  resolveFriendProfilesForScope,
  shouldBootstrapDefaultFriends
} from "../features/group/friend-bootstrap-utils.mjs";
import { countSelectedGroupMembers } from "../features/group/group-settings-utils.mjs";
import { getWorkflowPreflightState } from "../features/group/workflow-run-utils.mjs";
import { hasThinkingContent, normalizeThinkingEnabled } from "./utils/thinking-config-utils.mjs";
import { callFrontendStream } from "./utils/ai-sdk-frontend-stream.mjs";
import { renderSafeMarkdown } from "./utils/markdown-render-utils.mjs";
import { renderAiMessageMarkdown } from "./utils/ai-message-streamdown.js";
import {
  MessageCard,
  renderMessages,
  appendMessage,
  updateMessage,
  Components
} from "./components/message-card.js";
import { exportToHtml, exportToImage, exportToPdf } from "./utils/export-utils.mjs";


const STORAGE_KEYS = {
  runtime: "multiplechat-runtime-mode",
  account: "multiplechat-local-account",
  history: "multiplechat-session-history",
  models: "multiplechat-model-configs",
  friends: "openchat-friend-profiles",
  groupSettings: "openchat-default-group-settings",
  language: "multiplechat-language",
  theme: "openchat-theme",
  fontSize: "openchat-font-size",
  frontendAccess: "openchat-frontend-access-md5",
  promptTemplates: "openchat-prompt-templates"
};

const DEFAULT_PROMPT_TEMPLATES = [
  {
    id: "builtin-group-synthesizer",
    name: "群友整合发言专家",
    builtIn: true,
    content: `# AI群友整合发言专家 (Group Chat Synthesizer)

## 一、角色定义

你是一位资深的「群聊发言整合专家」，擅长从多人碎片化对话中提炼核心价值。

你具备信息架构师的结构化能力、编辑的内容筛选眼光、以及学术摘要的严谨归纳能力。你的工作就像一位顶级会议纪要撰写者——不遗漏任何有价值的观点，同时让混乱变得清晰。

### 核心原则

| 编号 | 原则 | 说明 |
|:--|:--|:--|
| P1 | **来源可溯** | 每一条被采纳的观点、建议、代码、数据都必须标注来源群友 |
| P2 | **内容保真** | 忠实保留原始观点的核心含义，不扭曲、不过度解读 |
| P3 | **优质筛选** | 准确性 + 实用性 + 全面性三维兼顾，宁多勿漏 |
| P4 | **结构清晰** | 输出必须逻辑分明、层次清晰、易于阅读 |
| P5 | **冲突标注** | 群友观点存在矛盾时，如实呈现双方观点，不擅自裁判 |

---

## 二、输入规范

### 输入格式

用户直接粘贴群聊记录，通常包含：
- 群友昵称/ID
- 发言内容（文字、代码、链接等）
- 可能包含时间戳，也可能不包含
- 可能包含表情、回复引用、@提及等

### 预处理流程

1. **识别群友**：提取所有参与发言的群友昵称/ID
2. **过滤噪音**：过滤纯闲聊/无信息量内容（如"哈哈""666""顶"等）
3. **识别话题**：识别对话主题（可能有1个或多个话题线）
4. **归类发言**：将碎片化发言按话题归类
5. **识别关系**：识别群友之间的补充、纠正、争论关系

### 边界情况处理

| 情况 | 处理方式 |
|:--|:--|
| 只有1个群友发言 | 直接整理该群友发言，无需整合 |
| 包含多个不相关话题 | 按话题分别整合，每个话题独立输出 |
| 群友发言存在明显事实错误 | 标注为「⚠️ 待验证」，不直接删除 |
| 聊天记录过短/信息量不足 | 如实告知信息量有限，输出可整理的部分 |

---

## 三、质量评估体系

对每条群友发言进行三维评估，决定保留策略：

| 维度 | 权重 | 评估标准 |
|:--|:--|:--|
| **准确性** | 35% | 事实是否正确、逻辑是否严谨、是否有依据 |
| **实用性** | 35% | 是否包含可操作的建议、代码、方案、工具推荐 |
| **全面性** | 30% | 是否提供了独特视角、补充信息、边界条件 |

### 保留规则

- ✅ 三维中**任一维度有价值** → 保留
- 🔄 纯重复内容 → 合并到首次提出者名下
- ❌ 纯闲聊/表情/无信息量 → 过滤
- ⚠️ 有争议但有道理的观点 → 保留并标注争议

---

## 四、输出格式规范

**所有输出必须使用 Markdown 格式。** 按以下结构依次输出：

### 必选模块

#### 📌 话题识别
> 一句话概括本次群聊讨论的核心话题。多话题则分别列出。

#### 👥 参与群友
> 列出所有贡献了有效内容的群友昵称。

#### 🏆 最佳整合回答
> **这是核心产出。** 融合所有群友的优质内容，输出一份"终极最佳回答"——像一位全知的专家，吸收了所有群友的智慧后给出的完美回答。
>
> 要求：
> - 结构清晰，使用标题、列表、代码块等 Markdown 格式
> - 内容完整，覆盖所有群友提到的有价值要点
> - 逻辑连贯，不是简单拼接，而是有机融合
> - 如包含代码，保留最优版本并注明来源

#### 📋 观点溯源清单
> 逐条列出整合回答中的关键观点/内容，标注来源群友。
>
> 格式：
> - 「观点/内容摘要」—— 来自 @群友昵称
> - 「观点/内容摘要」—— 来自 @群友A、@群友B（多人共同提出时）

### 可选模块（存在时才输出）

#### ⚡ 独特亮点
> 特别有价值的独到见解、容易被忽略的关键补充。

#### ⚠️ 争议与待验证
> 群友之间存在分歧的观点，或事实准确性存疑的内容。如实呈现各方观点，不做裁判。

### 格式细则

- 群友昵称统一用 **@昵称** 格式标注
- 代码块保留原始语言标注
- 重要内容使用 **加粗** 强调
- 多话题时使用分割线 \`---\` 分隔

---

## 五、工作流程

\`\`\`
接收聊天记录
    ↓
① 识别群友、话题、发言结构
    ↓
② 按质量评估体系筛选有价值内容
    ↓
③ 按话题线归类（单话题跳过此步）
    ↓
④ 提取每位群友的核心观点、建议、代码、数据
    ↓
⑤ 识别群友之间的观点矛盾或事实冲突
    ↓
⑥ 将所有优质内容有机融合为最佳回答
    ↓
⑦ 为每个关键观点标注来源群友
    ↓
⑧ 按输出格式规范生成 Markdown 文档
\`\`\`

---

## 六、行为约束

### 🚫 禁止

| 编号 | 规则 |
|:--|:--|
| F1 | 禁止篡改群友的原始观点含义 |
| F2 | 禁止在争议观点上擅自站队 |
| F3 | 禁止添加群友未提及的新观点（除非明确标注为「📝 编者补充」） |
| F4 | 禁止遗漏任何群友的有价值贡献 |

### ✅ 必须

| 编号 | 规则 |
|:--|:--|
| M1 | 每条被采纳的内容必须标注来源 |
| M2 | 最佳整合回答必须覆盖所有有价值要点 |
| M3 | 存在事实错误时必须标注 ⚠️ 待验证 |
| M4 | 多话题时必须分别整合 |

---

## 七、错误处理

| 触发条件 | 响应 |
|:--|:--|
| 输入不是聊天记录 | 😊 请粘贴群聊记录，我来帮你整合群友们的发言。 |
| 无法识别群友身份 | ⚠️ 无法识别发言者身份，请确认聊天记录中包含群友昵称/ID。 |
| 全是闲聊无实质内容 | 📋 该段聊天记录以闲聊为主，未发现需要整合的实质性内容。 |
| 内容过长 | ⚠️ 聊天记录较长，我将分话题整合输出。 |`
  }
];

const FRONTEND_AUTH_ENV_HASH = import.meta.env.VITE_FRONTEND_PASSWORD_MD5 || "";
const FRONTEND_AUTH_CONFIG_PATH = "/frontend-auth.json";
const LOCAL_MODEL_CONFIG_PATH = "/openchat.local-models.json";

const DEFAULT_MODELS = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    provider: "OpenAI",
    model: "gpt-4.1",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    avatar: "",
    enabled: true,
    description: "Strong first-pass structure and synthesis."
  },
  {
    id: "claude",
    name: "Claude",
    provider: "Anthropic",
    model: "claude-3-7-sonnet-latest",
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: "",
    avatar: "",
    enabled: true,
    description: "More nuance, stronger writing, better critique."
  },
  {
    id: "gemini",
    name: "Gemini",
    provider: "Google",
    model: "gemini-2.5-pro",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: "",
    avatar: "",
    enabled: true,
    description: "Useful for verification and factual tension checks."
  },
  {
    id: "grok",
    name: "Grok",
    provider: "xAI",
    model: "grok-3",
    baseUrl: "https://api.x.ai/v1",
    apiKey: "",
    avatar: "",
    enabled: true,
    description: "Sharper market angles and more aggressive framing."
  }
];

const PROVIDER_OPTIONS = [
  "OpenAI",
  "Anthropic",
  "Google",
  "xAI",
  "DeepSeek",
  "OpenRouter",
  "Azure OpenAI",
  "Moonshot",
  "Alibaba",
  "Tencent",
  "Zhipu",
  "Baidu",
  "Mistral",
  "Cohere",
  "Meta",
  "Custom"
];

const PROVIDER_PRESETS = {
  OpenAI: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1" },
  Anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-3-7-sonnet-latest" },
  Google: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-pro"
  },
  xAI: { baseUrl: "https://api.x.ai/v1", model: "grok-3" },
  DeepSeek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  OpenRouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4.1" },
  "Azure OpenAI": { baseUrl: "https://YOUR-RESOURCE.openai.azure.com/openai/deployments", model: "deployment-name" },
  Moonshot: { baseUrl: "https://api.moonshot.cn/v1", model: "kimi-k2-0711-preview" },
  Alibaba: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  Tencent: { baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-turbo" },
  Zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" },
  Baidu: { baseUrl: "https://qianfan.baidubce.com/v2", model: "ernie-4.0-turbo-8k" },
  Mistral: { baseUrl: "https://api.mistral.ai/v1", model: "mistral-large-latest" },
  Cohere: { baseUrl: "https://api.cohere.ai/compatibility/v1", model: "command-a-03-2025" },
  Meta: { baseUrl: "https://api.llama.com/compat/v1", model: "Llama-4-Maverick-17B-128E-Instruct-FP8" },
  Custom: { baseUrl: "https://api.example.com/v1", model: "custom-model-id" }
};

const PLATFORM_OPTIONS = [
  {
    id: "gemini",
    name: "Gemini",
    company: "Google",
    strengths: {
      "zh-CN": "Google 搜索、全球网页发现、公开知识站点",
      en: "Google search, global web discovery, and knowledge sources"
    },
    coverage: {
      "zh-CN": "适合国际资料、英文网页、研究与百科型问题。",
      en: "Best for international research, English pages, and web-wide discovery."
    }
  },
  {
    id: "grok",
    name: "Grok",
    company: "xAI",
    strengths: {
      "zh-CN": "X / Twitter 实时动态、趋势讨论、社交信号",
      en: "X/Twitter real-time discussion, trends, and social signals"
    },
    coverage: {
      "zh-CN": "适合热点话题、舆情、人物近期动态和社交讨论。",
      en: "Best for social chatter, trend tracking, and public-figure updates."
    }
  },
  {
    id: "doubao",
    name: "豆包",
    company: "字节跳动",
    strengths: {
      "zh-CN": "抖音、头条、中文热点、短视频趋势",
      en: "Douyin, Toutiao, Chinese trends, and short-video topics"
    },
    coverage: {
      "zh-CN": "适合中文热点、消费趋势、短视频内容与泛娱乐信息。",
      en: "Best for Chinese trend sensing, consumer topics, and short-video content."
    }
  },
  {
    id: "yuanbao",
    name: "元宝",
    company: "腾讯",
    strengths: {
      "zh-CN": "微信公众号、腾讯生态、中文信源补充",
      en: "WeChat public accounts, Tencent sources, and Chinese source expansion"
    },
    coverage: {
      "zh-CN": "适合公众号文章、中文深度分析、腾讯系内容。",
      en: "Best for WeChat articles and Tencent-linked Chinese sources."
    }
  },
  {
    id: "longcat",
    name: "LongCat",
    company: "美团",
    strengths: {
      "zh-CN": "本地生活、行业知识、结构化中文总结",
      en: "Local services, Chinese knowledge, and structured summaries"
    },
    coverage: {
      "zh-CN": "适合餐饮、旅游、城市生活、行业资料与中文知识整理。",
      en: "Best for lifestyle, travel, merchant info, and structured Chinese knowledge."
    }
  },
  {
    id: "qwen",
    name: "通义千问",
    company: "阿里巴巴",
    strengths: {
      "zh-CN": "通用中文搜索、电商与企业生态、公开网页",
      en: "General Chinese web search, ecommerce context, and public pages"
    },
    coverage: {
      "zh-CN": "适合作为通用中文检索 fallback，也适合阿里生态相关问题。",
      en: "Best as a broad Chinese-web fallback and Alibaba-related source."
    }
  },
  {
    id: "minimaxi",
    name: "MiniMax",
    company: "MiniMax",
    strengths: {
      "zh-CN": "通用中文问答、生活问题、B 站等泛内容查询",
      en: "General Chinese Q&A, lifestyle prompts, and broad consumer content"
    },
    coverage: {
      "zh-CN": "适合轻量信息检索、生活类问题和内容型问答。",
      en: "Best for lightweight discovery, lifestyle prompts, and broad Chinese Q&A."
    }
  }
];

const I18N = {
  "zh-CN": {
    titles: {
      workspace: "OpenChat - \u591a\u6a21\u578b\u5de5\u4f5c\u53f0",
      settings: "OpenChat - \u6a21\u578b\u8bbe\u7f6e",
      friends: "OpenChat - \u7fa4\u53cb",
      account: "OpenChat - \u8d26\u6237",
      history: "OpenChat - \u5386\u53f2\u8bb0\u5f55"
    },
    home: {
      sideLabel: "\u4f1a\u8bdd",
      newChat: "\u65b0\u5efa\u5bf9\u8bdd",
      introTitle: "OpenChat",
      heroKicker: "\u8ba9\u591a\u4e2a AI \u5728\u540c\u4e00\u4e2a\u804a\u5929\u4e2d\u534f\u4f5c",
      heroCopy:
        "\u5148\u6ce8\u518c AI \u7fa4\u53cb\uff0c\u518d\u628a\u4ed6\u4eec\u62c9\u5165\u540c\u4e00\u4e2a\u7fa4\u804a\uff0c\u8ba9\u4e0d\u540c\u89d2\u8272\u5728\u540c\u4e00\u6761\u4e3b\u5bf9\u8bdd\u91cc\u534f\u4f5c\uff0c\u6700\u540e\u7531\u4f60\u6307\u5b9a\u7684\u7fa4\u53cb\u8f93\u51fa\u6574\u5408\u7b54\u6848\u3002",
      promptPlaceholder: "\u8f93\u5165\u4f60\u7684\u95ee\u9898...",
      enterHint: "Enter \u53d1\u9001\uff0cShift+Enter \u6362\u884c",
      friendsInChat: "\u5f53\u524d\u7fa4\u804a\u6210\u5458",
      groupSettings: "\u7fa4\u8bbe\u7f6e",
      groupSettingsTitle: "\u8c03\u6574\u6210\u5458\u3001\u6574\u5408\u7fa4\u53cb\u4e0e\u7edf\u4e00 system prompt",
      memberSelection: "\u6210\u5458\u9009\u62e9",
      synthesisToggle: "开启整合群友",
      synthesisHint: "开启后，由指定的整合群友对其他群友的回答进行整合总结。",
      synthesisFriend: "整合群友",
      sharedPromptToggle: "\u5f00\u542f\u7edf\u4e00 system prompt",
      sharedPromptHint:
        "\u5f53\u524d\u4f1a\u8bdd\u5f00\u542f\u540e\uff0c\u6240\u6709\u7fa4\u53cb\u90fd\u4f1a\u4f7f\u7528\u540c\u4e00\u4efd system prompt\uff0c\u5e76\u8986\u76d6\u5404\u81ea\u7684\u4e2a\u4eba prompt\u3002",
      sharedPromptPlaceholder: "\u8f93\u5165\u672c\u4f1a\u8bdd\u7684\u7edf\u4e00 system prompt...",
      platformFeatureToggle: "\u5f00\u542f\u5e73\u53f0\u641c\u7d22\u80fd\u529b",
      platformFeatureHint:
        "\u63a5\u5165 AI Search Hub \u7684\u591a\u5e73\u53f0\u80fd\u529b\u3002\u5f00\u542f\u540e\uff0c\u53ef\u4e3a\u5f53\u524d\u7fa4\u804a\u6307\u5b9a\u4e00\u4e2a\u4f18\u5148\u4f7f\u7528\u7684\u6570\u636e\u5e73\u53f0\u3002",
      platformFeatureLabel: "\u641c\u7d22\u5e73\u53f0",
      platformFeatureCardLabel: "\u5e73\u53f0\u80fd\u529b",
      applyCurrentConversation: "\u4ec5\u5e94\u7528\u5230\u5f53\u524d\u4f1a\u8bdd",
      saveDefaultGroup: "\u4fdd\u5b58\u4e3a\u9ed8\u8ba4\u7fa4\u8bbe\u7f6e",
      run: "\u53d1\u9001",
      ready: "\u5c31\u7eea",
      finalSynthesis: "\u6700\u7ec8\u6574\u5408",
      rebuild: "\u91cd\u65b0\u751f\u6210",
      suggestion1: "\u51b7\u6c34\u771f\u7684\u80fd\u591a\u6d88\u8017\u70ed\u91cf\u5417\uff1f",
      suggestion2: "\u8fdc\u7a0b\u529e\u516c\u6bd4\u5750\u73ed\u66f4\u597d\u5417\uff1f",
      suggestion3: "\u5b66\u4e60\u4e00\u95e8\u65b0\u8bed\u8a00\u7684\u6700\u4f73\u65b9\u5f0f\u662f\u4ec0\u4e48\uff1f"
    },
    settings: {
      titleLabel: "\u8bbe\u7f6e",
      title: "\u6a21\u578b\u914d\u7f6e",
      copy:
        "\u7528\u6237\u53ef\u4ee5\u4e3a\u6bcf\u4e2a\u6a21\u578b\u914d\u7f6e provider\u3001model id\u3001base URL \u4e0e API key\u3002",
      runtimeLabel: "\u8fd0\u884c\u6a21\u5f0f",
      runtimeTitle: "\u6267\u884c\u65b9\u5f0f",
      frontendMode: "\u524d\u7aef\u6a21\u5f0f",
      backendMode: "\u540e\u7aef\u6a21\u5f0f",
      routingLabel: "\u8def\u7531",
      routingTitle: "\u542f\u7528\u7684\u6a21\u578b",
      appearanceLabel: "\u5916\u89c8",
      appearanceTitle: "\u4e3b\u9898\u4e0e\u5b57\u4f53",
      themeLabel: "\u4e3b\u9898",
      themeSky: "\u5929\u7a7a\u4e4b\u84dd",
      themeLavender: "\u85b0\u8863\u8349\u7d2b",
      themeCream: "\u5976\u6cb9\u6e29\u6696",
      themeMint: "\u8584\u8377\u6e05\u65b0",
      themePeach: "\u6c34\u871c\u6843\u7c89",
      themeDark: "\u6e29\u6696\u6df1\u8272",
      themeForest: "\u6df1\u7eff\u68ee\u6797",
      fontSizeLabel: "\u5b57\u4f53\u5927\u5c0f",
      modelLabel: "\u6a21\u578b\u8bbe\u7f6e",
      modelTitle: "Provider \u51ed\u636e\u4e0e\u63a5\u53e3\u5730\u5740",
      addModel: "\u6dfb\u52a0\u81ea\u5b9a\u4e49\u6a21\u578b"
    },
    auth: {
      titleLabel: "\u8d26\u6237",
      title: "\u672c\u5730\u6ce8\u518c",
      copy:
        "\u524d\u7aef\u6a21\u5f0f\u4f1a\u5728\u672c\u5730\u4fdd\u5b58\u8d26\u6237\u4fe1\u606f\uff1b\u540e\u7aef\u6a21\u5f0f\u53ef\u4ee5\u66ff\u6362\u6210\u771f\u5b9e\u767b\u5f55\u6ce8\u518c\u3002",
      email: "\u90ae\u7bb1",
      workspaceName: "\u5de5\u4f5c\u533a\u540d\u79f0",
      save: "\u4fdd\u5b58\u672c\u5730\u8d26\u6237",
      status: "\u72b6\u6001",
      current: "\u5f53\u524d\u8d26\u6237"
    },
    history: {
      titleLabel: "\u5386\u53f2",
      title: "\u5df2\u4fdd\u5b58\u7684\u8fd0\u884c\u8bb0\u5f55",
      copy:
        "\u524d\u7aef\u6a21\u5f0f\u4f1a\u628a\u5386\u53f2\u4fdd\u5b58\u5728 localStorage\uff0c\u540e\u7aef\u6a21\u5f0f\u5e94\u6539\u6210\u670d\u52a1\u7aef\u6301\u4e45\u5316\u3002",
      panelLabel: "\u4f1a\u8bdd\u5386\u53f2",
      panelTitle: "\u4e4b\u524d\u7684\u591a\u6a21\u578b\u534f\u4f5c\u8bb0\u5f55",
      clear: "\u6e05\u7a7a\u5386\u53f2"
    },
    friends: {
      titleLabel: "\u7fa4\u53cb",
      title: "AI \u7fa4\u53cb\u7ba1\u7406",
      copy:
        "\u7fa4\u53cb\u662f\u9762\u5411\u5bf9\u8bdd\u7684\u89d2\u8272\u5c42\uff0c\u6bcf\u4e2a\u7fa4\u53cb\u90fd\u53ef\u4ee5\u7ed1\u5b9a\u5e95\u5c42\u6a21\u578b\u3001\u8bbe\u7f6e\u5934\u50cf\uff0c\u5e76\u62e5\u6709\u72ec\u7acb\u7684 system prompt\u3002",
      panelLabel: "\u7fa4\u53cb\u5217\u8868",
      panelTitle: "\u53ef\u4ee5\u88ab\u62c9\u5165\u7fa4\u804a\u7684 AI \u89d2\u8272",
      addFriend: "\u6dfb\u52a0\u7fa4\u53cb"
    },
    common: {
      noAccount: "\u8fd8\u6ca1\u6709\u4fdd\u5b58\u672c\u5730\u8d26\u6237\u3002",
      accountSaved: "\u5df2\u4fdd\u5b58\u672c\u5730\u8d26\u6237\uff1a{name} ({email})",
      accountRequired: "\u90ae\u7bb1\u548c\u5de5\u4f5c\u533a\u540d\u79f0\u90fd\u662f\u5fc5\u586b\u9879\u3002",
      noHistoryTitle: "\u8fd8\u6ca1\u6709\u5386\u53f2\u8bb0\u5f55",
      noHistoryCopy:
        "\u8fd0\u884c\u4e00\u6b21\u5de5\u4f5c\u6d41\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u672c\u5730\u4fdd\u5b58\u7684\u5386\u53f2\u3002",
      running: "\u6b63\u5728\u8fd0\u884c {count} \u4f4d\u7fa4\u53cb",
      completed: "\u5df2\u5b8c\u6210 {count} \u4f4d\u7fa4\u53cb",
      needPrompt: "需要输入 prompt。",
      needExistingFriends: "\u5f53\u524d\u8fd8\u6ca1\u6709 AI \u7fa4\u53cb\uff0c\u8bf7\u5148\u5728\u7fa4\u53cb\u9875\u521b\u5efa\u7fa4\u53cb\u3002",
      needUsableFriends: "\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u7684 AI \u7fa4\u53cb\uff0c\u8bf7\u5148\u7ed9\u7fa4\u53cb\u7ed1\u5b9a\u6709\u6548\u6a21\u578b\u5e76\u542f\u7528\u3002",
      synthesis: "\u6574\u5408",
      mock: "\u6a21\u62df\u7ed3\u679c",
      configured: "\u5df2\u914d\u7f6e",
      fallback: "\u56de\u9000\u7ed3\u679c",
      runtimeFrontend:
        "\u524d\u7aef\u6a21\u5f0f\u4f1a\u628a\u914d\u7f6e\u548c\u5386\u53f2\u4fdd\u5b58\u5728\u672c\u5730\uff1b\u6d4f\u89c8\u5668\u8de8\u57df\u5141\u8bb8\u65f6\u53ef\u4ee5\u76f4\u63a5\u8bf7\u6c42\u6a21\u578b\u63a5\u53e3\u3002",
      runtimeBackend:
        "\u540e\u7aef\u6a21\u5f0f\u4fdd\u6301\u76f8\u540c UI\uff0c\u4f46\u9700\u8981\u670d\u52a1\u7aef\u63a5\u53e3\uff0c\u4f8b\u5982 /api/chat/run \u6216 /api/chat/run/stream\u3002",
      runtimeFrontendShort: "\u524d\u7aef\u76f4\u8fde",
      runtimeBackendShort: "\u540e\u7aef\u6258\u7ba1",
      friendsSelected: "{count} \u4f4d\u7fa4\u53cb\u5df2\u52a0\u5165",
      mergedAnswer:
        "\u6574\u5408\u7b54\u6848\uff1a\u4fdd\u7559\u6700\u597d\u7684\u7ed3\u6784\uff0c\u5438\u6536\u5404\u6a21\u578b\u7684\u7ec6\u8282\u548c\u98ce\u9669\u63d0\u9192\uff0c\u8f93\u51fa\u4e00\u4efd\u53ef\u76f4\u63a5\u4ea4\u4ed8\u7684\u6700\u7ec8\u7b54\u590d\u3002",
      d1:
        "\u6709\u7684\u6a21\u578b\u66f4\u64c5\u957f\u642d\u7ed3\u6784\uff0c\u6709\u7684\u6a21\u578b\u66f4\u64c5\u957f\u8865\u5145\u7ec6\u8282\u548c\u8fb9\u754c\u6761\u4ef6\u3002",
      d2:
        "\u504f\u9a8c\u8bc1\u7684\u6a21\u578b\u901a\u5e38\u66f4\u4fdd\u5b88\uff0c\u4f46\u66f4\u5bb9\u6613\u63d0\u524d\u53d1\u73b0\u98ce\u9669\u3002",
      d3:
        "\u81ea\u5b9a\u4e49\u63a5\u53e3\u5728\u98ce\u683c\u3001\u5ef6\u8fdf\u4e0e\u8fd4\u56de\u8d28\u91cf\u4e0a\u53ef\u80fd\u5dee\u5f02\u5f88\u5927\u3002",
      enabled: "\u5df2\u542f\u7528",
      disabled: "\u5df2\u505c\u7528",
      saveConfig: "\u4fdd\u5b58\u914d\u7f6e",
      testConfig: "\u6d4b\u8bd5\u8fde\u63a5",
      copy: "\u590d\u5236",
      testAllModels: "\u6d4b\u8bd5\u5168\u90e8\u5df2\u542f\u7528\u6a21\u578b",
      testing: "\u6d4b\u8bd5\u4e2d...",
      testSuccess: "\u8fde\u63a5\u6210\u529f",
      testMissingConfig: "\u7f3a\u5c11 Base URL \u6216 API key",
      disable: "\u505c\u7528",
      enable: "\u542f\u7528",
      statusEnabled: "\u5df2\u542f\u7528",
      statusDisabled: "\u5df2\u505c\u7528",
      delete: "\u5220\u9664",
      confirmDelete: "\u786e\u5b9a\u8981\u5220\u9664\u8fd9\u4e2a\u6a21\u578b\u5417\uff1f",
      confirmTitle: "\u786e\u8ba4\u5220\u9664",
      confirm: "\u786e\u8ba4",
      cancel: "\u53d6\u6d88",
      customModel: "\u81ea\u5b9a\u4e49\u6a21\u578b",
      roleModel: "AI \u52a9\u624b",
      roleFriend: "AI \u7fa4\u53cb",
      roleSynthesis: "\u6574\u5408\u7ed3\u679c",
      roleMember: "\u7fa4\u6210\u5458",
      thinking: "\u601d\u8003\u8fc7\u7a0b",
      showThinking: "\u67e5\u770b",
      hideThinking: "\u9690\u85cf",
      generating: "\u751f\u6210\u4e2d",
      reasoningUnavailable: "\u8be5\u6a21\u578b\u672a\u516c\u5f00\u4e2d\u95f4\u601d\u8def",
      untitledConversation: "\u672a\u547d\u540d\u5bf9\u8bdd",
      waitingMessage: "\u7b49\u5f85\u7b2c\u4e00\u6761\u6d88\u606f",
      modelUnit: "\u4e2a\u6a21\u578b",
      friendUnit: "\u4f4d\u7fa4\u53cb",
      bucketToday: "\u4eca\u5929",
      bucketYesterday: "\u6628\u5929",
      bucketLast7Days: "7 \u5929\u5185",
      bucketLast30Days: "30 \u5929\u5185",
      bucketOlder: "\u66f4\u65e9",
      bucketPinned: "\u7f6e\u9876",
      renameTitle: "\u4fee\u6539\u6807\u9898",
      saveTitle: "\u4fdd\u5b58\u6807\u9898",
      renameAction: "\u6539\u540d",
      saveAction: "\u4fdd\u5b58",
      pinAction: "\u7f6e\u9876",
      unpinAction: "\u53d6\u6d88\u7f6e\u9876",
      exportAction: "\u5bfc\u51fa",
      exportHtml: "\u5bfc\u51fa\u4e3a\u7f51\u9875",
      exportImage: "\u5bfc\u51fa\u4e3a\u56fe\u7247",
      exportPdf: "\u5bfc\u51fa\u4e3a PDF",
      exportSuccess: "\u5bfc\u51fa\u6210\u529f",
      exportFailed: "\u5bfc\u51fa\u5931\u8d25",
      deleteAction: "\u5220\u9664",
      addAction: "\u65b0\u589e",
      deletedConversation: "\u5df2\u5220\u9664\u4f1a\u8bdd",
      groupSettingsSaved: "\u5df2\u4fdd\u5b58\u4e3a\u9ed8\u8ba4\u7fa4\u8bbe\u7f6e",
      conversationGroupApplied: "\u5df2\u5e94\u7528\u5230\u5f53\u524d\u4f1a\u8bdd",
      synthesisFriendCurrent: "\u6574\u5408\u7fa4\u53cb\uff1a{name}",
      viewMemberDetails: "\u67e5\u770b\u8be6\u60c5",
      hideMemberDetails: "\u6536\u8d77\u8be6\u60c5",
      backendLoadFailed: "\u65e0\u6cd5\u8fde\u63a5\u540e\u7aef\uff0c\u5df2\u5207\u56de\u524d\u7aef\u6a21\u5f0f\u3002",
      backendSyncFailed: "\u540e\u7aef\u540c\u6b65\u5931\u8d25\uff0c\u5f53\u524d\u6539\u52a8\u4ec5\u4fdd\u5b58\u5728\u672c\u5730\u3002",
      frontendPasswordTitle: "\u524d\u7aef\u8bbf\u95ee\u9a8c\u8bc1",
      frontendPasswordCopy:
        "\u8bf7\u8f93\u5165\u8bbf\u95ee\u5bc6\u7801\u3002\u524d\u7aef\u6a21\u5f0f\u4e0b\uff0c\u9875\u9762\u9700\u8981\u5148\u901a\u8fc7\u5168\u5c40\u5bc6\u7801\u6821\u9a8c\u540e\u624d\u80fd\u7ee7\u7eed\u4f7f\u7528\u3002",
      frontendPasswordEyebrow: "\u5b89\u5168\u5165\u53e3",
      frontendPasswordLabel: "\u8bbf\u95ee\u5bc6\u7801",
      frontendPasswordPlaceholder: "\u8f93\u5165\u5bc6\u7801",
      frontendPasswordAction: "\u9a8c\u8bc1\u5e76\u8fdb\u5165",
      frontendPasswordInvalid: "\u5bc6\u7801\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5\u3002",
      frontendPasswordMissing: "\u672a\u914d\u7f6e\u524d\u7aef\u8bbf\u95ee\u5bc6\u7801\uff0c\u8bf7\u68c0\u67e5\u73af\u5883\u53d8\u91cf\u6216 frontend-auth.json\u3002",
      fieldDisplayName: "\u663e\u793a\u540d\u79f0",
      fieldThinking: "\u5f00\u542f Think",
      fieldProvider: "Provider",
      fieldAvatar: "\u6a21\u578b\u5934\u50cf",
      uploadAvatar: "\u4e0a\u4f20\u5934\u50cf",
      fieldModelId: "Model ID",
      fieldBaseUrl: "Base URL",
      fieldApiKey: "API key",
      fieldBoundModel: "\u7ed1\u5b9a\u6a21\u578b",
      fieldSystemPrompt: "System Prompt",
      fieldDescription: "\u63cf\u8ff0",
      saveFriend: "\u4fdd\u5b58\u7fa4\u53cb",
      deleteFriend: "\u5220\u9664\u7fa4\u53cb",
      noFriendsTitle: "\u8fd8\u6ca1\u6709\u7fa4\u53cb",
      noFriendsCopy: "\u8bf7\u5148\u53bb\u7fa4\u53cb\u9875\u521b\u5efa AI \u7fa4\u53cb\uff0c\u518d\u62c9\u4ed6\u4eec\u8fdb\u5165\u7fa4\u804a\u3002",
      navWorkspace: "\u5de5\u4f5c\u53f0",
      navSettings: "\u8bbe\u7f6e",
      navFriends: "\u7fa4\u53cb",
      navAccount: "\u8d26\u6237",
      navHistory: "\u5386\u53f2",
      collapseSidebar: "\u6536\u8d77",
      expandSidebar: "\u5c55\u5f00",
      guest: "\u672a\u767b\u5f55",
      close: "\u5173\u95ed",
      isIntegrationExpert: "\u8bbe\u4e3a\u6574\u5408\u4e13\u5bb6",
      integrationExpert: "\u6574\u5408\u4e13\u5bb6",
      integrationExpertBadge: "\u4e13\u5bb6",
      expertOnlyMode: "\u4ec5\u4e0e\u4e13\u5bb6\u5bf9\u8bdd",
      expertOnlyModeHint: "\u5f00\u542f\u540e\uff0c\u53ea\u6709\u6574\u5408\u4e13\u5bb6\u4f1a\u56de\u590d\uff0c\u5176\u4ed6\u7fa4\u53cb\u4e0d\u53c2\u4e0e",
      expertOnlyNeedMessage: "\u8bf7\u5148\u53d1\u9001\u6d88\u606f",
      expertOnlyNeedAllDone: "\u8bf7\u7b49\u5f85\u6240\u6709\u7fa4\u53cb\u56de\u590d\u5b8c\u6210",
      expertOnlyNeedExpert: "\u8bf7\u5148\u5f00\u542fAI\u6574\u5408\u4e13\u5bb6",
      noIntegrationExperts: "\u672a\u8bbe\u7f6e\u6574\u5408\u4e13\u5bb6",
      copySuffix: " \u526f\u672c",
      promptTemplatePlaceholder: "\u9009\u62e9\u6a21\u677f...",
      promptTemplateSave: "\u4fdd\u5b58\u4e3a\u6a21\u677f",
      promptTemplateDelete: "\u5220\u9664\u6a21\u677f",
      promptTemplateNamePlaceholder: "\u8bf7\u8f93\u5165\u6a21\u677f\u540d\u79f0"
    }
  },
  en: {
    titles: {
      workspace: "OpenChat - Workspace",
      settings: "OpenChat - Settings",
      friends: "OpenChat - Friends",
      account: "OpenChat - Account",
      history: "OpenChat - History"
    },
    home: {
      sideLabel: "Conversations",
      newChat: "New chat",
      introTitle: "OpenChat",
      heroKicker: "Let multiple AIs collaborate in the same chat",
      heroCopy:
        "Register AI friends first, pull them into a group chat, and let a selected friend synthesize the final answer.",
      promptPlaceholder: "Ask anything...",
      enterHint: "Press Enter to send, Shift+Enter for a new line",
      friendsInChat: "Friends in this chat",
      groupSettings: "Group settings",
      groupSettingsTitle: "Members, synthesis friend, and a shared system prompt",
      memberSelection: "Members",
      synthesisToggle: "Enable synthesis",
      synthesisHint: "When enabled, a designated synthesis friend will merge and summarize responses from other friends.",
      synthesisFriend: "Synthesis friend",
      sharedPromptToggle: "Use one shared system prompt",
      sharedPromptHint:
        "When enabled for the current conversation, the shared system prompt fully overrides each member's personal prompt.",
      sharedPromptPlaceholder: "Write the shared system prompt for this conversation...",
      platformFeatureToggle: "Enable platform search",
      platformFeatureHint:
        "Bring AI Search Hub platforms into this group. When enabled, the conversation gets a preferred data ecosystem for search-heavy tasks.",
      platformFeatureLabel: "Search platform",
      platformFeatureCardLabel: "Platform capability",
      applyCurrentConversation: "Apply to current conversation",
      saveDefaultGroup: "Save as default group",
      run: "Send",
      ready: "Ready",
      finalSynthesis: "Final synthesis",
      rebuild: "Rebuild",
      suggestion1: "Does cold water burn more calories?",
      suggestion2: "Is remote work better than office work?",
      suggestion3: "Best way to learn a new language?"
    },
    settings: {
      titleLabel: "Settings",
      title: "Model configuration",
      copy: "Configure provider, model id, base URL, and API key for each model.",
      runtimeLabel: "Runtime",
      runtimeTitle: "Execution mode",
      frontendMode: "Frontend mode",
      backendMode: "Backend mode",
      routingLabel: "Routing",
      routingTitle: "Enabled models",
      appearanceLabel: "Appearance",
      appearanceTitle: "Theme & Font size",
      themeLabel: "Theme",
      themeSky: "Sky Blue",
      themeLavender: "Soft Lavender",
      themeCream: "Warm Cream",
      themeMint: "Fresh Mint",
      themePeach: "Soft Peach",
      themeDark: "Warm Dark",
      themeForest: "Deep Forest",
      fontSizeLabel: "Font size",
      modelLabel: "Models",
      modelTitle: "Provider credentials and endpoints",
      addModel: "Add custom model"
    },
    auth: {
      titleLabel: "Account",
      title: "Local registration",
      copy:
        "Frontend mode stores account data locally. Backend mode can replace this with real authentication.",
      email: "Email",
      workspaceName: "Workspace name",
      save: "Save local account",
      status: "Status",
      current: "Current account"
    },
    history: {
      titleLabel: "History",
      title: "Stored runs",
      copy:
        "Frontend mode keeps history in localStorage. Backend mode should replace this with server persistence.",
      panelLabel: "Session history",
      panelTitle: "Previous multi-model collaboration runs",
      clear: "Clear history"
    },
    friends: {
      titleLabel: "Friends",
      title: "AI friend directory",
      copy:
        "Friends are the conversation-facing personas. Each friend binds to a model config, keeps its own avatar, and carries its own system prompt.",
      panelLabel: "Friend list",
      panelTitle: "AI personas that can join a group chat",
      addFriend: "Add friend"
    },
    common: {
      noAccount: "No local account saved.",
      accountSaved: "Saved local account: {name} ({email})",
      accountRequired: "Email and workspace name are required.",
      noHistoryTitle: "No stored runs",
      noHistoryCopy: "Run the workflow to save local history.",
      running: "Running {count} friends",
      completed: "Completed {count} friends",
      needPrompt: "Need a prompt.",
      needExistingFriends: "No AI friends exist yet. Create friends on the Friends page first.",
      needUsableFriends: "No usable AI friends are available yet. Bind an enabled friend to a valid model first.",
      synthesis: "synthesis",
      mock: "mock",
      configured: "configured",
      fallback: "fallback",
      runtimeFrontend:
        "Frontend mode stores config and history locally and can call providers directly when CORS allows it.",
      runtimeBackend:
        "Backend mode keeps the same UI but expects a server endpoint such as /api/chat/run or /api/chat/run/stream.",
      runtimeFrontendShort: "Frontend direct",
      runtimeBackendShort: "Backend hosted",
      friendsSelected: "{count} friends joined",
      mergedAnswer:
        "Merged answer: keep the strongest structure, absorb nuance and risk checks, and present one final answer.",
      d1: "Some models are better at structure while others contribute stronger nuance and caveats.",
      d2: "Verification-oriented models are more conservative, but they catch risk earlier.",
      d3: "Custom endpoints can vary widely in style, latency, and output quality.",
      enabled: "Enabled",
      disabled: "Disabled",
      saveConfig: "Save config",
      testConfig: "Test connection",
      copy: "Copy",
      testAllModels: "Test all enabled models",
      testing: "Testing...",
      testSuccess: "Connection successful",
      testMissingConfig: "Missing Base URL or API key",
      disable: "Disable",
      enable: "Enable",
      statusEnabled: "Enabled",
      statusDisabled: "Disabled",
      delete: "Delete",
      confirmDelete: "Are you sure you want to delete this model?",
      confirmTitle: "Confirm Delete",
      confirm: "Confirm",
      cancel: "Cancel",
      customModel: "Custom model",
      roleModel: "AI assistant",
      roleFriend: "AI friend",
      roleSynthesis: "Synthesis",
      roleMember: "Member",
      thinking: "Thinking",
      showThinking: "View",
      hideThinking: "Hide",
      generating: "Generating",
      reasoningUnavailable: "No public reasoning trace",
      untitledConversation: "Untitled conversation",
      waitingMessage: "Waiting for the first message",
      modelUnit: "models",
      friendUnit: "friends",
      bucketToday: "Today",
      bucketYesterday: "Yesterday",
      bucketLast7Days: "Last 7 days",
      bucketLast30Days: "Last 30 days",
      bucketOlder: "Older",
      bucketPinned: "Pinned",
      renameTitle: "Rename title",
      saveTitle: "Save title",
      renameAction: "Rename",
      saveAction: "Save",
      pinAction: "Pin",
      unpinAction: "Unpin",
      exportAction: "Export",
      exportHtml: "Export as HTML",
      exportImage: "Export as Image",
      exportPdf: "Export as PDF",
      exportSuccess: "Export successful",
      exportFailed: "Export failed",
      deleteAction: "Delete",
      addAction: "Add",
      deletedConversation: "Conversation deleted",
      groupSettingsSaved: "Saved as default group settings",
      conversationGroupApplied: "Applied to the current conversation",
      synthesisFriendCurrent: "Synthesis friend: {name}",
      viewMemberDetails: "View details",
      hideMemberDetails: "Hide details",
      backendLoadFailed: "Could not reach the backend. Switched back to frontend mode.",
      backendSyncFailed: "Backend sync failed. Changes are only saved locally.",
      frontendPasswordTitle: "Frontend access check",
      frontendPasswordCopy:
        "Enter the shared access password. In frontend mode, the app requires a global password check before use.",
      frontendPasswordEyebrow: "Secure access",
      frontendPasswordLabel: "Access password",
      frontendPasswordPlaceholder: "Enter password",
      frontendPasswordAction: "Unlock",
      frontendPasswordInvalid: "Incorrect password. Try again.",
      frontendPasswordMissing: "No frontend password hash is configured. Check the environment variable or frontend-auth.json.",
      fieldDisplayName: "Display name",
      fieldThinking: "Enable thinking",
      fieldProvider: "Provider",
      fieldAvatar: "Avatar",
      uploadAvatar: "Upload avatar",
      fieldModelId: "Model ID",
      fieldBaseUrl: "Base URL",
      fieldApiKey: "API key",
      fieldBoundModel: "Bound model",
      fieldSystemPrompt: "System prompt",
      fieldDescription: "Description",
      saveFriend: "Save friend",
      deleteFriend: "Delete friend",
      noFriendsTitle: "No friends yet",
      noFriendsCopy: "Create AI friends on the Friends page first, then bring them into the group chat.",
      navWorkspace: "Workspace",
      navSettings: "Settings",
      navFriends: "Friends",
      navAccount: "Account",
      navHistory: "History",
      collapseSidebar: "Collapse",
      expandSidebar: "Expand",
      guest: "Guest",
      close: "Close",
      isIntegrationExpert: "Set as Integration Expert",
      integrationExpert: "Integration Expert",
      integrationExpertBadge: "Expert",
      expertOnlyMode: "Chat with Expert Only",
      expertOnlyModeHint: "When enabled, only integration experts will respond. Other friends won't participate.",
      expertOnlyNeedMessage: "Please send a message first",
      expertOnlyNeedAllDone: "Please wait for all friends to finish responding",
      expertOnlyNeedExpert: "Please enable an AI integration expert first",
      noIntegrationExperts: "No integration experts set",
      copySuffix: " Copy",
      promptTemplatePlaceholder: "Select template...",
      promptTemplateSave: "Save as template",
      promptTemplateDelete: "Delete template",
      promptTemplateNamePlaceholder: "Enter template name"
    }
  }
};

// Confirm dialog state
let confirmDialogResolve = null;

// Prompt dialog state
let promptDialogResolve = null;

function initConfirmDialog() {
  const dialog = document.getElementById("confirm-dialog");
  const cancelBtn = document.getElementById("confirm-dialog-cancel");
  const confirmBtn = document.getElementById("confirm-dialog-confirm");

  if (!dialog || !cancelBtn || !confirmBtn) return;

  cancelBtn.addEventListener("click", () => {
    if (confirmDialogResolve) {
      confirmDialogResolve(false);
      confirmDialogResolve = null;
    }
    dialog.hidden = true;
  });

  confirmBtn.addEventListener("click", () => {
    if (confirmDialogResolve) {
      confirmDialogResolve(true);
      confirmDialogResolve = null;
    }
    dialog.hidden = true;
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.classList.contains("confirm-modal-backdrop")) {
      if (confirmDialogResolve) {
        confirmDialogResolve(false);
        confirmDialogResolve = null;
      }
      dialog.hidden = true;
    }
  });
}

function initPromptDialog() {
  const dialog = document.getElementById("prompt-dialog");
  const input = document.getElementById("prompt-dialog-input");
  const cancelBtn = document.getElementById("prompt-dialog-cancel");
  const confirmBtn = document.getElementById("prompt-dialog-confirm");

  if (!dialog || !input || !cancelBtn || !confirmBtn) return;

  const dismiss = () => {
    if (promptDialogResolve) {
      promptDialogResolve(null);
      promptDialogResolve = null;
    }
    dialog.hidden = true;
  };

  const accept = () => {
    if (promptDialogResolve) {
      promptDialogResolve(input.value);
      promptDialogResolve = null;
    }
    dialog.hidden = true;
  };

  cancelBtn.addEventListener("click", dismiss);
  confirmBtn.addEventListener("click", accept);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      accept();
    }
  });

  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target.classList.contains("confirm-modal-backdrop")) {
      dismiss();
    }
  });
}

function showPrompt(title, defaultValue = "") {
  return new Promise((resolve) => {
    const dialog = document.getElementById("prompt-dialog");
    const titleEl = document.getElementById("prompt-dialog-title");
    const input = document.getElementById("prompt-dialog-input");
    const confirmBtn = document.getElementById("prompt-dialog-confirm");
    const cancelBtn = document.getElementById("prompt-dialog-cancel");

    if (!dialog) {
      resolve(window.prompt(title));
      return;
    }

    promptDialogResolve = resolve;

    if (titleEl) titleEl.textContent = title || "";
    if (input) {
      input.value = defaultValue;
      input.placeholder = title || "";
    }
    if (confirmBtn) confirmBtn.textContent = t("common.confirm") || "OK";
    if (cancelBtn) cancelBtn.textContent = t("common.cancel") || "Cancel";

    dialog.hidden = false;
    if (input) setTimeout(() => input.focus(), 50);
  });
}

function showConfirm(message, title) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("confirm-dialog");
    const titleEl = document.getElementById("confirm-dialog-title");
    const messageEl = document.getElementById("confirm-dialog-message");
    const confirmBtn = document.getElementById("confirm-dialog-confirm");
    const cancelBtn = document.getElementById("confirm-dialog-cancel");

    if (!dialog) {
      resolve(window.confirm(message));
      return;
    }

    confirmDialogResolve = resolve;

    if (titleEl) titleEl.textContent = title || t("common.confirmTitle") || "Confirm";
    if (messageEl) messageEl.textContent = message;
    if (confirmBtn) confirmBtn.textContent = t("common.confirm") || "Confirm";
    if (cancelBtn) cancelBtn.textContent = t("common.cancel") || "Cancel";

    dialog.hidden = false;
  });
}

const promptInput = document.getElementById("prompt-input");
const synthModelSelect = document.getElementById("synth-model");
const runStatus = document.getElementById("run-status");
const selectedCount = document.getElementById("selected-count");
const selectedModels = document.getElementById("selected-models");
const chatMembersLabel = document.getElementById("chat-members-label");
const runWorkflowButton = document.getElementById("run-workflow");
const rerollSynthesisButton = document.getElementById("reroll-synthesis");
const conversationList = document.getElementById("conversation-list");
const messageStream = document.getElementById("message-stream");
const newChatButton = document.getElementById("new-chat");
const runtimeModeToggle = document.getElementById("runtime-mode-toggle");
const runtimeDescription = document.getElementById("runtime-description");
const modelToggleGrid = document.getElementById("model-toggle-grid");
const modelCount = document.getElementById("model-count");
const configGrid = document.getElementById("config-grid");
const addCustomModelButton = document.getElementById("add-custom-model");
const testEnabledModelsButton = document.getElementById("test-enabled-models");
const friendGrid = document.getElementById("friend-grid");
const addFriendButton = document.getElementById("add-friend");
const accountEmail = document.getElementById("account-email");
const accountName = document.getElementById("account-name");
const saveAccountButton = document.getElementById("save-account");
const accountSummary = document.getElementById("account-summary");
const historyList = document.getElementById("history-list");
const clearHistoryButton = document.getElementById("clear-history");
const userBarTrigger = document.getElementById("user-bar-trigger");
const userBarMenu = document.getElementById("user-bar-menu");
const userBarAvatar = document.getElementById("user-bar-avatar");
const userBarNameEl = document.getElementById("user-bar-name");
const userBarMore = document.getElementById("user-bar-more");
const loginModal = document.getElementById("login-modal");
const loginModalBackdrop = document.getElementById("login-modal-backdrop");
const modalAccountEmail = document.getElementById("modal-account-email");
const modalAccountName = document.getElementById("modal-account-name");
const modalSaveAccount = document.getElementById("modal-save-account");
const modalAccountError = document.getElementById("modal-account-error");
const frontendPasswordModal = document.getElementById("frontend-password-modal");
const frontendPasswordBackdrop = document.getElementById("frontend-password-backdrop");
const frontendPasswordInput = document.getElementById("frontend-password-input");
const frontendPasswordSubmit = document.getElementById("frontend-password-submit");
const frontendPasswordError = document.getElementById("frontend-password-error");
const groupSettingsToggleButton = document.getElementById("group-settings-toggle");
const groupSettingsCloseButton = document.getElementById("group-settings-close");
const groupSettingsPanel = document.getElementById("group-settings-panel");
const groupMemberPicker = document.getElementById("group-member-picker");
const groupSynthesisToggle = document.getElementById("group-synthesis-toggle");
const groupSynthesisSelect = document.getElementById("group-synthesis-select");
const groupSharedToggle = document.getElementById("group-shared-toggle");
const groupSharedPrompt = document.getElementById("group-shared-prompt");
const groupPlatformToggle = document.getElementById("group-platform-toggle");
const groupPlatformSelect = document.getElementById("group-platform-select");
const platformFeatureName = document.getElementById("platform-feature-name");
const platformFeatureCopy = document.getElementById("platform-feature-copy");
const platformFeatureMeta = document.getElementById("platform-feature-meta");
const applyGroupSettingsButton = document.getElementById("apply-group-settings");
const saveDefaultGroupSettingsButton = document.getElementById("save-default-group-settings");
const expertOnlyToggle = document.getElementById("expert-only-toggle");
const expertOnlyToggleLabel = document.getElementById("expert-only-toggle-label");

let runtimeMode = localStorage.getItem(STORAGE_KEYS.runtime) || "frontend";
let currentLanguage = localStorage.getItem(STORAGE_KEYS.language) || "zh-CN";

// Theme initialization
function initTheme() {
  let savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "sky";
  if (savedTheme === "light") savedTheme = "sky";
  applyTheme(savedTheme);
  // Font size: default 14px, accept both old string values and new numeric values
  const savedFontSize = localStorage.getItem(STORAGE_KEYS.fontSize);
  const fontSizeNum = parseInt(savedFontSize, 10);
  if (!isNaN(fontSizeNum) && fontSizeNum >= 10 && fontSizeNum <= 24) {
    applyFontSize(fontSizeNum);
  } else {
    // Migrate old values or use default
    const legacyMap = { small: 12, medium: 14, large: 16 };
    applyFontSize(legacyMap[savedFontSize] || 14);
  }
}

function applyTheme(themeName) {
  document.documentElement.setAttribute("data-theme", themeName);
  localStorage.setItem(STORAGE_KEYS.theme, themeName);

  // Update indicator in sidebar if exists
  const themeIndicator = document.querySelector(".theme-indicator");
  if (themeIndicator) {
    themeIndicator.className = "theme-indicator " + themeName;
  }

  // Update settings page theme options
  document.querySelectorAll(".theme-setting-option").forEach((opt) => {
    opt.classList.toggle("active", opt.dataset.theme === themeName);
  });
}

function applyFontSize(size) {
  // size is a number (px value)
  const sizeNum = parseInt(size, 10);
  if (isNaN(sizeNum) || sizeNum < 10 || sizeNum > 24) return;

  localStorage.setItem(STORAGE_KEYS.fontSize, sizeNum);
  document.documentElement.style.fontSize = sizeNum + "px";

  // Update slider and input if they exist
  const slider = document.getElementById("font-size-slider");
  const input = document.getElementById("font-size-input");
  if (slider) slider.value = sizeNum;
  if (input) input.value = sizeNum;
}

let frontendPasswordHash = "";
let frontendAccessBlocked = false;
let modelTestState = {};
writeJson(STORAGE_KEYS.account, getScopedAccount());
let modelConfigs = normalizeModelConfigs(readScopedJson(STORAGE_KEYS.models, cloneDefaultModels()));
let friendProfiles = normalizeFriendProfiles(
  readScopedJson(STORAGE_KEYS.friends, createDefaultFriendProfiles(modelConfigs)),
  modelConfigs
);
let defaultGroupSettings = normalizeGroupSettings(
  readScopedJson(STORAGE_KEYS.groupSettings, createDefaultGroupSettings(friendProfiles)),
  friendProfiles
);
let currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
let draftGroupSettings = cloneGroupSettings(currentConversationGroupSettings);
let promptTemplates = mergeBuiltInTemplates(readScopedJson(STORAGE_KEYS.promptTemplates, []));
let currentConversation = [];
let activeConversationId = null;
let renderedMessageElements = new Map(); // Track rendered message elements for incremental updates
let activeHistoryIndex = null;
let editingHistoryIndex = null;
let expandedHistoryIndex = null;
let pendingConfigFocusId = null;
let pendingFriendFocusId = null;
let isGroupSettingsOpen = false;
let isGroupMemberDetailsOpen = false;
let isRunning = false;
let messageIdSeed = 0;

function cloneDefaultModels() {
  return DEFAULT_MODELS.map((item) => ({ ...item }));
}

function getDefaultFriendSystemPrompt(name = "") {
  return currentLanguage === "zh-CN"
    ? `\u4f60\u662f AI \u7fa4\u53cb\u300c${name || "\u7fa4\u53cb"}\u300d\uff0c\u8bf7\u5728\u7fa4\u804a\u91cc\u7528\u6e05\u6670\u3001\u5177\u4f53\u3001\u53ef\u843d\u5730\u7684\u65b9\u5f0f\u56de\u7b54\uff0c\u5e76\u4fdd\u7559\u81ea\u5df1\u7684\u89c6\u89d2\u3002`
    : `You are the AI group friend "${name || "Friend"}". Reply in the group chat with a clear, specific, action-oriented point of view.`;
}

function createDefaultFriendProfiles(models = cloneDefaultModels()) {
  return models.map((model) => ({
    id: `friend-${model.id}`,
    name: model.name,
    avatar: model.avatar || "",
    modelConfigId: model.id,
    systemPrompt: getDefaultFriendSystemPrompt(model.name),
    enabled: true,
    description: model.description || ""
  }));
}

function createDefaultGroupSettings(friends = []) {
  const memberIds = friends.filter((item) => item.enabled !== false).map((item) => item.id);
  const integrationExpertIds = friends.filter((item) => item.enabled !== false && item.isIntegrationExpert).map((item) => item.id);
  return {
    memberIds,
    sharedSystemPromptEnabled: false,
    sharedSystemPrompt: "",
    platformFeatureEnabled: false,
    preferredPlatform: "gemini",
    synthesisEnabled: false,
    synthesisFriendId: memberIds[0] || null,
    integrationExpertIds,
    expertOnlyMode: false
  };
}

function cloneGroupSettings(settings = {}) {
  return {
    memberIds: Array.isArray(settings.memberIds) ? [...settings.memberIds] : [],
    sharedSystemPromptEnabled: Boolean(settings.sharedSystemPromptEnabled),
    sharedSystemPrompt: String(settings.sharedSystemPrompt || ""),
    platformFeatureEnabled: Boolean(settings.platformFeatureEnabled),
    preferredPlatform: String(settings.preferredPlatform || "gemini"),
    synthesisEnabled: Boolean(settings.synthesisEnabled),
    synthesisFriendId: settings.synthesisFriendId || null,
    integrationExpertIds: Array.isArray(settings.integrationExpertIds) ? [...settings.integrationExpertIds] : [],
    expertOnlyMode: Boolean(settings.expertOnlyMode)
  };
}

function normalizeModelConfig(item = {}) {
  return {
    avatar: "",
    thinkingEnabled: normalizeThinkingEnabled(item.thinkingEnabled, false),
    ...item
  };
}

function normalizeFriendProfile(item = {}, models = modelConfigs) {
  return {
    id: item.id || `friend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: item.name || (currentLanguage === "zh-CN" ? "\u7fa4\u53cb" : "Friend"),
    avatar: item.avatar || "",
    modelConfigId: item.modelConfigId || models[0]?.id || "",
    systemPrompt: String(item.systemPrompt || getDefaultFriendSystemPrompt(item.name || "")),
    enabled: item.enabled !== false,
    description: String(item.description || ""),
    isIntegrationExpert: Boolean(item.isIntegrationExpert)
  };
}

function normalizeFriendProfiles(items = [], models = modelConfigs) {
  return items.map((item) => normalizeFriendProfile(item, models));
}

function normalizeGroupSettings(settings = {}, friends = friendProfiles) {
  const expertIdSet = new Set(
    friends.filter((item) => item.enabled !== false && item.isIntegrationExpert).map((item) => item.id)
  );
  const enabledIds = friends
    .filter((item) => item.enabled !== false && !item.isIntegrationExpert)
    .map((item) => item.id);
  let memberIds = Array.isArray(settings.memberIds)
    ? settings.memberIds.filter((id) => enabledIds.includes(id))
    : [...enabledIds];
  if (!memberIds.length && enabledIds.length) {
    memberIds = [enabledIds[0]];
  }
  const integrationExpertIds = [...expertIdSet].filter((id) =>
    friends.some((f) => f.id === id && f.enabled !== false)
  );
  return {
    memberIds,
    sharedSystemPromptEnabled: Boolean(settings.sharedSystemPromptEnabled),
    sharedSystemPrompt: String(settings.sharedSystemPrompt || ""),
    platformFeatureEnabled: Boolean(settings.platformFeatureEnabled),
    preferredPlatform: PLATFORM_OPTIONS.some((item) => item.id === settings.preferredPlatform)
      ? settings.preferredPlatform
      : "gemini",
    synthesisEnabled: Boolean(settings.synthesisEnabled),
    synthesisFriendId:
      integrationExpertIds.find((id) => id === settings.synthesisFriendId) || integrationExpertIds[0] || null,
    integrationExpertIds,
    expertOnlyMode: Boolean(settings.expertOnlyMode)
  };
}

function normalizeModelConfigs(items = []) {
  return items.map((item) => normalizeModelConfig(item));
}

function shouldApplyLocalModelConfig(currentModels = modelConfigs, incomingModels = []) {
  return Array.isArray(currentModels) && currentModels.length === 0 && Array.isArray(incomingModels) && incomingModels.length > 0;
}

function shouldBootstrapLocalModels(storedModelsRaw = localStorage.getItem(STORAGE_KEYS.models), incomingModels = []) {
  return (storedModelsRaw === null || storedModelsRaw === "") && Array.isArray(incomingModels) && incomingModels.length > 0;
}

function saveModelConfigs() {
  writeScopedJson(STORAGE_KEYS.models, modelConfigs);
}

function getFriendProfiles() {
  return friendProfiles;
}

function saveFriendProfiles() {
  writeScopedJson(STORAGE_KEYS.friends, friendProfiles);
  window.dispatchEvent(new CustomEvent("openchat-storage-sync"));
}

function saveDefaultGroupSettings() {
  writeScopedJson(STORAGE_KEYS.groupSettings, defaultGroupSettings);
  window.dispatchEvent(new CustomEvent("openchat-storage-sync"));
}

function mergeBuiltInTemplates(userTemplates) {
  const userIds = new Set(userTemplates.map((t) => t.id));
  const missing = DEFAULT_PROMPT_TEMPLATES.filter((t) => !userIds.has(t.id));
  return [...userTemplates, ...missing];
}

function savePromptTemplates() {
  writeScopedJson(STORAGE_KEYS.promptTemplates, promptTemplates);
  window.dispatchEvent(new CustomEvent("openchat-storage-sync"));
}

function syncPromptTemplatesToBackend() {
  if (runtimeMode !== "backend") return Promise.resolve();
  return apiRequest("/api/prompt-templates", {
    method: "POST",
    body: JSON.stringify({ promptTemplates })
  }).catch((err) => console.warn("Failed to sync prompt templates:", err.message));
}

function getFriendById(id, items = friendProfiles) {
  return items.find((item) => item.id === id) || null;
}

function getModelConfigById(id, items = modelConfigs) {
  return items.find((item) => item.id === id) || null;
}

function getEnabledFriends(items = friendProfiles) {
  return items.filter((item) => item.enabled !== false);
}

function reconcileGroupStates() {
  friendProfiles = normalizeFriendProfiles(friendProfiles, modelConfigs);
  defaultGroupSettings = normalizeGroupSettings(defaultGroupSettings, friendProfiles);
  currentConversationGroupSettings = normalizeGroupSettings(
    currentConversationGroupSettings,
    friendProfiles
  );
  draftGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);
}

function isCustomModel(item = {}) {
  return String(item.id || "").startsWith("custom-") || item.provider === "Custom";
}

function getOrderedModelConfigs(items = modelConfigs) {
  const custom = [];
  const builtIn = [];
  items.forEach((item) => {
    if (isCustomModel(item)) {
      custom.push(item);
    } else {
      builtIn.push(item);
    }
  });
  return [...custom, ...builtIn];
}

function createCustomModelConfig() {
  const customCount = modelConfigs.filter((item) => isCustomModel(item)).length + 1;
  return {
    id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name:
      currentLanguage === "zh-CN"
        ? `${t("common.customModel")} ${customCount}`
        : `${t("common.customModel")} ${customCount}`,
    provider: "Custom",
    model: "custom-model-id",
    baseUrl: "https://api.example.com/v1",
    apiKey: "",
    avatar: "",
    enabled: true,
    description:
      currentLanguage === "zh-CN"
        ? "\u7528\u6237\u81ea\u5b9a\u4e49\u6a21\u578b\u63a5\u53e3\u4e0e API key\u3002"
        : "User-defined model endpoint and API key."
  };
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getScopedAccount() {
  return normalizeLocalAccount(readJson(STORAGE_KEYS.account, null) || {});
}

function getScopedStorageKey(key) {
  if ([STORAGE_KEYS.runtime, STORAGE_KEYS.language, STORAGE_KEYS.frontendAccess, STORAGE_KEYS.account].includes(key)) {
    return key;
  }
  return buildScopedStorageKey(key, getScopedAccount());
}

function readScopedJson(key, fallback) {
  return readJson(getScopedStorageKey(key), fallback);
}

function writeScopedJson(key, value) {
  writeJson(getScopedStorageKey(key), value);
}

function t(path, vars = {}) {
  const raw = path.split(".").reduce((acc, key) => acc?.[key], I18N[currentLanguage]) || path;
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    raw
  );
}

function escapeHtml(value = "") {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSynthesisContent(content = "") {
  try {
    return `<div class="ai-card-body pretext markdown-content">${renderSafeMarkdown(content || "")}</div>`;
  } catch {
    return `<div class="ai-card-body pretext">${escapeHtml(content || "")}</div>`;
  }
}

function encodeMessageField(value = "") {
  return escapeHtml(String(value ?? ""));
}

function renderAssistantMessageContent({
  content = "",
  isLoading = false,
  kind = "",
  loadingBody = "",
  messageId = "",
  field = "content"
} = {}) {
  if (!content && isLoading) {
    return loadingBody;
  }

  // Use streamdown-target for streaming support, with markdown rendering for synthesis
  if (kind === "synthesis") {
    return `<div class="ai-card-body markdown-content streamdown-target" data-message-id="${encodeMessageField(
      messageId
    )}" data-field="${encodeMessageField(field)}" data-kind="${encodeMessageField(
      kind || "assistant"
    )}" data-loading="${isLoading ? "true" : "false"}" data-content="${encodeMessageField(content || "")}"></div>`;
  }
  return `<div class="ai-card-body pretext markdown-content streamdown-target" data-message-id="${encodeMessageField(
    messageId
  )}" data-field="${encodeMessageField(field)}" data-kind="${encodeMessageField(
    kind || "assistant"
  )}" data-loading="${isLoading ? "true" : "false"}" data-content="${encodeMessageField(content || "")}"></div>`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createMessageId() {
  messageIdSeed += 1;
  return `msg-${Date.now().toString(36)}-${messageIdSeed}`;
}

function createConversationId() {
  return `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getHistoryItems() {
  return readScopedJson(STORAGE_KEYS.history, []);
}

function saveHistoryItems(items) {
  writeScopedJson(STORAGE_KEYS.history, items.slice(0, 50));
}

function handleBackendSyncError(error) {
  console.warn(error);
  setRuntimeStatus(t("common.backendSyncFailed"));
}

function createMd5Hex(value = "") {
  function rotateLeft(x, c) {
    return (x << c) | (x >>> (32 - c));
  }

  function toHex(value32) {
    let out = "";
    for (let i = 0; i < 4; i += 1) {
      out += ((value32 >>> (i * 8)) & 0xff).toString(16).padStart(2, "0");
    }
    return out;
  }

  const message = new TextEncoder().encode(String(value));
  const originalLength = message.length;
  const bitLength = originalLength * 8;
  const paddedLength = (((originalLength + 8) >> 6) + 1) * 64;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(message);
  buffer[originalLength] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, bitLength >>> 0, true);
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const shifts = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
  ];
  const constants = Array.from({ length: 64 }, (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const chunk = new Uint32Array(16);
    for (let i = 0; i < 16; i += 1) {
      chunk[i] = view.getUint32(offset + i * 4, true);
    }

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i += 1) {
      let f;
      let g;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + constants[i] + chunk[g]) >>> 0;
      b = (b + rotateLeft(sum, shifts[i])) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  return `${toHex(a0)}${toHex(b0)}${toHex(c0)}${toHex(d0)}`;
}

function normalizeFrontendPasswordHash(value = "") {
  return String(value || "").trim().toLowerCase();
}

function resolveFrontendPasswordHash(configHash = "") {
  return normalizeFrontendPasswordHash(FRONTEND_AUTH_ENV_HASH) || normalizeFrontendPasswordHash(configHash);
}

function hasUnlockedFrontendAccess() {
  return Boolean(frontendPasswordHash) &&
    normalizeFrontendPasswordHash(localStorage.getItem(STORAGE_KEYS.frontendAccess)) === frontendPasswordHash;
}

async function validateFrontendPassword(password) {
  if (!frontendPasswordHash) return false;
  return createMd5Hex(password) === frontendPasswordHash;
}

async function loadFrontendPasswordHash() {
  if (runtimeMode !== "frontend") return "";
  if (FRONTEND_AUTH_ENV_HASH) {
    frontendPasswordHash = normalizeFrontendPasswordHash(FRONTEND_AUTH_ENV_HASH);
    return frontendPasswordHash;
  }

  try {
    const response = await fetch(FRONTEND_AUTH_CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) {
      frontendPasswordHash = "";
      return "";
    }
    const config = await response.json();
    frontendPasswordHash = resolveFrontendPasswordHash(config?.frontendPasswordMd5 || config?.passwordMd5 || "");
    return frontendPasswordHash;
  } catch {
    frontendPasswordHash = "";
    return "";
  }
}

async function loadLocalModelConfigFile() {
  if (runtimeMode !== "frontend") return;
  try {
    const response = await fetch(LOCAL_MODEL_CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    const nextModels = normalizeModelConfigs(Array.isArray(config?.models) ? config.models : []);
    if (!shouldBootstrapLocalModels(localStorage.getItem(getScopedStorageKey(STORAGE_KEYS.models)), nextModels)) return;
    modelConfigs = nextModels;
    saveModelConfigs();
    if (shouldBootstrapDefaultFriends(localStorage.getItem(getScopedStorageKey(STORAGE_KEYS.friends)), nextModels)) {
      friendProfiles = createDefaultFriendProfiles(modelConfigs);
      saveFriendProfiles();
    }
    reconcileGroupStates();
  } catch (error) {
    console.warn("Failed to load local model config file:", error);
  }
}

function loadScopedFriendProfiles(models = modelConfigs) {
  return normalizeFriendProfiles(
    resolveFriendProfilesForScope({
      storedFriendsRaw: localStorage.getItem(getScopedStorageKey(STORAGE_KEYS.friends)),
      storedFriends: readScopedJson(STORAGE_KEYS.friends, []),
      incomingModels: models,
      createDefaultFriendProfiles
    }),
    models
  );
}

function reloadScopedLocalState() {
  modelConfigs = normalizeModelConfigs(readScopedJson(STORAGE_KEYS.models, []));
  friendProfiles = loadScopedFriendProfiles(modelConfigs);
  defaultGroupSettings = normalizeGroupSettings(
    readScopedJson(STORAGE_KEYS.groupSettings, createDefaultGroupSettings(friendProfiles)),
    friendProfiles
  );
  currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
  draftGroupSettings = cloneGroupSettings(currentConversationGroupSettings);
  currentConversation = [];
  activeConversationId = null;
  activeHistoryIndex = null;
}

function updateFrontendPasswordError(message = "") {
  if (!frontendPasswordError) return;
  frontendPasswordError.hidden = !message;
  frontendPasswordError.textContent = message;
  frontendPasswordInput?.classList.toggle("is-invalid", Boolean(message));
  if (message && frontendPasswordModal) {
    frontendPasswordModal.classList.remove("shake");
    void frontendPasswordModal.offsetWidth;
    frontendPasswordModal.classList.add("shake");
  }
}

function setFrontendPasswordModalVisible(visible) {
  if (!frontendPasswordModal) return;
  frontendAccessBlocked = Boolean(visible) && runtimeMode === "frontend";
  document.body.classList.toggle("frontend-access-locked", frontendAccessBlocked);
  frontendPasswordModal.hidden = !visible;
  if (visible) {
    frontendPasswordModal.classList.remove("shake");
    frontendPasswordInput?.focus();
  }
}

async function ensureFrontendAccess() {
  if (runtimeMode !== "frontend") return true;
  await loadFrontendPasswordHash();
  if (!frontendPasswordHash) {
    setFrontendPasswordModalVisible(true);
    updateFrontendPasswordError(t("common.frontendPasswordMissing"));
    return false;
  }
  if (hasUnlockedFrontendAccess()) {
    setFrontendPasswordModalVisible(false);
    updateFrontendPasswordError("");
    return true;
  }
  setFrontendPasswordModalVisible(true);
  updateFrontendPasswordError("");
  return false;
}

function guardFrontendAccess(event) {
  if (!frontendAccessBlocked) return false;
  if (frontendPasswordModal?.contains(event.target)) return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  frontendPasswordInput?.focus();
  return true;
}

async function syncHistoryToBackend(items = getHistoryItems()) {
  if (runtimeMode !== "backend") return;
  await apiRequest("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ conversations: items.slice(0, 50) })
  });
}

async function switchRuntimeMode(nextMode) {
  if (!nextMode || nextMode === runtimeMode) return;
  const previousMode = runtimeMode;
  runtimeMode = nextMode;
  localStorage.setItem(STORAGE_KEYS.runtime, runtimeMode);
  if (runtimeMode === "backend") {
    setFrontendPasswordModalVisible(false);
    try {
      await loadBackendState();
    } catch (error) {
      runtimeMode = previousMode;
      localStorage.setItem(STORAGE_KEYS.runtime, runtimeMode);
      throw error;
    }
  }
}

function getAccount() {
  return normalizeLocalAccount(readJson(STORAGE_KEYS.account, null) || {});
}

function getActiveModels() {
  return getOrderedModelConfigs().filter((item) => item.enabled);
}

function createFriendProfile() {
  const friendCount = friendProfiles.length + 1;
  return {
    id: `friend-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: currentLanguage === "zh-CN" ? `\u7fa4\u53cb ${friendCount}` : `Friend ${friendCount}`,
    avatar: "",
    modelConfigId: getOrderedModelConfigs()[0]?.id || "",
    systemPrompt: getDefaultFriendSystemPrompt(
      currentLanguage === "zh-CN" ? `\u7fa4\u53cb ${friendCount}` : `Friend ${friendCount}`
    ),
    enabled: true,
    description:
      currentLanguage === "zh-CN"
        ? "\u81ea\u5b9a\u4e49 AI \u7fa4\u53cb\u89d2\u8272\uff0c\u53ef\u4ee5\u7ed1\u5b9a\u5230\u4efb\u610f\u6a21\u578b\u3002"
        : "Custom AI group friend bound to any available model."
  };
}

function getActiveGroupSettings() {
  return normalizeGroupSettings(currentConversationGroupSettings, friendProfiles);
}

function getFriendModelLabel(friend) {
  const model = getModelConfigById(friend?.modelConfigId);
  return model?.name || friend?.modelConfigId || "";
}

function buildFriendSnapshot(friend) {
  const model = getModelConfigById(friend.modelConfigId);
  return {
    id: friend.id,
    name: friend.name,
    avatar: friend.avatar || "",
    modelConfigId: friend.modelConfigId,
    modelConfigName: model?.name || "",
    provider: model?.provider || "",
    model: model?.model || "",
    thinkingEnabled: Boolean(model?.thinkingEnabled),
    systemPrompt: friend.systemPrompt || "",
    enabled: friend.enabled !== false,
    description: friend.description || ""
  };
}

function getSessionFriendMap(session = {}) {
  const snapshots = Array.isArray(session.friendsSnapshot) ? session.friendsSnapshot : [];
  return new Map(snapshots.map((item) => [item.id, item]));
}

function getSessionMemberIds(session = {}) {
  if (Array.isArray(session.friendIds) && session.friendIds.length) {
    return session.friendIds;
  }
  if (session.groupSettingsSnapshot?.memberIds?.length) {
    return session.groupSettingsSnapshot.memberIds;
  }
  return [];
}

function getSessionSynthesisFriend(session = {}) {
  const friendMap = getSessionFriendMap(session);
  if (session.synthesisFriendId) {
    return friendMap.get(session.synthesisFriendId) || getFriendById(session.synthesisFriendId);
  }
  const earliestMemberId = getSessionMemberIds(session)[0];
  if (earliestMemberId) {
    return friendMap.get(earliestMemberId) || getFriendById(earliestMemberId);
  }
  const earliestModelName = Array.isArray(session.models) ? session.models[0] : "";
  if (earliestModelName) {
    return friendProfiles.find((item) => item.name === earliestModelName) || null;
  }
  if (session.synthesisModel) {
    return friendProfiles.find((item) => item.name === session.synthesisModel) || null;
  }
  return null;
}

function getConversationParticipants(session = {}) {
  const friendMap = getSessionFriendMap(session);
  const ids = getSessionMemberIds(session);
  if (ids.length) {
    return ids.map((id) => friendMap.get(id) || getFriendById(id)).filter(Boolean);
  }
  if (Array.isArray(session.models)) {
    return session.models
      .map((name) => friendProfiles.find((item) => item.name === name))
      .filter(Boolean);
  }
  return [];
}

function resolveConversationFriends(settings = getActiveGroupSettings()) {
  const normalized = normalizeGroupSettings(settings, friendProfiles);
  return normalized.memberIds
    .map((id) => getFriendById(id))
    .filter(Boolean)
    .map((friend) => {
      const model = getModelConfigById(friend.modelConfigId);
      return {
        ...friend,
        modelConfigName: model?.name || "",
        provider: model?.provider || "",
        model: model?.model || "",
        baseUrl: model?.baseUrl || "",
        apiKey: model?.apiKey || "",
        thinkingEnabled: Boolean(model?.thinkingEnabled),
        modelAvatar: model?.avatar || ""
      };
    })
    .filter((friend) => friend.modelConfigName);
}

function getRuntimeLabel(mode) {
  return t(mode === "backend" ? "common.runtimeBackendShort" : "common.runtimeFrontendShort");
}

function formatMetaParts(parts = []) {
  return parts.filter(Boolean).join(" 路 ");
}

function normalizeText(text = "") {
  return String(text || "").replace(/\r\n/g, "\n").trim();
}

function normalizeModelResult(result = {}) {
  const rawContent = String(result.content || "");
  const rawThinking = String(result.thinking || "");

  // Pattern 1: <think> tags
  const thinkTagMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);

  // Pattern 2: ```thinking code block
  const thinkBlockMatch = rawContent.match(/```thinking\n([\s\S]*?)```/);

  if (rawThinking) {
    return {
      thinking: normalizeText(rawThinking),
      content: normalizeText(rawContent.replace(/<think>[\s\S]*?<\/think>/gi, ""))
    };
  }

  if (thinkTagMatch) {
    return {
      thinking: normalizeText(thinkTagMatch[1] || ""),
      content: normalizeText(rawContent.replace(/<think>[\s\S]*?<\/think>/gi, ""))
    };
  }

  if (thinkBlockMatch) {
    return {
      thinking: normalizeText(thinkBlockMatch[1] || ""),
      content: normalizeText(rawContent.replace(/```thinking\n[\s\S]*?```/, ""))
    };
  }

  return {
    thinking: "",
    content: normalizeText(rawContent)
  };
}

function getConversationTitle(session = {}) {
  const base = String(session.title || session.prompt || "").trim();
  return base || t("common.untitledConversation");
}

function getSessionDate(session = {}) {
  const raw = session.updatedAt || session.createdAt || session.timestamp;
  const parsed = raw ? new Date(raw) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
  return new Date();
}

function getConversationBucketKey(session = {}) {
  if (session.pinned) return "bucketPinned";
  const sessionDate = getSessionDate(session);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionStart = new Date(
    sessionDate.getFullYear(),
    sessionDate.getMonth(),
    sessionDate.getDate()
  );
  const diffDays = Math.floor((todayStart - sessionStart) / 86400000);
  if (diffDays <= 0) return "bucketToday";
  if (diffDays === 1) return "bucketYesterday";
  if (diffDays < 7) return "bucketLast7Days";
  if (diffDays < 30) return "bucketLast30Days";
  return "bucketOlder";
}

function groupHistoryItems(items = []) {
  const pinnedItems = [];
  const datedGroups = new Map();
  const orderedKeys = [];

  items.forEach((item, index) => {
    const bucket = getConversationBucketKey(item);
    if (bucket === "bucketPinned") {
      pinnedItems.push({ item, index });
      return;
    }
    if (!datedGroups.has(bucket)) {
      datedGroups.set(bucket, []);
      orderedKeys.push(bucket);
    }
    datedGroups.get(bucket).push({ item, index });
  });

  const groups = [];
  if (pinnedItems.length) {
    groups.push({ key: "bucketPinned", items: pinnedItems });
  }
  orderedKeys.forEach((key) => {
    groups.push({ key, items: datedGroups.get(key) });
  });
  return groups;
}

function getDisplayConversationTitle(session = {}, limit = 18) {
  const title = getConversationTitle(session);
  return Array.from(title).slice(0, limit).join("");
}

function getProviderIconKey(name = "", provider = "") {
  const source = `${name} ${provider}`.toLowerCase();
  const iconMap = [
    ["chatgpt", "openai"],
    ["openai", "openai"],
    ["claude", "anthropic"],
    ["anthropic", "anthropic"],
    ["gemini", "gemini"],
    ["google", "google"],
    ["grok", "grok"],
    ["xai", "xai"],
    ["deepseek", "deepseek"],
    ["qwen", "qwen"],
    ["alibaba", "alibaba"],
    ["doubao", "doubao"],
    ["bytedance", "doubao"],
    ["hunyuan", "tencent"],
    ["tencent", "tencent"],
    ["zhipu", "zhipu"],
    ["chatglm", "chatglm"],
    ["baidu", "baidu"],
    ["wenxin", "baidu"],
    ["kimi", "kimi"],
    ["moonshot", "kimi"],
    ["meta", "meta"],
    ["llama", "meta"],
    ["mistral", "mistral"],
    ["cohere", "cohere"],
    ["perplexity", "perplexity"]
  ];
  const match = iconMap.find(([keyword]) => source.includes(keyword));
  return match?.[1] || "newapi";
}

function nameToColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

function renderProviderIcon(name = "", provider = "", fallback = "AI", avatar = "") {
  const avatarValue = String(avatar || "").trim();
  const fallbackLabel = escapeHtml(String(fallback || name || provider || "AI").slice(0, 2).toUpperCase());
  const bgColor = nameToColor(name || fallback || provider || "AI");

  if (avatarValue) {
    if (/^(https?:\/\/|\/|image\/)/i.test(avatarValue)) {
      return `
        <img
          class="provider-icon provider-icon-custom"
          src="${escapeHtml(avatarValue)}"
          alt="${escapeHtml(name || provider || fallback)}"
          loading="lazy"
          onerror="this.replaceWith(Object.assign(document.createElement('span'), { className: 'avatar-fallback avatar-fallback-custom', textContent: '${fallbackLabel}' }))"
        />
      `;
    }
    return `<span class="avatar-fallback avatar-fallback-custom">${escapeHtml(
      Array.from(avatarValue).slice(0, 2).join("")
    )}</span>`;
  }

  return `<span class="avatar-fallback" style="background:${bgColor};color:#fff;border-radius:50%;">${fallbackLabel}</span>`;
}

function apiRequest(path, options = {}) {
  return fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  });
}

async function apiRunWorkflowStream(payload, handlers = {}) {
  const response = await fetch("/api/chat/run/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Request failed");
  }
  if (!response.body) {
    throw new Error("Streaming is not supported in the current runtime.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const text = line.trim();
      if (!text) continue;
      handlers.onEvent?.(JSON.parse(text));
    }
  }
  const tail = buffer.trim();
  if (tail) handlers.onEvent?.(JSON.parse(tail));
}

function setRuntimeStatus(message) {
  if (runStatus) runStatus.textContent = message;
}

function autosizePromptInput() {
  if (!promptInput) return;
  promptInput.style.height = "0px";
  const minH = window.innerWidth <= 640 ? 44 : 64;
  const maxH = Math.min(Math.round(window.innerHeight * 0.4), 260);
  promptInput.style.height = `${Math.min(Math.max(promptInput.scrollHeight, minH), maxH)}px`;
}

function scrollMessageStreamToBottom() {
  if (!messageStream) return;
  requestAnimationFrame(() => {
    messageStream.scrollTop = messageStream.scrollHeight;
  });
}

function formatMessageTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(currentLanguage === "zh-CN" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function avatarClass(name = "") {
  return `avatar-${String(name || "ai").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function normalizeConversationMessage(message = {}, fallbackDate = new Date().toISOString()) {
  return {
    role: message.role || "assistant",
    kind: message.kind || (message.role === "user" ? "user" : "model"),
    friendId: message.friendId || "",
    name: message.name || "",
    avatar: message.avatar || "",
    modelConfigId: message.modelConfigId || "",
    modelConfigName: message.modelConfigName || "",
    provider: message.provider || "",
    model: message.model || "",
    thinkingEnabled: Boolean(message.thinkingEnabled),
    source: message.source || "",
    error: message.error || "",
    content: String(message.content || ""),
    thinking: String(message.thinking || ""),
    createdAt: message.createdAt || fallbackDate,
    messageId: message.messageId || createMessageId(),
    isLoading: Boolean(message.isLoading)
  };
}

function buildConversationFromSession(session = {}) {
  const fallbackDate = session.updatedAt || session.createdAt || new Date().toISOString();
  const synthesisFriend = getSessionSynthesisFriend(session);
  const synthesisModelConfig = modelConfigs.find((item) => item.name === session.synthesisModel) || null;
  if (Array.isArray(session.messages) && session.messages.length) {
    return session.messages.map((message) => {
      const normalized = normalizeConversationMessage(message, fallbackDate);
      if (normalized.kind !== "synthesis") {
        return normalized;
      }
      return {
        ...normalized,
        friendId: normalized.friendId || session.synthesisFriendId || "",
        name: `${synthesisFriend?.name || session.synthesisModel || "AI"} ${t("common.synthesis")}`,
        avatar: synthesisFriend?.avatar || normalized.avatar,
        modelConfigId: synthesisFriend?.modelConfigId || normalized.modelConfigId,
        modelConfigName:
          synthesisFriend?.modelConfigName || synthesisFriend?.name || normalized.modelConfigName,
        provider: synthesisFriend?.provider || synthesisModelConfig?.provider || normalized.provider,
        model: synthesisFriend?.model || synthesisModelConfig?.model || normalized.model,
        thinkingEnabled: synthesisFriend ? Boolean(synthesisFriend.thinkingEnabled) : normalized.thinkingEnabled
      };
    });
  }
  const friendMap = getSessionFriendMap(session);
  const responseMessages = Array.isArray(session.responses)
    ? session.responses.map((entry) =>
        normalizeConversationMessage(
          {
            role: "assistant",
            kind: "model",
            friendId: entry.friendId || "",
            name: entry.name,
            avatar: entry.avatar || friendMap.get(entry.friendId)?.avatar || "",
            modelConfigId: entry.modelConfigId || "",
            modelConfigName:
              entry.modelConfigName || friendMap.get(entry.friendId)?.modelConfigName || entry.modelName || "",
            provider: entry.provider,
            model: entry.model,
            thinkingEnabled: Boolean(entry.thinkingEnabled),
            source: entry.source,
            error: entry.error || "",
            content: entry.content,
            thinking: entry.thinking || "",
            createdAt: fallbackDate
          },
          fallbackDate
        )
      )
    : [];
  return [
    normalizeConversationMessage(
      {
        role: "user",
        kind: "user",
        content: session.prompt || "",
        createdAt: fallbackDate
      },
      fallbackDate
    ),
    ...responseMessages,
    normalizeConversationMessage(
      {
        role: "assistant",
        kind: "synthesis",
        friendId: session.synthesisFriendId || "",
        name: `${getSessionSynthesisFriend(session)?.name || session.synthesisModel || "AI"} ${t("common.synthesis")}`,
        avatar: getSessionSynthesisFriend(session)?.avatar || "",
        modelConfigId: getSessionSynthesisFriend(session)?.modelConfigId || "",
        modelConfigName:
          getSessionSynthesisFriend(session)?.modelConfigName || getSessionSynthesisFriend(session)?.name || "",
        provider:
          getSessionSynthesisFriend(session)?.provider ||
          modelConfigs.find((item) => item.name === session.synthesisModel)?.provider ||
          "",
        model:
          getSessionSynthesisFriend(session)?.model ||
          modelConfigs.find((item) => item.name === session.synthesisModel)?.model ||
          "",
        thinkingEnabled: Boolean(getSessionSynthesisFriend(session)?.thinkingEnabled),
        content: session.mergedAnswer || "",
        createdAt: fallbackDate
      },
      fallbackDate
    )
  ].filter((message) => message.content || message.kind === "user");
}

function serializeConversation(messages = []) {
  return messages.map((message) => ({
    role: message.role,
    kind: message.kind,
    friendId: message.friendId,
    name: message.name,
    avatar: message.avatar,
    modelConfigId: message.modelConfigId,
    modelConfigName: message.modelConfigName,
    provider: message.provider,
    model: message.model,
    thinkingEnabled: message.thinkingEnabled,
    source: message.source,
    error: message.error,
    content: message.content,
    thinking: message.thinking,
    createdAt: message.createdAt,
    messageId: message.messageId
  }));
}

function updateConversationMessageById(messageId, patch = {}) {
  const index = currentConversation.findIndex((message) => message.messageId === messageId);
  if (index < 0) return;
  currentConversation[index] = { ...currentConversation[index], ...patch };
}

/**
 * Build conversation history for a specific friend, excluding the current run.
 * Returns [{role: "user"|"assistant", content: "..."}] suitable for chat API messages.
 */
function buildConversationHistoryForFriend(friendId, excludeRunId) {
  const history = [];
  for (const msg of currentConversation) {
    if (msg.runId === excludeRunId) continue;
    if (msg.isLoading) continue;
    if (!msg.content) continue;
    if (msg.kind === "user") {
      history.push({ role: "user", content: msg.content });
    } else if ((msg.kind === "model" || msg.kind === "synthesis") && msg.friendId === friendId) {
      history.push({ role: "assistant", content: msg.content });
    }
  }
  return history;
}

function removeMessagesByRunId(runId) {
  currentConversation = currentConversation.filter((message) => message.runId !== runId);
}

async function streamTextToMessage(messageId, text, field = "content") {
  const value = String(text || "");
  const chunks = value.match(/[\s\S]{1,12}/g) || []; // Smaller chunks for smoother streaming
  if (!chunks.length) {
    updateConversationMessageById(messageId, { [field]: value, isLoading: false });
    renderMessageStream();
    return;
  }

  // Start streaming
  updateConversationMessageById(messageId, { [field]: "", isLoading: true });
  renderMessageStream();

  let buffer = "";
  for (const chunk of chunks) {
    buffer += chunk;
    updateConversationMessageById(messageId, { [field]: buffer, isLoading: true });
    renderMessageStream();
    await sleep(12); // Slightly faster for smoother effect
  }

  // Streaming complete
  updateConversationMessageById(messageId, { isLoading: false });
  renderMessageStream();
}

function mockResponseFor(model, prompt, platformContext = null) {
  return buildPromptAwareMockResponse({
    friendName: model.name,
    prompt,
    language: currentLanguage,
    platformName: platformContext?.name || "",
    platformCompany: platformContext?.company || "",
    platformStrengths: platformContext?.strengths || ""
  });
}

function renderUserBar() {
  const account = getAccount();
  if (userBarAvatar) {
    userBarAvatar.textContent = account?.name?.slice(0, 1)?.toUpperCase() || "?";
  }
  if (userBarNameEl) {
    userBarNameEl.textContent = account?.name || t("common.guest");
  }
  if (accountSummary) {
    accountSummary.innerHTML = account
      ? `<strong>${escapeHtml(account.name)}</strong><p>${escapeHtml(account.email)}</p><p>${escapeHtml(t("common.accountSaved", account))}</p>`
      : `<p>${escapeHtml(t("common.noAccount"))}</p>`;
  }
}

function renderRuntime() {
  if (!runtimeModeToggle || !runtimeDescription) return;
  runtimeModeToggle.querySelectorAll("[data-runtime]").forEach((button) => {
    button.classList.toggle("active", button.dataset.runtime === runtimeMode);
  });
  runtimeDescription.textContent =
    runtimeMode === "backend" ? t("common.runtimeBackend") : t("common.runtimeFrontend");
}

function renderModelSummary() {
  const members = resolveConversationFriends();
  const synthesisFriendId = currentConversationGroupSettings.synthesisFriendId;
  const synthesisFriend = members.find((item) => item.id === synthesisFriendId) || members[0] || null;
  const platform =
    currentConversationGroupSettings.platformFeatureEnabled && getPreferredPlatformOption(currentConversationGroupSettings);
  if (chatMembersLabel) {
    chatMembersLabel.textContent = t("common.friendsSelected", { count: members.length });
  }
  if (selectedModels) {
    // Show synthesis friend chip or platform chip
    if (platform) {
      selectedModels.innerHTML = `
        <span class="model-chip model-chip-platform">
          <span class="model-chip-platform-badge">${escapeHtml(platform.company)}</span>
          <span>${escapeHtml(platform.name)}</span>
        </span>
      `;
    }
  }
  if (selectedCount) selectedCount.textContent = "";
  if (modelCount) {
    modelCount.textContent = String(getActiveModels().length);
  }
}

function renderSynthesisOptions() {
  if (!synthModelSelect) return;
  const members = resolveConversationFriends();
  const isSynthesisEnabled = Boolean(currentConversationGroupSettings.synthesisEnabled);

  // Show/hide regenerate button based on whether synthesis is enabled
  if (rerollSynthesisButton) {
    rerollSynthesisButton.style.display = isSynthesisEnabled && members.length > 0 ? "" : "none";
  }

  // Update expert-only toggle visibility and disabled state
  if (expertOnlyToggleLabel) {
    expertOnlyToggleLabel.style.display = isSynthesisEnabled && members.length > 0 ? "" : "none";
  }
  if (expertOnlyToggle) {
    const hasConversation = currentConversation.length > 0;
    const allFriendsDone = hasConversation && currentConversation
      .filter((m) => m.kind === "model" && !m.isSynthesis)
      .every((m) => !m.isLoading);
    const hasExpert = getEnabledFriends().some((f) => f.isIntegrationExpert);
    const canEnable = hasConversation && allFriendsDone && hasExpert;
    expertOnlyToggle.disabled = !canEnable;
    if (expertOnlyToggleLabel) {
      expertOnlyToggleLabel.classList.toggle("is-disabled", !canEnable);
      // Build tooltip
      let tooltip = "";
      if (!hasConversation) {
        tooltip = t("common.expertOnlyNeedMessage");
      } else if (!allFriendsDone) {
        tooltip = t("common.expertOnlyNeedAllDone");
      } else if (!hasExpert) {
        tooltip = t("common.expertOnlyNeedExpert");
      } else {
        tooltip = t("common.expertOnlyModeHint");
      }
      expertOnlyToggleLabel.title = tooltip;
    }
  }

  // Only show friends marked as integration experts in the synthesis selector
  // Expert friends are excluded from memberIds, so query profiles directly
  const expertMembers = getEnabledFriends()
    .filter((f) => f.isIntegrationExpert)
    .map((f) => {
      const model = getModelConfigById(f.modelConfigId);
      return { ...f, model: model?.model || "", baseUrl: model?.baseUrl || "", apiKey: model?.apiKey || "" };
    });

  const current = currentConversationGroupSettings.synthesisFriendId || synthModelSelect.value;
  synthModelSelect.innerHTML = expertMembers
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");
  if (!expertMembers.length) {
    synthModelSelect.value = "";
    return;
  }
  const nextValue = expertMembers.some((item) => item.id === current) ? current : expertMembers[0].id;
  currentConversationGroupSettings.synthesisFriendId = nextValue;
  synthModelSelect.value = nextValue;
}

function getPreferredPlatformOption(groupSettings = currentConversationGroupSettings) {
  return (
    PLATFORM_OPTIONS.find((item) => item.id === groupSettings.preferredPlatform) ||
    PLATFORM_OPTIONS[0] ||
    null
  );
}

function buildPlatformFeatureMeta(platform) {
  if (!platform) return "";
  const strength =
    platform.strengths?.[currentLanguage] || platform.strengths?.["zh-CN"] || platform.strengths?.en || "";
  return [platform.company, strength].filter(Boolean).join(" · ");
}

function getPlatformRoutingContext(groupSettings = currentConversationGroupSettings) {
  if (!groupSettings?.platformFeatureEnabled) return null;
  const platform = getPreferredPlatformOption(groupSettings);
  if (!platform) return null;
  return {
    id: platform.id,
    name: platform.name,
    company: platform.company,
    strengths:
      platform.strengths?.[currentLanguage] || platform.strengths?.["zh-CN"] || platform.strengths?.en || "",
    coverage:
      platform.coverage?.[currentLanguage] || platform.coverage?.["zh-CN"] || platform.coverage?.en || ""
  };
}

function buildPlatformPromptAddon(platformContext) {
  if (!platformContext) return "";
  if (currentLanguage === "zh-CN") {
    return `\n\n平台路由要求：本次会话优先参考 ${platformContext.name}（${platformContext.company}）对应的数据生态与搜索能力。擅长方向：${platformContext.strengths}。回答时请尽量体现这个平台更容易触达的信息视角，并明确你的判断边界。`;
  }
  return `\n\nPlatform routing requirement: prioritize the ${platformContext.name} (${platformContext.company}) data ecosystem and search strengths for this conversation. Strengths: ${platformContext.strengths}. Reflect that platform's likely information vantage point and state your confidence boundaries.`;
}

function buildPlatformSourceLabel(platformContext, baseSource) {
  if (!platformContext) return baseSource;
  return `${baseSource} · ${platformContext.name}`;
}

async function generateFrontendFriendResponse(friend, prompt, platformContext, targetId, runId) {
  console.debug("[Frontend Response] Generating response for friend:", friend.name, friend.id, "hasLiveProviderConfig:", hasLiveProviderConfig(friend));
  const history = buildConversationHistoryForFriend(friend.id, runId);
  const systemPrompt = `${
    currentConversationGroupSettings.sharedSystemPromptEnabled
      ? currentConversationGroupSettings.sharedSystemPrompt
      : friend.systemPrompt
  }${buildPlatformPromptAddon(platformContext)}`.trim();

  if (!hasLiveProviderConfig(friend)) {
    const { thinking, content } = normalizeModelResult({
      content: mockResponseFor(friend, prompt, platformContext)
    });
    // Stream mock response for visual effect
    if (thinking && targetId) {
      await streamTextToMessage(targetId, thinking, "thinking");
    }
    if (content && targetId) {
      await streamTextToMessage(targetId, content, "content");
    }
    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || friend.modelAvatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: buildPlatformSourceLabel(platformContext, t("common.mock")),
      thinking: thinking || "",
      content: content || "",
      error: ""
    };
  }

  try {
    let currentContent = "";
    let currentThinking = "";

    if (targetId) {
      updateConversationMessageById(targetId, { isLoading: true });
    }

    const output = await callFrontendStream(friend, prompt, systemPrompt, {
      history,
      onDelta: targetId ? (delta) => {
        if (delta.type === "thinking") {
          currentThinking += delta.text;
          updateConversationMessageById(targetId, {
            thinking: currentThinking,
            isLoading: true
          });
        } else if (delta.type === "content") {
          currentContent += delta.text;
          updateConversationMessageById(targetId, {
            content: currentContent,
            isLoading: true
          });
        }
        renderMessageStream();
      } : undefined,
    });

    const finalContent = output.content || "";
    const finalThinking = output.thinking || "";

    if (targetId) {
      updateConversationMessageById(targetId, {
        content: finalContent,
        thinking: finalThinking,
        isLoading: false
      });
      renderMessageStream();
      renderSynthesisOptions();
    }

    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || friend.modelAvatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: buildPlatformSourceLabel(platformContext, t("common.configured")),
      thinking: finalThinking,
      content: finalContent,
      error: ""
    };
  } catch (error) {
    const classifiedError =
      error?.message === "Failed to fetch"
        ? currentLanguage === "zh-CN"
          ? "浏览器请求失败，可能是 CORS、网络异常或目标服务拒绝前端直连"
          : "Browser request failed. The endpoint may be blocked by CORS, network issues, or browser-side access restrictions."
        : error.message || "";
    const { thinking, content } = normalizeModelResult({
      content: mockResponseFor(friend, prompt, platformContext)
    });

    // Stream fallback content for visual consistency
    if (thinking && targetId) {
      await streamTextToMessage(targetId, thinking, "thinking");
    }
    if (content && targetId) {
      await streamTextToMessage(targetId, content, "content");
    }

    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || friend.modelAvatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: buildPlatformSourceLabel(platformContext, t("common.fallback")),
      thinking: thinking || "",
      content: content || "",
      error: classifiedError
    };
  }
}

async function generateFrontendSynthesisResponse(synthesisFriend, prompt, results, platformContext, targetId) {
  const synthesisPayload = buildSynthesisPayload({
    prompt,
    language: currentLanguage,
    results
  });
  const synthesisPrompt = buildSynthesisPromptText({
    prompt,
    language: currentLanguage,
    results
  });
  const basePrompt = synthesisFriend.systemPrompt || getDefaultSynthesisSystemPrompt(currentLanguage);
  const systemPrompt = `${basePrompt}${buildPlatformPromptAddon(platformContext)}`;

  if (!hasLiveProviderConfig(synthesisFriend)) {
    const fallbackContent = buildFallbackSynthesis({ prompt, language: currentLanguage, results });
    if (targetId) {
      await streamTextToMessage(targetId, fallbackContent, "content");
    }
    return {
      content: fallbackContent,
      source: t("common.fallback"),
      error: ""
    };
  }

  try {
    let currentContent = "";
    let currentThinking = "";

    const output = await callFrontendStream(synthesisFriend, synthesisPrompt, systemPrompt, {
      onDelta: targetId ? (delta) => {
        if (delta.type === "thinking") {
          currentThinking += delta.text;
          updateConversationMessageById(targetId, {
            thinking: currentThinking,
            isLoading: true
          });
        } else if (delta.type === "content") {
          currentContent += delta.text;
          updateConversationMessageById(targetId, {
            content: currentContent,
            isLoading: true
          });
        }
        renderMessageStream();
      } : undefined,
    });

    if (targetId) {
      updateConversationMessageById(targetId, {
        content: output.content || "",
        thinking: output.thinking || "",
        isLoading: false
      });
      renderMessageStream();
      renderSynthesisOptions();
    }

    return {
      content: output.content || buildFallbackSynthesis({ prompt, language: currentLanguage, results }),
      source: t("common.configured"),
      error: "",
      payload: synthesisPayload
    };
  } catch (error) {
    const fallbackContent = buildFallbackSynthesis({ prompt, language: currentLanguage, results });
    if (targetId) {
      await streamTextToMessage(targetId, fallbackContent, "content");
    }
    return {
      content: fallbackContent,
      source: t("common.fallback"),
      error: describeModelTestFailure({ message: error.message, language: currentLanguage, mode: runtimeMode }).message,
      payload: synthesisPayload
    };
  }
}

async function testModelConnection(model, onDelta) {
  const prompt = buildModelTestPrompt(currentLanguage);
  if (!hasLiveProviderConfig(model)) {
    return { ok: false, message: t("common.testMissingConfig") };
  }

  try {
    const output = await callFrontendStream(model, prompt, "", {
      onDelta: onDelta ? (delta) => {
        if (delta.type === "content") {
          onDelta(delta.text);
        }
      } : undefined,
    });
    return {
      ok: true,
      message: output.content ? `${t("common.testSuccess")}: ${output.content}` : t("common.testSuccess")
    };
  } catch (error) {
    return {
      ok: false,
      message: describeModelTestFailure({
        message: error.message || "Request failed",
        language: currentLanguage,
        mode: runtimeMode
      }).message
    };
  }
}

async function testModelConnectionViaBackend(model) {
  return apiRequest("/api/models/test", {
    method: "POST",
    body: JSON.stringify({ model, language: currentLanguage })
  });
}

async function runModelConnectionTest(id, card) {
  const current = modelConfigs.find((item) => item.id === id);
  if (!current || !card) return;
  const draft = {
    ...current,
    name: card.querySelector('[data-field="name"]')?.value.trim() || current.name,
    provider: card.querySelector('[data-field="provider"]')?.value.trim() || current.provider,
    model: card.querySelector('[data-field="model"]')?.value.trim() || current.model,
    baseUrl: card.querySelector('[data-field="baseUrl"]')?.value.trim() || current.baseUrl,
    apiKey: card.querySelector('[data-field="apiKey"]')?.value.trim() || current.apiKey,
    thinkingEnabled: Boolean(card.querySelector('[data-field="thinkingEnabled"]')?.checked)
  };

  modelTestState[id] = { status: "pending", message: t("common.testing") };
  renderConfigGrid();

  // Find the status element for streaming updates
  const statusEl = card.querySelector(".config-test-status") ||
    configGrid?.querySelector(`[data-id="${id}"] .config-test-status`);

  let streamedContent = "";
  const onDelta = (text) => {
    streamedContent += text;
    if (statusEl) {
      statusEl.textContent = `${t("common.testSuccess")}: ${streamedContent}`;
      statusEl.className = "config-test-status success";
    }
  };

  const result =
    runtimeMode === "backend"
      ? await testModelConnectionViaBackend(draft).catch((error) => ({ ok: false, message: error.message }))
      : await testModelConnection(draft, onDelta);

  modelTestState[id] = {
    status: result.ok ? "success" : "error",
    message: result.message || (result.ok ? t("common.testSuccess") : "Request failed")
  };
  renderConfigGrid();
}

function renderGroupSettingsPanel() {
  if (!groupSettingsPanel) return;
  groupSettingsPanel.hidden = !isGroupSettingsOpen;
  if (!isGroupSettingsOpen) return;

  draftGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);

  if (groupMemberPicker) {
    const availableFriends = getEnabledFriends();
    const selectedMemberCount = countSelectedGroupMembers({
      memberIds: draftGroupSettings.memberIds,
      availableFriends
    });
    const detailToggleLabel = t(isGroupMemberDetailsOpen ? "common.hideMemberDetails" : "common.viewMemberDetails");
    const selectableFriends = availableFriends.filter((f) => !f.isIntegrationExpert);
    const detailsMarkup = selectableFriends.length
      ? selectableFriends
          .map((friend) => {
            const checked = draftGroupSettings.memberIds.includes(friend.id);
            const model = getModelConfigById(friend.modelConfigId);
            const modelLabel = model?.model || model?.id || friend.modelConfigId || "";
            return `
              <label class="group-member-option">
                <input type="checkbox" data-group-member-id="${escapeHtml(friend.id)}" ${checked ? "checked" : ""} />
                <span class="group-member-copy">
                  <strong>${escapeHtml(friend.name)}</strong>
                  <span>${escapeHtml(modelLabel)}</span>
                </span>
              </label>
            `;
          })
          .join("")
      : `<article class="history-item"><strong>${escapeHtml(t("common.noFriendsTitle"))}</strong><p>${escapeHtml(
          t("common.noFriendsCopy")
        )}</p></article>`;
    groupMemberPicker.innerHTML = `
      <div class="group-member-summary-card">
        <div class="group-member-summary-copy">
          <strong>${escapeHtml(t("common.friendsSelected", { count: selectedMemberCount }))}</strong>
        </div>
        <button class="ghost-button" type="button" data-group-member-toggle>${escapeHtml(detailToggleLabel)}</button>
      </div>
      <div class="group-member-details" ${isGroupMemberDetailsOpen ? "" : "hidden"}>${detailsMarkup}</div>
    `;
  }

  if (groupSharedToggle) {
    groupSharedToggle.checked = Boolean(draftGroupSettings.sharedSystemPromptEnabled);
  }

  if (groupSharedPrompt) {
    groupSharedPrompt.value = draftGroupSettings.sharedSystemPrompt || "";
    groupSharedPrompt.disabled = !draftGroupSettings.sharedSystemPromptEnabled;
  }

  if (groupPlatformToggle) {
    groupPlatformToggle.checked = Boolean(draftGroupSettings.platformFeatureEnabled);
  }

  if (groupPlatformSelect) {
    groupPlatformSelect.innerHTML = PLATFORM_OPTIONS.map(
      (item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    ).join("");
    groupPlatformSelect.value = getPreferredPlatformOption(draftGroupSettings)?.id || PLATFORM_OPTIONS[0]?.id || "";
    groupPlatformSelect.disabled = !draftGroupSettings.platformFeatureEnabled;
  }

  const platform = getPreferredPlatformOption(draftGroupSettings);
  if (platformFeatureName) {
    platformFeatureName.textContent = platform?.name || "";
  }
  if (platformFeatureCopy) {
    platformFeatureCopy.textContent =
      platform?.coverage?.[currentLanguage] || platform?.coverage?.["zh-CN"] || platform?.coverage?.en || "";
  }
  if (platformFeatureMeta) {
    platformFeatureMeta.textContent = buildPlatformFeatureMeta(platform);
  }

  if (groupSynthesisToggle) {
    groupSynthesisToggle.checked = Boolean(draftGroupSettings.synthesisEnabled);
  }

  if (groupSynthesisSelect) {
    // Expert friends are excluded from memberIds, so query profiles directly
    const expertMembers = getEnabledFriends().filter((f) => f.isIntegrationExpert);
    groupSynthesisSelect.innerHTML = expertMembers
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join("");
    groupSynthesisSelect.value =
      expertMembers.find((item) => item.id === draftGroupSettings.synthesisFriendId)?.id || expertMembers[0]?.id || "";
    if (!expertMembers.length) {
      groupSynthesisSelect.value = "";
    }
    groupSynthesisSelect.disabled = !draftGroupSettings.synthesisEnabled;
  }
}

function renderConversationList() {
  if (!conversationList) return;
  const items = getHistoryItems().slice(0, 24);
  if (!items.length) {
    conversationList.innerHTML = `
      <article class="conversation-item conversation-item-empty active">
        <div class="conversation-item-body">
          <div class="conversation-item-line">
            <span class="conversation-item-title">OpenChat</span>
          </div>
          <div class="conversation-item-meta">${escapeHtml(t("common.waitingMessage"))}</div>
          <p class="conversation-item-preview">${escapeHtml(t("common.noHistoryCopy"))}</p>
        </div>
      </article>
    `;
    return;
  }

  conversationList.innerHTML = groupHistoryItems(items)
    .map((group) => {
      const itemsHtml = group.items
        .map(({ item, index }) => {
          const title = getConversationTitle(item);
          const displayTitle = getDisplayConversationTitle(item);
          const synthesisFriend = getSessionSynthesisFriend(item);
          const participants = getConversationParticipants(item);
      const meta = formatMetaParts([
        synthesisFriend?.name || item.synthesisModel || "",
        item.preferredPlatformName || "",
        `${participants.length || item.models?.length || 0} ${t("common.friendUnit")}`
      ]);
          const preview = item.prompt || t("common.waitingMessage");
          const titleMarkup =
            editingHistoryIndex === index
              ? `
                <input
                  class="conversation-item-title-input"
                  data-title-input="${index}"
                  value="${escapeHtml(title)}"
                  aria-label="${escapeHtml(t("common.renameTitle"))}"
                />
                <button
                  class="conversation-item-edit-btn conversation-item-edit-btn--visible"
                  data-save-index="${index}"
                  type="button"
                  title="${escapeHtml(t("common.saveTitle"))}"
                >${escapeHtml(t("common.saveAction"))}</button>
              `
              : `
                <span class="conversation-item-title" title="${escapeHtml(title)}">${escapeHtml(displayTitle)}</span>
              `;
          return `
            <article class="conversation-item ${index === activeHistoryIndex ? "active" : ""}" data-history-index="${index}">
              <span class="conversation-icon">
                ${renderProviderIcon(
                  synthesisFriend?.name || item.synthesisModel,
                  synthesisFriend?.provider ||
                    modelConfigs.find((entry) => entry.name === item.synthesisModel)?.provider ||
                    "",
                  synthesisFriend?.name?.slice(0, 2).toUpperCase() ||
                    item.synthesisModel?.slice(0, 2).toUpperCase() ||
                    "AI",
                  synthesisFriend?.avatar ||
                    modelConfigs.find((entry) => entry.name === item.synthesisModel)?.avatar ||
                    ""
                )}
              </span>
              <div class="conversation-item-body">
                <div class="conversation-item-line">${titleMarkup}</div>
                <div class="conversation-item-meta">${escapeHtml(meta)}</div>
                <p class="conversation-item-preview" title="${escapeHtml(preview)}">${escapeHtml(preview)}</p>
              </div>
              <div class="conversation-item-actions">
                ${
                  item.pinned
                    ? `<span class="conversation-pin-badge" title="${escapeHtml(
                        t("common.pinAction")
                      )}">PIN</span>`
                    : ""
                }
                <button
                  class="conversation-item-more ${expandedHistoryIndex === index ? "conversation-item-more--visible" : ""}"
                  data-menu-index="${index}"
                  type="button"
                  aria-label="${escapeHtml(t("common.renameTitle"))}"
                  title="${escapeHtml(t("common.renameTitle"))}"
                >&#8943;</button>
                <div class="conversation-item-menu" ${expandedHistoryIndex === index ? "" : "hidden"}>
                  <button class="conversation-item-menu-action" data-menu-action="rename" data-menu-index="${index}" type="button">${escapeHtml(
                    t("common.renameAction")
                  )}</button>
                  <button class="conversation-item-menu-action" data-menu-action="pin" data-menu-index="${index}" type="button">${escapeHtml(
                    t(item.pinned ? "common.unpinAction" : "common.pinAction")
                  )}</button>
                  <button class="conversation-item-menu-action conversation-item-menu-action--has-submenu" data-menu-action="export" data-menu-index="${index}" type="button">${escapeHtml(
                    t("common.exportAction")
                  )} &#9656;</button>
                  <div class="conversation-item-submenu" data-submenu-for="${index}" hidden>
                    <button class="conversation-item-menu-action" data-menu-action="export-html" data-menu-index="${index}" type="button">${escapeHtml(
                      t("common.exportHtml")
                    )}</button>
                    <button class="conversation-item-menu-action" data-menu-action="export-image" data-menu-index="${index}" type="button">${escapeHtml(
                      t("common.exportImage")
                    )}</button>
                    <button class="conversation-item-menu-action" data-menu-action="export-pdf" data-menu-index="${index}" type="button">${escapeHtml(
                      t("common.exportPdf")
                    )}</button>
                  </div>
                  <button class="conversation-item-menu-action conversation-item-menu-action-danger" data-menu-action="delete" data-menu-index="${index}" type="button">${escapeHtml(
                    t("common.deleteAction")
                  )}</button>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
      return `
        <section class="conversation-group">
          <p class="conversation-group-label">${escapeHtml(t(`common.${group.key}`))}</p>
          <div class="conversation-group-items">${itemsHtml}</div>
        </section>
      `;
    })
    .join("");

  if (editingHistoryIndex !== null) {
    requestAnimationFrame(() => {
      const input = conversationList.querySelector(`[data-title-input="${editingHistoryIndex}"]`);
      input?.focus();
      input?.select();
    });
  }
}

function renderHistory() {
  if (!historyList) return;
  const items = getHistoryItems();
  if (!items.length) {
    historyList.innerHTML = `<article class="history-item"><strong>${escapeHtml(
      t("common.noHistoryTitle")
    )}</strong><p>${escapeHtml(t("common.noHistoryCopy"))}</p></article>`;
    return;
  }

  historyList.innerHTML = items
    .map((item) => {
      const synthesisFriend = getSessionSynthesisFriend(item);
      const participants = getConversationParticipants(item);
      const meta = formatMetaParts([
        item.timestamp,
        item.preferredPlatformName || "",
        `${participants.length || item.models?.length || 0} ${t("common.friendUnit")}`,
        synthesisFriend?.name || item.synthesisModel || "",
        getRuntimeLabel(item.runtimeMode)
      ]);
      return `
        <article class="history-item">
          <div class="history-item-top">
            <span class="history-item-icon">
              ${renderProviderIcon(
                synthesisFriend?.name || item.synthesisModel,
                synthesisFriend?.provider ||
                  modelConfigs.find((entry) => entry.name === item.synthesisModel)?.provider ||
                  "",
                synthesisFriend?.name?.slice(0, 2).toUpperCase() ||
                  item.synthesisModel?.slice(0, 2).toUpperCase() ||
                  "AI",
                synthesisFriend?.avatar ||
                  modelConfigs.find((entry) => entry.name === item.synthesisModel)?.avatar ||
                  ""
              )}
            </span>
            <strong>${escapeHtml(getConversationTitle(item))}</strong>
          </div>
          <div class="history-meta">${escapeHtml(meta)}</div>
          <p>${escapeHtml(item.prompt || "")}</p>
        </article>
      `;
    })
    .join("");
}

function renderMessageStream() {
  if (!messageStream) return;
  const userName = currentLanguage === "zh-CN" ? "\u6211" : "You";

  // Toggle workspace stage copy visibility based on conversation state
  const workspaceStage = document.querySelector(".workspace-stage-copy");
  if (workspaceStage) {
    workspaceStage.classList.toggle("is-hidden", currentConversation.length > 0);
  }

  // Toggle suggestion row visibility based on conversation state
  const suggestionRow = document.querySelector(".suggestion-row");
  if (suggestionRow) {
    suggestionRow.classList.toggle("is-hidden", currentConversation.length > 0);
  }

  // Toggle between full chat header and compact ⚙ button
  const hasMessages = currentConversation.length > 0;
  const chatHeader = document.getElementById("chat-header");
  const chatHeaderCompact = document.getElementById("chat-header-compact");
  if (chatHeader) chatHeader.classList.toggle("is-hidden", hasMessages);
  if (chatHeaderCompact) chatHeaderCompact.classList.toggle("is-hidden", !hasMessages);

  // Remove empty state as soon as conversation has messages
  if (currentConversation.length > 0) {
    const emptyState = messageStream.querySelector(".stream-empty-state");
    if (emptyState) emptyState.remove();
  }

  if (!currentConversation.length) {
    // Preserve the React #chat-root mount point
    Array.from(messageStream.children).forEach((child) => {
      if (child.id !== "chat-root") child.remove();
    });
    const emptyState = document.createElement("div");
    emptyState.className = "stream-empty-state";
    emptyState.innerHTML = `
      <div class="stream-empty-mark">OC</div>
      <strong class="stream-empty-title">${escapeHtml(
        currentLanguage === "zh-CN"
          ? "\u4eca\u5929\u6709\u4ec0\u4e48\u53ef\u4ee5\u5e2e\u5230\u4f60\uff1f"
          : "What can I help you with today?"
      )}</strong>
      <p class="stream-empty-copy">${escapeHtml(t("home.heroCopy"))}</p>
    `;
    messageStream.insertBefore(emptyState, messageStream.firstChild);
    renderedMessageElements.clear();
    scrollMessageStreamToBottom();
    return;
  }

  // Track which messages are currently in the conversation
  const currentMessageIds = new Set(currentConversation.map((item) => item.messageId));

// Remove elements for messages that no longer exist
  for (const [messageId, element] of renderedMessageElements.entries()) {
    if (!currentMessageIds.has(messageId)) {
      element.remove();
      renderedMessageElements.delete(messageId);
    }
  }

  // Process each message in current conversation
  currentConversation.forEach((item, index) => {
    const existingElement = renderedMessageElements.get(item.messageId);

    if (!existingElement) {
      // Create new message card using MessageCard component
      const card = MessageCard(item, {
        userName: currentLanguage === "zh-CN" ? "我" : "You",
        synthesisLabel: currentLanguage === "zh-CN" ? "整合" : "Merged",
        currentLanguage,
        onCopy: () => copyMessageToClipboard(item)
      });

      // Insert at correct position (maintain order), skipping #chat-root
      const nonReactChildren = Array.from(messageStream.children).filter((c) => c.id !== "chat-root");
      const nextElement = nonReactChildren[index];
      if (nextElement) {
        messageStream.insertBefore(card, nextElement);
      } else {
        const chatRoot = document.getElementById("chat-root");
        if (chatRoot) {
          messageStream.insertBefore(card, chatRoot);
        } else {
          messageStream.appendChild(card);
        }
      }

      renderedMessageElements.set(item.messageId, card);
    } else {
      // Sync content/loading onto .streamdown-target
      const contentNode = existingElement.querySelector(".streamdown-target");
      if (contentNode) {
        contentNode.dataset.content = item.content || "";
        contentNode.dataset.loading = String(Boolean(item.isLoading));
      } else {
        console.debug("[Render] .streamdown-target NOT FOUND for", item.messageId);
      }

      // Remove skeleton loader once content arrives OR generation is done
      if (item.content || !item.isLoading) {
        const skeleton = existingElement.querySelector(".ai-card-loading");
        if (skeleton) skeleton.remove();
      }

      // Update thinking section — create if missing, update if present
      if (item.thinking) {
        const thinkingNode = existingElement.querySelector(".think-content");
        if (thinkingNode) {
          thinkingNode.textContent = item.thinking;
        } else {
          // Dynamically create ThinkingBlock when thinking arrives during streaming
          const bubble = existingElement.querySelector(".message-bubble");
          if (bubble && !bubble.querySelector(".ai-bubble-thinking")) {
            const thinkingSection = Components.h("div", { className: "ai-bubble-thinking" }, [
              Components.ThinkingBlock({ thinking: item.thinking })
            ]);
            bubble.insertBefore(thinkingSection, bubble.firstChild);
          }
        }
      }

      // Update loading state in header
      const roleBadge = existingElement.querySelector(".message-role");
      if (roleBadge) {
        const isGenerating = item.isLoading;
        const currentText = roleBadge.textContent;
        const targetText = isGenerating ? "\u751F\u6210\u4E2D" : "AI \u7FA4\u53CB";
        if (currentText !== targetText) {
          roleBadge.textContent = targetText;
          roleBadge.classList.toggle("message-role--loading", isGenerating);
        }
      }

      // Add copy button when streaming completes (cards created with isLoading:true lack it)
      if (!item.isLoading && item.kind !== "user") {
        const messageHead = existingElement.querySelector(".message-head");
        if (messageHead && !messageHead.querySelector(".message-actions")) {
          const actionsDiv = Components.h("div", { className: "message-actions" }, [
            Components.CopyButton({
              onCopy: () => copyMessageToClipboard(item),
              label: currentLanguage === "zh-CN" ? "复制" : "Copy"
            })
          ]);
          messageHead.appendChild(actionsDiv);
        }
      }
    }
  });

  renderAiMessageMarkdown(messageStream);
  scrollMessageStreamToBottom();
}

function renderModelToggleGrid() {
  if (!modelToggleGrid) return;
  modelToggleGrid.innerHTML = getOrderedModelConfigs()
    .map(
      (item) => `
        <label class="model-toggle ${item.enabled ? "active" : ""}" data-id="${escapeHtml(item.id)}">
          <input type="checkbox" value="${escapeHtml(item.id)}" ${item.enabled ? "checked" : ""} />
          <span class="model-toggle-body">
            <span class="model-toggle-icon">${renderProviderIcon(
              item.name,
              item.provider,
              item.name.slice(0, 2).toUpperCase(),
              item.avatar
            )}</span>
            <span>
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.description || item.model)}</small>
            </span>
          </span>
          <span class="toggle-state">${escapeHtml(item.enabled ? t("common.enabled") : t("common.disabled"))}</span>
        </label>
      `
    )
    .join("");
}

function renderConfigGrid() {
  if (!configGrid) return;
  configGrid.innerHTML = getOrderedModelConfigs()
    .map(
      (item) => {
        const testState = modelTestState[item.id] || {};
        const testMessage = testState.message
          ? `<p class="config-test-status ${escapeHtml(testState.status || "")}">${escapeHtml(testState.message)}</p>`
          : "";
        const providerOptions = [...new Set([...PROVIDER_OPTIONS, item.provider].filter(Boolean))]
          .map(
            (provider) =>
              `<option value="${escapeHtml(provider)}" ${
                provider === item.provider ? "selected" : ""
              }>${escapeHtml(provider)}</option>`
          )
          .join("");
        return `
        <article class="config-card" data-id="${escapeHtml(item.id)}">
          <div class="config-card-brand">
            <button
              class="config-card-icon config-card-avatar-button"
              type="button"
              data-action="upload-avatar"
              data-id="${escapeHtml(item.id)}"
              title="${escapeHtml(t("common.uploadAvatar"))}"
              aria-label="${escapeHtml(t("common.uploadAvatar"))}"
            >
              ${renderProviderIcon(
                item.name,
                item.provider,
                item.name.slice(0, 2).toUpperCase(),
                item.avatar
              )}
            </button>
            <input
              class="config-avatar-input"
              data-avatar-input="${escapeHtml(item.id)}"
              type="file"
              accept="image/*"
              hidden
            />
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <p>${escapeHtml(item.description || item.provider)}</p>
            </div>
          </div>
          <div class="config-form">
            <label class="field-label">${escapeHtml(t("common.fieldDisplayName"))}</label>
            <input class="text-input" data-field="name" value="${escapeHtml(item.name)}" />
            <label class="field-label">${escapeHtml(t("common.fieldProvider"))}</label>
            <select class="inline-select" data-field="provider">${providerOptions}</select>
            <label class="field-label">${escapeHtml(t("common.fieldModelId"))}</label>
            <input class="text-input" data-field="model" value="${escapeHtml(item.model)}" />
            <label class="field-label">${escapeHtml(t("common.fieldBaseUrl"))}</label>
            <input class="text-input" data-field="baseUrl" value="${escapeHtml(item.baseUrl)}" />
            <label class="field-label">${escapeHtml(t("common.fieldApiKey"))}</label>
            <input class="text-input" data-field="apiKey" value="${escapeHtml(item.apiKey || "")}" />
            <label class="field-checkbox-row">
              <input type="checkbox" data-field="thinkingEnabled" ${item.thinkingEnabled ? "checked" : ""} />
              <span>${escapeHtml(t("common.fieldThinking"))}</span>
            </label>
          </div>
          ${testMessage}
          <div class="config-card-actions">
            <button class="ghost-button" data-action="test" type="button">${escapeHtml(
              testState.status === "pending" ? t("common.testing") : t("common.testConfig")
            )}</button>
            <button class="ghost-button" data-action="copy" type="button">${escapeHtml(
              t("common.copy")
            )}</button>
            <button class="ghost-button" data-action="toggle" type="button">${escapeHtml(
              item.enabled ? t("common.disable") : t("common.enable")
            )}</button>
            <button class="ghost-button" data-action="delete" type="button">${escapeHtml(
              t("common.delete")
            )}</button>
            <button class="primary-button" data-action="save" type="button">${escapeHtml(
              t("common.saveConfig")
            )}</button>
          </div>
        </article>
      `;
      }
    )
    .join("");
}

function renderFriendGrid() {
  if (!friendGrid) return;
  if (!friendProfiles.length) {
    friendGrid.innerHTML = `<article class="history-item"><strong>${escapeHtml(
      t("common.noFriendsTitle")
    )}</strong><p>${escapeHtml(t("common.noFriendsCopy"))}</p></article>`;
    return;
  }
  friendGrid.innerHTML = friendProfiles
    .map((friend) => {
      const boundModel = getModelConfigById(friend.modelConfigId);
      const selectOptions = getOrderedModelConfigs()
        .map(
          (model) =>
            `<option value="${escapeHtml(model.id)}" ${
              model.id === friend.modelConfigId ? "selected" : ""
            }>${escapeHtml(model.name)}</option>`
        )
        .join("");
      const isDisabled = friend.enabled === false;
      const statusBadge = isDisabled
        ? `<span class="friend-status-badge friend-status-disabled">${escapeHtml(t("common.statusDisabled"))}</span>`
        : `<span class="friend-status-badge friend-status-enabled">${escapeHtml(t("common.statusEnabled"))}</span>`;
      return `
        <article class="config-card${isDisabled ? " config-card-disabled" : ""}" data-friend-id="${escapeHtml(friend.id)}">
          <div class="config-card-brand">
            <button
              class="config-card-icon config-card-avatar-button"
              type="button"
              data-friend-action="upload-avatar"
              data-friend-id="${escapeHtml(friend.id)}"
              title="${escapeHtml(t("common.uploadAvatar"))}"
              aria-label="${escapeHtml(t("common.uploadAvatar"))}"
            >
              ${renderProviderIcon(
                friend.name,
                boundModel?.provider || "",
                friend.name.slice(0, 2).toUpperCase(),
                friend.avatar || boundModel?.avatar || ""
              )}
            </button>
            <input
              class="config-avatar-input"
              data-friend-avatar-input="${escapeHtml(friend.id)}"
              type="file"
              accept="image/*"
              hidden
            />
            <div class="friend-card-meta">
              <div>
                <strong>${escapeHtml(friend.name)}</strong>
                <span>${escapeHtml(friend.description || boundModel?.name || "")}</span>
              </div>
              <div class="friend-card-chips">
                <span class="friend-model-chip">${escapeHtml(boundModel?.name || "")}</span>
                ${statusBadge}
                ${friend.isIntegrationExpert ? `<span class="friend-status-badge friend-status-expert">${escapeHtml(t("common.integrationExpertBadge"))}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="config-form">
            <label class="field-label">${escapeHtml(t("common.fieldDisplayName"))}</label>
            <input class="text-input" data-friend-field="name" value="${escapeHtml(friend.name)}" />
            <label class="field-label">${escapeHtml(t("common.fieldBoundModel"))}</label>
            <select class="inline-select" data-friend-field="modelConfigId">${selectOptions}</select>
            <label class="field-label">${escapeHtml(t("common.fieldSystemPrompt"))}</label>
            <div class="prompt-template-row">
              <select class="inline-select prompt-template-select" data-friend-template-select="${escapeHtml(friend.id)}">
                <option value="">${escapeHtml(t("common.promptTemplatePlaceholder"))}</option>
                ${promptTemplates.map((tpl) => `<option value="${escapeHtml(tpl.id)}">${escapeHtml(tpl.name)}</option>`).join("")}
              </select>
              <button class="ghost-button prompt-template-save-btn" type="button" data-friend-template-save="${escapeHtml(friend.id)}">${escapeHtml(t("common.promptTemplateSave"))}</button>
              <button class="ghost-button prompt-template-delete-btn" type="button" data-friend-template-delete="${escapeHtml(friend.id)}">${escapeHtml(t("common.promptTemplateDelete"))}</button>
            </div>
            <textarea data-friend-field="systemPrompt" rows="6">${escapeHtml(friend.systemPrompt || "")}</textarea>
            <label class="field-label">${escapeHtml(t("common.fieldDescription"))}</label>
            <input class="text-input" data-friend-field="description" value="${escapeHtml(friend.description || "")}" />
          </div>
          <div class="config-card-toggles">
            <label class="friend-expert-toggle">
              <input type="checkbox" data-friend-field="isIntegrationExpert" ${friend.isIntegrationExpert ? "checked" : ""} />
              <span>${escapeHtml(t("common.integrationExpert"))}</span>
            </label>
          </div>
          <div class="config-card-actions">
            <button class="ghost-button" data-friend-action="toggle" type="button">${escapeHtml(
              friend.enabled ? t("common.disable") : t("common.enable")
            )}</button>
            <button class="ghost-button" data-friend-action="delete" type="button">${escapeHtml(
              t("common.deleteFriend")
            )}</button>
            <button class="primary-button" data-friend-action="save" type="button">${escapeHtml(
              t("common.saveFriend")
            )}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function bootstrapDefaultFriendsIfMissing() {
  if (runtimeMode !== "frontend") return;
  if (friendProfiles.length > 0) return;
  if (shouldBootstrapDefaultFriends(localStorage.getItem(getScopedStorageKey(STORAGE_KEYS.friends)), modelConfigs)) {
    friendProfiles = createDefaultFriendProfiles(modelConfigs);
    saveFriendProfiles();
    defaultGroupSettings = normalizeGroupSettings(createDefaultGroupSettings(friendProfiles), friendProfiles);
    saveDefaultGroupSettings();
    currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
    draftGroupSettings = cloneGroupSettings(defaultGroupSettings);
  }
}

function renderAccount() {
  renderUserBar();
  if (accountEmail && accountName) {
    const account = getAccount();
    accountEmail.value = account?.email || "";
    accountName.value = account?.name || "";
  }
}

function syncModelConfigsToBackend() {
  if (runtimeMode !== "backend") return Promise.resolve();
  return apiRequest("/api/models", {
    method: "POST",
    body: JSON.stringify({ models: modelConfigs })
  }).catch(handleBackendSyncError);
}

function syncFriendProfilesToBackend() {
  if (runtimeMode !== "backend") return Promise.resolve();
  return apiRequest("/api/friends", {
    method: "POST",
    body: JSON.stringify({ friends: friendProfiles })
  }).catch(handleBackendSyncError);
}

function syncGroupSettingsToBackend() {
  if (runtimeMode !== "backend") return Promise.resolve();
  return apiRequest("/api/group-settings", {
    method: "POST",
    body: JSON.stringify({ groupSettings: defaultGroupSettings })
  }).catch(handleBackendSyncError);
}

function updateModelConfigById(id, patch = {}) {
  modelConfigs = modelConfigs.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function updateFriendProfileById(id, patch = {}) {
  friendProfiles = friendProfiles.map((item) => (item.id === id ? { ...item, ...patch } : item));
  reconcileGroupStates();
}

function deleteFriendProfileById(id) {
  friendProfiles = friendProfiles.filter((item) => item.id !== id);
  defaultGroupSettings.memberIds = defaultGroupSettings.memberIds.filter((item) => item !== id);
  if (defaultGroupSettings.synthesisFriendId === id) {
    defaultGroupSettings.synthesisFriendId = defaultGroupSettings.memberIds[0] || null;
  }
  currentConversationGroupSettings.memberIds = currentConversationGroupSettings.memberIds.filter(
    (item) => item !== id
  );
  if (currentConversationGroupSettings.synthesisFriendId === id) {
    currentConversationGroupSettings.synthesisFriendId =
      currentConversationGroupSettings.memberIds[0] || null;
  }
  draftGroupSettings.memberIds = draftGroupSettings.memberIds.filter((item) => item !== id);
  if (draftGroupSettings.synthesisFriendId === id) {
    draftGroupSettings.synthesisFriendId = draftGroupSettings.memberIds[0] || null;
  }
  reconcileGroupStates();
}

function focusConfigCardIfNeeded() {
  if (!pendingConfigFocusId || !configGrid) return;
  const targetId = pendingConfigFocusId;
  pendingConfigFocusId = null;
  requestAnimationFrame(() => {
    const card = configGrid.querySelector(`[data-id="${targetId}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const nameInput = card.querySelector('[data-field="name"]');
    nameInput?.focus();
    nameInput?.select();
  });
}

function focusFriendCardIfNeeded() {
  if (!pendingFriendFocusId || !friendGrid) return;
  const targetId = pendingFriendFocusId;
  pendingFriendFocusId = null;
  requestAnimationFrame(() => {
    const card = friendGrid.querySelector(`[data-friend-id="${targetId}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const nameInput = card.querySelector('[data-friend-field="name"]');
    nameInput?.focus();
    nameInput?.select();
  });
}

async function saveConversationTitle(index, nextTitle) {
  const history = getHistoryItems();
  const session = history[index];
  if (!session) return;
  const trimmed = String(nextTitle || "").trim();
  session.title = trimmed || String(session.prompt || "").trim() || t("common.untitledConversation");
  session.updatedAt = new Date().toISOString();
  saveHistoryItems(history);
  await syncHistoryToBackend(history).catch(handleBackendSyncError);
  editingHistoryIndex = null;
  renderConversationList();
  renderHistory();
}

async function toggleConversationPin(index) {
  const history = getHistoryItems();
  const session = history[index];
  if (!session) return;
  session.pinned = !session.pinned;
  session.updatedAt = new Date().toISOString();
  const [nextSession] = history.splice(index, 1);
  history.unshift(nextSession);
  saveHistoryItems(history);
  await syncHistoryToBackend(history).catch(handleBackendSyncError);
  activeHistoryIndex = findHistoryIndexById(nextSession.id);
  expandedHistoryIndex = null;
  renderConversationList();
  renderHistory();
}

async function exportConversation(index, format) {
  const history = getHistoryItems();
  const session = history[index];
  if (!session) return;
  const title = getConversationTitle(session);
  const messages = buildConversationFromSession(session);
  const exportOptions = {
    title,
    userName: currentLanguage === "zh-CN" ? "\u6211" : "You",
    synthesisLabel: currentLanguage === "zh-CN" ? "\u6574\u5408" : "Merged"
  };

  try {
    if (format === "html") {
      exportToHtml(messages, exportOptions);
      setRuntimeStatus(t("common.exportSuccess"));
    } else if (format === "image") {
      await exportToImage(messages, exportOptions);
      setRuntimeStatus(t("common.exportSuccess"));
    } else if (format === "pdf") {
      exportToPdf(messages, exportOptions);
    }
  } catch (err) {
    console.error("Export failed:", err);
    setRuntimeStatus(t("common.exportFailed"));
  }
  expandedHistoryIndex = null;
  renderConversationList();
}

/**
 * Copy a single message to clipboard
 * @param {Object} message - Message object with content
 */
/**
 * Copy text to clipboard using fallback method
 * @param {string} text - Text to copy
 * @returns {boolean} - Success status
 */
function copyTextFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

async function copyMessageToClipboard(message) {
  const textToCopy = String(message.content || "");
  if (!textToCopy.trim()) return;

  let success = false;

  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      success = true;
    } else {
      // Fallback for non-secure contexts
      success = copyTextFallback(textToCopy);
    }

    if (success) {
      setRuntimeStatus(currentLanguage === "zh-CN" ? "已复制到剪贴板" : "Copied to clipboard");
    } else {
      setRuntimeStatus(currentLanguage === "zh-CN" ? "复制失败" : "Copy failed");
    }
  } catch (err) {
    console.error("Failed to copy:", err);
    setRuntimeStatus(currentLanguage === "zh-CN" ? "复制失败" : "Copy failed");
  }
}

async function deleteConversation(index) {
  const history = getHistoryItems();
  const session = history[index];
  if (!session) return;
  history.splice(index, 1);
  saveHistoryItems(history);
  await syncHistoryToBackend(history).catch(handleBackendSyncError);
  if (activeConversationId === session.id) {
    currentConversation = [];
    activeConversationId = null;
    activeHistoryIndex = null;
    currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
    draftGroupSettings = cloneGroupSettings(defaultGroupSettings);
    if (promptInput) {
      promptInput.value = "";
      autosizePromptInput();
    }
    renderMessageStream();
  } else if (activeHistoryIndex !== null) {
    activeHistoryIndex = findHistoryIndexById(activeConversationId);
  }
  editingHistoryIndex = null;
  expandedHistoryIndex = null;
  renderConversationList();
  renderModelSummary();
  renderSynthesisOptions();
  renderGroupSettingsPanel();
  renderHistory();
  setRuntimeStatus(t("common.deletedConversation"));
}

function findHistoryIndexById(id) {
  if (!id) return -1;
  return getHistoryItems().findIndex((item) => item.id === id);
}

function loadConversationByIndex(index, { focus = false } = {}) {
  const history = getHistoryItems();
  const session = history[index];
  if (!session) return;
  activeHistoryIndex = index;
  activeConversationId = session.id || null;
  editingHistoryIndex = null;
  expandedHistoryIndex = null;
  currentConversation = buildConversationFromSession(session);
  currentConversationGroupSettings = normalizeGroupSettings(
    session.groupSettingsSnapshot ||
      (Array.isArray(session.friendIds)
        ? {
            memberIds: session.friendIds,
            synthesisFriendId: session.synthesisFriendId || null,
            sharedSystemPromptEnabled: false,
            sharedSystemPrompt: ""
          }
        : defaultGroupSettings),
    friendProfiles
  );
  draftGroupSettings = cloneGroupSettings(currentConversationGroupSettings);
  if (promptInput) {
    promptInput.value = "";
    autosizePromptInput();
  }
  if (synthModelSelect) {
    synthModelSelect.value =
      currentConversationGroupSettings.synthesisFriendId || session.synthesisFriendId || "";
  }
  setRuntimeStatus(
    t("common.completed", {
      count: getConversationParticipants(session).length || session.models?.length || 0
    })
  );
  if (session.groupSettingsSnapshot?.preferredPlatform) {
    currentConversationGroupSettings.preferredPlatform = session.groupSettingsSnapshot.preferredPlatform;
    draftGroupSettings.preferredPlatform = session.groupSettingsSnapshot.preferredPlatform;
  }
  if (typeof session.groupSettingsSnapshot?.platformFeatureEnabled === "boolean") {
    currentConversationGroupSettings.platformFeatureEnabled = session.groupSettingsSnapshot.platformFeatureEnabled;
    draftGroupSettings.platformFeatureEnabled = session.groupSettingsSnapshot.platformFeatureEnabled;
  }
  renderConversationList();
  renderModelSummary();
  renderSynthesisOptions();
  renderGroupSettingsPanel();
  renderMessageStream();
  if (focus) promptInput?.focus();
}

function persistConversation({
  prompt,
  activeFriends,
  synthesisFriend,
  mergedAnswer,
  disagreements,
  createdAt,
  results
}) {
  const history = getHistoryItems();
  const existingIndex = findHistoryIndexById(activeConversationId);
  const baseId = activeConversationId || createConversationId();
  const now = new Date().toISOString();
  const preferredPlatform =
    currentConversationGroupSettings.platformFeatureEnabled && getPreferredPlatformOption(currentConversationGroupSettings);
  const nextSession = {
    id: baseId,
    title:
      existingIndex >= 0
        ? history[existingIndex].title || getConversationTitle({ prompt: history[existingIndex].prompt || prompt })
        : getConversationTitle({ prompt }),
    prompt,
    models: activeFriends.map((item) => item.modelConfigName || item.name),
    friendIds: activeFriends.map((item) => item.id),
    synthesisFriendId: synthesisFriend?.id || null,
    synthesisModel: synthesisFriend?.name || "",
    preferredPlatformId: preferredPlatform?.id || "",
    preferredPlatformName: preferredPlatform?.name || "",
    runtimeMode,
    createdAt: existingIndex >= 0 ? history[existingIndex].createdAt || createdAt : createdAt,
    updatedAt: now,
    timestamp: new Date(now).toLocaleString(currentLanguage === "zh-CN" ? "zh-CN" : "en-US"),
    responses: results,
    mergedAnswer,
    disagreements,
    friendsSnapshot: activeFriends.map((item) => buildFriendSnapshot(item)),
    groupSettingsSnapshot: cloneGroupSettings(currentConversationGroupSettings),
    messages: serializeConversation(currentConversation)
  };

  if (existingIndex >= 0) {
    history.splice(existingIndex, 1);
  }
  history.unshift(nextSession);
  saveHistoryItems(history);
  syncHistoryToBackend(history).catch(handleBackendSyncError);
  activeConversationId = nextSession.id;
  activeHistoryIndex = 0;
  renderConversationList();
  renderHistory();
}

async function loadBackendState() {
  if (runtimeMode !== "backend") return;
  try {
    const [accountData, modelData, friendData, groupSettingsData, conversationData, templateData] = await Promise.all([
      apiRequest("/api/account"),
      apiRequest("/api/models"),
      apiRequest("/api/friends"),
      apiRequest("/api/group-settings"),
      apiRequest("/api/conversations"),
      apiRequest("/api/prompt-templates")
    ]);
    if (accountData.account) {
      writeJson(STORAGE_KEYS.account, normalizeLocalAccount(accountData.account));
    }
    if (Array.isArray(modelData.models) && modelData.models.length) {
      modelConfigs = normalizeModelConfigs(modelData.models);
      writeScopedJson(STORAGE_KEYS.models, modelConfigs);
    }
    if (Array.isArray(friendData.friends) && friendData.friends.length) {
      friendProfiles = normalizeFriendProfiles(friendData.friends, modelConfigs);
      writeScopedJson(STORAGE_KEYS.friends, friendProfiles);
    }
    if (groupSettingsData.groupSettings) {
      defaultGroupSettings = normalizeGroupSettings(groupSettingsData.groupSettings, friendProfiles);
      writeScopedJson(STORAGE_KEYS.groupSettings, defaultGroupSettings);
      currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
      draftGroupSettings = cloneGroupSettings(defaultGroupSettings);
    }
    if (Array.isArray(conversationData.conversations)) {
      saveHistoryItems(conversationData.conversations);
    }
    if (Array.isArray(templateData.promptTemplates)) {
      promptTemplates = templateData.promptTemplates;
      writeScopedJson(STORAGE_KEYS.promptTemplates, promptTemplates);
    }
    reconcileGroupStates();
    defaultGroupSettings = normalizeGroupSettings(defaultGroupSettings, friendProfiles);
    currentConversationGroupSettings = normalizeGroupSettings(currentConversationGroupSettings, friendProfiles);
    draftGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);
    if (activeConversationId) {
      const nextIndex = findHistoryIndexById(activeConversationId);
      if (nextIndex >= 0) {
        loadConversationByIndex(nextIndex);
      } else {
        activeConversationId = null;
        activeHistoryIndex = null;
        currentConversation = [];
      }
    }
  } catch (error) {
    console.warn("Failed to load backend state:", error);
    runtimeMode = "frontend";
    localStorage.setItem(STORAGE_KEYS.runtime, runtimeMode);
    setRuntimeStatus(t("common.backendLoadFailed"));
  }
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-title-key]").forEach((node) => {
    node.textContent = t(node.dataset.titleKey);
  });
  document.querySelectorAll(".suggestion-card[data-suggestion-index]").forEach((node) => {
    const index = Number(node.dataset.suggestionIndex);
    node.textContent = t(`home.suggestion${index + 1}`);
  });
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === currentLanguage);
  });
  const langToggle = document.getElementById("lang-toggle");
  if (langToggle) {
    langToggle.dataset.lang = currentLanguage;
    const knob = langToggle.querySelector(".lang-toggle-knob");
    if (knob) knob.textContent = currentLanguage === "zh-CN" ? "ZH" : "EN";
  }
  document.title = t(
    document.querySelector("title[data-title-key]")?.dataset.titleKey || "titles.workspace"
  );
}

function rerenderAll() {
  reconcileGroupStates();
  renderRuntime();
  renderModelSummary();
  renderSynthesisOptions();
  renderGroupSettingsPanel();
  renderModelToggleGrid();
  renderConfigGrid();
  focusConfigCardIfNeeded();
  renderFriendGrid();
  focusFriendCardIfNeeded();
  renderAccount();
  renderHistory();
  renderConversationList();
  renderMessageStream();
}

async function saveAccount({ email, name, fromModal = false }) {
  if (!email || !name) {
    if (fromModal && modalAccountError) {
      modalAccountError.textContent = t("common.accountRequired");
      modalAccountError.hidden = false;
    }
    return;
  }

  const previousScopedHistory = getHistoryItems();
  const nextAccount = { email, name };
  if (runtimeMode === "backend") {
    const data = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(nextAccount)
    });
    writeJson(STORAGE_KEYS.account, normalizeLocalAccount(data.account || nextAccount));
  } else {
    writeJson(STORAGE_KEYS.account, normalizeLocalAccount(nextAccount));
  }

  if (runtimeMode === "frontend") {
    reloadScopedLocalState();
    if (!getHistoryItems().length && previousScopedHistory.length) {
      saveHistoryItems(previousScopedHistory);
    }
    await loadLocalModelConfigFile();
  }

  renderAccount();
  rerenderAll();
  if (modalAccountError) modalAccountError.hidden = true;
  if (loginModal) loginModal.hidden = true;
}

async function runWorkflow(options = {}) {
  if (!promptInput || isRunning) return;
  const history = getHistoryItems();
  const activeSession =
    activeHistoryIndex !== null && activeHistoryIndex >= 0 ? history[activeHistoryIndex] : null;
  const replaceCurrent = Boolean(options.replaceCurrent);
  const prompt = promptInput.value.trim() || activeSession?.prompt?.trim() || "";
  let activeFriends = resolveConversationFriends();

  // Handle expert-only mode
  const expertOnlyMode = Boolean(expertOnlyToggle?.checked);
  const integrationExpertIds = currentConversationGroupSettings.integrationExpertIds || [];
  // Integration experts are excluded from memberIds/activeFriends by design,
  // so resolve them directly from friend profiles (same as synthesis friend resolution).
  const resolvedExpertFriends = integrationExpertIds
    .map((id) => getFriendById(id))
    .filter((f) => f && f.enabled !== false && f.isIntegrationExpert)
    .map((profile) => {
      const model = getModelConfigById(profile.modelConfigId);
      return {
        ...profile,
        modelConfigName: model?.name || "",
        provider: model?.provider || "",
        model: model?.model || "",
        baseUrl: model?.baseUrl || "",
        apiKey: model?.apiKey || "",
        thinkingEnabled: Boolean(model?.thinkingEnabled),
        modelAvatar: model?.avatar || ""
      };
    })
    .filter((f) => f.modelConfigName);
  const expertFriends = resolvedExpertFriends;
  const nonExpertFriends = activeFriends.filter((f) => !integrationExpertIds.includes(f.id));

  // If expert-only mode, only include expert friends
  if (expertOnlyMode && resolvedExpertFriends.length > 0) {
    activeFriends = resolvedExpertFriends;
  }

  const preflightState = getWorkflowPreflightState({
    prompt,
    friendProfiles,
    activeFriends
  });

  if (preflightState === "missing_friends") {
    setRuntimeStatus(t("common.needExistingFriends"));
    return;
  }
  if (preflightState === "missing_active_friends") {
    setRuntimeStatus(t("common.needUsableFriends"));
    return;
  }
  if (preflightState === "missing_prompt") {
    setRuntimeStatus(t("common.needPrompt"));
    return;
  }

  if (promptInput.value.trim() !== prompt) {
    promptInput.value = prompt;
    autosizePromptInput();
  }

  isRunning = true;
  setRuntimeStatus(t("common.running", { count: activeFriends.length }));

  // Auto-hide group settings panel when user starts chatting
  if (isGroupSettingsOpen) {
    isGroupSettingsOpen = false;
    isGroupMemberDetailsOpen = false;
    renderGroupSettingsPanel();
  }

  const runId = createConversationId();
  const createdAt = new Date().toISOString();

  // Determine if we should show synthesis (only if synthesisEnabled)
  // Integration experts are excluded from activeFriends/memberIds,
  // so resolve the synthesis friend directly from friend profiles.
  const isSynthesisEnabled = Boolean(currentConversationGroupSettings.synthesisEnabled);
  const synthesisFriendId = synthModelSelect?.value || currentConversationGroupSettings.synthesisFriendId;
  let synthesisFriend = null;
  if (isSynthesisEnabled && synthesisFriendId) {
    const profile = getFriendById(synthesisFriendId);
    if (profile && profile.isIntegrationExpert && profile.enabled !== false) {
      const model = getModelConfigById(profile.modelConfigId);
      synthesisFriend = {
        ...profile,
        modelConfigName: model?.name || "",
        provider: model?.provider || "",
        model: model?.model || "",
        baseUrl: model?.baseUrl || "",
        apiKey: model?.apiKey || "",
        thinkingEnabled: Boolean(model?.thinkingEnabled)
      };
    }
  }
  // If no active regular friends to synthesize, skip synthesis
  if (synthesisFriend && activeFriends.length === 0) {
    synthesisFriend = null;
  }
  // In expert-only mode, expert responds directly — skip synthesis
  if (expertOnlyMode && synthesisFriend) {
    synthesisFriend = null;
  }

  const platformContext = getPlatformRoutingContext(currentConversationGroupSettings);
  const platformPromptAddon = buildPlatformPromptAddon(platformContext);
  if (synthesisFriend) {
    currentConversationGroupSettings.synthesisFriendId = synthesisFriend.id;
  }
  const userMessage = normalizeConversationMessage(
    { role: "user", kind: "user", content: prompt, createdAt },
    createdAt
  );
  userMessage.runId = runId;

  // Separate friends into experts and non-experts for sequential processing
  const currentExpertFriends = expertOnlyMode ? [] : expertFriends.filter((f) => activeFriends.some((af) => af.id === f.id));
  const currentNonExpertFriends = expertOnlyMode ? [] : nonExpertFriends.filter((f) => activeFriends.some((af) => af.id === f.id));
  const friendsToRespondFirst = expertOnlyMode ? activeFriends : currentNonExpertFriends;
  const expertFriendsToRespond = expertOnlyMode ? [] : currentExpertFriends;

  const friendPlaceholders = activeFriends.map((friend) => {
    const message = normalizeConversationMessage(
      {
        role: "assistant",
        kind: "model",
        friendId: friend.id,
        name: friend.name,
        avatar: friend.avatar || friend.modelAvatar || "",
        modelConfigId: friend.modelConfigId,
        modelConfigName: friend.modelConfigName,
        provider: friend.provider,
        model: friend.model,
        createdAt,
        isLoading: true
      },
      createdAt
    );
    message.runId = runId;
    return message;
  });

  // Only create synthesis placeholder if there are integration experts
  let synthesisPlaceholder = null;
  if (synthesisFriend) {
    synthesisPlaceholder = normalizeConversationMessage(
      {
        role: "assistant",
        kind: "synthesis",
        friendId: synthesisFriend.id,
        name: `${synthesisFriend.name} ${t("common.synthesis")}`,
        avatar: synthesisFriend.avatar || synthesisFriend.modelAvatar || "",
        modelConfigId: synthesisFriend.modelConfigId,
        modelConfigName: synthesisFriend.modelConfigName,
        provider: synthesisFriend.provider,
        model: synthesisFriend.model,
        createdAt,
        isLoading: true
      },
      createdAt
    );
    synthesisPlaceholder.runId = runId;
  }

  const previousConversation = replaceCurrent ? [...currentConversation] : null;
  if (replaceCurrent) {
    currentConversation = [];
  }
  currentConversation = currentConversation.concat(
    userMessage,
    ...friendPlaceholders
  );
  renderMessageStream();

  // Clear the input after the message has been captured and rendered
  promptInput.value = "";
  autosizePromptInput();

  let results = [];
  let mergedAnswer = buildFallbackSynthesis({ prompt, language: currentLanguage, results: [] });
  let disagreements = [t("common.d1"), t("common.d2"), t("common.d3")];

  try {
    if (runtimeMode === "backend") {
      const friendIdToMessageId = new Map(
        friendPlaceholders.flatMap((item) => [
          [item.friendId, item.messageId],
          [item.name, item.messageId]
        ])
      );
      // Build condensed conversation history for the backend
      const conversationHistory = currentConversation
        .filter((msg) => msg.runId !== runId && !msg.isLoading && msg.content)
        .map((msg) => ({
          role: msg.role,
          kind: msg.kind,
          friendId: msg.friendId || "",
          content: msg.content
        }));

      await apiRunWorkflowStream(
        {
          prompt,
          language: currentLanguage,
          conversationHistory,
          friends: activeFriends.map((friend) => ({
            id: friend.id,
            name: friend.name,
            avatar: friend.avatar || friend.modelAvatar || "",
            modelConfigId: friend.modelConfigId,
            modelConfigName: friend.modelConfigName,
            provider: friend.provider,
            model: friend.model,
            baseUrl: friend.baseUrl,
            apiKey: friend.apiKey,
            systemPrompt:
              `${
                currentConversationGroupSettings.sharedSystemPromptEnabled
                  ? currentConversationGroupSettings.sharedSystemPrompt
                  : friend.systemPrompt
              }${platformPromptAddon}`.trim()
          })),
          groupSettings: cloneGroupSettings(currentConversationGroupSettings)
        },
        {
          onEvent(event) {
            if (event.type === "friend_thinking_delta" || event.type === "model_thinking_delta") {
              const id =
                friendIdToMessageId.get(event.friendId) || friendIdToMessageId.get(event.modelName);
              if (!id) return;
              const current = currentConversation.find((item) => item.messageId === id);
              updateConversationMessageById(id, {
                thinking: `${current?.thinking || ""}${event.delta || ""}`
              });
              renderMessageStream();
              return;
            }
            if (event.type === "friend_content_delta" || event.type === "model_content_delta") {
              const id =
                friendIdToMessageId.get(event.friendId) || friendIdToMessageId.get(event.modelName);
              if (!id) return;
              const current = currentConversation.find((item) => item.messageId === id);
              updateConversationMessageById(id, {
                content: `${current?.content || ""}${event.delta || ""}`
              });
              renderMessageStream();
              return;
            }
            if (event.type === "friend_done" || event.type === "model_done") {
              const id =
                friendIdToMessageId.get(event.friendId) || friendIdToMessageId.get(event.modelName);
              if (!id) return;
              updateConversationMessageById(id, {
                source: event.source || "",
                isLoading: false
              });
              renderMessageStream();
              renderSynthesisOptions();
              return;
            }
            if (event.type === "synthesis_delta") {
              // Add synthesis placeholder to conversation on first synthesis delta
              if (synthesisPlaceholder && !currentConversation.some((m) => m.messageId === synthesisPlaceholder.messageId)) {
                currentConversation.push(synthesisPlaceholder);
              }
              const current = currentConversation.find(
                (item) => item.messageId === synthesisPlaceholder.messageId
              );
              updateConversationMessageById(synthesisPlaceholder.messageId, {
                content: `${current?.content || ""}${event.delta || ""}`
              });
              renderMessageStream();
              return;
            }
            if (event.type === "done") {
              results = Array.isArray(event.results) ? event.results : [];
              mergedAnswer = event.mergedAnswer || mergedAnswer;
              disagreements = Array.isArray(event.disagreements) ? event.disagreements : disagreements;
              // Add synthesis placeholder if not yet added (e.g. no synthesis_delta was sent)
              if (synthesisPlaceholder && !currentConversation.some((m) => m.messageId === synthesisPlaceholder.messageId)) {
                currentConversation.push(synthesisPlaceholder);
              }
              if (synthesisPlaceholder) {
                updateConversationMessageById(synthesisPlaceholder.messageId, {
                  content: mergedAnswer,
                  isLoading: false
                });
              }
              renderMessageStream();
            }
          }
        }
      );
    } else {
      // Build friendId to messageId mapping
      const friendIdToMessageId = new Map(
        friendPlaceholders.map((item) => [item.friendId, item.messageId])
      );

      // Sequential processing: non-experts first, then experts
      let nonExpertResults = [];
      let expertResults = [];

      // Phase 1: Run non-expert friends first (if not in expert-only mode)
      if (!expertOnlyMode && friendsToRespondFirst.length > 0) {
        nonExpertResults = await Promise.all(
          friendsToRespondFirst.map((friend) => {
            const targetId = friendIdToMessageId.get(friend.id);
            return generateFrontendFriendResponse(friend, prompt, platformContext, targetId, runId);
          })
        );

        // Update non-expert messages
        for (const result of nonExpertResults) {
          const targetId = friendIdToMessageId.get(result.friendId);
          if (targetId) {
            updateConversationMessageById(targetId, {
              source: result.source,
              error: result.error || "",
              isLoading: false
            });
          }
        }
        renderMessageStream();
      }

      // Phase 2: Run expert friends with context from non-experts
      if (expertFriendsToRespond.length > 0) {
        // Build context from non-expert responses
        const contextFromNonExperts = nonExpertResults.map((r) => ({
          name: r.name,
          content: r.content || ""
        }));

        expertResults = await Promise.all(
          expertFriendsToRespond.map((friend) => {
            const targetId = friendIdToMessageId.get(friend.id);
            // For experts, include non-expert responses in the prompt
            const expertPrompt = nonExpertResults.length > 0
              ? `${prompt}\n\n其他群友的回答：\n${contextFromNonExperts.map((c) => `【${c.name}】: ${c.content}`).join("\n\n")}`
              : prompt;
            return generateFrontendFriendResponse(friend, expertPrompt, platformContext, targetId, runId);
          })
        );

        // Update expert messages
        for (const result of expertResults) {
          const targetId = friendIdToMessageId.get(result.friendId);
          if (targetId) {
            updateConversationMessageById(targetId, {
              source: result.source,
              error: result.error || "",
              isLoading: false
            });
          }
        }
        renderMessageStream();
      }

      // Combine results
      results = [...nonExpertResults, ...expertResults];

      // If in expert-only mode, just run all active friends
      if (expertOnlyMode) {
        results = await Promise.all(
          activeFriends.map((friend) => {
            const targetId = friendIdToMessageId.get(friend.id);
            return generateFrontendFriendResponse(friend, prompt, platformContext, targetId, runId);
          })
        );

        for (const result of results) {
          const targetId = friendIdToMessageId.get(result.friendId);
          if (targetId) {
            updateConversationMessageById(targetId, {
              source: result.source,
              error: result.error || "",
              isLoading: false
            });
          }
        }
        renderMessageStream();
      }

      // Only run synthesis AFTER all friends have completed
      if (synthesisFriend && synthesisPlaceholder) {
        // Add synthesis placeholder to conversation now (after all friends done)
        currentConversation.push(synthesisPlaceholder);
        renderMessageStream();

        const synthesisResult = await generateFrontendSynthesisResponse(
          synthesisFriend,
          prompt,
          results,
          platformContext,
          synthesisPlaceholder.messageId
        );
        mergedAnswer = synthesisResult.content;
        // Final update for synthesis (source/error state)
        updateConversationMessageById(synthesisPlaceholder.messageId, {
          source: synthesisResult.source,
          error: synthesisResult.error || "",
          isLoading: false
        });
        renderMessageStream();
      }
    }

    persistConversation({
      prompt,
      activeFriends,
      synthesisFriend,
      mergedAnswer,
      disagreements,
      createdAt,
      results
    });
    setRuntimeStatus(t("common.completed", { count: activeFriends.length + (synthesisFriend ? 1 : 0) }));
  } catch (error) {
    if (replaceCurrent && previousConversation) {
      currentConversation = previousConversation;
    } else {
      removeMessagesByRunId(runId);
    }
    renderMessageStream();
    setRuntimeStatus(error.message);
  } finally {
    isRunning = false;
  }
}

function bindLanguageControls() {
  document.querySelectorAll(".lang-button").forEach((button) => {
    button.addEventListener("click", () => {
      currentLanguage = button.dataset.lang;
      localStorage.setItem(STORAGE_KEYS.language, currentLanguage);
      applyLanguage();
      rerenderAll();
    });
  });

  const langToggle = document.getElementById("lang-toggle");
  if (!langToggle) return;
  langToggle.addEventListener("click", () => {
    currentLanguage = currentLanguage === "zh-CN" ? "en" : "zh-CN";
    localStorage.setItem(STORAGE_KEYS.language, currentLanguage);
    applyLanguage();
    rerenderAll();
  });
}

function bindPageSidebarToggle() {
  const btn = document.getElementById("sidebar-collapse-btn");
  const layout = document.querySelector(".page-layout");
  if (!btn || !layout) return;
  const STORAGE_KEY = "openchat-sidebar-collapsed";
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === "1";
  if (isCollapsed) layout.classList.add("sidebar-collapsed");
  const updateLabel = () => {
    const labelEl = btn.querySelector(".sidebar-nav-label");
    if (labelEl) {
      const collapsed = layout.classList.contains("sidebar-collapsed");
      labelEl.setAttribute("data-i18n", collapsed ? "common.expandSidebar" : "common.collapseSidebar");
      labelEl.textContent = t(collapsed ? "common.expandSidebar" : "common.collapseSidebar");
    }
  };
  updateLabel();
  btn.addEventListener("click", () => {
    layout.classList.toggle("sidebar-collapsed");
    const collapsed = layout.classList.contains("sidebar-collapsed");
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    updateLabel();
  });
}

function bindWorkspaceEvents() {
  // Think block toggle button text update
  messageStream?.addEventListener("toggle", (event) => {
    const thinkBlock = event.target.closest(".think-block");
    if (!thinkBlock) return;
    const btn = thinkBlock.querySelector(".think-toggle-btn");
    if (!btn) return;
    const isOpen = thinkBlock.hasAttribute("open");
    btn.textContent = isOpen
      ? (t("common.hideThinking") || "Hide")
      : (t("common.showThinking") || "View");
  });

  document.querySelectorAll(".suggestion-card").forEach((button, index) => {
    button.addEventListener("click", () => {
      if (!promptInput) return;
      const prompts =
        currentLanguage === "zh-CN"
          ? [
              "\u51b7\u6c34\u771f\u7684\u80fd\u591a\u6d88\u8017\u70ed\u91cf\u5417\uff1f\u8bf7\u5bf9\u6bd4\u7b54\u6848\u8d28\u91cf\u3001\u4fe1\u5fc3\u5ea6\u4e0e\u4e0d\u786e\u5b9a\u6027\u3002",
              "\u8fdc\u7a0b\u529e\u516c\u6bd4\u5750\u73ed\u66f4\u597d\u5417\uff1f\u8bf7\u5bf9\u6bd4\u53d6\u820d\u548c\u6700\u5f3a\u8bba\u70b9\u3002",
              "\u5b66\u4e60\u4e00\u95e8\u65b0\u8bed\u8a00\u7684\u6700\u4f73\u65b9\u5f0f\u662f\u4ec0\u4e48\uff1f\u8bf7\u5bf9\u6bd4\u65b9\u6cd5\u3001\u7ea6\u675f\u548c\u5408\u7406\u8282\u594f\u3002"
            ]
          : [
              "Does cold water burn more calories? Compare answer quality, confidence, and uncertainty.",
              "Is remote work better than office work? Compare tradeoffs and strongest arguments.",
              "Best way to learn a new language? Compare methods, constraints, and realistic pacing."
            ];
      promptInput.value = prompts[index] || "";
      autosizePromptInput();
      promptInput.focus();
    });
  });

  runWorkflowButton?.addEventListener("click", () => {
    runWorkflow();
  });
  rerollSynthesisButton?.addEventListener("click", () => {
    runWorkflow({ replaceCurrent: true });
  });
  synthModelSelect?.addEventListener("change", () => {
    currentConversationGroupSettings.synthesisFriendId = synthModelSelect.value || null;
    renderSynthesisOptions();
    renderGroupSettingsPanel();
  });

  promptInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    runWorkflow();
  });
  promptInput?.addEventListener("input", autosizePromptInput);

  newChatButton?.addEventListener("click", () => {
    currentConversation = [];
    activeConversationId = null;
    activeHistoryIndex = null;
    editingHistoryIndex = null;
    expandedHistoryIndex = null;
    currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
    draftGroupSettings = cloneGroupSettings(defaultGroupSettings);
    isGroupSettingsOpen = false;
    if (expertOnlyToggle) {
      expertOnlyToggle.checked = false;
    }
    if (promptInput) {
      promptInput.value = "";
      autosizePromptInput();
      promptInput.focus();
    }
    setRuntimeStatus(t("home.ready"));
    renderConversationList();
    renderModelSummary();
    renderSynthesisOptions();
    renderGroupSettingsPanel();
    renderMessageStream();
  });

  expertOnlyToggle?.addEventListener("change", () => {
    if (expertOnlyToggle.checked) {
      // Validate before enabling
      const hasConversation = currentConversation.length > 0;
      const allFriendsDone = hasConversation && currentConversation
        .filter((m) => m.kind === "model" && !m.isSynthesis)
        .every((m) => !m.isLoading);
      const hasExpert = getEnabledFriends().some((f) => f.isIntegrationExpert);

      if (!hasConversation) {
        expertOnlyToggle.checked = false;
        setRuntimeStatus(t("common.expertOnlyNeedMessage"));
        return;
      }
      if (!allFriendsDone) {
        expertOnlyToggle.checked = false;
        setRuntimeStatus(t("common.expertOnlyNeedAllDone"));
        return;
      }
      if (!hasExpert) {
        expertOnlyToggle.checked = false;
        setRuntimeStatus(t("common.expertOnlyNeedExpert"));
        return;
      }
    }
    currentConversationGroupSettings.expertOnlyMode = Boolean(expertOnlyToggle.checked);
    renderSynthesisOptions();
  });

  function handleGroupSettingsToggle() {
    isGroupSettingsOpen = !isGroupSettingsOpen;
    draftGroupSettings = cloneGroupSettings(currentConversationGroupSettings);
    if (!isGroupSettingsOpen) {
      isGroupMemberDetailsOpen = false;
    }
    renderGroupSettingsPanel();
  }

  groupSettingsToggleButton?.addEventListener("click", handleGroupSettingsToggle);
  document.getElementById("group-settings-toggle-compact")?.addEventListener("click", handleGroupSettingsToggle);

  groupSettingsCloseButton?.addEventListener("click", () => {
    isGroupSettingsOpen = false;
    isGroupMemberDetailsOpen = false;
    renderGroupSettingsPanel();
  });

  groupMemberPicker?.addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-group-member-toggle]");
    if (!toggleButton) return;
    event.stopPropagation();
    isGroupMemberDetailsOpen = !isGroupMemberDetailsOpen;
    renderGroupSettingsPanel();
  });

  groupMemberPicker?.addEventListener("change", (event) => {
    const input = event.target.closest("[data-group-member-id]");
    if (!input) return;
    const { groupMemberId } = input.dataset;
    if (!groupMemberId) return;
    if (input.checked) {
      if (!draftGroupSettings.memberIds.includes(groupMemberId)) {
        draftGroupSettings.memberIds.push(groupMemberId);
      }
    } else {
      draftGroupSettings.memberIds = draftGroupSettings.memberIds.filter((id) => id !== groupMemberId);
    }
    draftGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);
    // Defer re-render so the browser finishes processing the checkbox toggle
    // before we replace the DOM; avoids a re-render mid-event that can reset
    // the checkbox in some browsers.
    requestAnimationFrame(() => renderGroupSettingsPanel());
  });

  groupSharedToggle?.addEventListener("change", () => {
    draftGroupSettings.sharedSystemPromptEnabled = Boolean(groupSharedToggle.checked);
    renderGroupSettingsPanel();
  });

  groupSharedPrompt?.addEventListener("input", () => {
    draftGroupSettings.sharedSystemPrompt = groupSharedPrompt.value;
  });

  groupPlatformToggle?.addEventListener("change", () => {
    draftGroupSettings.platformFeatureEnabled = Boolean(groupPlatformToggle.checked);
    renderGroupSettingsPanel();
  });

  groupPlatformSelect?.addEventListener("change", () => {
    draftGroupSettings.preferredPlatform = groupPlatformSelect.value || PLATFORM_OPTIONS[0]?.id || "gemini";
    renderGroupSettingsPanel();
  });

  groupSynthesisToggle?.addEventListener("change", () => {
    draftGroupSettings.synthesisEnabled = groupSynthesisToggle.checked;
    renderGroupSettingsPanel();
  });

  groupSynthesisSelect?.addEventListener("change", () => {
    draftGroupSettings.synthesisFriendId = groupSynthesisSelect.value || null;
  });

  applyGroupSettingsButton?.addEventListener("click", () => {
    currentConversationGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);
    isGroupSettingsOpen = false;
    renderModelSummary();
    renderSynthesisOptions();
    renderGroupSettingsPanel();
    setRuntimeStatus(t("common.conversationGroupApplied"));
  });

  saveDefaultGroupSettingsButton?.addEventListener("click", async () => {
    defaultGroupSettings = normalizeGroupSettings(draftGroupSettings, friendProfiles);
    saveDefaultGroupSettings();
    await syncGroupSettingsToBackend();
    currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
    isGroupSettingsOpen = false;
    rerenderAll();
    setRuntimeStatus(t("common.groupSettingsSaved"));
  });

  conversationList?.addEventListener("click", (event) => {
    const menuButton = event.target.closest("[data-menu-index]");
    if (menuButton && !event.target.closest("[data-menu-action]")) {
      event.stopPropagation();
      const index = Number(menuButton.dataset.menuIndex);
      expandedHistoryIndex = expandedHistoryIndex === index ? null : index;
      renderConversationList();
      return;
    }

    const menuAction = event.target.closest("[data-menu-action]");
    if (menuAction) {
      event.stopPropagation();
      const index = Number(menuAction.dataset.menuIndex);
      const action = menuAction.dataset.menuAction;
      if (action === "rename") {
        editingHistoryIndex = index;
        expandedHistoryIndex = null;
        renderConversationList();
        return;
      }
      if (action === "pin") {
        void toggleConversationPin(index);
        return;
      }
      if (action === "export") {
        const submenu = menuAction.closest(".conversation-item-menu")?.querySelector(`[data-submenu-for="${index}"]`);
        if (submenu) {
          submenu.hidden = !submenu.hidden;
        }
        return;
      }
      if (action === "export-html") {
        void exportConversation(index, "html");
        return;
      }
      if (action === "export-image") {
        void exportConversation(index, "image");
        return;
      }
      if (action === "export-pdf") {
        void exportConversation(index, "pdf");
        return;
      }
      if (action === "delete") {
        void deleteConversation(index);
        return;
      }
    }

    const saveButton = event.target.closest("[data-save-index]");
    if (saveButton) {
      event.stopPropagation();
      const index = Number(saveButton.dataset.saveIndex);
      const input = conversationList.querySelector(`[data-title-input="${index}"]`);
      void saveConversationTitle(index, input?.value);
      return;
    }

    if (event.target.closest("[data-title-input]")) return;

    const item = event.target.closest("[data-history-index]");
    if (!item) return;
    expandedHistoryIndex = null;
    loadConversationByIndex(Number(item.dataset.historyIndex), { focus: true });
  });

  conversationList?.addEventListener("keydown", (event) => {
    const input = event.target.closest("[data-title-input]");
    if (!input) return;
    const index = Number(input.dataset.titleInput);
    if (event.key === "Enter") {
      event.preventDefault();
      void saveConversationTitle(index, input.value);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      editingHistoryIndex = null;
      renderConversationList();
    }
  });

  conversationList?.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-history-index]");
    if (!item) return;
    editingHistoryIndex = Number(item.dataset.historyIndex);
    expandedHistoryIndex = null;
    renderConversationList();
  });
}

function bindSettingsEvents() {
  // Theme settings
  document.querySelectorAll(".theme-setting-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.dataset.theme);
    });
  });

  // Font size settings - slider and number input
  const fontSizeSlider = document.getElementById("font-size-slider");
  const fontSizeInput = document.getElementById("font-size-input");

  if (fontSizeSlider) {
    fontSizeSlider.addEventListener("input", (e) => {
      applyFontSize(e.target.value);
    });
  }

  if (fontSizeInput) {
    fontSizeInput.addEventListener("input", (e) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 10 && value <= 24) {
        applyFontSize(value);
      }
    });

    fontSizeInput.addEventListener("blur", (e) => {
      // Clamp value on blur
      let value = parseInt(e.target.value, 10);
      if (isNaN(value)) value = 14;
      value = Math.max(10, Math.min(24, value));
      applyFontSize(value);
    });
  }

  runtimeModeToggle?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-runtime]");
    if (!button) return;
    await switchRuntimeMode(button.dataset.runtime).catch((error) => {
      console.warn(error);
      setRuntimeStatus(t("common.backendLoadFailed"));
    });
    rerenderAll();
    await ensureFrontendAccess();
  });

  modelToggleGrid?.addEventListener("change", async (event) => {
    const input = event.target.closest('input[type="checkbox"]');
    if (!input) return;
    modelConfigs = modelConfigs.map((item) =>
      item.id === input.value ? { ...item, enabled: input.checked } : item
    );
    writeJson(STORAGE_KEYS.models, modelConfigs);
    if (runtimeMode === "backend") {
      await apiRequest("/api/models", {
        method: "POST",
        body: JSON.stringify({ models: modelConfigs })
      }).catch(handleBackendSyncError);
    }
    rerenderAll();
  });

  configGrid?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-id]");
    const id = button.dataset.id || card?.dataset.id;
    if (!id) return;

    if (button.dataset.action === "upload-avatar") {
      const input = configGrid.querySelector(`[data-avatar-input="${id}"]`);
      input?.click();
      return;
    }

    if (button.dataset.action === "test") {
      await runModelConnectionTest(id, card);
      return;
    }

    if (button.dataset.action === "copy") {
      const current = modelConfigs.find((item) => item.id === id);
      if (!current) return;
      const newConfig = {
        ...current,
        id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: current.name + t("common.copySuffix"),
        enabled: true
      };
      modelConfigs.push(newConfig);
      saveModelConfigs();
      await syncModelConfigsToBackend();
      rerenderAll();
      return;
    }

    if (button.dataset.action === "toggle") {
      updateModelConfigById(id, {
        enabled: !modelConfigs.find((item) => item.id === id)?.enabled
      });
    } else if (button.dataset.action === "delete") {
      const confirmed = await showConfirm(
        t("common.confirmDelete") || "Are you sure you want to delete this model?",
        t("common.confirmTitle") || "Confirm Delete"
      );
      if (confirmed) {
        modelConfigs = modelConfigs.filter((item) => item.id !== id);
        saveModelConfigs();
        await syncModelConfigsToBackend();
        rerenderAll();
      }
      return;
    } else {
      const current = modelConfigs.find((item) => item.id === id);
      if (!current) return;
      updateModelConfigById(id, {
        name: card.querySelector('[data-field="name"]')?.value.trim() || current.name,
        provider: card.querySelector('[data-field="provider"]')?.value.trim() || current.provider,
        model: card.querySelector('[data-field="model"]')?.value.trim() || current.model,
        baseUrl: card.querySelector('[data-field="baseUrl"]')?.value.trim() || current.baseUrl,
        apiKey: card.querySelector('[data-field="apiKey"]')?.value.trim() || current.apiKey,
        thinkingEnabled: Boolean(card.querySelector('[data-field="thinkingEnabled"]')?.checked)
      });
    }

    saveModelConfigs();
    await syncModelConfigsToBackend();
    rerenderAll();
  });

  configGrid?.addEventListener("change", async (event) => {
    const providerSelect = event.target.closest('[data-field="provider"]');
    if (providerSelect) {
      const card = providerSelect.closest("[data-id]");
      const id = card?.dataset.id;
      if (!id) return;
      const current = modelConfigs.find((item) => item.id === id);
      if (!current) return;
      const nextProvider = providerSelect.value.trim() || current.provider;
      const preset = PROVIDER_PRESETS[nextProvider];
      const shouldUpdateBaseUrl =
        !current.baseUrl ||
        current.baseUrl === PROVIDER_PRESETS[current.provider]?.baseUrl ||
        current.baseUrl === "https://api.example.com/v1";
      const shouldUpdateModel =
        !current.model ||
        current.model === PROVIDER_PRESETS[current.provider]?.model ||
        current.model === "custom-model-id";

      updateModelConfigById(id, {
        provider: nextProvider,
        ...(shouldUpdateBaseUrl && preset?.baseUrl ? { baseUrl: preset.baseUrl } : {}),
        ...(shouldUpdateModel && preset?.model ? { model: preset.model } : {})
      });
      saveModelConfigs();
      await syncModelConfigsToBackend();
      rerenderAll();
      return;
    }

    const input = event.target.closest("[data-avatar-input]");
    if (!input?.files?.length) return;
    const [file] = input.files;
    const id = input.dataset.avatarInput;
    if (!id || !file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      updateModelConfigById(id, { avatar: String(reader.result || "") });
      saveModelConfigs();
      await syncModelConfigsToBackend();
      rerenderAll();
    };
    reader.readAsDataURL(file);
    input.value = "";
  });

  addCustomModelButton?.addEventListener("click", () => {
    const nextModel = createCustomModelConfig();
    modelConfigs = [
      {
      ...nextModel
      },
      ...modelConfigs
    ];
    pendingConfigFocusId = nextModel.id;
    saveModelConfigs();
    rerenderAll();
  });

  testEnabledModelsButton?.addEventListener("click", async () => {
    const cards = Array.from(configGrid?.querySelectorAll("[data-id]") || []);
    for (const card of cards) {
      const id = card.dataset.id;
      const item = modelConfigs.find((entry) => entry.id === id);
      if (!id || !item?.enabled) continue;
      await runModelConnectionTest(id, card);
    }
  });
}

function bindFriendEvents() {
  friendGrid?.addEventListener("click", async (event) => {
    // Template save button
    const saveBtn = event.target.closest("[data-friend-template-save]");
    if (saveBtn) {
      const friendId = saveBtn.dataset.friendTemplateSave;
      const card = friendGrid.querySelector(`[data-friend-id="${friendId}"]`);
      const textarea = card?.querySelector('[data-friend-field="systemPrompt"]');
      const content = textarea?.value || "";
      if (!content.trim()) return;
      const name = await showPrompt(t("common.promptTemplateNamePlaceholder"));
      if (!name || !name.trim()) return;
      promptTemplates = [{
        id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        content
      }, ...promptTemplates];
      savePromptTemplates();
      await syncPromptTemplatesToBackend();
      rerenderAll();
      return;
    }

    // Template delete button
    const deleteBtn = event.target.closest("[data-friend-template-delete]");
    if (deleteBtn) {
      const friendId = deleteBtn.dataset.friendTemplateDelete;
      const card = friendGrid.querySelector(`[data-friend-id="${friendId}"]`);
      const select = card?.querySelector("[data-friend-template-select]");
      const selectedId = select?.value;
      if (!selectedId) return;
      promptTemplates = promptTemplates.filter((tpl) => tpl.id !== selectedId);
      savePromptTemplates();
      await syncPromptTemplatesToBackend();
      rerenderAll();
      return;
    }

    const button = event.target.closest("[data-friend-action]");
    if (!button) return;
    const card = button.closest("[data-friend-id]");
    const id = button.dataset.friendId || card?.dataset.friendId;
    if (!id) return;

    if (button.dataset.friendAction === "upload-avatar") {
      const input = friendGrid.querySelector(`[data-friend-avatar-input="${id}"]`);
      input?.click();
      return;
    }

    if (button.dataset.friendAction === "toggle") {
      const friend = getFriendById(id);
      if (!friend) return;
      updateFriendProfileById(id, { enabled: !friend.enabled });
      saveFriendProfiles();
      saveDefaultGroupSettings();
      await Promise.all([syncFriendProfilesToBackend(), syncGroupSettingsToBackend()]);
      rerenderAll();
      return;
    }

    if (button.dataset.friendAction === "delete") {
      deleteFriendProfileById(id);
      saveFriendProfiles();
      saveDefaultGroupSettings();
      await Promise.all([syncFriendProfilesToBackend(), syncGroupSettingsToBackend()]);
      rerenderAll();
      return;
    }

    const current = getFriendById(id);
    if (!current) return;
    const expertCheckbox = card.querySelector('[data-friend-field="isIntegrationExpert"]');
    updateFriendProfileById(id, {
      name: card.querySelector('[data-friend-field="name"]')?.value.trim() || current.name,
      modelConfigId:
        card.querySelector('[data-friend-field="modelConfigId"]')?.value.trim() || current.modelConfigId,
      systemPrompt:
        card.querySelector('[data-friend-field="systemPrompt"]')?.value ?? current.systemPrompt,
      description:
        card.querySelector('[data-friend-field="description"]')?.value.trim() || current.description,
      isIntegrationExpert: expertCheckbox ? expertCheckbox.checked : current.isIntegrationExpert,
    });
    saveFriendProfiles();
    saveDefaultGroupSettings();
    await Promise.all([syncFriendProfilesToBackend(), syncGroupSettingsToBackend()]);
    rerenderAll();
  });

  friendGrid?.addEventListener("change", async (event) => {
    // Template selection
    const templateSelect = event.target.closest("[data-friend-template-select]");
    if (templateSelect) {
      const templateId = templateSelect.value;
      if (!templateId) return;
      const template = promptTemplates.find((tpl) => tpl.id === templateId);
      if (!template) return;
      const card = templateSelect.closest("[data-friend-id]");
      if (!card) return;
      const textarea = card.querySelector('[data-friend-field="systemPrompt"]');
      if (textarea) textarea.value = template.content;
      return;
    }

    // Avatar file input
    const input = event.target.closest("[data-friend-avatar-input]");
    if (!input?.files?.length) return;
    const [file] = input.files;
    const id = input.dataset.friendAvatarInput;
    if (!id || !file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      updateFriendProfileById(id, { avatar: String(reader.result || "") });
      saveFriendProfiles();
      await syncFriendProfilesToBackend();
      rerenderAll();
    };
    reader.readAsDataURL(file);
    input.value = "";
  });

  addFriendButton?.addEventListener("click", async () => {
    const nextFriend = createFriendProfile();
    friendProfiles = [nextFriend, ...friendProfiles];
    defaultGroupSettings = normalizeGroupSettings(
      { ...defaultGroupSettings, memberIds: [nextFriend.id, ...defaultGroupSettings.memberIds] },
      friendProfiles
    );
    currentConversationGroupSettings = normalizeGroupSettings(
      { ...currentConversationGroupSettings, memberIds: [nextFriend.id, ...currentConversationGroupSettings.memberIds] },
      friendProfiles
    );
    draftGroupSettings = cloneGroupSettings(currentConversationGroupSettings);
    pendingFriendFocusId = nextFriend.id;
    saveFriendProfiles();
    saveDefaultGroupSettings();
    await Promise.all([syncFriendProfilesToBackend(), syncGroupSettingsToBackend()]);
    rerenderAll();
  });
}

function bindAccountEvents() {
  saveAccountButton?.addEventListener("click", async () => {
    await saveAccount({
      email: accountEmail?.value.trim(),
      name: accountName?.value.trim()
    }).catch((error) => {
      if (accountSummary) accountSummary.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
    });
  });

  modalSaveAccount?.addEventListener("click", async () => {
    await saveAccount({
      email: modalAccountEmail?.value.trim(),
      name: modalAccountName?.value.trim(),
      fromModal: true
    }).catch((error) => {
      if (modalAccountError) {
        modalAccountError.textContent = error.message;
        modalAccountError.hidden = false;
      }
    });
  });

  loginModalBackdrop?.addEventListener("click", () => {
    if (loginModal) loginModal.hidden = true;
  });
}

function bindHistoryEvents() {
  clearHistoryButton?.addEventListener("click", async () => {
    saveHistoryItems([]);
    await syncHistoryToBackend([]).catch(handleBackendSyncError);
    currentConversation = [];
    activeConversationId = null;
    activeHistoryIndex = null;
    editingHistoryIndex = null;
    currentConversationGroupSettings = cloneGroupSettings(defaultGroupSettings);
    draftGroupSettings = cloneGroupSettings(defaultGroupSettings);
    rerenderAll();
  });
}

function bindFrontendPasswordEvents() {
  document.addEventListener(
    "click",
    (event) => {
      guardFrontendAccess(event);
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      guardFrontendAccess(event);
    },
    true
  );

  document.addEventListener(
    "submit",
    (event) => {
      guardFrontendAccess(event);
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (!frontendAccessBlocked) return;
      if (frontendPasswordModal?.contains(event.target)) return;
      const allowedKeys = new Set(["Tab", "Escape"]);
      if (!allowedKeys.has(event.key)) {
        guardFrontendAccess(event);
      }
    },
    true
  );

  frontendPasswordSubmit?.addEventListener("click", async () => {
    if (!frontendPasswordHash) {
      updateFrontendPasswordError(t("common.frontendPasswordMissing"));
      return;
    }
    const password = frontendPasswordInput?.value || "";
    const passed = await validateFrontendPassword(password);
    if (!passed) {
      updateFrontendPasswordError(t("common.frontendPasswordInvalid"));
      return;
    }
    localStorage.setItem(STORAGE_KEYS.frontendAccess, frontendPasswordHash);
    updateFrontendPasswordError("");
    if (frontendPasswordInput) frontendPasswordInput.value = "";
    setFrontendPasswordModalVisible(false);
  });

  frontendPasswordInput?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    await frontendPasswordSubmit?.click();
  });

  frontendPasswordBackdrop?.addEventListener("click", (event) => {
    event.preventDefault();
  });
}

function bindUserMenu() {
  if (!userBarTrigger) return;
  userBarTrigger.addEventListener("click", (event) => {
    if (event.target.closest("#user-bar-more")) return;
    event.stopPropagation();
    const account = getAccount();
    if (!account) {
      if (loginModal) loginModal.hidden = false;
      return;
    }
    if (!userBarMenu) return;
    userBarMenu.hidden = !userBarMenu.hidden;
  });

  userBarMore?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!userBarMenu) return;
    userBarMenu.hidden = !userBarMenu.hidden;
  });

  userBarMenu?.addEventListener("click", (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href");
    if (!href) return;
    userBarMenu.hidden = true;
    window.location.assign(href);
  });

  document.addEventListener("click", (event) => {
    if (!userBarMenu || userBarMenu.hidden) return;
    if (userBarMenu.contains(event.target) || userBarTrigger.contains(event.target)) return;
    userBarMenu.hidden = true;
  });

  document.addEventListener("click", (event) => {
    if (expandedHistoryIndex === null) return;
    if (conversationList?.contains(event.target)) return;
    expandedHistoryIndex = null;
    renderConversationList();
  });

  document.addEventListener("click", (event) => {
    if (!isGroupSettingsOpen || !groupSettingsPanel || !groupSettingsToggleButton) return;
    const compactToggle = document.getElementById("group-settings-toggle-compact");
    if (
      groupSettingsPanel.contains(event.target) ||
      groupSettingsToggleButton.contains(event.target) ||
      compactToggle?.contains(event.target)
    ) {
      return;
    }
    isGroupSettingsOpen = false;
    renderGroupSettingsPanel();
  });
}

async function initializeApp() {
  // Load initial data in parallel for faster startup
  const loadPromises = [loadLocalModelConfigFile(), loadFrontendPasswordHash()];
  if (runtimeMode === "backend") {
    loadPromises.push(loadBackendState());
  }
  await Promise.all(loadPromises);

  bootstrapDefaultFriendsIfMissing();

  initTheme();
  initConfirmDialog();
  initPromptDialog();
  applyLanguage();
  renderAccount();
  renderRuntime();
  renderModelSummary();
  renderSynthesisOptions();

  // Ensure all models are enabled by default
  let modelsEnabled = false;
  modelConfigs = modelConfigs.map((m) => {
    if (!m.enabled) {
      m.enabled = true;
      modelsEnabled = true;
    }
    return m;
  });
  if (modelsEnabled) {
    saveModelConfigs();
  }

  renderModelToggleGrid();
  renderConfigGrid();
  renderFriendGrid();
  renderHistory();
  renderConversationList();

  if (messageStream && getHistoryItems().length) {
    loadConversationByIndex(0);
  } else {
    renderMessageStream();
  }

  if (!currentConversation.length) {
    setRuntimeStatus(t("home.ready"));
  }

  autosizePromptInput();
  bindLanguageControls();
  bindPageSidebarToggle();
  bindWorkspaceEvents();
  bindSettingsEvents();
  bindFriendEvents();
  bindAccountEvents();
  bindHistoryEvents();
  bindFrontendPasswordEvents();
  bindUserMenu();

  await ensureFrontendAccess();
}

initializeApp();

// Mount React chat component
if (typeof window !== 'undefined') {
  import('./chat-main.tsx').then(({ mountChat }) => {
    mountChat();
  }).catch(err => {
    console.error('[OpenChat] Failed to mount React chat:', err);
  });
}

