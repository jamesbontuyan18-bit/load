import React from 'react';
import { 
  Zap, 
  Smartphone, 
  Search, 
  Clock, 
  HelpCircle, 
  ShieldCheck, 
  LogIn, 
  LogOut, 
  User, 
  PhoneCall,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SystemSettings } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  settings: SystemSettings | null;
  onOpenAuth: () => void;
  onOpenTrackModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  settings,
  onOpenAuth,
  onOpenTrackModal,
}) => {
  const { currentUser, userProfile, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200/60 shadow-xs">
      {/* Top Announcement Bar */}
      {settings?.announcement && (
        <div className="bg-amber-400 text-slate-900 text-xs font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 overflow-hidden shadow-xs">
          <Zap className="w-3.5 h-3.5 fill-slate-900 text-slate-900 shrink-0 animate-pulse" />
          <span className="truncate">{settings.announcement}</span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 bg-black/10 rounded text-[10px] font-bold uppercase tracking-wider">
            Automated
          </span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div 
            onClick={() => setCurrentTab('buy')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                  James <span className="text-amber-500">Load</span> Services
                </span>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  PH Reseller
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Direct Prepaid E-Load & Network Promos
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => setCurrentTab('buy')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                currentTab === 'buy'
                  ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Buy Load
            </button>

            <button
              onClick={onOpenTrackModal}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Search className="w-4 h-4 text-amber-600" />
              Track Order
            </button>

            <button
              onClick={() => setCurrentTab('history')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                currentTab === 'history'
                  ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              My Orders
            </button>

            <button
              onClick={() => setCurrentTab('support')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                currentTab === 'support'
                  ? 'bg-amber-50 text-amber-700 font-bold border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              Support
            </button>

            {isAdmin && (
              <button
                onClick={() => setCurrentTab('admin')}
                className={`px-3.5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${
                  currentTab === 'admin'
                    ? 'bg-slate-900 text-amber-400 shadow-sm'
                    : 'bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 border border-amber-300/80'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Admin Portal
              </button>
            )}
          </nav>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <div 
                  onClick={() => setCurrentTab('history')}
                  className="cursor-pointer flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs uppercase">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0) : (currentUser.email?.charAt(0) || 'U')}
                  </div>
                  <div className="hidden lg:block text-xs">
                    <p className="font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                      {userProfile?.displayName || currentUser.email?.split('@')[0]}
                    </p>
                    <span className="text-[10px] text-slate-500 uppercase font-medium">
                      {isAdmin ? 'Admin' : 'Customer'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => signOut()}
                  title="Sign Out"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm shadow-amber-400/30 transition-all flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </button>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1.5 shadow-lg">
          <button
            onClick={() => { setCurrentTab('buy'); setMobileMenuOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 text-slate-700"
          >
            <Smartphone className="w-4 h-4 text-amber-600" />
            Buy Load
          </button>
          <button
            onClick={() => { onOpenTrackModal(); setMobileMenuOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 text-slate-700"
          >
            <Search className="w-4 h-4 text-amber-600" />
            Track Order
          </button>
          <button
            onClick={() => { setCurrentTab('history'); setMobileMenuOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 text-slate-700"
          >
            <Clock className="w-4 h-4 text-amber-600" />
            My Orders
          </button>
          <button
            onClick={() => { setCurrentTab('support'); setMobileMenuOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 text-slate-700"
          >
            <HelpCircle className="w-4 h-4 text-amber-600" />
            Customer Support
          </button>
          {isAdmin && (
            <button
              onClick={() => { setCurrentTab('admin'); setMobileMenuOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 bg-slate-900 text-amber-400"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Admin Portal
            </button>
          )}
        </div>
      )}
    </header>
  );
};
