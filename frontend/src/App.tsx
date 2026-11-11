import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X, Sparkles } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { SendersTable } from './components/SendersTable';
import { UnsubscribeCenter } from './components/UnsubscribeCenter';
import { SmartFilterModal } from './components/SmartFilterModal';
import { LabelManagerModal } from './components/LabelManagerModal';
import { JobProgressModal } from './components/JobProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { ScanModal } from './components/ScanModal';
import { EmailInspectorDrawer } from './components/EmailInspectorDrawer';

import {
  fetchAuthStatus, fetchStats, fetchSenders, fetchLabels,
  triggerScan, bulkTrash, bulkPermanentDelete, bulkArchive,
  bulkMarkRead, bulkMarkImportant, bulkApplyLabel, unsubscribeSingle,
  unsubscribeBulk, createLabel, deleteLabel, cancelJob,
  streamJob, fetchLoginUrl, logout, saveCredentials, seedDemoData,
  resetScanDatabase
} from './services/api';

import {
  Sender, StatsResponse, AuthStatus, JobProgress, LabelInfo, ToastNotice
} from './types';

export const App: React.FC = () => {
  // Navigation & tabs
  const [activeTab, setActiveTab] = useState<'senders' | 'unsubscribe' | 'smart'>('senders');

  // App state
  const [authStatus, setAuthStatus] = useState<AuthStatus>({
    is_authenticated: false,
    is_configured: false,
    is_demo_mode: false
  });
  const [stats, setStats] = useState<StatsResponse>({
    total_senders: 0,
    total_emails: 0,
    total_unread: 0,
    total_size_bytes: 0,
    newsletters_count: 0,
    unsubscribed_count: 0,
    is_authenticated: false,
    is_demo_mode: false
  });
  const [senders, setSenders] = useState<Sender[]>([]);
  const [totalSenders, setTotalSenders] = useState(0);
  const [newsletters, setNewsletters] = useState<Sender[]>([]);
  const [labels, setLabels] = useState<LabelInfo[]>([]);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeSmartQuery, setActiveSmartQuery] = useState('');
  const [sortBy, setSortBy] = useState('count');
  const [sortOrder, setSortOrder] = useState('desc');
  const [refreshTick, setRefreshTick] = useState(0);

  // Selections
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // Modals & Drawers
  const [inspectingSender, setInspectingSender] = useState<Sender | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isSmartFilterOpen, setIsSmartFilterOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Running Background Job & Toast Notifications
  const [activeJob, setActiveJob] = useState<JobProgress | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const notify = useCallback((type: ToastNotice['type'], message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Load initial data
  const loadAuthAndStats = useCallback(async () => {
    try {
      const [auth, st] = await Promise.all([fetchAuthStatus(), fetchStats()]);
      setAuthStatus(auth);
      setStats(st);
    } catch (err: any) {
      notify('error', err?.message || 'Failed to load account stats');
    }
  }, [notify]);

  const loadSenders = useCallback(async () => {
    try {
      const res = await fetchSenders({
        q: searchQuery,
        category: selectedCategory,
        smart_query: activeSmartQuery || undefined,
        sort_by: sortBy,
        order: sortOrder,
        page,
        page_size: pageSize
      });
      setSenders(res.senders);
      setTotalSenders(res.total);
    } catch (err: any) {
      notify('error', err?.message || 'Failed to load senders list');
    }
  }, [searchQuery, selectedCategory, activeSmartQuery, sortBy, sortOrder, page, pageSize, notify]);

  const loadNewsletters = useCallback(async () => {
    try {
      const res = await fetchSenders({
        has_unsubscribe: true,
        page: 1,
        page_size: 200
      });
      setNewsletters(res.senders);
    } catch {
      // Senders loader already surfaces connection issues
    }
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const lbls = await fetchLabels();
      setLabels(lbls);
    } catch {
      // Optional background label sync
    }
  }, []);

  useEffect(() => {
    loadAuthAndStats();
    loadSenders();
    loadNewsletters();
    loadLabels();
  }, [loadAuthAndStats, loadSenders, loadNewsletters, loadLabels, refreshTick]);

  // Subscribe to live background job updates
  const trackJob = (jobId: string) => {
    setActiveJob({
      id: jobId,
      action: 'executing',
      status: 'pending',
      total_items: 100,
      processed_items: 0,
      success_count: 0,
      error_count: 0,
      current_item: '',
      message: 'Starting background task...',
      percentage: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    streamJob(
      jobId,
      (job) => {
        setActiveJob(job);
      },
      () => {
        setRefreshTick((n) => n + 1);
        setSelectedEmails([]);
      },
      () => {
        notify('error', 'Lost live progress stream connection');
      }
    );
  };

  // Shared helper for bulk actions starting a tracked job
  const runJobAction = async (fn: () => Promise<{ job_id: string }>, errorLabel: string) => {
    try {
      const res = await fn();
      trackJob(res.job_id);
    } catch (err: any) {
      notify('error', err?.message || errorLabel);
    }
  };

  const smartFilterQuery = activeSmartQuery || undefined;

  const handleScan = (query: string = '', maxEmails: number = 1000) => {
    setActiveSmartQuery('');
    setPage(1);
    return runJobAction(() => triggerScan(query, maxEmails), 'Could not start scan');
  };

  const handleSmartScan = (query: string) => {
    const clean = query.trim();
    setActiveSmartQuery(clean);
    setSelectedCategory('');
    setPage(1);
    setSelectedEmails([]);
    return runJobAction(() => triggerScan(clean, 1000), 'Could not start smart filter scan');
  };

  const handleBulkTrash = (emails: string[]) =>
    runJobAction(() => bulkTrash(emails, smartFilterQuery), 'Bulk trash failed');

  const handleBulkPermanentDelete = (emails: string[]) =>
    runJobAction(() => bulkPermanentDelete(emails, smartFilterQuery), 'Permanent delete failed');

  const handleBulkArchive = (emails: string[]) =>
    runJobAction(() => bulkArchive(emails, smartFilterQuery), 'Bulk archive failed');

  const handleBulkMarkRead = (emails: string[], read: boolean) =>
    runJobAction(() => bulkMarkRead(emails, read, smartFilterQuery), 'Bulk mark read failed');

  const handleBulkMarkImportant = (emails: string[], important: boolean) =>
    runJobAction(() => bulkMarkImportant(emails, important, smartFilterQuery), 'Bulk mark important failed');

  const handleBulkLabel = (emails: string[], labelId: string, action: 'apply' | 'remove') =>
    runJobAction(() => bulkApplyLabel(emails, labelId, action, smartFilterQuery), 'Bulk label failed');

  const handleUnsubscribeBulk = (emails: string[], trashExisting: boolean = false) =>
    runJobAction(() => unsubscribeBulk(emails, trashExisting), 'Bulk unsubscribe failed');

  const handleUnsubscribeSingle = async (email: string, trashExisting: boolean = false) => {
    try {
      const res = await unsubscribeSingle(email, trashExisting);
      if (res.status === 'success') {
        notify('success', res.message);
        loadSenders();
        loadNewsletters();
        loadAuthAndStats();
      } else if (res.manual_url && /^https?:\/\//i.test(res.manual_url)) {
        notify('info', 'Opening sender unsubscribe link in a new tab.');
        window.open(res.manual_url, '_blank', 'noopener,noreferrer');
      } else {
        notify('info', res.message);
      }
    } catch (err: any) {
      notify('error', err?.message || 'Unsubscribe request failed');
    }
  };

  const handleLogin = async () => {
    try {
      const url = await fetchLoginUrl();
      window.location.href = url;
    } catch (err: any) {
      notify('error', err?.message || 'Could not start OAuth login. Configure OAuth in Settings.');
      setIsSettingsOpen(true);
    }
  };

  const handleLogout = async () => {
    await logout();
    await loadAuthAndStats();
    notify('info', 'Disconnected Gmail account.');
  };

  const handleSaveCredentials = async (cid: string, secret: string) => {
    await saveCredentials(cid, secret);
    await loadAuthAndStats();
  };

  const handleSeedDemoData = async () => {
    await seedDemoData();
    await Promise.all([loadAuthAndStats(), loadSenders(), loadNewsletters()]);
    notify('success', 'Sample demo inbox data populated.');
  };

  const handleResetDatabase = async () => {
    try {
      await resetScanDatabase();
      setActiveSmartQuery('');
      setSelectedEmails([]);
      setRefreshTick((n) => n + 1);
      notify('success', 'Cached scan database cleared.');
    } catch (err: any) {
      notify('error', err?.message || 'Failed to reset database');
    }
  };

  // Filter / Selection handlers
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
  };

  const handleSortChange = (sb: string, so: string) => {
    setSortBy(sb);
    setSortOrder(so);
    setPage(1);
  };

  const handleToggleSelect = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleSelectAllPage = () => {
    const pageEmails = senders.map((s) => s.email);
    const allSelected = pageEmails.every((e) => selectedEmails.includes(e));
    if (allSelected) {
      setSelectedEmails((prev) => prev.filter((e) => !pageEmails.includes(e)));
    } else {
      setSelectedEmails((prev) => Array.from(new Set([...prev, ...pageEmails])));
    }
  };

  const sendersTableNode = (
    <div className="space-y-4">
      {activeSmartQuery && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-sm">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Active Smart Filter
            </span>
            <code className="font-mono text-xs sm:text-sm text-white bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              {activeSmartQuery}
            </code>
            <span className="text-slate-300 text-xs sm:text-sm">
              ({totalSenders} matching {totalSenders === 1 ? 'sender' : 'senders'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSmartFilterOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
            >
              Edit Filter
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSmartQuery('');
                setPage(1);
                setSelectedEmails([]);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white border border-rose-500/30 text-xs font-medium transition"
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}
      <SendersTable
        senders={senders}
        totalSenders={totalSenders}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        selectedEmails={selectedEmails}
        onToggleSelect={handleToggleSelect}
        onSelectAllPage={handleSelectAllPage}
        onClearSelection={() => setSelectedEmails([])}
        onBulkTrash={handleBulkTrash}
        onBulkPermanentDelete={handleBulkPermanentDelete}
        onBulkArchive={handleBulkArchive}
        onBulkMarkRead={handleBulkMarkRead}
        onBulkMarkImportant={handleBulkMarkImportant}
        onBulkLabel={handleBulkLabel}
        onUnsubscribeSingle={(email) => handleUnsubscribeSingle(email, false)}
        onInspectSender={setInspectingSender}
        onOpenLabelManager={() => setIsLabelModalOpen(true)}
        availableLabels={labels}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        authStatus={authStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLabels={() => setIsLabelModalOpen(true)}
        onOpenScan={() => setIsScanModalOpen(true)}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />

      {/* Wide Main Container */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-7 space-y-7">
        {/* Metric Stats Cards */}
        <StatsOverview
          stats={stats}
          onFilterUnsubscribe={() => setActiveTab('unsubscribe')}
        />

        {/* Tab 1: Senders Table */}
        {activeTab === 'senders' && sendersTableNode}

        {/* Tab 2: 1-Click Unsubscribe Center */}
        {activeTab === 'unsubscribe' && (
          <UnsubscribeCenter
            newsletters={newsletters}
            selectedEmails={selectedEmails}
            onToggleSelect={handleToggleSelect}
            onSelectAll={() => setSelectedEmails(newsletters.map((n) => n.email))}
            onClearSelection={() => setSelectedEmails([])}
            onUnsubscribeSingle={handleUnsubscribeSingle}
            onUnsubscribeBulk={handleUnsubscribeBulk}
          />
        )}

        {/* Tab 3: Smart Clean & Recipes */}
        {activeTab === 'smart' && (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-800/40 text-center space-y-3.5 shadow-xl">
              <h2 className="text-2xl font-bold text-white">Smart Clean Presets &amp; Deep Filters</h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Clean your inbox by targeted Gmail categories, large attachment sizes, and inactive date windows.
              </p>
              <button
                onClick={() => setIsSmartFilterOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition"
              >
                Launch Filter Builder
              </button>
            </div>
            {sendersTableNode}
          </div>
        )}
      </main>

      {/* Modals */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onStartScan={handleScan}
        onResetDatabase={handleResetDatabase}
      />

      <SmartFilterModal
        isOpen={isSmartFilterOpen}
        onClose={() => setIsSmartFilterOpen(false)}
        onTriggerScanWithQuery={handleSmartScan}
      />

      <LabelManagerModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        labels={labels}
        onCreateLabel={async (name) => {
          await createLabel(name);
          loadLabels();
          notify('success', `Label "${name}" created.`);
        }}
        onDeleteLabel={async (id) => {
          await deleteLabel(id);
          loadLabels();
          notify('info', 'Label deleted.');
        }}
        onApplyLabelToSelected={(labelId) => {
          if (selectedEmails.length > 0) {
            setIsLabelModalOpen(false);
            handleBulkLabel(selectedEmails, labelId, 'apply');
          }
        }}
        selectedEmailsCount={selectedEmails.length}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        authStatus={authStatus}
        onSaveCredentials={handleSaveCredentials}
        onSeedDemoData={handleSeedDemoData}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />

      <JobProgressModal
        job={activeJob}
        onCancel={(id) => cancelJob(id)}
        onClose={() => setActiveJob(null)}
      />

      <EmailInspectorDrawer
        sender={inspectingSender}
        smartQuery={smartFilterQuery}
        onClose={() => setInspectingSender(null)}
        onMessagesModified={() => setRefreshTick((n) => n + 1)}
        onNotify={notify}
      />

      {/* Non-blocking Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md text-sm ${
                toast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-700/70 text-emerald-100'
                  : toast.type === 'error'
                  ? 'bg-rose-950/95 border-rose-700/70 text-rose-100'
                  : 'bg-slate-900/95 border-slate-700 text-slate-100'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />}
              <span className="flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white transition flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
