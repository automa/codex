import { join } from 'node:path';

import { FastifyInstance } from 'fastify';
import { CodeFolder, WebhookEventData, WebhookEventType } from '@automa/bot';
import { $ } from 'zx';

export const update = async (
  app: FastifyInstance,
  folder: CodeFolder,
  data: WebhookEventData<WebhookEventType.TaskCreated>,
) => {
  const codex = join(__dirname, '..', '..', 'node_modules', '.bin', 'codex');

  const description = data.task.items
    .filter(({ type }) => type === 'message')
    .map(({ data }) => `<description>${(data as any).content}</description>`)
    .join('\n');

  const message = `<title>${data.task.title}</title>${description}`;

  const result = await $({
    cwd: folder.path,
  })`${codex} --approval-mode full-auto -q ${message}`;

  let completedMsg;

  try {
    completedMsg = JSON.parse(
      result.stdout.split('\n').filter(Boolean).slice(-1)[0],
    );
  } catch (error) {
    app.log.error(
      {
        error,
      },
      'Failed to parse codex output',
    );

    throw new Error('Failed to parse codex output');
  }

  if (
    completedMsg.type !== 'message' ||
    completedMsg.status !== 'completed' ||
    !Array.isArray(completedMsg.content) ||
    !completedMsg.content[0] ||
    completedMsg.content[0].type !== 'output_text'
  ) {
    app.log.error(
      {
        result: completedMsg,
      },
      'Codex did not complete the task',
    );

    throw new Error('Codex did not complete the task');
  }

  const finalMessage = completedMsg.content[0].text;

  // Make sure all created files are tracked
  await folder.addAll();

  return finalMessage;
};
