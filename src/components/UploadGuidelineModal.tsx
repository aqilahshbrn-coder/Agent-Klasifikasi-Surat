import React, { useState } from 'react';
import { api } from '../api.ts';
import { GuidelineCode } from '../types.ts';
import {
  Upload,
  X,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Download,
  ArrowRight,
  FileCode,
  Check,
  Search,
  Trash2,
  Plus,
  Wand2,
} from 'lucide-react';

interface UploadGuidelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadGuidelineModal: React.FC<UploadGuidelineModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeStep, setActiveStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extracted Data from Document
  const [versionName, setVersionName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [description, setDescription] = useState('');
  const [extractedCodes, setExtractedCodes] = useState<Omit<GuidelineCode, 'id' | 'version_id'>[]>([]);
  const [makeActive, setMakeActive] = useState(true);
  const [previewSearch, setPreviewSearch] = useState('');

  if (!isOpen) return null;

  const handleUpdateCode = (index: number, field: string, value: any) => {
    setExtractedCodes((prev) => {
      const copy = [...prev];
      const item = { ...copy[index], [field]: value };
      if (field === 'code') {
        const parts = String(value).split('.');
        item.level = parts.length >= 3 ? 3 : parts.length;
        item.parent_code = parts.length > 1 ? parts.slice(0, -1).join('.') : null;
      }
      copy[index] = item;
      return copy;
    });
  };

  const handleDeleteCode = (index: number) => {
    setExtractedCodes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddCode = () => {
    setExtractedCodes((prev) => [
      ...prev,
      {
        code: 'KP.01.03',
        title: 'Butir Klasifikasi Baru',
        description: 'Uraian butir masalah klasifikasi',
        level: 3,
        parent_code: 'KP.01',
        hierarchy: 'Kepegawaian > Pengadaan Pegawai > Butir Klasifikasi Baru',
        keywords: ['baru'],
      },
    ]);
  };

  const handleAutoClean = () => {
    setExtractedCodes((prev) => {
      return prev.map((item) => {
        let code = item.code.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
        let title = item.title.trim();
        if (title.toUpperCase().startsWith(code)) {
          title = title.slice(code.length).trim();
        }
        title = title.replace(/^[\s:\-–—|.)\d+a-zA-Z\)]+/, '').trim();
        title = title.replace(/[\s:;,\-]+$/, '').trim();

        const parts = code.split('.');
        const level = parts.length >= 3 ? 3 : parts.length;
        const parent = parts.length > 1 ? parts.slice(0, -1).join('.') : null;

        return {
          ...item,
          code,
          title: title || code,
          level,
          parent_code: parent,
          hierarchy: item.hierarchy || title || code,
        };
      });
    });
  };

  const filteredPreviewCodes = extractedCodes.filter((c) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.hierarchy.toLowerCase().includes(q);
  });

  // Preset example document: Peraturan Pedoman Klasifikasi Arsip Baru
  const sampleDecreeText = `PERATURAN KEPALA ARSIP NASIONAL REPUBLIK INDONESIA / KEPUTUSAN PIMPINAN
TENTANG PEDOMAN KLASIFIKASI ARSIP DINAMIS BIDANG KESEHATAN DAN KEDINASAN TAHUN 2026

BAB I: POLA KLASIFIKASI POKOK MASALAH
KS KESEHATAN DAN LAYANAN MEDIS
KS.01 Pelayanan Kesehatan Masyarakat
KS.01.01 Program Imunisasi dan Vaksinasi Nasional: Penyelenggaraan posyandu, distribusi vaksin, dan pencatatan imunisasi dasar lengkap balita. Catatan: Khusus untuk pelaporan imunisasi rutin puskesmas.
KS.01.02 Pengendalian Penyakit Menular dan Surveilans Epidemiologi: Penyelidikan kasus wabah, karantina wilayah, dan penanganan demam berdarah/TBC.
KS.01.03 Promosi Kesehatan dan Penyuluhan Masyarakat: Materi sosialisasi pola hidup sehat, kampanye sanitasi lingkungan, dan poster edukasi publik.

KS.02 Kefarmasian dan Alat Kesehatan
KS.02.01 Pengadaan Obat Esensial dan Bahan Medis Habis Pakai (BMHP): Pengadaan obat puskesmas, buffer stock obat darurat bencana, dan verifikasi faktur farmasi.
KS.02.02 Izin Edar dan Uji Klinis Obat Tradisional: Permohonan rekomendasi izin sarana produksi jamu dan pengujian laboratorium BPOM.

KS.03 Sarana Prasarana Fasilitas Kesehatan
KS.03.01 Akreditasi Rumah Sakit dan Puskesmas: Berita acara penilaian standar mutu fasyankes, surveilans akreditasi fasilitas kesehatan tingkat pertama.
KS.03.02 Kalibrasi Alat Kesehatan Radiologi dan Laboratorium: Uji kelayakan berkala alat rontgen, USG, dan surat laik pakai BAPETEN.`;

  const handleUsePreset = () => {
    setPastedText(sampleDecreeText);
    setSelectedFile(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPastedText('');
      setError(null);
    }
  };

  const handleStartParsing = async () => {
    if (!selectedFile && !pastedText.trim()) {
      setError('Silakan pilih berkas dokumen pedoman atau tempel teks dokumen peraturan');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      let fileName = selectedFile ? selectedFile.name : 'Dokumen_Pedoman_Klasifikasi.txt';
      let fileType = selectedFile ? selectedFile.type : 'text/plain';
      let textContent: string | undefined = undefined;
      let base64Data: string | undefined = undefined;

      if (selectedFile) {
        if (selectedFile.type === 'application/pdf') {
          // Convert PDF to base64
          base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              // strip data:application/pdf;base64,
              const base64 = res.split(',')[1] || res;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
        } else {
          // Text, CSV, JSON, MD
          textContent = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(selectedFile);
          });
        }
      } else {
        textContent = pastedText.trim();
      }

      const res = await api.parseGuidelineUpload({
        fileName,
        fileType,
        textContent,
        base64Data,
      });

      if (!res.parsed || res.parsed.codes.length === 0) {
        throw new Error('Tidak ditemukan daftar kode klasifikasi yang valid di dalam dokumen');
      }

      setVersionName(res.parsed.versionName);
      setEffectiveDate(res.parsed.effectiveDate);
      setDescription(res.parsed.description);
      setExtractedCodes(res.parsed.codes);
      setActiveStep('preview');
    } catch (err: any) {
      setError(err.message || 'Gagal mengekstraksi dokumen pedoman');
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveAndApply = async () => {
    if (!versionName.trim()) {
      setError('Nama versi pedoman tidak boleh kosong');
      return;
    }
    if (extractedCodes.length === 0) {
      setError('Daftar kode pedoman kosong');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await api.applyUploadedGuideline({
        versionName: versionName.trim(),
        effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
        description: description.trim(),
        codes: extractedCodes,
        makeActive,
      });

      setActiveStep('done');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan dan menerapkan pedoman baru');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const sampleCsv = `Kode,Judul,Hierarki,Deskripsi,Catatan Penggunaan,Kata Kunci
KP,Kepegawaian,Kepegawaian,Pengelolaan SDM dan aparatur negara,Kelompok induk,kepegawaian;sdm;pegawai
KP.01,Pengadaan Pegawai,Kepegawaian > Pengadaan Pegawai,Rekrutmen dan formasi pegawai,Sub masalah pengadaan,pengadaan;rekrutmen;formasi
KP.01.01,Formasi Pegawai,Kepegawaian > Pengadaan Pegawai > Formasi Pegawai,Usulan formasi kebutuhan CPNS dan PPPK,Khusus usulan formasi ke MenPANRB,usulan formasi;kebutuhan pegawai;cpns
KU,Keuangan,Keuangan,Tata kelola anggaran dan perbendaharaan,Kelompok induk keuangan,keuangan;anggaran;dipa
KU.01,Perencanaan Anggaran,Keuangan > Perencanaan Anggaran,Penyusunan RKA dan DIPA,Perencanaan fiskal tahunan,rka kl;anggaran;pagu
KU.01.01,Penyusunan RKA-K/L,Keuangan > Perencanaan Anggaran > Penyusunan RKA-K/L,Rapat pembahasan pagu indikatif dan rka,Fokus pada penyusunan rencana anggaran,rka;penyusunan anggaran;rapat anggaran`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template-pedoman-klasifikasi-arsip.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4 text-indigo-600" />
              Upload Dokumen Pedoman Klasifikasi Arsip
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Unggah berkas peraturan, SK, atau daftar klasifikasi resmi sebagai acuan utama rekomendasi AI Agent.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-6 text-xs font-semibold">
          <div className={`flex items-center gap-1.5 ${activeStep === 'upload' ? 'text-slate-900' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 'upload' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              1
            </span>
            <span>Unggah Berkas / Teks Dokumen</span>
          </div>

          <span className="text-slate-300">/</span>

          <div className={`flex items-center gap-1.5 ${activeStep === 'preview' ? 'text-slate-900' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 'preview' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
              2
            </span>
            <span>Pratinjau Ekstraksi & Validasi</span>
          </div>

          <span className="text-slate-300">/</span>

          <div className={`flex items-center gap-1.5 ${activeStep === 'done' ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${activeStep === 'done' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
              3
            </span>
            <span>Terapkan sebagai Acuan</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3 text-xs text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleStartParsing}
                disabled={isParsing}
                className="shrink-0 px-2.5 py-1 text-[11px] font-semibold bg-white border border-red-300 hover:bg-red-50 text-red-700 rounded transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* STEP 1: UPLOAD DOKUMEN */}
          {activeStep === 'upload' && (
            <div className="space-y-4 text-xs">
              {/* Presets & Template helper */}
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Format: PDF, CSV, Excel/TXT, Markdown, JSON</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadSampleCsv}
                    className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                  >
                    <Download className="w-3 h-3 text-slate-400" />
                    Unduh Template CSV
                  </button>
                  <span className="text-slate-300">·</span>
                  <button
                    type="button"
                    onClick={handleUsePreset}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Contoh Peraturan Kesehatan 2026
                  </button>
                </div>
              </div>

              {/* Drag and Drop File Upload Area */}
              <div className="border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 text-center transition-colors bg-slate-50/50">
                <input
                  type="file"
                  id="guideline-file-upload"
                  accept=".pdf,.csv,.txt,.json,.md,.tsv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="guideline-file-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-500">
                    <Upload className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900">
                      Klik untuk memilih berkas dokumen pedoman
                    </span>
                    <span className="text-slate-500 block text-[11px] mt-0.5">
                      atau seret berkas PDF peraturan pedoman, CSV, atau tabel klasifikasi Anda ke sini
                    </span>
                  </div>
                  {selectedFile && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{selectedFile.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({Math.round(selectedFile.size / 1024)} KB)
                      </span>
                    </div>
                  )}
                </label>
              </div>

              {/* Or Paste Plain Text / Circular Text */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Atau Tempel Salinan Teks Peraturan / Pedoman Klasifikasi:
                  </label>
                  {pastedText && (
                    <button
                      type="button"
                      onClick={() => setPastedText('')}
                      className="text-[11px] text-slate-400 hover:text-slate-600"
                    >
                      Hapus teks
                    </button>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    if (e.target.value) setSelectedFile(null);
                  }}
                  placeholder="Tempel salinan pasal, lampiran tabel kode, atau daftar hierarki pola klasifikasi di sini..."
                  className="w-full p-3 font-mono text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                />
              </div>

              {/* AI Extraction Explanation */}
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg flex items-start gap-2.5 text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-[11px]">AI Document Structuring Engine</div>
                  <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                    Sistem akan membaca dokumen secara menyeluruh menggunakan Gemini, memetakan hierarki masalah (Pokok, Sub, Sub-sub Masalah), mendeteksi catatan penggunaan dan kata kunci acuan secara otomatis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & VALIDATION */}
          {activeStep === 'preview' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700">Nama Versi Dokumen Pedoman</label>
                  <input
                    type="text"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Tanggal Mulai Berlaku</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Deskripsi / Ruang Lingkup Peraturan</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              {/* Extraction Summary & Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-950">
                      {extractedCodes.length} Butir Kode Terdeteksi
                    </span>
                    <span className="text-[11px] text-emerald-800 ml-1.5 hidden sm:inline">
                      · Anda dapat mengoreksi kode, judul, dan menghapus baris sebelum disimpan
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAutoClean}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                    title="Bersihkan awalan penomoran dan rapikan format kode secara otomatis"
                  >
                    <Wand2 className="w-3 h-3 text-indigo-600" />
                    <span>Rapikan Otomatis</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCode}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                  >
                    <Plus className="w-3 h-3 text-emerald-600" />
                    <span>Tambah Baris</span>
                  </button>
                </div>
              </div>

              {/* Search in preview */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari kode atau judul dalam pratinjau hasil ekstraksi..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
                />
              </div>

              {/* Extracted Codes Editable Table Preview */}
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3 w-32">Kode Klasifikasi</th>
                      <th className="py-2 px-3">Judul / Uraian Masalah</th>
                      <th className="py-2 px-3 min-w-[180px]">Hierarki</th>
                      <th className="py-2 px-2 w-20 text-center">Level</th>
                      <th className="py-2 px-2 w-10 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreviewCodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 text-xs">
                          Tidak ada kode yang cocok dengan kata pencarian
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewCodes.map((c, i) => {
                        const originalIndex = extractedCodes.findIndex((orig) => orig === c);
                        return (
                          <tr key={i} className="hover:bg-slate-50/70 group">
                            <td className="py-1.5 px-3 align-top">
                              <input
                                type="text"
                                value={c.code}
                                onChange={(e) => handleUpdateCode(originalIndex, 'code', e.target.value)}
                                className="w-full font-mono font-bold text-slate-900 bg-slate-50/50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-slate-900 rounded px-1.5 py-1 text-xs"
                              />
                            </td>
                            <td className="py-1.5 px-3 align-top space-y-1">
                              <input
                                type="text"
                                value={c.title}
                                onChange={(e) => handleUpdateCode(originalIndex, 'title', e.target.value)}
                                className="w-full font-medium text-slate-900 bg-slate-50/50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-slate-900 rounded px-1.5 py-1 text-xs"
                              />
                              {c.usage_note && (
                                <div className="text-[10px] text-amber-700 px-1 italic">
                                  Catatan: {c.usage_note}
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 px-3 align-top">
                              <input
                                type="text"
                                value={c.hierarchy}
                                onChange={(e) => handleUpdateCode(originalIndex, 'hierarchy', e.target.value)}
                                className="w-full text-slate-500 text-[11px] bg-slate-50/50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-slate-900 rounded px-1.5 py-1"
                              />
                            </td>
                            <td className="py-1.5 px-2 align-top text-center">
                              <select
                                value={c.level}
                                onChange={(e) => handleUpdateCode(originalIndex, 'level', Number(e.target.value))}
                                className="text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded px-1 py-1"
                              >
                                <option value={1}>Lvl 1</option>
                                <option value={2}>Lvl 2</option>
                                <option value={3}>Lvl 3</option>
                              </select>
                            </td>
                            <td className="py-1.5 px-2 align-top text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteCode(originalIndex)}
                                className="p-1 text-slate-300 hover:text-red-600 rounded transition-colors"
                                title="Hapus butir ini"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Set Active Checkbox */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Jadikan Sebagai Pedoman Acuan Aktif
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Jika dicentang, AI Agent pada menu "Klasifikasi Surat" akan langsung menggunakan pedoman ini sebagai sumber rujukan utama.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
              </div>
            </div>
          )}

          {/* STEP 3: DONE */}
          {activeStep === 'done' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Pedoman Klasifikasi Berhasil Diterapkan!
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Dokumen "<strong>{versionName}</strong>" dengan total {extractedCodes.length} butir kode kini telah resmi dimuat dan siap digunakan sebagai dasar klasifikasi naskah dinas.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {activeStep === 'upload' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleStartParsing}
                disabled={isParsing || (!selectedFile && !pastedText.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
              >
                {isParsing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengekstraksi Dokumen...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Ekstraksi Dokumen Pedoman</span>
                  </>
                )}
              </button>
            </>
          )}

          {activeStep === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setActiveStep('upload')}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Kembali ke Upload
              </button>
              <button
                type="button"
                onClick={handleSaveAndApply}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menyimpan ke Basis Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Simpan & Terapkan Sebagai Acuan</span>
                  </>
                )}
              </button>
            </>
          )}

          {activeStep === 'done' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                Selesai & Buka Pedoman
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
