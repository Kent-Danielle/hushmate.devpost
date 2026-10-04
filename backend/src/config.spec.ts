import { loadConfig } from './config.js';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  VAPID_SUBJECT: 'mailto:a@example.com',
  APP_URL: 'http://localhost:5173',
  FRONTEND_ORIGINS: 'http://localhost:5173, https://hushmate.example',
};

describe('loadConfig', () => {
  it('parses a valid environment', () => {
    const config = loadConfig(valid);
    expect(config.port).toBe(3000);
    expect(config.schedulerEnabled).toBe(true);
    expect(config.frontendOrigins).toEqual(['http://localhost:5173', 'https://hushmate.example']);
  });

  it.each(Object.keys(valid).filter((k) => k !== 'FRONTEND_ORIGINS'))('fails when %s is missing', (key) => {
    const env: NodeJS.ProcessEnv = { ...valid };
    delete env[key];
    expect(() => loadConfig(env)).toThrow(key);
  });

  it('rejects a JWT_SECRET shorter than 32 bytes', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow(/32 bytes/);
  });

  it('turns the scheduler off only when SCHEDULER_ENABLED is "false"', () => {
    expect(loadConfig({ ...valid, SCHEDULER_ENABLED: 'false' }).schedulerEnabled).toBe(false);
  });
});
