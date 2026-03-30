import path from 'node:path';
import type { LayoutKind } from '../types.js';
import { pathExists } from '../utils.js';

export interface DetectedLayout {
  kind: LayoutKind;
  reason: string;
}

const DOCUSAURUS_CONFIG_FILES = [
  'docusaurus.config.ts',
  'docusaurus.config.js',
  'docusaurus.config.mjs',
  'docusaurus.config.cjs'
];

const RSPRESS_CONFIG_FILES = [
  'rspress.config.ts',
  'rspress.config.js',
  'rspress.config.mjs',
  'rspress.config.cjs',
  path.join('docs', '.rspress', 'config.ts'),
  path.join('docs', '.rspress', 'config.js'),
  path.join('docs', '.rspress', 'config.mjs'),
  path.join('docs', '.rspress', 'config.cjs'),
  path.join('.rspress', 'config.ts'),
  path.join('.rspress', 'config.js'),
  path.join('.rspress', 'config.mjs'),
  path.join('.rspress', 'config.cjs')
];

export async function detectWorkspaceLayout(workspaceRoot: string): Promise<DetectedLayout | null> {
  if (await hasAnyPath(workspaceRoot, RSPRESS_CONFIG_FILES)) {
    return {
      kind: 'rspress',
      reason: 'found an Rspress config file'
    };
  }

  if (await hasAnyPath(workspaceRoot, DOCUSAURUS_CONFIG_FILES)) {
    return {
      kind: 'docusaurus',
      reason: 'found a Docusaurus config file'
    };
  }

  return null;
}

async function hasAnyPath(workspaceRoot: string, candidates: string[]): Promise<boolean> {
  for (const candidate of candidates) {
    if (await pathExists(path.join(workspaceRoot, candidate))) {
      return true;
    }
  }

  return false;
}
