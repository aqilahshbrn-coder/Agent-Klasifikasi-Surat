import React, { useState, useEffect } from 'react';
import { User } from './types.ts';
import { api } from './api.ts';
import { Header } from './components/Header.tsx';
import { ClassificationView } from './components/ClassificationView.tsx';
import { BatchView } from './components/BatchView.tsx';
import { GuidelineView } from './components/GuidelineView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { HistoryView } from './components/HistoryView.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('classify');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const res = await api.getCurrentUser();
      setCurrentUser(res.currentUser);
      setAllUsers(res.allUsers);
    } catch (e) {
      console.error('Failed to load current user:', e);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      const res = await api.switchUser(userId);
      setCurrentUser(res.currentUser);
    } catch (e) {
      console.error('Failed to switch user:', e);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold text-slate-600">
            Menghubungkan ke Sistem Asisten Klasifikasi Arsip...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased selection:bg-slate-900 selection:text-white">
      {/* Top Bar Contract Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        currentUser={currentUser}
        allUsers={allUsers}
        onSwitchUser={handleSwitchUser}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'classify' && (
          <ClassificationView
            currentUser={currentUser}
            onNavigateToPedoman={() => setActiveTab('guideline')}
            onNavigateToRiwayat={() => setActiveTab('history')}
          />
        )}

        {activeTab === 'batch' && <BatchView currentUser={currentUser} />}

        {activeTab === 'guideline' && <GuidelineView currentUser={currentUser} />}

        {activeTab === 'dashboard' && (
          <DashboardView currentUser={currentUser} allUsers={allUsers} />
        )}

        {activeTab === 'history' && <HistoryView />}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">
              AI Agent Rekomendasi Kode Klasifikasi Arsip
            </span>
            <span>·</span>
            <span>Pola Baku ANRI / Tata Naskah Dinas Resmi</span>
          </div>

          <div className="text-[11px] text-slate-400">
            Peran Aktif: <strong className="text-slate-600 capitalize">{currentUser?.role || 'Petugas'}</strong> ({currentUser?.name})
          </div>
        </div>
      </footer>
    </div>
  );
}
