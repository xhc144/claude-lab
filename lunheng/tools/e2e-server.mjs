#!/usr/bin/env node
// Test harness: protocol mock + a Lunheng instance on a throwaway data directory.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMockServer } from './mock-providers.mjs';
import { createApp } from '../server/app.mjs';

const appPort = Number(process.env.E2E_APP_PORT || 18848);
const mockPort = Number(process.env.E2E_MOCK_PORT || 18849);
const dir = await mkdtemp(join(tmpdir(), 'lunheng-e2e-'));
const { server: mock } = createMockServer({ delayMs: Number(process.env.MOCK_DELAY ?? 8) });
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const app = await createApp({ dataDir: dir, port: appPort, allowPrivateHosts: true, signup: 'open' });
await new Promise((r) => app.server.listen(appPort, '127.0.0.1', r));
console.log(`e2e: app http://127.0.0.1:${appPort}  mock http://127.0.0.1:${mockPort}  data ${dir}`);
const stop = async () => { await app.close().catch(() => {}); mock.close(); await rm(dir, { recursive: true, force: true }); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
