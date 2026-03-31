import { createServer } from "node:http";
import { execFile as execFileCallback } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { streamText, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildPromptAwareMergedAnswer, buildPromptAwareMockResponse } from "./src/utils/mock-response-utils.mjs";
import { buildFallbackSynthesis, buildSynthesisPromptText, getDefaultSynthesisSystemPrompt } from "./src/utils/synthesis-utils.mjs";

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

function createDefaultGroupSettings(friends = []) {
  const memberIds = friends.filter((item) => item.enabled !== false).map((item) => item.id);
  return {
    memberIds,
    sharedSystemPromptEnabled: false,
    sharedSystemPrompt: "",
    platformFeatureEnabled: false,
    preferredPlatform: "gemini",
    synthesisEnabled: false,
    synthesisFriendId: memberIds[0] || null
  };
}

function normalizeBaseUrl(url) {
  return String(url || "").replace(/\/+$/, "");
}

function normalizeGroupSettings(settings = {}, friends = []) {
  const expertIds = friends
    .filter((item) => item.enabled !== false && item.isIntegrationExpert)
    .map((item) => item.id);
  const enabledIds = friends
    .filter((item) => item.enabled !== false && !item.isIntegrationExpert)
    .map((item) => item.id);
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
    platformFeatureEnabled: Boolean(settings.platformFeatureEnabled),
    preferredPlatform: String(settings.preferredPlatform || "gemini"),
    synthesisEnabled: Boolean(settings.synthesisEnabled),
    synthesisFriendId:
      expertIds.find((id) => id === settings.synthesisFriendId) || expertIds[0] || null
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
  if (!Array.isArray(db.promptTemplates)) {
    db.promptTemplates = [];
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
    modelConfigId: friend.modelConfigId,
    language,
    prompt
  });
}

function getProviderIconKey(name = "", provider = "") {
  const key = String(name || provider || "ai").toLowerCase();
  if (key.includes("claude")) return "anthropic";
  if (key.includes("gemini")) return "google";
  if (key.includes("grok")) return "xai";
  if (key.includes("chatgpt") || key.includes("openai")) return "openai";
  if (key.includes("deepseek")) return "deepseek";
  if (key.includes("moonshot") || key.includes("kimi")) return "moonshot";
  if (key.includes("qwen") || key.includes("alibaba")) return "alibaba";
  if (key.includes("hunyuan") || key.includes("tencent")) return "tencent";
  if (key.includes("baidu") || key.includes("qianfan")) return "baidu";
  if (key.includes("azure")) return "azure";
  if (key.includes("mistral")) return "mistral";
  if (key.includes("cohere")) return "cohere";
  if (key.includes("meta") || key.includes("llama")) return "meta";
  return "ai";
}

function createAIProvider(model, apiKey) {
  const provider = String(model.provider || "").toLowerCase();
  const baseUrl = normalizeBaseUrl(model.baseUrl);

  if (provider === "anthropic") {
    return createAnthropic({ apiKey, baseURL: baseUrl });
  }

  if (provider === "google") {
    return createGoogleGenerativeAI({ apiKey });
  }

  // Default to OpenAI-compatible (OpenAI, xAI, DeepSeek, Moonshot, etc.)
  return createOpenAI({ apiKey, baseURL: baseUrl });
}

