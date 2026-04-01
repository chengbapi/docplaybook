#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const RESULTS_DIR = path.join(ROOT, 'results');

async function main() {
  let files = [];
  try {
    files = (await fs.readdir(RESULTS_DIR)).filter((file) => file.endsWith('.json')).sort();
  } catch {
    console.log('No review results found.');
    return;
  }

  if (files.length === 0) {
    console.log('No review results found.');
    return;
  }

  const runs = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(RESULTS_DIR, file), 'utf8');
    runs.push(JSON.parse(raw));
  }

  const perCase = new Map();
  for (const run of runs) {
    for (const result of run.results) {
      const existing = perCase.get(result.caseId) ?? {
        caseId: result.caseId,
        category: result.category,
        pass: 0,
        mixed: 0,
        fail: 0,
        skip: 0,
        scoreSum: 0,
        scoreCount: 0
      };

      existing[result.status] += 1;
      if (typeof result.score === 'number') {
        existing.scoreSum += result.score;
        existing.scoreCount += 1;
      }

      perCase.set(result.caseId, existing);
    }
  }

  console.log(`Review runs: ${runs.length}`);
  console.log('');
  for (const item of [...perCase.values()].sort((left, right) => left.caseId.localeCompare(right.caseId))) {
    const average = item.scoreCount > 0 ? (item.scoreSum / item.scoreCount).toFixed(2) : 'n/a';
    console.log(`${item.caseId}`);
    console.log(`  pass=${item.pass} mixed=${item.mixed} fail=${item.fail} skip=${item.skip} avg=${average}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
