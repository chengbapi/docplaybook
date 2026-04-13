import readline from 'node:readline';
import type { LearnJudgement } from '../types.js';
import { bold, cyan, dim, green, label, magenta, yellow } from '../ui.js';

export interface ReviewedCandidate {
  judgement: LearnJudgement;
  action: 'accept' | 'skip';
  editedRule?: string; // set when user edited the proposedRule
}

/**
 * Interactively reviews a list of LearnJudgement candidates one by one.
 * Returns the list with user decisions (accept/skip) and any edits applied.
 */
export async function reviewCandidatesInteractively(
  candidates: LearnJudgement[],
  targetLanguage: string
): Promise<ReviewedCandidate[]> {
  const actionable = candidates.filter((c) => c.shouldLearn && c.scope !== 'ignore');
  if (actionable.length === 0) {
    return [];
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const results: ReviewedCandidate[] = [];

  console.log('');
  console.log(`${label('learn', 'magenta')} Found ${actionable.length} candidate(s) for ${bold(targetLanguage)}:`);

  for (let i = 0; i < actionable.length; i++) {
    const item = actionable[i]!;
    console.log('');
    printCandidate(item, targetLanguage, i + 1, actionable.length);

    const action = await promptAction(rl);

    if (action === 'quit') {
      console.log(dim('  Stopped. Remaining candidates skipped.'));
      for (let j = i; j < actionable.length; j++) {
        results.push({ judgement: actionable[j]!, action: 'skip' });
      }
      break;
    }

    if (action === 'skip') {
      results.push({ judgement: item, action: 'skip' });
      continue;
    }

    if (action === 'edit') {
      const edited = await promptEdit(rl, item.proposedRule);
      results.push({ judgement: item, action: 'accept', editedRule: edited });
      continue;
    }

    results.push({ judgement: item, action: 'accept' });
  }

  rl.close();
  return results;
}

function printCandidate(item: LearnJudgement, lang: string, index: number, total: number): void {
  const scopeLabel = formatScopeLabel(item.scope, lang);
  console.log(`${scopeLabel}  ${dim(`[${index}/${total}]`)}`);
  console.log(`  ${bold(item.proposedRule)}`);
  if (item.reason) {
    console.log(`  ${dim(item.reason)}`);
  }
  console.log(`  ${cyan('(a)')}ccept  ${yellow('(e)')}dit  ${dim('(s)')}kip  ${dim('(q)')}uit`);
}

function formatScopeLabel(scope: LearnJudgement['scope'], lang: string): string {
  switch (scope) {
    case 'glossary':
      return `${label('Glossary', 'green')} ${dim(lang)}`;
    case 'memory':
      return `${label('Memory', 'magenta')} ${dim(lang)}`;
    case 'playbook':
      return `${label('Playbook', 'cyan')} ${dim('cross-language')}`;
    default:
      return `${label(scope, 'cyan')} ${dim(lang)}`;
  }
}

async function promptAction(rl: readline.Interface): Promise<'accept' | 'edit' | 'skip' | 'quit'> {
  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      switch (answer.trim().toLowerCase()) {
        case 'a': return resolve('accept');
        case 'e': return resolve('edit');
        case 's': return resolve('skip');
        case 'q': return resolve('quit');
        default:
          console.log(dim('  Please enter a, e, s, or q.'));
          resolve(promptAction(rl));
      }
    });
  });
}

async function promptEdit(rl: readline.Interface, current: string): Promise<string> {
  return new Promise((resolve) => {
    console.log(dim(`  Current: ${current}`));
    rl.question('  Edit > ', (answer) => {
      const trimmed = answer.trim();
      resolve(trimmed.length > 0 ? trimmed : current);
    });
  });
}
