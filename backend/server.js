require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

// ======================================================================
// Helper: Get date range boundaries
// ======================================================================
function getDateRange(range) {
  const now = new Date();
  const start = new Date();

  switch (range) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      start.setMonth(now.getMonth() - 3);
      break;
    case 'half':
      start.setMonth(now.getMonth() - 6);
      break;
    case 'year':
      start.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
    default:
      return {}; // no filter
  }

  return { gte: start, lte: now };
}

// ======================================================================
// DRIVERS
// ======================================================================
app.post('/api/drivers', async (req, res) => {
  try {
    const { name, phone, salaryPercentage } = req.body;
    const driver = await prisma.driver.create({
      data: {
        name,
        phone,
        salaryPercentage: salaryPercentage !== undefined ? parseFloat(salaryPercentage) : 0.40,
      },
    });
    res.status(201).json(driver);
  } catch (error) {
    console.error("Error creating driver:", error);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

app.get('/api/drivers', async (req, res) => {
  try {
    const drivers = await prisma.driver.findMany({
      include: {
        records: true,
        settlements: true
      }
    });

    const driversWithBalance = drivers.map(d => {
      let balance = 0;
      d.records.forEach(r => {
        balance += r.driverSalary;
        balance -= r.cashInHand;
      });
      d.settlements.forEach(s => {
        balance += s.amount;
      });

      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        salaryPercentage: d.salaryPercentage,
        currentBalance: balance,
        records: d.records.sort((a, b) => b.date - a.date).slice(0, 5)
      };
    });

    res.json(driversWithBalance);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

// ======================================================================
// DAILY RECORDS
// ======================================================================
app.post('/api/records', async (req, res) => {
  try {
    const { driverId, date, carNumber, ...inputs } = req.body;

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const val = (num) => isNaN(parseFloat(num)) ? 0 : parseFloat(num);

    const uber = val(inputs.uber), inDrive = val(inputs.inDrive), yatri = val(inputs.yatri), rapido = val(inputs.rapido), offline = val(inputs.offline);
    const uberComm = val(inputs.uberComm), yatriComm = val(inputs.yatriComm);
    const uberCash = val(inputs.uberCash), inDriveCash = val(inputs.inDriveCash), yatriCash = val(inputs.yatriCash), rapidoCash = val(inputs.rapidoCash), offlineCash = val(inputs.offlineCash);
    const fuel = val(inputs.fuel), otherExpenses = val(inputs.otherExpenses), onlinePayments = val(inputs.onlinePayments);
    const driverSalaryPaid = Boolean(inputs.driverSalaryPaid);

    const totalEarnings = uber + inDrive + yatri + rapido + offline;
    const totalCommission = uberComm + yatriComm;
    const netEarnings = totalEarnings - totalCommission;
    const driverSalary = netEarnings * driver.salaryPercentage;
    const totalCash = uberCash + inDriveCash + yatriCash + rapidoCash + offlineCash;
    const totalExpenses = fuel + otherExpenses;

    let cashInHand = totalCash - totalExpenses - onlinePayments;
    let pendingSalary = driverSalary; // Always pending initially in ledger

    const record = await prisma.dailyRecord.create({
      data: {
        driverId, carNumber,
        date: date ? new Date(date) : new Date(),
        uber, inDrive, yatri, rapido, offline,
        uberComm, yatriComm,
        uberCash, inDriveCash, yatriCash, rapidoCash, offlineCash,
        fuel, otherExpenses, onlinePayments,
        totalEarnings, totalCommission, netEarnings, driverSalary,
        totalCash, totalExpenses, cashInHand, pendingSalary
      }
    });

    res.status(201).json(record);
  } catch (error) {
    console.error("Error creating record:", error);
    res.status(500).json({ error: 'Failed to create record', details: error.message });
  }
});

app.get('/api/records', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const records = await prisma.dailyRecord.findMany({
      where,
      include: { driver: true },
      orderBy: { date: 'desc' }
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ======================================================================
// SETTLEMENTS (DRIVER CASHIER LEDGER)
// ======================================================================
app.post('/api/settlements', async (req, res) => {
  try {
    const { driverId, amount, cashierName, description, date } = req.body;
    const settlement = await prisma.settlement.create({
      data: {
        driverId,
        amount: parseFloat(amount),
        cashierName,
        description: description || null,
        date: date ? new Date(date) : new Date(),
      }
    });
    res.status(201).json(settlement);
  } catch (error) {
    console.error("Error creating settlement:", error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

app.get('/api/settlements', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const settlements = await prisma.settlement.findMany({
      where,
      include: { driver: true },
      orderBy: { date: 'desc' }
    });
    res.json(settlements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

// ======================================================================
// MISCELLANEOUS EXPENSES
// ======================================================================
app.post('/api/misc-expenses', async (req, res) => {
  try {
    const { category, description, amount, carNumber, driverId, date } = req.body;
    const expense = await prisma.miscExpense.create({
      data: {
        category,
        description: description || null,
        amount: parseFloat(amount),
        carNumber: carNumber || null,
        driverId: driverId || null,
        date: date ? new Date(date) : new Date(),
      }
    });
    res.status(201).json(expense);
  } catch (error) {
    console.error("Error creating misc expense:", error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

app.get('/api/misc-expenses', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const expenses = await prisma.miscExpense.findMany({
      where,
      include: { driver: true },
      orderBy: { date: 'desc' }
    });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch misc expenses' });
  }
});

// ======================================================================
// ANALYTICS — Overall KPIs (with time-range)
// ======================================================================
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    // Aggregate DailyRecord
    const agg = await prisma.dailyRecord.aggregate({
      where,
      _sum: {
        totalEarnings: true, netEarnings: true, totalCash: true,
        totalExpenses: true, pendingSalary: true, cashInHand: true,
        driverSalary: true, totalCommission: true, fuel: true,
        onlinePayments: true, otherExpenses: true,
      },
      _count: { id: true }
    });

    // Aggregate MiscExpense
    const miscAgg = await prisma.miscExpense.aggregate({
      where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
      _sum: { amount: true },
      _count: { id: true }
    });

    // Misc breakdown by category
    const miscExpenses = await prisma.miscExpense.findMany({
      where: Object.keys(dateFilter).length ? { date: dateFilter } : {},
      select: { category: true, amount: true }
    });

    const miscByCategory = {};
    miscExpenses.forEach(e => {
      miscByCategory[e.category] = (miscByCategory[e.category] || 0) + e.amount;
    });

    const totalMisc = miscAgg._sum.amount || 0;
    const totalDailyExpenses = (agg._sum.totalExpenses || 0) + (agg._sum.onlinePayments || 0);
    const overallExpenses = totalDailyExpenses + totalMisc;
    const overallProfit = (agg._sum.netEarnings || 0) - (agg._sum.driverSalary || 0) - totalMisc;

    res.json({
      totals: agg._sum,
      recordCount: agg._count.id,
      miscTotal: totalMisc,
      miscCount: miscAgg._count.id,
      miscByCategory,
      overallExpenses,
      overallProfit,
    });
  } catch (error) {
    console.error("Error fetching overview:", error);
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// ======================================================================
// ANALYTICS — Per-Driver breakdown (with time-range)
// ======================================================================
app.get('/api/analytics/drivers', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const drivers = await prisma.driver.findMany();
    const results = [];

    for (const driver of drivers) {
      const agg = await prisma.dailyRecord.aggregate({
        where: { ...where, driverId: driver.id },
        _sum: {
          totalEarnings: true, netEarnings: true, totalCash: true,
          totalExpenses: true, pendingSalary: true, cashInHand: true,
          driverSalary: true, fuel: true, onlinePayments: true,
        },
        _count: { id: true }
      });

      const miscAgg = await prisma.miscExpense.aggregate({
        where: {
          driverId: driver.id,
          ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
        },
        _sum: { amount: true },
      });

      const totalMisc = miscAgg._sum.amount || 0;
      const netEarnings = agg._sum.netEarnings || 0;
      const driverSalary = agg._sum.driverSalary || 0;
      const profit = netEarnings - driverSalary - totalMisc;

      results.push({
        id: driver.id,
        name: driver.name,
        percentage: driver.salaryPercentage,
        totalEarnings: agg._sum.totalEarnings || 0,
        netEarnings,
        totalExpenses: (agg._sum.totalExpenses || 0) + (agg._sum.onlinePayments || 0),
        driverSalary,
        pendingSalary: agg._sum.pendingSalary || 0,
        cashCollected: agg._sum.totalCash || 0,
        cashInHand: agg._sum.cashInHand || 0,
        miscExpenses: totalMisc,
        profit,
        trips: agg._count.id,
      });
    }

    res.json(results);
  } catch (error) {
    console.error("Error fetching driver analytics:", error);
    res.status(500).json({ error: 'Failed to fetch driver analytics' });
  }
});

// Backward compat: old analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const agg = await prisma.dailyRecord.aggregate({
      _sum: { totalEarnings: true, netEarnings: true, totalCash: true, totalExpenses: true, pendingSalary: true, cashInHand: true, driverSalary: true },
      _count: { id: true }
    });
    res.json({ totals: agg._sum, totalTripsDaysRecorded: agg._count.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
