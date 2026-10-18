import {
  User,
  GuidelineVersion,
  GuidelineCode,
  DocumentRecord,
  Recommendation,
  Verification,
  SimilarDocumentItem,
  HistoryItem,
  MetricsSummary,
} from './types.ts';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.status} ${res.statusText}`;
    if (res.status === 413) {
      errMsg = 'Ukuran berkas melebihi batas upload server (maksimal ~3.5 MB di Vercel). Silakan gunakan opsi Tempel Teks Dokumen atau unggah dokumen dalam format TXT/CSV/JSON yang lebih ringkas.';
    } else if (res.status === 404) {
      errMsg = 'Layanan API tidak ditemukan (404). Pastikan backend Vercel Serverless Function aktif.';
    } else if (res.status === 504) {
      errMsg = 'Proses server mengalami waktu habis (504 Gateway Timeout). Silakan gunakan berkas berukuran lebih kecil atau tempel teks langsung.';
    } else {
      try {
        const data = await res.json();
        if (data.error) errMsg = data.error;
      } catch {
        // ignore
      }
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Auth & User
  getCurrentUser: () => request<{ currentUser: User; allUsers: User[] }>('/api/auth/current-user'),
  switchUser: (userId: string) =>
    request<{ currentUser: User }>('/api/auth/switch-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Guidelines
  getActiveGuideline: () =>
    request<{ version: GuidelineVersion; total_codes: number }>('/api/guidelines/active'),
  getAllVersions: () => request<{ versions: GuidelineVersion[] }>('/api/guidelines/versions'),
  activateVersion: (version_id: string) =>
    request<{ success: boolean; activeVersion: GuidelineVersion }>('/api/guidelines/activate', {
      method: 'POST',
      body: JSON.stringify({ version_id }),
    }),
  getCodes: (query?: string, level?: number, version_id?: string) => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (level) params.append('level', level.toString());
    if (version_id) params.append('version_id', version_id);
    return request<{ codes: GuidelineCode[] }>(`/api/guidelines/codes?${params.toString()}`);
  },
  getHierarchy: () =>
    request<{ tree: GuidelineCode[]; total_codes: number; version: GuidelineVersion }>(
      '/api/guidelines/hierarchy'
    ),
  createCode: (data: Partial<GuidelineCode>) =>
    request<{ code: GuidelineCode }>('/api/guidelines/codes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCode: (id: string, data: Partial<GuidelineCode>) =>
    request<{ code: GuidelineCode }>(`/api/guidelines/codes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCode: (id: string) =>
    request<{ success: boolean }>(`/api/guidelines/codes/${id}`, {
      method: 'DELETE',
    }),
  importGuidelines: (data: {
    version_name: string;
    effective_date?: string;
    description?: string;
    codes: Partial<GuidelineCode>[];
  }) =>
    request<{ success: boolean; version: GuidelineVersion; imported_codes_count: number }>(
      '/api/guidelines/import',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  parseGuidelineUpload: (data: {
    fileName: string;
    fileType: string;
    textContent?: string;
    base64Data?: string;
  }) =>
    request<{
      success: boolean;
      parsed: {
        versionName: string;
        effectiveDate: string;
        description: string;
        codes: Omit<GuidelineCode, 'id' | 'version_id'>[];
      };
    }>('/api/guidelines/parse-upload', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyUploadedGuideline: (data: {
    versionName: string;
    effectiveDate: string;
    description: string;
    codes: Omit<GuidelineCode, 'id' | 'version_id'>[];
    makeActive: boolean;
  }) =>
    request<{
      success: boolean;
      version: GuidelineVersion;
      is_active: boolean;
      total_codes: number;
    }>('/api/guidelines/apply-uploaded', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Classification Agent
  classify: (data: { description_text: string; unit?: string; letter_type?: string }) =>
    request<{
      document: DocumentRecord;
      recommendation: Recommendation;
      candidates: GuidelineCode[];
      similarDocuments: SimilarDocumentItem[];
    }>('/api/classify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  batchClassify: (items: { description_text: string; unit?: string; letter_type?: string }[]) =>
    request<{
      total_processed: number;
      results: { document: DocumentRecord; recommendation: Recommendation }[];
    }>('/api/batch-classify', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  // Verification (FR-07, FR-08)
  verify: (data: {
    recommendation_id: string;
    document_id: string;
    decision: 'approved' | 'alternative_chosen' | 'corrected';
    final_code: string;
    note?: string;
    verification_seconds?: number;
  }) =>
    request<{ success: boolean; verification: Verification }>('/api/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Similar Documents
  getSimilarDocuments: (query: string, current_id?: string) =>
    request<{ similarDocuments: SimilarDocumentItem[] }>(
      `/api/documents/similar?query=${encodeURIComponent(query)}${current_id ? `&current_id=${current_id}` : ''}`
    ),

  // History & Audit
  getHistory: (options?: { search?: string; decision?: string; officer_id?: string }) => {
    const params = new URLSearchParams();
    if (options?.search) params.append('search', options.search);
    if (options?.decision) params.append('decision', options.decision);
    if (options?.officer_id) params.append('officer_id', options.officer_id);
    return request<{ history: HistoryItem[] }>(`/api/history?${params.toString()}`);
  },

  // Dashboard Metrics
  getMetrics: (officer_id?: string) => {
    const params = new URLSearchParams();
    if (officer_id) params.append('officer_id', officer_id);
    return request<MetricsSummary>(`/api/metrics?${params.toString()}`);
  },
};
