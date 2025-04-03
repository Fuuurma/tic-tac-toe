export const formatTime = (timeInMs: number): string => {
  const seconds = Math.floor(timeInMs / 1000);
  return `${seconds}s`;
};
