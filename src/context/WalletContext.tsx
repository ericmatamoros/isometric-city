'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';

// Add global type definition for window.ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

interface WalletContextType {
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
}

export const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

    // Initialize provider if window.ethereum exists
    useEffect(() => {
        if (typeof window !== 'undefined' && window.ethereum) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(browserProvider);

            // Check if already connected
            browserProvider.listAccounts().then(accounts => {
                if (accounts.length > 0) {
                    setAddress(accounts[0].address);
                    browserProvider.getSigner().then(setSigner);
                }
            }).catch(console.error);

            // Listen for account changes
            if (window.ethereum.on) {
                window.ethereum.on('accountsChanged', (accounts: string[]) => {
                    if (accounts.length > 0) {
                        setAddress(accounts[0]);
                        browserProvider.getSigner().then(setSigner);
                    } else {
                        setAddress(null);
                        setSigner(null);
                    }
                });
            }
        }
    }, []);

    const connect = useCallback(async () => {
        if (!provider) {
            alert('Please install MetaMask or another wallet to connect.');
            return;
        }

        setIsConnecting(true);
        try {
            const accounts = await provider.send("eth_requestAccounts", []);
            if (accounts.length > 0) {
                setAddress(accounts[0]);
                const newSigner = await provider.getSigner();
                setSigner(newSigner);

                // Here we would typically authenticate with our backend
                // await authenticateUser(accounts[0]);
            }
        } catch (error) {
            console.error("Failed to connect wallet:", error);
        } finally {
            setIsConnecting(false);
        }
    }, [provider]);

    const disconnect = useCallback(() => {
        setAddress(null);
        setSigner(null);
    }, []);

    return (
        <WalletContext.Provider value={{
            address,
            isConnected: !!address,
            isConnecting,
            connect,
            disconnect,
            provider,
            signer
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
