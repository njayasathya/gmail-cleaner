import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsOverview } from './components/StatsOverview';
import { SendersTable } from './components/SendersTable';
import { UnsubscribeCenter } from './components/UnsubscribeCenter';
import { SmartFilterModal } from './components/SmartFilterModal';
import { LabelManagerModal } from './components/LabelManagerModal';
import { JobProgressModal } from './components/JobProgressModal';
import { SettingsModal } from './components/SettingsModal';
import { ScanModal } from './components/ScanModal';

import {
  fetchAuthStatus, fetchStats, fetchSenders, fetchLabels,
  triggerScan, bulkTrash, bulkPermanentDelete, bulkArchive,
  bulkMarkRead, bulkMarkImportant, bulkApplyLabel, unsubscribeSingle,
  unsubscribeBulk, createLabel, deleteLabel, cancelJob,
  streamJob, fetchLoginUrl, logout, saveCredentials, seedDemoData,
  resetScanDatabase
} from './services/api';

import {
  Sender, StatsResponse, AuthStatus, JobProgress, LabelInfo
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
  const [sortBy, setSortBy] = useState('count');
  const [sortOrder, setSortOrder] = useState('desc');

  // Selections
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // Modals
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isSmartFilterOpen, setIsSmartFilterOpen] = useState(false);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Running Background Job
  const [activeJob, setActiveJob] = useState<JobProgress | null>(null);

  // Load initial data
  const loadAuthAndStats = useCallback(async () => {
    try {
      const auth = await fetchAuthStatus();
      setAuthStatus(auth);
      const st = await fetchStats();
      setStats(st);
    } catch (err) {
      console.error('Failed to load initial stats:', err);
    }
  }, []);

  const loadSenders = useCallback(async () => {
    try {
      const res = await fetchSenders({
        q: searchQuery,
        category: selectedCategory,
        sort_by: sortBy,
        order: sortOrder,
        page,
        page_size: pageSize
      });
      setSenders(res.senders);
      setTotalSenders(res.total);
    } catch (err) {
      console.error('Failed to load senders:', err);
    }
  }, [searchQuery, selectedCategory, sortBy, sortOrder, page, pageSize]);

  const loadNewsletters = useCallback(async () => {
    try {
      const res = await fetchSenders({
        has_unsubscribe: true,
        page: 1,
        page_size: 200
      });
      setNewsletters(res.senders);
    } catch (err) {
      console.error('Failed to load newsletters:', err);
    }
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const lbls = await fetchLabels();
      setLabels(lbls);
    } catch (err) {
      console.error('Failed to load labels:', err);
    }
  }, []);

  useEffect(() => {
    loadAuthAndStats();
    loadSenders();
    loadNewsletters();
    loadLabels();
  }, [loadAuthAndStats, loadSenders, loadNewsletters, loadLabels]);

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
        // Job complete - reload state
        loadAuthAndStats();
        loadSenders();
        loadNewsletters();
        setSelectedEmails([]);
      },
      (err) => {
        console.error('Stream error:', err);
      }
    );
  };

  // Actions
  const handleScan = async (query: string = '', maxEmails: number = 1000) => {
    try {
      const res = await triggerScan(query, maxEmails);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Could not start scan');
    }
  };

  const handleBulkTrash = async (emails: string[]) => {
    try {
      const res = await bulkTrash(emails);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk trash failed');
    }
  };

  const handleBulkPermanentDelete = async (emails: string[]) => {
    try {
      const res = await bulkPermanentDelete(emails);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Permanent delete failed');
    }
  };

  const handleBulkArchive = async (emails: string[]) => {
    try {
      const res = await bulkArchive(emails);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk archive failed');
    }
  };

  const handleBulkMarkRead = async (emails: string[], read: boolean) => {
    try {
      const res = await bulkMarkRead(emails, read);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk mark read failed');
    }
  };

  const handleBulkMarkImportant = async (emails: string[], important: boolean) => {
    try {
      const res = await bulkMarkImportant(emails, important);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk mark important failed');
    }
  };

  const handleBulkLabel = async (emails: string[], labelId: string, action: 'apply' | 'remove') => {
    try {
      const res = await bulkApplyLabel(emails, labelId, action);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk label failed');
    }
  };

  const handleUnsubscribeSingle = async (email: string, trashExisting: boolean = false) => {
    try {
      const res = await unsubscribeSingle(email, trashExisting);
      if (res.status === 'success') {
        alert(res.message);
        loadSenders();
        loadNewsletters();
        loadAuthAndStats();
      } else if (res.manual_url) {
        window.open(res.manual_url, '_blank');
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Unsubscribe request failed');
    }
  };

  const handleUnsubscribeBulk = async (emails: string[], trashExisting: boolean = false) => {
    try {
      const res = await unsubscribeBulk(emails, trashExisting);
      trackJob(res.job_id);
    } catch (err: any) {
      alert(err.message || 'Bulk unsubscribe failed');
    }
  };

  const handleLogin = async () => {
    try {
      const url = await fetchLoginUrl();
      window.location.href = url;
    } catch (err: any) {
      alert(err.message || 'Could not start OAuth login. Please configure Client ID and Secret in Settings.');
      setIsSettingsOpen(true);
    }
  };

  const handleLogout = async () => {
    await logout();
    await loadAuthAndStats();
  };

  const handleSaveCredentials = async (cid: string, secret: string) => {
    await saveCredentials(cid, secret);
    await loadAuthAndStats();
  };

  const handleSeedDemoData = async () => {
    await seedDemoData();
    await loadAuthAndStats();
    await loadSenders();
    await loadNewsletters();
  };

  const handleResetDatabase = async () => {
    try {
      await resetScanDatabase();
      await loadAuthAndStats();
      await loadSenders();
      await loadNewsletters();
      setSelectedEmails([]);
    } catch (err: any) {
      alert(err.message || 'Failed to reset database');
    }
  };

  // Selection handlers
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar
        authStatus={authStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenScan={() => setIsScanModalOpen(true)}
        onLogout={handleLogout}
        onLogin={handleLogin}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Stats Cards */}
        <StatsOverview
          stats={stats}
          onFilterUnsubscribe={() => setActiveTab('unsubscribe')}
        />

        {/* Tab 1: Senders Table */}
        {activeTab === 'senders' && (
          <SendersTable
            senders={senders}
            totalSenders={totalSenders}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            selectedCategory={selectedCategory}
            onCategoryChange={(cat) => {
              setSelectedCategory(cat);
              setPage(1);
            }}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(sb, so) => {
              setSortBy(sb);
              setSortOrder(so);
              setPage(1);
            }}
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
            availableLabels={labels}
          />
        )}

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
          <div className="space-y-4">
            <div className="p-8 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border border-indigo-800/40 text-center space-y-3">
              <h2 className="text-xl font-bold text-white">Smart Clean Presets &amp; Deep Filters</h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Clean your inbox by targeted categories, file sizes, and inactive date windows.
              </p>
              <button
                onClick={() => setIsSmartFilterOpen(true)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
              >
                Launch Filter Builder
              </button>
            </div>
            {/* Also render senders table below */}
            <SendersTable
              senders={senders}
              totalSenders={totalSenders}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={(sb, so) => {
                setSortBy(sb);
                setSortOrder(so);
              }}
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
              availableLabels={labels}
            />
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
        onTriggerScanWithQuery={handleScan}
      />

      <LabelManagerModal
        isOpen={isLabelModalOpen}
        onClose={() => setIsLabelModalOpen(false)}
        labels={labels}
        onCreateLabel={async (name) => {
          await createLabel(name);
          loadLabels();
        }}
        onDeleteLabel={async (id) => {
          await deleteLabel(id);
          loadLabels();
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
    </div>
  );
};
