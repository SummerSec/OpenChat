import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, ".data");
const DATA_FILE = path.join(DATA_DIR, "openchat-db.json");
const PORT = Number(process.env.PORT || 8787);

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

function createDefaultGroupSettings(friends = []) {
  const memberIds = friends.filter((item) => item.enabled !== false).map((item) => item.id);
  return {
    memberIds,
    sharedSystemPromptEnabled: false,
    sharedSystemPrompt: "",
    synthesisFriendId: memberIds[0] || null
  };
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function normalizeGroupSettings(settings = {}, friends = []) {
  const enabledIds = friends.filter((item) => item.enabled !== false).map((item) => item.id);
  let memberIds = Array.isArray(settings.memberIds)
    ? settings.memberIds.filter((id) => enabledIds.includes(id))
    : [...enabledIds];
  if (!memberIds.length && enabledIds.length) {
    memberIds = [enabledIds[0]];
  }
  return {
    memberIds,
    sharedSystemPromptEnabled: Boolean(settings.sharedSystemPromptEnabled),
    sharedSystemPrompt: String(settings.sharedSystemPrompt || ""),
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
      groupSettings: createDefaultGroupSettings(friends),
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
  }
  if (!db.groupSettings || typeof db.groupSettings !== "object") {
    db.groupSettings = createDefaultGroupSettings(db.friends);
    changed = true;
  } else {
    const normalized = normalizeGroupSettings(db.groupSettings, db.friends);
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

function mockResponseFor(friend, language = "zh-CN") {
  if (language === "zh-CN") {
    return `${friend.name} 的观点是：先给一个可执行的结论，再补充边界条件、执行顺序和需要验证的风险点。`;
  }
  return `${friend.name}'s take: start with the executable answer, then add tradeoffs, execution order, and the key risks to verify.`;
}

function buildMergedAnswer(language = "zh-CN") {
  return language === "zh-CN"
    ? "整合答案：保留最强结构，吸收细节与保守判断，把不同群友的分歧整理后再输出最终建议。"
    : "Merged answer: keep the strongest structure, preserve nuance, and organize disagreements before presenting the final recommendation.";
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

async function callOpenAICompatible(model, prompt, systemPrompt = "") {
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
      messages
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

async function callAnthropic(model, prompt, systemPrompt = "") {
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

async function callGemini(model, prompt, systemPrompt = "") {
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
  if (!model.apiKey || !model.baseUrl) {
    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: language === "zh-CN" ? "模拟结果" : "mock",
      content: mockResponseFor(friend, language),
      thinking: ""
    };
  }

  try {
    const provider = String(model.provider || "").toLowerCase();
    let output = { content: "", thinking: "" };
    if (provider.includes("anthropic") || model.name.toLowerCase().includes("claude")) {
      output = await callAnthropic(model, prompt, friend.systemPrompt || "");
    } else if (provider.includes("google") || model.name.toLowerCase().includes("gemini")) {
      output = await callGemini(model, prompt, friend.systemPrompt || "");
    } else {
      output = await callOpenAICompatible(model, prompt, friend.systemPrompt || "");
    }

    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: language === "zh-CN" ? "实时结果" : "live",
      content: output.content || mockResponseFor(friend, language),
      thinking: output.thinking || ""
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
      source: language === "zh-CN" ? "回退结果" : "fallback",
      content: mockResponseFor(friend, language),
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
    body.groupSettings || createDefaultGroupSettings(normalizedFriends),
    normalizedFriends
  );
  const runFriends = groupSettings.memberIds
    .map((id) => normalizedFriends.find((friend) => friend.id === id))
    .filter(Boolean)
    .map((friend) => ({
      ...friend,
      systemPrompt: groupSettings.sharedSystemPromptEnabled
        ? String(groupSettings.sharedSystemPrompt || "")
        : String(friend.systemPrompt || "")
    }));

  return {
    prompt,
    language,
    models,
    allFriends: normalizedFriends,
    friends: runFriends,
    groupSettings
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
      systemPrompt: item.systemPrompt || "",
      enabled: true,
      description: ""
    })),
    groupSettingsSnapshot: {
      memberIds: [...groupSettings.memberIds],
      sharedSystemPromptEnabled: Boolean(groupSettings.sharedSystemPromptEnabled),
      sharedSystemPrompt: String(groupSettings.sharedSystemPrompt || ""),
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
        source: item.source,
        content: item.content,
        thinking: item.thinking || "",
        createdAt: now
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

  if (url.pathname === "/api/friends" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { friends: db.friends || [] });
    return true;
  }

  if (url.pathname === "/api/friends" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.friends = Array.isArray(body.friends) ? body.friends : db.friends || [];
    await writeDb(db);
    sendJson(res, 200, { friends: db.friends });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { groupSettings: db.groupSettings || createDefaultGroupSettings(db.friends || []) });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.groupSettings = normalizeGroupSettings(body.groupSettings || {}, db.friends || []);
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
    const { prompt, language, friends, groupSettings } = resolveRunPayload(body, db);
    if (!prompt || friends.length === 0) {
      sendJson(res, 400, { error: "Need prompt and at least one selected friend." });
      return true;
    }

    const results = await Promise.all(friends.map((friend) => generateFriendResponse(friend, prompt, language)));
    const mergedAnswer = buildMergedAnswer(language);
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
    const { prompt, language, friends, groupSettings } = resolveRunPayload(body, db);
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

    const mergedAnswer = buildMergedAnswer(language);
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
