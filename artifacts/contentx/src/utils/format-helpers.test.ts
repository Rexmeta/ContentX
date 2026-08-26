import { describe, it, expect } from 'vitest';
import { parseJsonString, getStatusLabel } from './format-helpers';

describe('format-helpers', () => {
  it('parses valid JSON string', () => {
    expect(parseJsonString('{"a": 1}')).toEqual({ a: 1 });
  });

  it('throws on invalid JSON string', () => {
    expect(() => parseJsonString('{a: 1}')).toThrow('유효하지 않은 JSON입니다.');
  });

  it('returns correct status label', () => {
    expect(getStatusLabel('draft')).toBe('초안');
    expect(getStatusLabel('active')).toBe('활성');
    expect(getStatusLabel('superseded')).toBe('대체됨');
  });
});
