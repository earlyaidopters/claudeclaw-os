import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '..', 'dist', 'schedule-cli.js');
const PROJECT_DIR = path.resolve(__dirname, '..');
const TEST_DB_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function withTestEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DB_ENCRYPTION_KEY: TEST_DB_ENCRYPTION_KEY,
    ...overrides,
  };
}

describe('schedule-cli agent routing', () => {
  // These tests run the actual CLI as a child process to verify env var behavior

  it('auto-detects agent from CLAUDECLAW_AGENT_ID env var', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test auto-detect" "0 9 * * *"`,
      withTestEnv({ CLAUDECLAW_AGENT_ID: 'comms' }),
    );

    expect(result).toContain('Agent:        comms');
  });

  it('--agent flag overrides CLAUDECLAW_AGENT_ID env var', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test override" "0 9 * * *" --agent ops`,
      withTestEnv({ CLAUDECLAW_AGENT_ID: 'comms' }),
    );

    expect(result).toContain('Agent:        ops');
  });

  it('defaults to main when no env var and no --agent flag', () => {
    const result = createAndTrack(
      `node "${CLI_PATH}" create "test default" "0 9 * * *"`,
      withTestEnv({ CLAUDECLAW_AGENT_ID: undefined }),
    );

    expect(result).toContain('Agent:        main');
  });

  // Track task IDs created during tests for targeted cleanup
  const createdTaskIds: string[] = [];

  // Monkey-patch: extract task ID from CLI output
  function createAndTrack(cmd: string, env: Record<string, string | undefined>): string {
    const result = execSync(cmd, { cwd: PROJECT_DIR, env, encoding: 'utf-8' });
    const match = result.match(/Task created:\s+([a-f0-9]+)/);
    if (match) createdTaskIds.push(match[1]);
    return result;
  }

  afterEach(() => {
    // Only delete tasks we created, not pre-existing ones
    for (const id of createdTaskIds) {
      try {
        execSync(`node "${CLI_PATH}" delete ${id}`, { cwd: PROJECT_DIR, env: withTestEnv() });
      } catch {
        // ignore if already gone
      }
    }
    createdTaskIds.length = 0;
  });
});
