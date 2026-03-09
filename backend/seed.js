const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate realistic data for the past 30 days
async function main() {
    const driverNames = ['vivek', 'preetam', 'kokan', 'chhotelal'];
    const cars = ['3905', '4030', 'ev2335'];

    console.log("Seeding realistic transaction data...");

    // Clear old data for a fresh view
    await prisma.dailyRecord.deleteMany();
    await prisma.miscExpense.deleteMany();
    await prisma.driver.deleteMany();

    const today = new Date();

    // 1. Ensure drivers exist
    const drivers = [];
    for (const name of driverNames) {
        const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
        let driver = await prisma.driver.create({
            data: {
                name: capitalizedName,
                phone: '',
                salaryPercentage: 0.35
            }
        });
        console.log(`Created driver: ${capitalizedName}`);
        drivers.push(driver);
    }

    // 2. Generate Daily Records (Past 30 days)
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        // Each driver works some days
        for (const driver of drivers) {
            // 80% chance a driver worked on any given day
            if (Math.random() > 0.2) {
                const carNumber = cars[getRandomInt(0, cars.length - 1)];

                // Random earnings
                const uber = getRandomInt(800, 2500);
                const inDrive = getRandomInt(0, 1000);
                const offline = getRandomInt(200, 1500);

                const uberComm = Math.round(uber * 0.25); // ~25% commission
                const uberCash = Math.round(uber * 0.4); // ~40% paid in cash
                const inDriveCash = inDrive;
                const offlineCash = offline; // Offline is 100% cash

                const totalEarnings = uber + inDrive + offline;
                const totalCommission = uberComm;
                const netEarnings = totalEarnings - totalCommission;
                const driverSalary = netEarnings * driver.salaryPercentage;

                const totalCash = uberCash + inDriveCash + offlineCash;
                const fuel = getRandomInt(300, 800);
                const otherExpenses = getRandomInt(0, 100);
                const onlinePayments = getRandomInt(0, 200);

                const totalExpenses = fuel + otherExpenses;
                let cashInHand = totalCash - totalExpenses - onlinePayments;

                // 70% chance they got paid their salary that day
                const driverSalaryPaid = Math.random() > 0.3;
                let pendingSalary = 0;

                if (driverSalaryPaid) {
                    cashInHand -= driverSalary;
                } else {
                    pendingSalary = driverSalary;
                }

                await prisma.dailyRecord.create({
                    data: {
                        driverId: driver.id,
                        carNumber,
                        date,
                        uber, inDrive, offline,
                        uberComm,
                        uberCash, inDriveCash, offlineCash,
                        fuel, otherExpenses, onlinePayments,
                        totalEarnings, totalCommission, netEarnings, driverSalary,
                        totalCash, totalExpenses, cashInHand, driverSalaryPaid, pendingSalary
                    }
                });
            }
        }
    }

    // 3. Generate some Misc Expenses
    const categories = ['denting_painting', 'paperwork', 'insurance', 'challan', 'other'];
    for (let i = 0; i < 8; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - getRandomInt(1, 28));

        await prisma.miscExpense.create({
            data: {
                category: categories[getRandomInt(0, categories.length - 1)],
                amount: getRandomInt(500, 5000),
                description: "Routine maintenance or fine",
                carNumber: cars[getRandomInt(0, cars.length - 1)],
                date
            }
        });
    }

    console.log("✅ Seed complete! You now have 30 days of data and misc expenses.");
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
