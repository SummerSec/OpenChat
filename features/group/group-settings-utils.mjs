export function countSelectedGroupMembers({ memberIds = [], availableFriends = [] } = {}) {
  if (!Array.isArray(memberIds) || !Array.isArray(availableFriends) || !memberIds.length || !availableFriends.length) {
    return 0;
  }

  const availableFriendIds = new Set(
    availableFriends
      .filter((friend) => friend && typeof friend.id === "string" && friend.id)
      .map((friend) => friend.id)
  );

  return memberIds.filter((id) => availableFriendIds.has(id)).length;
}
