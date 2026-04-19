/**
 * Mock executor module for runtime tests.
 * All functions are mock functions with sensible default behavior.
 */
import { vi } from 'vitest';

export const parseToolCalls = vi.fn().mockReturnValue([]);
export const executeToolCalls = vi.fn().mockResolvedValue([]);
export const formatToolResults = vi.fn().mockReturnValue([]);
export const isToolAllowed = vi.fn().mockResolvedValue(true);
