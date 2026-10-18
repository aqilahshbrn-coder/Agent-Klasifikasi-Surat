import { GoogleGenAI, Type } from '@google/genai';
import { db } from './db';
import { GuidelineCode, Recommendation } from './types';

// Server-side initialization with mandatory User-Agent header for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export interface GeminiClassificationResult {
  status: 'ditemukan' | 'ambigu' | 'tidak_ditemukan';
  primary: {
    code: string;
    title: string;
    hierarchy: string;
    reason: string;
  } | null;
  alternatives: {
    code: string;
    title: string;
    hierarchy: string;
    difference: string;
  }[];
  confidence: number;
  analysis: {
    content: string;
    function: string;
    activity: string;
  };
  need_more_info?: string | null;
}

const SYSTEM_INSTRUCTION = `Anda adalah asisten klasifikasi arsip untuk petugas persuratan. Anda menerima (a) gambaran isi sebuah dokumen dan (b) daftar KANDIDAT kode klasifikasi dari pedoman resmi instansi (kode, uraian, hierarki, catatan penggunaan). 
Tugas: analisis isi, fungsi, dan kegiatan yang tercermin dalam gambaran isi, lalu pilih kode yang paling sesuai. 
Aturan wajib:
(1) Hanya boleh memilih kode yang ada pada daftar KANDIDAT; DILARANG KERAS mengarang kode, uraian, atau rujukan.
(2) Setiap rekomendasi wajib menyertakan rujukan berupa kode, uraian, dan hierarki persis seperti pada kandidat.
(3) Jika gambaran isi ambigu atau terdapat beberapa tafsir kegiatan/fasilitas, berikan 2-3 alternatif berurut beserta perbedaan dan alasan, serta turunkan tingkat confidence (< 0.85).
(4) Jika tidak ada kandidat yang cocok atau informasi terlalu minim, set status 'tidak_ditemukan' dan primary null, jangan memaksakan pilihan.
(5) Jangan memakai pengetahuan di luar kandidat resmi yang diberikan.
(6) Anda hanya merekomendasikan, keputusan akhir ada pada petugas.
(7) Tulis alasan dalam Bahasa Indonesia yang ringkas (maksimal 3 kalimat), sebutkan kata kunci dari gambaran isi yang mendukung pilihan.
Keluaran harus JSON murni sesuai skema.`;

export async function runClassificationAgent(params: {
  description_text: string;
  unit?: string;
  letter_type?: string;
}): Promise<{
  result: GeminiClassificationResult;
  candidates: GuidelineCode[];
  durationSeconds: number;
}> {
  const startTime = Date.now();
  const activeVersion = db.getActiveGuidelineVersion();

  // Step 1: Candidate retrieval from the official guideline database
  const candidates = db.retrieveCandidateCodes(params.description_text, 10);

  // If no candidates or database empty
  if (candidates.length === 0) {
    const elapsed = (Date.now() - startTime) / 1000;
    return {
      result: {
        status: 'tidak_ditemukan',
        primary: null,
        alternatives: [],
        confidence: 0,
        analysis: {
          content: params.description_text,
          function: 'Tidak teridentifikasi',
          activity: 'Tidak ada kandidat kode dalam basis pedoman',
        },
        need_more_info: 'Mohon masukkan uraian perihal yang lebih spesifik atau periksa basis pedoman klasifikasi.',
      },
      candidates: [],
      durationSeconds: elapsed,
    };
  }

  // Format candidates for prompt
  const candidateListStr = candidates
    .map(
      (c, i) =>
        `${i + 1}. [Kode: ${c.code}] [Judul: ${c.title}]\n   - Hierarki: ${c.hierarchy}\n   - Deskripsi: ${c.description}\n   - Catatan Penggunaan: ${c.usage_note || 'Tidak ada catatan khusus'}\n   - Kata Kunci: ${c.keywords.join(', ')}`
    )
    .join('\n\n');

  const userPrompt = `DOKUMEN YANG DIANALISIS:
- Gambaran Isi / Perihal: "${params.description_text}"
${params.unit ? `- Unit Pengolah: "${params.unit}"` : ''}
${params.letter_type ? `- Jenis Surat: "${params.letter_type}"` : ''}
- Versi Pedoman Aktif: "${activeVersion?.name || 'Pedoman Klasifikasi Nasional'}"

DAFTAR KANDIDAT KODE RESMI DARI PEDOMAN INSTANSI:
${candidateListStr}

Pilih kode klasifikasi yang paling tepat hanya dari daftar kandidat di atas sesuai pedoman!`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1, // low temperature for high consistency (NFR-04)
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: 'Status penemuan kode: ditemukan, ambigu, atau tidak_ditemukan',
            },
            primary: {
              type: Type.OBJECT,
              description: 'Rekomendasi kode utama (null jika tidak ditemukan)',
              properties: {
                code: { type: Type.STRING },
                title: { type: Type.STRING },
                hierarchy: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
            },
            alternatives: {
              type: Type.ARRAY,
              description: 'Alternatif kode jika ambigu atau ada sudut pandang lain',
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  title: { type: Type.STRING },
                  hierarchy: { type: Type.STRING },
                  difference: { type: Type.STRING },
                },
                required: ['code', 'title', 'hierarchy', 'difference'],
              },
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Tingkat keyakinan 0.0 - 1.0',
            },
            analysis: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                function: { type: Type.STRING },
                activity: { type: Type.STRING },
              },
              required: ['content', 'function', 'activity'],
            },
            need_more_info: {
              type: Type.STRING,
              description: 'Catatan bila deskripsi terlalu singkat atau kurang jelas',
            },
          },
          required: ['status', 'alternatives', 'confidence', 'analysis'],
        },
      },
    });

    const elapsed = Math.max(0.6, (Date.now() - startTime) / 1000);
    const textOutput = response.text || '{}';
    let parsed: GeminiClassificationResult;

    try {
      parsed = JSON.parse(textOutput);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON output:', parseError, textOutput);
      parsed = fallbackRuleBasedClassification(params.description_text, candidates);
    }

    // Step 3: Post-validation (Anti-hallucination guarantee NFR-03)
    const validated = postValidateClassification(parsed, activeVersion?.id);

    return {
      result: validated,
      candidates,
      durationSeconds: Math.round(elapsed * 10) / 10,
    };
  } catch (error) {
    console.error('Gemini API call failed, activating deterministic fallback:', error);
    const elapsed = Math.max(0.5, (Date.now() - startTime) / 1000);
    const fallback = fallbackRuleBasedClassification(params.description_text, candidates);
    const validated = postValidateClassification(fallback, activeVersion?.id);

    return {
      result: validated,
      candidates,
      durationSeconds: Math.round(elapsed * 10) / 10,
    };
  }
}

