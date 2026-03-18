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
        salaryPercentage: salaryPercentage !== undefined ? parseFloat(salaryPercentage) : 0.35,
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
        balance += r.pendingSalary;
        balance -= (r.cashInHand - r.cashToCashier); // Driver keeps fleet money = balance goes down
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
// DRIVER REPORT — Full history for a single driver
// ======================================================================
app.get('/api/drivers/:id/report', async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: { records: true, settlements: true, miscExpenses: true }
    });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    // Compute running balance
    let balance = 0;
    driver.records.forEach(r => {
      balance += r.pendingSalary;
      balance -= (r.cashInHand - r.cashToCashier);
    });
    driver.settlements.forEach(s => { balance += s.amount; });

    // Sort records by date desc
    const sortedRecords = driver.records.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Earnings over time (last 30 records, sorted asc for chart)
    const chartData = sortedRecords.slice(0, 30).reverse().map(r => ({
      date: r.date,
      earnings: r.totalEarnings,
      netEarnings: r.netEarnings,
      salary: r.driverSalary,
      cashToCashier: r.cashToCashier,
      km: r.totalKm,
    }));

    // Aggregates
    const totalEarnings = driver.records.reduce((s, r) => s + r.totalEarnings, 0);
    const totalNet = driver.records.reduce((s, r) => s + r.netEarnings, 0);
    const totalSalary = driver.records.reduce((s, r) => s + r.driverSalary, 0);
    const totalCash = driver.records.reduce((s, r) => s + r.cashToCashier, 0);
    const totalKm = driver.records.reduce((s, r) => s + r.totalKm, 0);
    const totalMisc = driver.miscExpenses.reduce((s, e) => s + e.amount, 0);

    res.json({
      driver: { id: driver.id, name: driver.name, phone: driver.phone, salaryPercentage: driver.salaryPercentage },
      currentBalance: balance,
      summary: { totalEarnings, totalNet, totalSalary, totalCash, totalKm, totalMisc, totalRecords: driver.records.length },
      chartData,
      records: sortedRecords,
      settlements: driver.settlements.sort((a, b) => new Date(b.date) - new Date(a.date)),
      miscExpenses: driver.miscExpenses.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (error) {
    console.error("Error fetching driver report:", error);
    res.status(500).json({ error: 'Failed to fetch driver report' });
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
    const intVal = (num) => isNaN(parseInt(num, 10)) ? 0 : parseInt(num, 10);

    const startKm = val(inputs.startKm), endKm = val(inputs.endKm), totalKm = val(inputs.totalKm);
    const yatriTrips = intVal(inputs.yatriTrips);
    const cashToCashier = val(inputs.cashToCashier);
    const fuelDetails = Array.isArray(inputs.fuelDetails) ? inputs.fuelDetails : [];

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
        startKm, endKm, totalKm, yatriTrips, cashToCashier, fuelDetails,
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

app.get('/api/records/:id', async (req, res) => {
  try {
    const record = await prisma.dailyRecord.findUnique({
      where: { id: req.params.id },
      include: { driver: true }
    });
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (error) {
    console.error("Error fetching record:", error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
});

app.put('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.dailyRecord.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const driver = await prisma.driver.findUnique({ where: { id: existing.driverId } });
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    const { date, carNumber, ...inputs } = req.body;
    const val = (num) => isNaN(parseFloat(num)) ? 0 : parseFloat(num);
    const intVal = (num) => isNaN(parseInt(num, 10)) ? 0 : parseInt(num, 10);

    const startKm = val(inputs.startKm), endKm = val(inputs.endKm), totalKm = val(inputs.totalKm);
    const yatriTrips = intVal(inputs.yatriTrips);
    const cashToCashier = val(inputs.cashToCashier);
    const fuelDetails = Array.isArray(inputs.fuelDetails) ? inputs.fuelDetails : [];

    const uber = val(inputs.uber), inDrive = val(inputs.inDrive), yatri = val(inputs.yatri), rapido = val(inputs.rapido), offline = val(inputs.offline);
    const uberComm = val(inputs.uberComm), yatriComm = val(inputs.yatriComm);
    const uberCash = val(inputs.uberCash), inDriveCash = val(inputs.inDriveCash), yatriCash = val(inputs.yatriCash), rapidoCash = val(inputs.rapidoCash), offlineCash = val(inputs.offlineCash);
    const fuel = val(inputs.fuel), otherExpenses = val(inputs.otherExpenses), onlinePayments = val(inputs.onlinePayments);

    const totalEarnings = uber + inDrive + yatri + rapido + offline;
    const totalCommission = uberComm + yatriComm;
    const netEarnings = totalEarnings - totalCommission;
    const driverSalary = netEarnings * driver.salaryPercentage;
    const totalCash = uberCash + inDriveCash + yatriCash + rapidoCash + offlineCash;
    const totalExpenses = fuel + otherExpenses;
    const cashInHand = totalCash - totalExpenses - onlinePayments;
    const pendingSalary = driverSalary;

    const record = await prisma.dailyRecord.update({
      where: { id },
      data: {
        carNumber,
        date: date ? new Date(date) : existing.date,
        startKm, endKm, totalKm, yatriTrips, cashToCashier, fuelDetails,
        uber, inDrive, yatri, rapido, offline,
        uberComm, yatriComm,
        uberCash, inDriveCash, yatriCash, rapidoCash, offlineCash,
        fuel, otherExpenses, onlinePayments,
        totalEarnings, totalCommission, netEarnings, driverSalary,
        totalCash, totalExpenses, cashInHand, pendingSalary
      }
    });

    res.json(record);
  } catch (error) {
    console.error("Error updating record:", error);
    res.status(500).json({ error: 'Failed to update record', details: error.message });
  }
});

app.delete('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dailyRecord.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting record:", error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

// ======================================================================
// SETTLEMENTS (DRIVER CASHIER LEDGER)
// ======================================================================
app.post('/api/settlements', async (req, res) => {
  try {
    const { driverId, amount, cashierName, description, date, method } = req.body;
    const settlement = await prisma.settlement.create({
      data: {
        driverId,
        amount: parseFloat(amount),
        method: method || 'cash',
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
          totalExpenses: true, pendingSalary: true, cashInHand: true, cashToCashier: true,
          driverSalary: true, fuel: true, onlinePayments: true, totalKm: true
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
        cashToCashier: agg._sum.cashToCashier || 0,
        totalKm: agg._sum.totalKm || 0,
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

// ======================================================================
// DUPLICATE CHECK — Check if record exists for driver on date
// ======================================================================
app.get('/api/records/check-duplicate', async (req, res) => {
  try {
    const { driverId, date } = req.query;
    if (!driverId || !date) return res.json({ exists: false });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.dailyRecord.findFirst({
      where: {
        driverId,
        date: { gte: dayStart, lte: dayEnd }
      },
      select: { id: true, totalEarnings: true, cashToCashier: true, createdAt: true }
    });

    res.json({ exists: !!existing, record: existing });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    res.status(500).json({ error: 'Failed to check duplicate' });
  }
});

// ======================================================================
// DAILY SUMMARY — Aggregate all drivers for a given date
// ======================================================================
app.get('/api/daily-summary', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const records = await prisma.dailyRecord.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      include: { driver: true }
    });

    const drivers = await prisma.driver.findMany({
      include: { records: true, settlements: true }
    });

    // Compute balance per driver
    const balanceMap = {};
    drivers.forEach(d => {
      let balance = 0;
      d.records.forEach(r => {
        balance += r.pendingSalary;
        balance -= (r.cashInHand - r.cashToCashier);
      });
      d.settlements.forEach(s => { balance += s.amount; });
      balanceMap[d.id] = { name: d.name, balance };
    });

    const totalEarnings = records.reduce((s, r) => s + r.totalEarnings, 0);
    const totalCash = records.reduce((s, r) => s + r.totalCash, 0);
    const totalCashCollected = records.reduce((s, r) => s + r.cashToCashier, 0);
    const totalFuel = records.reduce((s, r) => s + r.fuel, 0);
    const totalSalary = records.reduce((s, r) => s + r.driverSalary, 0);

    const totalCommission = records.reduce((s, r) => s + r.totalCommission, 0);
    const totalNet = records.reduce((s, r) => s + r.netEarnings, 0);
    const totalExpenses = records.reduce((s, r) => s + r.totalExpenses, 0);
    const totalOnline = records.reduce((s, r) => s + r.onlinePayments, 0);

    res.json({
      date,
      recordCount: records.length,
      totalEarnings,
      totalCash,
      totalCashCollected,
      totalFuel,
      totalSalary,
      totalCommission,
      totalNet,
      totalExpenses,
      totalOnline,
      driverRecords: records.map(r => ({
        id: r.id,
        driverId: r.driverId,
        driverName: r.driver?.name,
        carNumber: r.carNumber,
        totalEarnings: r.totalEarnings,
        netEarnings: r.netEarnings,
        totalCommission: r.totalCommission,
        driverSalary: r.driverSalary,
        totalCash: r.totalCash,
        cashToCashier: r.cashToCashier,
        cashInHand: r.cashInHand,
        fuel: r.fuel,
        totalExpenses: r.totalExpenses,
        onlinePayments: r.onlinePayments,
        totalKm: r.totalKm,
        startKm: r.startKm,
        endKm: r.endKm,
        uber: r.uber,
        inDrive: r.inDrive,
        yatri: r.yatri,
        rapido: r.rapido,
        offline: r.offline,
        balance: balanceMap[r.driverId]?.balance || 0
      })),
      allBalances: Object.entries(balanceMap)
        .filter(([, v]) => v.balance !== 0)
        .map(([id, v]) => ({ id, name: v.name, balance: v.balance }))
    });
  } catch (error) {
    console.error('Error fetching daily summary:', error);
    res.status(500).json({ error: 'Failed to fetch daily summary' });
  }
});

// ======================================================================
// QUICK SETTLE — Cashier-side settlement
// ======================================================================
app.post('/api/quick-settle', async (req, res) => {
  try {
    const { driverId, amount, direction, method } = req.body;
    // direction: 'driver_pays' (driver gives cash to fleet) or 'fleet_pays' (fleet gives cash to driver)
    const finalAmount = direction === 'driver_pays' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount));

    const settlement = await prisma.settlement.create({
      data: {
        driverId,
        amount: finalAmount,
        method: method || 'cash',
        cashierName: 'Cashier',
        description: `Quick settle via ${method || 'cash'}`,
        date: new Date(),
      }
    });
    res.status(201).json(settlement);
  } catch (error) {
    console.error('Error quick settling:', error);
    res.status(500).json({ error: 'Failed to settle' });
  }
});

// ======================================================================
// CASHIER DEPOSITS — Track cashier → owner money transfers
// ======================================================================
app.post('/api/cashier-deposits', async (req, res) => {
  try {
    const { amount, method, cashierName, description, date } = req.body;
    const deposit = await prisma.cashierDeposit.create({
      data: {
        amount: parseFloat(amount),
        method: method || 'cash',
        cashierName,
        description: description || null,
        date: date ? new Date(date) : new Date(),
      }
    });
    res.status(201).json(deposit);
  } catch (error) {
    console.error("Error creating cashier deposit:", error);
    res.status(500).json({ error: 'Failed to create deposit' });
  }
});

app.get('/api/cashier-deposits', async (req, res) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = getDateRange(range);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const deposits = await prisma.cashierDeposit.findMany({
      where,
      orderBy: { date: 'desc' }
    });
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cashier deposits' });
  }
});

// Cashier balance: total cash held by cashier
app.get('/api/cashier-balance', async (req, res) => {
  try {
    // Cash IN: daily cashToCashier from records + cash settlements where driver paid cash
    const records = await prisma.dailyRecord.findMany({ select: { cashToCashier: true } });
    const cashFromRecords = records.reduce((s, r) => s + r.cashToCashier, 0);

    const settlements = await prisma.settlement.findMany({ select: { amount: true, method: true } });
    // Positive settlement = driver paid. Only cash settlements add to cashier.
    const cashFromSettlements = settlements
      .filter(s => s.method === 'cash' && s.amount > 0)
      .reduce((s, r) => s + r.amount, 0);
    // Negative settlement via cash = cashier paid driver from cash
    const cashPaidOut = settlements
      .filter(s => s.method === 'cash' && s.amount < 0)
      .reduce((s, r) => s + Math.abs(r.amount), 0);

    // Cash OUT: deposits to owner
    const deposits = await prisma.cashierDeposit.findMany({ select: { amount: true } });
    const totalDeposited = deposits.reduce((s, d) => s + d.amount, 0);

    const cashierBalance = cashFromRecords + cashFromSettlements - cashPaidOut - totalDeposited;

    res.json({
      cashFromRecords,
      cashFromSettlements,
      cashPaidOut,
      totalDeposited,
      cashierBalance,
    });
  } catch (error) {
    console.error("Error fetching cashier balance:", error);
    res.status(500).json({ error: 'Failed to fetch cashier balance' });
  }
});

// ======================================================================
// MONTHLY OFFLINE — Track monthly customer receivables
// ======================================================================
app.get('/api/monthly-receivables', async (req, res) => {
  try {
    // Monthly offline amounts are 730 and 365
    const monthlyAmounts = [730, 365];
    const records = await prisma.dailyRecord.findMany({
      where: { offline: { in: monthlyAmounts } },
      include: { driver: true },
      orderBy: { date: 'desc' }
    });

    const totalReceivable = records.reduce((s, r) => s + r.offline, 0);
    const byAmount = {};
    monthlyAmounts.forEach(amt => {
      const filtered = records.filter(r => r.offline === amt);
      byAmount[amt] = {
        count: filtered.length,
        total: filtered.reduce((s, r) => s + r.offline, 0),
      };
    });

    res.json({
      totalReceivable,
      recordCount: records.length,
      byAmount,
      recentRecords: records.slice(0, 20).map(r => ({
        id: r.id,
        driverName: r.driver?.name,
        amount: r.offline,
        date: r.date,
      })),
    });
  } catch (error) {
    console.error("Error fetching monthly receivables:", error);
    res.status(500).json({ error: 'Failed to fetch monthly receivables' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
