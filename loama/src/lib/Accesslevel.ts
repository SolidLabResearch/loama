export interface AccessLevel {
    rank: number;
    label: string;
    color: string;
    textColor: string;
}

const LEVELS: Record<string, AccessLevel> = {
    read: { rank: 1, label: 'Read', color: '#2f9e44', textColor: '#ffffff' },
    append: { rank: 2, label: 'Append', color: '#f2b705', textColor: '#1a1a1a' },
    write: { rank: 3, label: 'Write', color: '#f2790a', textColor: '#ffffff' },
    create: { rank: 3, label: 'Create', color: '#f2790a', textColor: '#ffffff' },
    control: { rank: 4, label: 'Full Control', color: '#d92b2b', textColor: '#ffffff' },
};

const FALLBACK: AccessLevel = { rank: 0, label: 'Unknown', color: '#9aa0a6', textColor: '#ffffff' };

export function levelForAction(action: string): AccessLevel {
    const key = action.split(/[/#]/).filter(Boolean).pop()?.toLowerCase() ?? '';
    return LEVELS[key] ?? FALLBACK;
}

export function highestLevel(actions: string[]): AccessLevel | null {
    return actions.reduce<AccessLevel | null>((max, action) => {
        const level = levelForAction(action);
        return !max || level.rank > max.rank ? level : max;
    }, null);
}