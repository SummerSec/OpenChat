export function shouldBootstrapDefaultFriends(storedFriendsRaw = null, incomingModels = []) {
  return (storedFriendsRaw === null || storedFriendsRaw === "") && Array.isArray(incomingModels) && incomingModels.length > 0;
}

export function resolveFriendProfilesForScope({
  storedFriendsRaw = null,
  storedFriends = [],
  incomingModels = [],
  createDefaultFriendProfiles = () => []
} = {}) {
  if (shouldBootstrapDefaultFriends(storedFriendsRaw, incomingModels)) {
    return createDefaultFriendProfiles(incomingModels);
  }
  return Array.isArray(storedFriends) ? storedFriends : [];
}
