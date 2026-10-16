/**
 * Data Model Types for AI Agent Klasifikasi Arsip Surat
 * Conforms to PRD data_model specifications
 */

export type UserRole = 'petugas' | 'pimpinan' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
}

export interface GuidelineVersion {
  id: string;
  name: string;
  effective_date: string;
  is_active: boolean;
  description: string;
  total_codes?: number;
}

export interface GuidelineCode {
  id: string;
  version_id: string;
  code: string;
  title: string;
  description: string;
  level: number; // 1 = Pokok Masalah, 2 = Sub Masalah, 3 = Sub-sub Masalah
  parent_code: string | null;
  hierarchy: string; // e.g. "Keuangan > Anggaran > Perencanaan Anggaran"
  usage_note?: string;
  keywords: string[];
}

export interface DocumentRecord {
  id: string;
  description_text: string;
  unit?: string;
  letter_type?: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface ClassificationAlternative {
  code: string;
  title: string;
  hierarchy: string;
  difference: string;
}

export interface AnalysisSummary {
  content: string;
  function: string;
  activity: string;
}

export type RecommendationStatus = 'ditemukan' | 'ambigu' | 'tidak_ditemukan';

export interface Recommendation {
  id: string;
  document_id: string;
  version_id: string;
  version_name: string;
  primary_code: string | null;
  primary_title: string | null;
  primary_hierarchy: string | null;
  primary_reason: string;
  confidence: number;
  alternatives: ClassificationAlternative[];
  reference_valid: boolean;
  status: RecommendationStatus;
  ai_duration_seconds: number;
  analysis?: AnalysisSummary;
  need_more_info?: string | null;
  created_at: string;
}

export type VerificationDecision = 'approved' | 'alternative_chosen' | 'corrected';

export interface Verification {
  id: string;
  recommendation_id: string;
  document_id: string;
  decision: VerificationDecision;
  final_code: string;
  final_title: string;
  final_hierarchy: string;
  note?: string;
  verified_by: string;
  verified_by_name: string;
  verified_at: string;
  verification_seconds: number;
}

export interface SimilarDocumentItem {
  document_id: string;
  description_text: string;
  unit?: string;
  letter_type?: string;
  final_code: string;
  final_title: string;
  final_hierarchy: string;
  verified_at: string;
  verified_by_name: string;
  similarity_score: number;
}

export interface MetricsSummary {
  m1_average_time_minutes: number;
  m1_baseline_minutes: number;
  m1_reduction_percent: number;
  m2_conformity_percent: number; // target >= 85%
  m2_approved_count: number;
  m2_total_verifications: number;
  m3_correction_rate_percent: number; // target <= 10%
  m3_corrected_count: number;
  m4_valid_reference_percent: number; // target 100%
  m4_valid_count: number;
  m4_total_recommendations: number;
  total_documents_processed: number;
  status_distribution: {
    ditemukan: number;
    ambigu: number;
    tidak_ditemukan: number;
  };
  decision_distribution: {
    approved: number;
    alternative_chosen: number;
    corrected: number;
  };
  recent_trend: {
    date: string;
    total: number;
    approved: number;
    corrected: number;
    avg_seconds: number;
  }[];
}
