import { useState, useEffect } from 'react';
import axios from 'axios';
import { Calculator, CheckCircle2, User, Wallet, DollarSign, Fuel, Send, Sparkles, TrendingUp, Car, Zap, ToggleLeft } from 'lucide-react';
import clsx from 'clsx';

const API_URL = 'http://localhost:5005/api';
const PREDEFINED_CARS = ['3905', '4030', 'ev2335'];

const ALL_PLATFORMS = [
    { id: 'uber', label: 'Uber', hasComm: true },
    { id: 'inDrive', label: 'InDrive', hasComm: false },
    { id: 'yatri', label: 'Yatri', hasComm: true },
    { id: 'rapido', label: 'Rapido', hasComm: false },
    { id: 'offline', label: 'Offline', hasComm: false },
];

export default function DriverForm() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const [driverId, setDriverId] = useState('');
    const [carNumber, setCarNumber] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Toggle-able platforms
    const [activePlatforms, setActivePlatforms] = useState(['uber', 'offline']);

    const [earnings, setEarnings] = useState({});
    const [commissions, setCommissions] = useState({});
    const [cash, setCash] = useState({});
    const [expenses, setExpenses] = useState({ fuel: '', otherExpenses: '', onlinePayments: '' });
    useEffect(() => { fetchDrivers(); }, []);

    const fetchDrivers = async () => {
        try {
            const { data } = await axios.get(`${API_URL}/drivers`);
            setDrivers(data);
            if (data.length > 0) setDriverId(data[0].id);
        } catch (error) { console.error('Failed to fetch drivers', error); }
        finally { setLoading(false); }
    };

    const handleCreateDriver = async () => {
        const name = prompt("Enter new driver name:");
        if (!name) return;
        const phone = prompt("Phone (optional):");
        const perc = prompt("Salary % (e.g. 0.35 for 35%):", "0.35");
        try {
            await axios.post(`${API_URL}/drivers`, { name, phone, salaryPercentage: parseFloat(perc) });
            fetchDrivers();
        } catch (e) { alert("Failed to add driver"); }
    };

    const togglePlatform = (id) => {
        setActivePlatforms(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const v = (s) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };

    const selectedDriver = drivers.find(d => d.id === driverId);
    const driverPercentage = selectedDriver ? selectedDriver.salaryPercentage : 0.35;

    // Calculations only on active platforms
    const totalEarnings = activePlatforms.reduce((s, p) => s + v(earnings[p]), 0);
    const totalCommission = activePlatforms.reduce((s, p) => {
        const plat = ALL_PLATFORMS.find(x => x.id === p);
        return s + (plat?.hasComm ? v(commissions[p + 'Comm']) : 0);
    }, 0);
    const netEarnings = totalEarnings - totalCommission;

    // Sync Offline Cash with Offline Earnings
    const effectiveOfflineCash = v(earnings.offline);
    const totalCash = activePlatforms.reduce((s, p) => {
        if (p === 'offline') return s + effectiveOfflineCash;
        return s + v(cash[p + 'Cash']);
    }, 0);

    const totalExpenses = v(expenses.fuel) + v(expenses.otherExpenses);
    const onlinePayments = v(expenses.onlinePayments);
    const driverSalary = netEarnings * driverPercentage;

    let cashInHand = totalCash - totalExpenses - onlinePayments;
    const pendingSalary = driverSalary; // Always fully pending on the daily record level now

    const generateWhatsAppMessage = () => {
        const driverName = selectedDriver?.name || 'Unknown';
        const platformLines = activePlatforms.map(p => {
            const plat = ALL_PLATFORMS.find(x => x.id === p);
            return `${plat.label}: ₹${v(earnings[p])}`;
        }).join('\n');

        return encodeURIComponent(`*Daily Summary - Maa Fleet* 🚗
Date: ${date} | Driver: *${driverName}* | Car: *${carNumber}*
━━━━━━━━━━━━━━━━
*💰 Earnings*
${platformLines}
*Gross: ₹${totalEarnings}*

*⛽ Deductions*
Commissions: ₹${totalCommission} | Fuel: ₹${v(expenses.fuel)}
Other: ₹${v(expenses.otherExpenses)} | Online: ₹${onlinePayments}

*📊 Summary*
Net: ₹${netEarnings.toFixed(2)}
Driver (${(driverPercentage * 100).toFixed(0)}%): ₹${driverSalary.toFixed(2)}
✨ *Cash in Hand: ₹${cashInHand.toFixed(2)}*`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            // Build full payload with 0s for inactive platforms
            const payload = {
                driverId, carNumber, date,
                uber: v(earnings.uber), inDrive: v(earnings.inDrive), yatri: v(earnings.yatri), rapido: v(earnings.rapido), offline: v(earnings.offline),
                uberComm: v(commissions.uberComm), yatriComm: v(commissions.yatriComm),
                uberCash: v(cash.uberCash), inDriveCash: v(cash.inDriveCash), yatriCash: v(cash.yatriCash), rapidoCash: v(cash.rapidoCash), offlineCash: effectiveOfflineCash,
                fuel: v(expenses.fuel), otherExpenses: v(expenses.otherExpenses), onlinePayments: v(expenses.onlinePayments)
            };

            await axios.post(`${API_URL}/records`, payload);
            setSuccess(true);
            window.open(`https://wa.me/?text=${generateWhatsAppMessage()}`, '_blank');
            setTimeout(() => setSuccess(false), 3000);

            setEarnings({}); setCommissions({}); setCash({});
            setExpenses({ fuel: '', otherExpenses: '', onlinePayments: '' });
            setCarNumber('');
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

            {/* FORM */}
            <div className="xl:col-span-8">
                <form onSubmit={handleSubmit} className="glass-panel p-8 sm:p-10 space-y-0">

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-8 border-b border-brand-100">
                        <div>
                            <h2 className="text-2xl font-extrabold text-brand-950 flex items-center gap-3">
                                <span className="p-3 bg-gradient-to-br from-brand-100 to-pink-100 rounded-2xl">
                                    <Calculator className="w-6 h-6 text-brand-600" />
                                </span>
                                New Shift Record
                            </h2>
                            <p className="text-slate-400 mt-2 text-sm">Select platforms used today, then fill in only what applies.</p>
                        </div>
                        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="clean-input rounded-2xl px-5 py-3 text-sm shadow-sm" required />
                    </div>

                    {/* Driver & Car */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-8 border-b border-brand-50">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-2">
                                <User className="w-3.5 h-3.5" /> Driver
                            </label>
                            <div className="flex gap-2">
                                <select value={driverId} onChange={e => setDriverId(e.target.value)} className="clean-input w-full rounded-2xl px-4 py-3 text-sm appearance-none cursor-pointer" required>
                                    <option value="" disabled>Select driver...</option>
                                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({(d.salaryPercentage * 100).toFixed(0)}%)</option>)}
                                </select>
                                <button type="button" onClick={handleCreateDriver} className="px-4 py-3 bg-white border border-gray-200 text-brand-600 shadow-sm rounded-2xl text-sm font-bold transition-all hover:shadow-md hover:border-brand-300 hover:-translate-y-0.5 whitespace-nowrap active:scale-95">
                                    + New
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-brand-400 uppercase tracking-wider flex items-center gap-2">
                                <Car className="w-3.5 h-3.5" /> Vehicle
                            </label>
                            <select value={carNumber} onChange={e => setCarNumber(e.target.value)} className="clean-input w-full rounded-2xl px-4 py-3 text-sm appearance-none uppercase cursor-pointer" required>
                                <option value="" disabled>Select car...</option>
                                {PREDEFINED_CARS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Platform Toggles */}
                    <div className="py-6 border-b border-brand-50">
                        <div className="flex items-center gap-2 mb-4">
                            <ToggleLeft className="w-4 h-4 text-brand-400" />
                            <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Active Platforms Today</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {ALL_PLATFORMS.map(p => (
                                <button key={p.id} type="button" onClick={() => togglePlatform(p.id)}
                                    className={clsx(
                                        "px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 border-2 active:scale-95",
                                        activePlatforms.includes(p.id)
                                            ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20"
                                            : "bg-white text-slate-400 border-gray-200 hover:border-brand-300 hover:text-brand-600"
                                    )}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic Data Grid — only active platforms */}
                    {activePlatformData.length > 0 ? (
                        <div className="py-8 space-y-6">
                            {/* Earnings + Cash in a responsive table-like layout */}
                            <div className="surface-card p-6 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-bold text-brand-400 uppercase tracking-wider border-b border-brand-50">
                                            <th className="text-left pb-3">Platform</th>
                                            <th className="text-right pb-3 pl-4">Earned (₹)</th>
                                            <th className="text-right pb-3 pl-4">Cash (₹)</th>
                                            <th className="text-right pb-3 pl-4">Commission (₹)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-50">
                                        {activePlatformData.map(p => (
                                            <tr key={p.id} className="group">
                                                <td className="py-3 font-bold text-slate-700 group-hover:text-brand-600 transition-colors">{p.label}</td>
                                                <td className="py-3 pl-4">
                                                    <input type="number" step="0.01" placeholder="0.00"
                                                        value={earnings[p.id] || ''} onChange={e => setEarnings({ ...earnings, [p.id]: e.target.value })}
                                                        className="clean-input w-full max-w-[120px] rounded-xl px-3 py-2 text-right font-bold ml-auto block focus:!border-emerald-400 focus:!shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
                                                </td>
                                                <td className="py-3 pl-4">
                                                    {p.id === 'offline' ? (
                                                        <div className="relative">
                                                            <input type="number" value={earnings.offline || ''} disabled
                                                                className="clean-input w-full max-w-[120px] rounded-xl px-3 py-2 text-right font-bold ml-auto block bg-brand-50/50 text-slate-400 border-dashed cursor-not-allowed" />
                                                        </div>
                                                    ) : (
                                                        <input type="number" step="0.01" placeholder="0.00"
                                                            value={cash[p.id + 'Cash'] || ''} onChange={e => setCash({ ...cash, [p.id + 'Cash']: e.target.value })}
                                                            className="clean-input w-full max-w-[120px] rounded-xl px-3 py-2 text-right font-bold ml-auto block focus:!border-amber-400 focus:!shadow-[0_0_0_4px_rgba(251,191,36,0.12)]" />
                                                    )}
                                                </td>
                                                <td className="py-3 pl-4">
                                                    {p.hasComm ? (
                                                        <input type="number" step="0.01" placeholder="0.00"
                                                            value={commissions[p.id + 'Comm'] || ''} onChange={e => setCommissions({ ...commissions, [p.id + 'Comm']: e.target.value })}
                                                            className="clean-input w-full max-w-[120px] rounded-xl px-3 py-2 text-right font-bold ml-auto block focus:!border-violet-400 focus:!shadow-[0_0_0_4px_rgba(167,139,250,0.12)]" />
                                                    ) : (
                                                        <span className="text-slate-300 text-xs block text-right">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Expenses */}
                            <div className="surface-card p-5">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-xl bg-rose-100 text-rose-600"><Fuel className="w-5 h-5" /></div>
                                    <h3 className="text-sm font-extrabold text-slate-800">Expenses</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[{ key: 'fuel', label: 'Fuel' }, { key: 'otherExpenses', label: 'Other Expenses' }, { key: 'onlinePayments', label: 'Digital / Online Pay' }].map(item => (
                                        <div key={item.key} className="space-y-1.5">
                                            <label className="text-xs font-semibold text-slate-400">{item.label}</label>
                                            <input type="number" step="0.01" placeholder="0.00"
                                                value={expenses[item.key]} onChange={e => setExpenses({ ...expenses, [item.key]: e.target.value })}
                                                className="clean-input w-full rounded-xl px-3 py-2.5 text-sm font-bold focus:!border-rose-400 focus:!shadow-[0_0_0_4px_rgba(251,113,133,0.12)]" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-16 text-center text-slate-400">
                            <p className="text-base font-semibold">Select at least one platform above to start entering data.</p>
                        </div>
                    )}

                    {/* Bottom Controls */}
                    <div className="py-6 border-t border-brand-100 flex justify-end">
                        <button type="submit" disabled={submitting || !driverId || !carNumber || activePlatformData.length === 0}
                            className={clsx("md:w-64 py-4 rounded-2xl font-bold text-sm transition-all transform active:scale-95 flex justify-center items-center gap-2.5 shadow-xl",
                                submitting || !driverId || !carNumber || activePlatformData.length === 0
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                                    : "bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-brand-500/30 hover:-translate-y-1 hover:shadow-2xl")}>
                            {success ? <><Sparkles className="w-5 h-5" /> Synced!</> : submitting ? 'Uploading...' : <><Send className="w-5 h-5" /> Submit & Share</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* SIDEBAR */}
            <div className="xl:col-span-4">
                <div className="sticky top-28 space-y-6">
                    {/* Hero Number */}
                    <div className="glass-panel p-8 text-center relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-brand-300/40 to-pink-300/40 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="mx-auto w-14 h-14 bg-gradient-to-br from-brand-500 to-pink-500 rounded-2xl shadow-lg shadow-brand-500/30 flex items-center justify-center mb-5 transition-transform hover:scale-110 duration-300">
                                <Wallet className="w-7 h-7 text-white" />
                            </div>
                            <p className="text-xs font-bold text-brand-400 uppercase tracking-[0.2em] mb-3">Cash In Hand</p>
                            <p className="text-5xl font-black bg-gradient-to-r from-brand-700 via-brand-500 to-pink-500 bg-clip-text text-transparent tracking-tighter">
                                ₹{cashInHand.toFixed(2)}
                            </p>
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="glass-panel p-6 space-y-5">
                        <Section title="Revenue">
                            <Row label="Gross Earnings" value={totalEarnings} />
                            <Row label="Commissions" value={totalCommission} negative dim />
                            <div className="h-px bg-brand-100 my-1"></div>
                            <Row label="Net Earnings" value={netEarnings} highlight />
                        </Section>
                        <Section title={`Driver Pay (${(driverPercentage * 100).toFixed(0)}%)`}>
                            <Row label="Salary" value={driverSalary} />
                            <Row label="Pending" value={pendingSalary} warning={pendingSalary > 0} />
                        </Section>
                        <Section title="Deductions">
                            <Row label="Total Cash" value={totalCash} />
                            <Row label="Fuel & Exp" value={totalExpenses} negative dim />
                            <Row label="Online Pay" value={onlinePayments} negative dim />
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
            <span className={clsx("font-bold tabular-nums", highlight && "text-brand-700 text-base", warning && "text-amber-600", rose && "text-rose-500", dim && "text-slate-400")}>
                {negative ? '−' : ''}₹{Math.abs(value).toFixed(2)}
            </span>
        </div>
    );
}
