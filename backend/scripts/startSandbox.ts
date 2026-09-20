import 'dotenv/config';
import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.env.SANDBOX_PORT || 5000);
const API_URL = `http://127.0.0.1:${PORT}`;
const SUPER_ADMIN_EMAIL = 'superadmin@local.test';
const HOSTEL_ADMIN_EMAIL = 'admin@demo-hostel.test';

function createPassword() {
  return `Local!${randomBytes(12).toString('base64url')}9a`;
}

async function waitForServer(server: ChildProcess) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Sandbox API exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(`${API_URL}/health/db`);
      if (response.ok) return;
    } catch {
      // The API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the sandbox API.');
}

async function main() {
  const cacheDirectory = path.resolve(__dirname, '../.cache/mongodb-binaries');
  fs.mkdirSync(cacheDirectory, { recursive: true });
  process.env.MONGOMS_DOWNLOAD_DIR = cacheDirectory;

  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  console.log('Starting a disposable local MongoDB database...');
  const database = await MongoMemoryReplSet.create({
    binary: { version: '7.0.14', downloadDir: cacheDirectory },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  const superAdminPassword = createPassword();
  const hostelAdminPassword = createPassword();
  const sandboxEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(PORT),
    DATABASE_URL: database.getUri('hostelhub-local-sandbox'),
    JWT_ACCESS_SECRET: randomBytes(48).toString('base64url'),
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_NAME: 'Local Super Admin',
    SUPER_ADMIN_PASSWORD: superAdminPassword,
    SEED_HOSTEL_ADMIN_PASSWORD: hostelAdminPassword,
    BACKEND_URL: API_URL,
    ALLOWED_ORIGINS: '',
  };

  let server: ChildProcess | undefined;
  let shuttingDown = false;
  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (server && server.exitCode === null) {
      server.kill('SIGTERM');
      await Promise.race([
        new Promise<void>((resolve) => server!.once('exit', () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 2_000)),
      ]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
    await Promise.race([
      database.stop({ doCleanup: true, force: true }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    process.exit(exitCode);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  try {
    console.log('Loading isolated demo data...');
    const seedResult = spawnSync(
      process.execPath,
      [path.resolve(__dirname, '../node_modules/ts-node/dist/bin.js'), path.resolve(__dirname, '../prisma/seed.ts')],
      { cwd: path.resolve(__dirname, '..'), env: sandboxEnvironment, stdio: 'inherit' },
    );
    if (seedResult.status !== 0) throw new Error(`Sandbox seed failed with code ${seedResult.status}.`);

    server = spawn(process.execPath, [path.resolve(__dirname, '../dist/index.js')], {
      cwd: path.resolve(__dirname, '..'), env: sandboxEnvironment, stdio: 'inherit',
    });
    server.once('exit', (code) => {
      if (!shuttingDown) void shutdown(code || 1);
    });
    await waitForServer(server);

    console.log('\nLocal multi-tenant sandbox is ready.');
    console.log(`API: ${API_URL}`);
    console.log(`Super Admin:  ${SUPER_ADMIN_EMAIL} / ${superAdminPassword}`);
    console.log(`Hostel Admin: ${HOSTEL_ADMIN_EMAIL} / ${hostelAdminPassword}`);
    console.log('Data is temporary and is deleted when this command stops. Press Ctrl+C to stop.\n');
  } catch (error) {
    console.error(error);
    await shutdown(1);
  }
}

void main();
