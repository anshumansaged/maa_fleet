import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, User, Wallet, Fuel, Send, Sparkles, Car, ToggleLeft, Plus, Trash2, ShieldCheck, Route } from 'lucide-react';
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
    const [fuelEntries, setFuelEntries] = useState([{ id: Date.now(), amount: '', type: 'CNG' }]);
    const [expenses, setExpenses] = useState({ otherExpenses: '', onlinePayments: '' });
    const [yatriTrips, setYatriTrips] = useState('');

    // Payment Logic
    const [cashToCashier, setCashToCashier] = useState('');

    useEffect(() => { fetchDrivers(); }, []);

    const fetchDrivers = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/drivers`);
            setDrivers(data);
            if (data.length > 0) setDriverId(data[0].id);
        } catch (error) { console.error('Failed to fetch drivers', error); }
        finally { setLoading(false); }
    };

    const togglePlatform = (id) => {
        setActivePlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const addFuelEntry = () => setFuelEntries([...fuelEntries, { id: Date.now(), amount: '', type: 'CNG' }]);
    const removeFuelEntry = (id) => setFuelEntries(fuelEntries.filter(f => f.id !== id));
    const updateFuelEntry = (id, field, value) => {
        setFuelEntries(fuelEntries.map(f => f.id === id ? { ...f, [field]: value } : f));
    }

    const v = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

    const selectedDriver = drivers.find(d => d.id === driverId);
    const driverPercentage = selectedDriver ? selectedDriver.salaryPercentage : 0.35;

    // Calculations
    const tStartKm = v(startKm);
    const tEndKm = v(endKm);
    const totalKm = (tEndKm > tStartKm) ? tEndKm - tStartKm : 0;

    const totalEarnings = activePlatforms.reduce((s, p) => s + v(earnings[p]), 0);

    // Auto Commissions
    const totalCommission = activePlatforms.reduce((s, p) => {
        const plat = ALL_PLATFORMS.find(x => x.id === p);
        return s + (plat?.hasComm ? v(commissions[p + 'Comm']) : 0);
    }, 0);

    const netEarnings = totalEarnings - totalCommission;

    // Auto Cash (Yatri, Rapido, Offline auto-match earnings)
    const getPlatformCash = (p) => {
        if (['offline', 'yatri', 'rapido'].includes(p)) return v(earnings[p]);
        return v(cash[p + 'Cash']);
    };
    const totalCash = activePlatforms.reduce((s, p) => s + getPlatformCash(p), 0);

    const totalFuel = fuelEntries.reduce((s, f) => s + v(f.amount), 0);
    const totalExpenses = totalFuel + v(expenses.otherExpenses);
    const onlinePayments = v(expenses.onlinePayments);

    const driverSalary = netEarnings * driverPercentage;

    let cashInHand = totalCash - totalExpenses - onlinePayments - driverSalary;
    let pendingSalary = 0; // Salary is always paid instantly from cash now

    // Mathematical Fix: If cash in hand is negative (Fleet owes driver), 
    // and the cashier PAYS the driver (cashToCashier is positive amount given to driver),
    // they offset each other.
    const remainingCash = cashInHand >= 0
        ? cashInHand - v(cashToCashier) // Driver has cash, gives some to cashier
        : cashInHand + v(cashToCashier); // Driver is owed cash, cashier gives them cash 

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
Comm: ₹${totalCommission} | Fuel: ₹${totalFuel}
Other: ₹${v(expenses.otherExpenses)} | Online Pay: ₹${onlinePayments}

*📊 Summary*
Salary (${(driverPercentage * 100).toFixed(0)}%): ₹${driverSalary.toFixed(2)} (Paid directly from cash)
Cash To Cashier: ₹${v(cashToCashier).toFixed(2)}
━━━━━━━━━━━━━━━━`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                driverId, carNumber, date,
                startKm: tStartKm, endKm: tEndKm, totalKm, yatriTrips: parseInt(yatriTrips) || 0,
                cashToCashier: v(cashToCashier),
                fuelDetails: fuelEntries.filter(f => v(f.amount) > 0).map(f => ({ amount: v(f.amount), type: f.type })),
                driverSalaryPaid: true, // Hardcoded: driver always takes salary

                uber: v(earnings.uber), inDrive: v(earnings.inDrive), yatri: v(earnings.yatri), rapido: v(earnings.rapido), offline: v(earnings.offline),

                uberComm: v(commissions.uberComm),
                yatriComm: v(commissions.yatriComm),

                uberCash: v(cash.uberCash), inDriveCash: v(cash.inDriveCash),
                yatriCash: getPlatformCash('yatri'), rapidoCash: getPlatformCash('rapido'), offlineCash: getPlatformCash('offline'),

                fuel: totalFuel, otherExpenses: v(expenses.otherExpenses), onlinePayments: v(expenses.onlinePayments)
            };

            await axios.post(`${API_URL}/records`, payload);
            setSuccess(true);
            window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank');
            setTimeout(() => setSuccess(false), 3000);

            // Reset Form heavily
            setEarnings({}); setCommissions({}); setCash({});
            setCashToCashier('');
            setStartKm(''); setEndKm('');
            setFuelEntries([{ id: Date.now(), amount: '', type: 'CNG' }]);
            setExpenses({ otherExpenses: '', onlinePayments: '' });
        } catch (error) { alert("Error saving record."); }
        finally { setSubmitting(false); }
    };

    if (loading) return (
        <div className="flex flex-col justify-center items-center h-[60vh] gap-5">
            <div className="w-14 h-14 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p className="font-semibold text-brand-600 text-sm animate-pulse">Loading fleet data...</p>
        </div>
    );

    const activePlatformData = ALL_PLATFORMS.filter(p => activePlatforms.includes(p.id));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 pb-10">
            <div className="xl:col-span-8">
                <form onSubmit={handleSubmit} className="glass-panel p-5 sm:p-8 md:p-10 space-y-0">

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
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="clean-input rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 text-sm shadow-sm w-full sm:w-auto" required />
                    </div>

                    {/* Section 1: Basic Info & KM Tracker */}
                    <div className="py-6 sm:py-8 border-b border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Route className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">1. Basic Info & KM Tracking</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 flex items-center gap-2"><User className="w-3.5 h-3.5" /> Driver</label>
                                <select value={driverId} onChange={e => setDriverId(e.target.value)} className="clean-input w-full rounded-2xl px-4 py-3 text-sm cursor-pointer" required>
                                    <option value="" disabled>Select driver...</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 flex items-center gap-2"><Car className="w-3.5 h-3.5" /> Vehicle</label>
                                <select value={carNumber} onChange={e => setCarNumber(e.target.value)} className="clean-input w-full rounded-2xl px-4 py-3 text-sm uppercase cursor-pointer" required>
                                    <option value="" disabled>Select car...</option>
                                    {PREDEFINED_CARS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5 border border-brand-100 bg-brand-50/30 p-4 rounded-2xl">
                                <label className="text-xs font-bold text-slate-500">Start KM</label>
                                <input type="number" value={startKm} onChange={e => setStartKm(e.target.value)} className="clean-input w-full rounded-xl px-4 py-2 text-sm bg-white" placeholder="0" />
                            </div>
                            <div className="space-y-1.5 border border-brand-100 bg-brand-50/30 p-4 rounded-2xl">
                                <label className="text-xs font-bold text-slate-500">End KM</label>
                                <input type="number" value={endKm} onChange={e => setEndKm(e.target.value)} className="clean-input w-full rounded-xl px-4 py-2 text-sm bg-white" placeholder="0" />
                                <div className="text-right text-xs font-extrabold text-brand-600 mt-2">Total Distance: {totalKm} km</div>
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
                                                value={earnings[p.id] || ''} onChange={e => setEarnings({ ...earnings, [p.id]: e.target.value })}
                                                className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-brand-400" />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] items-center flex justify-between font-bold text-slate-400 uppercase">
                                                Cash Received {['yatri', 'rapido', 'offline'].includes(p.id) && <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 rounded">Auto</span>}
                                            </label>
                                            <input type="number" step="0.01" placeholder="0.00"
                                                value={['yatri', 'rapido', 'offline'].includes(p.id) ? (earnings[p.id] || '') : (cash[p.id + 'Cash'] || '')}
                                                onChange={e => !['yatri', 'rapido', 'offline'].includes(p.id) && setCash({ ...cash, [p.id + 'Cash']: e.target.value })}
                                                disabled={['yatri', 'rapido', 'offline'].includes(p.id)}
                                                className={clsx("clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold",
                                                    ['yatri', 'rapido', 'offline'].includes(p.id) ? "bg-emerald-50 text-emerald-700 border-dashed" : "focus:!border-emerald-400")} />
                                        </div>

                                        {/* Custom Manual Commission */}
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

                    {/* Expenses & Fuel Arrays */}
                    <div className="py-6 sm:py-8 border-b border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Fuel className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">4. Expenses & Fuel</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Fuel Dynamic Array */}
                            <div className="bg-brand-50/30 border border-brand-100 rounded-2xl p-4 sm:p-5 space-y-3">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-slate-700">Fuel Entries</h4>
                                    <button type="button" onClick={addFuelEntry} className="text-xs font-bold text-brand-600 bg-brand-100 hover:bg-brand-200 px-3 py-1.5 rounded-lg flex items-center gap-1 transition">
                                        <Plus className="w-3.5 h-3.5" /> Add
                                    </button>
                                </div>
                                {fuelEntries.map((f, i) => (
                                    <div key={f.id} className="flex gap-2 items-center">
                                        <select value={f.type} onChange={e => updateFuelEntry(f.id, 'type', e.target.value)} className="clean-input w-1/3 rounded-xl px-3 py-2 text-sm font-bold bg-white text-slate-600">
                                            <option value="CNG">CNG</option>
                                            <option value="Petrol">Petrol</option>
                                        </select>
                                        <input type="number" placeholder="Amount (₹)" value={f.amount} onChange={e => updateFuelEntry(f.id, 'amount', e.target.value)} className="clean-input w-full rounded-xl px-3 py-2 text-sm font-bold focus:!border-rose-400" />
                                        {fuelEntries.length > 1 && (
                                            <button type="button" onClick={() => removeFuelEntry(f.id)} className="p-2 text-slate-300 hover:text-rose-500 transition hover:bg-rose-50 rounded-xl">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <div className="text-right text-xs font-extrabold text-brand-600 mt-2">Total Fuel: ₹{totalFuel}</div>
                            </div>

                            {/* Other Exps */}
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

                    {/* Final Cashier Exchange View */}
                    <div className="py-6 sm:py-8 border-brand-50 space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">5. Payment Processing & Cashier Handover</span>
                        </div>

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
                    {/* Summary */}
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
                    </div>
                </div>
            </div>
        </div>
    );
}

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
