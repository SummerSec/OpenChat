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
