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

    // Track in-memory state for alarm/police protection (persisted through server restart via reconnect)
    const playerPoliceProtection: Map<string, number> = new Map(); // walletAddress -> expiration timestamp
    const buildingAlarms: Map<string, number> = new Map(); // "worldId:x:y" -> expiration timestamp

    // Load state from DB on startup
    const loadServerState = async () => {
        try {
            console.log("Loading server state from database...");

            // Load active alarms
            const tilesWithAlarms = await (prisma as any).tile.findMany({
                where: { alarmExpiresAt: { gt: new Date() } }
            });
            tilesWithAlarms.forEach((tile: any) => {
                const tileKey = `${tile.worldId}:${tile.x}:${tile.y}`;
                if (tile.alarmExpiresAt) {
                    buildingAlarms.set(tileKey, new Date(tile.alarmExpiresAt).getTime());
                }
            });
            console.log(`Loaded ${tilesWithAlarms.length} active alarms.`);

            // Load active police protection
            const usersWithProtection = await (prisma as any).user.findMany({
                where: { policeProtectionUntil: { gt: new Date() } }
            });
            usersWithProtection.forEach((user: any) => {
                if (user.policeProtectionUntil) {
                    playerPoliceProtection.set(user.walletAddress, new Date(user.policeProtectionUntil).getTime());
                }
            });
            console.log(`Loaded ${usersWithProtection.length} active police protections.`);
        } catch (e) {
            console.error("Failed to load server state:", e);
        }
    };

    loadServerState();

    setInterval(async () => {
        try {
            // Get all owned tiles with commercial or residential buildings
            const ownedTiles = await prisma.tile.findMany({
                where: {
                    ownerId: { not: null },
                    OR: [
                        { type: { contains: 'shop' } },
                        { type: { contains: 'house' } },
                        { type: { contains: 'office' } },
                        { type: { contains: 'mall' } },
                        { type: { contains: 'apartment' } }
                    ]
                },
                include: { owner: true }
            });

            if (ownedTiles.length === 0) return;

            // 5% chance per tick that a robbery attempt occurs
            if (Math.random() > 0.05) return;

            // Select a random building
            const targetTile = ownedTiles[Math.floor(Math.random() * ownedTiles.length)];
            const tileKey = `${targetTile.worldId}:${targetTile.x}:${targetTile.y}`;
            const alarmExpiry = buildingAlarms.get(tileKey) || 0;
            const now = Date.now();

            // Calculate robbery amount (5-15% of estimated building value)
            const baseValue = 500; // Base value per building
            const robberyPercent = 0.05 + Math.random() * 0.1; // 5-15%
            const robberyAmount = Math.round(baseValue * robberyPercent);

            if (alarmExpiry > now) {
                // Alarm protected - robbery thwarted
                io.to(targetTile.worldId).emit("robbery_event", {
                    x: targetTile.x,
                    y: targetTile.y,
                    ownerAddress: targetTile.owner?.walletAddress,
                    amount: 0,
                    wasProtected: true,
                    message: "Robbery attempt thwarted by alarm system!"
                });
                console.log(`Robbery thwarted at ${targetTile.x},${targetTile.y} - alarm protected`);
            } else {
                // Robbery succeeds - deduct from owner
                if (targetTile.owner && targetTile.owner.balance >= robberyAmount) {
                    await prisma.user.update({
                        where: { id: targetTile.owner.id },
                        data: { balance: { decrement: robberyAmount } }
                    });

                    io.to(targetTile.worldId).emit("robbery_event", {
                        x: targetTile.x,
                        y: targetTile.y,
                        ownerAddress: targetTile.owner.walletAddress,
                        amount: robberyAmount,
                        wasProtected: false,
                        message: `Robbery! Lost $${robberyAmount}`
                    });
                    console.log(`Robbery at ${targetTile.x},${targetTile.y} - $${robberyAmount} stolen from ${targetTile.owner.walletAddress}`);
                }
            }
        } catch (e) {
            console.error("Error in robbery tick:", e);
        }
    }, 15000); // Every 15 seconds

    // ====================================================================
    // POLICE FINE TICK - Corrupted police fines
    // ====================================================================
    const FINE_REASONS = [
        "Unpermitted Construction",
        "Noise Complaint",
        "Tax Irregularity",
        "Building Code Violation",
        "Zoning Violation",
        "Environmental Infraction",
        "Traffic Obstruction"
    ];

    setInterval(async () => {
        try {
            // Get all users with positive balance
            const users = await prisma.user.findMany({
                where: { balance: { gt: 0 } }
            });

            if (users.length === 0) return;

            // 3% chance per tick that a fine occurs
            if (Math.random() > 0.03) return;

            // Select a random user
            const targetUser = users[Math.floor(Math.random() * users.length)];
            const now = Date.now();
            const protectionExpiry = playerPoliceProtection.get(targetUser.walletAddress) || 0;

            // Calculate fine amount ($50-$200)
            const fineAmount = 50 + Math.round(Math.random() * 150);
            const reason = FINE_REASONS[Math.floor(Math.random() * FINE_REASONS.length)];

            if (protectionExpiry > now) {
                // Protected by bribe - fine avoided
                io.emit("fine_event", {
                    type: "avoided",
                    targetAddress: targetUser.walletAddress,
                    amount: 0,
                    reason,
                    message: "Police fine avoided due to... connections."
                });
                console.log(`Fine avoided by ${targetUser.walletAddress} - bribe protection active`);
            } else {
                // Fine applied
                if (targetUser.balance >= fineAmount) {
                    await prisma.user.update({
                        where: { id: targetUser.id },
                        data: { balance: { decrement: fineAmount } }
                    });

                    io.emit("fine_event", {
                        type: "fine",
                        targetAddress: targetUser.walletAddress,
                        amount: fineAmount,
                        reason,
                        message: `Fine: $${fineAmount} for ${reason}`
                    });
                    console.log(`Fine issued to ${targetUser.walletAddress}: $${fineAmount} for ${reason}`);
                }
            }
        } catch (e) {
            console.error("Error in police fine tick:", e);
        }
    }, 20000); // Every 20 seconds

    // ====================================================================
    // LOAN INTEREST TICK - Accrue interest on outstanding loans
    // ====================================================================
    setInterval(async () => {
        try {
            // Get all unpaid loans
            const loans = await (prisma as any).loan.findMany({
                where: { repaid: false },
                include: { borrower: true }
            });

            for (const loan of loans) {
                // Daily interest (simplified: applied every 30 seconds for demo)
                // In production, this would be based on actual time elapsed
                const dailyRate = loan.interestRate / 365;
                const interestAmount = loan.outstanding * dailyRate;
                const newOutstanding = loan.outstanding + interestAmount;

                await (prisma as any).loan.update({
                    where: { id: loan.id },
                    data: { outstanding: newOutstanding }
                });

                // Check if loan is overdue (dueAt is in the past)
                const now = new Date();
                if (now > loan.dueAt && loan.borrower) {
                    // Grace period: 2 minutes (approx 4 in-game days in this demo)
                    const gracePeriodMs = 2 * 60 * 1000;
                    const isForeclosureTime = now.getTime() > new Date(loan.dueAt).getTime() + gracePeriodMs;

                    if (isForeclosureTime) {
                        // FORECLOSURE: Seize assets
                        console.log(`Foreclosing loan ${loan.id} for ${loan.borrower.walletAddress}`);

                        // Find borrower's tiles
                        const borrowerTiles = await prisma.tile.findMany({
                            where: { ownerId: loan.borrower.id }
                        });

                        if (borrowerTiles.length > 0) {
                            // Seize the first tile (or most valuable)
                            const seizedTile = borrowerTiles[0];

                            await (prisma as any).tile.update({
                                where: { id: seizedTile.id },
                                data: {
                                    ownerId: null,
                                    forSale: true,
                                    price: 1000 // Bank sale price
                                }
                            });

                            // Mark loan as foreclosed (repaid for simplicity)
                            await (prisma as any).loan.update({
                                where: { id: loan.id },
                                data: { repaid: true }
                            });

                            io.emit("loan_foreclosed", {
                                loanId: loan.id,
                                borrowerAddress: loan.borrower.walletAddress,
                                seizedTile: { x: seizedTile.x, y: seizedTile.y },
                                message: `Loan Foreclosed! Property at (${seizedTile.x}, ${seizedTile.y}) seized by the bank.`
                            });
                        } else {
                            // No assets to seize - just mark as bad debt for now
                            await (prisma as any).loan.update({
                                where: { id: loan.id },
                                data: { repaid: true }
                            });
                        }
                    } else {
                        // Emit warning to borrower
                        io.emit("loan_overdue", {
                            loanId: loan.id,
                            borrowerAddress: loan.borrower.walletAddress,
                            outstanding: newOutstanding,
                            dueAt: loan.dueAt
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error in loan interest tick:", e);
        }
    }, 30000); // Every 30 seconds (represents daily interest accrual)

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

        // Handle claiming an unowned tile (initial land acquisition with dynamic pricing)
        socket.on("claim_tile", async (data) => {
            const { worldId, x, y, buyerAddress, dynamicValue } = data;

            try {
                const buyer = await prisma.user.findUnique({ where: { walletAddress: buyerAddress } });
                if (!buyer) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                // Check if tile exists and is unowned
                const existingTile = await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } }
                });

                if (existingTile && existingTile.ownerId) {
                    socket.emit("error", { message: "Tile already owned" });
                    return;
                }

                // Use provided dynamic value or default to 100
                const price = dynamicValue || 100;

                if (buyer.balance < price) {
                    socket.emit("error", { message: "Insufficient funds" });
                    return;
                }

                // Execute transaction
                await prisma.$transaction([
                    // Deduct from buyer
                    prisma.user.update({
                        where: { id: buyer.id },
                        data: { balance: { decrement: price } }
                    }),
                    // Create or update tile with ownership
                    (prisma as any).tile.upsert({
                        where: { worldId_x_y: { worldId, x, y } },
                        create: {
                            worldId,
                            x,
                            y,
                            type: 'grass',
                            ownerId: buyer.id,
                            forSale: false
                        },
                        update: {
                            ownerId: buyer.id,
                            forSale: false
                        }
                    }),
                    // Record transaction
                    prisma.transaction.create({
                        data: {
                            amount: -price,
                            type: 'land_claim',
                            userId: buyer.id
                        }
                    })
                ]);

                // Broadcast update
                io.to(worldId).emit("tile_claimed", {
                    x,
                    y,
                    ownerAddress: buyerAddress,
                    price
                });

                // Emit updated balance to buyer
                const updatedBuyer = await prisma.user.findUnique({ where: { id: buyer.id } });
                socket.emit("balance_update", { balance: updatedBuyer?.balance || 0 });

                // Emit activity log
                io.to(worldId).emit("activity", {
                    type: "claim",
                    ownerAddress: buyerAddress,
                    x,
                    y,
                    price,
                    timestamp: Date.now()
                });

                console.log(`Tile at ${x},${y} claimed by ${buyerAddress} for $${price}`);

            } catch (e) {
                console.error("Failed to claim tile:", e);
                socket.emit("error", { message: "Failed to claim tile" });
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
                await (prisma as any).tile.update({
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
                    (prisma as any).tile.update({
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

                // Fetch world tax rate
                const world = await prisma.world.findUnique({ where: { id: worldId } }) as any;
                const taxRate = world?.taxRate || 0.1;
                const taxDeduction = Math.round(rentAmount * taxRate);
                const netRent = rentAmount - taxDeduction;

                // Execute transaction
                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: user.id },
                        data: { balance: { increment: netRent } }
                    }),
                    (prisma as any).tile.update({
                        where: { worldId_x_y: { worldId, x, y } },
                        data: { lastRentCollected: now }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: netRent,
                            type: 'rent',
                            userId: user.id
                        }
                    })
                ]);

                // Send updated balance
                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", { balance: updatedUser?.balance || 0 });
                socket.emit("rent_collected", { x, y, amount: netRent, tax: taxDeduction });

                console.log(`Rent collected at ${x},${y} by ${ownerAddress}: $${netRent} (Tax: $${taxDeduction})`);

            } catch (e) {
                console.error("Failed to collect rent:", e);
                socket.emit("error", { message: "Failed to collect rent" });
            }
        });

        // ====================================================================
        // ALARM SUBSCRIPTION
        // ====================================================================
        socket.on("subscribe_alarm", async (data) => {
            const { worldId, x, y, ownerAddress, duration } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                // Verify ownership
                const tile = await prisma.tile.findUnique({
                    where: { worldId_x_y: { worldId, x, y } }
                });

                if (!tile || tile.ownerId !== user.id) {
                    socket.emit("error", { message: "You don't own this property" });
                    return;
                }

                // Cost calculation: $100 per 7-day period (default)
                const durationMs = (duration || 7) * 24 * 60 * 60 * 1000; // Days to milliseconds
                const cost = Math.round((duration || 7) / 7) * 100;

                if (user.balance < cost) {
                    socket.emit("error", { message: "Insufficient funds for alarm subscription" });
                    return;
                }

                // Deduct cost and set alarm
                await prisma.user.update({
                    where: { id: user.id },
                    data: { balance: { decrement: cost } }
                });

                const expiryTime = new Date(Date.now() + durationMs);

                // Persist to DB
                await (prisma as any).tile.update({
                    where: { worldId_x_y: { worldId, x, y } },
                    data: { alarmExpiresAt: expiryTime }
                });

                const tileKey = `${worldId}:${x}:${y}`;
                buildingAlarms.set(tileKey, expiryTime.getTime());

                // Send confirmation
                socket.emit("alarm_subscribed", {
                    x,
                    y,
                    expiresAt: expiryTime,
                    cost
                });

                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", { balance: updatedUser?.balance || 0 });

                console.log(`Alarm subscribed for ${x},${y} by ${ownerAddress} until ${new Date(expiryTime).toISOString()}`);

            } catch (e) {
                console.error("Failed to subscribe alarm:", e);
                socket.emit("error", { message: "Failed to subscribe to alarm" });
            }
        });

        // ====================================================================
        // POLICE BRIBE
        // ====================================================================
        socket.on("pay_police_bribe", async (data) => {
            const { ownerAddress, duration } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                // Cost calculation: $500 per 7-day period (default)
                const durationMs = (duration || 7) * 24 * 60 * 60 * 1000;
                const cost = Math.round((duration || 7) / 7) * 500;

                if (user.balance < cost) {
                    socket.emit("error", { message: "Insufficient funds for... donations" });
                    return;
                }

                // Deduct cost and set protection
                await prisma.user.update({
                    where: { id: user.id },
                    data: { balance: { decrement: cost } }
                });

                const expiryTime = new Date(Date.now() + durationMs);

                // Persist to DB
                await (prisma as any).user.update({
                    where: { id: user.id },
                    data: { policeProtectionUntil: expiryTime }
                });

                playerPoliceProtection.set(ownerAddress, expiryTime.getTime());

                // Send confirmation
                socket.emit("police_bribe_accepted", {
                    expiresAt: expiryTime,
                    cost
                });

                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", { balance: updatedUser?.balance || 0 });

                io.emit("activity", {
                    type: "bribe",
                    ownerAddress,
                    amount: cost,
                    timestamp: Date.now()
                });

                console.log(`Police bribe paid by ${ownerAddress}: $${cost} for protection until ${new Date(expiryTime).toISOString()}`);

            } catch (e) {
                console.error("Failed to process police bribe:", e);
                socket.emit("error", { message: "Failed to process payment" });
            }
        });

        // ====================================================================
        // LOAN REQUEST
        // ====================================================================
        socket.on("request_loan", async (data) => {
            const { ownerAddress, amount } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                // Loan limits (e.g., max $50,000 or based on net worth)
                const maxLoan = 50000;
                if (amount > maxLoan) {
                    socket.emit("error", { message: `Maximum loan amount is $${maxLoan}` });
                    return;
                }

                // Interest rate: 5% base
                const interestRate = 0.05;
                const dueAt = new Date();
                dueAt.setDate(dueAt.getDate() + 30); // 30 days due date

                // Create loan and credit user
                const loan = await (prisma as any).loan.create({
                    data: {
                        borrowerId: user.id,
                        principal: amount,
                        interestRate,
                        outstanding: amount,
                        dueAt,
                        repaid: false
                    }
                });

                await prisma.user.update({
                    where: { id: user.id },
                    data: { balance: { increment: amount } }
                });

                // Record transaction
                await prisma.transaction.create({
                    data: {
                        amount,
                        type: 'loan_disbursement',
                        userId: user.id
                    }
                });

                socket.emit("loan_approved", {
                    loanId: loan.id,
                    amount,
                    interestRate,
                    dueAt: loan.dueAt
                });

                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", { balance: updatedUser?.balance || 0 });

                io.emit("activity", {
                    type: "loan",
                    ownerAddress,
                    amount,
                    timestamp: Date.now()
                });

                console.log(`Loan of $${amount} approved for ${ownerAddress}`);

            } catch (e) {
                console.error("Failed to process loan request:", e);
                socket.emit("error", { message: "Failed to process loan request" });
            }
        });

        // ====================================================================
        // LOAN REPAYMENT
        // ====================================================================
        socket.on("repay_loan", async (data) => {
            const { ownerAddress, loanId, amount } = data;

            try {
                const user = await prisma.user.findUnique({ where: { walletAddress: ownerAddress } });
                if (!user) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                const loan = await (prisma as any).loan.findUnique({
                    where: { id: loanId }
                });

                if (!loan || loan.borrowerId !== user.id || loan.repaid) {
                    socket.emit("error", { message: "Loan not found or already repaid" });
                    return;
                }

                const repayAmount = Math.min(amount, loan.outstanding);

                if (user.balance < repayAmount) {
                    socket.emit("error", { message: "Insufficient funds for repayment" });
                    return;
                }

                const newOutstanding = loan.outstanding - repayAmount;
                const isFullyRepaid = newOutstanding < 1; // Tolerance for floating point

                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: user.id },
                        data: { balance: { decrement: repayAmount } }
                    }),
                    (prisma as any).loan.update({
                        where: { id: loanId },
                        data: {
                            outstanding: isFullyRepaid ? 0 : newOutstanding,
                            repaid: isFullyRepaid
                        }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: -repayAmount,
                            type: 'loan_repayment',
                            userId: user.id
                        }
                    })
                ]);

                socket.emit("loan_repaid", {
                    loanId,
                    amount: repayAmount,
                    remaining: isFullyRepaid ? 0 : newOutstanding,
                    repaid: isFullyRepaid
                });

                const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
                socket.emit("balance_update", { balance: updatedUser?.balance || 0 });

                console.log(`Loan repayment of $${repayAmount} by ${ownerAddress}. Remaining: ${newOutstanding}`);

            } catch (e) {
                console.error("Failed to process loan repayment:", e);
                socket.emit("error", { message: "Failed to process repayment" });
            }
        });

        // ====================================================================
        // MULTIPLAYER BUILDINGS: GLOBAL MARKET & TRADE EMBASSY
        // ====================================================================

        // Get all tiles for sale in the world
        socket.on("get_market_listings", async (data) => {
            const { worldId } = data;
            try {
                const listings = await (prisma as any).tile.findMany({
                    where: {
                        worldId,
                        forSale: true
                    },
                    include: { owner: true }
                });
                socket.emit("market_listings", listings);
            } catch (e) {
                console.error("Failed to fetch market listings:", e);
            }
        });

        // Send money to another player
        socket.on("send_gift", async (data) => {
            const { fromAddress, toAddress, amount } = data;
            try {
                const sender = await prisma.user.findUnique({ where: { walletAddress: fromAddress } });
                const recipient = await prisma.user.findUnique({ where: { walletAddress: toAddress } });

                if (!sender || !recipient) {
                    socket.emit("error", { message: "User not found" });
                    return;
                }

                if (sender.balance < amount) {
                    socket.emit("error", { message: "Insufficient funds" });
                    return;
                }

                await prisma.$transaction([
                    prisma.user.update({
                        where: { id: sender.id },
                        data: { balance: { decrement: amount } }
                    }),
                    prisma.user.update({
                        where: { id: recipient.id },
                        data: { balance: { increment: amount } }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: -amount,
                            type: 'gift_sent',
                            userId: sender.id
                        }
                    }),
                    prisma.transaction.create({
                        data: {
                            amount: amount,
                            type: 'gift_received',
                            userId: recipient.id
                        }
                    })
                ]);

                // Notify both
                socket.emit("gift_sent", { to: toAddress, amount });
                io.emit("gift_received", { from: fromAddress, to: toAddress, amount });

                // Update balances
                const updatedSender = await prisma.user.findUnique({ where: { id: sender.id } });
                socket.emit("balance_update", { balance: updatedSender?.balance || 0 });

                console.log(`Gift of $${amount} sent from ${fromAddress} to ${toAddress}`);
            } catch (e) {
                console.error("Failed to send gift:", e);
                socket.emit("error", { message: "Failed to send gift" });
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
