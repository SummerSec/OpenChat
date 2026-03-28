import { createServer } from "node:http";
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { getUsableFriendIds, syncDefaultFriendsWithModels } from "./friend-bootstrap-utils.mjs";
import { buildPromptAwareMergedAnswer, buildPromptAwareMockResponse } from "./mock-response-utils.mjs";
import { buildFallbackSynthesis, buildSynthesisPromptText } from "./synthesis-utils.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, ".data");
const DATA_FILE = path.join(DATA_DIR, "openchat-db.json");
const AI_SEARCH_HUB_DIR = path.join(__dirname, "vendor", "ai-search-hub");
const AI_SEARCH_HUB_RUNNER = path.join(AI_SEARCH_HUB_DIR, "scripts", "run_web_chat.py");
const AI_SEARCH_OUTPUT_DIR = path.join(DATA_DIR, "ai-search-hub");
const PORT = Number(process.env.PORT || 8787);
const execFile = promisify(execFileCallback);
const AI_SEARCH_PLATFORMS = new Set(["gemini", "grok", "doubao", "yuanbao", "longcat", "qwen", "minimaxi"]);

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

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function cloneDefaultModels() {
  return DEFAULT_MODELS.map((item) => ({ ...item }));
}

function getDefaultFriendSystemPrompt(name = "", language = "zh-CN") {
  return language === "zh-CN"
    ? `你是 AI 群友「${name || "群友"}」，请在群聊里用清晰、具体、可落地的方式回答，并保留自己的视角。`
    : `You are the AI group friend "${name || "Friend"}". Reply in the group chat with a clear, specific, action-oriented point of view.`;
}

function createDefaultFriends(models = cloneDefaultModels(), language = "zh-CN") {
  return models.map((model) => ({
    id: `friend-${model.id}`,
    name: model.name,
    avatar: model.avatar || "",
    modelConfigId: model.id,
    systemPrompt: getDefaultFriendSystemPrompt(model.name, language),
    enabled: true,
    description: model.description || ""
  }));
}

function createDefaultGroupSettings(friends = [], models = []) {
  const memberIds = getUsableFriendIds(friends, models);
  return {
    memberIds,
    sharedSystemPromptEnabled: false,
    sharedSystemPrompt: "",
    platformFeatureEnabled: false,
    preferredPlatform: "gemini",
    synthesisFriendId: memberIds[0] || null
  };
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function normalizeGroupSettings(settings = {}, friends = [], models = []) {
  const usableFriendIds = getUsableFriendIds(friends, models);
  let memberIds = Array.isArray(settings.memberIds)
    ? settings.memberIds.filter((id) => usableFriendIds.includes(id))
    : [...usableFriendIds];
  if (!memberIds.length && usableFriendIds.length) {
    memberIds = [usableFriendIds[0]];
  }
  return {
    memberIds,
    sharedSystemPromptEnabled: Boolean(settings.sharedSystemPromptEnabled),
    sharedSystemPrompt: String(settings.sharedSystemPrompt || ""),
    platformFeatureEnabled: Boolean(settings.platformFeatureEnabled),
    preferredPlatform: String(settings.preferredPlatform || "gemini"),
    synthesisFriendId:
      memberIds.find((id) => id === settings.synthesisFriendId) || memberIds[0] || null
  };
}

async function ensureDb() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await stat(DATA_FILE);
  } catch {
    const models = cloneDefaultModels();
    const friends = createDefaultFriends(models);
    await writeDb({
      account: null,
      models,
      friends,
      groupSettings: createDefaultGroupSettings(friends, models),
      conversations: []
    });
  }
}

