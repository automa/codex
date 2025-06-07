import { FastifyInstance } from 'fastify';
import { verifyWebhook, type WebhookPayload } from '@automa/bot';
import { ATTR_HTTP_REQUEST_HEADER } from '@opentelemetry/semantic-conventions/incubating';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { env } from '../../env';

import { automa, openai } from '../../clients';
import { update } from '../../update';

const PullRequest = z.object({
  title: z.string().max(72),
  body: z.string(),
});

const generatePrFields = async (description: string) => {
  const response = await openai.responses.parse({
    model: 'gpt-4.1-mini',
    instructions:
      'Generate a github pull request title (should be short) and body (using markdown) based on the description given by the user. Make sure to not include any diffs in pull request body.',
    input: description,
    text: {
      format: zodTextFormat(PullRequest, 'pr'),
    },
  });

  return response.output_parsed;
};

export default async function (app: FastifyInstance) {
  app.post<{
    Body: WebhookPayload;
  }>('/automa', async (request, reply) => {
    const id = request.headers['webhook-id'] as string;
    const signature = request.headers['webhook-signature'] as string;
    const timestamp = Date.now();

    // Verify request
    if (!verifyWebhook(env.AUTOMA.WEBHOOK_SECRET, signature, request.body)) {
      app.log.warn(
        {
          'http.request.id': request.id,
          [ATTR_HTTP_REQUEST_HEADER('webhook-id')]: id,
          [ATTR_HTTP_REQUEST_HEADER('webhook-signature')]: signature,
        },
        'Invalid signature',
      );

      return reply.unauthorized();
    }

    app.log.info(
      {
        'http.request.id': request.id,
        [ATTR_HTTP_REQUEST_HEADER('webhook-id')]: id,
        [ATTR_HTTP_REQUEST_HEADER('webhook-signature')]: signature,
      },
      'Webhook verified',
    );

    const baseURL = request.headers['x-automa-server-host'] as string;

    await app.events.processTask.publish(
      `${request.body.data.task.id}-${timestamp}`,
      {
        baseURL,
        data: request.body.data,
      },
    );

    return reply.send();
  });
}

export const runUpdate = async (
  app: FastifyInstance,
  baseURL: string,
  data: WebhookPayload['data'],
) => {
  // Download code
  const folder = await automa.code.download(data, { baseURL });

  try {
    // Modify code
    const message = await update(app, folder, data);

    const prFields = await generatePrFields(message);

    // Propose code
    await automa.code.propose(
      {
        ...data,
        proposal: {
          title: prFields?.title,
          body: prFields?.body,
        },
      },
      {
        baseURL,
      },
    );
  } finally {
    // Clean up
    automa.code.cleanup(data);
  }
};
