export function shouldBootstrapDefaultFriends(storedFriendsRaw = null, incomingModels = []) {
  return (storedFriendsRaw === null || storedFriendsRaw === "") && Array.isArray(incomingModels) && incomingModels.length > 0;
}

export function createDefaultFriendFromModel(model = {}, getDefaultFriendSystemPrompt = () => "") {
  return {
    id: `friend-${model.id}`,
    name: model.name || "Friend",
    avatar: model.avatar || "",
    modelConfigId: model.id || "",
    systemPrompt: getDefaultFriendSystemPrompt(model.name || ""),
    enabled: true,
    description: model.description || ""
  };
}

export function syncDefaultFriendsWithModels(existingFriends = [], models = [], options = {}) {
  const getDefaultFriendSystemPrompt = options.getDefaultFriendSystemPrompt || (() => "");
  const nextFriends = Array.isArray(existingFriends) ? [...existingFriends] : [];
  const existingIds = new Set(nextFriends.map((friend) => friend.id));

  models.forEach((model) => {
    if (typeof model?.id !== "string" || !model.id) {
      return;
    }

    const defaultFriend = createDefaultFriendFromModel(model, getDefaultFriendSystemPrompt);
    if (!existingIds.has(defaultFriend.id)) {
      nextFriends.push(defaultFriend);
      existingIds.add(defaultFriend.id);
    }
  });

  return nextFriends;
}

export function getMissingDefaultFriendModelIds(friends = [], models = []) {
  const friendIds = new Set((Array.isArray(friends) ? friends : []).map((friend) => friend.id));
  return (Array.isArray(models) ? models : [])
    .filter((model) => model?.id && !friendIds.has(`friend-${model.id}`))
    .map((model) => model.id);
}

export function getUsableFriendIds(friends = [], models = []) {
  const enabledModelIds = new Set(
    (Array.isArray(models) ? models : []).filter((model) => model?.enabled !== false).map((model) => model.id)
  );

  return (Array.isArray(friends) ? friends : [])
    .filter((friend) => friend?.enabled !== false)
    .filter((friend) => typeof friend?.modelConfigId === "string" && friend.modelConfigId)
    .filter((friend) => enabledModelIds.has(friend.modelConfigId))
    .map((friend) => friend.id);
}

export function getInvalidFriendProfiles(friends = [], models = []) {
  const modelMap = new Map((Array.isArray(models) ? models : []).map((model) => [model?.id, model]));

  return (Array.isArray(friends) ? friends : [])
    .filter((friend) => typeof friend?.modelConfigId !== "string" || !friend.modelConfigId || !modelMap.has(friend.modelConfigId) || modelMap.get(friend.modelConfigId)?.enabled === false);
}

export function syncFriendsStateWithModels(friends = [], models = [], groupSettings = {}, options = {}) {
  const nextFriends = syncDefaultFriendsWithModels(friends, models, options);
  const enabledIds = nextFriends.filter((item) => item?.enabled !== false).map((item) => item.id);
  let memberIds = Array.isArray(groupSettings.memberIds)
    ? groupSettings.memberIds.filter((id) => enabledIds.includes(id))
    : [...enabledIds];

  if (!memberIds.length && enabledIds.length) {
    memberIds = [enabledIds[0]];
  }

  return {
    friends: nextFriends,
    groupSettings: {
      memberIds,
      sharedSystemPromptEnabled: Boolean(groupSettings.sharedSystemPromptEnabled),
      sharedSystemPrompt: String(groupSettings.sharedSystemPrompt || ""),
      platformFeatureEnabled: Boolean(groupSettings.platformFeatureEnabled),
      preferredPlatform: String(groupSettings.preferredPlatform || "gemini"),
      synthesisFriendId:
        memberIds.find((id) => id === groupSettings.synthesisFriendId) || memberIds[0] || null
    }
  };
}
