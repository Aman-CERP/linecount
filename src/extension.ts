import * as vscode from 'vscode';
import { ConfigurationService } from './services/ConfigurationService';
import { CacheService } from './services/CacheService';
import { FileClassifierService } from './services/FileClassifierService';
import { LineCounterService } from './services/LineCounterService';
import { LineCountDecorationProvider } from './providers/FileDecorationProvider';
import { registerRefreshCommand } from './commands/refreshCommand';

export function activate(context: vscode.ExtensionContext): void {
  const config = new ConfigurationService();
  const cache = new CacheService(config);
  const classifier = new FileClassifierService(config);
  const counter = new LineCounterService(classifier, cache, config);
  const provider = new LineCountDecorationProvider(counter, classifier, cache, config);

  context.subscriptions.push(
    config,
    cache,
    counter,
    provider,
    vscode.window.registerFileDecorationProvider(provider),
    registerRefreshCommand(provider, cache),
  );
}

export function deactivate(): void {}