async function streamFriendResponse(friend, prompt, onChunk, options = {}) {
  const { thinkingEnabled = false, signal, history = [] } = options;

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
        onChunk?.({ type: "content", text: content });
        return {
          friendId: friend.id,
          name: friend.name,
          avatar: friend.avatar || "",
          modelConfigId: friend.modelConfigId,
          modelConfigName: friend.modelConfigName,
          provider: friend.provider,
          model: friend.model,
          source: `AI Search Hub · ${platformLabel}`,
          content,
          thinking: ""
        };
      }
    } catch (error) {
      friend.aiSearchHubError = error.message;
    }
  }

  if (!model.apiKey || !model.baseUrl) {
    const mock = mockResponseFor(friend, prompt, options.language);
    onChunk?.({ type: "content", text: mock.content });
    return {
      friendId: friend.id,
      name: friend.name,
      avatar: friend.avatar || "",
      modelConfigId: friend.modelConfigId,
      modelConfigName: friend.modelConfigName,
      provider: friend.provider,
      model: friend.model,
      source: "mock",
      content: mock.content,
      thinking: ""
    };
  }

  const provider = createAIProvider(model, model.apiKey);
  const systemPrompt = friend.systemPrompt || "";

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  if (history.length > 0) {
    messages.push(...history);
  }
  messages.push({ role: "user", content: prompt });

  let fullContent = "";
  let fullThinking = "";
  let insideThinkTag = false;

  const { textStream, text, reasoning } = streamText({
    model: provider(model.model),
    messages,
    ...(thinkingEnabled && model.provider === "Anthropic" ? { thinking: { type: "enabled", budgetTokens: 1024 } } : {}),
    abortSignal: signal
  });

  for await (const chunk of textStream) {
    // Handle <think> tags embedded in content stream
    let remaining = chunk;
    while (remaining.length > 0) {
      if (insideThinkTag) {
        const closeIdx = remaining.indexOf("</think>");
        if (closeIdx !== -1) {
          const thinkPart = remaining.slice(0, closeIdx);
          if (thinkPart) {
            fullThinking += thinkPart;
            onChunk?.({ type: "thinking", text: thinkPart });
          }
          insideThinkTag = false;
          remaining = remaining.slice(closeIdx + 8);
        } else {
          fullThinking += remaining;
          onChunk?.({ type: "thinking", text: remaining });
          remaining = "";
        }
      } else {
        const openIdx = remaining.indexOf("<think>");
        if (openIdx !== -1) {
          const contentPart = remaining.slice(0, openIdx);
          if (contentPart) {
            fullContent += contentPart;
            onChunk?.({ type: "content_delta", text: contentPart });
          }
          insideThinkTag = true;
          remaining = remaining.slice(openIdx + 7);
        } else {
          fullContent += remaining;
          onChunk?.({ type: "content_delta", text: remaining });
          remaining = "";
        }
      }
    }
  }

  // Wait for reasoning/thinking if available (separate field)
  try {
    const reasoningText = await reasoning;
    if (reasoningText) {
      fullThinking += (fullThinking ? "\n\n" : "") + reasoningText;
      onChunk?.({ type: "thinking", text: reasoningText });
    }
  } catch {
    // Reasoning not available for this provider
  }

  return {
    friendId: friend.id,
    name: friend.name,
    avatar: friend.avatar || "",
    modelConfigId: friend.modelConfigId,
    modelConfigName: friend.modelConfigName,
    provider: friend.provider,
    model: friend.model,
    source: model.provider,
    content: fullContent.trim(),
    thinking: fullThinking.trim()
  };
}

async function generateFriendResponse(friend, prompt, language, history = []) {
  let result = { content: "", thinking: "" };

  await streamFriendResponse(friend, prompt, (chunk) => {
    if (chunk.type === "content_delta") {
      result.content += chunk.text;
    } else if (chunk.type === "thinking") {
      result.thinking = chunk.text;
    } else if (chunk.type === "content") {
      result.content = chunk.text;
    }
  }, { language, history });

  return result;
}

