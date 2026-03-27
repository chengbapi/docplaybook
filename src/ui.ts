import { stdout } from 'node:process';

const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  magenta: '\u001b[35m',
  cyan: '\u001b[36m',
  red: '\u001b[31m'
} as const;

let colorEnabled = Boolean(stdout.isTTY && !process.env.NO_COLOR);

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

function apply(code: string, value: string): string {
  if (!colorEnabled) {
    return value;
  }

  return `${code}${value}${ANSI.reset}`;
}

export function bold(value: string): string {
  return apply(ANSI.bold, value);
}

export function dim(value: string): string {
  return apply(ANSI.dim, value);
}

export function blue(value: string): string {
  return apply(ANSI.blue, value);
}

export function cyan(value: string): string {
  return apply(ANSI.cyan, value);
}

export function green(value: string): string {
  return apply(ANSI.green, value);
}

export function yellow(value: string): string {
  return apply(ANSI.yellow, value);
}

export function red(value: string): string {
  return apply(ANSI.red, value);
}

export function magenta(value: string): string {
  return apply(ANSI.magenta, value);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

export function label(name: string, color: 'blue' | 'cyan' | 'green' | 'yellow' | 'red' | 'magenta'): string {
  const rendered = `[${name}]`;

  switch (color) {
    case 'blue':
      return blue(bold(rendered));
    case 'cyan':
      return cyan(bold(rendered));
    case 'green':
      return green(bold(rendered));
    case 'yellow':
      return yellow(bold(rendered));
    case 'red':
      return red(bold(rendered));
    case 'magenta':
      return magenta(bold(rendered));
  }
}
