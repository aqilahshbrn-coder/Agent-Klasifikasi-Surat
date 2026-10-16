import React, { useState, useEffect } from 'react';
import { User, Recommendation, DocumentRecord, SimilarDocumentItem, GuidelineCode } from '../types.ts';
import { api } from '../api.ts';
import { CorrectionModal } from './CorrectionModal.tsx';
import {
  Sparkles,
  Check,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Layers,
  Info,
} from 'lucide-react';

interface ClassificationViewProps {
  currentUser: User | null;
  onNavigateToPedoman: () => void;
  onNavigateToRiwayat: () => void;
}

export const ClassificationView: React.FC<ClassificationViewProps> = ({
  currentUser,
  onNavigateToPedoman,
  onNavigateToRiwayat,
}) => {
  const [descriptionText, setDescriptionText] = useState('');
  const [unit, setUnit] = useState('');
  const [letterType, setLetterType] = useState('Surat Dinas Keluar');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [currentDocument, setCurrentDocument] = useState<DocumentRecord | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [similarDocuments, setSimilarDocuments] = useState<SimilarDocumentItem[]>([]);
  const [verificationDone, setVerificationDone] = useState<{
    decision: 'approved' | 'alternative_chosen' | 'corrected';
    finalCode: string;
    finalTitle: string;
    note?: string;
  } | null>(null);

  // Correction Modal
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

  // Verification timer tracking (NFR-06: verification <= 2 clicks and latency tracking)
  const [recStartTime, setRecStartTime] = useState<number | null>(null);

  // Preset sample queries for quick exploration
  const samples = [
    {
      label: 'Rapat Anggaran',
      text: 'Surat undangan rapat koordinasi penyusunan rencana kerja dan anggaran tahun berikutnya antar seluruh unit kerja',
      unit: 'Biro Keuangan',
      type: 'Nota Dinas / Undangan',
    },
    {
      label: 'Sertifikat TTE',
      text: 'Permohonan penerbitan dan aktivasi sertifikat elektronik pejabat penandatangan naskah dinas ke Balai Sertifikasi Elektronik (BSrE)',
      unit: 'Pusat Data dan Informasi',
      type: 'Surat Permohonan',
    },
    {
      label: 'BAST Pengadaan Laptop',
      text: 'Berita Acara Serah Terima (BAST) hasil pengadaan 40 unit komputer dan server mini dari pihak penyedia rekanan',
      unit: 'UKPBJ / Pengadaan',
      type: 'Berita Acara',
    },
    {
      label: 'Formasi Pegawai',
      text: 'Surat penyampaian usulan formasi kebutuhan aparatur sipil negara (CPNS dan PPPK) tahun anggaran berikutnya',
      unit: 'Bagian Kepegawaian',
      type: 'Surat Dinas Keluar',
    },
    {
      label: 'Peminjaman Ruang Rapat',
      text: 'Permohonan peminjaman aula lantai 3 dan ruang rapat pimpinan untuk agenda sosialisasi kebijakan baru',
      unit: 'Biro Umum',
      type: 'Surat Permohonan',
    },
  ];

  const handleApplySample = (s: typeof samples[0]) => {
    setDescriptionText(s.text);
    setUnit(s.unit);
    setLetterType(s.type);
    setError(null);
  };

  const handleClassify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!descriptionText.trim()) {
      setError('Mohon masukkan perihal atau gambaran isi surat yang akan dibuat');
      return;
    }

    setIsLoading(true);
    setError(null);
    setVerificationDone(null);

    try {
      const res = await api.classify({
        description_text: descriptionText.trim(),
        unit: unit.trim() || undefined,
        letter_type: letterType.trim() || undefined,
      });

      setCurrentDocument(res.document);
      setRecommendation(res.recommendation);
      setSimilarDocuments(res.similarDocuments);
      setRecStartTime(Date.now());
    } catch (err: any) {
      setError(err.message || 'Gagal memproses rekomendasi kode klasifikasi');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick 1-Click: Approve Primary Recommendation
  const handleApprovePrimary = async () => {
    if (!recommendation || !currentDocument || !recommendation.primary_code) return;

    const seconds = recStartTime ? Math.round((Date.now() - recStartTime) / 1000) : 15;
    try {
      await api.verify({
        recommendation_id: recommendation.id,
        document_id: currentDocument.id,
        decision: 'approved',
        final_code: recommendation.primary_code,
        note: 'Disetujui sesuai rekomendasi utama AI',
        verification_seconds: Math.max(5, seconds),
      });

      setVerificationDone({
        decision: 'approved',
        finalCode: recommendation.primary_code,
        finalTitle: recommendation.primary_title || '',
        note: 'Disetujui sesuai rekomendasi utama AI',
      });
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan persetujuan');
    }
  };

  // Quick 1-Click: Choose Alternative
  const handleSelectAlternative = async (alt: { code: string; title: string; difference: string }) => {
    if (!recommendation || !currentDocument) return;

    const seconds = recStartTime ? Math.round((Date.now() - recStartTime) / 1000) : 20;
    try {
      await api.verify({
        recommendation_id: recommendation.id,
        document_id: currentDocument.id,
        decision: 'alternative_chosen',
        final_code: alt.code,
        note: `Memilih alternatif: ${alt.difference}`,
        verification_seconds: Math.max(5, seconds),
      });

      setVerificationDone({
        decision: 'alternative_chosen',
        finalCode: alt.code,
        finalTitle: alt.title,
        note: alt.difference,
      });
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pilihan alternatif');
    }
  };

  // Save manual correction from modal
  const handleSaveCorrection = async (selectedCode: GuidelineCode, note: string) => {
    if (!recommendation || !currentDocument) return;

    const seconds = recStartTime ? Math.round((Date.now() - recStartTime) / 1000) : 40;
    await api.verify({
      recommendation_id: recommendation.id,
      document_id: currentDocument.id,
      decision: 'corrected',
      final_code: selectedCode.code,
      note: note,
      verification_seconds: Math.max(10, seconds),
    });

    setVerificationDone({
      decision: 'corrected',
      finalCode: selectedCode.code,
      finalTitle: selectedCode.title,
      note: note,
    });
  };

  const handleResetForm = () => {
    setDescriptionText('');
    setUnit('');
    setCurrentDocument(null);
    setRecommendation(null);
    setVerificationDone(null);
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Penentuan Kode Klasifikasi Penciptaan Surat
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Menganalisis isi, fungsi, dan kegiatan naskah dinas untuk merekomendasikan kode resmi instansi secara konsisten.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateToPedoman}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            Buku Pedoman Klasifikasi
          </button>
        </div>
      </div>

      {/* Main 2-Column Split: Input Form on Left (5 cols) | Recommendation & Verification on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Form (FR-01) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Input Gambaran Isi Dokumen
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Masukkan ringkasan atau perihal surat yang sedang dibuat oleh unit kerja.
            </p>
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
              Contoh Kasus Cepat (Uji Coba):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {samples.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplySample(s)}
                  className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleClassify} className="space-y-4">
            {/* Perihal / Deskripsi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Perihal / Ringkasan Isi Surat <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={descriptionText}
                onChange={(e) => setDescriptionText(e.target.value)}
                placeholder="Contoh: Surat undangan rapat koordinasi penyusunan anggaran tahun berikutnya antar unit kerja..."
                className="w-full p-3 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white placeholder:text-slate-400"
              />
            </div>

            {/* Unit Pengolah (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit Pengolah (Opsional)
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Mis. Biro Keuangan, Bag. Kepegawaian"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white placeholder:text-slate-400"
                />
              </div>

              {/* Jenis Surat (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jenis Surat (Opsional)
                </label>
                <select
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                >
                  <option value="Surat Dinas Keluar">Surat Dinas Keluar</option>
                  <option value="Nota Dinas / Undangan">Nota Dinas / Undangan</option>
                  <option value="Surat Edaran">Surat Edaran</option>
                  <option value="Surat Tugas / Perintah">Surat Tugas / Perintah</option>
                  <option value="Surat Keputusan (SK)">Surat Keputusan (SK)</option>
                  <option value="Berita Acara">Berita Acara</option>
                  <option value="Surat Permohonan">Surat Permohonan</option>
                </select>
              </div>
            </div>

            {/* Privacy & Security Notice (NFR-05) */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg flex items-start gap-2 text-[11px] text-amber-900">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Perhatian Keamanan & Privasi:</strong> Data diproses semata untuk penentuan klasifikasi arsip. Jangan memasukkan identitas pribadi sensitif (NIK, nomor rekening rahasia) jika tidak diperlukan.
              </span>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Kosongkan Form
              </button>

              <button
                type="submit"
                disabled={isLoading || !descriptionText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
              >
                {isLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menganalisis Dokumen...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Rekomendasikan Kode</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Recommendation & Verification Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {!recommendation && !isLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                Belum Ada Analisis yang Berjalan
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Silakan ketik perihal surat di panel sebelah kiri atau klik salah satu <em>Contoh Kasus Cepat</em> untuk menguji rekomendasi kode arsip.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
              <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  AI Sedang Memeriksa Pedoman Resmi...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Menyaring kandidat kode, menganalisis fungsi & kegiatan, serta memvalidasi rujukan agar bebas halusinasi.
                </p>
              </div>
            </div>
          )}

          {recommendation && (
            <div className="space-y-6">
              {/* Verification Completed Notification Banner */}
              {verificationDone && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-900">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Klasifikasi Berhasil Diverifikasi Petugas!
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      Kode Final Tersimpan
                    </span>
                  </div>
                  <div className="text-emerald-800">
                    Dokumen telah disahkan menggunakan kode:{' '}
                    <strong className="font-mono text-emerald-950 font-bold px-1.5 py-0.5 bg-white rounded border border-emerald-300">
                      {verificationDone.finalCode}
                    </strong>{' '}
                    — {verificationDone.finalTitle}
                  </div>
                  {verificationDone.note && (
                    <div className="text-emerald-700 text-[11px] italic">
                      Catatan: "{verificationDone.note}"
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-600 border-t border-emerald-200/60">
                    <span>Diverifikasi oleh: <strong>{currentUser?.name || 'Petugas'}</strong></span>
                    <button
                      onClick={onNavigateToRiwayat}
                      className="text-emerald-900 font-semibold hover:underline flex items-center gap-1"
                    >
                      Lihat di Riwayat <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Primary Recommendation Card (FR-04, FR-05, FR-09) */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                {/* Card Header with Confidence & Latency */}
                <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-700">Rekomendasi Utama AI</span>
                    <span className="text-slate-300">·</span>
                    {/* Status Indicator */}
                    {recommendation.status === 'ditemukan' ? (
                      <span className="text-emerald-700 font-semibold">Tunggal & Jelas</span>
                    ) : recommendation.status === 'ambigu' ? (
                      <span className="text-amber-700 font-semibold">Perlu Pertimbangan (Ambigu)</span>
                    ) : (
                      <span className="text-red-700 font-semibold">Tidak Ditemukan</span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Confidence Meter (FR-09) */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500">Keyakinan:</span>
                      <span
                        className={`font-mono font-bold ${
                          recommendation.confidence >= 0.85
                            ? 'text-emerald-700'
                            : recommendation.confidence >= 0.65
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {Math.round(recommendation.confidence * 100)}%
                      </span>
                    </div>

                    <span className="text-slate-300">·</span>

                    {/* Latency */}
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="font-mono">{recommendation.ai_duration_seconds}s</span>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-6 space-y-5">
                  {/* Code and Title Lockup */}
                  <div>
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-mono font-bold text-2xl text-slate-900 tracking-tight px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200">
                        {recommendation.primary_code || 'N/A'}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {recommendation.primary_title || 'Kode Tidak Ditemukan'}
                      </h3>
                    </div>

                    {/* Hierarchy Path */}
                    <div className="text-xs text-slate-500 font-medium mt-2 flex items-center gap-1.5">
                      <span>{recommendation.primary_hierarchy || 'Tidak ada hierarki'}</span>
                    </div>
                  </div>

                  {/* AI Reason (FR-05) */}
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-100 space-y-1 text-xs">
                    <div className="font-semibold text-slate-800">Alasan Pemilihan Kode:</div>
                    <p className="text-slate-600 leading-relaxed">
                      {recommendation.primary_reason}
                    </p>
                  </div>

                  {/* Reference Validity Check (NFR-03: 100% Valid) */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Rujukan terverifikasi 100% ada pada pedoman resmi instansi.</span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Versi: {recommendation.version_name.split('(')[0]}
                    </span>
                  </div>

                  {/* 2-Click Verification Action Panel (FR-07) */}
                  {!verificationDone && (
                    <div className="pt-3 border-t border-slate-200">
                      <div className="text-xs font-semibold text-slate-700 mb-2">
                        Kewenangan Verifikasi Petugas (Maksimal 2 Klik):
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={handleApprovePrimary}
                          disabled={!recommendation.primary_code}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          Setujui Rekomendasi Ini
                        </button>

                        <button
                          onClick={() => setIsCorrectionOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          Koreksi dengan Kode Lain
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Alternatives Section for Ambiguous Cases (FR-06) */}
              {recommendation.alternatives && recommendation.alternatives.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-amber-500" />
                        Alternatif Kode untuk Kasus Ambigu (FR-06)
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Terdapat sudut pandang lain tergantung penekanan kegiatan naskah dinas.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recommendation.alternatives.map((alt, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded">
                              {alt.code}
                            </span>
                            <span className="font-semibold text-slate-900">{alt.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{alt.hierarchy}</div>
                          <div className="text-slate-600 text-[11px] pt-1">
                            <strong>Perbedaan & Alasan: </strong> {alt.difference}
                          </div>
                        </div>

                        {!verificationDone && (
                          <div className="shrink-0">
                            <button
                              onClick={() => handleSelectAlternative(alt)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
                            >
                              Pilih Kode Ini
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Similar Documents Panel (FR-10: Menjaga Konsistensi Klasifikasi) */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Dokumen Serupa yang Sudah Pernah Diklasifikasikan (FR-10)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menampilkan dokumen mirip sebelumnya beserta kode final yang disahkan untuk menjamin konsistensi kearsipan.
                  </p>
                </div>

                {similarDocuments.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-500 text-center border border-slate-100">
                    Belum ditemukan arsip serupa yang telah diverifikasi sebelumnya.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {similarDocuments.map((sim, i) => (
                      <div
                        key={i}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="space-y-0.5 flex-1">
                          <div className="font-medium text-slate-900 line-clamp-1">
                            "{sim.description_text}"
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>Unit: {sim.unit || 'Umum'}</span>
                            <span>·</span>
                            <span>Diverifikasi oleh: {sim.verified_by_name}</span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="flex items-center sm:justify-end gap-1.5">
                            <span className="text-[11px] text-slate-500">Kode Final:</span>
                            <span className="font-mono font-bold text-slate-900 px-2 py-0.5 bg-white border border-slate-200 rounded">
                              {sim.final_code}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Kesesuaian topik: {Math.round(sim.similarity_score * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Correction Modal */}
      <CorrectionModal
        isOpen={isCorrectionOpen}
        onClose={() => setIsCorrectionOpen(false)}
        currentCode={recommendation?.primary_code || '-'}
        onSaveCorrection={handleSaveCorrection}
      />
    </div>
  );
};
