import { join } from 'node:path';

import { FastifyInstance } from 'fastify';
import { assert } from 'chai';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { CodeFolder, WebhookPayload } from '@automa/bot';

import { server } from '../utils';

import { automa, openai } from '../../src/clients';
import processTask from '../../src/events/jobs/processTask';
import { quibbleSandbox, zxCmdArgsStub, zxCmdStub } from '../mocks';

const data = {
  task: {
    id: 1,
    token: 'abcdef',
    title: 'Fix a minor bug',
    items: [],
  },
  repo: {
    id: 1,
    name: 'monorepo',
    is_private: true,
  },
  org: {
    id: 1,
    name: 'automa',
    provider_type: 'github',
  },
} as WebhookPayload['data'];

const dataWithDescription = {
  ...data,
  task: {
    ...data.task,
    items: [
      {
        id: 1,
        type: 'message',
        data: {
          content: 'It does not work',
        },
      },
    ],
  },
} as WebhookPayload['data'];

const codeFixture = join(__dirname, '..', 'fixtures', 'code');

const openAIRequestData = {
  model: 'gpt-4.1-mini',
  instructions:
    'Generate a github pull request title (should be short) and body (using markdown) based on the description given by the user. Make sure to not include any diffs in pull request body.',
  input: 'Task completed successfully',
  text: {
    format: {
      name: 'pr',
      schema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        additionalProperties: false,
        properties: {
          body: {
            type: 'string',
          },
          title: {
            maxLength: 72,
            type: 'string',
          },
        },
        required: ['title', 'body'],
        type: 'object',
      },
      strict: true,
      type: 'json_schema',
    },
  },
};

