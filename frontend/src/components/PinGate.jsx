import { useState } from 'react';
import { CarFront, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export default function PinGate({ pin, title, icon, children }) {
    const storageKey = `maafleet_auth_${title.toLowerCase().replace(/\s/g, '_')}`;
    const [authenticated, setAuthenticated] = useState(() => sessionStorage.getItem(storageKey) === 'true');
    const [inputPin, setInputPin] = useState('');
    const [error, setError] = useState(false);
    const [shake, setShake] = useState(false);

    if (authenticated) return children;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputPin === pin) {
            sessionStorage.setItem(storageKey, 'true');
            setAuthenticated(true);
        } else {
            setError(true);
            setShake(true);
            setInputPin('');
            setTimeout(() => setShake(false), 600);
            setTimeout(() => setError(false), 3000);
        }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center animate-fadeUp">
            <form onSubmit={handleSubmit}
                className={clsx(
                    "glass-panel w-full max-w-sm p-10 text-center space-y-8 transition-transform",
                    shake && "animate-[shake_0.5s_ease-in-out]"
                )}>

                {/* Logo */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-xl shadow-brand-500/30 text-white">
                        <CarFront className="w-8 h-8" strokeWidth={2} />
                    </div>
                    <h1 className="font-extrabold text-2xl tracking-tight text-brand-950">
                        Maa<span className="text-brand-500">Fleet</span>
                    </h1>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                        {icon || <Lock className="w-6 h-6" />}
                    </div>
                    <h2 className="text-lg font-extrabold text-brand-950">{title}</h2>
                    <p className="text-sm text-slate-400">Enter your PIN to continue</p>
                </div>

                {/* PIN Input */}
                <div className="space-y-3">
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={10}
                        value={inputPin}
                        onChange={e => setInputPin(e.target.value)}
                        placeholder="• • • •"
                        autoFocus
                        className="clean-input w-full rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.5em] placeholder:tracking-[0.3em] placeholder:text-slate-300 focus:!border-brand-400 focus:!shadow-[0_0_0_4px_rgba(99,102,241,0.12)]"
                    />

                    {error && (
                        <div className="flex items-center justify-center gap-2 text-rose-500 text-sm font-bold animate-fadeUp">
                            <AlertTriangle className="w-4 h-4" />
                            Incorrect PIN
                        </div>
                    )}
                </div>

                {/* Submit */}
                <button type="submit" disabled={!inputPin}
                    className={clsx(
                        "w-full py-4 rounded-2xl font-bold text-sm transition-all transform active:scale-95 flex justify-center items-center gap-2.5 shadow-xl",
                        !inputPin
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
                            : "bg-gradient-to-r from-brand-600 to-pink-500 text-white shadow-brand-500/30 hover:-translate-y-1 hover:shadow-2xl"
                    )}>
                    <ShieldCheck className="w-5 h-5" />
                    Unlock
                </button>
            </form>
        </div>
    );
}
