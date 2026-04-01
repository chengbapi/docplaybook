#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname));
const CASES_DIR = path.join(ROOT, 'cases');
const RESULTS_DIR = path.join(ROOT, 'results');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const cases = await loadCases(options);
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  if (options.list) {
    for (const testCase of cases) {
      output.write(`${testCase.category} :: ${testCase.id} [${testCase.kind}]\n`);
      output.write(`  ${testCase.title}\n`);
    }
    return;
  }

  const rl = createInterface({ input, output });
  try {
    const reviewer = (await rl.question('Reviewer name: ')).trim() || 'anonymous';
    const model = (await rl.question('Model under review (optional): ')).trim();
    const notes = (await rl.question('Run label or branch (optional): ')).trim();
    const commit = await getGitHead();
    const reviewedAt = new Date().toISOString();
    const results = [];

    for (const testCase of cases) {
      output.write(`\n=== ${testCase.category.toUpperCase()} :: ${testCase.id} :: ${testCase.kind.toUpperCase()} CASE ===\n`);
      output.write(`${testCase.title}\n`);
      output.write(`${testCase.why_this_case_exists}\n\n`);
      output.write(`Command: ${testCase.command}\n`);
      output.write('\nThis case assumes:\n');
      for (const line of testCase.setup) {
        output.write(`- ${line}\n`);
      }
      output.write('\nExample input or pattern:\n');
      for (const line of formatInput(testCase.input)) {
        output.write(`- ${line}\n`);
      }
      output.write('\nExpected result:\n');
      for (const line of testCase.expected) {
        output.write(`- ${line}\n`);
      }
      output.write('\nShould NOT happen:\n');
      for (const line of testCase.should_not_happen) {
        output.write(`- ${line}\n`);
      }
      output.write('\nAfter you inspect the real output from DocPlaybook, rate this case.\n');

      const status = await askStatus(rl);
      if (status === 'skip') {
        results.push({
          caseId: testCase.id,
          category: testCase.category,
          status,
          score: null,
          confidence: null,
          notes: ''
        });
        continue;
      }

      const score = await askInteger(rl, 'Score 0-5: ', 0, 5);
      const confidence = await askInteger(rl, 'Confidence 1-3: ', 1, 3);
      const detail = (await rl.question('Notes: ')).trim();

      results.push({
        caseId: testCase.id,
        category: testCase.category,
        status,
        score,
        confidence,
        notes: detail
      });
    }

    const summary = summarize(results);
    const payload = {
      reviewer,
      model,
      runLabel: notes,
      commit,
      reviewedAt,
      results,
      summary
    };

    const filename = `${reviewedAt.replace(/[:.]/g, '-')}.json`;
    const resultPath = path.join(RESULTS_DIR, filename);
    await fs.writeFile(resultPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    output.write('\nSaved review run:\n');
    output.write(`${resultPath}\n`);
    output.write(`Passed: ${summary.pass}, Mixed: ${summary.mixed}, Failed: ${summary.fail}, Skipped: ${summary.skip}\n`);
    output.write(`Average score: ${summary.averageScore}\n`);
  } finally {
    rl.close();
  }
}

async function loadCases(options = {}) {
  const categories = await fs.readdir(CASES_DIR);
  const entries = [];

  for (const category of categories.sort()) {
    const categoryDir = path.join(CASES_DIR, category);
    const stat = await fs.stat(categoryDir);
    if (!stat.isDirectory()) {
      continue;
    }

    const files = (await fs.readdir(categoryDir)).filter((file) => file.endsWith('.json')).sort();
    for (const file of files) {
      const raw = await fs.readFile(path.join(categoryDir, file), 'utf8');
      const entry = JSON.parse(raw);
      if (options.category && entry.category !== options.category) {
        continue;
      }
      if (options.caseId && entry.id !== options.caseId) {
        continue;
      }
      entries.push(entry);
    }
  }

  return entries;
}

async function askStatus(rl) {
  while (true) {
    const answer = (await rl.question('Did this case pass, partially pass, fail, or do you want to skip it? [pass/mixed/fail/skip]: ')).trim().toLowerCase();
    if (answer === 'pass' || answer === 'mixed' || answer === 'fail' || answer === 'skip') {
      return answer;
    }
  }
}

async function askInteger(rl, prompt, min, max) {
  while (true) {
    const answer = (await rl.question(prompt)).trim();
    const value = Number(answer);
    if (Number.isInteger(value) && value >= min && value <= max) {
      return value;
    }
  }
}

function summarize(results) {
  const summary = {
    pass: 0,
    mixed: 0,
    fail: 0,
    skip: 0,
    averageScore: 0
  };

  let scoreCount = 0;
  let scoreSum = 0;
  for (const entry of results) {
    summary[entry.status] += 1;
    if (typeof entry.score === 'number') {
      scoreCount += 1;
      scoreSum += entry.score;
    }
  }

  summary.averageScore = scoreCount > 0 ? Number((scoreSum / scoreCount).toFixed(2)) : 0;
  return summary;
}

async function getGitHead() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd: path.resolve(ROOT, '..', '..'),
      encoding: 'utf8'
    });
    return stdout.trim();
  } catch {
    return '';
  }
}

function parseArgs(argv) {
  const options = {
    category: '',
    caseId: '',
    list: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--list') {
      options.list = true;
      continue;
    }
    if (arg === '--category' && argv[index + 1]) {
      options.category = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--category=')) {
      options.category = arg.slice('--category='.length);
      continue;
    }
    if (arg === '--case' && argv[index + 1]) {
      options.caseId = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--case=')) {
      options.caseId = arg.slice('--case='.length);
    }
  }

  return options;
}

function formatInput(value, prefix = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => formatInput(item, `${prefix}${prefix ? '.' : ''}${index}`));
  }

  if (value && typeof value === 'object') {
    const lines = [];
    for (const [key, nested] of Object.entries(value)) {
      if (nested && typeof nested === 'object') {
        const childLines = formatInput(nested, prefix ? `${prefix}.${key}` : key);
        lines.push(...childLines);
      } else {
        lines.push(`${prefix ? `${prefix}.` : ''}${key}: ${String(nested)}`);
      }
    }
    return lines;
  }

  return [`${prefix}: ${String(value)}`];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
