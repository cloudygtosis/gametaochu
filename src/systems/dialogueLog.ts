export interface LogEntry {
  speaker: string;
  text: string;
}

class DialogueLog {
  private entries: LogEntry[] = [];
  private readonly limit = 200;

  push(entry: LogEntry): void {
    const last = this.entries[this.entries.length - 1];
    if (last && last.speaker === entry.speaker && last.text === entry.text) return;
    this.entries.push(entry);
    if (this.entries.length > this.limit) this.entries.shift();
  }

  all(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export const dialogueLog = new DialogueLog();
