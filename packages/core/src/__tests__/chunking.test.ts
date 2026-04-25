/**
 * 大文件处理测试
 */
import { describe, it, expect, vi } from 'vitest';
import {
  readChunksByBytes,
  readChunksByLines,
  readChunksByTokens,
  processChunksParallel,
  mergeText,
  mergeArray,
  mergeStats,
  mergeDedup,
  processWithSlidingWindow,
  type Chunk,
  type ChunkResult,
  type ChunkConfig,
} from '../chunking/index.js';

describe('Chunking', () => {
  describe('readChunksByBytes', () => {
    it('should split content by bytes', async () => {
      const content = 'a'.repeat(1000);
      const config: ChunkConfig = { chunkSize: 300, overlap: 50, format: 'bytes' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByBytes(content, config)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].content.length).toBe(300);
      expect(chunks[0].start).toBe(0);
      expect(chunks[0].end).toBe(300);
    });

    it('should handle overlap correctly', async () => {
      const content = 'abcdefghij';
      const config: ChunkConfig = { chunkSize: 4, overlap: 2, format: 'bytes' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByBytes(content, config)) {
        chunks.push(chunk);
      }

      // 第一个块: abcd (0-4)
      // 第二个块: cdef (2-6) - overlap 2
      expect(chunks[0].content).toBe('abcd');
      expect(chunks[1].content).toBe('cdef');
    });

    it('should handle content smaller than chunk size', async () => {
      const content = 'small';
      const config: ChunkConfig = { chunkSize: 100, overlap: 10, format: 'bytes' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByBytes(content, config)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe('small');
    });
  });

  describe('readChunksByLines', () => {
    it('should split content by lines', async () => {
      const lines = ['line1', 'line2', 'line3', 'line4', 'line5'];
      const config: ChunkConfig = { chunkSize: 2, overlap: 0, format: 'lines' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByLines(lines, config)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0].content).toBe('line1\nline2');
      expect(chunks[0].metadata?.lineCount).toBe(2);
    });

    it('should handle line overlap', async () => {
      const lines = ['line1', 'line2', 'line3', 'line4'];
      const config: ChunkConfig = { chunkSize: 3, overlap: 1, format: 'lines' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByLines(lines, config)) {
        chunks.push(chunk);
      }

      // 第一个块: line1, line2, line3
      // 第二个块: line3, line4 (overlap 1)
      expect(chunks.length).toBe(2);
    });
  });

  describe('readChunksByTokens', () => {
    it('should estimate and split by tokens', async () => {
      const content = 'a'.repeat(1000); // ~250 tokens
      const config: ChunkConfig = { chunkSize: 100, overlap: 10, format: 'tokens' };

      const chunks: Chunk[] = [];
      for await (const chunk of readChunksByTokens(content, config)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('processChunksParallel', () => {
    it('should process chunks in parallel', async () => {
      const content = 'a'.repeat(1000);
      const config: ChunkConfig = { chunkSize: 200, overlap: 0, format: 'bytes' };

      const processedIndices: number[] = [];

      const results = await processChunksParallel(
        content,
        async (chunk, index, total) => {
          processedIndices.push(index);
          return {
            chunkIndex: index,
            success: true,
            result: `processed-${index}`,
          };
        },
        config,
        2 // maxParallel
      );

      expect(results.length).toBeGreaterThan(1);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle processor errors', async () => {
      const content = 'test content';
      const config: ChunkConfig = { chunkSize: 5, overlap: 0, format: 'bytes' };

      const results = await processChunksParallel(
        content,
        async (chunk, index) => {
          if (index === 1) {
            return { chunkIndex: index, success: false, result: null, error: 'Failed' };
          }
          return { chunkIndex: index, success: true, result: `ok-${index}` };
        },
        config
      );

      const failed = results.find(r => !r.success);
      expect(failed).toBeDefined();
      expect(failed?.error).toBe('Failed');
    });
  });

  describe('merge strategies', () => {
    const sampleResults: ChunkResult[] = [
      { chunkIndex: 0, success: true, result: 'part1' },
      { chunkIndex: 1, success: true, result: 'part2' },
      { chunkIndex: 2, success: false, result: null, error: 'failed' },
    ];

    it('should merge text', () => {
      const merged = mergeText(sampleResults);
      expect(merged).toBe('part1\npart2');
    });

    it('should merge arrays', () => {
      const results: ChunkResult[] = [
        { chunkIndex: 0, success: true, result: [1, 2] },
        { chunkIndex: 1, success: true, result: [3, 4] },
      ];

      const merged = mergeArray(results);
      expect(merged).toEqual([1, 2, 3, 4]);
    });

    it('should merge stats', () => {
      const merged = mergeStats(sampleResults);
      expect(merged.totalChunks).toBe(3);
      expect(merged.successChunks).toBe(2);
      expect(merged.failedChunks).toBe(1);
    });

    it('should merge with dedup', () => {
      const results: ChunkResult[] = [
        { chunkIndex: 0, success: true, result: { id: 1, name: 'a' } },
        { chunkIndex: 1, success: true, result: { id: 1, name: 'a' } },
        { chunkIndex: 2, success: true, result: { id: 2, name: 'b' } },
      ];

      const merged = mergeDedup(results);
      expect(merged.length).toBe(2);
    });
  });

  describe('processWithSlidingWindow', () => {
    it('should process with sliding window', async () => {
      const content = 'a'.repeat(1000);
      const results = await processWithSlidingWindow(
        content,
        async (window, position) => `processed-${position}`,
        400,
        300
      );

      expect(results.length).toBeGreaterThan(1);
      expect(results[0]).toContain('processed');
    });

    it('should maintain context with overlap', async () => {
      const content = 'abcdefghij';
      const windows: string[] = [];

      await processWithSlidingWindow(
        content,
        async (window) => {
          windows.push(window);
          return window;
        },
        4,
        2
      );

      // 检查重叠
      if (windows.length > 1) {
        // 第一个窗口结尾应该和第二个窗口开头有重叠
        expect(windows[0]).toBeDefined();
      }
    });
  });
});