/**
 * Strict Post-Validation Engine:
 * - Checks every code against active guideline_codes table
 * - Eliminates hallucinated codes
 * - Overwrites title and hierarchy from official DB record
 * - Enforces status transition if primary is invalid
 */
function postValidateClassification(
  raw: GeminiClassificationResult,
  versionId?: string
): GeminiClassificationResult {
  const result: GeminiClassificationResult = {
    status: raw.status || 'tidak_ditemukan',
    primary: null,
    alternatives: [],
    confidence: typeof raw.confidence === 'number' ? Math.min(1, Math.max(0, raw.confidence)) : 0.7,
    analysis: raw.analysis || {
      content: 'Analisis perihal naskah dinas',
      function: 'Fungsi kedinasan instansi',
      activity: 'Pelaksanaan administrasi surat',
    },
    need_more_info: raw.need_more_info || null,
  };

  // Validate Primary
  if (raw.primary && raw.primary.code) {
    const dbCode = db.findCodeByCode(raw.primary.code, versionId);
    if (dbCode) {
      result.primary = {
        code: dbCode.code,
        title: dbCode.title, // Enforce official database title
        hierarchy: dbCode.hierarchy, // Enforce official database hierarchy
        reason: raw.primary.reason || `Sesuai butir klasifikasi ${dbCode.code} (${dbCode.title}).`,
      };
    } else {
      console.warn(`[Anti-Hallucination] Discarded non-existent primary code: ${raw.primary.code}`);
      result.status = 'tidak_ditemukan';
      result.confidence = 0.2;
    }
  } else {
    result.status = 'tidak_ditemukan';
  }

  // Validate Alternatives
  if (Array.isArray(raw.alternatives)) {
    for (const alt of raw.alternatives) {
      if (!alt.code) continue;
      // Don't duplicate primary
      if (result.primary && alt.code.toLowerCase() === result.primary.code.toLowerCase()) continue;

      const dbCode = db.findCodeByCode(alt.code, versionId);
      if (dbCode) {
        result.alternatives.push({
          code: dbCode.code,
          title: dbCode.title,
          hierarchy: dbCode.hierarchy,
          difference: alt.difference || `Alternatif jika fokus naskah lebih condong pada ${dbCode.title}.`,
        });
      } else {
        console.warn(`[Anti-Hallucination] Discarded non-existent alternative code: ${alt.code}`);
      }
    }
  }

  // Adjust status based on alternatives
  if (result.primary && result.alternatives.length > 0 && result.confidence < 0.85) {
    result.status = 'ambigu';
  } else if (result.primary) {
    result.status = 'ditemukan';
  }

  return result;
}

/**
 * Deterministic Fallback if network or quota issue occurs
 */
function fallbackRuleBasedClassification(
  text: string,
  candidates: GuidelineCode[]
): GeminiClassificationResult {
  if (candidates.length === 0) {
    return {
      status: 'tidak_ditemukan',
      primary: null,
      alternatives: [],
      confidence: 0,
      analysis: {
        content: text,
        function: 'Pencarian kata kunci',
        activity: 'Tidak ditemukan kecocokan',
      },
      need_more_info: 'Uraian tidak dapat dicocokkan dengan butir pedoman.',
    };
  }

  const primaryCandidate = candidates[0];
  const altCandidate = candidates.length > 1 ? candidates[1] : undefined;

  return {
    status: altCandidate ? 'ambigu' : 'ditemukan',
    primary: {
      code: primaryCandidate.code,
      title: primaryCandidate.title,
      hierarchy: primaryCandidate.hierarchy,
      reason: `Berdasarkan pencocokan kata kunci pada pedoman resmi untuk aktivitas terkait "${primaryCandidate.title}".`,
    },
    alternatives: altCandidate
      ? [
          {
            code: altCandidate.code,
            title: altCandidate.title,
            hierarchy: altCandidate.hierarchy,
            difference: `Alternatif jika penafsiran ditekankan pada aspek ${altCandidate.title}.`,
          },
        ]
      : [],
    confidence: altCandidate ? 0.72 : 0.88,
    analysis: {
      content: text,
      function: primaryCandidate.hierarchy.split(' > ')[0] || 'Administrasi',
      activity: primaryCandidate.title,
    },
    need_more_info: null,
  };
}

export interface ExtractedGuidelineCode {
  code: string;
  title: string;
  description: string;
  level: number;
  parent_code: string | null;
  hierarchy: string;
  usage_note?: string;
  keywords: string[];
}

export interface ExtractedGuidelineDoc {
  versionName: string;
  effectiveDate: string;
  description: string;
  codes: ExtractedGuidelineCode[];
}

/**
 * Intelligent Document Parser for Guideline Files (PDF, TXT, CSV, JSON, MD, DOCX)
 */
