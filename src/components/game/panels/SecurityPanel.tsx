'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useWallet } from '@/context/WalletContext';
import { useSocket } from '@/context/SocketContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

// Security Panel - Alarm subscriptions and Police bribe management
export function SecurityPanel({ onClose }: { onClose?: () => void }) {
    const { state } = useGame();
    const { address } = useWallet();
    const { socket } = useSocket();
    const [selectedBuilding, setSelectedBuilding] = useState<{ x: number; y: number } | null>(null);

    // Use persistent state from GameContext
    const policeProtectionExpiry = state.policeProtectionUntil;

    // Helper to get alarm expiry for a building from state
    const getAlarmExpiry = useCallback((x: number, y: number) => {
        return state.grid[y]?.[x]?.building?.alarmExpiresAt || null;
    }, [state.grid]);

    // Get owned buildings
    const ownedBuildings = useMemo(() => {
        const buildings: { x: number; y: number; type: string }[] = [];
        if (!state.grid || !address) return buildings;

        for (let y = 0; y < state.gridSize; y++) {
            for (let x = 0; x < state.gridSize; x++) {
                const tile = state.grid[y]?.[x];
                if (tile?.building?.ownerId === address) {
                    buildings.push({ x, y, type: tile.building.type });
                }
            }
        }
        return buildings;
    }, [state.grid, state.gridSize, address]);

    // Subscribe to alarm
    const subscribeAlarm = useCallback((x: number, y: number, days: number = 7) => {
        if (!socket || !address) return;
        socket.emit('subscribe_alarm', {
            worldId: 'default-world',
            x,
            y,
            ownerAddress: address,
            duration: days
        });
    }, [socket, address]);

    // Pay police bribe
    const payBribe = useCallback((days: number = 7) => {
        if (!socket || !address) return;
        socket.emit('pay_police_bribe', {
            ownerAddress: address,
            duration: days
        });
    }, [socket, address]);

    const isPoliceProtected = policeProtectionExpiry && policeProtectionExpiry > Date.now();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-sidebar border border-sidebar-border rounded-lg shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border bg-gradient-to-r from-red-900/30 to-orange-900/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🛡️</span>
                        <h2 className="text-xl font-bold text-sidebar-foreground">Security Center</h2>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="icon-sm" onClick={onClose}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {/* Police Protection Section */}
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-lg text-red-400 flex items-center gap-2">
                                    🚔 Police "Relations"
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Pay the chief to avoid... unpleasant inspections.
                                </p>
                            </div>
                            {isPoliceProtected && (
                                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
                                    Protected until {formatDistanceToNow(policeProtectionExpiry!, { addSuffix: true })}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                onClick={() => payBribe(7)}
                            >
                                7 Days - $500
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/20"
                                onClick={() => payBribe(30)}
                            >
                                30 Days - $2,000
                            </Button>
                        </div>
                    </div>

                    {/* Alarm Protection Section */}
                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <h3 className="font-semibold text-lg text-blue-400 flex items-center gap-2 mb-4">
                            🔔 Building Alarm Systems
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Protect your buildings from robbery attempts with alarm systems.
                        </p>

                        <ScrollArea className="h-48">
                            {ownedBuildings.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">You don't own any buildings yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {ownedBuildings.map(({ x, y, type }) => {
                                        const key = `${x}:${y}`;
                                        const alarmExpiry = getAlarmExpiry(x, y);
                                        const hasAlarm = alarmExpiry && alarmExpiry > Date.now();

                                        return (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between p-3 bg-background/50 rounded-md"
                                            >
                                                <div>
                                                    <span className="font-medium capitalize">{type.replace(/_/g, ' ')}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">({x}, {y})</span>
                                                </div>
                                                {hasAlarm ? (
                                                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                                        Protected until {formatDistanceToNow(alarmExpiry!, { addSuffix: true })}
                                                    </span>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                                                        onClick={() => subscribeAlarm(x, y, 7)}
                                                    >
                                                        Add Alarm - $100
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Recent Events */}
                    <div className="p-4 bg-background/50 border border-border rounded-lg">
                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            📜 Recent Security Events
                        </h3>
                        <ScrollArea className="h-32">
                            {state.robberyLog.length === 0 && state.fineLog.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No recent security events.</p>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    {state.robberyLog.slice(0, 5).map((event, i) => (
                                        <div key={`robbery-${i}`} className={`p-2 rounded ${event.wasProtected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                            {event.wasProtected ? '🛡️ Robbery thwarted' : `💰 Robbery at (${event.x}, ${event.y}) - Lost $${event.amount}`}
                                        </div>
                                    ))}
                                    {state.fineLog.slice(0, 5).map((event, i) => (
                                        <div key={`fine-${i}`} className={`p-2 rounded ${event.type === 'bribe' ? 'bg-yellow-500/10' : 'bg-red-500/10'}`}>
                                            {event.type === 'bribe' ? `🤝 Bribe paid - $${event.amount}` : `📝 Fine: $${event.amount} - ${event.reason}`}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SecurityPanel;
