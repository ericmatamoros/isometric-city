import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Initialize Prisma
const prisma = new PrismaClient();

app.prepare().then(() => {
    const httpServer = createServer(handle);
    const io = new Server(httpServer);

    // Periodic leaderboard update
    setInterval(async () => {
        try {
            const users = await prisma.user.findMany({
                include: { ownedTiles: true }
            });

            const leaderboard = users.map(user => {
                // Calculate property value (simplified: 500 per tile)
                const propertyValue = user.ownedTiles.length * 500;
                return {
                    walletAddress: user.walletAddress,
                    balance: user.balance,
                    propertyValue,
                    totalWealth: user.balance + propertyValue
                };
            })
                .sort((a, b) => b.totalWealth - a.totalWealth)
                .slice(0, 10)
                .map((entry, index) => ({
                    rank: index + 1,
                    ...entry,
                    isCurrentUser: false // Client will determine this
                }));

            io.emit("leaderboard_update", leaderboard);
        } catch (e) {
            console.error("Error updating leaderboard:", e);
        }
    }, 10000);

    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);

        // Handle user identification
        socket.on("identify", async (walletAddress) => {
            try {
                // Upsert user
                await prisma.user.upsert({
                    where: { walletAddress },
                    update: {},
                    create: { walletAddress, balance: 10000 }
                });
                console.log(`User identified: ${walletAddress}`);
            } catch (e) {
                console.error("Error identifying user:", e);
            }
        });

        // Join the default world
        socket.on("join_world", async (worldId) => {
            // Ensure world exists
            if (worldId === 'default-world') {
                const world = await prisma.world.findUnique({ where: { id: worldId } });
                if (!world) {
                    await prisma.world.create({
                        data: {
                            id: 'default-world',
                            name: 'Metropolis One',
                            width: 50,
                            height: 50
                        }
                    });
                    console.log("Created default world");
                }
            }

            socket.join(worldId);
            console.log(`Socket ${socket.id} joined world ${worldId}`);

            // Send initial state (all modified tiles)
            try {
                const tiles = await prisma.tile.findMany({
                    where: { worldId },
                    include: { owner: true }
                });
                socket.emit("world_state", tiles);
            } catch (e) {
                console.error("Error fetching world state:", e);
            }
        });

        // Handle tile updates (building placement)
        socket.on("place_building", async (data) => {
            const { worldId, x, y, type, ownerAddress, cost } = data;

            try {
                // 1. Check if user has funds and tile is free
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user || user.balance < cost) {
                    socket.emit("error", { message: "Insufficient funds" });
                    return;
                }

                const existingTile = await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } }
                });

                if (existingTile && existingTile.ownerId && existingTile.ownerId !== user.id) {
                    socket.emit("error", { message: "Tile owned by another player" });
                    return;
                }

                // 2. Process transaction
                await prisma.$transaction([
                    // Deduct funds
                    prisma.user.update({
                        where: { id: user.id },
                        data: { balance: { decrement: cost } }
                    }),
                    // Update/Create tile
                    prisma.tile.upsert({
                        where: { worldId_x_y: { worldId, x, y } },
                        update: { type, ownerId: user.id },
                        create: { worldId, x, y, type, ownerId: user.id }
                    }),
                    // Record transaction
                    prisma.transaction.create({
                        data: {
                            amount: -cost,
                            type: 'construction',
                            userId: user.id
                        }
                    })
                ]);

                // 3. Broadcast update
                io.to(worldId).emit("tile_updated", { x, y, type, ownerAddress });
                io.to(worldId).emit("activity", {
                    type: 'construction',
                    message: `${ownerAddress.substring(0, 6)} built a ${type}`,
                    walletAddress: ownerAddress
                });

                // 4. Send updated balance to user
                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", updatedUser?.balance);

            } catch (e) {
                console.error("Failed to place building:", e);
                socket.emit("error", { message: "Transaction failed" });
            }
        });

        // Handle selling a tile
        socket.on("sell_tile", async (data) => {
            const { worldId, x, y, price, ownerAddress } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) return;

                const tile = await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } }
                });

                if (!tile || tile.ownerId !== user.id) {
                    socket.emit("error", { message: "You don't own this property" });
                    return;
                }

                // Update tile status
                await prisma.tile.update({
                    where: { worldId_x_y: { worldId, x, y } },
                    data: { forSale: true, price: parseFloat(price) }
                });

                // Broadcast update
                io.to(worldId).emit("tile_for_sale", { x, y, price, ownerAddress });
                console.log(`Tile at ${x},${y} listed for sale by ${ownerAddress} for ${price}`);

            } catch (e) {
                console.error("Failed to list tile for sale:", e);
                socket.emit("error", { message: "Failed to list property" });
            }
        });

        // Handle buying a tile
        socket.on("buy_tile", async (data) => {
            const { worldId, x, y, buyerAddress } = data;

            try {
                const buyer = await prisma.user.findUnique({ where: { walletAddress: buyerAddress } });
                if (!buyer) return;

                const tile = (await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } },
                    include: { owner: true }
                })) as any;

                if (!tile || !tile.forSale || !tile.price || !tile.ownerId) {
                    socket.emit("error", { message: "Property not for sale" });
                    return;
                }

                if (buyer.balance < tile.price) {
                    socket.emit("error", { message: "Insufficient funds" });
                    return;
                }

                // Execute transaction
                await prisma.$transaction([
                    // Deduct from buyer
                    prisma.user.update({
                        where: { id: buyer.id },
                        data: { balance: { decrement: tile.price } }
                    }),
                    // Add to seller
                    prisma.user.update({
                        where: { id: tile.ownerId },
                        data: { balance: { increment: tile.price } }
                    }),
                    // Transfer ownership
                    prisma.tile.update({
                        where: { worldId_x_y: { worldId, x, y } },
                        data: {
                            ownerId: buyer.id,
                            forSale: false,
                            price: null
                        }
                    }),
                    // Record transaction
                    prisma.transaction.create({
                        data: {
                            amount: -tile.price,
                            type: 'purchase',
                            userId: buyer.id
                        }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: tile.price,
                            type: 'sale',
                            userId: tile.ownerId
                        }
                    })
                ]);

                // Broadcast updates
                io.to(worldId).emit("tile_sold", {
                    x,
                    y,
                    newOwnerAddress: buyerAddress,
                    price: tile.price
                });

                // Update balances
                const updatedBuyer = await prisma.user.findUnique({ where: { id: buyer.id } });
                const updatedSeller = await prisma.user.findUnique({ where: { id: tile.ownerId } });

                // We need to send balance updates to specific sockets. 
                // Since we don't track socket IDs to users map here easily, we can just emit to the room 
                // and let clients filter, or better, emit to specific sockets if we tracked them.
                // For MVP, let's just emit a generic balance update event that clients can request?
                // Or simply rely on the client to re-fetch or track locally.
                // Better: Emit to the specific sockets if we can.
                // For now, let's just emit 'balance_update' to the sender (buyer) via the current socket
                // But the seller needs an update too.

                // Simple workaround: Emit a 'transaction_complete' event with user IDs and balances
                // Clients will ignore if it's not them.
                io.to(worldId).emit("transaction_complete", {
                    buyerAddress: buyer.walletAddress,
                    buyerBalance: updatedBuyer?.balance,
                    sellerAddress: tile.owner?.walletAddress,
                    sellerBalance: updatedSeller?.balance,
                    x,
                    y,
                    price: tile.price
                });

                console.log(`Tile at ${x},${y} sold to ${buyerAddress} for ${tile.price}`);
                io.to(worldId).emit("activity", {
                    type: 'purchase',
                    message: `${buyerAddress.substring(0, 6)} bought property at ${x},${y} for $${tile.price}`,
                    walletAddress: buyerAddress
                });

            } catch (e) {
                console.error("Failed to buy tile:", e);
                socket.emit("error", { message: "Transaction failed" });
            }
        });

        // Handle rent collection
        socket.on("collect_rent", async (data) => {
            const { worldId, x, y, ownerAddress } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) return;

                const tile = (await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } }
                })) as any;

                if (!tile || tile.ownerId !== user.id) {
                    socket.emit("error", { message: "You don't own this property" });
                    return;
                }

                // Check cooldown (5 minutes)
                const now = new Date();
                if (tile.lastRentCollected) {
                    const diff = now.getTime() - new Date(tile.lastRentCollected).getTime();
                    if (diff < 5 * 60 * 1000) {
                        socket.emit("error", { message: "Rent already collected recently" });
                        return;
                    }
                }

                // Calculate rent based on building type (simplified)
                // In a real game, we'd look up the building level/type from the DB or shared config
                // For now, assume a flat rate or rely on client data (risky but okay for MVP)
                // Better: Store building level/type in Tile model? We have 'type' string.

                let rentAmount = 10; // Base rent
                if (tile.type.includes('commercial')) rentAmount = 20;
                if (tile.type.includes('industrial')) rentAmount = 30;
                if (tile.type.includes('large')) rentAmount *= 2;
                if (tile.type.includes('skyscraper')) rentAmount *= 5;

                // Execute transaction
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: user.id },
                        data: { balance: { increment: rentAmount } }
                    }),
                    prisma.tile.update({
                        where: { worldId_x_y: { worldId, x, y } },
                        data: { lastRentCollected: now }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: rentAmount,
                            type: 'rent',
                            userId: user.id
                        }
                    })
                ]);

                // Send updated balance
                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", updatedUser?.balance);
                socket.emit("rent_collected", { x, y, amount: rentAmount });

            } catch (e) {
                console.error("Failed to collect rent:", e);
                socket.emit("error", { message: "Failed to collect rent" });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
    });
});
