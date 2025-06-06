import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { assert } from 'chai';
import sinon, { SinonStub } from 'sinon';
import { generateWebhookSignature } from '@automa/bot';

import { env } from '../src/env';

import { automa } from '../src/clients';

import { call, server } from './utils';

const payload = {
  id: 'whmsg_1',
  timestamp: '2025-05-30T09:30:06.261Z',
};

const callWithFixture = async (app: FastifyInstance, fileName: string) => {
  const body = JSON.parse(
    readFileSync(join(__dirname, 'fixtures', `${fileName}.json`), 'utf8'),
  );

  const signature = generateWebhookSignature(env.AUTOMA.WEBHOOK_SECRET, body);

  return call(app, '/hooks/automa', {
    method: 'POST',
    headers: {
      'webhook-signature': signature,
      'x-automa-server-host': 'https://api.automa.app',
    },
    payload: body,
  });
};

suite('automa hook', () => {
  let app: FastifyInstance, response: LightMyRequestResponse;
  let downloadStub: SinonStub, proposeStub: SinonStub, cleanupStub: SinonStub;

  suiteSetup(async () => {
    app = await server();
  });

  suiteTeardown(async () => {
    await app.close();
  });

  setup(() => {
    downloadStub = sinon
      .stub(automa.code, 'download')
      .resolves(join(__dirname, 'fixtures', 'code'));

    proposeStub = sinon.stub(automa.code, 'propose').resolves();

    cleanupStub = sinon.stub(automa.code, 'cleanup').resolves();
  });

  teardown(() => {
    downloadStub.restore();
    proposeStub.restore();
    cleanupStub.restore();
  });

  test('with no signature should return 401', async () => {
    const response = await call(app, '/hooks/automa', {
      method: 'POST',
      headers: {},
      payload: {},
    });

    assert.equal(response.statusCode, 401);
  });

  test('with invalid signature should return 401', async () => {
    const response = await call(app, '/hooks/automa', {
      method: 'POST',
      headers: {
        'webhook-signature': 'invalid',
      },
      payload,
    });

    assert.equal(response.statusCode, 401);
  });

  suite('with valid signature', () => {
    setup(async () => {
      response = await callWithFixture(app, 'task');
    });

    test('should return 200', async () => {
      assert.equal(response.statusCode, 200);
    });

    test('should have empty body', async () => {
      assert.isEmpty(response.body);
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should propose code', async () => {
      assert.equal(proposeStub.callCount, 1);
      assert.deepEqual(proposeStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
          proposal: {
            message: '',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
        },
      ]);
    });
  });

  suite('with download error', () => {
    setup(async () => {
      downloadStub.rejects(new Error('Download error'));

      response = await callWithFixture(app, 'task');
    });

    test('should return 500', async () => {
      assert.equal(response.statusCode, 500);
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should not propose code', async () => {
      assert.equal(proposeStub.callCount, 0);
    });

    test('should not cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 0);
    });
  });

  suite('with propose error', () => {
    setup(async () => {
      proposeStub.rejects(new Error('Propose error'));

      response = await callWithFixture(app, 'task');
    });

    test('should return 500', async () => {
      assert.equal(response.statusCode, 500);
    });

    test('should download code', async () => {
      assert.equal(downloadStub.callCount, 1);
      assert.deepEqual(downloadStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should propose code', async () => {
      assert.equal(proposeStub.callCount, 1);
      assert.deepEqual(proposeStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
          proposal: {
            message: '',
          },
        },
        {
          baseURL: 'https://api.automa.app',
        },
      ]);
    });

    test('should cleanup code', async () => {
      assert.equal(cleanupStub.callCount, 1);
      assert.deepEqual(cleanupStub.firstCall.args, [
        {
          task: {
            id: 1,
            token: 'abcdef',
            title: 'Running github-runners on monorepo',
          },
        },
      ]);
    });
  });
});
