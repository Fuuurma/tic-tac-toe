const ROOM_ID_PATTERN = /^[a-zA-Z0-9_-]{4,64}$/;

export const normalizeRoomId = (value: string | null | undefined): string => {
  const roomId = value?.trim() ?? "";
  return ROOM_ID_PATTERN.test(roomId) ? roomId : "";
};
