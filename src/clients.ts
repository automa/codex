import { env } from './env';

import Automa from '@automa/bot';
import OpenAI from 'openai';

export const automa = new Automa();

export const openai = new OpenAI({
  apiKey: env.OPENAI.API_KEY,
});
