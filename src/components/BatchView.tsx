import React, { useState } from 'react';
import { User, DocumentRecord, Recommendation } from '../types.ts';
import { api } from '../api.ts';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  Download,
  Check,
  RotateCcw,
  AlertCircle,
  FileText,
  Clock,
} from 'lucide-react';

interface BatchViewProps {
  currentUser: User | null;
}

interface BatchItemResult {
  document: DocumentRecord;
  recommendation: Recommendation;
  verifiedCode?: string;
  isVerified?: boolean;
}

export const BatchView: React.FC<BatchViewProps> = ({ currentUser }) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BatchItemResult[]>([]);

  const sampleBatch = [
    'Surat permohonan rekomendasi usulan kenaikan pangkat reguler periode Oktober untuk 12 staf;Bagian Kepegawaian;Surat Pengantar',
    'Undangan rapat pembahasan evaluasi serapan anggaran triwulan III bersama KPPN;Biro Keuangan;Nota Dinas',
    'Nota dinas permohonan izin perbaikan AC dan instalasi kelistrikan di ruang server lantai 2;Pusdatin;Nota Dinas',
    'Surat tugas pendampingan sidang sengketa pengadaan barang di Pengadilan Negeri;Biro Hukum;Surat Tugas',
    'Surat siaran pers resmi terkait penghargaan inovasi pelayanan publik tingkat nasional;Bagian Humas;Siaran Pers',
  ].join('\n');

  const handleLoadSample = () => {
    setInputText(sampleBatch);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Strip header if it contains 'perihal' or 'deskripsi'
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines[0]?.toLowerCase().includes('perihal') || lines[0]?.toLowerCase().includes('isi')) {
          setInputText(lines.slice(1).join('\n'));
        } else {
          setInputText(text);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleProcessBatch = async () => {
    const lines = inputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      setError('Masukkan minimal 1 dokumen untuk diproses massal');
      return;
    }

    if (lines.length > 25) {
      setError('Maksimal 25 dokumen per satu kali pengolahan massal');
      return;
    }

    setIsLoading(true);
    setError(null);

    const parsedItems = lines.map((line) => {
      // Check if separated by semicolon or tab or comma
      const parts = line.split(/[;\t]/);
      return {
        description_text: parts[0]?.trim() || line,
        unit: parts[1]?.trim() || undefined,
        letter_type: parts[2]?.trim() || undefined,
      };
    });

    try {
      const res = await api.batchClassify(parsedItems);
      setResults(
        res.results.map((r) => ({
          document: r.document,
          recommendation: r.recommendation,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Gagal memproses pengolahan massal');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick verify single item in batch table
  const handleQuickVerifyItem = async (index: number, code: string) => {
    const item = results[index];
    if (!item || !item.recommendation.primary_code) return;

    try {
      await api.verify({
        recommendation_id: item.recommendation.id,
        document_id: item.document.id,
        decision: 'approved',
        final_code: code,
        note: 'Disetujui dari pengolahan massal',
        verification_seconds: 10,
      });

      const updated = [...results];
      updated[index] = {
        ...updated[index],
        verifiedCode: code,
        isVerified: true,
      };
      setResults(updated);
    } catch (e: any) {
      alert(`Gagal memverifikasi: ${e.message}`);
    }
  };

  // Export to CSV / Excel
  const handleExportCSV = () => {
    if (results.length === 0) return;

    const headers = [
      'No',
      'ID Dokumen',
      'Perihal / Deskripsi',
      'Unit Pengolah',
      'Jenis Surat',
      'Kode Rekomendasi',
      'Judul Klasifikasi',
      'Hierarki',
      'Tingkat Keyakinan',
      'Status',
      'Kode Final Terverifikasi',
      'Status Verifikasi',
    ];

    const rows = results.map((r, i) => [
      i + 1,
      r.document.id,
      `"${r.document.description_text.replace(/"/g, '""')}"`,
      `"${r.document.unit || '-'}"`,
      `"${r.document.letter_type || '-'}"`,
      r.recommendation.primary_code || '-',
      `"${(r.recommendation.primary_title || '-').replace(/"/g, '""')}"`,
      `"${(r.recommendation.primary_hierarchy || '-').replace(/"/g, '""')}"`,
      `${Math.round(r.recommendation.confidence * 100)}%`,
      r.recommendation.status,
      r.verifiedCode || (r.isVerified ? r.recommendation.primary_code : 'Belum Diverifikasi'),
      r.isVerified ? 'Diverifikasi' : 'Pending',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `rekap-klasifikasi-massal-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const verifiedCount = results.filter((r) => r.isVerified).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Pengolahan Massal (Batch Classification)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Proses klasifikasi hingga 25 surat sekaligus melalui tempel teks daftar atau unggah berkas CSV.
          </p>
        </div>

        {results.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Ekspor Hasil ke CSV / Excel
          </button>
        )}
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              Daftar Naskah Dinas Masukan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Format: <code>Perihal; Unit Pengolah; Jenis Surat</code> (satu dokumen per baris)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              Muat 5 Sampel Surat
            </button>

            <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md cursor-pointer transition-colors">
              <Upload className="w-3 h-3 text-slate-500" />
              Unggah File CSV
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ketik atau tempel daftar dokumen di sini...&#10;Contoh:&#10;Surat permohonan kenaikan pangkat reguler;Bagian Kepegawaian;Surat Pengantar&#10;Undangan rapat pembahasan anggaran triwulan III;Biro Keuangan;Nota Dinas"
            className="w-full p-3 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-xs text-slate-500">
            Terdeteksi: <strong className="font-mono text-slate-700">{inputText.split('\n').filter((l) => l.trim().length > 0).length}</strong> dokumen
          </div>

          <button
            onClick={handleProcessBatch}
            disabled={isLoading || !inputText.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses Batch...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Proses Klasifikasi Massal</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results High-Density Data Grid */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
          {/* Table Header Summary */}
          <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-800">
                Hasil Klasifikasi ({results.length} Dokumen)
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">
                Terverifikasi: <strong className="font-mono text-emerald-700">{verifiedCount}</strong> / {results.length}
              </span>
            </div>

            <button
              onClick={() => {
                // Bulk verify all
                results.forEach((r, idx) => {
                  if (!r.isVerified && r.recommendation.primary_code) {
                    handleQuickVerifyItem(idx, r.recommendation.primary_code);
                  }
                });
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition-colors flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Setujui Semua yang Sesuai
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4 min-w-[240px]">Perihal / Dokumen</th>
                  <th className="py-3 px-4 min-w-[120px]">Unit</th>
                  <th className="py-3 px-4 min-w-[160px]">Rekomendasi Kode AI</th>
                  <th className="py-3 px-4 min-w-[100px] text-center">Keyakinan</th>
                  <th className="py-3 px-4 min-w-[120px]">Status</th>
                  <th className="py-3 px-4 min-w-[140px] text-right">Verifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r, idx) => {
                  const isDone = r.isVerified;
                  const primary = r.recommendation.primary_code;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="line-clamp-2">{r.document.description_text}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {r.document.letter_type || 'Naskah Dinas'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.document.unit || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                            {primary || 'N/A'}
                          </span>
                          <span className="text-[11px] text-slate-700 font-medium truncate max-w-[140px]">
                            {r.recommendation.primary_title || '-'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px] mt-0.5">
                          {r.recommendation.primary_hierarchy}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium">
                        <span
                          className={`${
                            r.recommendation.confidence >= 0.85
                              ? 'text-emerald-700'
                              : r.recommendation.confidence >= 0.65
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }`}
                        >
                          {Math.round(r.recommendation.confidence * 100)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {r.recommendation.status === 'ditemukan' ? (
                          <span className="text-emerald-700 font-medium">Tunggal</span>
                        ) : r.recommendation.status === 'ambigu' ? (
                          <span className="text-amber-700 font-medium">Ambigu</span>
                        ) : (
                          <span className="text-red-700 font-medium">Tidak Ada</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3" /> Disetujui ({r.verifiedCode})
                          </span>
                        ) : (
                          <button
                            onClick={() => primary && handleQuickVerifyItem(idx, primary)}
                            disabled={!primary}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            Setujui
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
