export function shouldBootstrapDefaultFriends(storedFriendsRaw = null, incomingModels = []) {
  return (storedFriendsRaw === null || storedFriendsRaw === "") && Array.isArray(incomingModels) && incomingModels.length > 0;
}
