import React, { useState, useEffect } from 'react';
import { HistoryItem } from '../types.ts';
import { api } from '../api.ts';
import { AuditDetailModal } from './AuditDetailModal.tsx';
import {
  Search,
  History,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Filter,
} from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);

  useEffect(() => {
    loadHistory();
  }, [decisionFilter]);

  const loadHistory = async (q: string = searchQuery) => {
    setIsLoading(true);
    try {
      const res = await api.getHistory({
        search: q,
        decision: decisionFilter,
      });
      setHistoryList(res.history);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    loadHistory(val);
  };

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle className="w-3 h-3" /> Disetujui
          </span>
        );
      case 'alternative_chosen':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            Alternatif
          </span>
        );
      case 'corrected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="w-3 h-3" /> Dikoreksi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Riwayat Klasifikasi & Verifikasi Dokumen
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log lengkap penentuan kode klasifikasi arsip, catatan keputusan petugas, dan audit trail penelusuran pedoman.
          </p>
        </div>

        <div className="text-xs text-slate-500">
          Total Log Tercatat: <strong className="font-mono text-slate-800">{historyList.length}</strong> entri
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari teks perihal, unit, atau kode klasifikasi..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
          />
        </div>

        {/* Status Decision Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700"
          >
            <option value="all">Semua Keputusan</option>
            <option value="approved">Disetujui Rekomendasi AI</option>
            <option value="alternative_chosen">Pilih Alternatif</option>
            <option value="corrected">Dikoreksi Petugas</option>
            <option value="unverified">Belum Diverifikasi</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-32">Waktu Dibuat</th>
                <th className="py-3 px-4 min-w-[260px]">Perihal / Naskah Dinas</th>
                <th className="py-3 px-4 min-w-[120px]">Unit Pengolah</th>
                <th className="py-3 px-4 min-w-[140px]">Rekomendasi AI</th>
                <th className="py-3 px-4 min-w-[140px]">Kode Final</th>
                <th className="py-3 px-4 min-w-[130px]">Keputusan</th>
                <th className="py-3 px-4 w-24 text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Memuat riwayat...
                  </td>
                </tr>
              ) : historyList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    Tidak ditemukan data riwayat sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                historyList.map((item, idx) => {
                  const doc = item.document;
                  const rec = item.recommendation;
                  const ver = item.verification;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        <div>{new Date(doc.created_at).toLocaleDateString('id-ID')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(doc.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="line-clamp-2">{doc.description_text}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {doc.letter_type || 'Naskah Dinas'} · Oleh: {doc.created_by_name}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {doc.unit || '-'}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                            {rec?.primary_code || '-'}
                          </span>
                          <span className="text-[11px] text-slate-700 font-medium truncate max-w-[120px]">
                            {rec?.primary_title || '-'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Keyakinan: {Math.round((rec?.confidence || 0) * 100)}%
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {ver ? (
                          <div>
                            <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 bg-emerald-50 text-emerald-900 rounded border border-emerald-200">
                              {ver.final_code}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[140px]">
                              {ver.final_title}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Belum Ada</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {getDecisionBadge(ver?.decision)}
                        {ver && (
                          <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                            Oleh: {ver.verified_by_name}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          Audit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Detail Modal */}
      <AuditDetailModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
};
