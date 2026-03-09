const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const driverNames = ['vivek', 'preetam', 'kokan', 'chhotelal'];

    console.log("Wiping database and seeding clean driver profiles...");

    // Clear all old data
    await prisma.settlement.deleteMany();
    await prisma.dailyRecord.deleteMany();
    await prisma.miscExpense.deleteMany();
    await prisma.driver.deleteMany();

    // Recreate drivers with 0 balances
    for (const name of driverNames) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        await prisma.driver.create({
            data: {
                name: capitalizedName,
                phone: '',
                salaryPercentage: 0.35
            }
        });
        console.log(`Created clean driver: ${capitalizedName}`);
    }

    console.log("✅ Complete! Database wiped. Only driver profiles remain.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
