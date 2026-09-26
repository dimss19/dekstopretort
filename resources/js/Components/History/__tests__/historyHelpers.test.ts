import { describe, expect, it } from 'vitest';
import { compareF0, filterHistories, getHistoryStatus } from '../historyHelpers';

describe('historyHelpers', () => {
    it('marks null end_time as running', () => {
        expect(getHistoryStatus({ end_time: null })).toBe('running');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z', verification_status: 'verified' })).toBe('verified');
        expect(getHistoryStatus({ end_time: '2026-09-26T10:00:00Z' })).toBe('unverified');
    });

    it('compares F0 strictly without tolerance', () => {
        expect(compareF0(5.21, 4.5)).toBe('VALID');
        expect(compareF0(4.5, 4.5)).toBe('VALID');
        expect(compareF0(4.49, 4.5)).toBe('FAIL');
        expect(compareF0(1.0, null)).toBeNull();
    });

    it('filters by status, group and query', () => {
        const list = [
            { id: 1, end_time: null, product: 'Rendang', batch_code: 'B-1', group_id: null },
            { id: 2, end_time: '2026-09-26T10:00:00Z', verification_status: 'verified', product: 'Rendang', batch_code: 'B-2', group_id: 1 },
            { id: 3, end_time: '2026-09-26T10:00:00Z', product: 'Kari', batch_code: 'B-3', group_id: 2 },
        ];
        expect(filterHistories(list, { status: 'running', groupId: 'all', query: '' }).map((h) => h.id)).toEqual([1]);
        expect(filterHistories(list, { status: 'all', groupId: 2, query: '' }).map((h) => h.id)).toEqual([3]);
        expect(filterHistories(list, { status: 'all', groupId: 'all', query: 'rendang' }).map((h) => h.id)).toEqual([1, 2]);
    });
});