async function readDb() {
  await ensureDb();
  const db = JSON.parse(await readFile(DATA_FILE, "utf8"));
  let changed = false;
  if (!Array.isArray(db.models) || !db.models.length) {
    db.models = cloneDefaultModels();
    changed = true;
  }
  if (!Array.isArray(db.friends) || !db.friends.length) {
    db.friends = createDefaultFriends(db.models);
    changed = true;
  } else {
    const syncedFriends = syncDefaultFriendsWithModels(db.friends, db.models, {
      getDefaultFriendSystemPrompt
    });
    if (JSON.stringify(syncedFriends) !== JSON.stringify(db.friends)) {
      db.friends = syncedFriends;
      changed = true;
    }
  }
  if (!db.groupSettings || typeof db.groupSettings !== "object") {
    db.groupSettings = createDefaultGroupSettings(db.friends, db.models);
    changed = true;
  } else {
    const normalized = normalizeGroupSettings(db.groupSettings, db.friends, db.models);
    if (JSON.stringify(normalized) !== JSON.stringify(db.groupSettings)) {
      db.groupSettings = normalized;
      changed = true;
    }
  }
  if (!Array.isArray(db.conversations)) {
    db.conversations = [];
    changed = true;
  }
  if (changed) {
    await writeDb(db);
  }
  return db;
}

async function writeDb(data) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(JSON.stringify(payload));
}

function sendNdjsonHeaders(res) {
  res.writeHead(200, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Content-Type": "application/x-ndjson; charset=utf-8"
  });
}

function writeNdjson(res, payload) {
  res.write(`${JSON.stringify(payload)}\n`);
}

