import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './src/server/db.ts';
import { runClassificationAgent, parseGuidelineDocument } from './src/server/gemini.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Active session state (simulated user session for internal officer portal)
let currentUserId = 'u-1'; // Default: Rian Pratama (Petugas)

// --- Auth & User Endpoints ---
app.get('/api/auth/current-user', (req: Request, res: Response) => {
  const user = db.getUserById(currentUserId) || db.getUsers()[0];
  const allUsers = db.getUsers();
  res.json({ currentUser: user, allUsers });
});

app.post('/api/auth/switch-user', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Pengguna tidak ditemukan' });
  }
  currentUserId = user.id;
  res.json({ currentUser: user });
});

// --- Guideline Endpoints ---
app.get('/api/guidelines/active', (req: Request, res: Response) => {
  const activeVersion = db.getActiveGuidelineVersion();
  const codes = db.getGuidelineCodes(activeVersion?.id);
  res.json({
    version: activeVersion,
    total_codes: codes.length,
  });
});

app.get('/api/guidelines/versions', (req: Request, res: Response) => {
  const versions = db.getAllGuidelineVersions();
  res.json({ versions });
});

app.post('/api/guidelines/activate', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Akses ditolak: Hanya peran Admin yang dapat mengubah versi pedoman' });
  }

  const { version_id } = req.body;
  const success = db.setActiveGuidelineVersion(version_id);
  if (!success) {
    return res.status(404).json({ error: 'Versi pedoman tidak ditemukan' });
  }
  res.json({ success: true, activeVersion: db.getActiveGuidelineVersion() });
});

app.get('/api/guidelines/codes', (req: Request, res: Response) => {
  const { query, level, version_id } = req.query;
  const codes = db.getGuidelineCodes(
    version_id as string | undefined,
    query as string | undefined,
    level ? parseInt(level as string, 10) : undefined
  );
  res.json({ codes });
});

// Hierarchy tree endpoint for manual exploration (FR-13)
app.get('/api/guidelines/hierarchy', (req: Request, res: Response) => {
  const activeVersion = db.getActiveGuidelineVersion();
  const allCodes = db.getGuidelineCodes(activeVersion?.id);

  // Group by level 1 (Pokok Masalah) -> level 2 (Sub Masalah) -> level 3 (Sub-sub Masalah)
  const l1Codes = allCodes.filter((c) => c.level === 1);
  const tree = l1Codes.map((l1) => {
    const l2Children = allCodes.filter((c) => c.level === 2 && c.parent_code === l1.code);
    const l2WithChildren = l2Children.map((l2) => {
      const l3Children = allCodes.filter((c) => c.level === 3 && c.parent_code === l2.code);
      return {
        ...l2,
        children: l3Children,
      };
    });
    return {
      ...l1,
      children: l2WithChildren,
    };
  });

  res.json({ tree, total_codes: allCodes.length, version: activeVersion });
});

// Admin: Add new guideline code (FR-14)
app.post('/api/guidelines/codes', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator yang berwenang menambah butir pedoman' });
  }

  const { code, title, description, level, parent_code, hierarchy, usage_note, keywords, version_id } = req.body;
  if (!code || !title || !description || !hierarchy) {
    return res.status(400).json({ error: 'Kolom kode, judul, deskripsi, dan hierarki wajib diisi' });
  }

  const targetVersion = version_id || db.getActiveGuidelineVersion()?.id;
  const existing = db.findCodeByCode(code, targetVersion);
  if (existing) {
    return res.status(400).json({ error: `Kode ${code} sudah terdaftar dalam versi pedoman ini` });
  }

  const created = db.addGuidelineCode({
    version_id: targetVersion,
    code: code.trim(),
    title: title.trim(),
    description: description.trim(),
    level: level || 3,
    parent_code: parent_code || null,
    hierarchy: hierarchy.trim(),
    usage_note: usage_note?.trim(),
    keywords: Array.isArray(keywords) ? keywords : (keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
  });

  res.status(201).json({ code: created });
});

// Admin: Edit guideline code
app.put('/api/guidelines/codes/:id', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator yang berwenang mengubah butir pedoman' });
  }

  const updated = db.updateGuidelineCode(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Butir pedoman tidak ditemukan' });
  }
  res.json({ code: updated });
});

// Admin: Delete guideline code
app.delete('/api/guidelines/codes/:id', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator yang berwenang menghapus butir pedoman' });
  }

  const success = db.deleteGuidelineCode(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Butir pedoman tidak ditemukan' });
  }
  res.json({ success: true });
});

