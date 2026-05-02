/**
 * Validates incoming WebSocket messages.
 *
 * A valid message must be a non-null object with at least a `type` field
 * that is a non-empty string.
 *
 * @param message - The raw incoming message payload (unknown type).
 * @returns `true` if the message is valid, `false` otherwise.
 */
export function validateWebSocketMessage(message: unknown): boolean {
  if (message === null || typeof message !== 'object') {
    return false;
  }

  const msg = message as Record<string, unknown>;

  if (typeof msg['type'] !== 'string' || msg['type'].length === 0) {
    return false;
  }

  return true;
}
