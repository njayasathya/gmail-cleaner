import React, { useState } from 'react';
import {
  Settings as SettingsIcon, X, Key, ShieldCheck,
  ExternalLink, Sparkles, Check, AlertCircle, Trash2
} from 'lucide-react';
import { AuthStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authStatus: AuthStatus;
  onSaveCredentials: (clientId: string, clientSecret: string) => Promise<void>;
  onSeedDemoData: () => Promise<void>;
  onLogout: () => void;
  onLogin: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  authStatus,
  onSaveCredentials,
  onSeedDemoData,
  onLogout,
  onLogin
}) => {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setErrorMsg('Both Client ID and Client Secret are required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');
    try {
      await onSaveCredentials(clientId.trim(), clientSecret.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await onSeedDemoData();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to seed sample data.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">App Configuration &amp; OAuth</h3>
              <p className="text-xs text-slate-400">Connect to Google Workspace or preview with mock data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Quick Start Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-800/50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Instant Test / Demo Mode</span>
            </div>
            <p className="text-xs text-slate-400">
              Want to test the UI, batch actions, and analytics right away without setting up Google Cloud API keys? Seed realistic sample data into SQLite.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold whitespace-nowrap transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        </div>

        {/* Google OAuth Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Google Cloud OAuth 2.0 Credentials</span>
            </div>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-abcdef.apps.googleusercontent.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300">Quick Setup Instructions:</div>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-400">
                <li>Create a project on Google Cloud Console and enable the <strong>Gmail API</strong>.</li>
                <li>Go to <strong>APIs &amp; Services &gt; Credentials</strong> and create an <strong>OAuth Client ID</strong>.</li>
                <li>Application type: <strong>Web application</strong>.</li>
                <li>Add Authorized redirect URI: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">http://localhost:8000/api/auth/callback</code></li>
              </ol>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Credentials saved successfully! Click "Connect Gmail" to authenticate.</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Credentials'}
            </button>

            {authStatus.is_configured && !authStatus.is_authenticated && (
              <button
                type="button"
                onClick={onLogin}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition shadow-md shadow-emerald-600/30 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Connect Gmail</span>
              </button>
            )}
          </div>
        </form>

        {/* Account Disconnect if authenticated */}
        {authStatus.is_authenticated && (
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="text-xs">
              <div className="font-semibold text-slate-300">Signed in as {authStatus.email}</div>
              <div className="text-[11px] text-slate-500">Access tokens stored in encrypted volume</div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950 text-rose-400 hover:bg-rose-900 hover:text-white border border-rose-800 text-xs font-medium transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