// Admin: Import guideline codes in bulk (CSV or JSON format)
app.post('/api/guidelines/import', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin') {
    return res.status(403).json({ error: 'Hanya Administrator yang berwenang mengimpor pedoman' });
  }

  const { version_name, effective_date, description, codes } = req.body;
  if (!version_name || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'Format data impor tidak valid atau daftar kode kosong' });
  }

  const newVersion = db.createGuidelineVersion(
    version_name,
    description || 'Versi pedoman diimpor oleh Admin',
    effective_date || new Date().toISOString().split('T')[0]
  );

  let importedCount = 0;
  for (const item of codes) {
    if (!item.code || !item.title) continue;
    db.addGuidelineCode({
      version_id: newVersion.id,
      code: item.code.trim(),
      title: item.title.trim(),
      description: item.description?.trim() || item.title.trim(),
      level: item.level || (item.code.split('.').length >= 3 ? 3 : item.code.split('.').length),
      parent_code: item.parent_code || null,
      hierarchy: item.hierarchy?.trim() || item.title.trim(),
      usage_note: item.usage_note?.trim(),
      keywords: Array.isArray(item.keywords) ? item.keywords : (item.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
    });
    importedCount++;
  }

  res.status(201).json({
    success: true,
    version: newVersion,
    imported_codes_count: importedCount,
  });
});

// Parse Uploaded Guideline Document (PDF, CSV, TXT, JSON, MD)
app.post('/api/guidelines/parse-upload', async (req: Request, res: Response) => {
  const { fileName, fileType, textContent, base64Data } = req.body;

  if (!fileName) {
    return res.status(400).json({ error: 'Nama berkas dokumen wajib disertakan' });
  }

  try {
    const parsed = await parseGuidelineDocument({
      fileName,
      fileType: fileType || 'text/plain',
      textContent,
      base64Data,
    });

    res.json({ success: true, parsed });
  } catch (error: any) {
    console.error('Failed to parse uploaded guideline document:', error);
    res.status(500).json({ error: error.message || 'Gagal mengekstraksi isi dokumen pedoman' });
  }
});

// Save and activate uploaded guideline document
app.post('/api/guidelines/apply-uploaded', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId);
  if (currentUser?.role !== 'admin' && currentUser?.role !== 'petugas') {
    return res.status(403).json({ error: 'Akses ditolak untuk mengunggah pedoman' });
  }

  const { versionName, effectiveDate, description, codes, makeActive } = req.body;

  if (!versionName || !Array.isArray(codes) || codes.length === 0) {
    return res.status(400).json({ error: 'Daftar butir kode pedoman hasil ekstraksi kosong' });
  }

  const newVersion = db.createGuidelineVersion(
    versionName,
    description || `Pedoman diunggah oleh ${currentUser.name}`,
    effectiveDate || new Date().toISOString().split('T')[0]
  );

  let insertedCount = 0;
  for (const item of codes) {
    if (!item.code || !item.title) continue;
    db.addGuidelineCode({
      version_id: newVersion.id,
      code: item.code.trim(),
      title: item.title.trim(),
      description: item.description?.trim() || item.title.trim(),
      level: item.level || (item.code.split('.').length >= 3 ? 3 : item.code.split('.').length),
      parent_code: item.parent_code || null,
      hierarchy: item.hierarchy?.trim() || item.title.trim(),
      usage_note: item.usage_note?.trim(),
      keywords: Array.isArray(item.keywords)
        ? item.keywords
        : (item.keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
    });
    insertedCount++;
  }

  if (makeActive) {
    db.setActiveGuidelineVersion(newVersion.id);
  }

  res.status(201).json({
    success: true,
    version: newVersion,
    is_active: makeActive,
    total_codes: insertedCount,
  });
});

// --- Core Classification Agent API (FR-01, FR-03, FR-04, FR-05, FR-06, FR-09) ---
app.post('/api/classify', async (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId) || db.getUsers()[0];
  const { description_text, unit, letter_type } = req.body;

  if (!description_text || !description_text.trim()) {
    return res.status(400).json({ error: 'Gambaran isi dokumen (perihal) wajib diisi' });
  }

  try {
    // 1. Create document record in database
    const document = db.createDocument({
      description_text: description_text.trim(),
      unit: unit ? unit.trim() : undefined,
      letter_type: letter_type ? letter_type.trim() : undefined,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });

    // 2. Run Anti-Hallucination Pipeline with Gemini API
    const { result, candidates, durationSeconds } = await runClassificationAgent({
      description_text: document.description_text,
      unit: document.unit,
      letter_type: document.letter_type,
    });

    const activeVersion = db.getActiveGuidelineVersion();

    // 3. Save recommendation record to database
    const recommendation = db.createRecommendation({
      document_id: document.id,
      version_id: activeVersion?.id || 'default',
      version_name: activeVersion?.name || 'Pedoman Klasifikasi Resmi',
      primary_code: result.primary?.code || null,
      primary_title: result.primary?.title || null,
      primary_hierarchy: result.primary?.hierarchy || null,
      primary_reason: result.primary?.reason || 'Tidak ditemukan kecocokan pada basis pedoman aktif.',
      confidence: result.confidence,
      alternatives: result.alternatives,
      reference_valid: result.primary !== null,
      status: result.status,
      ai_duration_seconds: durationSeconds,
      analysis: result.analysis,
      need_more_info: result.need_more_info,
    });

    // 4. Retrieve similar documents previously classified and verified (FR-10)
    const similarDocuments = db.findSimilarDocuments(document.description_text, document.id, 3);

    res.json({
      document,
      recommendation,
      candidates,
      similarDocuments,
    });
  } catch (error: any) {
    console.error('Classification error:', error);
    res.status(500).json({ error: error.message || 'Gagal memproses rekomendasi klasifikasi' });
  }
});

