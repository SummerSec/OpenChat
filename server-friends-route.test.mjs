import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, ".data");
const DATA_FILE = path.join(DATA_DIR, "openchat-db.json");

async function waitForServer(url, child) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < 10000) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw lastError || new Error("Timed out waiting for server");
}

async function withServer(port, run) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/api/group-settings`, child);
    await run();
  } catch (error) {
    if (stderr) {
      error.message = `${error.message}\n${stderr}`;
    }
    throw error;
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

test("POST /api/friends re-normalizes friends and group settings before persisting and returning", async () => {
  const backup = existsSync(DATA_FILE) ? await readFile(DATA_FILE, "utf8") : null;
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    DATA_FILE,
    JSON.stringify(
      {
        account: null,
        models: [
          { id: "chatgpt", name: "ChatGPT", enabled: true },
          { id: "claude", name: "Claude", enabled: false }
        ],
        friends: [
          { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true },
          { id: "friend-claude", modelConfigId: "claude", enabled: true }
        ],
        groupSettings: {
          memberIds: ["friend-chatgpt", "friend-claude"],
          sharedSystemPromptEnabled: false,
          sharedSystemPrompt: "",
          platformFeatureEnabled: false,
          preferredPlatform: "gemini",
          synthesisFriendId: "friend-claude"
        },
        conversations: []
      },
      null,
      2
    ),
    "utf8"
  );

  try {
    await withServer(8791, async () => {
      const response = await fetch("http://127.0.0.1:8791/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friends: [
            { id: "friend-chatgpt", modelConfigId: "chatgpt", enabled: true },
            { id: "friend-stale", modelConfigId: "claude", enabled: true }
          ]
        })
      });

      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.friends.map((friend) => friend.id), ["friend-chatgpt", "friend-stale", "friend-claude"]);

      const groupSettingsResponse = await fetch("http://127.0.0.1:8791/api/group-settings");
      const { groupSettings } = await groupSettingsResponse.json();
      assert.deepEqual(groupSettings.memberIds, ["friend-chatgpt"]);
      assert.equal(groupSettings.synthesisFriendId, "friend-chatgpt");

      const persisted = JSON.parse(await readFile(DATA_FILE, "utf8"));
      assert.deepEqual(persisted.friends.map((friend) => friend.id), ["friend-chatgpt", "friend-stale", "friend-claude"]);
      assert.deepEqual(persisted.groupSettings.memberIds, ["friend-chatgpt"]);
      assert.equal(persisted.groupSettings.synthesisFriendId, "friend-chatgpt");
    });
  } finally {
    if (backup === null) {
      if (existsSync(DATA_FILE)) {
        await rm(DATA_FILE);
      }
      try {
        await stat(DATA_DIR);
      } catch {
        return;
      }
    } else {
      await writeFile(DATA_FILE, backup, "utf8");
    }
  }
});

test("initial DB creation seeds group membership from usable model-backed friends", async () => {
  const backup = existsSync(DATA_FILE) ? await readFile(DATA_FILE, "utf8") : null;
  if (existsSync(DATA_FILE)) {
    await rm(DATA_FILE);
  }

  try {
    await withServer(8792, async () => {
      const response = await fetch("http://127.0.0.1:8792/api/group-settings");
      assert.equal(response.status, 200);
      const { groupSettings } = await response.json();
      const persisted = JSON.parse(await readFile(DATA_FILE, "utf8"));

      assert.deepEqual(groupSettings.memberIds, persisted.friends.map((friend) => friend.id));
      assert.equal(groupSettings.synthesisFriendId, persisted.friends[0].id);
    });
  } finally {
    if (backup === null) {
      if (existsSync(DATA_FILE)) {
        await rm(DATA_FILE);
      }
    } else {
      await writeFile(DATA_FILE, backup, "utf8");
    }
  }
});
