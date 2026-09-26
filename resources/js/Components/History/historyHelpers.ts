export type HistoryStatus = 'running' | 'unverified' | 'verified';

export function getHistoryStatus(h: { end_time?: string | null; verification_status?: string }): HistoryStatus {
    if (!h.end_time) return 'running';
    return h.verification_status === 'verified' ? 'verified' : 'unverified';
}

export function compareF0(systemF0: number, targetF0: number | null | undefined): 'VALID' | 'FAIL' | null {
    if (targetF0 === null || targetF0 === undefined || Number.isNaN(targetF0) || Number.isNaN(systemF0)) return null;
    return systemF0 < targetF0 ? 'FAIL' : 'VALID';
}

export interface HistoryFilter {
    status: 'all' | HistoryStatus;
    groupId: 'all' | number;
    query: string;
}

export function filterHistories<T extends { end_time?: string | null; verification_status?: string; group_id?: number | null; product?: string | null; batch_code?: string | null }>(list: T[], f: HistoryFilter): T[] {
    const q = f.query.trim().toLowerCase();
    return list.filter((h) => {
        if (f.status !== 'all' && getHistoryStatus(h) !== f.status) return false;
        if (f.groupId !== 'all' && h.group_id !== f.groupId) return false;
        if (q && !`${h.product ?? ''} ${h.batch_code ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
    });
}
