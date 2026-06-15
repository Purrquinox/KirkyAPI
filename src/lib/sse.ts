type Sender = (payload: string) => void;

const connections = new Map<string, Set<Sender>>();

export function addSSEConnection(userId: string, send: Sender): () => void {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId)!.add(send);
  return () => {
    const set = connections.get(userId);
    if (!set) return;
    set.delete(send);
    if (set.size === 0) connections.delete(userId);
  };
}

export function sendToUser(userId: string, event: string, data: unknown): void {
  const senders = connections.get(userId);
  if (!senders?.size) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  senders.forEach(send => send(payload));
}