export async function parseGuidelineDocument(params: {
  fileName: string;
  fileType: string;
  textContent?: string;
  base64Data?: string;
}): Promise<ExtractedGuidelineDoc> {
  const { fileName, fileType, textContent, base64Data } = params;

  // 1. Direct JSON parser if JSON content or filename
  if (textContent && (fileName.endsWith('.json') || fileType.includes('json') || textContent.trim().startsWith('{') || textContent.trim().startsWith('['))) {
    const jsonResult = parseJsonGuideline(textContent, fileName);
    if (jsonResult && jsonResult.codes.length > 0) {
      console.log(`[GuidelineParser] Successfully parsed ${jsonResult.codes.length} codes via direct JSON parser.`);
      return jsonResult;
    }
  }

  // 2. Direct CSV / TSV parser if pure CSV / TSV / Delimited
  if (
    textContent &&
    (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileType.includes('csv') || fileType.includes('tab-separated'))
  ) {
    const csvResult = parseCsvGuideline(textContent, fileName);
    if (csvResult && csvResult.codes.length > 0) {
      console.log(`[GuidelineParser] Successfully parsed ${csvResult.codes.length} codes via direct CSV parser.`);
      return csvResult;
    }
  }

  // 3. Direct Markdown / Pipe Table parser if text has markdown table structure (| ... |)
  if (textContent && textContent.includes('|') && textContent.split('\n').filter((l) => l.trim().startsWith('|')).length >= 3) {
    const tableResult = parseMarkdownTableGuideline(textContent, fileName);
    if (tableResult && tableResult.codes.length > 0) {
      console.log(`[GuidelineParser] Successfully parsed ${tableResult.codes.length} codes via direct Table parser.`);
      return tableResult;
    }
  }

  // 4. Try AI Extraction via Gemini 3.8 Flash with strict prompt for document analysis
  const systemInstruction = `Anda adalah spesialis kearsipan instansi pemerintah Republik Indonesia (ANRI / Kementerian) yang bertugas mengekstraksi dokumen pedoman klasifikasi arsip naskah dinas menjadi basis data terstruktur.

DOKUMEN BERISI:
Daftar kode klasifikasi arsip dinamis (pola ANRI huruf-angka seperti 'KP.01.01', 'KU.02', 'HK.01' atau pola numerik Permendagri seperti '000', '045.1', '800'), nama uraian/judul masalah, hierarki masalah, dan catatan penggunaan.

ATURAN WAJIB EKSTRAKSI:
1. ATURAN KODE (code):
   - Ambil HANYA kode klasifikasi kearsipan resmi (misal: 'KP', 'KP.01', 'KP.01.01', 'KU.01', 'HK.02.01', '045', '045.1', '800', dsb).
   - DILARANG KERAS mengambil nomor urut tabel/baris (seperti "1", "2", "3", dst) sebagai kode!
   - DILARANG mengekstrak Bab atau Pasal peraturan (seperti "BAB I", "Pasal 1", "Pasal 2") sebagai kode!
   - Pisahkan kode dari uraian jika di dokumen tertulis menyatu (misal "KP.01 Pengadaan Pegawai" -> code: "KP.01", title: "Pengadaan Pegawai").

2. ATURAN JUDUL / URAIAN MASALAH (title):
   - Ambil nama perihal atau uraian masalah yang spesifik untuk butir kode tersebut.
   - Hapus nomor urut atau tanda baca dari awal judul (misal "1. Formasi Pegawai" -> judul yang benar adalah "Formasi Pegawai").
   - Jika dokumen memiliki kolom hierarki berjenjang (Pokok Masalah, Sub Masalah, Sub-sub Masalah), gunakan teks dari kolom masalah yang paling spesifik pada baris tersebut sebagai 'title'.
   - JANGAN masukkan nomor kode ke dalam title.

3. ATURAN HIERARKI (hierarchy):
   - Tulis hierarki lengkap dari Pokok Masalah hingga butir ini dipisahkan " > " (contoh: "Kepegawaian > Pengadaan Pegawai > Formasi Pegawai").

4. ATURAN LEVEL & INDUK:
   - level 1 untuk Pokok Masalah (misal 'KP' atau '000', parent_code: null).
   - level 2 untuk Sub Masalah (misal 'KP.01' atau '045', parent_code: 'KP' atau '000').
   - level 3 untuk Sub-sub Masalah (misal 'KP.01.01' atau '045.1', parent_code: 'KP.01' atau '045').

5. KELENGKAPAN OUTPUT:
   - Tulis deskripsi dan catatan secara singkat (1 kalimat padat) agar seluruh butir kode dapat termuat utuh dalam keluaran JSON tanpa terpotong batas token.
   - Ekstrak seluruh butir kode yang ada di dokumen.`;

  const contents: any[] = [];

  if (base64Data && fileType === 'application/pdf') {
    contents.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Data,
      },
    });
    contents.push({
      text: `Ekstraksi seluruh daftar kode klasifikasi arsip beserta hierarkinya dari dokumen "${fileName}" ini. Pastikan kode klasifikasi terpisah dari nama uraian masalah, dan nomor urut baris tidak dijadikan kode. Buat deskripsi ringkas agar seluruh kode termuat lengkap dalam JSON.`,
    });
  } else if (textContent) {
    contents.push({
      text: `DOKUMEN PEDOMAN KLASIFIKASI: "${fileName}"\n\nISI DOKUMEN:\n${textContent.slice(0, 50000)}\n\nEkstraksi seluruh kode klasifikasi arsip beserta nama uraian masalah dan hierarkinya. Pastikan kode klasifikasi terpisah dari uraian masalah. Buat deskripsi ringkas agar seluruh kode termuat lengkap dalam JSON.`,
    });
  } else {
    throw new Error('Dokumen kosong atau format tidak didukung');
  }

  let rawOutputText = '';

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      versionName: {
        type: Type.STRING,
        description: 'Nama dokumen/peraturan pedoman klasifikasi resmi',
      },
      effectiveDate: {
        type: Type.STRING,
        description: 'Tanggal berlaku format YYYY-MM-DD',
      },
      description: {
        type: Type.STRING,
        description: 'Deskripsi ringkas pedoman',
      },
      codes: {
        type: Type.ARRAY,
        description: 'Daftar kode klasifikasi yang diekstraksi dari dokumen',
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            level: { type: Type.INTEGER },
            parent_code: { type: Type.STRING, nullable: true },
            hierarchy: { type: Type.STRING },
            usage_note: { type: Type.STRING },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['code', 'title', 'description', 'level', 'hierarchy'],
        },
      },
    },
    required: ['versionName', 'codes'],
  };

  try {
    rawOutputText = await callGeminiExtractWithRetry(contents, systemInstruction, responseSchema);
    const parsedAiResult = repairAndParseGuidelineJson(rawOutputText, fileName);
    if (parsedAiResult && parsedAiResult.codes.length > 0) {
      console.log(`[GuidelineParser] Successfully extracted ${parsedAiResult.codes.length} codes via Gemini.`);
      return parsedAiResult;
    }
  } catch (error: any) {
    console.warn('[GuidelineParser] Gemini extraction attempt encountered error or limit, falling back to local heuristic parser:', error.message || error);
  }

  // 5. Intelligent Fallback: If AI returned partial text, salvage it
  if (rawOutputText) {
    try {
      const salvaged = repairAndParseGuidelineJson(rawOutputText, fileName);
      if (salvaged && salvaged.codes.length > 0) {
        console.log(`[GuidelineParser] Successfully salvaged ${salvaged.codes.length} codes from raw AI output.`);
        return salvaged;
      }
    } catch {
      // continue to heuristic text parsing
    }
  }

  // 6. Intelligent Fallback: Heuristic text list and table parser
  if (textContent && textContent.trim()) {
    const textFallback = parseTextFallback(textContent, fileName);
    if (textFallback && textFallback.codes.length > 0) {
      console.log(`[GuidelineParser] Extracted ${textFallback.codes.length} codes via intelligent text heuristic parser.`);
      return textFallback;
    }
  }

  // 7. Intelligent Fallback: PDF stream text parser
  if (base64Data) {
    const pdfText = extractTextFromPdfBase64(base64Data);
    if (pdfText && pdfText.trim()) {
      const pdfFallback = parseTextFallback(pdfText, fileName);
      if (pdfFallback && pdfFallback.codes.length > 0) {
        console.log(`[GuidelineParser] Extracted ${pdfFallback.codes.length} codes via PDF stream recovery parser.`);
        return pdfFallback;
      }
    }
  }

  throw new Error(
    'Tidak dapat mengekstraksi kode dan judul/uraian masalah dari berkas. Pastikan dokumen memuat daftar pola klasifikasi naskah dinas (contoh: KP.01 Pengadaan Pegawai atau format tabel klasifikasi resmi).'
  );
}

