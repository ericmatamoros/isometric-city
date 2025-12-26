'use client';

import React from 'react';
import { useWallet } from '@/context/WalletContext';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

export function ConnectWallet() {
    const { address, isConnected, isConnecting, connect, disconnect } = useWallet();

    if (isConnected && address) {
        return (
            <div className="flex items-center gap-2">
                <div className="text-xs text-white/70 bg-white/10 px-2 py-1 rounded">
                    {address.slice(0, 6)}...{address.slice(-4)}
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={disconnect}
                    className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
                >
                    <Wallet className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={connect}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white border-none"
        >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </Button>
    );
}
