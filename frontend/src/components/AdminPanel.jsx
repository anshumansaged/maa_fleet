import { useState, useEffect } from 'react';
import axios from 'axios';
import { Fuel, AlertCircle, TrendingUp, Wallet, CheckCircle2, Clock, BarChart3, ArrowUpRight, ArrowDownRight, Plus, X, Wrench, FileText, Shield, CircleDollarSign, User, Car, Trash2, Send, Copy, Edit3, Calendar, ChevronLeft, ChevronRight, History, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';
const PREDEFINED_CARS = ['3905', '4030', 'ev2335'];

const TIME_RANGES = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'quarter', label: 'Quarter' },
    { key: 'half', label: '6 Months' },
    { key: 'year', label: 'Year' },
    { key: 'all', label: 'All Time' },
];

const MISC_CATEGORIES = [
    { value: 'denting_painting', label: 'Denting / Painting', icon: <Wrench className="w-4 h-4" /> },
    { value: 'paperwork', label: 'Paperwork / RTO', icon: <FileText className="w-4 h-4" /> },
    { value: 'insurance', label: 'Insurance', icon: <Shield className="w-4 h-4" /> },
    { value: 'challan', label: 'Challan / Fine', icon: <AlertCircle className="w-4 h-4" /> },
    { value: 'other', label: 'Other', icon: <CircleDollarSign className="w-4 h-4" /> },
];

