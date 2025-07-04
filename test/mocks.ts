// @ts-ignore
import quibble from 'quibble';
import { createSandbox } from 'sinon';

export const quibbleSandbox = createSandbox();

export const zxCmdArgsStub = quibbleSandbox.stub();
export const zxCmdStub = quibbleSandbox.stub().returns(zxCmdArgsStub);

quibble('zx', { $: zxCmdStub });
