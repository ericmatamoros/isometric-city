'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '@/context/GameContext';
import { useWallet } from '@/context/WalletContext';
import { useSocket } from '@/context/SocketContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Loan } from '@/types/game';

// Bank Panel - Loan management and City Bank interactions
export function BankPanel({ onClose }: { onClose?: () => void }) {
    const { state } = useGame();
    const { address } = useWallet();
    const { socket } = useSocket();
    const [loanAmount, setLoanAmount] = useState<number>(5000);

    // Use persistent state from GameContext
    const playerLoans = useMemo(() => {
        return state.playerLoans || [];
    }, [state.playerLoans]);

    // Request loan
    const requestLoan = useCallback(() => {
        if (!socket || !address) return;
        socket.emit('request_loan', {
            ownerAddress: address,
            amount: loanAmount
        });
    }, [socket, address, loanAmount]);

    // Repay loan
    const repayLoan = useCallback((loanId: string, amount: number) => {
        if (!socket || !address) return;
        socket.emit('repay_loan', {
            ownerAddress: address,
            loanId,
            amount
        });
    }, [socket, address]);

    const totalDebt = playerLoans.reduce((sum, loan) => sum + (loan.repaid ? 0 : loan.outstanding), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-sidebar border border-sidebar-border rounded-lg shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border bg-gradient-to-r from-emerald-900/30 to-teal-900/30">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🏦</span>
                        <h2 className="text-xl font-bold text-sidebar-foreground">City Bank</h2>
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
                    {/* Summary Section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-background/50 border border-border rounded-lg">
                            <p className="text-sm text-muted-foreground">Personal Balance</p>
                            <p className="text-2xl font-bold text-emerald-400">${state.playerBalance?.toLocaleString() || '0'}</p>
                        </div>
                        <div className="p-4 bg-background/50 border border-border rounded-lg">
                            <p className="text-sm text-muted-foreground">Total Debt</p>
                            <p className="text-2xl font-bold text-red-400">${totalDebt.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Request Loan Section */}
                    <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-lg">
                        <h3 className="font-semibold text-lg text-emerald-400 mb-4">Request New Loan</h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1000"
                                    max="50000"
                                    step="1000"
                                    value={loanAmount}
                                    onChange={(e) => setLoanAmount(parseInt(e.target.value))}
                                    className="flex-1 accent-emerald-500"
                                />
                                <span className="text-xl font-mono font-bold w-24 text-right">
                                    ${loanAmount.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Interest Rate: 5% APR</span>
                                <span>Term: 30 Days</span>
                            </div>
                            <Button
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                                onClick={requestLoan}
                            >
                                Apply for Loan
                            </Button>
                        </div>
                    </div>

                    {/* Active Loans Section */}
                    <div className="p-4 bg-background/50 border border-border rounded-lg">
                        <h3 className="font-semibold text-lg mb-4">Active Loans</h3>
                        <ScrollArea className="h-48">
                            {playerLoans.filter(l => !l.repaid).length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center py-8">No active loans.</p>
                            ) : (
                                <div className="space-y-3">
                                    {playerLoans.filter(l => !l.repaid).map((loan) => (
                                        <div key={loan.id} className="p-3 bg-sidebar-accent/50 rounded-md border border-sidebar-border">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-sm font-medium">Loan #{loan.id.slice(-6)}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Principal: ${loan.principal.toLocaleString()} @ {(loan.interestRate * 100).toFixed(1)}%
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-bold text-red-400">${loan.outstanding.toLocaleString()}</p>
                                                    <p className="text-xs text-muted-foreground">Outstanding</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1"
                                                    onClick={() => repayLoan(loan.id, 1000)}
                                                >
                                                    Repay $1,000
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="flex-1 bg-emerald-600/20 text-emerald-400 border-emerald-600/50 hover:bg-emerald-600/30"
                                                    onClick={() => repayLoan(loan.id, loan.outstanding)}
                                                >
                                                    Pay Full Balance
                                                </Button>
                                            </div>
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

export default BankPanel;
