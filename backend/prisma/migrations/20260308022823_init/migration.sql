-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "salaryPercentage" REAL NOT NULL DEFAULT 0.40,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "driverId" TEXT NOT NULL,
    "carNumber" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uber" REAL NOT NULL DEFAULT 0,
    "inDrive" REAL NOT NULL DEFAULT 0,
    "yatri" REAL NOT NULL DEFAULT 0,
    "rapido" REAL NOT NULL DEFAULT 0,
    "offline" REAL NOT NULL DEFAULT 0,
    "uberComm" REAL NOT NULL DEFAULT 0,
    "yatriComm" REAL NOT NULL DEFAULT 0,
    "uberCash" REAL NOT NULL DEFAULT 0,
    "inDriveCash" REAL NOT NULL DEFAULT 0,
    "yatriCash" REAL NOT NULL DEFAULT 0,
    "rapidoCash" REAL NOT NULL DEFAULT 0,
    "offlineCash" REAL NOT NULL DEFAULT 0,
    "fuel" REAL NOT NULL DEFAULT 0,
    "otherExpenses" REAL NOT NULL DEFAULT 0,
    "onlinePayments" REAL NOT NULL DEFAULT 0,
    "totalEarnings" REAL NOT NULL DEFAULT 0,
    "totalCommission" REAL NOT NULL DEFAULT 0,
    "netEarnings" REAL NOT NULL DEFAULT 0,
    "driverSalary" REAL NOT NULL DEFAULT 0,
    "totalCash" REAL NOT NULL DEFAULT 0,
    "totalExpenses" REAL NOT NULL DEFAULT 0,
    "cashInHand" REAL NOT NULL DEFAULT 0,
    "pendingSalary" REAL NOT NULL DEFAULT 0,
    "driverSalaryPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
