export type SetLogOperation = "create" | "update";

export function getSetLogOperation(
  setNumber: number,
  loggedSetNumbers: number[],
  plannedSetCount: number,
): SetLogOperation | null {
  if (
    !Number.isInteger(setNumber) ||
    setNumber < 1 ||
    setNumber > plannedSetCount
  ) {
    return null;
  }

  if (loggedSetNumbers.includes(setNumber)) return "update";

  const nextSetNumber = Math.max(0, ...loggedSetNumbers) + 1;
  return setNumber === nextSetNumber ? "create" : null;
}
