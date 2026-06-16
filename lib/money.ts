export function parseMoneyToCents(input: string) {
  const normalized = input.replace(/[$,]/g, "").trim();
  if (!normalized) throw new Error("Missing amount");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid amount");
  return Math.round(value * 100);
}
