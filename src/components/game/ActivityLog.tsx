'use client';

import React from 'react';
import { useGame } from '@/context/GameContext';
import { ActivityLogEntry } from '@/types/game';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

export function ActivityLog() {
    const { state } = useGame();
    const { activityLog } = state;

    if (!activityLog || activityLog.length === 0) return null;

    return (
        <div className="absolute bottom-48 right-4 w-64 max-h-48 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-lg overflow-hidden flex flex-col pointer-events-auto">
            <div className="px-3 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Global Activity</span>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                    {activityLog.map((entry) => (
                        <div key={entry.id} className="text-xs border-l-2 border-primary/30 pl-2 py-1">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-foreground/90 leading-tight">{entry.message}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground opacity-70">
                                {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
                            </span>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
