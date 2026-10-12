export function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function parseSseBuffer(buffer: string): { events: { event: string; data: unknown }[]; rest: string } {
  const events: { event: string; data: unknown }[] = [];
  let rest = buffer;
  let idx: number;
  while ((idx = rest.indexOf("\n\n")) !== -1) {
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7);
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    events.push({ event, data: data ? JSON.parse(data) : null });
  }
  return { events, rest };
}