/**
 * Direct JSON guideline parser supporting multiple schemas & Indonesian field keys
 */
function parseJsonGuideline(text: string, fileName: string): ExtractedGuidelineDoc | null {
  try {
    const parsed = JSON.parse(text);
    let items: any[] = [];
    let docTitle = `Pedoman Klasifikasi (${fileName.replace(/\.[^/.]+$/, '')})`;
    let effDate = new Date().toISOString().split('T')[0];
    let docDesc = `Diimpor dari berkas ${fileName}`;

    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      docTitle = parsed.versionName || parsed.nama_pedoman || parsed.judul || docTitle;
      effDate = parsed.effectiveDate || parsed.tanggal_berlaku || effDate;
      docDesc = parsed.description || parsed.deskripsi || docDesc;

      const candidates = [
        parsed.codes,
        parsed.data,
        parsed.klasifikasi,
        parsed.pola_klasifikasi,
        parsed.daftar_kode,
        parsed.items,
        parsed.records,
        parsed.list,
      ];

      for (const cand of candidates) {
        if (Array.isArray(cand) && cand.length > 0) {
          items = cand;
          break;
        }
      }

      // Key-value map format e.g. { "KP.01": "Pengadaan Pegawai", "KP.01.01": "Formasi Pegawai" }
      if (items.length === 0 && !Array.isArray(parsed.codes)) {
        const entries = Object.entries(parsed).filter(([k, v]) => isValidCodeString(k) && typeof v === 'string');
        if (entries.length > 0) {
          items = entries.map(([code, title]) => ({ code, title }));
        }
      }
    }

    if (items.length === 0) return null;

    const normalizedCodes = items
      .map(normalizeCodeItem)
      .filter((c): c is ExtractedGuidelineCode => Boolean(c && c.code && c.title));

    if (normalizedCodes.length === 0) return null;

    return {
      versionName: docTitle,
      effectiveDate: effDate,
      description: docDesc,
      codes: enrichHierarchy(normalizedCodes),
    };
  } catch {
    return null;
  }
}

/**
 * Direct CSV / TSV guideline parser supporting Indonesian column variations and quoted fields
 */
