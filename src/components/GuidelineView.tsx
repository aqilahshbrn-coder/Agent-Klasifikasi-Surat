import React, { useState, useEffect } from 'react';
import { User, GuidelineCode, GuidelineVersion } from '../types.ts';
import { api } from '../api.ts';
import { UploadGuidelineModal } from './UploadGuidelineModal.tsx';
import {
  Search,
  BookOpen,
  Folder,
  FolderOpen,
  FileCode,
  Plus,
  Upload,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Info,
  Shield,
  Edit2,
  Trash2,
  FileUp,
} from 'lucide-react';

interface GuidelineViewProps {
  currentUser: User | null;
}

export const GuidelineView: React.FC<GuidelineViewProps> = ({ currentUser }) => {
  const [activeVersion, setActiveVersion] = useState<GuidelineVersion | null>(null);
  const [allVersions, setAllVersions] = useState<GuidelineVersion[]>([]);
  const [codes, setCodes] = useState<GuidelineCode[]>([]);
  const [treeData, setTreeData] = useState<GuidelineCode[]>([]);
  const [selectedCode, setSelectedCode] = useState<GuidelineCode | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [levelFilter, setLevelFilter] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Expanded nodes in tree
  const [expandedNodes, setExpandedNodes] = useState<{ [code: string]: boolean }>({
    KP: true,
    KU: true,
    UM: true,
  });

  // Modal States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [newCodeForm, setNewCodeForm] = useState({
    code: '',
    title: '',
    description: '',
    level: 3,
    parent_code: '',
    hierarchy: '',
    usage_note: '',
    keywords: '',
  });

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    loadGuidelineData();
  }, []);

  const loadGuidelineData = async () => {
    setIsLoading(true);
    try {
      const [verRes, allVersRes, hierRes, codesRes] = await Promise.all([
        api.getActiveGuideline(),
        api.getAllVersions(),
        api.getHierarchy(),
        api.getCodes(),
      ]);

      setActiveVersion(verRes.version);
      setAllVersions(allVersRes.versions);
      setTreeData(hierRes.tree);
      setCodes(codesRes.codes);
      if (codesRes.codes.length > 0) {
        setSelectedCode(codesRes.codes[0]);
      }
    } catch (e: any) {
      console.error('Failed to load guidelines:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    try {
      const res = await api.getCodes(q, levelFilter || undefined);
      setCodes(res.codes);
      if (res.codes.length > 0 && (!selectedCode || !res.codes.some((c) => c.id === selectedCode.id))) {
        setSelectedCode(res.codes[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleNode = (code: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [code]: !prev[code],
    }));
  };

  const handleActivateVersion = async (vId: string) => {
    if (!isAdmin) return;
    try {
      await api.activateVersion(vId);
      loadGuidelineData();
    } catch (e: any) {
      alert(`Gagal mengaktifkan versi: ${e.message}`);
    }
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await api.createCode({
        code: newCodeForm.code,
        title: newCodeForm.title,
        description: newCodeForm.description,
        level: Number(newCodeForm.level),
        parent_code: newCodeForm.parent_code || null,
        hierarchy: newCodeForm.hierarchy,
        usage_note: newCodeForm.usage_note,
        keywords: newCodeForm.keywords.split(',').map((k) => k.trim()).filter(Boolean),
      });
      setIsAddModalOpen(false);
      setNewCodeForm({
        code: '',
        title: '',
        description: '',
        level: 3,
        parent_code: '',
        hierarchy: '',
        usage_note: '',
        keywords: '',
      });
      loadGuidelineData();
    } catch (e: any) {
      alert(`Gagal menambah butir pedoman: ${e.message}`);
    }
  };

  const handleDeleteCode = async (id: string, code: string) => {
    if (!isAdmin) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus butir pedoman "${code}"?`)) return;

    try {
      await api.deleteCode(id);
      loadGuidelineData();
    } catch (e: any) {
      alert(`Gagal menghapus butir: ${e.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Basis Pengetahuan Pedoman Klasifikasi Arsip
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Satu-satunya sumber rujukan resmi klasifikasi naskah dinas (FR-02) yang digunakan oleh AI Agent dan Petugas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Dokumen Pedoman
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Butir Manual
            </button>
          )}
        </div>
      </div>

      {/* Version Status & Administration Card */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Versi Pedoman Aktif:
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle className="w-3 h-3" /> Berstatus Aktif
            </span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {activeVersion?.name || 'Pedoman Klasifikasi Pola Baku'}
          </div>
          <div className="text-xs text-slate-500">
            Tanggal Berlaku: {activeVersion?.effective_date || '2026-01-01'} · Total Butir Terdaftar:{' '}
            <strong className="font-mono text-slate-700">{codes.length}</strong> kode
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-indigo-600" />
            Unggah Dokumen Acuan Baru
          </button>

          {isAdmin && allVersions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Pilih Versi:</span>
              <select
                value={activeVersion?.id}
                onChange={(e) => handleActivateVersion(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 font-medium text-slate-800"
              >
                {allVersions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.is_active ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Search & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cari kode (KU.01.01), uraian, atau kata kunci (anggaran, rapat)..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 bg-white"
          />
        </div>

        {/* View Switcher & Level Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'tree' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hierarki Pohon
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Explorer Layout: Tree/Table on Left (7 cols) + Code Inspector Drawer on Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Tree View or Table View */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-xs overflow-hidden">
          {viewMode === 'tree' ? (
            /* Tree View (FR-13) */
            <div className="space-y-1 max-h-[640px] overflow-y-auto pr-1">
              {treeData.map((l1) => {
                const isL1Expanded = !!expandedNodes[l1.code];
                const isL1Selected = selectedCode?.id === l1.id;

                return (
                  <div key={l1.id} className="space-y-1">
                    {/* Level 1 Node (Pokok Masalah) */}
                    <div
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs font-semibold transition-colors ${
                        isL1Selected ? 'bg-indigo-50/80 text-indigo-900' : 'hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      <div
                        className="flex items-center gap-2 flex-1"
                        onClick={() => setSelectedCode(l1)}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleNode(l1.code);
                          }}
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {isL1Expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-mono px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 text-[11px]">
                          {l1.code}
                        </span>
                        <span>{l1.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal">
                        Pokok Masalah
                      </span>
                    </div>

                    {/* Level 2 Children (Sub Masalah) */}
                    {isL1Expanded && l1.children && (
                      <div className="ml-5 pl-2 border-l border-slate-200 space-y-1">
                        {l1.children.map((l2) => {
                          const isL2Expanded = !!expandedNodes[l2.code];
                          const isL2Selected = selectedCode?.id === l2.id;

                          return (
                            <div key={l2.id} className="space-y-1">
                              {/* Level 2 Item */}
                              <div
                                className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                                  isL2Selected ? 'bg-indigo-50/80 font-semibold text-indigo-900' : 'hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <div
                                  className="flex items-center gap-2 flex-1"
                                  onClick={() => setSelectedCode(l2)}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNode(l2.code);
                                    }}
                                    className="p-0.5 text-slate-400 hover:text-slate-700"
                                  >
                                    {isL2Expanded ? (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <span className="font-mono text-[11px] text-slate-700">
                                    {l2.code}
                                  </span>
                                  <span>{l2.title}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">
                                  Sub Masalah
                                </span>
                              </div>

                              {/* Level 3 Children (Sub-sub Masalah) */}
                              {isL2Expanded && l2.children && (
                                <div className="ml-5 pl-2 border-l border-slate-100 space-y-0.5">
                                  {l2.children.map((l3) => {
                                    const isL3Selected = selectedCode?.id === l3.id;
                                    return (
                                      <div
                                        key={l3.id}
                                        onClick={() => setSelectedCode(l3)}
                                        className={`flex items-center justify-between p-1.5 rounded-md cursor-pointer text-xs transition-colors ${
                                          isL3Selected
                                            ? 'bg-slate-900 text-white font-medium shadow-xs'
                                            : 'hover:bg-slate-100/80 text-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 truncate">
                                          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isL3Selected ? 'text-indigo-300' : 'text-slate-400'}`} />
                                          <span className={`font-mono text-[11px] ${isL3Selected ? 'text-white' : 'text-slate-900 font-bold'}`}>
                                            {l3.code}
                                          </span>
                                          <span className="truncate">{l3.title}</span>
                                        </div>
                                        <span className={`text-[10px] ${isL3Selected ? 'text-indigo-200' : 'text-slate-400'} shrink-0 ml-2`}>
                                          Sub-sub
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table List View */
            <div className="max-h-[640px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                    <th className="py-2.5 px-3 w-24">Kode</th>
                    <th className="py-2.5 px-3">Uraian / Judul</th>
                    <th className="py-2.5 px-3 w-20 text-center">Tingkat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {codes.map((c) => {
                    const isSelected = selectedCode?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedCode(c)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-50/80 font-semibold text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                          {c.code}
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{c.title}</div>
                          <div className="text-[10px] text-slate-400">{c.hierarchy}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center text-[10px] text-slate-500">
                          Lvl {c.level}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Code Inspector Details */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-xs sticky top-24">
          {selectedCode ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xl text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                      {selectedCode.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                      Level {selectedCode.level} ({selectedCode.level === 1 ? 'Pokok Masalah' : selectedCode.level === 2 ? 'Sub Masalah' : 'Sub-sub Masalah'})
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {selectedCode.title}
                  </h3>
                </div>

                {isAdmin && (
                  <button
                    onClick={() => handleDeleteCode(selectedCode.id, selectedCode.code)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    title="Hapus butir pedoman"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Hierarchy Path */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Hierarki Pedoman Resmi:
                </span>
                <span className="font-medium text-slate-800">
                  {selectedCode.hierarchy}
                </span>
              </div>

              {/* Description */}
              <div className="space-y-1 text-xs">
                <span className="font-semibold text-slate-700 block">Deskripsi & Ruang Lingkup:</span>
                <p className="text-slate-600 leading-relaxed">
                  {selectedCode.description}
                </p>
              </div>

              {/* Usage Note */}
              {selectedCode.usage_note && (
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-amber-900 block">Catatan Penggunaan & Batasan:</span>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    {selectedCode.usage_note}
                  </p>
                </div>
              )}

              {/* Keywords */}
              {selectedCode.keywords && selectedCode.keywords.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="font-semibold text-slate-700 block">Kata Kunci Acuan Pencocokan AI:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCode.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 text-[11px] font-mono text-slate-600 bg-slate-100 rounded border border-slate-200"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500">
              Pilih butir pedoman pada daftar sebelah kiri untuk melihat rincian acuan.
            </div>
          )}
        </div>
      </div>

      {/* Admin: Modal Tambah Kode Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Tambah Butir Kode Pedoman Baru (Admin)
            </h3>

            <form onSubmit={handleCreateCode} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Klasifikasi (mis. TI.03.02)</label>
                <input
                  type="text"
                  required
                  value={newCodeForm.code}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, code: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Judul / Uraian Masalah</label>
                <input
                  type="text"
                  required
                  value={newCodeForm.title}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, title: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Hierarki Lengkap (Pokok &gt; Sub &gt; Sub-sub)</label>
                <input
                  type="text"
                  required
                  placeholder="Mis. Teknologi Informasi > Keamanan Siber > Penanganan Insiden"
                  value={newCodeForm.hierarchy}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, hierarchy: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Ruang Lingkup</label>
                <textarea
                  rows={2}
                  required
                  value={newCodeForm.description}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, description: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Penggunaan (Opsional)</label>
                <input
                  type="text"
                  value={newCodeForm.usage_note}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, usage_note: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kata Kunci (Pisahkan dengan koma)</label>
                <input
                  type="text"
                  placeholder="insiden, siber, malware, laporan gangguan"
                  value={newCodeForm.keywords}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, keywords: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-semibold text-white bg-slate-900 rounded-lg shadow-xs"
                >
                  Simpan Butir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Dokumen Pedoman Modal */}
      <UploadGuidelineModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          loadGuidelineData();
        }}
      />
    </div>
  );
};
