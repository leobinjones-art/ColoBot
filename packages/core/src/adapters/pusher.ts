/**
 * 结果推送实现
 */

import type { ResultPusher } from '../runtime/types.js';

export interface PusherConfig {
  onResult?: (agentId: string, sessionKey: string, content: unknown) => void;
  onChunk?: (agentId: string, sessionKey: string, chunk: string) => void;
  onDone?: (agentId: string, sessionKey: string) => void;
}

export class CallbackPusher implements ResultPusher {
  private onResultCallback?: PusherConfig['onResult'];
  private onChunkCallback?: PusherConfig['onChunk'];
  private onDoneCallback?: PusherConfig['onDone'];

  constructor(config: PusherConfig = {}) {
    this.onResultCallback = config.onResult;
    this.onChunkCallback = config.onChunk;
    this.onDoneCallback = config.onDone;
  }

  pushResult(agentId: string, sessionKey: string, content: unknown): void {
    this.onResultCallback?.(agentId, sessionKey, content);
  }

  pushChunk(agentId: string, sessionKey: string, chunk: string): void {
    this.onChunkCallback?.(agentId, sessionKey, chunk);
  }

  pushDone(agentId: string, sessionKey: string): void {
    this.onDoneCallback?.(agentId, sessionKey);
  }
}

/**
 * 控制台推送 - 输出到控制台
 */
export class ConsolePusher implements ResultPusher {
  pushResult(_agentId: string, _sessionKey: string, content: unknown): void {
    console.log('\n=== Result ===');
    console.log(content);
    console.log('=== End ===\n');
  }

  pushChunk(_agentId: string, _sessionKey: string, chunk: string): void {
    process.stdout.write(chunk);
  }

  pushDone(_agentId: string, _sessionKey: string): void {
    console.log('\n[Done]');
  }
}
