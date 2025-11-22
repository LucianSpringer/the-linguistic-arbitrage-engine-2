import { describe, it, expect } from 'vitest';
import { computeLevenshteinDeviation } from '../../utils/AlgorithmicCore';

describe('AlgorithmicCore', () => {
    describe('computeLevenshteinDeviation', () => {
        it('should return 0 for identical strings', () => {
            const result = computeLevenshteinDeviation('hello', 'hello');
            expect(result).toBe(0);
        });

        it('should calculate correct distance for different strings', () => {
            const result = computeLevenshteinDeviation('kitten', 'sitting');
            expect(result).toBe(3); // k→s, e→i, insert g
        });

        it('should handle empty strings', () => {
            const result = computeLevenshteinDeviation('', 'test');
            expect(result).toBe(4);
        });

        it('should handle single character difference', () => {
            const result = computeLevenshteinDeviation('cat', 'bat');
            expect(result).toBe(1);
        });

        it('should be case-sensitive', () => {
            const result = computeLevenshteinDeviation('Hello', 'hello');
            expect(result).toBe(1);
        });
    });
});
