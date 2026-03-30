import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveFriendProfilesForScope } from "./features/group/friend-bootstrap-utils.mjs";

function loadInitializeAppHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("async function initializeApp() {");
  const end = source.indexOf("\ninitializeApp();", start);

  assert.notEqual(start, -1, "expected initializeApp in script.js");
  assert.notEqual(end, -1, "expected initializeApp call boundary in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "runtimeMode",
    "loadBackendState",
    "loadLocalModelConfigFile",
    "bootstrapDefaultFriendsIfMissing",
    "loadFrontendPasswordHash",
    "applyLanguage",
    "renderAccount",
    "renderRuntime",
    "renderModelSummary",
    "renderSynthesisOptions",
    "renderModelToggleGrid",
    "renderConfigGrid",
    "renderHistory",
    "renderConversationList",
    "messageStream",
    "getHistoryItems",
    "loadConversationByIndex",
    "renderMessageStream",
    "currentConversation",
    "setRuntimeStatus",
    "t",
    "autosizePromptInput",
    "bindLanguageControls",
    "bindWorkspaceEvents",
    "bindSettingsEvents",
    "bindFriendEvents",
    "bindAccountEvents",
    "bindHistoryEvents",
    "bindFrontendPasswordEvents",
    "bindUserMenu",
    "ensureFrontendAccess",
    "renderFriendGrid",
    `${helperBlock}
return { initializeApp };`
  );

  return helperFactory;
}