export default function AdminPanel() {
    const [range, setRange] = useState('all');
    const [overview, setOverview] = useState(null);
    const [driverStats, setDriverStats] = useState([]);
    const [records, setRecords] = useState([]);
    const [miscExpenses, setMiscExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [drivers, setDrivers] = useState([]);

    // Settlement modal
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleDriver, setSettleDriver] = useState(null);
    const [settleAmount, setSettleAmount] = useState('');
    const [settleCashierName, setSettleCashierName] = useState(() => localStorage.getItem('maafleet_cashier_name') || '');
    const [settling, setSettling] = useState(false);
    const [settleSuccess, setSettleSuccess] = useState(null); // { driverName, amount, newBalance }
    const [batchSettling, setBatchSettling] = useState(false);
    const [copied, setCopied] = useState(false);

    const [settleMethod, setSettleMethod] = useState('cash');

    // Admin tabs
    const [activeTab, setActiveTab] = useState('overview');

    // Cashier balance & deposits
    const [cashierBalance, setCashierBalance] = useState(null);
    const [cashierDeposits, setCashierDeposits] = useState([]);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositMethod, setDepositMethod] = useState('cash');
    const [depositing, setDepositing] = useState(false);

    // Monthly receivables
    const [monthlyData, setMonthlyData] = useState(null);

    // Misc expense form
    const [showMiscForm, setShowMiscForm] = useState(false);
    const [miscForm, setMiscForm] = useState({ category: 'denting_painting', amount: '', description: '', carNumber: '', driverId: '', date: new Date().toISOString().split('T')[0] });
    const [miscSubmitting, setMiscSubmitting] = useState(false);

    // Feature 4: Edit record modal
    const [editRecord, setEditRecord] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editSaving, setEditSaving] = useState(false);

    // Feature 5: Driver report modal
    const [driverReport, setDriverReport] = useState(null);
    const [driverReportLoading, setDriverReportLoading] = useState(false);

    // Feature 6: Date-wise daily report
    const [dailyReportDate, setDailyReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [dailyReport, setDailyReport] = useState(null);
    const [dailyReportLoading, setDailyReportLoading] = useState(false);

    useEffect(() => { fetchAll(); }, [range]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [ov, ds, rec, misc, drv, settl, cb, cd, mr] = await Promise.all([
                axios.get(`${API_URL}/analytics/overview?range=${range}`),
                axios.get(`${API_URL}/analytics/drivers?range=${range}`),
                axios.get(`${API_URL}/records?range=${range}`),
                axios.get(`${API_URL}/misc-expenses?range=${range}`),
                axios.get(`${API_URL}/drivers`),
                axios.get(`${API_URL}/settlements?range=${range}`),
                axios.get(`${API_URL}/cashier-balance`),
                axios.get(`${API_URL}/cashier-deposits?range=${range}`),
                axios.get(`${API_URL}/monthly-receivables`),
            ]);
            setOverview(ov.data);
            setDriverStats(ds.data);
            setRecords(rec.data);
            setMiscExpenses(misc.data);
            setDrivers(drv.data);
            setSettlements(settl.data);
            setCashierBalance(cb.data);
            setCashierDeposits(cd.data);
            setMonthlyData(mr.data);
        } catch (err) { console.error('Fetch failed', err); }
        finally { setLoading(false); }
    };

    const handleSettle = async (e) => {
        e.preventDefault();
        setSettling(true);
        try {
            const amt = settleDriver.currentBalance > 0 ? -Math.abs(parseFloat(settleAmount)) : Math.abs(parseFloat(settleAmount));
            await axios.post(`${API_URL}/settlements`, {
                driverId: settleDriver.id,
                amount: amt,
                method: settleMethod,
                cashierName: settleCashierName
            });
            localStorage.setItem('maafleet_cashier_name', settleCashierName);
            const newBalance = settleDriver.currentBalance + amt;
            setSettleSuccess({
                driverName: settleDriver.name,
                amount: Math.abs(parseFloat(settleAmount)),
                action: settleDriver.currentBalance > 0 ? 'Fleet paid' : 'Driver paid',
                newBalance
            });
            setShowSettleModal(false);
            setSettleAmount('');
            fetchAll();
        } catch (err) { alert("Failed to settle"); }
        finally { setSettling(false); }
    };

    const handleBatchSettleAll = async () => {
        const unsettled = drivers.filter(d => d.currentBalance !== 0);
        if (unsettled.length === 0) return;
        if (!window.confirm(`Settle all ${unsettled.length} drivers? This will create a settlement record for each.`)) return;
        const cashier = settleCashierName || localStorage.getItem('maafleet_cashier_name') || 'Admin';
        setBatchSettling(true);
        try {
            await Promise.all(unsettled.map(d => {
                const amt = d.currentBalance > 0 ? -Math.abs(d.currentBalance) : Math.abs(d.currentBalance);
                return axios.post(`${API_URL}/settlements`, {
                    driverId: d.id, amount: amt, cashierName: cashier
                });
            }));
            fetchAll();
        } catch (err) { alert("Some settlements failed"); }
        finally { setBatchSettling(false); }
    };

    const getSettlementWhatsApp = (driverName, amount, action, newBalance) => {
        const balLabel = newBalance > 0 ? 'Fleet Owes Driver' : newBalance < 0 ? 'Driver Owes Fleet' : 'Settled';
        return encodeURIComponent(`*💰 MAA FLEET - SETTLEMENT*
━━━━━━━━━━━━━━━━
👤 *Driver:* ${driverName}
📅 *Date:* ${new Date().toLocaleDateString('en-IN')}
💸 *${action}:* ₹${amount.toFixed(0)}
💳 *New Balance:* ₹${Math.abs(newBalance).toFixed(0)} (${balLabel})
━━━━━━━━━━━━━━━━`);
    };

    const generateAdminSummaryMessage = () => {
        if (!overview || driverStats.length === 0) return '';
        const totals = overview?.totals || {};
        const rangeLabel = TIME_RANGES.find(t => t.key === range)?.label || range;
        return encodeURIComponent(`*📊 MAA FLEET - ${rangeLabel.toUpperCase()} SUMMARY*
━━━━━━━━━━━━━━━━━━━
📅 *Period:* ${rangeLabel} | Records: ${overview.recordCount}

*💰 OVERVIEW*
▹ Gross Revenue: ₹${(totals.totalEarnings || 0).toFixed(0)}
▹ Net Profit: ₹${(overview.overallProfit || 0).toFixed(0)}
▹ Cash Collected: ₹${(totals.totalCash || 0).toFixed(0)}
▹ Total Expenses: ₹${(overview.overallExpenses || 0).toFixed(0)}

*👤 PER DRIVER*
${driverStats.map(d => `▹ ${d.name}: Earned ₹${d.totalEarnings.toFixed(0)} | Profit ₹${d.profit.toFixed(0)} | ${d.trips} trips`).join('\n')}

*💳 PENDING BALANCES*
${drivers.filter(d => d.currentBalance !== 0).map(d => {
            const label = d.currentBalance > 0 ? 'Fleet Owes' : 'Driver Owes';
            return `▹ ${d.name}: ₹${Math.abs(d.currentBalance).toFixed(0)} (${label})`;
        }).join('\n') || 'All settled ✓'}
━━━━━━━━━━━━━━━━━━━`);
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setDepositing(true);
        try {
            const cashier = settleCashierName || localStorage.getItem('maafleet_cashier_name') || 'Cashier';
            await axios.post(`${API_URL}/cashier-deposits`, {
                amount: parseFloat(depositAmount),
                method: depositMethod,
                cashierName: cashier,
            });
            setShowDepositModal(false);
            setDepositAmount('');
            fetchAll();
        } catch (err) { alert("Failed to record deposit"); }
        finally { setDepositing(false); }
    };

    const handleCopyAdminSummary = async () => {
        try {
            await navigator.clipboard.writeText(decodeURIComponent(generateAdminSummaryMessage()));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { alert('Failed to copy'); }
    };

    const handleMiscSubmit = async (e) => {
        e.preventDefault();
        setMiscSubmitting(true);
        try {
            await axios.post(`${API_URL}/misc-expenses`, {
                ...miscForm,
                driverId: miscForm.driverId || null,
                carNumber: miscForm.carNumber || null,
            });
            setMiscForm({ category: 'denting_painting', amount: '', description: '', carNumber: '', driverId: '', date: new Date().toISOString().split('T')[0] });
            setShowMiscForm(false);
            fetchAll();
        } catch (err) { alert("Failed to save expense"); }
        finally { setMiscSubmitting(false); }
    };

    const handleDeleteRecord = async (id) => {
        if (!window.confirm("Are you sure you want to delete this record? This action cannot be undone and will recalculate balances.")) return;
        try {
            await axios.delete(`${API_URL}/records/${id}`);
            fetchAll();
        } catch (err) {
            alert("Failed to delete record: " + (err.response?.data?.error || err.message));
        }
    };

    // Feature 4: Edit record
    const handleEditRecord = async (id) => {
        setEditLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/records/${id}`);
            setEditRecord(data);
            setEditForm({
                carNumber: data.carNumber || '',
                date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
                startKm: data.startKm || '',
                endKm: data.endKm || '',
                totalKm: data.totalKm || '',
                yatriTrips: data.yatriTrips || '',
                uber: data.uber || '',
                inDrive: data.inDrive || '',
                yatri: data.yatri || '',
                rapido: data.rapido || '',
                offline: data.offline || '',
                uberComm: data.uberComm || '',
                yatriComm: data.yatriComm || '',
                uberCash: data.uberCash || '',
                inDriveCash: data.inDriveCash || '',
                yatriCash: data.yatriCash || '',
                rapidoCash: data.rapidoCash || '',
                offlineCash: data.offlineCash || '',
                fuel: data.fuel || '',
                fuelDetails: data.fuelDetails || [],
                otherExpenses: data.otherExpenses || '',
                onlinePayments: data.onlinePayments || '',
                cashToCashier: data.cashToCashier || '',
            });
        } catch (err) {
            alert("Failed to load record");
        } finally { setEditLoading(false); }
    };

    const handleSaveEdit = async () => {
        if (!editRecord) return;
        setEditSaving(true);
        try {
            await axios.put(`${API_URL}/records/${editRecord.id}`, {
                ...editForm,
                totalKm: (parseFloat(editForm.endKm) || 0) > (parseFloat(editForm.startKm) || 0)
                    ? (parseFloat(editForm.endKm) || 0) - (parseFloat(editForm.startKm) || 0)
                    : 0,
            });
            setEditRecord(null);
            fetchAll();
        } catch (err) {
            alert("Failed to save: " + (err.response?.data?.error || err.message));
        } finally { setEditSaving(false); }
    };

    // Feature 5: Driver report
    const handleOpenDriverReport = async (driverId) => {
        setDriverReportLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/drivers/${driverId}/report`);
            setDriverReport(data);
        } catch (err) {
            alert("Failed to load driver report");
        } finally { setDriverReportLoading(false); }
    };

    // Feature 6: Date-wise daily report
    const fetchDailyReport = async (dateStr) => {
        setDailyReportLoading(true);
        try {
            const { data } = await axios.get(`${API_URL}/daily-summary?date=${dateStr}`);
            setDailyReport(data);
        } catch (err) {
            alert("Failed to load daily report");
        } finally { setDailyReportLoading(false); }
    };

    const shiftDailyReportDate = (days) => {
        const d = new Date(dailyReportDate);
        d.setDate(d.getDate() + days);
        const newDate = d.toISOString().split('T')[0];
        setDailyReportDate(newDate);
        fetchDailyReport(newDate);
    };


    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

    if (loading && !overview) return (
        <div className="flex flex-col justify-center items-center h-[50vh] gap-5">
            <div className="w-14 h-14 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p className="font-semibold text-brand-600 text-sm animate-pulse">Loading analytics...</p>
        </div>
    );

    const totals = overview?.totals || {};

    return (
        <div className="space-y-8 pb-16 animate-fadeUp">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
                <div>
                    <h1 className="text-lg sm:text-2xl font-extrabold text-brand-950 flex items-center gap-2 sm:gap-3">
                        <span className="p-2 sm:p-3 bg-gradient-to-br from-brand-100 to-pink-100 rounded-xl sm:rounded-2xl">
                            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" strokeWidth={2.5} />
                        </span>
                        Executive Dashboard
                    </h1>
                    <p className="text-slate-400 mt-1.5 sm:mt-2 text-xs sm:text-sm">Financial overview, driver profitability, and fleet expenses.</p>
                </div>
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white shadow-sm text-xs sm:text-sm font-bold text-brand-600">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {overview?.recordCount || 0} Records
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {TIME_RANGES.map(t => (
                    <button key={t.key} onClick={() => setRange(t.key)}
                        className={clsx("px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 border-2 active:scale-95",
                            range === t.key
                                ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20"
                                : "bg-white text-slate-400 border-gray-200 hover:border-brand-300 hover:text-brand-600"
                        )}>
                        {t.label}
                    </button>
                ))}
                <div className="flex gap-1.5 ml-auto">
                    <button onClick={() => window.open(`https://wa.me/?text=${generateAdminSummaryMessage()}`, '_blank')}
                        className="px-3 py-1.5 sm:py-2 rounded-full text-xs font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-95 flex items-center gap-1.5"
                        title="Share summary on WhatsApp">
                        <Send className="w-3.5 h-3.5" /> Share
                    </button>
                    <button onClick={handleCopyAdminSummary}
                        className="px-3 py-1.5 sm:py-2 rounded-full text-xs font-bold bg-brand-100 text-brand-700 hover:bg-brand-200 transition-all active:scale-95 flex items-center gap-1.5"
                        title="Copy summary">
                        <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-white/60 backdrop-blur-xl rounded-full border border-white/80 shadow-sm w-fit">
                {[
                    { key: 'overview', label: 'Overview' },
                    { key: 'drivers', label: 'Drivers' },
                    { key: 'cashier', label: 'Cashier' },
                    { key: 'expenses', label: 'Expenses' },
                    { key: 'ledger', label: 'Ledger' },
                    { key: 'daily', label: 'Daily Report' },
                ].map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        className={clsx("px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-all duration-300",
                            activeTab === t.key
                                ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
                                : "text-slate-400 hover:text-brand-600")}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* KPI Cards — Always visible */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <KpiCard title="Gross Revenue" value={totals.totalEarnings} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
                <KpiCard title="Net Profit" value={overview?.overallProfit} icon={<ArrowUpRight className="w-5 h-5" />} color="brand" highlight />
                <KpiCard title="Cash Collected" value={totals.totalCash} icon={<Wallet className="w-5 h-5" />} color="sky" />
                <KpiCard title="All Expenses" value={overview?.overallExpenses} icon={<Fuel className="w-5 h-5" />} color="rose" />
                <KpiCard title="Pending Salary" value={totals.pendingSalary} icon={<AlertCircle className="w-5 h-5" />} color="amber" isWarning={(totals.pendingSalary || 0) > 0} />
            </div>

            {/* Monthly Receivables Card */}
            {activeTab === 'overview' && monthlyData && monthlyData.totalReceivable > 0 && (
                <div className="glass-panel p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-extrabold text-brand-950 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-amber-500" /> Monthly Customer Receivables
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">Offline monthly bookings (₹730/₹365) — pending collection</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-amber-600 tabular-nums">{fmt(monthlyData.totalReceivable)}</p>
                            <p className="text-[10px] font-bold text-slate-400">{monthlyData.recordCount} bookings</p>
                        </div>
                    </div>
                    <div className="flex gap-3 mb-3">
                        {Object.entries(monthlyData.byAmount).map(([amt, data]) => (
                            <div key={amt} className="surface-card p-3 flex-1 text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">₹{amt}/month</p>
                                <p className="text-base font-black text-brand-950 tabular-nums">{fmt(data.total)}</p>
                                <p className="text-[10px] text-slate-400">{data.count} trips</p>
                            </div>
                        ))}
                    </div>
                    {monthlyData.recentRecords.length > 0 && (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {monthlyData.recentRecords.slice(0, 8).map(r => (
                                <div key={r.id} className="flex justify-between items-center text-xs py-1 border-b border-brand-50 last:border-0">
                                    <span className="text-slate-400">{format(new Date(r.date), 'MMM dd')} — <span className="text-brand-950 font-bold capitalize">{r.driverName}</span></span>
                                    <span className="font-black text-amber-600 tabular-nums">₹{r.amount}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Driver Analytics Table */}
            {(activeTab === 'overview' || activeTab === 'drivers') && <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-brand-100">
                    <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-400" /> Driver-wise Breakdown
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Profitability analysis per driver for the selected period.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                            <tr className="bg-brand-50/50 border-b border-brand-100 text-[11px] text-brand-400 font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Driver</th>
                                <th className="px-4 py-4 text-right">Gross</th>
                                <th className="px-4 py-4 text-right">Net</th>
                                <th className="px-4 py-4 text-right">Salary</th>
                                <th className="px-4 py-4 text-right">Pending</th>
                                <th className="px-4 py-4 text-right">Misc Exp</th>
                                <th className="px-4 py-4 text-right">Profit</th>
                                <th className="px-4 py-4 text-center">Trips</th>
                                <th className="px-4 py-4 text-right">Km</th>
                                <th className="px-4 py-4 text-right text-emerald-600">Cash Given</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-50 text-sm">
                            {driverStats.map(d => (
                                <tr key={d.id} className="hover:bg-brand-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-brand-950 capitalize">
                                        <button onClick={() => handleOpenDriverReport(d.id)} className="hover:text-brand-600 underline decoration-brand-200 underline-offset-2 transition-colors flex items-center gap-1.5">
                                            {d.name} <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </td>
                                    <td className="px-4 py-4 text-right tabular-nums text-slate-600">{fmt(d.totalEarnings)}</td>
                                    <td className="px-4 py-4 text-right tabular-nums text-slate-600">{fmt(d.netEarnings)}</td>
                                    <td className="px-4 py-4 text-right tabular-nums text-slate-600">{fmt(d.driverSalary)}</td>
                                    <td className="px-4 py-4 text-right tabular-nums">
                                        <span className={clsx(d.pendingSalary > 0 ? "text-amber-600 font-bold" : "text-slate-400")}>{fmt(d.pendingSalary)}</span>
                                    </td>
                                    <td className="px-4 py-4 text-right tabular-nums text-rose-500">{fmt(d.miscExpenses)}</td>
                                    <td className="px-4 py-4 text-right tabular-nums">
                                        <span className={clsx("font-black text-base", d.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                            {fmt(d.profit)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold">{d.trips}</span>
                                    </td>
                                    <td className="px-4 py-4 text-right tabular-nums text-slate-500">
                                        {d.totalKm || 0}
                                    </td>
                                    <td className="px-4 py-4 text-right tabular-nums font-black text-emerald-600">
                                        {fmt(d.cashToCashier || 0)}
                                    </td>
                                </tr>
                            ))}
                            {driverStats.length === 0 && (
                                <tr><td colSpan="10" className="px-6 py-12 text-center text-slate-400">No driver data for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Feature 7: Driver Comparison Charts */}
            {activeTab === 'overview' && driverStats.length > 0 && (() => {
                const maxEarnings = Math.max(...driverStats.map(d => d.totalEarnings || 0), 1);
                const maxProfit = Math.max(...driverStats.map(d => Math.abs(d.profit || 0)), 1);
                const maxKm = Math.max(...driverStats.map(d => d.totalKm || 0), 1);
                const maxEarnPerKm = Math.max(...driverStats.map(d => (d.totalKm > 0 ? d.totalEarnings / d.totalKm : 0)), 1);
                const maxFuelPerKm = Math.max(...driverStats.map(d => (d.totalKm > 0 ? (d.totalFuel || 0) / d.totalKm : 0)), 1) || 1;
                const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

                return (
                    <div className="glass-panel overflow-hidden">
                        <div className="p-6 border-b border-brand-100">
                            <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-brand-400" /> Driver Performance Comparison
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Visual comparison across all key metrics.</p>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Earnings */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Earnings</h3>
                                {driverStats.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-brand-950 w-16 truncate capitalize">{d.name}</span>
                                        <div className="flex-1 h-7 bg-brand-50 rounded-lg overflow-hidden relative">
                                            <div className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                                                style={{ width: `${Math.max((d.totalEarnings / maxEarnings) * 100, 2)}%`, background: colors[i % colors.length] }}>
                                                <span className="text-[10px] font-black text-white drop-shadow">{fmt(d.totalEarnings)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Profit */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profit (Fleet)</h3>
                                {driverStats.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-brand-950 w-16 truncate capitalize">{d.name}</span>
                                        <div className="flex-1 h-7 bg-brand-50 rounded-lg overflow-hidden relative">
                                            <div className={clsx("h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2")}
                                                style={{ width: `${Math.max((Math.abs(d.profit) / maxProfit) * 100, 2)}%`, background: d.profit >= 0 ? '#10b981' : '#ef4444' }}>
                                                <span className="text-[10px] font-black text-white drop-shadow">{fmt(d.profit)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ₹/KM */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Earnings per KM</h3>
                                {driverStats.map((d, i) => {
                                    const perKm = d.totalKm > 0 ? d.totalEarnings / d.totalKm : 0;
                                    return (
                                        <div key={d.id} className="flex items-center gap-3">
                                            <span className="text-xs font-bold text-brand-950 w-16 truncate capitalize">{d.name}</span>
                                            <div className="flex-1 h-7 bg-brand-50 rounded-lg overflow-hidden relative">
                                                <div className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                                                    style={{ width: `${Math.max((perKm / maxEarnPerKm) * 100, 2)}%`, background: colors[(i + 2) % colors.length] }}>
                                                    <span className="text-[10px] font-black text-white drop-shadow">₹{perKm.toFixed(1)}/km</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total KM Driven */}
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Distance</h3>
                                {driverStats.map((d, i) => (
                                    <div key={d.id} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-brand-950 w-16 truncate capitalize">{d.name}</span>
                                        <div className="flex-1 h-7 bg-brand-50 rounded-lg overflow-hidden relative">
                                            <div className="h-full rounded-lg transition-all duration-1000 ease-out flex items-center justify-end pr-2"
                                                style={{ width: `${Math.max(((d.totalKm || 0) / maxKm) * 100, 2)}%`, background: colors[(i + 3) % colors.length] }}>
                                                <span className="text-[10px] font-black text-white drop-shadow">{d.totalKm || 0} km</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Leaderboard strip */}
                        <div className="px-6 pb-6">
                            <div className="bg-gradient-to-r from-brand-600 to-pink-500 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {(() => {
                                    const best = (fn) => driverStats.reduce((a, b) => fn(a) > fn(b) ? a : b, driverStats[0]);
                                    const topEarner = best(d => d.totalEarnings);
                                    const topProfit = best(d => d.profit);
                                    const topEfficiency = best(d => d.totalKm > 0 ? d.totalEarnings / d.totalKm : 0);
                                    const mostTrips = best(d => d.trips);
                                    return [
                                        { label: '🏆 Top Earner', name: topEarner?.name },
                                        { label: '💎 Most Profitable', name: topProfit?.name },
                                        { label: '⚡ Most Efficient', name: topEfficiency?.name },
                                        { label: '🚗 Most Trips', name: mostTrips?.name },
                                    ].map(item => (
                                        <div key={item.label} className="text-center">
                                            <p className="text-[10px] font-bold text-white/70">{item.label}</p>
                                            <p className="text-sm font-black text-white capitalize mt-0.5">{item.name}</p>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Cashier Cash Balance Card */}
            {activeTab === 'cashier' && cashierBalance && (
                <div className="glass-panel p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                        <div>
                            <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-brand-600" /> Cashier Cash Holding
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Total cash currently held by the cashier (not yet deposited to owner).</p>
                        </div>
                        <button onClick={() => { setDepositAmount(cashierBalance.cashierBalance > 0 ? cashierBalance.cashierBalance.toFixed(0) : ''); setShowDepositModal(true); }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-95 transition-all">
                            <ArrowUpRight className="w-4 h-4" /> Deposit to Owner
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="surface-card p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">From Shifts</p>
                            <p className="text-base font-black text-brand-700 tabular-nums">{fmt(cashierBalance.cashFromRecords)}</p>
                        </div>
                        <div className="surface-card p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cash Settlements</p>
                            <p className="text-base font-black text-emerald-600 tabular-nums">{fmt(cashierBalance.cashFromSettlements)}</p>
                        </div>
                        <div className="surface-card p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Cash Paid Out</p>
                            <p className="text-base font-black text-rose-600 tabular-nums">−{fmt(cashierBalance.cashPaidOut)}</p>
                        </div>
                        <div className="surface-card p-3 text-center">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Deposited</p>
                            <p className="text-base font-black text-rose-600 tabular-nums">−{fmt(cashierBalance.totalDeposited)}</p>
                        </div>
                        <div className={clsx("surface-card p-3 text-center !border-brand-300 ring-2 ring-brand-100")}>
                            <p className="text-[10px] font-bold text-brand-400 uppercase mb-1">Cash in Hand</p>
                            <p className="text-2xl font-black text-brand-700 tabular-nums">{fmt(cashierBalance.cashierBalance)}</p>
                        </div>
                    </div>
                    {/* Recent Deposits */}
                    {cashierDeposits.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Deposits to Owner</h3>
                            {cashierDeposits.slice(0, 5).map(d => (
                                <div key={d.id} className="flex justify-between items-center text-sm py-2 border-b border-brand-50 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                                            d.method === 'upi' ? "bg-brand-100 text-brand-700" : "bg-emerald-100 text-emerald-700")}>{d.method}</span>
                                        <span className="text-slate-400 text-xs">{format(new Date(d.date), 'MMM dd')}</span>
                                    </div>
                                    <span className="font-black text-brand-950 tabular-nums">{fmt(d.amount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Central Cashier / Ledger Section */}
            {activeTab === 'cashier' && <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-brand-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-emerald-500" /> Central Cashier Ledger
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Positive = Fleet owes Driver. Negative = Driver owes Fleet.</p>
                    </div>
                    {drivers.some(d => d.currentBalance !== 0) && (
                        <button onClick={handleBatchSettleAll} disabled={batchSettling}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-md shadow-brand-500/20 hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-50">
                            {batchSettling ? 'Settling...' : <><CheckCircle2 className="w-4 h-4" /> Settle All</>}
                        </button>
                    )}
                </div>

                {/* Active Balances */}
                <div className="p-6 border-b border-brand-50 bg-brand-50/20">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Current Driver Balances</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {drivers.map(d => (
                            <div key={d.id} className="surface-card p-4 flex justify-between items-center !rounded-2xl">
                                <div>
                                    <h4 className="font-bold text-brand-950 capitalize">{d.name}</h4>
                                    <div className="mt-1">
                                        <span className={clsx("font-black text-lg", d.currentBalance > 0 ? "text-rose-600" : d.currentBalance < 0 ? "text-emerald-600" : "text-slate-400")}>
                                            {fmt(Math.abs(d.currentBalance))}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-400 ml-1.5">
                                            {d.currentBalance > 0 ? "Fleet owes" : d.currentBalance < 0 ? "Driver owes" : "Settled"}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => { setSettleDriver(d); setSettleAmount(Math.abs(d.currentBalance).toFixed(0)); setShowSettleModal(true); }}
                                    disabled={d.currentBalance === 0}
                                    className="px-4 py-2 bg-gradient-to-r from-brand-600 to-pink-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Settle
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Settlement History */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-brand-50/30 border-b border-brand-100 text-[11px] text-brand-400 font-bold uppercase tracking-wider">
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Driver</th>
                                <th className="px-6 py-3">Action</th>
                                <th className="px-6 py-3">Cashier</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-50 text-sm">
                            {settlements.map(s => (
                                <tr key={s.id} className="hover:bg-brand-50/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-400 font-medium">{format(new Date(s.date), 'MMM dd, yyyy')}</td>
                                    <td className="px-6 py-4 font-bold text-brand-950 capitalize">{s.driver?.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            {s.amount > 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded bg-emerald-100 text-emerald-700 font-bold text-xs border border-emerald-200">
                                                    Received
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200">
                                                    Paid
                                                </span>
                                            )}
                                            <span className={clsx("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                                (s.method || 'cash') === 'upi' ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500")}>
                                                {s.method || 'cash'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-xs font-bold">{s.cashierName || 'Not recorded'}</td>
                                    <td className="px-6 py-4 text-right font-black text-base tabular-nums">
                                        <span className={s.amount > 0 ? "text-emerald-600" : "text-rose-600"}>
                                            {fmt(Math.abs(s.amount))}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {settlements.length === 0 && (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">No settlements in this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Miscellaneous Expenses Section */}
            {activeTab === 'expenses' && <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-brand-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-rose-400" /> Miscellaneous Expenses
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">Fleet expenses like denting, painting, paperwork, insurance, challans.</p>
                    </div>
                    <button onClick={() => setShowMiscForm(!showMiscForm)}
                        className={clsx("flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all active:scale-95",
                            showMiscForm ? "bg-slate-100 text-slate-600" : "bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-md shadow-brand-500/20 hover:-translate-y-0.5")}>
                        {showMiscForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add Expense</>}
                    </button>
                </div>

                {/* Add Expense Form */}
                {showMiscForm && (
                    <form onSubmit={handleMiscSubmit} className="p-6 bg-brand-50/50 border-b border-brand-100 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Category</label>
                                <select value={miscForm.category} onChange={e => setMiscForm({ ...miscForm, category: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm appearance-none" required>
                                    {MISC_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Amount (₹)</label>
                                <input type="number" step="0.01" placeholder="0.00" required
                                    value={miscForm.amount} onChange={e => setMiscForm({ ...miscForm, amount: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Car (optional)</label>
                                <select value={miscForm.carNumber} onChange={e => setMiscForm({ ...miscForm, carNumber: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm appearance-none uppercase">
                                    <option value="">Any / Fleet</option>
                                    {PREDEFINED_CARS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Driver (optional)</label>
                                <select value={miscForm.driverId} onChange={e => setMiscForm({ ...miscForm, driverId: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm appearance-none capitalize">
                                    <option value="">Fleet-wide</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Description</label>
                                <input type="text" placeholder="e.g. Front bumper repaint"
                                    value={miscForm.description} onChange={e => setMiscForm({ ...miscForm, description: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Date</label>
                                <input type="date" value={miscForm.date} onChange={e => setMiscForm({ ...miscForm, date: e.target.value })}
                                    className="clean-input w-full rounded-xl px-4 py-3 text-sm" />
                            </div>
                        </div>
                        <button type="submit" disabled={miscSubmitting || !miscForm.amount}
                            className={clsx("px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95",
                                miscSubmitting || !miscForm.amount ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-brand-600 text-white shadow-md hover:-translate-y-0.5")}>
                            {miscSubmitting ? 'Saving...' : 'Save Expense'}
                        </button>
                    </form>
                )}

                {/* Misc Expense Category Summary */}
                {overview?.miscByCategory && Object.keys(overview.miscByCategory).length > 0 && (
                    <div className="p-6 border-b border-brand-100 flex flex-wrap gap-3">
                        {Object.entries(overview.miscByCategory).map(([cat, amt]) => {
                            const catInfo = MISC_CATEGORIES.find(c => c.value === cat);
                            return (
                                <div key={cat} className="surface-card px-4 py-3 flex items-center gap-3 !rounded-2xl">
                                    <div className="p-2 bg-rose-100 rounded-xl text-rose-600">{catInfo?.icon || <CircleDollarSign className="w-4 h-4" />}</div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase">{catInfo?.label || cat}</p>
                                        <p className="text-base font-black text-rose-600">{fmt(amt)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Misc Expense List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-brand-50/30 border-b border-brand-100 text-[11px] text-brand-400 font-bold uppercase tracking-wider">
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Description</th>
                                <th className="px-6 py-3">Car / Driver</th>
                                <th className="px-6 py-3 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-50 text-sm">
                            {miscExpenses.map(e => {
                                const catInfo = MISC_CATEGORIES.find(c => c.value === e.category);
                                return (
                                    <tr key={e.id} className="hover:bg-brand-50/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-400 font-medium">{format(new Date(e.date), 'MMM dd, yyyy')}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                {catInfo?.icon} {catInfo?.label || e.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">{e.description || '—'}</td>
                                        <td className="px-6 py-4 text-slate-400 text-xs">
                                            {e.carNumber && <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded uppercase font-bold mr-1">{e.carNumber}</span>}
                                            {e.driver?.name && <span className="capitalize">{e.driver.name}</span>}
                                            {!e.carNumber && !e.driver?.name && '—'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-rose-600 text-base">{fmt(e.amount)}</td>
                                    </tr>
                                );
                            })}
                            {miscExpenses.length === 0 && (
                                <tr><td colSpan="5" className="px-6 py-12 text-center text-slate-400">No misc expenses logged for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Transaction Ledger */}
            {activeTab === 'ledger' && <div className="glass-panel overflow-hidden">
                <div className="p-6 border-b border-brand-100">
                    <h2 className="text-lg font-extrabold text-brand-950">Daily Transaction Ledger</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[750px]">
                        <thead>
                            <tr className="bg-brand-50/50 border-b border-brand-100 text-[11px] text-brand-400 font-bold uppercase tracking-wider">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Driver</th>
                                <th className="px-6 py-4">Car</th>
                                <th className="px-6 py-4 text-right">Gross</th>
                                <th className="px-6 py-4 text-center">Salary Log</th>
                                <th className="px-6 py-4 text-right">Physical Cash Out</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-50 text-sm">
                            {records.map(r => (
                                <tr key={r.id} className="hover:bg-brand-50/50 transition-colors group">
                                    <td className="px-6 py-4 text-slate-400 font-medium">{format(new Date(r.date), 'MMM dd, yyyy')}</td>
                                    <td className="px-6 py-4 font-bold text-brand-950 capitalize group-hover:text-brand-600 transition-colors">{r.driver?.name}</td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-black text-brand-600 bg-brand-100 border border-brand-200 px-3 py-1 rounded-lg uppercase">{r.carNumber || 'N/A'}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-700 tabular-nums">{fmt(r.totalEarnings)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-brand-50 text-brand-700 border border-brand-200">
                                            {fmt(Math.abs(r.pendingSalary))}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-black text-brand-950 text-base tabular-nums">{fmt(r.cashInHand)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => handleEditRecord(r.id)} className="p-2 text-slate-300 hover:text-brand-600 transition hover:bg-brand-50 rounded-xl" title="Edit Record">
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDeleteRecord(r.id)} className="p-2 text-slate-300 hover:text-rose-600 transition hover:bg-rose-50 rounded-xl" title="Delete Record">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr><td colSpan="7" className="px-6 py-16 text-center text-slate-400">No records for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Modal for Settle */}
            {showSettleModal && settleDriver && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <form onSubmit={handleSettle} className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-scaleIn">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-3">
                                <Wallet className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-extrabold text-brand-950">Settle Balance</h2>
                            <p className="text-sm font-semibold mt-1">
                                {settleDriver.currentBalance > 0 ? (
                                    <span className="text-rose-600">You must PAY {settleDriver.name}</span>
                                ) : (
                                    <span className="text-emerald-600">{settleDriver.name} owes the FLEET</span>
                                )}
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Amount (₹)</label>
                                <input type="number" step="0.01" required value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                                    className="clean-input w-full rounded-2xl px-5 py-3.5 font-black text-lg text-center" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Payment Method</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setSettleMethod('cash')}
                                        className={clsx("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2",
                                            settleMethod === 'cash' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-400 border-gray-200")}>
                                        💵 Cash
                                    </button>
                                    <button type="button" onClick={() => setSettleMethod('upi')}
                                        className={clsx("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2",
                                            settleMethod === 'upi' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-400 border-gray-200")}>
                                        📱 UPI
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 text-center">
                                    {settleMethod === 'cash' ? 'Cash goes to Cashier' : 'UPI goes directly to Owner'}
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">{settleMethod === 'cash' ? 'Cashier Name' : 'Received By'}</label>
                                <input type="text" required placeholder={settleMethod === 'cash' ? 'Cashier name' : 'Owner name'} value={settleCashierName} onChange={e => setSettleCashierName(e.target.value)}
                                    className="clean-input w-full rounded-2xl px-5 py-3.5 text-center font-bold" />
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                            <button type="submit" disabled={settling} className="flex-1 py-3.5 rounded-2xl font-bold bg-brand-600 text-white shadow-xl shadow-brand-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50">
                                Confirm
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Settlement Success Modal */}
            {settleSuccess && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-scaleIn">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-7 h-7" />
                            </div>
                            <h2 className="text-xl font-extrabold text-brand-950">Settlement Done!</h2>
                            <p className="text-sm text-slate-500 mt-1">
                                {settleSuccess.action} <span className="font-bold capitalize">{settleSuccess.driverName}</span> ₹{settleSuccess.amount.toFixed(0)}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                New Balance: ₹{Math.abs(settleSuccess.newBalance).toFixed(0)}
                                {settleSuccess.newBalance !== 0 && ` (${settleSuccess.newBalance > 0 ? 'Fleet Owes' : 'Driver Owes'})`}
                                {settleSuccess.newBalance === 0 && ' (Fully Settled)'}
                            </p>
                        </div>
                        <div className="space-y-3">
                            <button type="button"
                                onClick={() => window.open(`https://wa.me/?text=${getSettlementWhatsApp(settleSuccess.driverName, settleSuccess.amount, settleSuccess.action, settleSuccess.newBalance)}`, '_blank')}
                                className="w-full py-3.5 rounded-2xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 flex justify-center items-center gap-2">
                                <Send className="w-4 h-4" /> Share on WhatsApp
                            </button>
                            <button type="button" onClick={() => setSettleSuccess(null)}
                                className="w-full py-2.5 rounded-2xl font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors text-sm">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Feature 6: Date-wise Daily Report Tab */}
            {activeTab === 'daily' && (
                <div className="glass-panel overflow-hidden">
                    <div className="p-6 border-b border-brand-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-extrabold text-brand-950 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-brand-400" /> Date-wise Daily Report
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">Pick a date to see all drivers' data for that day.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => shiftDailyReportDate(-1)} className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 transition active:scale-90">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <input type="date" value={dailyReportDate} onChange={e => { setDailyReportDate(e.target.value); fetchDailyReport(e.target.value); }}
                                className="clean-input rounded-xl px-4 py-2 text-sm font-bold" />
                            <button onClick={() => shiftDailyReportDate(1)} className="p-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-600 transition active:scale-90">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <button onClick={() => fetchDailyReport(dailyReportDate)} className="px-4 py-2 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 transition active:scale-95">
                                Load
                            </button>
                        </div>
                    </div>

                    {dailyReportLoading && (
                        <div className="flex justify-center py-12">
                            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                        </div>
                    )}

                    {dailyReport && !dailyReportLoading && (
                        <div className="p-6 space-y-6">
                            {dailyReport.recordCount === 0 ? (
                                <p className="text-center text-slate-400 py-8">No records for {dailyReport.date}.</p>
                            ) : (
                                <>
                                    {/* Daily Totals */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Gross</p>
                                            <p className="text-lg font-black text-brand-950 tabular-nums">{fmt(dailyReport.totalEarnings)}</p>
                                        </div>
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Net</p>
                                            <p className="text-lg font-black text-brand-700 tabular-nums">{fmt(dailyReport.totalNet)}</p>
                                        </div>
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Cash Collected</p>
                                            <p className="text-lg font-black text-emerald-600 tabular-nums">{fmt(dailyReport.totalCashCollected)}</p>
                                        </div>
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Salaries</p>
                                            <p className="text-lg font-black text-amber-600 tabular-nums">{fmt(dailyReport.totalSalary)}</p>
                                        </div>
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Fuel</p>
                                            <p className="text-lg font-black text-rose-600 tabular-nums">{fmt(dailyReport.totalFuel)}</p>
                                        </div>
                                        <div className="surface-card p-3 text-center">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Shifts</p>
                                            <p className="text-lg font-black text-brand-600 tabular-nums">{dailyReport.recordCount}</p>
                                        </div>
                                    </div>

                                    {/* Per-driver cards */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per Driver</h3>
                                        {dailyReport.driverRecords.map(r => (
                                            <div key={r.id} className="surface-card p-4 sm:p-5 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-black text-sm">
                                                            {r.driverName?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-brand-950 capitalize">{r.driverName}</h4>
                                                            <p className="text-[10px] text-slate-400 uppercase font-bold">{r.carNumber || 'N/A'} — {r.totalKm || 0} km</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-brand-950 tabular-nums">{fmt(r.totalEarnings)}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">Gross Earnings</p>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                                                    {[
                                                        { label: 'Uber', val: r.uber },
                                                        { label: 'InDrive', val: r.inDrive },
                                                        { label: 'Yatri', val: r.yatri },
                                                        { label: 'Rapido', val: r.rapido },
                                                        { label: 'Offline', val: r.offline },
                                                    ].filter(p => p.val > 0).map(p => (
                                                        <div key={p.label} className="bg-brand-50 rounded-lg p-2">
                                                            <p className="text-[9px] font-bold text-slate-400 uppercase">{p.label}</p>
                                                            <p className="text-xs font-black text-brand-700 tabular-nums">{fmt(p.val)}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                    <div className="flex justify-between"><span className="text-slate-400">Net</span><span className="font-bold">{fmt(r.netEarnings)}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-400">Salary</span><span className="font-bold">{fmt(r.driverSalary)}</span></div>
                                                    <div className="flex justify-between"><span className="text-slate-400">Cash Given</span><span className="font-bold text-emerald-600">{fmt(r.cashToCashier)}</span></div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Balance</span>
                                                        <span className={clsx("font-bold", r.balance > 0 ? "text-rose-600" : r.balance < 0 ? "text-emerald-600" : "text-slate-400")}>
                                                            {fmt(Math.abs(r.balance))} {r.balance > 0 ? '(Fleet owes)' : r.balance < 0 ? '(Driver owes)' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pending Balances */}
                                    {dailyReport.allBalances.length > 0 && (
                                        <div>
                                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pending Balances</h3>
                                            <div className="flex flex-wrap gap-3">
                                                {dailyReport.allBalances.map(b => (
                                                    <div key={b.id} className="surface-card px-4 py-3 flex items-center gap-3">
                                                        <span className="font-bold text-brand-950 capitalize">{b.name}</span>
                                                        <span className={clsx("font-black tabular-nums", b.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                                                            {fmt(Math.abs(b.balance))}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-bold">
                                                            {b.balance > 0 ? 'Fleet owes' : 'Driver owes'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {!dailyReport && !dailyReportLoading && (
                        <div className="p-12 text-center text-slate-400">
                            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-30" />
                            <p className="font-bold">Select a date and click Load</p>
                        </div>
                    )}
                </div>
            )}

            {/* Feature 4: Edit Record Modal */}
            {editRecord && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                        <div className="p-6 sm:p-8 space-y-5">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                                        <Edit3 className="w-5 h-5 text-brand-600" /> Edit Record
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1 capitalize">{editRecord.driver?.name} — {editForm.date}</p>
                                </div>
                                <button onClick={() => setEditRecord(null)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Basic */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Car</label>
                                        <select value={editForm.carNumber} onChange={e => setEditForm({ ...editForm, carNumber: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm uppercase">
                                            {PREDEFINED_CARS.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
                                        <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm" />
                                    </div>
                                </div>

                                {/* KM */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Start KM</label>
                                        <input type="number" value={editForm.startKm} onChange={e => setEditForm({ ...editForm, startKm: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">End KM</label>
                                        <input type="number" value={editForm.endKm} onChange={e => setEditForm({ ...editForm, endKm: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                </div>

                                {/* Earnings */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Platform Earnings</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[
                                            { key: 'uber', label: 'Uber' }, { key: 'inDrive', label: 'InDrive' },
                                            { key: 'yatri', label: 'Yatri' }, { key: 'rapido', label: 'Rapido' },
                                            { key: 'offline', label: 'Offline' },
                                        ].map(p => (
                                            <div key={p.key} className="space-y-0.5">
                                                <label className="text-[9px] text-slate-400 font-bold">{p.label}</label>
                                                <input type="number" value={editForm[p.key] || ''} onChange={e => setEditForm({ ...editForm, [p.key]: e.target.value })}
                                                    className="clean-input w-full rounded-lg px-2 py-2 text-sm font-bold" placeholder="0" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Cash */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Platform Cash</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[
                                            { key: 'uberCash', label: 'Uber Cash' }, { key: 'inDriveCash', label: 'InDrive Cash' },
                                            { key: 'yatriCash', label: 'Yatri Cash' }, { key: 'rapidoCash', label: 'Rapido Cash' },
                                            { key: 'offlineCash', label: 'Offline Cash' },
                                        ].map(p => (
                                            <div key={p.key} className="space-y-0.5">
                                                <label className="text-[9px] text-slate-400 font-bold">{p.label}</label>
                                                <input type="number" value={editForm[p.key] || ''} onChange={e => setEditForm({ ...editForm, [p.key]: e.target.value })}
                                                    className="clean-input w-full rounded-lg px-2 py-2 text-sm font-bold" placeholder="0" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Commissions */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Uber Commission</label>
                                        <input type="number" value={editForm.uberComm || ''} onChange={e => setEditForm({ ...editForm, uberComm: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Yatri Commission</label>
                                        <input type="number" value={editForm.yatriComm || ''} onChange={e => setEditForm({ ...editForm, yatriComm: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                </div>

                                {/* Expenses */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2 col-span-1 sm:col-span-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fuel Entries</label>
                                        {(editForm.fuelDetails || []).map((f, i) => (
                                            <div key={i} className="flex gap-2 items-center bg-brand-50 p-2 rounded-xl">
                                                <select value={f.type} onChange={e => {
                                                    const newFd = [...editForm.fuelDetails];
                                                    newFd[i].type = e.target.value;
                                                    setEditForm({ ...editForm, fuelDetails: newFd });
                                                }} className="clean-input w-24 rounded-lg px-2 py-2 text-xs font-bold bg-white text-slate-600">
                                                    <option value="CNG">CNG</option>
                                                    <option value="Petrol">Petrol</option>
                                                    <option value="EV Charge">EV ⚡</option>
                                                </select>
                                                <input type="number" min="0" placeholder="0" value={f.amount}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        if (val !== '' && parseFloat(val) < 0) return;
                                                        const newFd = [...editForm.fuelDetails];
                                                        newFd[i].amount = val;
                                                        // Auto-update total fuel scalar
                                                        const totalFuel = newFd.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                                                        setEditForm({ ...editForm, fuelDetails: newFd, fuel: totalFuel });
                                                    }}
                                                    className="clean-input flex-1 rounded-lg px-3 py-2 text-sm font-bold" />
                                                <button type="button" onClick={() => {
                                                    const newFd = [...editForm.fuelDetails];
                                                    newFd[i].paidBy = newFd[i].paidBy === 'driver' ? 'fleet' : 'driver';
                                                    setEditForm({ ...editForm, fuelDetails: newFd });
                                                }}
                                                    className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap ${f.paidBy === 'driver' ? "bg-brand-600 text-white border-brand-600" : "bg-pink-500 text-white border-pink-500"}`}>
                                                    {f.paidBy === 'driver' ? 'Driver Paid' : 'Fleet Paid'}
                                                </button>
                                                <button type="button" onClick={() => {
                                                    const newFd = editForm.fuelDetails.filter((_, idx) => idx !== i);
                                                    const totalFuel = newFd.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                                                    setEditForm({ ...editForm, fuelDetails: newFd, fuel: totalFuel });
                                                }} className="p-1.5 text-slate-400 hover:text-rose-500 transition rounded-lg">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                        <div className="flex justify-between items-center mt-1">
                                            <button type="button" onClick={() => {
                                                const newFd = [...(editForm.fuelDetails || []), { amount: '', type: 'CNG', paidBy: 'driver' }];
                                                setEditForm({ ...editForm, fuelDetails: newFd });
                                            }} className="text-[10px] font-bold text-brand-600 flex items-center gap-1 hover:text-brand-700">
                                                <Plus className="w-3 h-3" /> Add fuel entry
                                            </button>
                                            <span className="text-[10px] font-bold text-slate-500">Total: ₹{editForm.fuel || 0}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Other Exp</label>
                                        <input type="number" value={editForm.otherExpenses || ''} onChange={e => setEditForm({ ...editForm, otherExpenses: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Online Pay</label>
                                        <input type="number" value={editForm.onlinePayments || ''} onChange={e => setEditForm({ ...editForm, onlinePayments: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                    </div>
                                </div>

                                {/* Cash to Cashier */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cash to Cashier</label>
                                    <input type="number" value={editForm.cashToCashier || ''} onChange={e => setEditForm({ ...editForm, cashToCashier: e.target.value })}
                                        className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold" />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setEditRecord(null)} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={editSaving}
                                    className="flex-1 py-3.5 rounded-2xl font-bold bg-brand-600 text-white shadow-xl shadow-brand-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {editSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Feature 5: Driver Report Modal */}
            {driverReport && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full sm:max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                                        <User className="w-5 h-5 text-brand-600" /> Driver Report
                                    </h2>
                                    <p className="text-lg font-bold text-brand-700 mt-1 capitalize">{driverReport.driver.name}</p>
                                </div>
                                <button onClick={() => setDriverReport(null)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <div className="surface-card p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Earnings</p>
                                    <p className="text-lg font-black text-brand-950 tabular-nums">{fmt(driverReport.summary.totalEarnings)}</p>
                                </div>
                                <div className="surface-card p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Salary</p>
                                    <p className="text-lg font-black text-brand-700 tabular-nums">{fmt(driverReport.summary.totalSalary)}</p>
                                </div>
                                <div className="surface-card p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cash Given</p>
                                    <p className="text-lg font-black text-emerald-600 tabular-nums">{fmt(driverReport.summary.totalCash)}</p>
                                </div>
                                <div className="surface-card p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total KM</p>
                                    <p className="text-lg font-black text-brand-950 tabular-nums">{driverReport.summary.totalKm.toFixed(0)}</p>
                                </div>
                                <div className="surface-card p-3 text-center">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Records</p>
                                    <p className="text-lg font-black text-brand-600 tabular-nums">{driverReport.summary.totalRecords}</p>
                                </div>
                                <div className={clsx("surface-card p-3 text-center", driverReport.currentBalance !== 0 && "!border-brand-300 ring-2 ring-brand-100")}>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Balance</p>
                                    <p className={clsx("text-lg font-black tabular-nums", driverReport.currentBalance > 0 ? "text-rose-600" : driverReport.currentBalance < 0 ? "text-emerald-600" : "text-slate-400")}>
                                        {fmt(Math.abs(driverReport.currentBalance))}
                                    </p>
                                    <p className="text-[9px] font-bold text-slate-400">
                                        {driverReport.currentBalance > 0 ? 'Fleet owes' : driverReport.currentBalance < 0 ? 'Driver owes' : 'Settled'}
                                    </p>
                                </div>
                            </div>

                            {/* Earnings Chart */}
                            {driverReport.chartData.length > 1 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Earnings Over Time</h3>
                                    <div className="h-48 sm:h-56">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={driverReport.chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'dd MMM')} tick={{ fontSize: 10 }} />
                                                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                                                <Tooltip formatter={(v) => [`₹${v}`, '']} labelFormatter={d => format(new Date(d), 'dd MMM yyyy')} />
                                                <Line type="monotone" dataKey="earnings" stroke="#6366f1" strokeWidth={2} dot={false} name="Gross" />
                                                <Line type="monotone" dataKey="salary" stroke="#f59e0b" strokeWidth={2} dot={false} name="Salary" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Full Record History */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <History className="w-3.5 h-3.5" /> Shift History
                                </h3>
                                <div className="max-h-60 overflow-y-auto space-y-1.5">
                                    {driverReport.records.map(r => (
                                        <div key={r.id} className="flex justify-between items-center text-xs py-2 px-3 border-b border-brand-50 last:border-0 hover:bg-brand-50/50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-400 font-medium w-16">{format(new Date(r.date), 'dd MMM')}</span>
                                                <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded uppercase">{r.carNumber}</span>
                                            </div>
                                            <div className="flex gap-4 tabular-nums font-bold">
                                                <span className="text-slate-600">{fmt(r.totalEarnings)}</span>
                                                <span className="text-emerald-600">{fmt(r.cashToCashier)}</span>
                                                <span className="text-brand-700 w-16 text-right">{r.totalKm} km</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Settlement Log */}
                            {driverReport.settlements.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Wallet className="w-3.5 h-3.5" /> Settlement Log
                                    </h3>
                                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                                        {driverReport.settlements.map(s => (
                                            <div key={s.id} className="flex justify-between items-center text-xs py-2 px-3 border-b border-brand-50 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 font-medium">{format(new Date(s.date), 'dd MMM yyyy')}</span>
                                                    <span className={clsx("px-2 py-0.5 rounded text-[9px] font-bold uppercase",
                                                        (s.method || 'cash') === 'upi' ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500")}>
                                                        {s.method || 'cash'}
                                                    </span>
                                                    <span className={clsx("px-2 py-0.5 rounded text-[9px] font-bold",
                                                        s.amount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                        {s.amount > 0 ? 'Received' : 'Paid'}
                                                    </span>
                                                </div>
                                                <span className={clsx("font-black tabular-nums", s.amount > 0 ? "text-emerald-600" : "text-rose-600")}>
                                                    {fmt(Math.abs(s.amount))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setDriverReport(null)}
                                className="w-full py-3 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deposit to Owner Modal */}
            {showDepositModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                    <form onSubmit={handleDeposit} className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-scaleIn">
                        <div className="text-center mb-6">
                            <div className="mx-auto w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-3">
                                <ArrowUpRight className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-extrabold text-brand-950">Deposit to Owner</h2>
                            <p className="text-sm text-slate-400 mt-1">Record cash/UPI transfer from cashier to owner</p>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Amount (₹)</label>
                                <input type="number" step="0.01" required value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                                    className="clean-input w-full rounded-2xl px-5 py-3.5 font-black text-lg text-center" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Method</label>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setDepositMethod('cash')}
                                        className={clsx("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2",
                                            depositMethod === 'cash' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-400 border-gray-200")}>
                                        💵 Cash
                                    </button>
                                    <button type="button" onClick={() => setDepositMethod('upi')}
                                        className={clsx("flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2",
                                            depositMethod === 'upi' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-400 border-gray-200")}>
                                        📱 UPI
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-3">
                            <button type="button" onClick={() => setShowDepositModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                            <button type="submit" disabled={depositing || !depositAmount}
                                className="flex-1 py-3.5 rounded-2xl font-bold bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50">
                                {depositing ? 'Recording...' : 'Confirm Deposit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

const kpiColors = {
    emerald: 'bg-emerald-100 text-emerald-600',
    brand: 'bg-brand-100 text-brand-600',
    sky: 'bg-sky-100 text-sky-600',
    rose: 'bg-rose-100 text-rose-600',
    amber: 'bg-amber-100 text-amber-600',
};

function KpiCard({ title, value, icon, color, isWarning, highlight }) {
    const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
    return (
        <div className={clsx("p-3 sm:p-5 surface-card", highlight && "!border-brand-300 ring-2 ring-brand-100")}>
            <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${kpiColors[color]} w-fit mb-2 sm:mb-3`}>{icon}</div>
            <h3 className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">{title}</h3>
            <p className={clsx("text-lg sm:text-2xl font-black tracking-tight tabular-nums mt-0.5 sm:mt-1", isWarning ? "text-amber-600" : highlight ? "text-brand-700" : "text-brand-950")}>
                {fmt(value)}
            </p>
        </div>
    );
}
