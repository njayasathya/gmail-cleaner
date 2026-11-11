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
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 sm:p-7 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">App Configuration &amp; OAuth</h3>
              <p className="text-sm text-slate-400">Connect to Google Workspace or preview with demo data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Demo Mode Quick Start Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Instant Test / Demo Mode</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Want to preview the UI, batch actions, and analytics without Google Cloud API keys? Seed realistic sample data into SQLite.
            </p>
          </div>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold whitespace-nowrap transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding...' : 'Seed Demo Data'}
          </button>
        </div>

        {/* Google OAuth Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Google Cloud OAuth 2.0 Credentials</span>
            </div>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Google Cloud Console</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-3.5 text-sm">
            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Client ID</label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="123456789-abcdef.apps.googleusercontent.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5 font-medium">Client Secret</label>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="GOCSPX-..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-sm"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-200 text-sm">Quick Setup Instructions:</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400 leading-relaxed">
                <li>Create a project on Google Cloud Console and enable the <strong className="text-slate-200">Gmail API</strong>.</li>
                <li>Go to <strong className="text-slate-200">APIs &amp; Services &gt; OAuth consent screen &gt; Get started</strong>, choose <strong className="text-slate-200">External</strong>, complete setup, and add your email under <strong className="text-slate-200">Audience &gt; Test users</strong>.</li>
                <li>Open the <strong className="text-slate-200">Clients</strong> tab, click <strong className="text-slate-200">Create client</strong>, and choose <strong className="text-slate-200">Web application</strong>.</li>
                <li>
                  Add Authorized redirect URI:{' '}
                  <code className="bg-slate-900 px-1.5 py-0.5 rounded text-indigo-300">
                    http://localhost:8000/api/auth/callback
                  </code>
                </li>
              </ol>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-sm text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800 text-sm text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Credentials saved successfully! Click &ldquo;Connect Gmail&rdquo; to authenticate.</span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-md shadow-indigo-600/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Credentials'}
            </button>

            {authStatus.is_configured && !authStatus.is_authenticated && (
              <button
                type="button"
                onClick={onLogin}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white transition shadow-md shadow-emerald-600/30 flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Connect Gmail</span>
              </button>
            )}
          </div>
        </form>

        {/* Account Disconnect if authenticated */}
        {authStatus.is_authenticated && (
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-4">
            <div className="text-sm">
              <div className="font-semibold text-slate-200">Signed in as {authStatus.email}</div>
              <div className="text-xs text-slate-400">Access tokens stored locally in encrypted volume</div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-950 text-rose-300 hover:bg-rose-900 hover:text-white border border-rose-800 text-sm font-medium transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
