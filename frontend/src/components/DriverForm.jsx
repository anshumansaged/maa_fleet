import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Calculator, User, Wallet, Fuel, Send, Sparkles, Car, ToggleLeft, Plus, Trash2, ShieldCheck, Route, History, AlertTriangle, CheckCircle2, X, Banknote, ClipboardList, Info, ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';
const ALL_PLATFORMS = [
    { id: 'uber', label: 'Uber', hasComm: true },
    { id: 'inDrive', label: 'InDrive', hasComm: false },
    { id: 'yatri', label: 'Yatri Sathi', hasComm: true },
    { id: 'rapido', label: 'Rapido', hasComm: false },
    { id: 'offline', label: 'Offline', hasComm: false },
];

const PREDEFINED_CARS = ['3905', '4030', 'ev2335'];

export default function DriverForm() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Basic Info
    const [driverId, setDriverId] = useState('');
    const [carNumber, setCarNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Odometer
    const [startKm, setStartKm] = useState('');
    const [endKm, setEndKm] = useState('');

    // Platforms
    const [activePlatforms, setActivePlatforms] = useState(['uber', 'offline']);
    const [earnings, setEarnings] = useState({});
    const [commissions, setCommissions] = useState({});
    const [cash, setCash] = useState({});

    // Advanced Tracking
    const [fuelEntries, setFuelEntries] = useState([{ id: Date.now(), amount: '', type: 'CNG', paidBy: 'driver' }]);
    const [expenses, setExpenses] = useState({ otherExpenses: '', onlinePayments: '' });
    const [yatriTrips, setYatriTrips] = useState('');

    // Payment Logic
    const [cashToCashier, setCashToCashier] = useState('');

    // Feature: Duplicate check
    const [duplicateWarning, setDuplicateWarning] = useState(null);

    // Feature: Confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Feature: Quick settle modal
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [settleAmount, setSettleAmount] = useState('');
    const [settling, setSettling] = useState(false);

    // Feature: Daily summary
    const [showDailySummary, setShowDailySummary] = useState(false);
    const [dailySummary, setDailySummary] = useState(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    // Validation errors
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => { fetchDrivers(); }, []);

    const fetchDrivers = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/drivers`);
            setDrivers(data);
            if (data.length > 0 && !driverId) setDriverId(data[0].id);
        } catch (error) { console.error('Failed to fetch drivers', error); }
        finally { setLoading(false); }
    };

    // Feature 2: Check for duplicate record when driver or date changes
    const checkDuplicate = useCallback(async (did, d) => {
        if (!did || !d) return;
        try {
            const { data } = await axios.get(`${API_URL}/records/check-duplicate?driverId=${did}&date=${d}`);
            setDuplicateWarning(data.exists ? data : null);
        } catch { setDuplicateWarning(null); }
    }, []);

    useEffect(() => { checkDuplicate(driverId, date); }, [driverId, date, checkDuplicate]);

    // Feature 4: Auto-fill from last shift when driver changes
    useEffect(() => {
        if (!driverId || drivers.length === 0) return;
        const driver = drivers.find(d => d.id === driverId);
        if (!driver?.records?.length) return;

        const lastRecord = driver.records[0]; // already sorted desc by date
        if (lastRecord) {
            setCarNumber(lastRecord.carNumber || '');
            setStartKm(lastRecord.endKm ? String(lastRecord.endKm) : '');

            // Restore active platforms from last shift
            const lastPlatforms = [];
            if (lastRecord.uber > 0) lastPlatforms.push('uber');
            if (lastRecord.inDrive > 0) lastPlatforms.push('inDrive');
            if (lastRecord.yatri > 0) lastPlatforms.push('yatri');
            if (lastRecord.rapido > 0) lastPlatforms.push('rapido');
            if (lastRecord.offline > 0) lastPlatforms.push('offline');
            if (lastPlatforms.length > 0) setActivePlatforms(lastPlatforms);
        }
    }, [driverId, drivers]);

    const togglePlatform = (id) => {
        setActivePlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const addFuelEntry = () => setFuelEntries([...fuelEntries, { id: Date.now(), amount: '', type: 'CNG', paidBy: 'driver' }]);
    const removeFuelEntry = (id) => setFuelEntries(fuelEntries.filter(f => f.id !== id));
    const updateFuelEntry = (id, field, value) => {
        setFuelEntries(fuelEntries.map(f => f.id === id ? { ...f, [field]: value } : f));
    }

    const v = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

    const selectedDriver = drivers.find(d => d.id === driverId);
    const driverPercentage = selectedDriver ? selectedDriver.salaryPercentage : 0.35;
    const previousBalance = selectedDriver?.currentBalance || 0;

    // Calculations
    const tStartKm = v(startKm);
    const tEndKm = v(endKm);
    const totalKm = (tEndKm > tStartKm) ? tEndKm - tStartKm : 0;

    const totalEarnings = activePlatforms.reduce((s, p) => s + v(earnings[p]), 0);

    const totalCommission = activePlatforms.reduce((s, p) => {
        const plat = ALL_PLATFORMS.find(x => x.id === p);
        return s + (plat?.hasComm ? v(commissions[p + 'Comm']) : 0);
    }, 0);

    const netEarnings = totalEarnings - totalCommission;

    const getPlatformCash = (p) => {
        if (['yatri', 'rapido'].includes(p)) return v(earnings[p]); // auto-cash
        return v(cash[p + 'Cash']); // manual: uber, inDrive, offline
    };
    const totalCash = activePlatforms.reduce((s, p) => s + getPlatformCash(p), 0);

    const totalFuelAll = fuelEntries.reduce((s, f) => s + v(f.amount), 0);
    const driverPaidFuel = fuelEntries.filter(f => f.paidBy === 'driver').reduce((s, f) => s + v(f.amount), 0);
    const fleetPaidFuel = fuelEntries.filter(f => f.paidBy === 'fleet').reduce((s, f) => s + v(f.amount), 0);
    const totalFuel = driverPaidFuel; // Only driver-paid fuel affects cash calculation
    const totalExpenses = totalFuel + v(expenses.otherExpenses);
    const onlinePayments = v(expenses.onlinePayments);

    const driverSalary = netEarnings * driverPercentage;

    let cashInHand = totalCash - totalExpenses - onlinePayments - driverSalary;
    let pendingSalary = 0;

    const remainingCash = cashInHand >= 0
        ? cashInHand - v(cashToCashier)
        : cashInHand + v(cashToCashier);

    const todayDifference = cashInHand - v(cashToCashier);
    const newTotalBalance = previousBalance + todayDifference;

    const balanceLabel = (bal) => bal > 0 ? 'Driver Owes Fleet' : bal < 0 ? 'Fleet Owes Driver' : 'Settled';

    // Feature 8: Validation
    const validate = () => {
        const newErrors = {};
        if (!driverId) newErrors.driver = 'Select a driver';
        if (!carNumber) newErrors.car = 'Select a vehicle';
        if (tEndKm > 0 && tEndKm <= tStartKm) newErrors.km = 'End KM must be greater than Start KM';
        if (totalEarnings <= 0) newErrors.earnings = 'Enter earnings for at least one platform';

        // Check negative amounts
        activePlatforms.forEach(p => {
            if (v(earnings[p]) < 0) newErrors[`earn_${p}`] = 'Cannot be negative';
        });
        fuelEntries.forEach(f => {
            if (v(f.amount) < 0) newErrors[`fuel_${f.id}`] = 'Cannot be negative';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const generateWhatsAppMessage = () => {
        return encodeURIComponent(`*Shift Report - Maa Fleet* 🚗
Date: ${date} | Driver: *${selectedDriver?.name || 'Unknown'}*
Km: ${tStartKm} to ${tEndKm} (Total: *${totalKm}km*)
━━━━━━━━━━━━━━━━
*💰 Earnings*
${activePlatforms.map(p => {
            const plat = ALL_PLATFORMS.find(x => x.id === p);
            return `${plat.label}: ₹${v(earnings[p])}`;
        }).join('\n')}
*Gross: ₹${totalEarnings}*

*⛽ Deductions*
Fuel (Driver): ₹${driverPaidFuel}${fleetPaidFuel > 0 ? ` | Fuel (Fleet): ₹${fleetPaidFuel}` : ''}
Comm: ₹${totalCommission} | Other: ₹${v(expenses.otherExpenses)}
Online Pay: ₹${onlinePayments}

*📊 Summary*
Salary (${(driverPercentage * 100).toFixed(0)}%): ₹${driverSalary.toFixed(2)} (Paid directly from cash)
Cash To Cashier: ₹${v(cashToCashier).toFixed(2)}

*💳 Running Balance*
Previous: ₹${Math.abs(previousBalance).toFixed(0)} (${balanceLabel(previousBalance)})
Today: ${todayDifference >= 0 ? '+' : ''}₹${todayDifference.toFixed(0)}
*New Balance: ₹${Math.abs(newTotalBalance).toFixed(0)} (${balanceLabel(newTotalBalance)})*
━━━━━━━━━━━━━━━━`);
    };

    // Feature 5: Daily Summary
    const fetchDailySummary = async () => {
        setLoadingSummary(true);
        try {
            const { data } = await axios.get(`${API_URL}/daily-summary?date=${date}`);
            setDailySummary(data);
            setShowDailySummary(true);
        } catch { alert('Failed to load daily summary'); }
        finally { setLoadingSummary(false); }
    };

    const generateDailySummaryMessage = () => {
        if (!dailySummary) return '';
        const s = dailySummary;
        const balLabel = (b) => b > 0 ? 'Owes Fleet' : 'Fleet Owes';
        return encodeURIComponent(`*📋 Daily Summary — Maa Fleet*
Date: *${s.date}* | Shifts: *${s.recordCount}*
━━━━━━━━━━━━━━━━
*💰 Totals*
Gross: ₹${s.totalEarnings.toFixed(0)}
Cash Collected: ₹${s.totalCashCollected.toFixed(0)}
Fuel: ₹${s.totalFuel.toFixed(0)}
Salaries: ₹${s.totalSalary.toFixed(0)}

*👤 Per Driver*
${s.driverRecords.map(r =>
            `${r.driverName}: Earned ₹${r.totalEarnings.toFixed(0)} | Cash ₹${r.cashToCashier.toFixed(0)} | Salary ₹${r.driverSalary.toFixed(0)}`
        ).join('\n')}

*💳 Pending Balances*
${s.allBalances.length > 0 ? s.allBalances.map(b =>
            `${b.name}: ₹${Math.abs(b.balance).toFixed(0)} (${balLabel(b.balance)})`
        ).join('\n') : 'All settled ✓'}
━━━━━━━━━━━━━━━━`);
    };

    // Feature 9: Submit with confirmation
    const handlePreSubmit = (e) => {
        e.preventDefault();
        setTouched({ driver: true, car: true, km: true, earnings: true });
        if (!validate()) return;
        setShowConfirmModal(true);
    };

    const handleConfirmedSubmit = async () => {
        setShowConfirmModal(false);
        setSubmitting(true);
        try {
            const payload = {
                driverId, carNumber, date,
                startKm: tStartKm, endKm: tEndKm, totalKm, yatriTrips: parseInt(yatriTrips) || 0,
                cashToCashier: v(cashToCashier),
                fuelDetails: fuelEntries.filter(f => v(f.amount) > 0).map(f => ({ amount: v(f.amount), type: f.type, paidBy: f.paidBy })),
                driverSalaryPaid: true,
                uber: v(earnings.uber), inDrive: v(earnings.inDrive), yatri: v(earnings.yatri), rapido: v(earnings.rapido), offline: v(earnings.offline),
                uberComm: v(commissions.uberComm), yatriComm: v(commissions.yatriComm),
                uberCash: v(cash.uberCash), inDriveCash: v(cash.inDriveCash),
                yatriCash: getPlatformCash('yatri'), rapidoCash: getPlatformCash('rapido'), offlineCash: getPlatformCash('offline'),
                fuel: totalFuelAll, otherExpenses: v(expenses.otherExpenses), onlinePayments: v(expenses.onlinePayments)
            };

            await axios.post(`${API_URL}/records`, payload);
            setSuccess(true);
            window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank');
            setTimeout(() => setSuccess(false), 3000);

            // Reset
            setEarnings({}); setCommissions({}); setCash({});
            setCashToCashier(''); setEndKm('');
            setFuelEntries([{ id: Date.now(), amount: '', type: 'CNG', paidBy: 'driver' }]);
            setExpenses({ otherExpenses: '', onlinePayments: '' });
            setDuplicateWarning(null); setErrors({}); setTouched({});

            fetchDrivers();
        } catch (error) { alert("Error saving record."); }
        finally { setSubmitting(false); }
    };

    // Feature 1: Quick Settle
    const handleQuickSettle = async () => {
        if (!settleAmount || !selectedDriver) return;
        setSettling(true);
        try {
            const direction = previousBalance > 0 ? 'driver_pays' : 'fleet_pays';
            await axios.post(`${API_URL}/quick-settle`, {
                driverId: selectedDriver.id,
                amount: parseFloat(settleAmount),
                direction
            });
            setShowSettleModal(false);
            setSettleAmount('');
            fetchDrivers();
        } catch { alert('Settlement failed'); }
        finally { setSettling(false); }
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-5">
            <div className="w-14 h-14 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p className="font-semibold text-brand-600 text-sm animate-pulse">Loading fleet data...</p>
        </div>
    );

    const activePlatformData = ALL_PLATFORMS.filter(p => activePlatforms.includes(p.id));
    const showError = (field) => touched[field] && errors[field];

    return (
        <>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
            <div className="xl:col-span-8">
                <form onSubmit={handlePreSubmit} className="glass-panel p-5 sm:p-8 md:p-10 space-y-0">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 pb-6 sm:pb-8 border-b border-brand-100">
                        <div>
                            <h2 className="text-lg sm:text-2xl font-extrabold text-brand-950 flex items-center gap-2 sm:gap-3">
                                <span className="p-2 sm:p-3 bg-gradient-to-br from-brand-100 to-pink-100 rounded-xl sm:rounded-2xl">
                                    <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-brand-600" />
                                </span>
                                Advanced Trip Entry
                            </h2>
                            <p className="text-slate-400 mt-1.5 sm:mt-2 text-xs sm:text-sm">Enter detailed trip & financial metrics.</p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="clean-input rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm shadow-sm flex-1 sm:flex-initial" required />
                            <button type="button" onClick={fetchDailySummary} disabled={loadingSummary}
                                className="p-2.5 sm:p-3 rounded-2xl bg-brand-100 text-brand-600 hover:bg-brand-200 transition-all active:scale-95" title="Daily Summary">
                                <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Feature 2: Duplicate Warning */}
                    {duplicateWarning?.exists && (
                        <div className="flex items-center gap-3 p-4 my-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-amber-700 animate-fadeUp">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-bold">Record already exists for this driver today!</p>
                                <p className="text-xs opacity-70 mt-0.5">Earnings: ₹{duplicateWarning.record?.totalEarnings?.toFixed(0)} | Cash: ₹{duplicateWarning.record?.cashToCashier?.toFixed(0)}</p>
                            </div>
                        </div>
                    )}

                    {/* Section 1: Basic Info & KM Tracker */}
                    <div className="py-6 sm:py-8 border-b border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Route className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">1. Basic Info & KM Tracking</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Driver</label>
                                <select value={driverId} onChange={e => { setDriverId(e.target.value); setTouched({ ...touched, driver: true }); }}
                                    className={clsx("clean-input w-full rounded-2xl px-4 py-3 text-sm cursor-pointer", showError('driver') && "!border-rose-400 !bg-rose-50")} required>
                                    <option value="" disabled>Select driver...</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                {showError('driver') && <p className="text-rose-500 text-[10px] font-bold">{errors.driver}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 flex items-center gap-2"><Car className="w-3.5 h-3.5" /> Vehicle</label>
                                <select value={carNumber} onChange={e => { setCarNumber(e.target.value); setTouched({ ...touched, car: true }); }}
                                    className={clsx("clean-input w-full rounded-2xl px-4 py-3 text-sm uppercase cursor-pointer", showError('car') && "!border-rose-400 !bg-rose-50")} required>
                                    <option value="" disabled>Select car...</option>
                                    {PREDEFINED_CARS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                {showError('car') && <p className="text-rose-500 text-[10px] font-bold">{errors.car}</p>}
                            </div>
                            <div className={clsx("space-y-1.5 border p-4 rounded-2xl", showError('km') ? "border-rose-300 bg-rose-50/30" : "border-brand-100 bg-brand-50/30")}>
                                <label className="text-xs font-bold text-slate-500">Start KM</label>
                                <input type="number" value={startKm} onChange={e => setStartKm(e.target.value)} className="clean-input w-full rounded-xl px-4 py-2 text-sm bg-white" placeholder="0" />
                            </div>
                            <div className={clsx("space-y-1.5 border p-4 rounded-2xl", showError('km') ? "border-rose-300 bg-rose-50/30" : "border-brand-100 bg-brand-50/30")}>
                                <label className="text-xs font-bold text-slate-500">End KM</label>
                                <input type="number" value={endKm} onChange={e => { setEndKm(e.target.value); setTouched({ ...touched, km: true }); }} className="clean-input w-full rounded-xl px-4 py-2 text-sm bg-white" placeholder="0" />
                                {showError('km') ? (
                                    <p className="text-right text-rose-500 text-[10px] font-bold mt-2">{errors.km}</p>
                                ) : (
                                    <div className="text-right text-xs font-extrabold text-brand-600 mt-2">Total Distance: {totalKm} km</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Platform Toggles */}
                    <div className="py-5 sm:py-6 border-b border-brand-50">
                        <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <ToggleLeft className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">2. Active Platforms Today</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {ALL_PLATFORMS.map(p => (
                                <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                                    className={clsx("px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 border-2 active:scale-95",
                                        activePlatforms.includes(p.id) ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20" : "bg-white text-slate-400 border-gray-200 hover:border-brand-300 hover:text-brand-600")}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {showError('earnings') && <p className="text-rose-500 text-[10px] font-bold mt-2">{errors.earnings}</p>}
                    </div>

                    {/* Platform Earnings & Cash Inputs */}
                    {activePlatformData.length > 0 && (
                        <div className="py-6 sm:py-8 border-b border-brand-50 space-y-6">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-brand-400" />
                                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">3. Platform Data</span>
                            </div>

                            {activePlatformData.map(p => (
                                <div key={p.id} className="surface-card p-4 sm:p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-extrabold text-brand-700 text-sm sm:text-base">{p.label}</h4>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Earned</label>
                                            <input type="number" step="0.01" placeholder="0.00"
                                                value={earnings[p.id] || ''} onChange={e => { setEarnings({ ...earnings, [p.id]: e.target.value }); setTouched({ ...touched, earnings: true }); }}
                                                className={clsx("clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-brand-400", errors[`earn_${p.id}`] && "!border-rose-400")} />
                                            {errors[`earn_${p.id}`] && <p className="text-rose-500 text-[10px] font-bold">{errors[`earn_${p.id}`]}</p>}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] items-center flex justify-between font-bold text-slate-400 uppercase">
                                                Cash Received {['yatri', 'rapido'].includes(p.id) && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 rounded">Auto</span>}
                                                {p.id === 'offline' && <span className="text-[8px] bg-amber-100 text-amber-700 px-1.5 rounded">Monthly OK</span>}
                                            </label>
                                            <input type="number" step="0.01" placeholder={p.id === 'offline' ? '0 if monthly' : '0.00'}
                                                value={['yatri', 'rapido'].includes(p.id) ? (earnings[p.id] || '') : (cash[p.id + 'Cash'] || '')}
                                                onChange={e => !['yatri', 'rapido'].includes(p.id) && setCash({ ...cash, [p.id + 'Cash']: e.target.value })}
                                                disabled={['yatri', 'rapido'].includes(p.id)}
                                                className={clsx("clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold",
                                                    ['yatri', 'rapido'].includes(p.id) ? "bg-emerald-50 text-emerald-700 border-dashed" : "focus:!border-emerald-400")} />
                                        </div>

                                        {p.hasComm && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Commission</label>
                                                <input type="number" step="0.01" placeholder="0.00"
                                                    value={commissions[p.id + 'Comm'] || ''} onChange={e => setCommissions({ ...commissions, [p.id + 'Comm']: e.target.value })}
                                                    className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-violet-400" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Expenses & Fuel */}
                    <div className="py-6 sm:py-8 border-b border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Fuel className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">4. Expenses & Fuel</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-brand-50/30 border border-brand-100 rounded-2xl p-4 sm:p-5 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-slate-700">Fuel Entries</h4>
                                    <button type="button" onClick={addFuelEntry} className="text-xs font-bold text-brand-600 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                                {fuelEntries.map((f) => (
                                    <div key={f.id} className="space-y-2">
                                        <div className="flex gap-2 items-center">
                                            <select value={f.type} onChange={e => updateFuelEntry(f.id, 'type', e.target.value)} className="clean-input w-1/3 rounded-xl px-3 py-2 text-sm font-bold bg-white text-slate-600">
                                                <option value="CNG">CNG</option>
                                                <option value="Petrol">Petrol</option>
                                                <option value="EV Charge">EV ⚡</option>
                                            </select>
                                            <input type="number" placeholder="Amount (₹)" value={f.amount} onChange={e => updateFuelEntry(f.id, 'amount', e.target.value)}
                                                className={clsx("clean-input w-full rounded-xl px-3 py-2 text-sm font-bold focus:!border-rose-400", errors[`fuel_${f.id}`] && "!border-rose-400")} />
                                            {fuelEntries.length > 1 && (
                                                <button type="button" onClick={() => removeFuelEntry(f.id)} className="p-2 text-slate-300 hover:text-rose-500 transition hover:bg-rose-50 rounded-xl">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        {/* Paid By Toggle */}
                                        <div className="flex items-center gap-1.5 ml-1">
                                            <span className="text-[10px] font-bold text-slate-400">Paid by:</span>
                                            <button type="button" onClick={() => updateFuelEntry(f.id, 'paidBy', 'driver')}
                                                className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                                                    f.paidBy === 'driver' ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-400 border-slate-200 hover:border-brand-300")}>
                                                Driver
                                            </button>
                                            <button type="button" onClick={() => updateFuelEntry(f.id, 'paidBy', 'fleet')}
                                                className={clsx("px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                                                    f.paidBy === 'fleet' ? "bg-pink-500 text-white border-pink-500" : "bg-white text-slate-400 border-slate-200 hover:border-pink-300")}>
                                                Fleet (You)
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="text-right text-xs font-extrabold mt-2 space-y-0.5">
                                    <p className="text-brand-600">Driver Paid: ₹{driverPaidFuel}</p>
                                    {fleetPaidFuel > 0 && <p className="text-pink-500">Fleet Paid: ₹{fleetPaidFuel} <span className="text-[10px] text-slate-400">(not from driver cash)</span></p>}
                                    <p className="text-slate-500">Total Fuel: ₹{totalFuelAll}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-brand-50/30 border border-brand-100 rounded-2xl p-4 sm:p-5 space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500">Other Miscellaneous Expenses</label>
                                        <input type="number" step="0.01" placeholder="0.00"
                                            value={expenses.otherExpenses} onChange={e => setExpenses({ ...expenses, otherExpenses: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-rose-400" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-500">Online Payments (Paid via UPI)</label>
                                        <input type="number" step="0.01" placeholder="0.00"
                                            value={expenses.onlinePayments} onChange={e => setExpenses({ ...expenses, onlinePayments: e.target.value })}
                                            className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-amber-400" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 5: Payment Processing */}
                    <div className="py-6 sm:py-8 border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">5. Payment Processing & Cashier Handover</span>
                        </div>

                        {/* Previous Balance Banner with Settle Button */}
                        {selectedDriver && previousBalance !== 0 && (
                            <div className={clsx("flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed mb-2",
                                previousBalance > 0
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700")}>
                                <History className="w-5 h-5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-xs font-bold uppercase tracking-wider opacity-70">Previous Balance</p>
                                    <p className="text-lg font-black tabular-nums">
                                        ₹{Math.abs(previousBalance).toFixed(0)}
                                        <span className="text-sm font-bold ml-1.5 opacity-70">
                                            {previousBalance > 0 ? 'Driver Owes Fleet' : 'Fleet Owes Driver'}
                                        </span>
                                    </p>
                                </div>
                                <button type="button" onClick={() => { setSettleAmount(Math.abs(previousBalance).toFixed(0)); setShowSettleModal(true); }}
                                    className="px-4 py-2 bg-gradient-to-r from-brand-600 to-pink-500 text-white rounded-xl text-xs font-bold shadow-md hover:-translate-y-0.5 active:scale-95 transition-all">
                                    Settle
                                </button>
                            </div>
                        )}

                        <div className="bg-gradient-to-br from-slate-900 to-brand-950 text-white rounded-[2rem] p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                <div>
                                    <p className="text-xs font-bold text-brand-300 uppercase tracking-widest mb-1">Cashier Must Collect</p>
                                    <p className="text-4xl font-black tabular-nums tracking-tighter text-white">₹{cashInHand.toFixed(0)}</p>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-amber-300 uppercase tracking-widest">Actual Cash Handover (₹)</p>
                                    <input type="number" value={cashToCashier} onChange={e => setCashToCashier(e.target.value)} placeholder="0.00"
                                        className="w-full bg-white/10 border-2 border-white/20 focus:border-brand-400 rounded-xl px-4 py-3 text-2xl font-black tabular-nums text-white placeholder:text-white/20 transition-colors outline-none" />
                                </div>
                            </div>

                            {v(cashToCashier) > 0 && (
                                <div className={clsx("p-4 rounded-xl text-center text-sm font-bold border",
                                    remainingCash > 0 ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                        remainingCash < 0 ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" :
                                            "bg-white/10 text-brand-200 border-white/20")}>
                                    {remainingCash > 0
                                        ? `Driver still has ₹${remainingCash.toFixed(2)} in hand (Owes Fleet)`
                                        : remainingCash < 0
                                            ? `Driver gave ₹${Math.abs(remainingCash).toFixed(2)} extra (Fleet Owes)`
                                            : "Fully Settled!"}
                                </div>
                            )}

                            {/* Running Balance Summary */}
                            <div className="border-t border-white/10 pt-5 mt-2">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-4 h-4 text-brand-300" />
                                    <span className="text-xs font-bold text-brand-300 uppercase tracking-widest">Running Balance</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Previous</p>
                                        <p className={clsx("text-lg font-black tabular-nums", previousBalance > 0 ? "text-amber-300" : previousBalance < 0 ? "text-emerald-300" : "text-white/50")}>
                                            ₹{Math.abs(previousBalance).toFixed(0)}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Today</p>
                                        <p className={clsx("text-lg font-black tabular-nums", todayDifference > 0 ? "text-amber-300" : todayDifference < 0 ? "text-emerald-300" : "text-white/50")}>
                                            {todayDifference >= 0 ? '+' : '−'}₹{Math.abs(todayDifference).toFixed(0)}
                                        </p>
                                    </div>
                                    <div className={clsx("rounded-xl p-3", newTotalBalance > 0 ? "bg-amber-500/20" : newTotalBalance < 0 ? "bg-emerald-500/20" : "bg-white/10")}>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">New Total</p>
                                        <p className={clsx("text-lg font-black tabular-nums", newTotalBalance > 0 ? "text-amber-300" : newTotalBalance < 0 ? "text-emerald-300" : "text-white")}>
                                            ₹{Math.abs(newTotalBalance).toFixed(0)}
                                        </p>
                                    </div>
                                </div>
                                <p className={clsx("text-center text-xs font-bold mt-2",
                                    newTotalBalance > 0 ? "text-amber-400" : newTotalBalance < 0 ? "text-emerald-400" : "text-white/50")}>
                                    {newTotalBalance > 0 ? `Driver owes Fleet ₹${Math.abs(newTotalBalance).toFixed(0)}` :
                                        newTotalBalance < 0 ? `Fleet owes Driver ₹${Math.abs(newTotalBalance).toFixed(0)}` : 'Fully Settled ✓'}
                                </p>
                            </div>

                            <button type="submit" disabled={submitting || !driverId || !carNumber}
                                className={clsx("w-full py-4 rounded-xl font-black text-sm transition-all transform active:scale-95 flex justify-center items-center gap-2.5 shadow-xl mt-4",
                                    submitting || !driverId || !carNumber
                                        ? "bg-white/10 text-white/30 cursor-not-allowed shadow-none"
                                        : "bg-white text-brand-900 hover:bg-brand-50 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)]")}>
                                {success ? <><Sparkles className="w-5 h-5" /> Synced!</> : submitting ? 'Uploading...' : <><Send className="w-5 h-5" /> Submit & Share Record</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* SIDEBAR */}
            <div className="xl:col-span-4">
                <div className="xl:sticky xl:top-28 space-y-6">
                    {/* Numbers Summary */}
                    <div className="glass-panel p-6 space-y-5">
                        <Section title="Revenue">
                            <Row label="Gross Earnings" value={totalEarnings} />
                            <Row label="Commissions" value={totalCommission} negative dim />
                            <div className="h-px bg-brand-100 my-1"></div>
                            <Row label="Net Earnings" value={netEarnings} highlight />
                        </Section>
                        <Section title={`Driver Pay (${(driverPercentage * 100).toFixed(0)}%)`}>
                            <Row label="Earned Salary" value={driverSalary} />
                            <Row label="Paid Today" value={driverSalary} rose />
                            <Row label="Pending" value={0} />
                        </Section>
                        <Section title="Deductions">
                            <Row label="Total Incoming Cash" value={totalCash} />
                            <Row label="Fuel & Exp" value={totalExpenses} negative dim />
                            <Row label="Online Pay" value={onlinePayments} negative dim />
                        </Section>
                        <Section title="Final Calculation">
                            <Row label="Cash To Collect" value={cashInHand} highlight />
                            <Row label="Actual Received" value={v(cashToCashier)} />
                        </Section>
                        <Section title="Running Balance">
                            <Row label="Previous" value={Math.abs(previousBalance)} warning={previousBalance > 0} />
                            <Row label="Today's Change" value={Math.abs(todayDifference)} warning={todayDifference > 0} />
                            <div className="h-px bg-brand-100 my-1"></div>
                            <Row label="New Total" value={Math.abs(newTotalBalance)} highlight warning={newTotalBalance > 0} />
                            <p className={clsx("text-[10px] font-bold text-center mt-1", newTotalBalance > 0 ? "text-amber-600" : newTotalBalance < 0 ? "text-emerald-600" : "text-slate-400")}>
                                {newTotalBalance > 0 ? 'Driver Owes Fleet' : newTotalBalance < 0 ? 'Fleet Owes Driver' : 'Settled ✓'}
                            </p>
                        </Section>
                    </div>

                    {/* Efficiency Metrics */}
                    {totalEarnings > 0 && (
                        <div className="glass-panel p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-brand-400" />
                                <h4 className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em]">Efficiency</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="surface-card p-3 text-center !rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">₹ per KM</p>
                                    <p className="text-lg font-black text-brand-700 tabular-nums">
                                        {totalKm > 0 ? `₹${(totalEarnings / totalKm).toFixed(1)}` : '—'}
                                    </p>
                                </div>
                                <div className="surface-card p-3 text-center !rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Comm %</p>
                                    <p className="text-lg font-black text-violet-600 tabular-nums">
                                        {totalEarnings > 0 ? `${((totalCommission / totalEarnings) * 100).toFixed(1)}%` : '0%'}
                                    </p>
                                </div>
                                <div className="surface-card p-3 text-center !rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fuel / KM</p>
                                    <p className="text-lg font-black text-rose-600 tabular-nums">
                                        {totalKm > 0 ? `₹${(totalFuelAll / totalKm).toFixed(1)}` : '—'}
                                    </p>
                                </div>
                                <div className="surface-card p-3 text-center !rounded-xl">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Profit / KM</p>
                                    <p className="text-lg font-black text-emerald-600 tabular-nums">
                                        {totalKm > 0 ? `₹${((netEarnings - driverSalary - totalExpenses) / totalKm).toFixed(1)}` : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Explainer Card — Simple language breakdown */}
                    <ExplainerCard
                        selectedDriver={selectedDriver}
                        totalEarnings={totalEarnings}
                        totalCommission={totalCommission}
                        netEarnings={netEarnings}
                        driverPercentage={driverPercentage}
                        driverSalary={driverSalary}
                        totalCash={totalCash}
                        totalFuel={totalFuel}
                        driverPaidFuel={driverPaidFuel}
                        fleetPaidFuel={fleetPaidFuel}
                        totalExpenses={totalExpenses}
                        onlinePayments={onlinePayments}
                        cashInHand={cashInHand}
                        cashToCashier={v(cashToCashier)}
                        previousBalance={previousBalance}
                        newTotalBalance={newTotalBalance}
                        balanceLabel={balanceLabel}
                    />
                </div>
            </div>
        </div>

        {/* Feature 9: Confirmation Modal */}
        {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-scaleIn max-h-[85vh] overflow-y-auto">
                    <div className="p-6 sm:p-8 space-y-5">
                        <div className="text-center">
                            <div className="mx-auto w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <h2 className="text-xl font-extrabold text-brand-950">Confirm Submission</h2>
                            <p className="text-sm text-slate-400 mt-1">Review before submitting</p>
                        </div>

                        <div className="space-y-3 text-sm">
                            <ConfirmRow label="Driver" value={selectedDriver?.name || '—'} />
                            <ConfirmRow label="Vehicle" value={carNumber} />
                            <ConfirmRow label="Date" value={date} />
                            <ConfirmRow label="Distance" value={`${totalKm} km`} />
                            <div className="h-px bg-brand-100"></div>
                            <ConfirmRow label="Gross Earnings" value={`₹${totalEarnings.toFixed(0)}`} highlight />
                            <ConfirmRow label="Commissions" value={`−₹${totalCommission.toFixed(0)}`} />
                            <ConfirmRow label="Driver Salary" value={`₹${driverSalary.toFixed(0)}`} />
                            <ConfirmRow label="Total Expenses" value={`₹${totalExpenses.toFixed(0)}`} />
                            <div className="h-px bg-brand-100"></div>
                            <ConfirmRow label="Cash To Collect" value={`₹${cashInHand.toFixed(0)}`} highlight />
                            <ConfirmRow label="Cash Received" value={`₹${v(cashToCashier).toFixed(0)}`} />
                            <div className="h-px bg-brand-100"></div>
                            <ConfirmRow label="New Balance" value={`₹${Math.abs(newTotalBalance).toFixed(0)} (${balanceLabel(newTotalBalance)})`} highlight />
                        </div>

                        {duplicateWarning?.exists && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs font-bold">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                A record already exists for this driver today!
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowConfirmModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">
                                Cancel
                            </button>
                            <button type="button" onClick={handleConfirmedSubmit} disabled={submitting}
                                className="flex-1 py-3.5 rounded-2xl font-bold bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-xl shadow-brand-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2">
                                <Send className="w-4 h-4" />
                                {submitting ? 'Submitting...' : 'Confirm & Send'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Feature 1: Quick Settle Modal */}
        {showSettleModal && selectedDriver && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full sm:max-w-sm rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl p-6 sm:p-8 animate-scaleIn">
                    <div className="text-center mb-6">
                        <div className="mx-auto w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mb-3">
                            <Banknote className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-extrabold text-brand-950">Quick Settle</h2>
                        <p className="text-sm font-semibold mt-1">
                            {previousBalance > 0 ? (
                                <span className="text-amber-600">{selectedDriver.name} owes Fleet ₹{Math.abs(previousBalance).toFixed(0)}</span>
                            ) : (
                                <span className="text-emerald-600">Fleet owes {selectedDriver.name} ₹{Math.abs(previousBalance).toFixed(0)}</span>
                            )}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-brand-400 uppercase tracking-wider">Amount (₹)</label>
                            <input type="number" step="0.01" required value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                                className="clean-input w-full rounded-2xl px-5 py-3.5 font-black text-lg text-center" />
                        </div>
                    </div>
                    <div className="mt-6 flex gap-3">
                        <button type="button" onClick={() => setShowSettleModal(false)} className="flex-1 py-3.5 rounded-2xl font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
                        <button type="button" onClick={handleQuickSettle} disabled={settling || !settleAmount}
                            className="flex-1 py-3.5 rounded-2xl font-bold bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-xl shadow-brand-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 disabled:opacity-50">
                            {settling ? 'Settling...' : 'Settle Now'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Feature 5: Daily Summary Modal */}
        {showDailySummary && dailySummary && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl animate-scaleIn max-h-[85vh] overflow-y-auto">
                    <div className="p-6 sm:p-8 space-y-5">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                                    <ClipboardList className="w-5 h-5 text-brand-600" /> Daily Summary
                                </h2>
                                <p className="text-sm text-slate-400 mt-1">{dailySummary.date} — {dailySummary.recordCount} shifts</p>
                            </div>
                            <button onClick={() => setShowDailySummary(false)} className="p-2 rounded-xl hover:bg-slate-100 transition">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>

                        {dailySummary.recordCount === 0 ? (
                            <p className="text-center text-slate-400 py-8">No records for this date.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <MiniKpi label="Gross" value={dailySummary.totalEarnings} />
                                    <MiniKpi label="Cash Collected" value={dailySummary.totalCashCollected} />
                                    <MiniKpi label="Fuel" value={dailySummary.totalFuel} negative />
                                    <MiniKpi label="Salaries" value={dailySummary.totalSalary} negative />
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Per Driver</h3>
                                    {dailySummary.driverRecords.map((r, i) => (
                                        <div key={i} className="surface-card p-3 sm:p-4 !rounded-xl flex justify-between items-center text-sm">
                                            <span className="font-bold text-brand-950 capitalize">{r.driverName}</span>
                                            <div className="flex gap-4 text-xs font-bold tabular-nums">
                                                <span className="text-slate-600">₹{r.totalEarnings.toFixed(0)}</span>
                                                <span className="text-emerald-600">Cash ₹{r.cashToCashier.toFixed(0)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {dailySummary.allBalances.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Pending Balances</h3>
                                        {dailySummary.allBalances.map(b => (
                                            <div key={b.id} className="flex justify-between items-center text-sm p-3 bg-brand-50/50 rounded-xl">
                                                <span className="font-bold text-brand-950 capitalize">{b.name}</span>
                                                <span className={clsx("font-black tabular-nums", b.balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                                                    ₹{Math.abs(b.balance).toFixed(0)}
                                                    <span className="text-[10px] font-bold text-slate-400 ml-1">{b.balance > 0 ? 'Owes' : 'Owed'}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {dailySummary.recordCount > 0 && (
                            <button type="button"
                                onClick={() => window.open(`https://wa.me/?text=${generateDailySummaryMessage()}`, '_blank')}
                                className="w-full py-3.5 rounded-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 hover:-translate-y-0.5 transition-transform active:scale-95 flex justify-center items-center gap-2">
                                <Send className="w-4 h-4" /> Share Daily Summary on WhatsApp
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

// ─── Sub-components ──────────────────────────────

function Section({ title, children }) {
    return <div className="space-y-2"><h4 className="text-[10px] font-bold text-brand-400 uppercase tracking-[0.2em]">{title}</h4>{children}</div>;
}

function Row({ label, value, negative, highlight, warning, dim, rose }) {
    return (
        <div className={clsx("flex justify-between items-center py-1 text-sm", dim ? "text-slate-400" : "text-slate-600", highlight && "bg-brand-50/80 -mx-3 px-3 py-2 rounded-xl")}>
            <span className={clsx("font-medium", highlight && "text-brand-700 font-bold", warning && "text-amber-600 font-bold")}>{label}</span>
            <span className={clsx("font-bold tabular-nums", highlight && "text-brand-700 text-base", warning && "text-amber-600", rose && "text-emerald-500", dim && "text-slate-400")}>
                {negative ? '−' : ''}₹{Math.abs(value).toFixed(2)}
            </span>
        </div>
    );
}

function ConfirmRow({ label, value, highlight }) {
    return (
        <div className={clsx("flex justify-between items-center py-1.5", highlight && "bg-brand-50 -mx-2 px-2 rounded-lg")}>
            <span className={clsx("text-sm", highlight ? "font-bold text-brand-700" : "text-slate-500")}>{label}</span>
            <span className={clsx("font-bold tabular-nums", highlight ? "text-brand-700" : "text-brand-950")}>{value}</span>
        </div>
    );
}

function MiniKpi({ label, value, negative }) {
    return (
        <div className="surface-card p-3 text-center !rounded-xl">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
            <p className={clsx("text-base font-black tabular-nums", negative ? "text-rose-600" : "text-brand-950")}>
                ₹{(value || 0).toFixed(0)}
            </p>
        </div>
    );
}

function ExplainerCard({ selectedDriver, totalEarnings, totalCommission, netEarnings, driverPercentage, driverSalary, totalCash, totalFuel, driverPaidFuel, fleetPaidFuel, totalExpenses, onlinePayments, cashInHand, cashToCashier, previousBalance, newTotalBalance, balanceLabel }) {
    const [open, setOpen] = useState(false);
    const driverName = selectedDriver?.name || 'Driver';
    const pct = (driverPercentage * 100).toFixed(0);

    if (totalEarnings <= 0) return null;

    const steps = [
        {
            emoji: '💰',
            title: 'Total Earnings',
            text: `${driverName} earned ₹${totalEarnings.toFixed(0)} from all platforms today.`
        },
        totalCommission > 0 && {
            emoji: '🏢',
            title: 'Platform Commission',
            text: `Uber/Yatri took ₹${totalCommission.toFixed(0)} as commission. So real earnings = ₹${totalEarnings.toFixed(0)} − ₹${totalCommission.toFixed(0)} = ₹${netEarnings.toFixed(0)}.`
        },
        {
            emoji: '👤',
            title: `Driver's Salary (${pct}%)`,
            text: `${driverName} gets ${pct}% of ₹${netEarnings.toFixed(0)} = ₹${driverSalary.toFixed(0)}. This is taken from the cash directly.`
        },
        {
            emoji: '💵',
            title: 'Cash Collected',
            text: `${driverName} received ₹${totalCash.toFixed(0)} in cash from passengers today.`
        },
        (totalFuel > 0 || totalExpenses > 0 || fleetPaidFuel > 0) && {
            emoji: '⛽',
            title: 'Expenses',
            text: `Driver paid fuel: ₹${driverPaidFuel.toFixed(0)}${fleetPaidFuel > 0 ? `. Fleet (you) paid: ₹${fleetPaidFuel.toFixed(0)} — this does NOT reduce driver's cash` : ''}${totalExpenses > totalFuel ? `. Other expenses: ₹${(totalExpenses - totalFuel).toFixed(0)}` : ''}. Total deducted from driver's cash: ₹${totalExpenses.toFixed(0)}.`
        },
        onlinePayments > 0 && {
            emoji: '📱',
            title: 'Online Payments',
            text: `₹${onlinePayments.toFixed(0)} was paid via UPI/online. This reduces the cash the driver has.`
        },
        {
            emoji: '🧮',
            title: 'Cash to Give Cashier',
            text: `Cash (₹${totalCash.toFixed(0)}) − Expenses (₹${totalExpenses.toFixed(0)}) − Online Pay (₹${onlinePayments.toFixed(0)}) − Salary (₹${driverSalary.toFixed(0)}) = ₹${cashInHand.toFixed(0)}. ${cashInHand >= 0 ? 'Driver needs to give this to cashier.' : 'Fleet needs to pay the driver this much.'}`
        },
        cashToCashier > 0 && {
            emoji: '🤝',
            title: 'Actual Handover',
            text: `${driverName} actually gave ₹${cashToCashier.toFixed(0)} to cashier. ${Math.abs(cashInHand - cashToCashier) < 1 ? 'Fully settled! ✓' : cashInHand > cashToCashier ? `Still ₹${(cashInHand - cashToCashier).toFixed(0)} pending.` : `Gave ₹${(cashToCashier - cashInHand).toFixed(0)} extra.`}`
        },
        previousBalance !== 0 && {
            emoji: '📒',
            title: 'Running Balance',
            text: `Previous balance was ₹${Math.abs(previousBalance).toFixed(0)} (${balanceLabel(previousBalance)}). After today, new balance is ₹${Math.abs(newTotalBalance).toFixed(0)} (${balanceLabel(newTotalBalance)}).`
        }
    ].filter(Boolean);

    return (
        <div className="glass-panel overflow-hidden">
            <button type="button" onClick={() => setOpen(!open)}
                className="w-full p-5 flex items-center justify-between hover:bg-brand-50/50 transition-colors">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-gradient-to-br from-brand-100 to-pink-100 rounded-xl">
                        <Info className="w-4 h-4 text-brand-600" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-extrabold text-brand-950">How is this calculated?</h4>
                        <p className="text-[10px] text-slate-400 font-semibold">Step-by-step breakdown in simple words</p>
                    </div>
                </div>
                {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {open && (
                <div className="px-5 pb-5 space-y-0 animate-fadeUp">
                    {steps.map((step, i) => (
                        <div key={i} className="flex gap-3 py-3 border-t border-brand-50 first:border-0">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center text-sm">
                                {step.emoji}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-extrabold text-brand-700 mb-0.5">
                                    Step {i + 1}: {step.title}
                                </h5>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    {step.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
