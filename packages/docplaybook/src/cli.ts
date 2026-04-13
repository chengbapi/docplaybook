#!/usr/bin/env node

import path from 'node:path';
import { Command } from 'commander';
import { getConfigPath, initWorkspaceConfig, loadConfig } from './config.js';
import { loadWorkspaceEnv } from './env.js';
import { formatCliError } from './errors.js';
import { detectWorkspaceSourceLanguage } from './init/detect-language.js';
import { detectWorkspaceLayout } from './init/detect-layout.js';
import {
  ensureModelEnvForInit,
  getModelOverrideEnvValues,
  prepareInitModel,
  resolveInitModelConfig,
  testModelConnection
} from './init/model-setup.js';
import { getWorkspaceLocalEnvPath, writeWorkspaceEnvValues } from './env.js';
import { canPrompt, confirmSourceLanguage, promptBootstrapNow, promptTargetLanguages } from './init/prompts.js';
import type { LayoutKind, ModelKind } from './types.js';
import { bold, cyan, green, label, setColorEnabled, setDebugEnabled, setVerboseEnabled, yellow } from './ui.js';
import { pathExists, unique } from './utils.js';
import { WorkspaceAgent, resolveWorkspaceAndPath } from './service/workspace-agent.js';
import { createLayoutAdapter } from './layouts/index.js';
import { LocalFolderProvider } from './providers/local-folder-provider.js';
import { createObservability } from './observability.js';

function parseTargets(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveSelectedTargetLanguages(
  config: { targetLanguages: string[] },
  values?: { langs?: string; lang?: string } | string
): string[] {
  const value = typeof values === 'string' ? values : values?.langs ?? values?.lang;
  if (
    values &&
    typeof values !== 'string' &&
    values.langs &&
    values.lang &&
    values.langs !== values.lang
  ) {
    throw new Error(`Conflicting language filters: --langs=${values.langs} and --lang=${values.lang}.`);
  }

  if (!value) {
    return config.targetLanguages;
  }

  const requested: string[] = unique(parseTargets(value));
  const invalid = requested.filter((language: string) => !config.targetLanguages.includes(language));

  if (invalid.length > 0) {
    throw new Error(
      `Unknown target language(s): ${invalid.join(', ')}. Available targetLanguages: ${config.targetLanguages.join(', ')}`
    );
  }

  return requested;
}


const program = new Command();

program
  .name('docplaybook')
  .description('A CLI for Markdown translation sync, reusable translation memory, and translation health review.')
  .version('0.1.0');

program.option('--no-color', 'Disable color output');
program.option('--verbose', 'Show detailed processing logs');
program.option('--debug', 'Show debug-level logs, including payload details');
program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  setColorEnabled(Boolean(opts.color ?? true));
  setDebugEnabled(Boolean(opts.debug ?? false));
  setVerboseEnabled(Boolean(opts.verbose ?? false) || Boolean(opts.debug ?? false));
});

