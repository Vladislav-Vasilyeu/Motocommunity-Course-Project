export function parseCoordinate(value: unknown, max: number) {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= max ? coordinate : null;
}
