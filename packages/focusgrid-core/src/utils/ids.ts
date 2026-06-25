let fallbackId = 0;

export function createId(prefix = "node"): string {
  const cryptoLike = globalThis.crypto;

  if (cryptoLike && "randomUUID" in cryptoLike) {
    return `${prefix}-${cryptoLike.randomUUID()}`;
  }

  fallbackId += 1;
  return `${prefix}-${fallbackId}`;
}
