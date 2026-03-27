#!/usr/bin/env node

import path from 'node:path';
import { Command } from 'commander';
import { getConfigPath, initWorkspaceConfig, loadConfig } from './config.js';
import { loadWorkspaceEnv } from './env.js';
import { formatCliError } from './errors.js';
import { detectWorkspaceSourceLanguage } from './init/detect-language.js';
import {
  ensureModelEnvForInit,
  getModelOverrideEnvValues,
  prepareInitModel,
  resolveInitModelConfig,
  testModelConnection
} from './init/model-setup.js';
import { getWorkspaceLocalEnvPath, writeWorkspaceEnvValues } from './env.js';
import { canPrompt, confirmSourceLanguage, promptTargetLanguages } from './init/prompts.js';
import type { LayoutKind, ModelKind } from './types.js';
import { bold, cyan, green, label, setColorEnabled, yellow } from './ui.js';
import { pathExists } from './utils.js';
import { WorkspaceAgent } from './service/workspace-agent.js';

function parseTargets(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const program = new Command();

program
  .name('docplaybook')
  .description('A local-first CLI for Markdown translation sync and reusable translation memory.')
  .version('0.1.0');

program.option('--no-color', 'Disable color output');
program.hook('preAction', (_thisCommand, actionCommand) => {
  const opts = actionCommand.optsWithGlobals();
  setColorEnabled(Boolean(opts.color ?? true));
});

program
  .command('init')
  .argument('[workspace]', 'Workspace folder to initialize', '.')
  .option('--source <language>', 'Source language')
  .option('--targets <languages>', 'Comma-separated target languages')
  .option('--layout <layout>', 'Layout preset', 'sibling')
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
    const layoutKind = options.layout as LayoutKind;
    const modelKind = options.modelKind as ModelKind;
    const modelKindExplicit = command.getOptionValueSource('modelKind') === 'cli';
    const existingConfig = (await pathExists(getConfigPath(workspaceRoot)))
      ? await loadConfig(workspaceRoot)
      : null;
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

    console.log(`${label('next', 'cyan')} Run ${bold(`docplaybook ${workspaceRoot}`)} to translate once.`);
  });

program
  .argument('[workspace]', 'Workspace folder to process', '.')
  .action(async (workspace) => {
    const workspaceRoot = path.resolve(workspace);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);

    await agent.runOnce();
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`${label('error', 'red')} ${formatCliError(error)}`);
  process.exit(1);
});