async function runAiSearchHub(platform, prompt) {
  const outputFile = path.join(AI_SEARCH_OUTPUT_DIR, `${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  try {
    await mkdir(AI_SEARCH_OUTPUT_DIR, { recursive: true });
    await execFile("python3", [AI_SEARCH_HUB_RUNNER, platform, prompt, outputFile], {
      timeout: 120000,
      cwd: AI_SEARCH_HUB_DIR
    });
    const output = JSON.parse(await readFile(outputFile, "utf8"));
    return output?.content || output?.text || "";
  } catch {
    return "";
  }
}

async function buildMergedAnswer(prompt, language, synthesisFriend, results, groupSettings) {
  const provider = String(synthesisFriend?.provider || "").toLowerCase();

  if (!synthesisFriend || !synthesisFriend.apiKey || !synthesisFriend.baseUrl) {
    return buildFallbackSynthesis({ results, prompt, language });
  }

  const synthesisPrompt = buildSynthesisPromptText({ prompt, results, language });

  try {
    const aiProvider = createAIProvider(synthesisFriend, synthesisFriend.apiKey);
    const systemPrompt = synthesisFriend.systemPrompt || getDefaultSynthesisSystemPrompt(language);

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    messages.push({ role: "user", content: synthesisPrompt });

    const { text } = await generateText({
      model: aiProvider(synthesisFriend.model),
      messages
    });

    return text.trim() || buildFallbackSynthesis({ results, prompt, language });
  } catch (error) {
    console.warn("Synthesis failed:", error.message);
    return buildFallbackSynthesis({ results, prompt, language });
  }
}

function buildDisagreements(language = "zh-CN") {
  return language === "zh-CN"
    ? [{ axis: "示例", points: ["这是一个示例分歧点，用于展示各模型的不同视角。"] }]
    : [{ axis: "Example", points: ["This is a sample disagreement to show different model perspectives."] }];
}

function buildConversationRecord({ prompt, language, friends, groupSettings, results, mergedAnswer, disagreements }) {
  const createdAt = new Date().toISOString();
  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt,
    language,
    createdAt,
    updatedAt: createdAt,
    friends: friends.map((f) => ({
      id: f.id,
      name: f.name,
      avatar: f.avatar || "",
      modelConfigId: f.modelConfigId,
      modelConfigName: f.modelConfigName,
      provider: f.provider,
      model: f.model
    })),
    groupSettings: {
      memberIds: [...groupSettings.memberIds],
      synthesisFriendId: groupSettings.synthesisFriendId,
      sharedSystemPromptEnabled: groupSettings.sharedSystemPromptEnabled
    },
    responses: results.map((r) => ({
      friendId: r.friendId,
      name: r.name,
      avatar: r.avatar || "",
      provider: r.provider,
      model: r.model,
      content: r.content,
      thinking: r.thinking,
      source: r.source || ""
    })),
    mergedAnswer,
    disagreements
  };
}

function resolveRunPayload(body, db) {
  const prompt = String(body.prompt || "").trim();
  const language = String(body.language || body.lang || "zh-CN");
  const groupSettings = normalizeGroupSettings(body.groupSettings, db.friends);

  const enabledFriends = db.friends.filter((f) => f.enabled !== false);
  const memberIds = groupSettings.memberIds.filter((id) => enabledFriends.some((f) => f.id === id));

  let friends = enabledFriends.filter((f) => memberIds.includes(f.id));
  let synthesisFriend = groupSettings.synthesisEnabled
    ? (db.friends.find((f) => f.id === groupSettings.synthesisFriendId && f.isIntegrationExpert) || null)
    : null;

  // Exclude synthesis friend from regular friends — it only produces the synthesis output.
  // If synthesis friend is the only member, skip synthesis and run it as a regular friend.
  if (synthesisFriend) {
    const otherFriends = friends.filter((f) => f.id !== synthesisFriend.id);
    if (otherFriends.length > 0) {
      friends = otherFriends;
    } else {
      synthesisFriend = null;
    }
  }

  const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];

  return { prompt, language, friends, groupSettings, synthesisFriend, conversationHistory };
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/account" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { account: db.account || null });
    return true;
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.account = { email: body.email || "", workspace: body.workspace || "" };
    await writeDb(db);
    sendJson(res, 200, { account: db.account });
    return true;
  }

  if (url.pathname === "/api/models" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { models: db.models || [] });
    return true;
  }

  if (url.pathname === "/api/models" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.models = Array.isArray(body.models) ? body.models : db.models;
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
    db.friends = Array.isArray(body.friends) ? body.friends : db.friends;
    db.groupSettings = normalizeGroupSettings(db.groupSettings, db.friends);
    await writeDb(db);
    sendJson(res, 200, { friends: db.friends });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { groupSettings: normalizeGroupSettings(db.groupSettings, db.friends) });
    return true;
  }

  if (url.pathname === "/api/group-settings" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.groupSettings = normalizeGroupSettings(body.groupSettings, db.friends);
    await writeDb(db);
    sendJson(res, 200, { groupSettings: db.groupSettings });
    return true;
  }

  if (url.pathname === "/api/prompt-templates" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { promptTemplates: db.promptTemplates || [] });
    return true;
  }

  if (url.pathname === "/api/prompt-templates" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    db.promptTemplates = Array.isArray(body.promptTemplates) ? body.promptTemplates : (db.promptTemplates || []);
    await writeDb(db);
    sendJson(res, 200, { promptTemplates: db.promptTemplates });
    return true;
  }

  if (url.pathname === "/api/conversations" && req.method === "GET") {
    const db = await readDb();
    sendJson(res, 200, { conversations: db.conversations || [] });
    return true;
  }

  if (url.pathname === "/api/conversations" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    if (body.conversations) {
      db.conversations = Array.isArray(body.conversations) ? body.conversations : db.conversations;
      await writeDb(db);
    }
    sendJson(res, 200, { conversations: db.conversations });
    return true;
  }

  if (url.pathname === "/api/chat/run" && req.method === "POST") {
    const body = await parseBody(req);
    const db = await readDb();
    const { prompt, language, friends, groupSettings, synthesisFriend, conversationHistory } = resolveRunPayload(body, db);
    if (!prompt || friends.length === 0) {
      sendJson(res, 400, { error: "Need prompt and at least one selected friend." });
      return true;
    }

    const results = await Promise.all(friends.map((friend) => {
      const friendHistory = conversationHistory
        .filter((msg) => msg.kind === "user" || ((msg.kind === "model" || msg.kind === "synthesis") && msg.friendId === friend.id))
        .map((msg) => ({ role: msg.role === "user" ? "user" : "assistant", content: msg.content }));
      return generateFriendResponse(friend, prompt, language, friendHistory);
    }));
    const mergedAnswer = synthesisFriend
      ? await buildMergedAnswer(prompt, language, synthesisFriend, results, groupSettings)
      : "";
    const disagreements = synthesisFriend ? buildDisagreements(language) : [];
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
    const { prompt, language, friends, groupSettings, synthesisFriend, conversationHistory } = resolveRunPayload(body, db);
    if (!prompt || friends.length === 0) {
      sendJson(res, 400, { error: "Need prompt and at least one selected friend." });
      return true;
    }

    const controller = new AbortController();
    req.on("close", () => controller.abort());
    req.on("error", () => controller.abort());

    sendNdjsonHeaders(res);
    writeNdjson(res, { type: "start", prompt, synthesisFriendId: groupSettings.synthesisFriendId });

    const results = [];
    for (const friend of friends) {
      // Extract per-friend history: user messages + this friend's responses
      const friendHistory = conversationHistory
        .filter((msg) => msg.kind === "user" || ((msg.kind === "model" || msg.kind === "synthesis") && msg.friendId === friend.id))
        .map((msg) => ({ role: msg.role === "user" ? "user" : "assistant", content: msg.content }));

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

      const result = await streamFriendResponse(
        friend,
        prompt,
        (chunk) => {
          if (chunk.type === "content_delta") {
            writeNdjson(res, { type: "friend_content_delta", friendId: friend.id, delta: chunk.text });
          } else if (chunk.type === "thinking") {
            // Stream thinking/reasoning content
            writeNdjson(res, { type: "friend_thinking_delta", friendId: friend.id, delta: chunk.text });
          }
        },
        { language, thinkingEnabled: friend.thinkingEnabled, signal: controller.signal, history: friendHistory }
      );

      if (result.thinking) {
        writeNdjson(res, { type: "friend_thinking_complete", friendId: friend.id, thinking: result.thinking });
      }
      writeNdjson(res, { type: "friend_done", friendId: friend.id, source: result.source || "" });
      results.push(result);
    }

    const mergedAnswer = synthesisFriend
      ? await buildMergedAnswer(prompt, language, synthesisFriend, results, groupSettings)
      : "";
    const disagreements = synthesisFriend ? buildDisagreements(language) : [];

    if (synthesisFriend && mergedAnswer) {
      await streamChunks(res, { type: "synthesis_delta", friendId: groupSettings.synthesisFriendId }, mergedAnswer);
    }

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
  console.log(`OpenChat server running at http://1270.0.1:${PORT}`);
});
