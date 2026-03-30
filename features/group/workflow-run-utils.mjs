export function getWorkflowPreflightState({
  prompt = "",
  friendProfiles = [],
  activeFriends = []
} = {}) {
  if (!Array.isArray(friendProfiles) || friendProfiles.length === 0) {
    return "missing_friends";
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return "missing_prompt";
  }

  if (!Array.isArray(activeFriends) || activeFriends.length === 0) {
    return "missing_active_friends";
  }

  return "ready";
}
