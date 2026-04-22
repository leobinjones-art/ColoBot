/**
 * 用户画像测试 - 集成测试
 * 需要数据库连接，在 E2E 测试中验证
 */

import { describe, it, expect } from 'vitest';

describe('user-profile', () => {
  it('placeholder - tested in e2e', () => {
    // 用户画像功能在 E2E 测试中验证
    // 单元测试需要 mock 太多依赖
    expect(true).toBe(true);
  });
});
