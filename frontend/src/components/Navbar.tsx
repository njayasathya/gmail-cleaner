import React from 'react';
import {
  Mail, RefreshCw, Settings as SettingsIcon, LogOut,
  ShieldCheck, AlertCircle, Sparkles, Tag
} from 'lucide-react';
import { AuthStatus } from '../types';

interface NavbarProps {
  authStatus: AuthStatus;
  activeTab: 'senders' | 'unsubscribe' | 'smart';
  setActiveTab: (tab: 'senders' | 'unsubscribe' | 'smart') => void;
  onOpenSettings: () => void;
  onOpenLabels: () => void;
  onOpenScan: () => void;
  onLogout: () => void;
  onLogin: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  authStatus,
  activeTab,
  setActiveTab,
  onOpenSettings,
  onOpenLabels,
  onOpenScan,
  onLogout,
  onLogin
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 h-[72px] flex items-center justify-between gap-4">
        {/* Brand & Navigation */}
        <div className="flex items-center gap-7">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-white">Gmail Cleaner</span>
                <span className="text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Pro
                </span>
              </div>
              <p className="text-sm text-slate-400 hidden sm:block">
                Bulk Email Manager &amp; 1-Click Unsubscribe
              </p>
            </div>
          </div>

          {/* Primary Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('senders')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'senders'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Sender Analytics
            </button>
            <button
              onClick={() => setActiveTab('unsubscribe')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
                activeTab === 'unsubscribe'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <span>1-Click Unsubscribe</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </button>
            <button
              onClick={() => setActiveTab('smart')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'smart'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Smart Filters</span>
            </button>
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenScan}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Scan Inbox</span>
          </button>

          {authStatus.is_authenticated ? (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              {authStatus.picture ? (
                <img
                  src={authStatus.picture}
                  alt={authStatus.name || 'User'}
                  className="w-9 h-9 rounded-full border border-slate-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-200">
                  {authStatus.name ? authStatus.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <div className="hidden xl:block text-left">
                <div className="text-sm font-semibold text-slate-100 truncate max-w-[180px]">
                  {authStatus.name || 'Connected'}
                </div>
                <div className="text-xs text-slate-400 truncate max-w-[180px]">
                  {authStatus.email}
                </div>
              </div>
              <button
                onClick={onLogout}
                title="Disconnect Google Account"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {authStatus.is_configured ? (
                <button
                  onClick={onLogin}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-xl hover:bg-emerald-600/30 transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Connect Gmail</span>
                </button>
              ) : (
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500/30 transition"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Configure OAuth</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={onOpenLabels}
            title="Manage Gmail Labels"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
          >
            <Tag className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Labels</span>
          </button>

          <button
            onClick={onOpenSettings}
            title="App Settings & Setup"
            className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tablet / Mobile Navigation Bar */}
      <div className="lg:hidden flex border-t border-slate-800 bg-slate-950 px-3 py-1.5 gap-1.5">
        <button
          onClick={() => setActiveTab('senders')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg text-center transition ${
            activeTab === 'senders' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Senders
        </button>
        <button
          onClick={() => setActiveTab('unsubscribe')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg text-center transition ${
            activeTab === 'unsubscribe' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unsubscribe
        </button>
        <button
          onClick={() => setActiveTab('smart')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg text-center transition ${
            activeTab === 'smart' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Smart Filters
        </button>
      </div>
    </header>
  );
};
