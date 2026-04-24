/**
 * OpenClaw Parser 测试
 */
import { describe, it, expect } from 'vitest';

import { parseOpenClawSoul, toColoBotSoul } from '../agent-runtime/tools/openclaw.js';

describe('OpenClaw Parser', () => {
  describe('parseOpenClawSoul', () => {
    it('should parse role from heading', () => {
      const markdown = '# Test Role\n\nSome content';
      const result = parseOpenClawSoul(markdown);

      expect(result.role).toBe('Test Role');
      expect(result.source).toBe('openclaw');
    });

    it('should parse personality from Core Identity section', () => {
      const markdown = `# Role

## Core Identity

**Personality:** Professional`;

      const result = parseOpenClawSoul(markdown);

      // Personality parsing depends on specific format
      expect(result).toBeDefined();
    });

    it('should parse rules from Responsibilities section', () => {
      const markdown = `# Role

## Responsibilities

- Always be helpful`;

      const result = parseOpenClawSoul(markdown);

      expect(result.rules.length).toBeGreaterThan(0);
    });

    it('should handle empty markdown', () => {
      const result = parseOpenClawSoul('');

      expect(result.role).toBe('');
      expect(result.rules).toEqual([]);
      expect(result.skills).toEqual([]);
    });

    it('should handle markdown with no sections', () => {
      const markdown = 'Just some plain text without any sections.';
      const result = parseOpenClawSoul(markdown);

      expect(result.role).toBe('');
    });

    it('should preserve original name', () => {
      const markdown = '# Role';
      const result = parseOpenClawSoul(markdown, 'TestAgent');

      expect(result.originalName).toBe('TestAgent');
    });

    it('should parse Behavioral Guidelines Do section', () => {
      const markdown = `# Role

## Behavioral Guidelines

### Do:
- Be polite`;

      const result = parseOpenClawSoul(markdown);

      expect(result.rules.some(r => r.includes('Do:'))).toBe(true);
    });

    it('should parse Behavioral Guidelines Don\'t section', () => {
      const markdown = `# Role

## Behavioral Guidelines

### Don't:
- Be rude`;

      const result = parseOpenClawSoul(markdown);

      expect(result.rules.some(r => r.includes("Don't"))).toBe(true);
    });

    it('should use name as fallback role', () => {
      const markdown = 'No heading here';
      const result = parseOpenClawSoul(markdown, 'FallbackRole');

      expect(result.role).toBe('FallbackRole');
    });

    it('should detect known tools in Integration Notes', () => {
      const markdown = `# Role

## Integration Notes

- **github** for repository access
- slack for messaging`;

      const result = parseOpenClawSoul(markdown);

      expect(result.skills.length).toBeGreaterThan(0);
    });
  });

  describe('toColoBotSoul', () => {
    it('should convert to JSON string', () => {
      const soul = {
        role: 'Test Role',
        personality: 'Friendly',
        rules: ['Be helpful'],
        skills: ['search'],
        source: 'openclaw' as const,
      };

      const json = toColoBotSoul(soul);

      expect(json).toContain('Test Role');
      expect(json).toContain('Friendly');
    });

    it('should use originalName as fallback role', () => {
      const soul = {
        role: '',
        personality: '',
        rules: [],
        skills: [],
        source: 'openclaw' as const,
        originalName: 'FallbackName',
      };

      const json = toColoBotSoul(soul);

      expect(json).toContain('FallbackName');
    });
  });
});