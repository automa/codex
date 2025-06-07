import { dirname, join } from 'node:path';

import { Static, Type } from '@sinclair/typebox';
import envSchema from 'nested-env-schema';

import './telemetry';

// @ts-ignore
import pkg from '../package.json';

export const environment = process.env.NODE_ENV || 'development';

export const isTest = environment === 'test';
export const isProduction = !isTest && environment !== 'development';

export const product = 'bots';
export const service = 'codex';
export const version = pkg.version;

const schema = Type.Object({
  AUTOMA: Type.Object({
    WEBHOOK_SECRET: Type.String({
      default: 'atma_whsec_codex',
    }),
  }),
  OPENAI: Type.Object({
    API_KEY: Type.String({
      default: 'openai_api_key',
    }),
  }),
  PORT: Type.Number({
    default: 5007,
  }),
  REDIS_URL: Type.String({
    default: 'redis://localhost:6379',
  }),
  SENTRY_DSN: Type.String({
    default: '',
  }),
});

type Schema = Static<typeof schema>;

export const env = envSchema<Schema>({
  schema,
  dotenv: {
    path: join(dirname(__dirname), '.env'),
  },
});
