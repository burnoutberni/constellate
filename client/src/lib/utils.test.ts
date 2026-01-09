
import { describe, it, expect } from 'vitest';
import { getInitials } from './utils';

describe('getInitials', () => {
    it('should return initials for a valid name', () => {
        expect(getInitials('John Doe')).toBe('JD');
    });

    it('should return initials for a single name', () => {
        expect(getInitials('Alice')).toBe('Al');
    });

    it('should handle whitespace-only name by falling back to username', () => {
        expect(getInitials('   ', 'user123')).toBe('us');
    });

    it('should handle whitespace-only name and no username by returning "?"', () => {
        expect(getInitials('   ')).toBe('?');
    });

    it('should handle empty name and no username by returning "?"', () => {
        expect(getInitials('')).toBe('?');
    });

    it('should handle null/undefined name by falling back to username', () => {
        expect(getInitials(undefined, 'user123')).toBe('us');
    });
});