program
  .command('init')
  .argument('[workspace]', 'Workspace folder to initialize', '.')
  .option('--source <language>', 'Source language')
  .option('--targets <languages>', 'Comma-separated target languages')
  .option('--layout <layout>', 'Layout preset')
  .option(
    '--model-kind <kind>',
    'Model config kind: gateway, openai, anthropic, or openai-compatible',
    'openai'
  )
  .option('--model <model>', 'Model identifier')
  .option('--api-key-env <name>', 'Environment variable used for the API key')
  .option('--auth-token-env <name>', 'Anthropic auth token environment variable')
  .option('--provider-name <name>', 'Provider name for openai-compatible mode')
  .option('--base-url-env <name>', 'Environment variable used for the base URL')
  .option('--force', 'Overwrite config and seed files if they already exist', false)
  .action(async (workspace, options, command) => {
    const workspaceRoot = path.resolve(workspace);
    await loadWorkspaceEnv(workspaceRoot);
    const layoutKindExplicit = command.getOptionValueSource('layout') === 'cli';
    const modelKind = options.modelKind as ModelKind;
    const modelKindExplicit = command.getOptionValueSource('modelKind') === 'cli';
    const existingConfig = (await pathExists(getConfigPath(workspaceRoot)))
      ? await loadConfig(workspaceRoot)
      : null;
    const detectedLayout = !layoutKindExplicit ? await detectWorkspaceLayout(workspaceRoot) : null;
    const layoutKind =
      (layoutKindExplicit ? (options.layout as LayoutKind | undefined) : undefined) ??
      existingConfig?.layout.kind ??
      detectedLayout?.kind ??
      'sibling';

    if (!existingConfig || options.force) {
      if (detectedLayout) {
        console.log(
          `${label('layout', 'cyan')} Detected ${bold(detectedLayout.kind)} layout, because ${detectedLayout.reason}.`
        );
      } else if (!layoutKindExplicit) {
        console.log(
          `${label('layout', 'yellow')} No Docusaurus or Rspress layout detected. Using ${bold('sibling')} layout.`
        );
      }
    }
    const modelFlagsExplicit = [
      'modelKind',
      'model',
      'apiKeyEnv',
      'authTokenEnv',
      'providerName',
      'baseUrlEnv'
    ].some((name) => command.getOptionValueSource(name) === 'cli');
    const existingModel = existingConfig?.model;
    const modelOptions = {
      modelKind: modelKindExplicit ? modelKind : existingModel?.kind,
      model: options.model ?? existingModel?.model,
      apiKeyEnv: options.apiKeyEnv ?? existingModel?.apiKeyEnv,
      authTokenEnv:
        options.authTokenEnv ??
        (existingModel?.kind === 'anthropic' ? existingModel.authTokenEnv : undefined),
      providerName:
        options.providerName ??
        (existingModel?.kind === 'openai-compatible'
          ? existingModel.providerName
          : undefined),
      baseUrlEnv:
        options.baseUrlEnv ??
        (existingModel && existingModel.kind !== 'gateway'
          ? existingModel.baseUrlEnv
          : undefined)
    };

    const interactiveModelSetup = canPrompt() && !modelFlagsExplicit;
    const preparedModel = interactiveModelSetup
      ? await prepareInitModel(workspaceRoot, modelOptions)
      : {
          model:
            existingConfig && !modelFlagsExplicit
              ? existingConfig.model
              : await resolveInitModelConfig(modelOptions),
          envSetup: undefined,
          scope: 'workspace' as const
        };
    const resolvedModel = preparedModel.model;
    const envSetup =
      preparedModel.envSetup ?? (await ensureModelEnvForInit(workspaceRoot, resolvedModel));

    if (!interactiveModelSetup && envSetup.ready) {
      console.log('');
      console.log(`${cyan(bold('Testing model connectivity'))} ${resolvedModel.kind}`);
      await testModelConnection(resolvedModel);
      console.log(green('Model connectivity check passed.'));
    }

    const sourceLanguage =
      options.source ||
      existingConfig?.sourceLanguage ||
      (await confirmSourceLanguage(await detectWorkspaceSourceLanguage(workspaceRoot)));

    const requestedTargets = options.targets
      ? parseTargets(options.targets)
      : await promptTargetLanguages(existingConfig?.targetLanguages ?? []);
    const mergedTargets = [
      ...(existingConfig?.targetLanguages ?? []),
      ...requestedTargets
    ];

    await initWorkspaceConfig({
      workspaceRoot,
      sourceLanguage,
      targetLanguages: mergedTargets,
      layoutKind,
      model: preparedModel.scope === 'workspace' ? resolvedModel : undefined,
      force: options.force
    });

    if (preparedModel.scope === 'local') {
      const overrideValues = getModelOverrideEnvValues(resolvedModel);
      await writeWorkspaceEnvValues(workspaceRoot, overrideValues);
      for (const [key, value] of Object.entries(overrideValues)) {
        process.env[key] = value;
      }
    }

    console.log(`${green(bold('Initialized docplaybook'))} ${workspaceRoot}`);

    if (envSetup.wroteValues) {
      console.log(`${label('env', 'green')} Saved provider settings to ${envSetup.envPath}`);
    }

    if (preparedModel.scope === 'local') {
      console.log(`${label('model', 'cyan')} Provider/model are stored locally in ${getWorkspaceLocalEnvPath(workspaceRoot)}.`);
      console.log(`${label('hint', 'cyan')} Edit ${bold(getConfigPath(workspaceRoot))} if you want to lock them for everyone later.`);
    }

    const bootstrapConfig = await loadConfig(workspaceRoot);
    const layoutAdapter = createLayoutAdapter(bootstrapConfig.layout.kind);
    const provider = new LocalFolderProvider(workspaceRoot, bootstrapConfig.ignorePatterns ?? []);
    const docSets = layoutAdapter.buildDocSets(
      await provider.scanTranslatableFiles(bootstrapConfig.layout.kind),
      workspaceRoot,
      bootstrapConfig
    );
    const existingTargetLanguages = mergedTargets.filter((language) =>
      docSets.some((docSet) => docSet.targets[language]?.exists)
    );

    if (existingTargetLanguages.length > 0) {
      console.log(
        `${label('bootstrap', 'cyan')} Found existing translated docs for ${bold(existingTargetLanguages.join(', '))}.`
      );
      console.log(
        `${label('next', 'cyan')} Run ${bold(`docplaybook bootstrap ${workspaceRoot} --langs ${existingTargetLanguages.join(',')}`)} to build the first playbook and language memories.`
      );

      if (await promptBootstrapNow(existingTargetLanguages)) {
        const bootstrapAgent = new WorkspaceAgent(workspaceRoot, bootstrapConfig);
        await bootstrapAgent.bootstrapOnceForLanguages(existingTargetLanguages);
      }
    } else {
      console.log(`${label('next', 'cyan')} Run ${bold(`docplaybook ${workspaceRoot}`)} to learn and translate once.`);
    }
  });