function parseCsvGuideline(text: string, fileName: string): ExtractedGuidelineDoc | null {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length < 2) return null;

  // Determine separator (comma, semicolon, tab, pipe)
  const firstLine = rawLines[0];
  let sep = ',';
  if (firstLine.includes(';') && (firstLine.split(';').length >= firstLine.split(',').length)) {
    sep = ';';
  } else if (firstLine.includes('\t')) {
    sep = '\t';
  } else if (firstLine.includes('|')) {
    sep = '|';
  }

  const rows = rawLines.map((line) => splitCsvLine(line, sep));
  if (rows.length < 2) return null;

  const headerCols = rows[0].map((c) => c.toLowerCase().trim());

  // Flexible header column matching
  let codeIdx = headerCols.findIndex((c) => c === 'kode' || c === 'code' || c.includes('kode') || c === 'kd');
  let titleIdx = headerCols.findIndex(
    (c) =>
      c === 'judul' ||
      c === 'uraian' ||
      c === 'title' ||
      c.includes('uraian masalah') ||
      c.includes('nama masalah') ||
      c.includes('pola klasifikasi') ||
      c.includes('masalah') ||
      c.includes('perihal') ||
      c.includes('jenis arsip')
  );
  let pokokIdx = headerCols.findIndex((c) => c.includes('pokok masalah') || c === 'pokok');
  let subIdx = headerCols.findIndex((c) => c.includes('sub masalah') || c.includes('sub_masalah'));
  let subSubIdx = headerCols.findIndex((c) => c.includes('sub-sub') || c.includes('sub sub') || c.includes('sub_sub'));
  let hierIdx = headerCols.findIndex((c) => c.includes('hierarki') || c.includes('hierarchy') || c.includes('rumpun'));
  let descIdx = headerCols.findIndex((c) => c.includes('deskripsi') || c.includes('keterangan') || c.includes('description') || c.includes('rincian'));
  let noteIdx = headerCols.findIndex((c) => c.includes('catatan') || c.includes('penggunaan') || c.includes('note'));
  let kwIdx = headerCols.findIndex((c) => c.includes('kunci') || c.includes('keyword'));

  // If no clear code header was found, check if column 0 or 1 contains code-like strings
  let startRow = 1;
  if (codeIdx === -1) {
    for (let col = 0; col < Math.min(3, rows[0].length); col++) {
      if (isValidCodeString(rows[0][col]) || isValidCodeString(rows[1]?.[col])) {
        codeIdx = col;
        titleIdx = col + 1;
        startRow = 0; // No header row
        break;
      }
    }
  }

  if (codeIdx === -1) return null;

  const codes: ExtractedGuidelineCode[] = [];

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i];
    if (cols.length === 0) continue;

    const rawCode = cols[codeIdx] || '';
    if (!isValidCodeString(rawCode)) continue;

    let rawTitle = '';
    let hierarchyPath = '';

    // Check if separate hierarchy columns exist (Pokok, Sub, Sub-sub Masalah)
    if (subSubIdx !== -1 && cols[subSubIdx]?.trim()) {
      rawTitle = cols[subSubIdx].trim();
      const parts = [cols[pokokIdx]?.trim(), cols[subIdx]?.trim(), rawTitle].filter(Boolean);
      hierarchyPath = parts.join(' > ');
    } else if (subIdx !== -1 && cols[subIdx]?.trim()) {
      rawTitle = cols[subIdx].trim();
      const parts = [cols[pokokIdx]?.trim(), rawTitle].filter(Boolean);
      hierarchyPath = parts.join(' > ');
    } else if (pokokIdx !== -1 && cols[pokokIdx]?.trim()) {
      rawTitle = cols[pokokIdx].trim();
      hierarchyPath = rawTitle;
    } else if (titleIdx !== -1 && cols[titleIdx]?.trim()) {
      rawTitle = cols[titleIdx].trim();
    } else {
      // Find first non-empty text column after codeIdx
      for (let c = codeIdx + 1; c < cols.length; c++) {
        if (cols[c] && cols[c].trim().length > 1) {
          rawTitle = cols[c].trim();
          break;
        }
      }
    }

    if (!rawTitle) continue;

    const rawDesc = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : rawTitle;
    const rawNote = noteIdx !== -1 && cols[noteIdx] ? cols[noteIdx].trim() : undefined;
    const rawKeywords =
      kwIdx !== -1 && cols[kwIdx]
        ? cols[kwIdx].split(/[,;]/).map((k) => k.trim()).filter(Boolean)
        : [rawTitle.toLowerCase()];

    const normalized = normalizeCodeItem({
      code: rawCode,
      title: rawTitle,
      description: rawDesc,
      hierarchy: hierarchyPath || (hierIdx !== -1 ? cols[hierIdx] : rawTitle),
      usage_note: rawNote,
      keywords: rawKeywords,
    });

    if (normalized) {
      codes.push(normalized);
    }
  }

  if (codes.length === 0) return null;

  return {
    versionName: `Pedoman Klasifikasi (${fileName.replace(/\.[^/.]+$/, '')})`,
    effectiveDate: new Date().toISOString().split('T')[0],
    description: `Diimpor dari berkas ${fileName}`,
    codes: enrichHierarchy(codes),
  };
}

/**
 * Direct Markdown / Pipe Table parser
 */