async function streamChunks(res, baseEvent, text, chunkSize = 24, delayMs = 16) {
  const chunks = String(text || "").match(new RegExp(`.{1,${chunkSize}}`, "gs")) || [];
  for (const chunk of chunks) {
    writeNdjson(res, { ...baseEvent, delta: chunk });
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function mockResponseFor(friend, prompt, language = "zh-CN") {
  return buildPromptAwareMockResponse({
    friendName: friend.name,
    prompt,
    language,
    platformName: friend.preferredPlatform || "",
    platformCompany: "",
    platformStrengths: ""
  });
}

async function buildMergedAnswer(prompt = "", language = "zh-CN", synthesisFriend = null, results = [], groupSettings = {}) {
  const synthesisPrompt = buildSynthesisPromptText({ prompt, language, results });
  const systemPrompt = language === "zh-CN"
    ? `你负责整合多位 AI 群友的输出。请务必阅读 user_prompt 与 member_outputs，基于它们生成最终整合答案，而不是忽略群友内容重新独立作答。输出时先总结共识，再说明关键分歧，最后给出一版清晰可执行的最终回答。${buildPlatformPromptAddon(groupSettings, language)}`
    : `You are responsible for synthesizing multiple AI friend outputs. Read user_prompt and member_outputs carefully, then generate a final synthesis instead of answering independently from scratch. Summarize consensus first, then disagreements, and finish with a clear actionable answer.${buildPlatformPromptAddon(groupSettings, language)}`;

  if (!synthesisFriend?.apiKey || !synthesisFriend?.baseUrl) {
    return buildFallbackSynthesis({ prompt, language, results });
  }

  try {
    const provider = String(synthesisFriend.provider || "").toLowerCase();
    if (provider.includes("anthropic") || String(synthesisFriend.name || "").toLowerCase().includes("claude")) {
      const output = await callAnthropic(synthesisFriend, synthesisPrompt, systemPrompt);
      return output.content || buildFallbackSynthesis({ prompt, language, results });
    }
    if (provider.includes("google") || String(synthesisFriend.name || "").toLowerCase().includes("gemini")) {
      const output = await callGemini(synthesisFriend, synthesisPrompt, systemPrompt);
      return output.content || buildFallbackSynthesis({ prompt, language, results });
    }
    const output = await callOpenAICompatible(synthesisFriend, synthesisPrompt, systemPrompt);
    return output.content || buildFallbackSynthesis({ prompt, language, results });
  } catch {
    return buildFallbackSynthesis({ prompt, language, results });
  }
}

function buildDisagreements(language = "zh-CN") {
  return language === "zh-CN"
    ? [
        "有的群友更偏结构，有的群友更偏细节和谨慎表达。",
        "偏验证的群友会对未经证实的说法更保守。",
        "不同底层模型在风格、延迟和返回质量上会有明显差异。"
      ]
    : [
        "Some friends optimize for structure while others optimize for nuance.",
        "Verification-oriented friends are more conservative about unsupported claims.",
        "Different underlying models can vary in style, latency, and output quality."
      ];
}

function buildPlatformPromptAddon(groupSettings = {}, language = "zh-CN") {
  if (!groupSettings.platformFeatureEnabled || !groupSettings.preferredPlatform) return "";
  if (language === "zh-CN") {
    return `\n\n平台路由要求：本次会话优先参考 ${groupSettings.preferredPlatform} 对应的数据生态与搜索能力，尽量体现该平台更容易触达的信息视角，并明确结论边界。`;
  }
  return `\n\nPlatform routing requirement: prioritize the ${groupSettings.preferredPlatform} ecosystem and reflect that platform's likely information vantage point while keeping confidence boundaries explicit.`;
}

function getPythonCommand() {
  return process.platform === "win32" ? { command: "py", args: [] } : { command: "python3", args: [] };
}

async function aiSearchHubAvailable() {
  try {
    await stat(AI_SEARCH_HUB_RUNNER);
    const { command, args } = getPythonCommand();
    await execFile(command, args.concat(["-c", "import playwright"]), {
      cwd: AI_SEARCH_HUB_DIR,
      timeout: 15000,
      windowsHide: true,
      maxBuffer: 1024 * 256
    });
    return true;
  } catch {
    return false;
  }
}

async function runAiSearchHub(platform, prompt) {
  if (!platform || !AI_SEARCH_PLATFORMS.has(platform)) {
    throw new Error(`Unsupported AI Search Hub platform: ${platform}`);
  }
  if (!(await aiSearchHubAvailable())) {
    throw new Error("AI Search Hub runner is not installed.");
  }

  const { command, args } = getPythonCommand();
  const timestamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputPath = path.join(AI_SEARCH_OUTPUT_DIR, `${platform}-${timestamp}.txt`);
  await mkdir(AI_SEARCH_OUTPUT_DIR, { recursive: true });

  const runArgs = args.concat([
    AI_SEARCH_HUB_RUNNER,
    "--site",
    platform,
    "--prompt",
    prompt,
    "--repo-root",
    AI_SEARCH_HUB_DIR,
    "--output",
    outputPath
  ]);

  await execFile(command, runArgs, {
    cwd: AI_SEARCH_HUB_DIR,
    timeout: 240000,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 4
  });

  return String(await readFile(outputPath, "utf8")).trim();
}

async function callOpenAICompatible(model, prompt, systemPrompt = "", options = {}) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });
  const response = await fetch(`${normalizeBaseUrl(model.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${model.apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      messages,
      ...(options.thinkingEnabled ? { reasoning: { effort: "medium" } } : {})
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const message = data.choices?.[0]?.message || {};
  const content =
    typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
      ? message.content.map((item) => item?.text || "").filter(Boolean).join("\n\n")
      : "";
  const thinking =
    typeof message.reasoning_content === "string"
      ? message.reasoning_content
      : Array.isArray(message.reasoning_content)
      ? message.reasoning_content.map((item) => item?.text || "").filter(Boolean).join("\n\n")
      : "";
  return { content: content.trim(), thinking: thinking.trim() };
}

async function callAnthropic(model, prompt, systemPrompt = "", options = {}) {
  const response = await fetch(`${normalizeBaseUrl(model.baseUrl)}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": model.apiKey
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: 1200,
      system: systemPrompt || undefined,
      ...(options.thinkingEnabled ? { thinking: { type: "enabled", budget_tokens: 1024 } } : {}),
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const blocks = Array.isArray(data.content) ? data.content : [];
  return {
    content: blocks
      .filter((item) => item?.type === "text")
      .map((item) => item?.text || "")
      .filter(Boolean)
      .join("\n\n")
      .trim(),
    thinking: blocks
      .filter((item) => item?.type === "thinking")
      .map((item) => item?.thinking || item?.text || "")
      .filter(Boolean)
      .join("\n\n")
      .trim()
  };
}

