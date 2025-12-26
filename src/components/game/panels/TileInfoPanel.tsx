'use client';

import React from 'react';
import { Tile } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CloseIcon } from '@/components/ui/Icons';

import { useWallet } from '@/context/WalletContext';
import { useSocket } from '@/context/SocketContext';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface TileInfoPanelProps {
  tile: Tile;
  services: {
    police: number[][];
    fire: number[][];
    health: number[][];
    education: number[][];
    power: boolean[][];
    water: boolean[][];
  };
  onClose: () => void;
  isMobile?: boolean;
}

export function TileInfoPanel({
  tile,
  services,
  onClose,
  isMobile = false
}: TileInfoPanelProps) {
  const { x, y } = tile;
  const { address: walletAddress } = useWallet();
  const { socket } = useSocket();
  const [sellPrice, setSellPrice] = useState<string>('');
  const [isListing, setIsListing] = useState(false);

  const isOwner = walletAddress && tile.building.ownerId === walletAddress;
  const canBuy = walletAddress && tile.building.forSale && !isOwner;

  const handleSell = () => {
    if (!socket || !walletAddress || !sellPrice) return;
    socket.emit('sell_tile', {
      worldId: 'default-world',
      x,
      y,
      price: parseFloat(sellPrice),
      ownerAddress: walletAddress
    });
    setIsListing(false);
  };

  const handleBuy = () => {
    if (!socket || !walletAddress) return;
    socket.emit('buy_tile', {
      worldId: 'default-world',
      x,
      y,
      buyerAddress: walletAddress
    });
  };

  return (
    <Card
      className={`${isMobile ? 'fixed left-0 right-0 w-full rounded-none border-x-0 border-t border-b z-30' : 'absolute top-4 right-4 w-72'}`}
      style={isMobile ? { top: 'calc(72px + env(safe-area-inset-top, 0px))' } : undefined}
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-sans">Tile ({x}, {y})</CardTitle>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <CloseIcon size={14} />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Ownership Section */}
        <div className="bg-muted/50 p-2 rounded-md space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Owner</span>
            <span className="font-mono text-xs">
              {tile.building.ownerId
                ? `${tile.building.ownerId.slice(0, 6)}...${tile.building.ownerId.slice(-4)}`
                : 'City'}
            </span>
          </div>

          {isOwner && !tile.building.forSale && (
            <div className="pt-2">
              {!isListing ? (
                <Button className="w-full h-8" size="sm" onClick={() => setIsListing(true)}>
                  Sell Property
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Price"
                    className="h-8"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                  />
                  <Button className="h-8" size="sm" onClick={handleSell}>List</Button>
                  <Button variant="ghost" className="h-8" size="sm" onClick={() => setIsListing(false)}>X</Button>
                </div>
              )}
            </div>
          )}

          {isOwner && tile.building.forSale && (
            <div className="pt-2 text-center">
              <Badge variant="secondary" className="w-full justify-center bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
                Listed for ${tile.building.price}
              </Badge>
            </div>
          )}

          {canBuy && (
            <div className="pt-2">
              <Button className="w-full h-8 bg-green-600 hover:bg-green-700" size="sm" onClick={handleBuy}>
                Buy for ${tile.building.price}
              </Button>
            </div>
          )}
        </div>

        <Separator />

        <div className="flex justify-between">
          <span className="text-muted-foreground">Building</span>
          <span className="capitalize">{tile.building.type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Zone</span>
          <Badge variant={
            tile.zone === 'residential' ? 'default' :
              tile.zone === 'commercial' ? 'secondary' :
                tile.zone === 'industrial' ? 'outline' : 'secondary'
          } className={
            tile.zone === 'residential' ? 'bg-green-500/20 text-green-400' :
              tile.zone === 'commercial' ? 'bg-blue-500/20 text-blue-400' :
                tile.zone === 'industrial' ? 'bg-amber-500/20 text-amber-400' : ''
          }>
            {tile.zone === 'none' ? 'Unzoned' : tile.zone}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Level</span>
          <span>{tile.building.level}/5</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Population</span>
          <span>{tile.building.population}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Jobs</span>
          <span>{tile.building.jobs}</span>
        </div>

        <Separator />

        <div className="flex justify-between">
          <span className="text-muted-foreground">Power</span>
          <Badge variant={tile.building.powered ? 'default' : 'destructive'}>
            {tile.building.powered ? 'Connected' : 'No Power'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Water</span>
          <Badge variant={tile.building.watered ? 'default' : 'destructive'} className={tile.building.watered ? 'bg-cyan-500/20 text-cyan-400' : ''}>
            {tile.building.watered ? 'Connected' : 'No Water'}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Land Value</span>
          <span>${tile.landValue}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Pollution</span>
          <span className={tile.pollution > 50 ? 'text-red-400' : tile.pollution > 25 ? 'text-amber-400' : 'text-green-400'}>
            {Math.round(tile.pollution)}%
          </span>
        </div>

        {tile.building.onFire && (
          <>
            <Separator />
            <div className="flex justify-between text-red-400">
              <span>ON FIRE!</span>
              <span>{Math.round(tile.building.fireProgress)}% damage</span>
            </div>
          </>
        )}

        <Separator />
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Service Coverage</div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Police</span>
            <span>{Math.round(services.police[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fire</span>
            <span>{Math.round(services.fire[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Health</span>
            <span>{Math.round(services.health[y][x])}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Education</span>
            <span>{Math.round(services.education[y][x])}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
