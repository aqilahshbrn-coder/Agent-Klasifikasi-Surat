import React, { useState, useEffect } from 'react';
import { GuidelineCode } from '../types.ts';
import { api } from '../api.ts';
import { Search, X, Check, AlertCircle } from 'lucide-react';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCode: string;
  onSaveCorrection: (selectedCode: GuidelineCode, note: string) => Promise<void>;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  currentCode,
  onSaveCorrection,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [codes, setCodes] = useState<GuidelineCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<GuidelineCode | null>(null);
  const [correctionNote, setCorrectionNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCodes();
      setSelectedCode(null);
      setCorrectionNote('');
      setError(null);
    }
  }, [isOpen]);

  const loadCodes = async (q: string = '') => {
    setIsLoading(true);
    try {
      const res = await api.getCodes(q, 3); // Level 3 codes for specific classification
      setCodes(res.codes);
    } catch (e: any) {
      setError(e.message || 'Gagal memuat butir pedoman');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    loadCodes(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCode) {
      setError('Silakan pilih salah satu kode pedoman pengganti');
      return;
    }
    if (!correctionNote.trim()) {
      setError('Wajib memberikan catatan alasan koreksi untuk keperluan audit metrik');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSaveCorrection(selectedCode, correctionNote.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan hasil koreksi');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Koreksi Kode Klasifikasi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Kode rekomendasi AI: <span className="font-mono font-medium text-slate-700">{currentCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Search Guideline */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Cari Kode Pengganti dalam Pedoman Resmi
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Ketik kode (mis. KU.01.01) atau kata kunci (anggaran, rapat, cuti)..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Code Selection List */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Daftar Butir Pedoman Terpilih ({codes.length} butir ditemukan)
            </label>
            <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
              {isLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">Mencari butir pedoman...</div>
              ) : codes.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Tidak ada kode yang cocok dengan kata kunci pencarian.
                </div>
              ) : (
                codes.map((c) => {
                  const isChecked = selectedCode?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCode(c)}
                      className={`p-3 text-xs cursor-pointer flex items-start justify-between gap-3 transition-colors ${
                        isChecked ? 'bg-indigo-50/80' : 'hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-xs px-1.5 py-0.5 bg-white border border-slate-200 rounded">
                            {c.code}
                          </span>
                          <span className="font-semibold text-slate-900">{c.title}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{c.hierarchy}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-1">{c.description}</div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isChecked
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Officer Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Alasan Koreksi oleh Petugas <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="Jelaskan alasan mengapa kode di atas dipilih menggantikan rekomendasi AI (mis. fokus substansi pada aspek teknis belanja daripada acara rapatnya)..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Catatan ini akan dicatat dalam log evaluasi untuk perhitungan Indikator M3 (Frekuensi Koreksi).
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedCode}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Kode Koreksi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
