#!/usr/bin/env node

/**
 * Syto CLI — Execute workflows headlessly
 *
 * Commands:
 *   syto run <workflow>      Execute a workflow with bound data files
 *   syto validate <workflow> Validate a workflow without executing
 *   syto schema <file>       Inspect a data file's schema
 *
 * See docs/WORKFLOW-FORMAT-V2.md for the workflow format specification.
 */

// Initialize i18n (English only, no Preact bindings)
import './i18n/core';

import { runRunCommand, RunOptions } from './cli/run-command';
import { runValidateCommand, ValidateOptions } from './cli/validate-command';
import { runSchemaCommand, SchemaOptions } from './cli/schema-command';

// TODO(2026-09-21): this is hardcoded and three minor versions behind
// package.json (0.4.1), so `syto --help` reports a version that has not existed
// since May. AGENTS.md names package.json's `version` the single source of
// truth, and vite injects it as `__APP_VERSION__` — but the CLI is bundled by
// esbuild, which defines nothing, and `npx tsx src/cli.ts` runs with no bundler
// at all. The fix needs both paths: `--define:__APP_VERSION__` in the build:cli
// script, and a runtime read of package.json for the tsx path. Found by running
// the CLI, which is the only way it is visible — every test asserts on this
// constant rather than on package.json.
const VERSION = '0.1.0';

function printUsage(): void {
  console.log(
    `
syto v${VERSION} — Data wrangling CLI

Usage:
  syto run <workflow.json> [options]     Execute a workflow
  syto validate <workflow.json> [options] Validate a workflow
  syto schema <file> [options]           Inspect file schema

Options for run:
  --bind name=file   Bind a source to a data file (repeatable)
  --output, -o path  Output file or directory
  --json             Output JSON instead of CSV
  --strict           Treat warnings as errors

Options for validate:
  --bind name=file   Bind a source for schema validation (repeatable)
  --json             Output validation results as JSON

Options for schema:
  --json             Output schema as JSON

Exit codes:
  0  Success
  1  Invalid arguments or missing files
  2  Workflow validation error
  3  Binding error (missing bindings, schema mismatch)
  4  Transform execution error
`.trim()
  );
}

function parseBindings(args: string[]): Map<string, string> {
  const bindings = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--bind' && i + 1 < args.length) {
      const [name, ...rest] = args[i + 1].split('=');
      if (name && rest.length > 0) {
        bindings.set(name, rest.join('='));
      }
      i++;
    }
  }
  return bindings;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getOption(args: string[], flag: string, altFlag?: string): string | null {
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === flag || args[i] === altFlag) && i + 1 < args.length) {
      return args[i + 1];
    }
  }
  return null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printUsage();
    process.exit(0);
  }

  if (hasFlag(args, '--version') || hasFlag(args, '-v')) {
    console.log(`syto v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];
  const positional = args[1];

  if (!positional && command !== '--help' && command !== '-h') {
    console.error(`Error: Missing argument. Run "syto --help" for usage.`);
    process.exit(1);
  }

  switch (command) {
    case 'run': {
      const options: RunOptions = {
        workflowFile: positional,
        bindings: parseBindings(args),
        output: getOption(args, '--output', '-o'),
        json: hasFlag(args, '--json'),
        strict: hasFlag(args, '--strict'),
      };
      const exitCode = await runRunCommand(options);
      process.exit(exitCode);
      break;
    }

    case 'validate': {
      const options: ValidateOptions = {
        workflowFile: positional,
        bindings: parseBindings(args),
        json: hasFlag(args, '--json'),
      };
      const exitCode = runValidateCommand(options);
      process.exit(exitCode);
      break;
    }

    case 'schema': {
      const options: SchemaOptions = {
        file: positional,
        json: hasFlag(args, '--json'),
      };
      try {
        runSchemaCommand(options);
        process.exit(0);
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Error: Unknown command "${command}". Run "syto --help" for usage.`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
