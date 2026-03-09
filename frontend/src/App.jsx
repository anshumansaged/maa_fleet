import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import DriverForm from './components/DriverForm';
import AdminPanel from './components/AdminPanel';
import { CarFront } from 'lucide-react';
import clsx from 'clsx';

function NavLinks() {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';
  return (
    <div className="flex items-center p-1 bg-white/60 backdrop-blur-xl rounded-full border border-white/80 shadow-sm">
      <Link
        to="/"
        className={clsx(
          "px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300",
          !isAdmin
            ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
            : "text-slate-500 hover:text-brand-600"
        )}
      >
        Dashboard
      </Link>
      <Link
        to="/admin"
        className={clsx(
          "px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300",
          isAdmin
            ? "bg-brand-600 text-white shadow-md shadow-brand-500/25"
            : "text-slate-500 hover:text-brand-600"
        )}
      >
        Admin
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen font-sans selection:bg-brand-200 selection:text-brand-900 pb-20 relative">

        {/* Floating Glass Header */}
        <nav className="fixed top-5 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="glass-panel px-6 py-3 flex justify-between items-center !rounded-full">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-pink-500 flex items-center justify-center shadow-lg shadow-brand-500/30 text-white transition-transform hover:scale-110 duration-300">
                  <CarFront className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <h1 className="font-extrabold text-xl tracking-tight text-brand-950">
                  Maa<span className="text-brand-500">Fleet</span>
                </h1>
              </div>
              <NavLinks />
            </div>
          </div>
        </nav>

        <div className="pt-28"></div>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 animate-fadeUp">
          <Routes>
            <Route path="/" element={<DriverForm />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