async function callGemini(model, prompt, systemPrompt = "", options = {}) {
  void options;
  const response = await fetch(
    `${normalizeBaseUrl(model.baseUrl)}/models/${encodeURIComponent(model.model)}:generateContent?key=${encodeURIComponent(model.apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: systemPrompt ? `${systemPrompt}\n\n用户问题：${prompt}` : prompt
              }
            ]
          }
        ]
      })
    }
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return {
    content: parts.map((item) => item?.text || "").filter(Boolean).join("\n\n").trim(),
    thinking: ""
  };
}

async function generateFriendResponse(friend, prompt, language) {
  const model = {
    name: friend.modelConfigName || friend.name,
    provider: friend.provider,
    model: friend.model,
    baseUrl: friend.baseUrl,
    apiKey: friend.apiKey
  };
  const platformLabel = friend.preferredPlatform || "";

  if (platformLabel) {
    try {
      const content = await runAiSearchHub(platformLabel, prompt);
      if (content) {
        return {
          friendId: friend.id,
          name: friend.name,
          avatar: friend.avatar || "",
          modelConfigId: friend.modelConfigId,
          modelConfigName: friend.modelConfigName,
          provider: friend.provider,
          model: friend.model,
          source: language === "zh-CN" ? `AI Search Hub · ${platformLabel}` : `AI Search Hub · ${platformLabel}`,
          content,
          thinking: ""
        };
      }
    } catch (error) {
      friend.aiSearchHubError = error.message;
    }
  }

  if (!model.apiKey || !model.baseUrl) {
    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: platformLabel
        ? language === "zh-CN"
          ? `模拟结果 · ${platformLabel}`
          : `mock · ${platformLabel}`
        : language === "zh-CN"
        ? "模拟结果"
        : "mock",
      content: mockResponseFor(friend, prompt, language),
      thinking: "",
      error: friend.aiSearchHubError || ""
    };
  }

  try {
    const provider = String(model.provider || "").toLowerCase();
    let output = { content: "", thinking: "" };
    if (provider.includes("anthropic") || model.name.toLowerCase().includes("claude")) {
      output = await callAnthropic(model, prompt, friend.systemPrompt || "", {
        thinkingEnabled: Boolean(friend.thinkingEnabled)
      });
    } else if (provider.includes("google") || model.name.toLowerCase().includes("gemini")) {
      output = await callGemini(model, prompt, friend.systemPrompt || "", {
        thinkingEnabled: Boolean(friend.thinkingEnabled)
      });
    } else {
      output = await callOpenAICompatible(model, prompt, friend.systemPrompt || "", {
        thinkingEnabled: Boolean(friend.thinkingEnabled)
      });
    }

    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: platformLabel
        ? language === "zh-CN"
          ? `实时结果 · ${platformLabel}`
          : `live · ${platformLabel}`
        : language === "zh-CN"
        ? "实时结果"
        : "live",
      content: output.content || mockResponseFor(friend, prompt, language),
      thinking: friend.thinkingEnabled ? output.thinking || "" : ""
    };
  } catch (error) {
    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: platformLabel
        ? language === "zh-CN"
          ? `回退结果 · ${platformLabel}`
          : `fallback · ${platformLabel}`
        : language === "zh-CN"
        ? "回退结果"
        : "fallback",
      content: mockResponseFor(friend, prompt, language),
      thinking: "",
      error: error.message
    };
  }
}

function resolveRunPayload(body = {}, db = {}) {
  const prompt = String(body.prompt || "").trim();
  const language = body.language === "en" ? "en" : "zh-CN";
  const models = Array.isArray(body.models) && body.models.length ? body.models : db.models || cloneDefaultModels();
  const friends =
    Array.isArray(body.friends) && body.friends.length
      ? body.friends
      : Array.isArray(body.models)
      ? body.models
          .filter((item) => item.enabled)
          .map((model) => ({
            id: `legacy-${model.id || model.name}`,
            name: model.name,
            avatar: model.avatar || "",
            modelConfigId: model.id || model.name,
            modelConfigName: model.name,
            provider: model.provider,
            model: model.model,
            baseUrl: model.baseUrl,
            apiKey: model.apiKey,
            systemPrompt: "",
            enabled: true
          }))
      : [];

  const normalizedFriends = friends
    .filter((item) => item.enabled !== false)
    .map((friend) => {
      const boundModel =
        models.find((model) => model.id === friend.modelConfigId) ||
        models.find((model) => model.name === friend.modelConfigName) ||
        null;
      return {
        id: friend.id,
        name: friend.name,
        avatar: friend.avatar || boundModel?.avatar || "",
        modelConfigId: friend.modelConfigId || boundModel?.id || "",
        modelConfigName: friend.modelConfigName || boundModel?.name || "",
        provider: friend.provider || boundModel?.provider || "",
        model: friend.model || boundModel?.model || "",
        baseUrl: friend.baseUrl || boundModel?.baseUrl || "",
        apiKey: friend.apiKey || boundModel?.apiKey || "",
        systemPrompt: String(friend.systemPrompt || ""),
        enabled: true
      };
    })
    .filter((friend) => friend.modelConfigName);

  const groupSettings = normalizeGroupSettings(
    body.groupSettings || createDefaultGroupSettings(normalizedFriends, models),
    normalizedFriends,
    models
  );
  const runFriends = groupSettings.memberIds
    .map((id) => normalizedFriends.find((friend) => friend.id === id))
    .filter(Boolean)
    .map((friend) => ({
      ...friend,
      preferredPlatform: groupSettings.platformFeatureEnabled ? groupSettings.preferredPlatform : "",
      thinkingEnabled: Boolean(friend.thinkingEnabled),
      systemPrompt: groupSettings.sharedSystemPromptEnabled
        ? `${String(groupSettings.sharedSystemPrompt || "")}${buildPlatformPromptAddon(groupSettings, language)}`.trim()
        : `${String(friend.systemPrompt || "")}${buildPlatformPromptAddon(groupSettings, language)}`.trim()
    }));

  const synthesisFriend =
    runFriends.find((item) => item.id === groupSettings.synthesisFriendId) || runFriends[0] || null;

  return {
    prompt,
    language,
    models,
    allFriends: normalizedFriends,
    friends: runFriends,
    groupSettings,
    synthesisFriend
  };
}

function buildConversationRecord({
  prompt,
  language,
  friends,
  groupSettings,
  results,
  mergedAnswer,
  disagreements
}) {
  const now = new Date().toISOString();
  const synthesisFriend = friends.find((item) => item.id === groupSettings.synthesisFriendId) || friends[0] || null;
  return {
    id: `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: prompt,
    prompt,
    friendIds: friends.map((item) => item.id),
    models: friends.map((item) => item.modelConfigName || item.name),
    synthesisFriendId: synthesisFriend?.id || null,
    synthesisModel: synthesisFriend?.name || "",
    preferredPlatformId: groupSettings.platformFeatureEnabled ? groupSettings.preferredPlatform || "" : "",
    preferredPlatformName: groupSettings.platformFeatureEnabled ? groupSettings.preferredPlatform || "" : "",
    runtimeMode: "backend",
    createdAt: now,
    updatedAt: now,
    timestamp: new Date(now).toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US"),
    responses: results,
    mergedAnswer,
    disagreements,
    friendsSnapshot: friends.map((item) => ({
      id: item.id,
      name: item.name,
      avatar: item.avatar || "",
      modelConfigId: item.modelConfigId,
      modelConfigName: item.modelConfigName,
      provider: item.provider,
      model: item.model,
      thinkingEnabled: Boolean(item.thinkingEnabled),
      systemPrompt: item.systemPrompt || "",
      enabled: true,
      description: ""
    })),
    groupSettingsSnapshot: {
      memberIds: [...groupSettings.memberIds],
      sharedSystemPromptEnabled: Boolean(groupSettings.sharedSystemPromptEnabled),
      sharedSystemPrompt: String(groupSettings.sharedSystemPrompt || ""),
      platformFeatureEnabled: Boolean(groupSettings.platformFeatureEnabled),
      preferredPlatform: String(groupSettings.preferredPlatform || "gemini"),
      synthesisFriendId: groupSettings.synthesisFriendId || null
    },
    messages: [
      {
        role: "user",
        kind: "user",
        content: prompt,
        createdAt: now
      },
      ...results.map((item) => ({
        role: "assistant",
        kind: "model",
        friendId: item.friendId,
        name: item.name,
        avatar: item.avatar || "",
        modelConfigId: item.modelConfigId,
        modelConfigName: item.modelConfigName,
        provider: item.provider,
      model: item.model,
      thinkingEnabled: Boolean(item.thinkingEnabled),
      source: item.source,
      content: item.content,
        thinking: item.thinking || "",
        createdAt: now,
        error: item.error || ""
      })),
      {
        role: "assistant",
        kind: "synthesis",
        friendId: synthesisFriend?.id || "",
        name: `${synthesisFriend?.name || "AI"} ${language === "zh-CN" ? "整合" : "synthesis"}`,
        avatar: synthesisFriend?.avatar || "",
        modelConfigId: synthesisFriend?.modelConfigId || "",
        modelConfigName: synthesisFriend?.modelConfigName || "",
        provider: synthesisFriend?.provider || "",
        model: synthesisFriend?.model || "",
        content: mergedAnswer,
        createdAt: now
      }
    ]
  };
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/account" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { account: db.account });
    return true;
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const body = await parseBody(req);
    if (!body.email || !body.name) {
      sendJson(res, 400, { error: "Email and workspace name are required." });
      return true;
    }
    const db = await readDb();
    db.account = { email: body.email, name: body.name };
    await writeDb(db);
    sendJson(res, 200, { account: db.account });
    return true;
  }

  if (url.pathname === "/api/models" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { models: db.models });
    return true;
  }

  if (url.pathname === "/api/models" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.models = Array.isArray(body.models) && body.models.length ? body.models : cloneDefaultModels();
    await writeDb(db);
    sendJson(res, 200, { models: db.models });
    return true;
  }

  if (url.pathname === "/api/models/test" && req.method === "POST") {
    const body = await parseBody(req);
    const model = body.model || {};
    const language = body.language || "zh-CN";
    if (!model.baseUrl || !model.apiKey) {
      sendJson(res, 400, { ok: false, message: "Missing Base URL or API key" });
      return true;
    }

    try {
      const provider = String(model.provider || "").toLowerCase();
      const prompt = language === "zh-CN" ? "请只回复：连接测试成功" : "Reply with: connection test ok";
      let output = { content: "", thinking: "" };
      if (provider.includes("anthropic") || String(model.name || "").toLowerCase().includes("claude")) {
        output = await callAnthropic(model, prompt, "");
      } else if (provider.includes("google") || String(model.name || "").toLowerCase().includes("gemini")) {
        output = await callGemini(model, prompt, "");
      } else {
        output = await callOpenAICompatible(model, prompt, "");
      }
      sendJson(res, 200, {
        ok: true,
        message: output.content || (language === "zh-CN" ? "连接测试成功" : "Connection successful")
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, message: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/friends" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { friends: db.friends || [] });
    return true;
  }

  if (url.pathname === "/api/friends" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.friends = syncDefaultFriendsWithModels(Array.isArray(body.friends) ? body.friends : db.friends || [], db.models || [], {
      getDefaultFriendSystemPrompt
    });
    db.groupSettings = normalizeGroupSettings(db.groupSettings || {}, db.friends, db.models || []);
    await writeDb(db);
    sendJson(res, 200, { friends: db.friends });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { groupSettings: db.groupSettings || createDefaultGroupSettings(db.friends || [], db.models || []) });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.groupSettings = normalizeGroupSettings(body.groupSettings || {}, db.friends || [], db.models || []);
    await writeDb(db);
    sendJson(res, 200, { groupSettings: db.groupSettings });
    return true;
  }

  if (url.pathname === "/api/conversations" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { conversations: db.conversations });
    return true;
  }

  if (url.pathname === "/api/conversations" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.conversations = Array.isArray(body.conversations) ? body.conversations.slice(0, 50) : db.conversations;
    await writeDb(db);
    sendJson(res, 200, { conversations: db.conversations });
    return true;
  }

  if (url.pathname === "/api/chat/run" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    const { prompt, language, friends, groupSettings, synthesisFriend } = resolveRunPayload(body, db);
    if (!prompt || friends.length === 0) {
      sendJson(res, 400, { error: "Need prompt and at least one selected friend." });
      return true;
    }

    const results = await Promise.all(friends.map((friend) => generateFriendResponse(friend, prompt, language)));
    const mergedAnswer = await buildMergedAnswer(prompt, language, synthesisFriend, results, groupSettings);
    const disagreements = buildDisagreements(language);
    const conversation = buildConversationRecord({
      prompt,
      language,
      friends,
      groupSettings,
      results,
      mergedAnswer,
      disagreements
    });

    db.conversations.unshift(conversation);
    db.conversations = db.conversations.slice(0, 50);
    await writeDb(db);

    sendJson(res, 200, { conversation, results, mergedAnswer, disagreements });
    return true;
  }

  if (url.pathname === "/api/chat/run/stream" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    const { prompt, language, friends, groupSettings, synthesisFriend } = resolveRunPayload(body, db);
    if (!prompt || friends.length === 0) {
      sendJson(res, 400, { error: "Need prompt and at least one selected friend." });
      return true;
    }

    sendNdjsonHeaders(res);
    writeNdjson(res, { type: "start", prompt, synthesisFriendId: groupSettings.synthesisFriendId });

    const results = [];
    for (const friend of friends) {
      writeNdjson(res, {
        type: "friend_start",
        friend: {
          id: friend.id,
          name: friend.name,
          avatar: friend.avatar,
          modelConfigId: friend.modelConfigId,
          modelConfigName: friend.modelConfigName,
          provider: friend.provider,
          model: friend.model
        }
      });
      const result = await generateFriendResponse(friend, prompt, language);
      if (result.thinking) {
        await streamChunks(res, { type: "friend_thinking_delta", friendId: friend.id }, result.thinking);
      }
      await streamChunks(res, { type: "friend_content_delta", friendId: friend.id }, result.content);
      writeNdjson(res, { type: "friend_done", friendId: friend.id, source: result.source || "" });
      results.push(result);
    }

    const mergedAnswer = await buildMergedAnswer(prompt, language, synthesisFriend, results, groupSettings);
    const disagreements = buildDisagreements(language);
    await streamChunks(res, { type: "synthesis_delta", friendId: groupSettings.synthesisFriendId }, mergedAnswer);

    const conversation = buildConversationRecord({
      prompt,
      language,
      friends,
      groupSettings,
      results,
      mergedAnswer,
      disagreements
    });

    db.conversations.unshift(conversation);
    db.conversations = db.conversations.slice(0, 50);
    await writeDb(db);

    writeNdjson(res, { type: "done", conversation, results, mergedAnswer, disagreements });
    res.end();
    return true;
  }

  return false;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: "Not found" });
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = path.join(__dirname, pathname.replace(/^\/+/, ""));
    try {
      await stat(filePath);
      sendFile(res, filePath);
    } catch {
      sendFile(res, path.join(__dirname, "index.html"));
    }
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, async () => {
  await ensureDb();
  console.log(`OpenChat server running at http://127.0.0.1:${PORT}`);
});
