'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useWallet } from '@/context/WalletContext';
import { useSocket } from '@/context/SocketContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

export function MultiplayerPanel({ onClose }: { onClose?: () => void }) {
    const { state } = useGame();
    const { address } = useWallet();
    const { socket } = useSocket();
    const [activeTab, setActiveTab] = useState<'market' | 'embassy'>('market');
    const [marketListings, setMarketListings] = useState<any[]>([]);
    const [giftAddress, setGiftAddress] = useState('');
    const [giftAmount, setGiftAmount] = useState(100);

    // Fetch market listings
    useEffect(() => {
        if (!socket || activeTab !== 'market') return;

        socket.emit('get_market_listings', { worldId: 'default-world' });

        const handleListings = (data: any[]) => {
            setMarketListings(data);
        };

        socket.on('market_listings', handleListings);
        return () => {
            socket.off('market_listings', handleListings);
        };
    }, [socket, activeTab]);

    const sendGift = useCallback(() => {
        if (!socket || !address || !giftAddress || giftAmount <= 0) return;
        socket.emit('send_gift', {
            fromAddress: address,
            toAddress: giftAddress,
            amount: giftAmount
        });
        setGiftAddress('');
    }, [socket, address, giftAddress, giftAmount]);

    const buyProperty = useCallback((x: number, y: number) => {
        if (!socket || !address) return;
        socket.emit('buy_tile', {
            worldId: 'default-world',
            x,
            y,
            buyerAddress: address
        });
    }, [socket, address]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-sidebar border border-sidebar-border rounded-lg shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border bg-gradient-to-r from-indigo-900/30 to-purple-900/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🌐</span>
                        <h2 className="text-xl font-bold text-sidebar-foreground">Multiplayer Hub</h2>
                    </div>
                    {onClose && (
                        <Button variant="ghost" size="icon-sm" onClick={onClose}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </Button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-sidebar-border">
                    <button
                        onClick={() => setActiveTab('market')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'market'
                                ? 'bg-indigo-500/10 text-indigo-400 border-b-2 border-indigo-500'
                                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                            }`}
                    >
                        Global Market
                    </button>
                    <button
                        onClick={() => setActiveTab('embassy')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'embassy'
                                ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-500'
                                : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50'
                            }`}
                    >
                        Trade Embassy
                    </button>
                </div>

                <div className="p-6 h-[400px]">
                    {activeTab === 'market' ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <h3 className="text-lg font-semibold text-indigo-400">Properties for Sale</h3>
                            <ScrollArea className="flex-1 pr-4">
                                {marketListings.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground italic">
                                        <p>No properties currently listed.</p>
                                        <p className="text-xs">List your own properties from the Tile Info panel!</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3">
                                        {marketListings.map((listing) => (
                                            <div key={`${listing.x}-${listing.y}`} className="p-4 bg-background/50 border border-border rounded-lg flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">Property at ({listing.x}, {listing.y})</p>
                                                    <p className="text-xs text-muted-foreground">Owner: {listing.owner?.walletAddress.slice(0, 6)}...{listing.owner?.walletAddress.slice(-4)}</p>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-xl font-bold text-emerald-400">${listing.price?.toLocaleString()}</span>
                                                    <Button
                                                        size="sm"
                                                        className="bg-indigo-600 hover:bg-indigo-500"
                                                        onClick={() => buyProperty(listing.x, listing.y)}
                                                        disabled={listing.owner?.walletAddress === address}
                                                    >
                                                        {listing.owner?.walletAddress === address ? 'Your Listing' : 'Buy'}
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-purple-900/10 border border-purple-500/20 rounded-lg">
                                <h3 className="text-lg font-semibold text-purple-400 mb-4">Send Financial Aid</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Recipient Wallet Address</label>
                                        <Input
                                            placeholder="0x..."
                                            value={giftAddress}
                                            onChange={(e) => setGiftAddress(e.target.value)}
                                            className="bg-background/50 border-sidebar-border"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Amount ($)</label>
                                        <Input
                                            type="number"
                                            value={giftAmount}
                                            onChange={(e) => setGiftAmount(parseInt(e.target.value))}
                                            className="bg-background/50 border-sidebar-border"
                                        />
                                    </div>
                                    <Button
                                        className="w-full bg-purple-600 hover:bg-purple-500 text-white"
                                        onClick={sendGift}
                                        disabled={!giftAddress || giftAmount <= 0}
                                    >
                                        Send Gift
                                    </Button>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground italic">
                                    "Trade is the lifeblood of a growing metropolis."
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default MultiplayerPanel;