program
  .command('bootstrap')
  .argument('[workspace]', 'Workspace folder to bootstrap from existing translations', '.')
  .option('--langs <languages>', 'Comma-separated target languages to bootstrap')
  .option('--lang <language>', 'Single target language to bootstrap')
  .action(async (workspace, options) => {
    const workspaceRoot = path.resolve(workspace);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);
    if (!options.langs && !options.lang) {
      throw new Error('bootstrap requires --langs <languages> or --lang <language>.');
    }
    await agent.bootstrapOnceForLanguages(resolveSelectedTargetLanguages(config, options));
  });

program
  .command('translate')
  .argument('[path]', 'Workspace root or path to a file/directory within the workspace', '.')
  .option('--langs <languages>', 'Comma-separated target languages to process')
  .option('--lang <language>', 'Single target language to process')
  .option('--force', 'Ignore saved source-hash state and retranslate all matching targets', false)
  .option('--dry', 'Preview what would be translated without calling any LLM', false)
  .action(async (rawPath, options) => {
    const { workspaceRoot, pathFilter } = await resolveWorkspaceAndPath(rawPath);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const observability = createObservability();
    const agent = new WorkspaceAgent(workspaceRoot, config, observability);
    try {
      await agent.translateOnceForLanguages(
        resolveSelectedTargetLanguages(config, options),
        { force: Boolean(options.force), dry: Boolean(options.dry), pathFilter }
      );
    } finally {
      await observability.flush();
    }
  });

program
  .command('learn')
  .argument('[path]', 'Workspace root or path to a file/directory within the workspace', '.')
  .option('--langs <languages>', 'Comma-separated target languages to process')
  .option('--lang <language>', 'Single target language to process')
  .option('--force', 'Ignore saved learned-target state and relearn all matching targets', false)
  .option('--no-interactive', 'Save all candidates automatically without confirmation')
  .action(async (rawPath, options) => {
    const { workspaceRoot, pathFilter } = await resolveWorkspaceAndPath(rawPath);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);
    await agent.learnOnceForLanguages(
      resolveSelectedTargetLanguages(config, options),
      { force: Boolean(options.force), interactive: Boolean(options.interactive), pathFilter }
    );
  });

program
  .command('status')
  .argument('[workspace]', 'Workspace folder to inspect', '.')
  .action(async (workspace) => {
    const workspaceRoot = path.resolve(workspace);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);
    await agent.statusForWorkspace();
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`${label('error', 'red')} ${formatCliError(error)}`);
  process.exit(1);
});
