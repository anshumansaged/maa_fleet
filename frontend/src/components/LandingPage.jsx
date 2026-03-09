import { Link } from 'react-router-dom';
import { CarFront, Wallet, BarChart3, ArrowRight } from 'lucide-react';
import clsx from 'clsx';

const roles = [
    {
        title: 'Cashier',
        description: 'Log daily shift records, track earnings, and manage driver data.',
        icon: <Wallet className="w-7 h-7" />,
        path: '/cashier',
        gradient: 'from-brand-500 to-indigo-500',
        shadow: 'shadow-brand-500/30',
        bg: 'from-brand-50 to-indigo-50',
    },
    {
        title: 'Admin',
        description: 'View analytics, settle balances, and manage fleet expenses.',
        icon: <BarChart3 className="w-7 h-7" />,
        path: '/admin',
        gradient: 'from-pink-500 to-rose-500',
        shadow: 'shadow-pink-500/30',
        bg: 'from-pink-50 to-rose-50',
    },
];

export default function LandingPage() {
    return (
        <div className="min-h-[75vh] flex flex-col items-center justify-center animate-fadeUp">

            {/* Branding */}
            <div className="text-center mb-12 space-y-4">
                <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-brand-500/30 text-white transition-transform hover:scale-110 duration-300">
                    <CarFront className="w-10 h-10" strokeWidth={2} />
                </div>
                <h1 className="text-4xl font-black tracking-tight text-brand-950">
                    Maa<span className="text-brand-500">Fleet</span>
                </h1>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                    Fleet management made simple. Select your role to continue.
                </p>
            </div>

            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg">
                {roles.map(role => (
                    <Link key={role.title} to={role.path}
                        className="group glass-panel p-8 text-center space-y-5 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer relative overflow-hidden">

                        {/* Glow */}
                        <div className={clsx("absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br rounded-full blur-3xl opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity", role.bg)}></div>

                        <div className="relative z-10 space-y-4">
                            <div className={clsx("mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg text-white transition-transform group-hover:scale-110 duration-300", role.gradient, role.shadow)}>
                                {role.icon}
                            </div>
                            <h2 className="text-xl font-extrabold text-brand-950">{role.title}</h2>
                            <p className="text-xs text-slate-400 leading-relaxed">{role.description}</p>
                            <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-brand-600 group-hover:gap-3 transition-all">
                                Enter <ArrowRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
