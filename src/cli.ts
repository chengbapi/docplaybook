#!/usr/bin/env node

import path from 'node:path';
import { Command } from 'commander';
import { getConfigPath, initWorkspaceConfig, loadConfig } from './config.js';
import { loadWorkspaceEnv } from './env.js';
import { formatCliError } from './errors.js';
import { detectWorkspaceSourceLanguage } from './init/detect-language.js';
import {
  ensureModelEnvForInit,
  prepareInitModel,
  resolveInitModelConfig,
  testModelConnection
} from './init/model-setup.js';
import { canPrompt, confirmSourceLanguage, promptTargetLanguages } from './init/prompts.js';
import type { LayoutKind, ModelKind } from './types.js';
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
          envSetup: undefined
        };
    const resolvedModel = preparedModel.model;
    const envSetup =
      preparedModel.envSetup ?? (await ensureModelEnvForInit(workspaceRoot, resolvedModel));

    if (!interactiveModelSetup && envSetup.ready) {
      console.log('');
      console.log(`Testing model connectivity for ${resolvedModel.kind}...`);
      await testModelConnection(resolvedModel);
      console.log('Model connectivity check passed.');
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
      model: resolvedModel,
      force: options.force
    });

    console.log(`Initialized docplaybook in ${workspaceRoot}`);

    if (envSetup.wroteValues) {
      console.log(`Saved provider settings to ${envSetup.envPath}`);
    }

    if (!envSetup.ready) {
      console.log('');
      console.log('Skipped the first translation because required model credentials are not configured yet.');
      console.log(`Missing: ${envSetup.missingLabels.join(', ')}`);
      console.log(`Add them to ${envSetup.envPath} and run:`);
      console.log(`  docplaybook ${workspaceRoot} --once`);
      return;
    }

    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);
    await agent.runOnce();
  });

program
  .argument('[workspace]', 'Workspace folder to watch', '.')
  .option('--once', 'Process current changes once and exit', false)
  .action(async (workspace, options) => {
    const workspaceRoot = path.resolve(workspace);
    await loadWorkspaceEnv(workspaceRoot);
    const config = await loadConfig(workspaceRoot);
    const agent = new WorkspaceAgent(workspaceRoot, config);

    if (options.once) {
      await agent.runOnce();
      return;
    }

    await agent.watch();
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(formatCliError(error));
  process.exit(1);
});
