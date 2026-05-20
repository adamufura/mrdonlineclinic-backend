export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildSearchOr(fields: string[], term: string): Record<string, unknown>[] {
  const rx = new RegExp(escapeRegex(term.trim()), 'i');
  return fields.map((f) => ({ [f]: rx }));
}
