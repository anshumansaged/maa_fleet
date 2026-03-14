import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DriverForm from './components/DriverForm';
import AdminPanel from './components/AdminPanel';
import PinGate from './components/PinGate';
import { CarFront, BarChart3, LogOut, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';

const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '5678';

function NavLinks({ darkMode, setDarkMode }) {
  const location = useLocation();
  const path = location.pathname;
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="flex items-center p-0.5 sm:p-1 bg-white/60 backdrop-blur-xl rounded-full border border-white/80 shadow-sm">
        <Link
          to="/"
          className={clsx(
            "px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300",
            path === '/'
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
              : "text-slate-500 hover:text-brand-600"
          )}
        >
          Cashier
        </Link>
        <Link
          to="/admin"
          className={clsx(
            "px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-full transition-all duration-300",
            path === '/admin'
              ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
              : "text-slate-500 hover:text-brand-600"
          )}
        >
          Admin
        </Link>
      </div>
      {/* Dark Mode Toggle */}
      <button onClick={() => setDarkMode(!darkMode)}
        className="p-2 sm:p-2.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all active:scale-90" title="Toggle Dark Mode">
        {darkMode ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
      </button>
      <button onClick={() => {
        sessionStorage.clear();
        window.location.reload();
      }} className="p-2 sm:p-2.5 rounded-full bg-white/60 backdrop-blur-xl border border-white/80 shadow-sm text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Lock">
        <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('maafleet_dark') === 'true';
  });

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    localStorage.setItem('maafleet_dark', darkMode);
  }, [darkMode]);

  return (
    <BrowserRouter>
      <div className="min-h-screen font-sans selection:bg-brand-200 selection:text-brand-900 pb-20 relative">

        {/* Floating Glass Header */}
        <nav className="fixed top-3 sm:top-5 left-0 right-0 z-50 px-3 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="glass-panel px-3 sm:px-6 py-2.5 sm:py-3 flex justify-between items-center !rounded-full">
              <Link to="/" className="flex items-center space-x-2 sm:space-x-3 group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-lg shadow-brand-500/30 text-white transition-transform group-hover:scale-110 duration-300">
                  <CarFront className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2.5} />
                </div>
                <h1 className="font-extrabold text-base sm:text-xl tracking-tight text-brand-950">
                  Maa<span className="text-brand-500">Fleet</span>
                </h1>
              </Link>
              <NavLinks darkMode={darkMode} setDarkMode={setDarkMode} />
            </div>
          </div>
        </nav>

        <div className="pt-20 sm:pt-28"></div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 animate-fadeUp">
          <Routes>
            <Route path="/" element={<DriverForm />} />
            <Route path="/admin" element={
              <PinGate pin={ADMIN_PIN} title="Admin Login" icon={<BarChart3 className="w-6 h-6" />}>
                <AdminPanel />
              </PinGate>
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
