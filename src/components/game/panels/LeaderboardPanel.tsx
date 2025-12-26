import React from 'react';
import { useGame } from '@/context/GameContext';
import { X } from 'lucide-react';

interface LeaderboardPanelProps {
    onClose: () => void;
}

export default function LeaderboardPanel({ onClose }: LeaderboardPanelProps) {
    const { state } = useGame();
    const { leaderboard } = state;

    // Format currency
    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
        }).format(amount);
    };

    // Truncate wallet address
    const formatAddress = (address: string) => {
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    };

    return (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden z-50">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    🏆 Global Leaderboard
                </h2>
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
            </div>

            {/* Content */}
            <div className="p-0 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3 w-16 text-center">Rank</th>
                            <th className="px-4 py-3">Player</th>
                            <th className="px-4 py-3 text-right">Wallet</th>
                            <th className="px-4 py-3 text-right">Property Value</th>
                            <th className="px-4 py-3 text-right">Total Wealth</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {leaderboard && leaderboard.length > 0 ? (
                            leaderboard.map((entry) => (
                                <tr
                                    key={entry.rank}
                                    className={`${entry.isCurrentUser
                                            ? 'bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                        } transition-colors`}
                                >
                                    <td className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-300">
                                        {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                        {entry.isCurrentUser ? (
                                            <span className="text-blue-600 dark:text-blue-400 font-bold">You</span>
                                        ) : (
                                            <span className="font-mono text-xs">{formatAddress(entry.walletAddress)}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                        {formatMoney(entry.balance)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                                        {formatMoney(entry.propertyValue)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatMoney(entry.totalWealth)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                    Loading leaderboard data...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-xs text-center text-slate-500 dark:text-slate-400">
                Updates every 10 seconds • Wealth = Wallet Balance + Property Value
            </div>
        </div>
    );
}