function parseMarkdownTableGuideline(text: string, fileName: string): ExtractedGuidelineDoc | null {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|') && l.endsWith('|'));
  if (lines.length < 2) return null;

  // Split lines by '|'
  const rows = lines.map((l) =>
    l
      .slice(1, -1)
      .split('|')
      .map((c) => c.trim())
  );

  // Filter out markdown separator line e.g. |---|---|
  const dataRows = rows.filter((r) => !r.every((cell) => /^[-:\s]+$/.test(cell)));
  if (dataRows.length < 2) return null;

  // Header detection
  const headerCols = dataRows[0].map((c) => c.toLowerCase());
  let codeIdx = headerCols.findIndex((c) => c.includes('kode') || c === 'code');
  let titleIdx = headerCols.findIndex(
    (c) =>
      c.includes('uraian') ||
      c.includes('judul') ||
      c.includes('masalah') ||
      c.includes('perihal') ||
      c.includes('jenis arsip')
  );
  let pokokIdx = headerCols.findIndex((c) => c.includes('pokok masalah') || c === 'pokok');
  let subIdx = headerCols.findIndex((c) => c.includes('sub masalah') || c.includes('sub_masalah'));
  let subSubIdx = headerCols.findIndex((c) => c.includes('sub-sub') || c.includes('sub sub'));
  let descIdx = headerCols.findIndex((c) => c.includes('deskripsi') || c.includes('keterangan'));

  let startRow = 1;
  if (codeIdx === -1) {
    // Check if first column has code
    for (let c = 0; c < Math.min(3, dataRows[0].length); c++) {
      if (isValidCodeString(dataRows[1]?.[c])) {
        codeIdx = c;
        titleIdx = c + 1;
        break;
      }
    }
  }

  if (codeIdx === -1) return null;

  const codes: ExtractedGuidelineCode[] = [];

  for (let i = startRow; i < dataRows.length; i++) {
    const cols = dataRows[i];
    const rawCode = cols[codeIdx] || '';
    if (!isValidCodeString(rawCode)) continue;

    let rawTitle = '';
    let hierarchyPath = '';

    if (subSubIdx !== -1 && cols[subSubIdx]?.trim()) {
      rawTitle = cols[subSubIdx].trim();
      const parts = [cols[pokokIdx]?.trim(), cols[subIdx]?.trim(), rawTitle].filter(Boolean);
      hierarchyPath = parts.join(' > ');
    } else if (subIdx !== -1 && cols[subIdx]?.trim()) {
      rawTitle = cols[subIdx].trim();
      const parts = [cols[pokokIdx]?.trim(), rawTitle].filter(Boolean);
      hierarchyPath = parts.join(' > ');
    } else if (pokokIdx !== -1 && cols[pokokIdx]?.trim()) {
      rawTitle = cols[pokokIdx].trim();
      hierarchyPath = rawTitle;
    } else if (titleIdx !== -1 && cols[titleIdx]?.trim()) {
      rawTitle = cols[titleIdx].trim();
    } else {
      // First non-empty
      for (let c = codeIdx + 1; c < cols.length; c++) {
        if (cols[c]?.trim().length > 1) {
          rawTitle = cols[c].trim();
          break;
        }
      }
    }

    if (!rawTitle) continue;

    const desc = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : rawTitle;

    const item = normalizeCodeItem({
      code: rawCode,
      title: rawTitle,
      description: desc,
      hierarchy: hierarchyPath || rawTitle,
    });

    if (item) codes.push(item);
  }

  if (codes.length === 0) return null;

  return {
    versionName: `Pedoman Klasifikasi (${fileName.replace(/\.[^/.]+$/, '')})`,
    effectiveDate: new Date().toISOString().split('T')[0],
    description: `Diimpor dari berkas tabel ${fileName}`,
    codes: enrichHierarchy(codes),
  };
}

/**
 * Intelligent text fallback parser for circulars, ministerial regulations, and OCR text
 */
function parseTextFallback(text: string, fileName: string): ExtractedGuidelineDoc {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const codes: ExtractedGuidelineCode[] = [];

  // Determine document title from opening lines
  let docTitle = `Pedoman Klasifikasi (${fileName.replace(/\.[^/.]+$/, '')})`;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i];
    if (
      l.toLowerCase().includes('pedoman') ||
      l.toLowerCase().includes('peraturan') ||
      l.toLowerCase().includes('klasifikasi arsip') ||
      l.toLowerCase().includes('keputusan')
    ) {
      docTitle = l.replace(/^[#\-*\s|]+/, '').replace(/[|]+$/, '').trim();
      break;
    }
  }

  // Regex for classification code patterns:
  // 1. ANRI letter codes: KP, KP.01, KP.01.01, HK.02.01, KU.00.01, OT.01, etc.
  // 2. Permendagri / Numeric: 000, 040, 045, 045.1, 045.21, 100, 800, 900
  // 3. Multi-level codes: 01.01, 01.01.01
  const codeRegex = /\b([A-Z]{2,4}(?:\.[0-9]{2}){0,2}|[0-9]{3}(?:\.[0-9]{1,2}){0,2}|[0-9]{2}(?:\.[0-9]{2}){1,2})\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip non-code administrative headings
    if (
      line.toUpperCase().startsWith('BAB ') ||
      line.toUpperCase().startsWith('PASAL ') ||
      line.toUpperCase().startsWith('MENIMBANG') ||
      line.toUpperCase().startsWith('MENGINGAT') ||
      line.toUpperCase().startsWith('MEMUTUSKAN') ||
      line.toUpperCase().startsWith('LAMPIRAN')
    ) {
      continue;
    }

    // Check if line contains a valid classification code
    const codeMatch = line.match(codeRegex);
    if (!codeMatch) continue;

    const matchedCode = codeMatch[1].toUpperCase().trim();
    if (!isValidCodeString(matchedCode)) continue;

    // Extract title from the remainder of the line
    let remaining = line.slice(line.indexOf(codeMatch[0]) + codeMatch[0].length).trim();
    // Strip leading punctuation: ":", "-", "|", "."
    remaining = remaining.replace(/^[\s:\-–—|.)]+/, '').trim();

    // If remaining is empty, inspect the immediate next line (multi-line layout)
    if (!remaining && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (!nextLine.match(codeRegex) && nextLine.length > 2 && !nextLine.toUpperCase().startsWith('BAB')) {
        remaining = nextLine;
        i++; // advance line
      }
    }

    if (!remaining) continue;

    // Extract title, description, and usage note
    let rawTitle = remaining;
    let description = remaining;
    let usageNote: string | undefined = undefined;

    // Check for Catatan:
    if (remaining.toLowerCase().includes('catatan:')) {
      const noteParts = remaining.split(/catatan:\s*/i);
      rawTitle = noteParts[0].trim();
      description = rawTitle;
      usageNote = noteParts[1]?.trim();
    }

    // Check for colon separator "Formasi Pegawai: Usulan kebutuhan penetapan..."
    if (rawTitle.includes(':')) {
      const parts = rawTitle.split(':');
      rawTitle = parts[0].trim();
      description = parts.slice(1).join(':').trim();
    } else if (rawTitle.includes('|')) {
      const parts = rawTitle.split('|').map((p) => p.trim()).filter(Boolean);
      rawTitle = parts[0];
      description = parts.slice(1).join(' - ') || rawTitle;
    }

    const item = normalizeCodeItem({
      code: matchedCode,
      title: rawTitle,
      description,
      usage_note: usageNote,
    });

    if (item && !codes.some((c) => c.code === item.code)) {
      codes.push(item);
    }
  }

  return {
    versionName: docTitle,
    effectiveDate: new Date().toISOString().split('T')[0],
    description: `Diekstraksi dari naskah berkas ${fileName}`,
    codes: enrichHierarchy(codes),
  };
}