// --- Batch Classification API (FR-11) ---
app.post('/api/batch-classify', async (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId) || db.getUsers()[0];
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Daftar dokumen batch kosong' });
  }

  // Cap batch at 25 items for latency and rate protection
  const batchList = items.slice(0, 25);
  const results = [];

  for (const item of batchList) {
    if (!item.description_text || !item.description_text.trim()) continue;

    const document = db.createDocument({
      description_text: item.description_text.trim(),
      unit: item.unit?.trim(),
      letter_type: item.letter_type?.trim(),
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    });

    const { result, durationSeconds } = await runClassificationAgent({
      description_text: document.description_text,
      unit: document.unit,
      letter_type: document.letter_type,
    });

    const activeVersion = db.getActiveGuidelineVersion();

    const recommendation = db.createRecommendation({
      document_id: document.id,
      version_id: activeVersion?.id || 'default',
      version_name: activeVersion?.name || 'Pedoman Klasifikasi Resmi',
      primary_code: result.primary?.code || null,
      primary_title: result.primary?.title || null,
      primary_hierarchy: result.primary?.hierarchy || null,
      primary_reason: result.primary?.reason || 'Tidak ditemukan kecocokan',
      confidence: result.confidence,
      alternatives: result.alternatives,
      reference_valid: result.primary !== null,
      status: result.status,
      ai_duration_seconds: durationSeconds,
      analysis: result.analysis,
      need_more_info: result.need_more_info,
    });

    results.push({
      document,
      recommendation,
    });
  }

  res.json({
    total_processed: results.length,
    results,
  });
});

// --- Verification API (FR-07, FR-08, Agent Guardrail: final_code must be in DB & verified by officer) ---
app.post('/api/verify', (req: Request, res: Response) => {
  const currentUser = db.getUserById(currentUserId) || db.getUsers()[0];
  const { recommendation_id, document_id, decision, final_code, note, verification_seconds } = req.body;

  if (!recommendation_id || !document_id || !decision || !final_code) {
    return res.status(400).json({ error: 'Semua parameter verifikasi wajib diisi' });
  }

  // Strict check: final_code MUST exist in guideline_codes table
  const activeVersion = db.getActiveGuidelineVersion();
  const dbCode = db.findCodeByCode(final_code, activeVersion?.id);
  if (!dbCode) {
    return res.status(400).json({
      error: `Kode klasifikasi "${final_code}" tidak valid atau tidak terdaftar dalam pedoman resmi aktif!`,
    });
  }

  const saved = db.saveVerification({
    recommendation_id,
    document_id,
    decision,
    final_code: dbCode.code,
    final_title: dbCode.title,
    final_hierarchy: dbCode.hierarchy,
    note: note ? note.trim() : undefined,
    verified_by: currentUser.id,
    verified_by_name: currentUser.name,
    verification_seconds: typeof verification_seconds === 'number' ? Math.max(5, verification_seconds) : 35,
  });

  res.json({
    success: true,
    verification: saved,
  });
});

// --- Similar Documents Search (FR-10) ---
app.get('/api/documents/similar', (req: Request, res: Response) => {
  const { query, current_id } = req.query;
  if (!query) {
    return res.json({ similarDocuments: [] });
  }
  const items = db.findSimilarDocuments(query as string, current_id as string | undefined, 5);
  res.json({ similarDocuments: items });
});

// --- History API ---
app.get('/api/history', (req: Request, res: Response) => {
  const { search, decision, officer_id, limit } = req.query;
  const history = db.getHistory({
    search: search as string | undefined,
    decision: decision as string | undefined,
    officerId: officer_id as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 50,
  });
  res.json({ history });
});

// --- Dashboard Metrics API (FR-12, Success Metrics M1-M4) ---
app.get('/api/metrics', (req: Request, res: Response) => {
  const { officer_id } = req.query;
  const metrics = db.calculateMetrics(officer_id as string | undefined);
  res.json(metrics);
});

// --- Vite Middleware Integration ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
