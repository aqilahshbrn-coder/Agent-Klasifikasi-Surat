import React from 'react';
import { HistoryItem } from '../types.ts';
import { X, CheckCircle, AlertTriangle, Clock, ShieldCheck, FileText, User } from 'lucide-react';

interface AuditDetailModalProps {
  item: HistoryItem | null;
  onClose: () => void;
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const { document, recommendation, verification } = item;

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> Disetujui (Approved)
          </span>
        );
      case 'alternative_chosen':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
            <CheckCircle className="w-3.5 h-3.5" /> Alternatif Terpilih
          </span>
        );
      case 'corrected':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5" /> Dikoreksi Petugas
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            <Clock className="w-3.5 h-3.5" /> Belum Diverifikasi
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Audit Trail Klasifikasi Dokumen
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ID Dokumen: <span className="font-mono text-slate-700">{document.id}</span> · Versi Pedoman: {recommendation?.version_name || 'Standar'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Dokumen Input */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              1. Naskah Dinas / Dokumen Masukan
            </h4>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-xs">
              <div className="font-semibold text-slate-900 text-sm">
                "{document.description_text}"
              </div>
              <div className="flex flex-wrap gap-4 text-slate-600 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400">Unit Pengolah:</span> {document.unit || 'Tidak ditentukan'}
                </div>
                <div>
                  <span className="text-slate-400">Jenis Surat:</span> {document.letter_type || 'Naskah Dinas'}
                </div>
                <div>
                  <span className="text-slate-400">Waktu Dibuat:</span> {new Date(document.created_at).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Rekomendasi AI & Validitas Rujukan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                2. Rekomendasi AI & Rujukan Pedoman (FR-04, FR-05)
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Keyakinan (Confidence):</span>
                <span className="font-mono font-semibold text-slate-900">
                  {Math.round((recommendation?.confidence || 0) * 100)}%
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">Durasi AI:</span>
                <span className="font-mono font-semibold text-slate-900">
                  {recommendation?.ai_duration_seconds}s
                </span>
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {recommendation?.primary_code || 'Tidak Ditemukan'}
                    </span>
                    <span className="font-semibold text-slate-900 text-sm">
                      {recommendation?.primary_title || '-'}
                    </span>
                  </div>
                  <div className="text-slate-500 mt-1 font-medium">
                    {recommendation?.primary_hierarchy || '-'}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {recommendation?.reference_valid ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5" /> Rujukan Resmi Valid (100%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded border border-red-200 text-[11px]">
                      Rujukan Tidak Valid
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100 space-y-1">
                <div className="font-semibold text-slate-700">Alasan Pemilihan AI:</div>
                <p className="text-slate-600 leading-relaxed">
                  {recommendation?.primary_reason}
                </p>
              </div>

              {recommendation?.analysis && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="font-semibold text-slate-500 block">Substansi Isi:</span>
                    <span className="text-slate-800">{recommendation.analysis.content}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Fungsi Organisasi:</span>
                    <span className="text-slate-800">{recommendation.analysis.function}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 block">Kegiatan Nyata:</span>
                    <span className="text-slate-800">{recommendation.analysis.activity}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Keputusan Verifikasi Petugas */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              3. Hasil Verifikasi Petugas (Kewenangan Final)
            </h4>

            {verification ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDecisionBadge(verification.decision)}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    Waktu Verifikasi: {verification.verification_seconds} detik
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Kode Final yang Ditetapkan:</span>
                    <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded">
                      {verification.final_code}
                    </span>
                    <span className="font-semibold text-slate-900">{verification.final_title}</span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5 ml-28">
                    {verification.final_hierarchy}
                  </div>
                </div>

                {verification.note && (
                  <div className="bg-white p-2.5 rounded border border-slate-200 text-slate-700">
                    <span className="font-semibold text-slate-900">Catatan Petugas: </span>
                    {verification.note}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Diverifikasi oleh: <strong className="text-slate-700">{verification.verified_by_name}</strong></span>
                  </div>
                  <div>
                    {new Date(verification.verified_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/50 rounded-lg border border-dashed border-amber-300 text-xs text-amber-800">
                Dokumen ini belum diverifikasi oleh Petugas Persuratan. Sesuai guardrail sistem, kode final belum dapat diberlakukan pada sistem registrasi surat.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
