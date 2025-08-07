import cron from 'node-cron'
import { PrismaClient  } from '@prisma/client'

const prisma = new PrismaClient()

// Runs every minute
cron.schedule('* * * * *', async () => {
    try {
        const result = await prisma.message.deleteMany({
            where: {
                expiresAt: {
                    lte: new Date(),
                },
            },
        })
        if (result.count > 0) {
            console.log(`🧹 Deleted ${result.count} expired messages`)
        }
    } catch (error) {
        console.log('Failed to delete expired messages:', err)
    }
})