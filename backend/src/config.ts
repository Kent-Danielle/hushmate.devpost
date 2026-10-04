// Env is read once here. Boot fails loudly if a required value is missing,
// even for values only later slices use (JWT, VAPID, APP_URL).

export interface AppConfig {
  databaseUrl: string;
  jwtSecret: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  appUrl: string;
  frontendOrigins: string[];
  demoAccountPassword: string | undefined;
  schedulerEnabled: boolean;
  port: number;
}

const REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'APP_URL',
] as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const missing = REQUIRED.filter((key) => !env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const jwtSecret = env.JWT_SECRET as string;
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be at least 32 bytes');
  }
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid port number');
  }
  return {
    databaseUrl: env.DATABASE_URL as string,
    jwtSecret,
    vapidPublicKey: env.VAPID_PUBLIC_KEY as string,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY as string,
    vapidSubject: env.VAPID_SUBJECT as string,
    appUrl: env.APP_URL as string,
    frontendOrigins: (env.FRONTEND_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    demoAccountPassword: env.DEMO_ACCOUNT_PASSWORD || undefined,
    schedulerEnabled: env.SCHEDULER_ENABLED !== 'false',
    port,
  };
}

let cached: AppConfig | undefined;

/** Validated config, read from process.env on first use. */
export function getConfig(): AppConfig {
  cached ??= loadConfig();
  return cached;
}
