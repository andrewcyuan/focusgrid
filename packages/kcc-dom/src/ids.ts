export function getKCEntryDomId(rootId: string, entryId: string): string {
  return `${rootId}-item-${sanitizeDomIdPart(entryId)}`;
}

function sanitizeDomIdPart(value: string): string {
  const sanitized = value.trim().replace(/[^A-Za-z0-9_-]+/g, "-");

  return sanitized || "entry";
}
