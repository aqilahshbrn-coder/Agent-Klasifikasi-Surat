import React, { useState } from 'react';
import { User } from '../types.ts';
import { Archive, Shield, ChevronDown, Check } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User | null;
  allUsers: User[];
  onSwitchUser: (userId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  allUsers,
  onSwitchUser,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navItems = [
    { id: 'classify', label: 'Klasifikasi Surat' },
    { id: 'batch', label: 'Pengolahan Massal' },
    { id: 'guideline', label: 'Pencarian Pedoman' },
    { id: 'dashboard', label: 'Dashboard Indikator' },
    { id: 'history', label: 'Riwayat' },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Brand title, one line */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm">
              <Archive className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-tight">
                AI Agent Klasifikasi Arsip
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap block">
                Tim Persuratan & Tata Naskah Dinas
              </span>
            </div>
          </div>

          {/* Zone 2: 4–5 nav links, 1–2 word labels, single-line */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 primary action or active role switcher */}
          <div className="relative shrink-0">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left text-xs"
            >
              <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-700 text-xs">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <div className="font-semibold text-slate-900 leading-none truncate max-w-[120px]">
                  {currentUser?.name || 'Petugas'}
                </div>
                <div className="text-[10px] text-slate-500 capitalize leading-none mt-1">
                  Peran: {currentUser?.role || 'petugas'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-50">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Ganti Peran Pengguna
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Simulasi uji coba kewenangan persuratan
                  </div>
                </div>

                <div className="py-1">
                  {allUsers.map((u) => {
                    const isSelected = u.id === currentUser?.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                          isSelected ? 'bg-slate-50/80 font-semibold' : ''
                        }`}
                      >
                        <div>
                          <div className="text-slate-900 font-medium">{u.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {u.role === 'admin' ? 'Admin Pedoman' : u.role === 'pimpinan' ? 'Pimpinan (Viewer)' : 'Petugas Arsip'} · {u.department}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                activeTab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};