/**
 * Normalizes single code item: splits merged code/title, strips prefixes, auto-levels
 */
function normalizeCodeItem(c: any): ExtractedGuidelineCode | null {
  if (!c) return null;

  let rawCode = String(
    c.code || c.kode || c.kode_klasifikasi || c.kd || c.no_kode || c.nomor_kode || ''
  ).trim();

  let rawTitle = String(
    c.title ||
      c.uraian ||
      c.uraian_masalah ||
      c.judul ||
      c.nama ||
      c.masalah ||
      c.nama_masalah ||
      c.perihal ||
      c.sub_masalah ||
      c.pokok_masalah ||
      c.jenis_arsip ||
      ''
  ).trim();

  let rawDesc = String(c.description || c.deskripsi || c.keterangan || c.penjelasan || '').trim();
  let rawNote = String(c.usage_note || c.catatan || c.catatan_penggunaan || c.note || '').trim();
  let rawHier = String(c.hierarchy || c.hierarki || c.rumpun || '').trim();
  let rawKeywords = Array.isArray(c.keywords)
    ? c.keywords
    : Array.isArray(c.kata_kunci)
    ? c.kata_kunci
    : typeof c.keywords === 'string'
    ? c.keywords.split(/[,;]/).map((k: string) => k.trim()).filter(Boolean)
    : [];

  // 1. If code contains spaces and text (e.g. "KP.01 Pengadaan Pegawai")
  if (rawCode.includes(' ')) {
    const codeMatch = rawCode.match(/^([A-Z0-9.]+)\s+(.+)$/i);
    if (codeMatch) {
      rawCode = codeMatch[1].trim();
      if (!rawTitle) {
        rawTitle = codeMatch[2].trim();
      }
    }
  }

  // 2. Validate code format
  rawCode = rawCode.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!isValidCodeString(rawCode)) return null;

  // 3. Clean rawTitle: if empty, fall back to desc or rawCode
  if (!rawTitle) {
    rawTitle = rawDesc || rawCode;
  }

  // 4. If title starts with the code (e.g. "KP.01 Pengadaan Pegawai" -> "Pengadaan Pegawai")
  if (rawTitle.toUpperCase().startsWith(rawCode.toUpperCase())) {
    rawTitle = rawTitle.slice(rawCode.length).trim();
  }

  // 5. Clean leading punctuation and list numbering from title: e.g. "1. ", "a. ", "1) ", "- ", "• "
  rawTitle = rawTitle.replace(/^[\s:\-–—|•*]+/, '').trim();
  rawTitle = rawTitle.replace(/^(?:[0-9]{1,3}|[a-zA-Z])[\.)]\s+/, '').trim();
  // Strip trailing punctuation
  rawTitle = rawTitle.replace(/[\s:;,\-]+$/, '').trim();

  if (!rawTitle) {
    rawTitle = rawCode;
  }

  // 6. Calculate level & parent_code
  const parts = rawCode.split('.');
  let level = 1;
  let parentCode: string | null = null;

  if (parts.length >= 3) {
    level = 3;
    parentCode = parts.slice(0, 2).join('.');
  } else if (parts.length === 2) {
    level = 2;
    parentCode = parts[0];
  } else {
    // Single part: could be numeric sub-code (e.g. 045 under 000 or 040)
    if (/^[0-9]{3}$/.test(rawCode) && !rawCode.endsWith('00')) {
      level = rawCode.endsWith('0') ? 2 : 2;
      parentCode = `${rawCode.slice(0, 2)}0`;
    } else {
      level = 1;
      parentCode = null;
    }
  }

  if (Number(c.level) && [1, 2, 3].includes(Number(c.level))) {
    level = Number(c.level);
  }

  if (c.parent_code && isValidCodeString(String(c.parent_code))) {
    parentCode = String(c.parent_code).trim().toUpperCase();
  }

  // 7. Clean keywords
  if (rawKeywords.length === 0) {
    rawKeywords = [rawTitle.toLowerCase()];
  }

  return {
    code: rawCode,
    title: rawTitle,
    description: rawDesc || rawTitle,
    level,
    parent_code: parentCode,
    hierarchy: rawHier || rawTitle,
    usage_note: rawNote || undefined,
    keywords: rawKeywords,
  };
}

/**
 * Validates if string conforms to official Indonesian classification code format
 */
function isValidCodeString(code: string): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();

  // Reject pure sequential numbers like "1", "2", "3", "10" unless official 3-digit Permendagri (000-999)
  if (/^[0-9]{1,2}$/.test(clean)) return false;

  // Reject administrative words
  if (
    clean === 'NO' ||
    clean === 'KODE' ||
    clean === 'BAB' ||
    clean === 'PASAL' ||
    clean === 'LAMPIRAN' ||
    clean === 'HAL' ||
    clean === 'NOMOR'
  ) {
    return false;
  }

  // Valid patterns:
  // - Letters only: KP, KU, UM, HK, OT, TI, PL, PR, DL
  // - Letter + dots + numbers: KP.01, KP.01.01, HK.02.01, OT.01.02
  // - 3-digit numeric Permendagri: 000, 010, 040, 045, 045.1, 100, 800, 900
  // - 2-digit dot numeric: 01.01, 01.01.01
  return (
    /^[A-Z]{2,4}(?:\.[0-9]{2}){0,2}$/.test(clean) ||
    /^[0-9]{3}(?:\.[0-9]{1,2}){0,2}$/.test(clean) ||
    /^[0-9]{2}\.[0-9]{2}(?:\.[0-9]{2})?$/.test(clean)
  );
}

