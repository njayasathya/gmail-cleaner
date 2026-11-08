import React from 'react';
import { Mail, RefreshCw, Settings as SettingsIcon, LogOut, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { AuthStatus } from '../types';

interface NavbarProps {
  authStatus: AuthStatus;
  activeTab: 'senders' | 'unsubscribe' | 'smart';
  setActiveTab: (tab: 'senders' | 'unsubscribe' | 'smart') => void;
  onOpenSettings: () => void;
  onOpenScan: () => void;
  onLogout: () => void;
  onLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  authStatus,
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenScan,
  onLogout,
  onLogin
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">Gmail Cleaner</span>
                <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Docker
                </span>
              </div>
              <p className="text-xs text-slate-400">Smart Bulk Cleaner &amp; 1-Click Unsubscribe</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('senders')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === 'senders'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              Sender Analytics
            </button>
            <button
              onClick={() => setActiveTab('unsubscribe')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'unsubscribe'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>1-Click Unsubscribe</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
            <button
              onClick={() => setActiveTab('smart')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'smart'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Filters</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Scan Action */}
          <button
            onClick={onOpenScan}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Scan Inbox</span>
          </button>

          {/* User / Auth Status */}
          {authStatus.is_authenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              {authStatus.picture ? (
                <img
                  src={authStatus.picture}
                  alt={authStatus.name || 'User'}
                  className="w-8 h-8 rounded-full border border-slate-700"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-300">
                  {authStatus.name ? authStatus.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden lg:block text-left text-xs">
                <div className="font-medium text-slate-200 truncate max-w-[130px]">{authStatus.name || 'Connected'}</div>
                <div className="text-[11px] text-slate-400 truncate max-w-[130px]">{authStatus.email}</div>
              </div>
              <button
                onClick={onLogout}
                title="Disconnect Google Account"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {authStatus.is_configured ? (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Connect Gmail</span>
                </button>
              ) : (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Configure OAuth</span>
                </button>
              )}
            </div>
          )}

          {/* Settings Modal Toggle */}
          <button
            onClick={onOpenSettings}
            title="App Settings &amp; Setup"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile navigation tab bar */}
      <div className="md:hidden flex border-t border-slate-800 bg-slate-950 px-2 py-1 gap-1">
        <button
          onClick={() => setActiveTab('senders')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'senders' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Senders
        </button>
        <button
          onClick={() => setActiveTab('unsubscribe')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'unsubscribe' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Unsubscribe
        </button>
        <button
          onClick={() => setActiveTab('smart')}
          className={`flex-1 py-1.5 text-xs font-medium rounded text-center ${
            activeTab === 'smart' ? 'bg-indigo-600 text-white' : 'text-slate-400'
          }`}
        >
          Smart Clean
        </button>
      </div>
    </header>
  );
};