suite('events/processTask', () => {
  let app: FastifyInstance, sandbox: SinonSandbox;
  let parseStub: SinonStub;
  let downloadStub: SinonStub, proposeStub: SinonStub, cleanupStub: SinonStub;

  suiteSetup(async () => {
    app = await server();
    sandbox = createSandbox();
  });

  suiteTeardown(async () => {
    await app.close();
  });

  setup(() => {
    zxCmdArgsStub.resolves({
      stdout: [
        JSON.stringify({
          type: 'message',
          status: 'completed',
          content: [
            { type: 'output_text', text: 'Task completed successfully' },
          ],
        }),
        '',
      ].join('\n'),
    });

    parseStub = sandbox.stub(openai.responses, 'parse').resolves(
      // @ts-ignore
      {
        output_parsed: {
          title: 'Fix a minor bug',
          body: 'This PR fixes a minor bug.',
        },
      },
    );

    downloadStub = sandbox
      .stub(automa.code, 'download')
      .resolves(new CodeFolder(codeFixture));

    proposeStub = sandbox.stub(automa.code, 'propose').resolves();

    cleanupStub = sandbox.stub(automa.code, 'cleanup').resolves();
  });

  teardown(() => {
    zxCmdArgsStub.resetBehavior();
    quibbleSandbox.resetHistory();
    sandbox.restore();
  });

  suite('with no task description', () => {
    setup(async () => {
      await processTask.handler?.(app, {
        baseURL: 'https://api.automa.app',
        data,
      });
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title>',
      ]);
    });

    test('should generate PR fields', async () => {
      assert.equal(parseStub.callCount, 1);
      assert.deepEqual(parseStub.firstCall.args, [openAIRequestData]);
    });

    test('should propose code', async () => {
      assert.equal(proposeStub.callCount, 1);
      assert.deepEqual(proposeStub.firstCall.args, [
        {
          ...data,
          proposal: {
            title: 'Fix a minor bug',
            body: 'This PR fixes a minor bug.',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [data]);
    });
  });

  suite('with task description', () => {
    setup(async () => {
      await processTask.handler?.(app, {
        baseURL: 'https://api.automa.app',
        data: dataWithDescription,
      });
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        dataWithDescription,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title><description>It does not work</description>',
      ]);
    });

    test('should generate PR fields', async () => {
      assert.equal(parseStub.callCount, 1);
      assert.deepEqual(parseStub.firstCall.args, [openAIRequestData]);
    });

    test('should propose code', async () => {
      assert.equal(proposeStub.callCount, 1);
      assert.deepEqual(proposeStub.firstCall.args, [
        {
          ...dataWithDescription,
          proposal: {
            title: 'Fix a minor bug',
            body: 'This PR fixes a minor bug.',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [dataWithDescription]);
    });
  });

  suite('with download error', () => {
    let error: any;

    setup(async () => {
      downloadStub.rejects(new Error('Download error'));

      try {
        await processTask.handler?.(app, {
          baseURL: 'https://api.automa.app',
          data,
        });
      } catch (err) {
        error = err;
      }
    });

    test('should throw error', () => {
      assert.instanceOf(error, Error);
      assert.equal(error.message, 'Download error');
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should not run codex', () => {
      assert.equal(zxCmdStub.callCount, 0);
      assert.equal(zxCmdArgsStub.callCount, 0);
    });

    test('should not generate PR fields', async () => {
      assert.equal(parseStub.callCount, 0);
    });

    test('should not propose code', async () => {
      assert.equal(proposeStub.callCount, 0);
    });

    test('should not cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 0);
    });
  });

  suite('with codex error', () => {
    let error: any;

    setup(async () => {
      zxCmdArgsStub.rejects(new Error('Codex error'));

      try {
        await processTask.handler?.(app, {
          baseURL: 'https://api.automa.app',
          data,
        });
      } catch (err) {
        error = err;
      }
    });

    test('should throw error', () => {
      assert.instanceOf(error, Error);
      assert.equal(error.message, 'Codex error');
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title>',
      ]);
    });

    test('should not generate PR fields', async () => {
      assert.equal(parseStub.callCount, 0);
    });

    test('should not propose code', async () => {
      assert.equal(proposeStub.callCount, 0);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [data]);
    });
  });

  suite('with codex non-JSON output', () => {
    let error: any;

    setup(async () => {
      zxCmdArgsStub.resolves({
        stdout: 'bad',
      });

      try {
        await processTask.handler?.(app, {
          baseURL: 'https://api.automa.app',
          data,
        });
      } catch (err) {
        error = err;
      }
    });

    test('should throw error', () => {
      assert.instanceOf(error, Error);
      assert.equal(error.message, 'Failed to parse codex output');
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title>',
      ]);
    });

    test('should not generate PR fields', async () => {
      assert.equal(parseStub.callCount, 0);
    });

    test('should not propose code', async () => {
      assert.equal(proposeStub.callCount, 0);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [data]);
    });
  });

  suite('with codex non-completed output', () => {
    let error: any;

    setup(async () => {
      zxCmdArgsStub.resolves({
        stdout: JSON.stringify({
          type: 'message',
          status: 'non-completed',
          content: [{ type: 'output_text', text: 'Task not completed' }],
        }),
      });

      try {
        await processTask.handler?.(app, {
          baseURL: 'https://api.automa.app',
          data,
        });
      } catch (err) {
        error = err;
      }
    });

    test('should throw error', () => {
      assert.instanceOf(error, Error);
      assert.equal(error.message, 'Codex did not complete the task');
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title>',
      ]);
    });

    test('should not generate PR fields', async () => {
      assert.equal(parseStub.callCount, 0);
    });

    test('should not propose code', async () => {
      assert.equal(proposeStub.callCount, 0);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [data]);
    });
  });

  suite('with propose error', () => {
    let error: any;

    setup(async () => {
      proposeStub.rejects(new Error('Propose error'));

      try {
        await processTask.handler?.(app, {
          baseURL: 'https://api.automa.app',
          data,
        });
      } catch (err) {
        error = err;
      }
    });

    test('should throw error', () => {
      assert.instanceOf(error, Error);
      assert.equal(error.message, 'Propose error');
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        data,
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should run codex', async () => {
      assert.equal(zxCmdStub.callCount, 1);
      assert.deepEqual(zxCmdStub.firstCall.args, [
        {
          cwd: codeFixture,
        },
      ]);
      assert.equal(zxCmdArgsStub.callCount, 1);
      assert.deepEqual(zxCmdArgsStub.firstCall.args, [
        ['', ' --approval-mode full-auto -q ', ''],
        `${join(__dirname, '..', '..')}/node_modules/.bin/codex`,
        '<title>Fix a minor bug</title>',
      ]);
    });

    test('should generate PR fields', async () => {
      assert.equal(parseStub.callCount, 1);
      assert.deepEqual(parseStub.firstCall.args, [openAIRequestData]);
    });

    test('should propose code', async () => {
      assert.equal(proposeStub.callCount, 1);
      assert.deepEqual(proposeStub.firstCall.args, [
        {
          ...data,
          proposal: {
            title: 'Fix a minor bug',
            body: 'This PR fixes a minor bug.',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [data]);
    });
  });
});
