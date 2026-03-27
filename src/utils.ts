import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${String(value)}`);
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