function loadRenderingHelpers() {
  const source = readFileSync(new URL("../script.js", import.meta.url), "utf8");
  const start = source.indexOf("function escapeHtml(value = \"\") {");
  const end = source.indexOf("\nfunction sleep(ms) {", start);

  assert.notEqual(start, -1, "expected escapeHtml helper block in script.js");
  assert.notEqual(end, -1, "expected helper block boundary before sleep() in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    `${helperBlock}
return { escapeHtml, encodeMessageField, renderAssistantMessageContent };`
  );

  return helperFactory();
}

function loadScopedStateHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function loadScopedFriendProfiles(models = modelConfigs) {");
  const end = source.indexOf("\nfunction updateFrontendPasswordError", start);

  assert.notEqual(start, -1, "expected scoped reload helpers in script.js");
  assert.notEqual(end, -1, "expected scoped reload helper boundary in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "resolveFriendProfilesForScope",
    "localStorage",
    "getScopedStorageKey",
    "STORAGE_KEYS",
    "readScopedJson",
    "createDefaultFriendProfiles",
    "normalizeFriendProfiles",
    "normalizeModelConfigs",
    "normalizeGroupSettings",
    "createDefaultGroupSettings",
    "cloneGroupSettings",
    `${helperBlock}
let defaultGroupSettings = {};
let currentConversationGroupSettings = {};
let draftGroupSettings = {};
let currentConversation = ["stale"];
let activeConversationId = "conv-1";
let activeHistoryIndex = 4;
return {
  reloadScopedLocalState,
  getState() {
    return {
      modelConfigs,
      friendProfiles,
      defaultGroupSettings,
      currentConversationGroupSettings,
      draftGroupSettings,
      currentConversation,
      activeConversationId,
      activeHistoryIndex
    };
  }
};`
  );

  return helperFactory;
}

function loadModelSummaryHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function renderModelSummary() {");
  const end = source.indexOf("\nfunction renderSynthesisOptions() {", start);

  assert.notEqual(start, -1, "expected renderModelSummary in script.js");
  assert.notEqual(end, -1, "expected renderModelSummary boundary in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "resolveConversationFriends",
    "currentConversationGroupSettings",
    "getPreferredPlatformOption",
    "selectedModels",
    "selectedCount",
    "modelCount",
    "getActiveModels",
    "renderProviderIcon",
    "escapeHtml",
    "t",
    `${helperBlock}
return { renderModelSummary };`
  );

  return helperFactory;
}

function loadConfigGridHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function renderConfigGrid() {");
  const end = source.indexOf("\nfunction renderFriendGrid() {", start);

  assert.notEqual(start, -1, "expected renderConfigGrid in script.js");
  assert.notEqual(end, -1, "expected renderConfigGrid boundary in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "configGrid",
    "getOrderedModelConfigs",
    "modelTestState",
    "escapeHtml",
    "t",
    "PROVIDER_OPTIONS",
    "runtimeMode",
    "renderProviderIcon",
    `${helperBlock}
return { renderConfigGrid };`
  );

  return helperFactory;
}

function loadGroupSettingsInteractionHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const pickerStart = source.indexOf('groupMemberPicker?.addEventListener("click", (event) => {');
  const pickerEnd = source.indexOf('\n  groupMemberPicker?.addEventListener("change", (event) => {', pickerStart);
  const guard = 'if (!isGroupSettingsOpen || !groupSettingsPanel || !groupSettingsToggleButton) return;';
  const guardIndex = source.indexOf(guard, pickerEnd);
  const documentStart = source.lastIndexOf('  document.addEventListener("click", (event) => {', guardIndex);
  const documentEnd = source.indexOf("\n  });", guardIndex) + "\n  });".length;

  assert.notEqual(pickerStart, -1, "expected group member picker click handler in script.js");
  assert.notEqual(pickerEnd, -1, "expected group member picker click handler boundary in script.js");
  assert.notEqual(documentStart, -1, "expected group settings outside click handler in script.js");
  assert.ok(documentEnd > documentStart, "expected group settings outside click handler boundary in script.js");

  const pickerBlock = source.slice(pickerStart, pickerEnd);
  const documentBlock = source.slice(documentStart, documentEnd);
  const helperFactory = new Function(
    "groupMemberPicker",
    "document",
    "groupSettingsPanel",
    "groupSettingsToggleButton",
    "renderGroupSettingsPanel",
    `let isGroupSettingsOpen = true;
let isGroupMemberDetailsOpen = false;
${pickerBlock}
${documentBlock}
return {
  getPickerClickHandler() {
    return groupMemberPicker.__handlers.click;
  },
  getDocumentClickHandler() {
    return document.__handlers.click;
  },
  getState() {
    return { isGroupSettingsOpen, isGroupMemberDetailsOpen };
  }
};`
  );

  return helperFactory;
}

function loadConversationSessionHelpers() {
  const source = readFileSync(new URL("./script.js", import.meta.url), "utf8");
  const start = source.indexOf("function getSessionFriendMap(session = {}) {");
  const end = source.indexOf("\nfunction serializeConversation(messages = []) {", start);

  assert.notEqual(start, -1, "expected session conversation helpers in script.js");
  assert.notEqual(end, -1, "expected session conversation helper boundary in script.js");

  const helperBlock = source.slice(start, end);
  const helperFactory = new Function(
    "getFriendById",
    "friendProfiles",
    "modelConfigs",
    "t",
    "createMessageId",
    `${helperBlock}
return { buildConversationFromSession };`
  );

  return helperFactory;
}

const { renderAssistantMessageContent } = loadRenderingHelpers();


function buildLoadingBody() {
  return '<div class="ai-card-body loading">Loading</div>';
}

function createEventTarget({ matchesToggle = false, insidePanel = false, insideToggle = false } = {}) {
  return {
    closest(selector) {
      if (selector === "[data-group-member-toggle]" && matchesToggle) {
        return { dataset: { groupMemberToggle: "" } };
      }
      return null;
    },
    __insidePanel: insidePanel,
    __insideToggle: insideToggle
  };
}

function createClickEvent(target) {
  return {
    target,
    propagationStopped: false,
    stopPropagation() {
      this.propagationStopped = true;
    }
  };
}

function createContainsNode(flagName) {
  return {
    contains(target) {
      return Boolean(target?.[flagName]);
    }
  };
}

test("renderModelSummary shows only the synthesis friend in the header chips", () => {
  const members = [
    {
      id: "friend-chatgpt",
      name: "ChatGPT",
      provider: "OpenAI",
      avatar: "",
      modelAvatar: ""
    },
    {
      id: "friend-claude",
      name: "Claude",
      provider: "Anthropic",
      avatar: "",
      modelAvatar: ""
    }
  ];
  const selectedModels = { innerHTML: "" };
  const selectedCount = { textContent: "" };
  const modelCount = { textContent: "" };
  const { renderModelSummary } = loadModelSummaryHelpers()(
    () => members,
    { synthesisFriendId: "friend-chatgpt", platformFeatureEnabled: false },
    () => null,
    selectedModels,
    selectedCount,
    modelCount,
    () => members,
    (name) => `<icon>${name}</icon>`,
    (value) => String(value || ""),
    (key, vars = {}) => (key === "common.friendsSelected" ? `${vars.count} friends joined` : key)
  );

  renderModelSummary();

  assert.match(selectedModels.innerHTML, /ChatGPT/);
  assert.doesNotMatch(selectedModels.innerHTML, /Claude/);
  assert.equal(selectedCount.textContent, "2 friends joined");
  assert.equal(modelCount.textContent, "2");
});

function createScopedReloadHarness({ storedModels, storedFriendsRaw = null, storedGroupSettingsRaw = null }) {
  const STORAGE_KEYS = {
    models: "multiplechat-model-configs",
    friends: "openchat-friend-profiles",
    groupSettings: "openchat-default-group-settings"
  };
  const scopedKey = (key) => `${key}::admin::admin`;
  const storage = new Map();

  storage.set(scopedKey(STORAGE_KEYS.models), JSON.stringify(storedModels));
  if (storedFriendsRaw !== null) {
    storage.set(scopedKey(STORAGE_KEYS.friends), storedFriendsRaw);
  }
  if (storedGroupSettingsRaw !== null) {
    storage.set(scopedKey(STORAGE_KEYS.groupSettings), storedGroupSettingsRaw);
  }

  const helperFactory = loadScopedStateHelpers();
  const harness = helperFactory(
    resolveFriendProfilesForScope,
    {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      }
    },
    scopedKey,
    STORAGE_KEYS,
    (key, fallback) => {
      const raw = storage.get(scopedKey(key));
      if (raw === undefined || raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
      } catch {
        return fallback;
      }
    },
    (models = []) => models.map((model) => ({
      id: `friend-${model.id}`,
      name: model.name,
      avatar: model.avatar || "",
      modelConfigId: model.id,
      systemPrompt: `prompt:${model.name}`,
      enabled: true,
      description: model.description || ""
    })),
    (items = []) => items.map((item) => ({ ...item })),
    (items = []) => items.map((item) => ({ ...item })),
    (settings = {}, friends = []) => ({
      memberIds: Array.isArray(settings.memberIds) ? [...settings.memberIds] : friends.map((friend) => friend.id),
      synthesisFriendId: settings.synthesisFriendId || friends[0]?.id || null
    }),
    (friends = []) => ({
      memberIds: friends.map((friend) => friend.id),
      synthesisFriendId: friends[0]?.id || null
    }),
    (settings = {}) => ({
      memberIds: Array.isArray(settings.memberIds) ? [...settings.memberIds] : [],
      synthesisFriendId: settings.synthesisFriendId || null
    })
  );

  return harness;
}

test("reloadScopedLocalState bootstraps default friends when scoped friends are missing", () => {
  const harness = createScopedReloadHarness({
    storedModels: [{ id: "chatgpt", name: "ChatGPT", avatar: "", description: "" }]
  });

  harness.reloadScopedLocalState();
  const state = harness.getState();

  assert.deepEqual(state.friendProfiles, [{
    id: "friend-chatgpt",
    name: "ChatGPT",
    avatar: "",
    modelConfigId: "chatgpt",
    systemPrompt: "prompt:ChatGPT",
    enabled: true,
    description: ""
  }]);
  assert.deepEqual(state.defaultGroupSettings, {
    memberIds: ["friend-chatgpt"],
    synthesisFriendId: "friend-chatgpt"
  });
  assert.deepEqual(state.currentConversation, []);
  assert.equal(state.activeConversationId, null);
  assert.equal(state.activeHistoryIndex, null);
});

test("reloadScopedLocalState preserves explicit empty scoped friends", () => {
  const harness = createScopedReloadHarness({
    storedModels: [{ id: "chatgpt", name: "ChatGPT", avatar: "", description: "" }],
    storedFriendsRaw: "[]"
  });

  harness.reloadScopedLocalState();
  const state = harness.getState();

  assert.deepEqual(state.friendProfiles, []);
  assert.deepEqual(state.defaultGroupSettings, {
    memberIds: [],
    synthesisFriendId: null
  });
});

test("renders assistant content with a streamdown mount target", () => {
  const html = renderAssistantMessageContent({
    content: "# Final answer\n\nUse **bold** insight.",
    isLoading: false,
    kind: "assistant",
    messageId: "msg-1",
    loadingBody: buildLoadingBody()
  });

  assert.match(html, /class="ai-card-body markdown-content streamdown-target"/);
  assert.match(html, /data-message-id="msg-1"/);
  assert.match(html, /data-field="content"/);
  assert.match(html, /data-kind="assistant"/);
  assert.match(html, /data-content="# Final answer\n\nUse \*\*bold\*\* insight\."/);
  assert.doesNotMatch(html, /<h1>Final answer<\/h1>/);
});




test("group member details toggle keeps group settings panel open during the same click", () => {
  const listeners = {};
  const groupMemberPicker = {
    __handlers: {},
    addEventListener(type, handler) {
      this.__handlers[type] = handler;
    }
  };
  const documentStub = {
    __handlers: {},
    addEventListener(type, handler) {
      this.__handlers[type] = handler;
    }
  };
  const renderCalls = [];
  const harness = loadGroupSettingsInteractionHelpers()(
    groupMemberPicker,
    documentStub,
    createContainsNode("__insidePanel"),
    createContainsNode("__insideToggle"),
    () => renderCalls.push("render")
  );

  const pickerClick = harness.getPickerClickHandler();
  const outsideClick = harness.getDocumentClickHandler();
  const eventTarget = createEventTarget({ matchesToggle: true, insidePanel: false, insideToggle: false });
  const clickEvent = createClickEvent(eventTarget);

  pickerClick(clickEvent);
  if (!clickEvent.propagationStopped) {
    outsideClick(clickEvent);
  }

  const state = harness.getState();
  assert.equal(state.isGroupMemberDetailsOpen, true);
  assert.equal(state.isGroupSettingsOpen, true);
  assert.equal(renderCalls.length, 1);
});

test("renderConfigGrid does not show backend recommendation copy in frontend mode", () => {
  const configGrid = { innerHTML: "" };
  const { renderConfigGrid } = loadConfigGridHelpers()(
    configGrid,
    () => [{
      id: "model-1",
      name: "ICE Model",
      provider: "ice",
      model: "ice-v1",
      baseUrl: "https://example.com",
      apiKey: "",
      description: "demo",
      enabled: true,
      thinkingEnabled: false,
      avatar: ""
    }],
    {},
    (value) => String(value || ""),
    (key) => {
      if (key === "common.backendRecommended") return "建议后端模式";
      if (key === "common.backendRecommendedCopy") return "这类模型若被浏览器 CORS 拦截，更适合在后端模式下测试或运行。";
      return key;
    },
    ["ice"],
    "frontend",
    () => "<icon />"
  );

  renderConfigGrid();

  assert.doesNotMatch(configGrid.innerHTML, /config-backend-hint/);
  assert.doesNotMatch(configGrid.innerHTML, /建议后端模式/);
  assert.doesNotMatch(configGrid.innerHTML, /CORS 拦截/);
});


test("initializeApp renders friend grid on first load", async () => {
  const calls = [];
  const { initializeApp } = loadInitializeAppHelpers()(
    "frontend",
    async () => calls.push("loadBackendState"),
    async () => calls.push("loadLocalModelConfigFile"),
    () => calls.push("bootstrapDefaultFriendsIfMissing"),
    async () => calls.push("loadFrontendPasswordHash"),
    () => calls.push("applyLanguage"),
    () => calls.push("renderAccount"),
    () => calls.push("renderRuntime"),
    () => calls.push("renderModelSummary"),
    () => calls.push("renderSynthesisOptions"),
    () => calls.push("renderModelToggleGrid"),
    () => calls.push("renderConfigGrid"),
    () => calls.push("renderHistory"),
    () => calls.push("renderConversationList"),
    null,
    () => [],
    () => calls.push("loadConversationByIndex"),
    () => calls.push("renderMessageStream"),
    [],
    () => calls.push("setRuntimeStatus"),
    (key) => key,
    () => calls.push("autosizePromptInput"),
    () => calls.push("bindLanguageControls"),
    () => calls.push("bindWorkspaceEvents"),
    () => calls.push("bindSettingsEvents"),
    () => calls.push("bindFriendEvents"),
    () => calls.push("bindAccountEvents"),
    () => calls.push("bindHistoryEvents"),
    () => calls.push("bindFrontendPasswordEvents"),
    () => calls.push("bindUserMenu"),
    async () => calls.push("ensureFrontendAccess"),
    () => calls.push("renderFriendGrid")
  );

  await initializeApp();

  assert.match(calls.join(","), /renderFriendGrid/);
});

