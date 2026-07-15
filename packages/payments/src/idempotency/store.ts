export interface IdempotencyRecord<T> {
  key: string;
  result: T;
  createdAt: string;
}

export interface IdempotencyStore {
  get<T>(key: string): IdempotencyRecord<T> | undefined;
  set<T>(key: string, result: T): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord<unknown>>();

  get<T>(key: string): IdempotencyRecord<T> | undefined {
    const record = this.records.get(key);
    return record as IdempotencyRecord<T> | undefined;
  }

  set<T>(key: string, result: T): void {
    this.records.set(key, {
      key,
      result,
      createdAt: new Date().toISOString(),
    });
  }

  has(key: string): boolean {
    return this.records.has(key);
  }

  delete(key: string): boolean {
    return this.records.delete(key);
  }

  clear(): void {
    this.records.clear();
  }
}