/**
 * Enriches hierarchy breadcrumbs (e.g. "Kepegawaian > Pengadaan Pegawai > Formasi Pegawai")
 */
function enrichHierarchy(codes: ExtractedGuidelineCode[]): ExtractedGuidelineCode[] {
  const codeMap = new Map<string, ExtractedGuidelineCode>();
  codes.forEach((c) => codeMap.set(c.code, c));

  return codes.map((c) => {
    if (c.hierarchy && c.hierarchy.includes(' > ')) {
      return c;
    }

    if (c.level === 3 && c.parent_code) {
      const parent = codeMap.get(c.parent_code);
      if (parent) {
        const grandParent = parent.parent_code ? codeMap.get(parent.parent_code) : null;
        if (grandParent) {
          c.hierarchy = `${grandParent.title} > ${parent.title} > ${c.title}`;
        } else {
          c.hierarchy = `${parent.title} > ${c.title}`;
        }
      }
    } else if (c.level === 2 && c.parent_code) {
      const parent = codeMap.get(c.parent_code);
      if (parent) {
        c.hierarchy = `${parent.title} > ${c.title}`;
      }
    } else {
      c.hierarchy = c.title;
    }

    return c;
  });
}

/**
 * Splits CSV line correctly respecting quotes
 */
function splitCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === sep && !inQuotes) {
      result.push(current.replace(/^["']|["']$/g, '').trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.replace(/^["']|["']$/g, '').trim());
  return result;
}

/**
 * Robust caller for Gemini extraction with retry on 503 / 429 and model fallback
 */
async function callGeminiExtractWithRetry(
  contents: any[],
  systemInstruction: string,
  responseSchema: any
): Promise<string> {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err);
        const isTransient =
          errStr.includes('503') ||
          errStr.includes('high demand') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('429');

        console.warn(`[GuidelineParser] Model ${model} attempt ${attempt} failed:`, errStr);

        if (isTransient && attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else {
          break;
        }
      }
    }
  }

  throw lastError;
}

/**
 * Resilient JSON Parser for Partial / Truncated AI Output Streams
 */
function repairAndParseGuidelineJson(rawText: string, fileName: string): ExtractedGuidelineDoc {
  let cleaned = (rawText || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  // 1. Try standard JSON.parse first
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.codes) && parsed.codes.length > 0) {
      const normalized = parsed.codes
        .map(normalizeCodeItem)
        .filter((c: any): c is ExtractedGuidelineCode => Boolean(c && c.code && c.title));

      if (normalized.length > 0) {
        return {
          versionName: parsed.versionName || `Pedoman Klasifikasi (${fileName})`,
          effectiveDate: parsed.effectiveDate || new Date().toISOString().split('T')[0],
          description: parsed.description || `Diekstraksi dari ${fileName}`,
          codes: enrichHierarchy(normalized),
        };
      }
    }
  } catch {
    console.warn('Standard JSON.parse encountered truncation, activating stream recovery parser...');
  }

  // 2. Stream bracket parser for partial or truncated JSON
  const extractedObjects = extractObjectsFromStream(cleaned);
  if (extractedObjects.length > 0) {
    const versionNameMatch = cleaned.match(/"versionName"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const effectiveDateMatch = cleaned.match(/"effectiveDate"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const descriptionMatch = cleaned.match(/"description"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);

    const normalized = extractedObjects
      .map(normalizeCodeItem)
      .filter((c): c is ExtractedGuidelineCode => Boolean(c && c.code && c.title));

    if (normalized.length > 0) {
      return {
        versionName: versionNameMatch ? versionNameMatch[1] : `Pedoman Klasifikasi (${fileName})`,
        effectiveDate: effectiveDateMatch ? effectiveDateMatch[1] : new Date().toISOString().split('T')[0],
        description: descriptionMatch ? descriptionMatch[1] : `Diekstraksi dari berkas ${fileName}`,
        codes: enrichHierarchy(normalized),
      };
    }
  }

  throw new Error('Dokumen tidak menghasilkan daftar kode klasifikasi yang dapat dikenali. Mohon pastikan dokumen berisi pola klasifikasi naskah dinas.');
}

function extractObjectsFromStream(jsonStream: string): any[] {
  const codesIdx = jsonStream.indexOf('"codes"');
  const searchStart = codesIdx !== -1 ? jsonStream.indexOf('[', codesIdx) : 0;
  if (searchStart === -1) return [];

  const objects: any[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escape = false;

  for (let i = searchStart; i < jsonStream.length; i++) {
    const c = jsonStream[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') {
        if (depth === 0) {
          objStart = i;
        }
        depth++;
      } else if (c === '}') {
        depth--;
        if (depth === 0 && objStart !== -1) {
          const objStr = jsonStream.slice(objStart, i + 1);
          try {
            const parsed = JSON.parse(objStr);
            if (parsed && (parsed.code || parsed.kode) && (parsed.title || parsed.uraian)) {
              objects.push(parsed);
            }
          } catch {
            // ignore partial malformed object
          }
          objStart = -1;
        }
      }
    }
  }

  return objects;
}

/**
 * Robust ASCII / Stream Text Extractor for PDF Base64
 */
function extractTextFromPdfBase64(base64Data: string): string {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const raw = buffer.toString('latin1');

    const textSegments: string[] = [];
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    let match;
    while ((match = tjRegex.exec(raw)) !== null) {
      const clean = match[1]
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\r/g, ' ')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, ' ')
        .trim();
      if (clean.length > 1) {
        textSegments.push(clean);
      }
    }

    if (textSegments.length > 5) {
      return textSegments.join('\n');
    }

    const cleanLines = raw
      .replace(/[^\x20-\x7E\r\n\t]/g, ' ')
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 3 && /[A-Za-z0-9]/.test(l));

    return cleanLines.join('\n');
  } catch (err) {
    console.warn('Failed to extract text from PDF base64:', err);
    return '';
  }
}

