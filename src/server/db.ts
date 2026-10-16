import fs from 'fs';
import path from 'path';
import {
  User,
  GuidelineVersion,
  GuidelineCode,
  DocumentRecord,
  Recommendation,
  Verification,
  SimilarDocumentItem,
  MetricsSummary,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  users: User[];
  guideline_versions: GuidelineVersion[];
  guideline_codes: GuidelineCode[];
  documents: DocumentRecord[];
  recommendations: Recommendation[];
  verifications: Verification[];
}

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Initial seed data
function getSeedData(): DatabaseSchema {
  const defaultVersionId = 'gv-2026-v1';

  const users: User[] = [
    {
      id: 'u-1',
      name: 'Rian Pratama',
      email: 'rian.pratama@instansi.go.id',
      role: 'petugas',
      department: 'Subbag Persuratan & Kearsipan',
    },
    {
      id: 'u-2',
      name: 'Dewi Lestari',
      email: 'dewi.lestari@instansi.go.id',
      role: 'petugas',
      department: 'Subbag Persuratan & Kearsipan',
    },
    {
      id: 'u-3',
      name: 'Drs. Bambang Sudiro, M.Si',
      email: 'bambang.sudiro@instansi.go.id',
      role: 'pimpinan',
      department: 'Kepala Bagian Umum & Tata Usaha',
    },
    {
      id: 'u-4',
      name: 'Administrator Persuratan',
      email: 'admin.persuratan@instansi.go.id',
      role: 'admin',
      department: 'Pengelola Sistem Informasi Kearsipan Dinamis',
    },
  ];

  const guideline_versions: GuidelineVersion[] = [
    {
      id: defaultVersionId,
      name: 'Pedoman Klasifikasi Arsip Pola Baku Nasional (Perka ANRI No. 19/2012 Rev. 2026)',
      effective_date: '2026-01-01',
      is_active: true,
      description: 'Pedoman resmi pengklasifikasian naskah dinas dan tata persuratan instansi pemerintah sesuai fungsi substantif dan fasilitatif.',
      total_codes: 45,
    },
    {
      id: 'gv-2023-legacy',
      name: 'Pedoman Klasifikasi Arsip Internal 2023 (Arsip Inaktif)',
      effective_date: '2023-01-01',
      is_active: false,
      description: 'Pedoman versi sebelumnya untuk penataan arsip statis dan inaktif tahun anggaran 2023-2025.',
      total_codes: 38,
    },
  ];

  const rawCodes: Omit<GuidelineCode, 'id' | 'version_id'>[] = [
    // --- KEPEGAWAIAN (KP) ---
    {
      code: 'KP',
      title: 'Kepegawaian',
      description: 'Urusan terkait pengelolaan aparatur sipil negara dan sumber daya manusia aparatur.',
      level: 1,
      parent_code: null,
      hierarchy: 'Kepegawaian',
      usage_note: 'Digunakan hanya sebagai kelompok induk urusan kepegawaian.',
      keywords: ['kepegawaian', 'sdm', 'aparatur', 'asn', 'pegawai'],
    },
    {
      code: 'KP.01',
      title: 'Pengadaan Pegawai',
      description: 'Perencanaan kebutuhan, formasi, penerimaan, dan pengangkatan aparatur negara.',
      level: 2,
      parent_code: 'KP',
      hierarchy: 'Kepegawaian > Pengadaan Pegawai',
      usage_note: 'Sub masalah untuk segala proses awal rekrutmen pegawai.',
      keywords: ['pengadaan pegawai', 'formasi', 'rekrutmen', 'cpns', 'pppk', 'seleksi casn'],
    },
    {
      code: 'KP.01.01',
      title: 'Formasi Pegawai',
      description: 'Penyusunan usulan, analisis kebutuhan, dan penetapan formasi kebutuhan pegawai baru.',
      level: 3,
      parent_code: 'KP.01',
      hierarchy: 'Kepegawaian > Pengadaan Pegawai > Formasi Pegawai',
      usage_note: 'Khusus untuk dokumen usulan kebutuhan formasi ke kementerian PANRB/BKN.',
      keywords: ['formasi pegawai', 'usulan formasi', 'beban kerja pegawai', 'kebutuhan asn'],
    },
    {
      code: 'KP.01.02',
      title: 'Penerimaan CPNS dan PPPK',
      description: 'Pengumuman seleksi, pendaftaran, ujian kompetensi (SKD/SKB), dan pengumuman kelulusan.',
      level: 3,
      parent_code: 'KP.01',
      hierarchy: 'Kepegawaian > Pengadaan Pegawai > Penerimaan CPNS dan PPPK',
      usage_note: 'Dokumen teknis panitia seleksi, jadwal tes, dan pengumuman hasil seleksi.',
      keywords: ['penerimaan cpns', 'seleksi pppk', 'ujian skd', 'skb', 'kelulusan peserta'],
    },
    {
      code: 'KP.01.03',
      title: 'Pengangkatan Calon Pegawai dan PPPK',
      description: 'Surat Keputusan (SK) pengangkatan CPNS, penetapan NIP, dan penandatanganan perjanjian kerja PPPK.',
      level: 3,
      parent_code: 'KP.01',
      hierarchy: 'Kepegawaian > Pengadaan Pegawai > Pengangkatan Calon Pegawai dan PPPK',
      usage_note: 'Penerbitan SK pengangkatan resmi dan nomor induk pegawai.',
      keywords: ['sk cpns', 'penetapan nip', 'perjanjian kerja pppk', 'surat pengangkatan'],
    },
    {
      code: 'KP.02',
      title: 'Mutasi dan Kepangkatan Pegawai',
      description: 'Pengelolaan kenaikan pangkat, alih tugas jabatan, promosi, dan penempatan pegawai.',
      level: 2,
      parent_code: 'KP',
      hierarchy: 'Kepegawaian > Mutasi dan Kepangkatan Pegawai',
      usage_note: 'Kelompok mutasi pergerakan jabatan dan kepangkatan pegawai.',
      keywords: ['mutasi pegawai', 'kepangkatan', 'pangkat', 'penempatan', 'promosi'],
    },
    {
      code: 'KP.02.01',
      title: 'Kenaikan Pangkat',
      description: 'Usulan, berkas pertimbangan teknis, dan penetapan kenaikan pangkat reguler maupun pilihan.',
      level: 3,
      parent_code: 'KP.02',
      hierarchy: 'Kepegawaian > Mutasi dan Kepangkatan Pegawai > Kenaikan Pangkat',
      usage_note: 'Gunakan jika isi surat mengenai berkas kenaikan pangkat periode April/Oktober.',
      keywords: ['kenaikan pangkat', 'kp reguler', 'kp pilihan', 'sk kenaikan pangkat', 'pangkat golongan'],
    },
    {
      code: 'KP.02.02',
      title: 'Kenaikan Gaji Berkala (KGB)',
      description: 'Pemberitahuan dan penetapan kenaikan gaji berkala bagi pegawai yang memenuhi masa kerja.',
      level: 3,
      parent_code: 'KP.02',
      hierarchy: 'Kepegawaian > Mutasi dan Kepangkatan Pegawai > Kenaikan Gaji Berkala (KGB)',
      usage_note: 'Surat pemberitahuan KGB 2 tahunan.',
      keywords: ['kenaikan gaji berkala', 'kgb', 'surat pemberitahuan kgb', 'gaji pokok berkala'],
    },
    {
      code: 'KP.02.03',
      title: 'Mutasi Internal dan Alih Tugas',
      description: 'Surat perintah tugas pindah unit kerja, penempatan staf antar direktorat/bagian.',
      level: 3,
      parent_code: 'KP.02',
      hierarchy: 'Kepegawaian > Mutasi dan Kepangkatan Pegawai > Mutasi Internal dan Alih Tugas',
      usage_note: 'Khusus perpindahan tugas di dalam lingkup instansi internal.',
      keywords: ['mutasi internal', 'alih tugas', 'rotasi staf', 'surat tugas penempatan baru'],
    },
    {
      code: 'KP.03',
      title: 'Pengembangan dan Kinerja Pegawai',
      description: 'Pelatihan kedinasan, izin belajar, evaluasi kinerja, cuti, dan penghargaan.',
      level: 2,
      parent_code: 'KP',
      hierarchy: 'Kepegawaian > Pengembangan dan Kinerja Pegawai',
      usage_note: 'Kegiatan pengembangan kapasitas serta manajemen kinerja dan kesejahteraan.',
      keywords: ['pengembangan pegawai', 'pelatihan', 'kinerja', 'skp', 'cuti'],
    },
    {
      code: 'KP.03.01',
      title: 'Pendidikan, Pelatihan, dan Bimtek',
      description: 'Penugasan diklat kepemimpinan, teknis, fungsional, seminar, dan bimbingan teknis kepegawaian.',
      level: 3,
      parent_code: 'KP.03',
      hierarchy: 'Kepegawaian > Pengembangan dan Kinerja Pegawai > Pendidikan, Pelatihan, dan Bimtek',
      usage_note: 'Surat pengiriman atau permohonan mengikuti pelatihan/diklat/workshop peningkatan kompetensi.',
      keywords: ['diklat pegawai', 'bimtek', 'workshop kompetensi', 'pelatihan kepemimpinan', 'kursus kedinasan'],
    },
    {
      code: 'KP.03.02',
      title: 'Penilaian Kinerja Pegawai (SKP)',
      description: 'Penyusunan sasaran kinerja pegawai, evaluasi periodik triwulanan/tahunan, dan penilaian perilaku kerja.',
      level: 3,
      parent_code: 'KP.03',
      hierarchy: 'Kepegawaian > Pengembangan dan Kinerja Pegawai > Penilaian Kinerja Pegawai (SKP)',
      usage_note: 'Laporan dan surat pengantar penilaian SKP pegawai.',
      keywords: ['skp', 'sasaran kinerja pegawai', 'evaluasi kinerja tahunan', 'penilaian prestasi kerja'],
    },
    {
      code: 'KP.03.03',
      title: 'Cuti Pegawai',
      description: 'Permohonan dan persetujuan cuti tahunan, cuti besar, cuti bersalin, cuti sakit, dan cuti alasan penting.',
      level: 3,
      parent_code: 'KP.03',
      hierarchy: 'Kepegawaian > Pengembangan dan Kinerja Pegawai > Cuti Pegawai',
      usage_note: 'Formulir dan surat keputusan permohonan izin cuti.',
      keywords: ['cuti tahunan', 'cuti melahirkan', 'cuti sakit', 'permohonan cuti', 'surat izin cuti'],
    },

    // --- KEUANGAN (KU) ---
    {
      code: 'KU',
      title: 'Keuangan',
      description: 'Pengelolaan anggaran, perbendaharaan, verifikasi belanja, akuntansi, dan pertanggungjawaban keuangan negara.',
      level: 1,
      parent_code: null,
      hierarchy: 'Keuangan',
      usage_note: 'Kelompok induk urusan tata kelola keuangan.',
      keywords: ['keuangan', 'anggaran', 'dipa', 'belanja', 'pembayaran'],
    },
    {
      code: 'KU.01',
      title: 'Perencanaan dan Penyusunan Anggaran',
      description: 'Penyusunan Rencana Kerja dan Anggaran (RKA), penetapan DIPA, dan usulan revisi anggaran.',
      level: 2,
      parent_code: 'KU',
      hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran',
      usage_note: 'Tahap perencanaan fiskal sebelum anggaran dicairkan.',
      keywords: ['perencanaan anggaran', 'penyusunan rka', 'dipa', 'pagu indikatif', 'revisi anggaran'],
    },
    {
      code: 'KU.01.01',
      title: 'Perencanaan Anggaran',
      description: 'Penyusunan RKA-K/L, rapat koordinasi penyusunan anggaran tahun berikutnya antar unit kerja, penelaahan pagu indikatif.',
      level: 3,
      parent_code: 'KU.01',
      hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran > Perencanaan Anggaran',
      usage_note: 'Gunakan jika substansi naskah membahas penyusunan dan pembahasan rencana anggaran tahun mendatang. Jika naskah adalah undangan rapat internal biasa tanpa fokus anggaran, bandingkan dengan UM.02.01.',
      keywords: ['perencanaan anggaran', 'penyusunan anggaran tahun berikutnya', 'rka kl', 'pagu anggaran', 'rapat koordinasi anggaran'],
    },
    {
      code: 'KU.01.02',
      title: 'Daftar Isian Pelaksanaan Anggaran (DIPA)',
      description: 'Penerbitan, penyerahan, dan pengesahan DIPA petikan maupun DIPA induk tahun anggaran berjalan.',
      level: 3,
      parent_code: 'KU.01',
      hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran > Daftar Isian Pelaksanaan Anggaran (DIPA)',
      usage_note: 'Surat penyampaian petikan DIPA dan alokasi anggaran definitif.',
      keywords: ['dipa petikan', 'pengesahan dipa', 'alokasi definitif', 'anggaran kementerian'],
    },
    {
      code: 'KU.01.03',
      title: 'Revisi Anggaran',
      description: 'Usulan pergeseran alokasi anggaran antar rincian output, akun belanja, atau antar satuan kerja.',
      level: 3,
      parent_code: 'KU.01',
      hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran > Revisi Anggaran',
      usage_note: 'Surat usulan permohonan revisi DIPA ke Direktorat Jenderal Anggaran / Kanwil DJPb.',
      keywords: ['revisi anggaran', 'pergeseran belanja', 'revisi dipa', 'perubahan matrik anggaran'],
    },
    {
      code: 'KU.02',
      title: 'Pelaksanaan Anggaran dan Perbendaharaan',
      description: 'Pencairan dana, penerbitan SPM/SP2D, pengelolaan kas kecil/UP, penggajian, dan honorarium.',
      level: 2,
      parent_code: 'KU',
      hierarchy: 'Keuangan > Pelaksanaan Anggaran dan Perbendaharaan',
      usage_note: 'Sub masalah untuk pengeluaran riil dan operasional kas kantor.',
      keywords: ['pelaksanaan anggaran', 'perbendaharaan', 'spm', 'sp2d', 'uang persediaan', 'gaji'],
    },
    {
      code: 'KU.02.01',
      title: 'Surat Perintah Membayar (SPM) dan SP2D',
      description: 'Penerbitan SPM LS, SPM UP, SPM TUP dan penerbitan SP2D dari KPPN.',
      level: 3,
      parent_code: 'KU.02',
      hierarchy: 'Keuangan > Pelaksanaan Anggaran dan Perbendaharaan > Surat Perintah Membayar (SPM) dan SP2D',
      usage_note: 'Dokumen pengajuan tagihan ke bendahara umum negara / KPPN.',
      keywords: ['spm', 'sp2d', 'surat perintah membayar', 'pencairan kppn', 'spm langsung'],
    },
    {
      code: 'KU.02.02',
      title: 'Uang Persediaan (UP) dan Ganti Uang (GU)',
      description: 'Pengajuan revolving UP belanja operasional kantor, surat pertanggungjawaban ganti uang.',
      level: 3,
      parent_code: 'KU.02',
      hierarchy: 'Keuangan > Pelaksanaan Anggaran dan Perbendaharaan > Uang Persediaan (UP) dan Ganti Uang (GU)',
      usage_note: 'Pengelolaan kas operasional sehari-hari bendahara pengeluaran.',
      keywords: ['uang persediaan', 'up gu', 'kas kecil', 'revolving kas bendahara'],
    },
    {
      code: 'KU.02.03',
      title: 'Penggajian dan Tunjangan Kinerja',
      description: 'Daftar rekapitulasi gaji bulanan, rapelan gaji, dan surat pembayaran tunjangan kinerja pegawai.',
      level: 3,
      parent_code: 'KU.02',
      hierarchy: 'Keuangan > Pelaksanaan Anggaran dan Perbendaharaan > Penggajian dan Tunjangan Kinerja',
      usage_note: 'Pembayaran hak keuangan pegawai bulanan.',
      keywords: ['gaji bulanan', 'tunjangan kinerja', 'tukin', 'daftar nominatif gaji', 'rapel gaji'],
    },
    {
      code: 'KU.03',
      title: 'Akuntansi dan Pertanggungjawaban Keuangan',
      description: 'Penyusunan laporan keuangan semesteran/tahunan, rekonsiliasi SAKTI, dan tindak lanjut temuan audit BPK.',
      level: 2,
      parent_code: 'KU',
      hierarchy: 'Keuangan > Akuntansi dan Pertanggungjawaban Keuangan',
      usage_note: 'Laporan pertanggungjawaban formal dan audit akuntabilitas fiskal.',
      keywords: ['akuntansi', 'laporan keuangan', 'neraca', 'rekonsiliasi', 'audit bpk', 'tlhp'],
    },
    {
      code: 'KU.03.01',
      title: 'Laporan Keuangan dan Rekonsiliasi',
      description: 'Berita acara rekonsiliasi internal/eksternal, penyusunan LRA, Neraca, dan CaLK instansi.',
      level: 3,
      parent_code: 'KU.03',
      hierarchy: 'Keuangan > Akuntansi dan Pertanggungjawaban Keuangan > Laporan Keuangan dan Rekonsiliasi',
      usage_note: 'Dokumen rekonsiliasi bulanan dan laporan akuntansi keuangan instansi.',
      keywords: ['laporan realisasi anggaran', 'neraca keuangan', 'calk', 'rekonsiliasi sakti', 'bar rekonsiliasi'],
    },
    {
      code: 'KU.03.02',
      title: 'Tindak Lanjut Hasil Pemeriksaan (TLHP)',
      description: 'Tanggapan resmi atas laporan hasil pemeriksaan (LHP) Badan Pemeriksa Keuangan (BPK) atau Inspektorat Jenderal.',
      level: 3,
      parent_code: 'KU.03',
      hierarchy: 'Keuangan > Akuntansi dan Pertanggungjawaban Keuangan > Tindak Lanjut Hasil Pemeriksaan (TLHP)',
      usage_note: 'Dokumen resmi tindak lanjut rekomendasi audit auditor eksternal/internal.',
      keywords: ['tlhp', 'temuan bpk', 'lhp bpk', 'tindak lanjut inspektorat', 'jawaban temuan'],
    },

    // --- UMUM & KETATAUSAHAAN (UM) ---
    {
      code: 'UM',
      title: 'Umum dan Tata Usaha',
      description: 'Ketatausahaan, penyelenggaraan rapat, pengelolaan aset kantor, kehumasan dasar, dan rumah tangga kantor.',
      level: 1,
      parent_code: null,
      hierarchy: 'Umum dan Tata Usaha',
      usage_note: 'Kelompok naskah fasilitatif operasional kantor.',
      keywords: ['umum', 'tata usaha', 'persuratan', 'rapat', 'rumah tangga', 'protokol'],
    },
    {
      code: 'UM.01',
      title: 'Ketatausahaan dan Tata Naskah Dinas',
      description: 'Tata cara pengelolaan surat dinas, cap dinas, penomoran naskah, dan pedoman kearsipan.',
      level: 2,
      parent_code: 'UM',
      hierarchy: 'Umum dan Tata Usaha > Ketatausahaan dan Tata Naskah Dinas',
      usage_note: 'Pedoman dan prosedur penanganan persuratan kedinasan.',
      keywords: ['tata naskah dinas', 'pengelolaan surat', 'cap dinas', 'registrasi surat', 'kearsipan'],
    },
    {
      code: 'UM.01.01',
      title: 'Pengelolaan Surat Masuk dan Keluar',
      description: 'Surat pengantar dinas, buku agenda pengiriman, pengembalian surat salah alamat, dan konfirmasi penerimaan surat.',
      level: 3,
      parent_code: 'UM.01',
      hierarchy: 'Umum dan Tata Usaha > Ketatausahaan dan Tata Naskah Dinas > Pengelolaan Surat Masuk dan Keluar',
      usage_note: 'Khusus untuk surat pengantar umum ekspedisi dan administrasi lalu lintas surat.',
      keywords: ['surat pengantar', 'pengiriman surat', 'ekspedisi surat', 'agenda surat dinas'],
    },
    {
      code: 'UM.01.02',
      title: 'Pengelolaan Arsip dan Jadwal Retensi',
      description: 'Pemindahan arsip inaktif, pemusnahan arsip yang telah melampaui retensi, dan penyerahan arsip statis ke ANRI.',
      level: 3,
      parent_code: 'UM.01',
      hierarchy: 'Umum dan Tata Usaha > Ketatausahaan dan Tata Naskah Dinas > Pengelolaan Arsip dan Jadwal Retensi',
      usage_note: 'Dokumen teknis kearsipan, berita acara pemusnahan, dan daftar arsip inaktif.',
      keywords: ['retensi arsip', 'pemusnahan arsip', 'pemindahan arsip inaktif', 'berita acara arsip'],
    },
    {
      code: 'UM.02',
      title: 'Penyelenggaraan Rapat dan Acara Kedinasan',
      description: 'Undangan rapat dinas internal maupun eksternal, penyusunan notula, risalah rapat, dan penyelenggaraan seremonial.',
      level: 2,
      parent_code: 'UM',
      hierarchy: 'Umum dan Tata Usaha > Penyelenggaraan Rapat dan Acara Kedinasan',
      usage_note: 'Gunakan untuk fasilitasi pertemuan dinas jika substansi spesifik tidak lebih dominan.',
      keywords: ['penyelenggaraan rapat', 'undangan rapat', 'notula', 'risalah rapat', 'acara kedinasan'],
    },
    {
      code: 'UM.02.01',
      title: 'Rapat Koordinasi Internal',
      description: 'Undangan, agenda, dan notula rapat koordinasi rutin staf, rapat pimpinan internal, atau rapat evaluasi bulanan.',
      level: 3,
      parent_code: 'UM.02',
      hierarchy: 'Umum dan Tata Usaha > Penyelenggaraan Rapat dan Acara Kedinasan > Rapat Koordinasi Internal',
      usage_note: 'Dipilih jika fokus naskah adalah penyelenggaraan rapat rutin antar unit/staf tanpa muatan substansi teknis tunggal yang dominan.',
      keywords: ['rapat koordinasi internal', 'undangan rapat dinas', 'rapat pimpinan', 'agenda rapat staf', 'rapat koordinasi antar unit'],
    },
    {
      code: 'UM.02.02',
      title: 'Rapat Koordinasi Lintas Instansi / Eksternal',
      description: 'Undangan rapat kerja, focus group discussion (FGD), atau pertemuan konsultasi yang melibatkan kementerian/lembaga mitra.',
      level: 3,
      parent_code: 'UM.02',
      hierarchy: 'Umum dan Tata Usaha > Penyelenggaraan Rapat dan Acara Kedinasan > Rapat Koordinasi Lintas Instansi / Eksternal',
      usage_note: 'Untuk pertemuan dinas yang mengundang pihak luar/kementerian lain.',
      keywords: ['rapat lintas instansi', 'undangan fgd eksternal', 'pertemuan antar lembaga', 'konsultasi mitra'],
    },
    {
      code: 'UM.02.03',
      title: 'Penyelenggaraan Acara Kedinasan dan Seminar',
      description: 'Penyelenggaraan sosialisasi, lokakarya, seminar kedinasan, dan acara peringatan hari penting instansi.',
      level: 3,
      parent_code: 'UM.02',
      hierarchy: 'Umum dan Tata Usaha > Penyelenggaraan Rapat dan Acara Kedinasan > Penyelenggaraan Acara Kedinasan dan Seminar',
      usage_note: 'Penyelenggaraan forum publik kedinasan berskala besar.',
      keywords: ['seminar nasional', 'sosialisasi kedinasan', 'lokakarya', 'acara perayaan kantor'],
    },
    {
      code: 'UM.03',
      title: 'Rumah Tangga dan Perlengkapan Kantor',
      description: 'Peminjaman aula/ruang rapat, penggunaan kendaraan dinas, kebersihan kantor, dan pengadaan perlengkapan kantor sehari-hari.',
      level: 2,
      parent_code: 'UM',
      hierarchy: 'Umum dan Tata Usaha > Rumah Tangga dan Perlengkapan Kantor',
      usage_note: 'Urusan logistik sarana operasional gedung dan fasilitas kantor.',
      keywords: ['rumah tangga kantor', 'kendaraan dinas', 'ruang rapat', 'fasilitas kantor', 'kebersihan'],
    },
    {
      code: 'UM.03.01',
      title: 'Penggunaan Ruang Rapat dan Aula',
      description: 'Permohonan peminjaman ruang rapat besar, auditorium, sound system, dan konsumsi rapat.',
      level: 3,
      parent_code: 'UM.03',
      hierarchy: 'Umum dan Tata Usaha > Rumah Tangga dan Perlengkapan Kantor > Penggunaan Ruang Rapat dan Aula',
      usage_note: 'Dokumen administrasi peminjaman sarana ruangan internal.',
      keywords: ['peminjaman ruang rapat', 'pemesanan aula', 'konsumsi rapat', 'fasilitas gedung'],
    },
    {
      code: 'UM.03.02',
      title: 'Pengelolaan Kendaraan Dinas Operasional',
      description: 'Surat izin peminjaman kendaraan dinas operasional, perawatan/servis berkala, dan klaim BBM dinas.',
      level: 3,
      parent_code: 'UM.03',
      hierarchy: 'Umum dan Tata Usaha > Rumah Tangga dan Perlengkapan Kantor > Pengelolaan Kendaraan Dinas Operasional',
      usage_note: 'Penggunaan mobil/motor dinas untuk penugasan luar kota atau dalam kota.',
      keywords: ['kendaraan dinas', 'peminjaman mobil operasional', 'perawatan kendaraan kantor', 'servis dinas'],
    },

    // --- HUKUM (HK) ---
    {
      code: 'HK',
      title: 'Hukum dan Perundang-undangan',
      description: 'Penyusunan produk hukum, telaah hukum, advokasi perkara, dan perjanjian kerjasama (MoU/PKS).',
      level: 1,
      parent_code: null,
      hierarchy: 'Hukum dan Perundang-undangan',
      usage_note: 'Kelompok produk hukum, ligitasi, dan kontrak resmi.',
      keywords: ['hukum', 'peraturan', 'perjanjian kerjasama', 'mou', 'pks', 'advokasi'],
    },
    {
      code: 'HK.01',
      title: 'Penyusunan Produk Hukum dan Telaah',
      description: 'Penyusunan Peraturan Pimpinan, Keputusan, Surat Edaran, dan telaah hukum (legal opinion).',
      level: 2,
      parent_code: 'HK',
      hierarchy: 'Hukum dan Perundang-undangan > Penyusunan Produk Hukum dan Telaah',
      usage_note: 'Penerbitan instrumen yuridis formil instansi.',
      keywords: ['produk hukum', 'peraturan menteri', 'surat keputusan', 'surat edaran', 'legal opinion'],
    },
    {
      code: 'HK.01.01',
      title: 'Surat Keputusan (SK) Pimpinan',
      description: 'Rancangan, harmonisasi, dan penetapan Surat Keputusan pimpinan instansi terkait tim kerja, panitia, atau penetapan kebijakan.',
      level: 3,
      parent_code: 'HK.01',
      hierarchy: 'Hukum dan Perundang-undangan > Penyusunan Produk Hukum dan Telaah > Surat Keputusan (SK) Pimpinan',
      usage_note: 'SK pembentukan pokja, panitia pengadaan, tim reformasi birokrasi, dsb.',
      keywords: ['sk pimpinan', 'surat keputusan penetapan', 'sk tim kerja', 'pembentukan panitia'],
    },
    {
      code: 'HK.01.02',
      title: 'Surat Edaran dan Instruksi',
      description: 'Penyampaian arahan kebijakan normatif pimpinan kepada seluruh jajaran satuan kerja.',
      level: 3,
      parent_code: 'HK.01',
      hierarchy: 'Hukum dan Perundang-undangan > Penyusunan Produk Hukum dan Telaah > Surat Edaran dan Instruksi',
      usage_note: 'Surat edaran pimpinan perihal imbauan kedisiplinan, jam kerja, atau protokol kedinasan.',
      keywords: ['surat edaran', 'instruksi menteri', 'edaran pimpinan', 'pedoman pelaksanaan kebijakan'],
    },
    {
      code: 'HK.02',
      title: 'Perjanjian Kerjasama dan Kemitraan',
      description: 'Penyusunan nota kesepahaman (MoU), perjanjian kerjasama teknis (PKS) dengan mitra swasta atau BUMN.',
      level: 2,
      parent_code: 'HK',
      hierarchy: 'Hukum dan Perundang-undangan > Perjanjian Kerjasama dan Kemitraan',
      usage_note: 'Dokumen ikatan hukum kesepahaman dan kemitraan strategis.',
      keywords: ['perjanjian kerjasama', 'mou', 'pks', 'nota kesepahaman', 'kemitraan instansi'],
    },
    {
      code: 'HK.02.01',
      title: 'Nota Kesepahaman (MoU)',
      description: 'Penyusunan, negosiasi klausul, dan penandatanganan Memorandum of Understanding (MoU) antar instansi.',
      level: 3,
      parent_code: 'HK.02',
      hierarchy: 'Hukum dan Perundang-undangan > Perjanjian Kerjasama dan Kemitraan > Nota Kesepahaman (MoU)',
      usage_note: 'Kesepakatan payung umum sebelum perjanjian operasional rinci dibuat.',
      keywords: ['mou', 'nota kesepahaman', 'kerjasama strategis', 'penandatanganan kesepahaman'],
    },
    {
      code: 'HK.02.02',
      title: 'Perjanjian Kerjasama (PKS) Teknis',
      description: 'Perjanjian pelaksanaan teknis operasional bersama mitra, mencakup hak, kewajiban, jangka waktu, dan pembiayaan.',
      level: 3,
      parent_code: 'HK.02',
      hierarchy: 'Hukum dan Perundang-undangan > Perjanjian Kerjasama dan Kemitraan > Perjanjian Kerjasama (PKS) Teknis',
      usage_note: 'Kontrak teknis turunan dari MoU atau kesepakatan pelaksanaan operasional.',
      keywords: ['pks', 'perjanjian kerjasama teknis', 'kontrak operasional mitra', 'klausul kerjasama'],
    },

    // --- HUBUNGAN MASYARAKAT & PROTOKOL (HM) ---
    {
      code: 'HM',
      title: 'Hubungan Masyarakat dan Protokol',
      description: 'Publikasi media, siaran pers, layanan informasi publik (PPID), peliputan acara, dan keprotokolan pimpinan.',
      level: 1,
      parent_code: null,
      hierarchy: 'Hubungan Masyarakat dan Protokol',
      usage_note: 'Komunikasi eksternal, citra instansi, dan perlakuan tamu dinas.',
      keywords: ['humas', 'publikasi', 'siaran pers', 'protokol', 'ppid', 'informasi publik'],
    },
    {
      code: 'HM.01',
      title: 'Pemberitaan dan Siaran Pers',
      description: 'Penyebaran rilis berita, klarifikasi hoaks, penyelenggaraan temu pers/media, dan pengelolaan website.',
      level: 2,
      parent_code: 'HM',
      hierarchy: 'Hubungan Masyarakat dan Protokol > Pemberitaan dan Siaran Pers',
      usage_note: 'Pemberitaan resmi instansi kepada insan jurnalis dan khalayak umum.',
      keywords: ['siaran pers', 'konferensi pers', 'press release', 'klarifikasi media', 'publikasi berita'],
    },
    {
      code: 'HM.01.01',
      title: 'Siaran Pers dan Rilis Berita',
      description: 'Naskah rilis pers resmi terkait capaian program kerja instansi, peresmian fasilitas, atau klarifikasi isu publik.',
      level: 3,
      parent_code: 'HM.01',
      hierarchy: 'Hubungan Masyarakat dan Protokol > Pemberitaan dan Siaran Pers > Siaran Pers dan Rilis Berita',
      usage_note: 'Surat penyampaian siaran pers kepada redaksi media cetak/elektronik.',
      keywords: ['siaran pers', 'press release', 'rilis media', 'pernyataan resmi instansi'],
    },
    {
      code: 'HM.02',
      title: 'Keprotokolan dan Tamu Kedinasan',
      description: 'Penyambutan tamu pejabat tinggi negara, tata tempat VVIP, dan pengaturan jadwal kunjungan kerja pimpinan.',
      level: 2,
      parent_code: 'HM',
      hierarchy: 'Hubungan Masyarakat dan Protokol > Keprotokolan dan Tamu Kedinasan',
      usage_note: 'Tata keprotokolan dan kesantunan acara resmi.',
      keywords: ['protokol', 'tamu vvip', 'kunjungan kerja', 'tata tempat acara', 'audiensi pimpinan'],
    },
    {
      code: 'HM.02.01',
      title: 'Penerimaan Tamu dan Audiensi Pejabat',
      description: 'Permohonan audiensi delegasi luar instansi dengan menteri/kepala lembaga, susunan acara penyambutan tamu resmi.',
      level: 3,
      parent_code: 'HM.02',
      hierarchy: 'Hubungan Masyarakat dan Protokol > Keprotokolan dan Tamu Kedinasan > Penerimaan Tamu dan Audiensi Pejabat',
      usage_note: 'Surat konfirmasi atau permohonan penerimaan audiensi pimpinan.',
      keywords: ['audiensi pimpinan', 'kunjungan tamu resmi', 'penerimaan pejabat', 'delegasi kedinasan'],
    },

    // --- TEKNOLOGI INFORMASI & KOMUNIKASI (TI) ---
    {
      code: 'TI',
      title: 'Teknologi Informasi dan Komunikasi',
      description: 'Infrastruktur server, jaringan komputer, pengembangan sistem aplikasi, dan keamanan siber.',
      level: 1,
      parent_code: null,
      hierarchy: 'Teknologi Informasi dan Komunikasi',
      usage_note: 'Pengelolaan digitalisasi dan sarana komputasi organisasi.',
      keywords: ['teknologi informasi', 'komputer', 'sistem informasi', 'jaringan', 'aplikasi', 'keamanan siber'],
    },
    {
      code: 'TI.01',
      title: 'Infrastruktur Jaringan dan Perangkat Keras',
      description: 'Pemeliharaan data center, bandwidth internet, pemeliharaan router kantor, dan pengadaan PC kerja.',
      level: 2,
      parent_code: 'TI',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Infrastruktur Jaringan dan Perangkat Keras',
      usage_note: 'Hardware, server fisikal, dan konektivitas data.',
      keywords: ['jaringan internet', 'server kantor', 'data center', 'pemeliharaan komputer'],
    },
    {
      code: 'TI.01.01',
      title: 'Jaringan dan Konektivitas Internet',
      description: 'Gangguan internet kantor, permohonan akses VPN kedinasan, penataan bandwidth antar lantai gedung kantor.',
      level: 3,
      parent_code: 'TI.01',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Infrastruktur Jaringan dan Perangkat Keras > Jaringan dan Konektivitas Internet',
      usage_note: 'Layanan jaringan internet dan akses intranet kedinasan.',
      keywords: ['akses internet', 'vpn kedinasan', 'gangguan koneksi', 'jaringan lan wifi'],
    },
    {
      code: 'TI.02',
      title: 'Pengembangan Sistem Aplikasi dan Database',
      description: 'Pembuatan aplikasi persuratan digital, integrasi basis data, migrasi server aplikasi, dan pemeliharaan software.',
      level: 2,
      parent_code: 'TI',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Pengembangan Sistem Aplikasi dan Database',
      usage_note: 'Software aplikasi kedinasan dan pengelolaan basis data.',
      keywords: ['aplikasi persuratan', 'pengembangan sistem', 'database', 'integrasi api', 'srikandi'],
    },
    {
      code: 'TI.02.01',
      title: 'Sistem Informasi Persuratan dan Kearsipan',
      description: 'Pengembangan dan perbaikan modul aplikasi tata persuratan elektronik, sistem e-office, dan tanda tangan elektronik.',
      level: 3,
      parent_code: 'TI.02',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Pengembangan Sistem Aplikasi dan Database > Sistem Informasi Persuratan dan Kearsipan',
      usage_note: 'Khusus untuk dokumen teknis pengembangan/pembaruan modul aplikasi persuratan.',
      keywords: ['aplikasi persuratan dinas', 'e office', 'tanda tangan elektronik tte', 'integrasi srikandi', 'sistem kearsipan digital'],
    },
    {
      code: 'TI.03',
      title: 'Keamanan Informasi dan Sertifikat Elektronik',
      description: 'Penerbitan akun sertifikat elektronik (BSrE), penanganan insiden siber (CSIRT), dan audit keamanan informasi.',
      level: 2,
      parent_code: 'TI',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Keamanan Informasi dan Sertifikat Elektronik',
      usage_note: 'Aspek perlindungan data, kriptografi, dan keamanan siber.',
      keywords: ['keamanan siber', 'sertifikat elektronik', 'bsre bssn', 'tte', 'insiden siber'],
    },
    {
      code: 'TI.03.01',
      title: 'Penerbitan Sertifikat Elektronik dan TTE',
      description: 'Pendaftaran, perpanjangan, dan pencabutan sertifikat elektronik pejabat penandatangan naskah dinas melalui BSrE BSSN.',
      level: 3,
      parent_code: 'TI.03',
      hierarchy: 'Teknologi Informasi dan Komunikasi > Keamanan Informasi dan Sertifikat Elektronik > Penerbitan Sertifikat Elektronik dan TTE',
      usage_note: 'Penerbitan sertifikat digital resmi untuk penandatanganan dokumen.',
      keywords: ['sertifikat elektronik bsre', 'pendaftaran tte', 'tanda tangan digital', 'passphrase tte pejabat'],
    },

    // --- PENGADAAN & LOGISTIK (PL) ---
    {
      code: 'PL',
      title: 'Pengadaan Barang dan Jasa',
      description: 'Perencanaan pengadaan, pemilihan penyedia melalui tender/e-katalog, kontrak pekerjaan, dan serah terima hasil pengadaan.',
      level: 1,
      parent_code: null,
      hierarchy: 'Pengadaan Barang dan Jasa',
      usage_note: 'Kelompok proses tender dan pengadaan inventaris pemerintah.',
      keywords: ['pengadaan', 'tender', 'e-katalog', 'bast', 'kontrak pengadaan', 'pbj'],
    },
    {
      code: 'PL.01',
      title: 'Pelaksanaan Pengadaan Barang dan Jasa',
      description: 'Dokumen Rencana Umum Pengadaan (RUP), penetapan pemenang lelang, surat pesanan, dan Berita Acara Serah Terima (BAST).',
      level: 2,
      parent_code: 'PL',
      hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa',
      usage_note: 'Pelaksanaan tahapan kontrak pengadaan barang dan jasa pemerintah.',
      keywords: ['rup', 'pemilihan penyedia', 'surat pesanan', 'bast', 'lpse', 'ppk'],
    },
    {
      code: 'PL.01.01',
      title: 'Kontrak dan Surat Perjanjian Kerja Pengadaan',
      description: 'Penerbitan Surat Perintah Kerja (SPK), kontrak payung, dan surat pesanan pengadaan perangkat kerja/sarana kantor.',
      level: 3,
      parent_code: 'PL.01',
      hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa > Kontrak dan Surat Perjanjian Kerja Pengadaan',
      usage_note: 'Surat perjanjian perikatan kerja antara Pejabat Pembuat Komitmen (PPK) dengan penyedia rekanan.',
      keywords: ['surat perintah kerja spk', 'kontrak pengadaan', 'surat pesanan e-katalog', 'perjanjian kerja pbj'],
    },
    {
      code: 'PL.01.02',
      title: 'Berita Acara Serah Terima (BAST) Pekerjaan',
      description: 'Pemeriksaan barang/jasa hasil pekerjaan, pengujian spesifikasi teknis, dan penandatanganan BAST untuk proses pembayaran.',
      level: 3,
      parent_code: 'PL.01',
      hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa > Berita Acara Serah Terima (BAST) Pekerjaan',
      usage_note: 'Dokumen serah terima hasil pengadaan sebelum tagihan diajukan ke bendahara.',
      keywords: ['bast pengadaan', 'serah terima barang jasa', 'pemeriksaan hasil pekerjaan', 'uji fungsi barang'],
    },
  ];

  const guideline_codes: GuidelineCode[] = rawCodes.map((item, idx) => ({
    id: `gc-${idx + 1}`,
    version_id: defaultVersionId,
    code: item.code,
    title: item.title,
    description: item.description,
    level: item.level,
    parent_code: item.parent_code,
    hierarchy: item.hierarchy,
    usage_note: item.usage_note,
    keywords: item.keywords,
  }));

  // Initial Seed Documents & Verifications for Realistic Baseline & Metrics
  const sampleDocs: {
    doc: DocumentRecord;
    rec: Recommendation;
    ver: Verification;
  }[] = [
    {
      doc: {
        id: 'doc-seed-1',
        description_text: 'Surat permohonan usulan formasi kebutuhan CPNS dan PPPK tahun 2027 ke Kementerian PANRB',
        unit: 'Bagian Kepegawaian',
        letter_type: 'Surat Dinas Keluar',
        created_by: 'u-1',
        created_by_name: 'Rian Pratama',
        created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      },
      rec: {
        id: 'rec-seed-1',
        document_id: 'doc-seed-1',
        version_id: defaultVersionId,
        version_name: guideline_versions[0].name,
        primary_code: 'KP.01.01',
        primary_title: 'Formasi Pegawai',
        primary_hierarchy: 'Kepegawaian > Pengadaan Pegawai > Formasi Pegawai',
        primary_reason: 'Isi surat secara eksplisit memuat permohonan usulan formasi kebutuhan pegawai baru (CPNS dan PPPK) ke KemenPANRB.',
        confidence: 0.94,
        alternatives: [
          {
            code: 'KP.01.02',
            title: 'Penerimaan CPNS dan PPPK',
            hierarchy: 'Kepegawaian > Pengadaan Pegawai > Penerimaan CPNS dan PPPK',
            difference: 'Dipilih jika kegiatan telah memasuki tahap penerimaan/pendaftaran seleksi peserta ujian.',
          },
        ],
        reference_valid: true,
        status: 'ditemukan',
        ai_duration_seconds: 1.4,
        analysis: {
          content: 'Permohonan usulan formasi kebutuhan pegawai',
          function: 'Pengadaan Pegawai ASN',
          activity: 'Penyusunan usulan formasi ke instansi pembina',
        },
        created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
      },
      ver: {
        id: 'ver-seed-1',
        recommendation_id: 'rec-seed-1',
        document_id: 'doc-seed-1',
        decision: 'approved',
        final_code: 'KP.01.01',
        final_title: 'Formasi Pegawai',
        final_hierarchy: 'Kepegawaian > Pengadaan Pegawai > Formasi Pegawai',
        note: 'Sesuai dengan pedoman, sudah dicek rujukan butir KP.01.01.',
        verified_by: 'u-1',
        verified_by_name: 'Rian Pratama',
        verified_at: new Date(Date.now() - 48 * 3600 * 1000 + 45000).toISOString(),
        verification_seconds: 45,
      },
    },
    {
      doc: {
        id: 'doc-seed-2',
        description_text: 'Surat undangan rapat koordinasi penyusunan anggaran tahun berikutnya antar seluruh kepala unit kerja',
        unit: 'Biro Keuangan dan BMN',
        letter_type: 'Nota Dinas / Undangan',
        created_by: 'u-2',
        created_by_name: 'Dewi Lestari',
        created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      },
      rec: {
        id: 'rec-seed-2',
        document_id: 'doc-seed-2',
        version_id: defaultVersionId,
        version_name: guideline_versions[0].name,
        primary_code: 'KU.01.01',
        primary_title: 'Perencanaan Anggaran',
        primary_hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran > Perencanaan Anggaran',
        primary_reason: 'Dokumen difokuskan pada kegiatan substansi perencanaan dan penyusunan anggaran tahun mendatang antar unit kerja.',
        confidence: 0.78,
        alternatives: [
          {
            code: 'UM.02.01',
            title: 'Rapat Koordinasi Internal',
            hierarchy: 'Umum dan Tata Usaha > Penyelenggaraan Rapat dan Acara Kedinasan > Rapat Koordinasi Internal',
            difference: 'Dipilih jika petugas menitikberatkan pada format acara penyelenggaraan rapat rutin umum dibanding substansi fiskalnya.',
          },
        ],
        reference_valid: true,
        status: 'ambigu',
        ai_duration_seconds: 1.8,
        analysis: {
          content: 'Undangan rapat koordinasi penyusunan anggaran',
          function: 'Perencanaan dan Penganggaran',
          activity: 'Rapat koordinasi perencanaan pagu anggaran antar unit',
        },
        created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      },
      ver: {
        id: 'ver-seed-2',
        recommendation_id: 'rec-seed-2',
        document_id: 'doc-seed-2',
        decision: 'approved',
        final_code: 'KU.01.01',
        final_title: 'Perencanaan Anggaran',
        final_hierarchy: 'Keuangan > Perencanaan dan Penyusunan Anggaran > Perencanaan Anggaran',
        note: 'Memilih kode substansi anggaran KU.01.01 sesuai arahan pimpinan.',
        verified_by: 'u-2',
        verified_by_name: 'Dewi Lestari',
        verified_at: new Date(Date.now() - 36 * 3600 * 1000 + 62000).toISOString(),
        verification_seconds: 62,
      },
    },
    {
      doc: {
        id: 'doc-seed-3',
        description_text: 'Surat permohonan penerbitan sertifikat elektronik untuk tanda tangan digital pejabat eselon III',
        unit: 'Pusat Data dan Informasi',
        letter_type: 'Surat Permohonan',
        created_by: 'u-1',
        created_by_name: 'Rian Pratama',
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      },
      rec: {
        id: 'rec-seed-3',
        document_id: 'doc-seed-3',
        version_id: defaultVersionId,
        version_name: guideline_versions[0].name,
        primary_code: 'TI.03.01',
        primary_title: 'Penerbitan Sertifikat Elektronik dan TTE',
        primary_hierarchy: 'Teknologi Informasi dan Komunikasi > Keamanan Informasi dan Sertifikat Elektronik > Penerbitan Sertifikat Elektronik dan TTE',
        primary_reason: 'Permohonan ditujukan untuk pembuatan sertifikat digital dan tanda tangan elektronik pejabat ke BSrE.',
        confidence: 0.96,
        alternatives: [
          {
            code: 'TI.02.01',
            title: 'Sistem Informasi Persuratan dan Kearsipan',
            hierarchy: 'Teknologi Informasi dan Komunikasi > Pengembangan Sistem Aplikasi dan Database > Sistem Informasi Persuratan dan Kearsipan',
            difference: 'Dipilih jika permohonan berkaitan dengan konfigurasi teknis aplikasi persuratan bukan sertifikat identitasnya.',
          },
        ],
        reference_valid: true,
        status: 'ditemukan',
        ai_duration_seconds: 1.3,
        analysis: {
          content: 'Permohonan sertifikat digital pejabat',
          function: 'Keamanan Informasi dan Kriptografi',
          activity: 'Penerbitan sertifikat elektronik TTE',
        },
        created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      },
      ver: {
        id: 'ver-seed-3',
        recommendation_id: 'rec-seed-3',
        document_id: 'doc-seed-3',
        decision: 'approved',
        final_code: 'TI.03.01',
        final_title: 'Penerbitan Sertifikat Elektronik dan TTE',
        final_hierarchy: 'Teknologi Informasi dan Komunikasi > Keamanan Informasi dan Sertifikat Elektronik > Penerbitan Sertifikat Elektronik dan TTE',
        note: 'Rekomendasi akurat dan rujukan valid.',
        verified_by: 'u-1',
        verified_by_name: 'Rian Pratama',
        verified_at: new Date(Date.now() - 24 * 3600 * 1000 + 38000).toISOString(),
        verification_seconds: 38,
      },
    },
    {
      doc: {
        id: 'doc-seed-4',
        description_text: 'Surat tugas tim pendampingan hukum dan advokasi gugatan tata usaha negara di Pengadilan Tata Usaha Negara (PTUN)',
        unit: 'Biro Hukum dan Organisasi',
        letter_type: 'Surat Perintah / Surat Tugas',
        created_by: 'u-2',
        created_by_name: 'Dewi Lestari',
        created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      },
      rec: {
        id: 'rec-seed-4',
        document_id: 'doc-seed-4',
        version_id: defaultVersionId,
        version_name: guideline_versions[0].name,
        primary_code: 'HK.01.01',
        primary_title: 'Surat Keputusan (SK) Pimpinan',
        primary_hierarchy: 'Hukum dan Perundang-undangan > Penyusunan Produk Hukum dan Telaah > Surat Keputusan (SK) Pimpinan',
        primary_reason: 'Terkait penugasan yuridis penanganan perkara hukum instansi.',
        confidence: 0.68,
        alternatives: [
          {
            code: 'HK',
            title: 'Hukum dan Perundang-undangan',
            hierarchy: 'Hukum dan Perundang-undangan',
            difference: 'Dipilih jika mencakup penanganan perkara perdata atau TUN secara menyeluruh.',
          },
        ],
        reference_valid: true,
        status: 'ambigu',
        ai_duration_seconds: 1.6,
        analysis: {
          content: 'Surat tugas pendampingan sidang PTUN',
          function: 'Advokasi dan Bantuan Hukum',
          activity: 'Penugasan sidang sengketa tata usaha negara',
        },
        created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      },
      ver: {
        id: 'ver-seed-4',
        recommendation_id: 'rec-seed-4',
        document_id: 'doc-seed-4',
        decision: 'corrected',
        final_code: 'HK',
        final_title: 'Hukum dan Perundang-undangan',
        final_hierarchy: 'Hukum dan Perundang-undangan',
        note: 'Dikoreksi ke rumpun induk HK karena butir khusus litigasi PTUN belum dirinci pada sub-sub masalah.',
        verified_by: 'u-2',
        verified_by_name: 'Dewi Lestari',
        verified_at: new Date(Date.now() - 12 * 3600 * 1000 + 75000).toISOString(),
        verification_seconds: 75,
      },
    },
    {
      doc: {
        id: 'doc-seed-5',
        description_text: 'Berita Acara Serah Terima (BAST) pengadaan 50 unit laptop kerja staf dari penyedia PT Solusi Mandiri',
        unit: 'Unit Kerja Pengadaan Barang/Jasa (UKPBJ)',
        letter_type: 'Berita Acara',
        created_by: 'u-1',
        created_by_name: 'Rian Pratama',
        created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
      rec: {
        id: 'rec-seed-5',
        document_id: 'doc-seed-5',
        version_id: defaultVersionId,
        version_name: guideline_versions[0].name,
        primary_code: 'PL.01.02',
        primary_title: 'Berita Acara Serah Terima (BAST) Pekerjaan',
        primary_hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa > Berita Acara Serah Terima (BAST) Pekerjaan',
        primary_reason: 'Dokumen secara jelas merupakan Berita Acara Serah Terima (BAST) pengadaan laptop inventaris kantor.',
        confidence: 0.98,
        alternatives: [
          {
            code: 'PL.01.01',
            title: 'Kontrak dan Surat Perjanjian Kerja Pengadaan',
            hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa > Kontrak dan Surat Perjanjian Kerja Pengadaan',
            difference: 'Dipilih saat tahap awal penerbitan SPK atau surat pesanan bukan saat serah terima barang.',
          },
        ],
        reference_valid: true,
        status: 'ditemukan',
        ai_duration_seconds: 1.2,
        analysis: {
          content: 'Serah terima hasil pekerjaan pengadaan laptop',
          function: 'Pengadaan Barang dan Jasa Pemerintah',
          activity: 'Penandatanganan BAST hasil pengadaan',
        },
        created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
      ver: {
        id: 'ver-seed-5',
        recommendation_id: 'rec-seed-5',
        document_id: 'doc-seed-5',
        decision: 'approved',
        final_code: 'PL.01.02',
        final_title: 'Berita Acara Serah Terima (BAST) Pekerjaan',
        final_hierarchy: 'Pengadaan Barang dan Jasa > Pelaksanaan Pengadaan Barang dan Jasa > Berita Acara Serah Terima (BAST) Pekerjaan',
        note: 'Sesuai dengan berkas pengadaan fisik.',
        verified_by: 'u-1',
        verified_by_name: 'Rian Pratama',
        verified_at: new Date(Date.now() - 6 * 3600 * 1000 + 40000).toISOString(),
        verification_seconds: 40,
      },
    },
  ];

  return {
    users,
    guideline_versions,
    guideline_codes,
    documents: sampleDocs.map((s) => s.doc),
    recommendations: sampleDocs.map((s) => s.rec),
    verifications: sampleDocs.map((s) => s.ver),
  };
}

// Database repository singleton
class Database {
  private data: DatabaseSchema;

  constructor() {
    ensureDataDirectory();
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (e) {
        console.error('Failed to read database file, reinitializing seed data:', e);
        this.data = getSeedData();
        this.save();
      }
    } else {
      this.data = getSeedData();
      this.save();
    }
  }

  private save() {
    try {
      ensureDataDirectory();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist database file:', e);
    }
  }

  // --- Guideline Versions ---
  getActiveGuidelineVersion(): GuidelineVersion | undefined {
    return this.data.guideline_versions.find((v) => v.is_active) || this.data.guideline_versions[0];
  }

  getAllGuidelineVersions(): GuidelineVersion[] {
    return this.data.guideline_versions.map((v) => {
      const count = this.data.guideline_codes.filter((c) => c.version_id === v.id).length;
      return { ...v, total_codes: count };
    });
  }

  setActiveGuidelineVersion(versionId: string): boolean {
    const target = this.data.guideline_versions.find((v) => v.id === versionId);
    if (!target) return false;
    this.data.guideline_versions.forEach((v) => {
      v.is_active = v.id === versionId;
    });
    this.save();
    return true;
  }

  createGuidelineVersion(name: string, description: string, effective_date: string): GuidelineVersion {
    const newVersion: GuidelineVersion = {
      id: `gv-${Date.now()}`,
      name,
      description,
      effective_date,
      is_active: false,
      total_codes: 0,
    };
    this.data.guideline_versions.push(newVersion);
    this.save();
    return newVersion;
  }

  // --- Guideline Codes ---
  getGuidelineCodes(versionId?: string, query?: string, level?: number): GuidelineCode[] {
    const targetVersion = versionId || this.getActiveGuidelineVersion()?.id;
    let list = this.data.guideline_codes.filter((c) => c.version_id === targetVersion);

    if (level !== undefined && level > 0) {
      list = list.filter((c) => c.level === level);
    }

    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      list = list.filter((c) => {
        return (
          c.code.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.hierarchy.toLowerCase().includes(q) ||
          (c.keywords && c.keywords.some((k) => k.toLowerCase().includes(q))) ||
          (c.usage_note && c.usage_note.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }

  findCodeByCode(code: string, versionId?: string): GuidelineCode | undefined {
    const targetVersion = versionId || this.getActiveGuidelineVersion()?.id;
    return this.data.guideline_codes.find(
      (c) => c.version_id === targetVersion && c.code.toLowerCase() === code.trim().toLowerCase()
    );
  }

  addGuidelineCode(codeData: Omit<GuidelineCode, 'id'>): GuidelineCode {
    const id = `gc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newCode: GuidelineCode = {
      ...codeData,
      id,
    };
    this.data.guideline_codes.push(newCode);
    this.save();
    return newCode;
  }

  updateGuidelineCode(id: string, updates: Partial<Omit<GuidelineCode, 'id' | 'version_id'>>): GuidelineCode | null {
    const index = this.data.guideline_codes.findIndex((c) => c.id === id);
    if (index === -1) return null;
    this.data.guideline_codes[index] = {
      ...this.data.guideline_codes[index],
      ...updates,
    };
    this.save();
    return this.data.guideline_codes[index];
  }

  deleteGuidelineCode(id: string): boolean {
    const index = this.data.guideline_codes.findIndex((c) => c.id === id);
    if (index === -1) return false;
    this.data.guideline_codes.splice(index, 1);
    this.save();
    return true;
  }

  // --- Candidate Retrieval (Anti-Hallucination Pipeline FR-02, FR-03) ---
  retrieveCandidateCodes(description: string, maxCandidates: number = 8): GuidelineCode[] {
    const activeVersion = this.getActiveGuidelineVersion();
    if (!activeVersion) return [];

    const codes = this.data.guideline_codes.filter((c) => c.version_id === activeVersion.id);
    const tokens = description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Score each code based on token matches in code, title, description, usage_note, and keywords
    const scored = codes.map((c) => {
      let score = 0;
      const titleLower = c.title.toLowerCase();
      const descLower = c.description.toLowerCase();
      const noteLower = (c.usage_note || '').toLowerCase();
      const keywordsLower = c.keywords.map((k) => k.toLowerCase());

      for (const t of tokens) {
        if (titleLower.includes(t)) score += 4;
        if (descLower.includes(t)) score += 2;
        if (noteLower.includes(t)) score += 3;
        for (const kw of keywordsLower) {
          if (kw.includes(t)) score += 5;
        }
      }

      // Prioritize level 3 (sub-sub masalah) for granular archiving precision, but keep parents if relevant
      if (c.level === 3) score += 1;

      return { code: c, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Return the top candidates that have at least some relevance, or fallback to representative level 3 codes
    const candidates = scored.filter((s) => s.score > 0).slice(0, maxCandidates).map((s) => s.code);

    if (candidates.length < 3) {
      // Add standard high-level categories or common codes to give the AI genuine options
      const fallbacks = codes.filter((c) => c.level === 3 && !candidates.some((cand) => cand.id === c.id)).slice(0, 5);
      candidates.push(...fallbacks);
    }

    return candidates.slice(0, maxCandidates);
  }

  // --- Document Storage ---
  createDocument(doc: Omit<DocumentRecord, 'id' | 'created_at'>): DocumentRecord {
    const id = `doc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newDoc: DocumentRecord = {
      ...doc,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.documents.unshift(newDoc);
    this.save();
    return newDoc;
  }

  getDocumentById(id: string): DocumentRecord | undefined {
    return this.data.documents.find((d) => d.id === id);
  }

  // --- Recommendations ---
  createRecommendation(rec: Omit<Recommendation, 'id' | 'created_at'>): Recommendation {
    const id = `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newRec: Recommendation = {
      ...rec,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.recommendations.unshift(newRec);
    this.save();
    return newRec;
  }

  getRecommendationById(id: string): Recommendation | undefined {
    return this.data.recommendations.find((r) => r.id === id);
  }

  getRecommendationByDocumentId(documentId: string): Recommendation | undefined {
    return this.data.recommendations.find((r) => r.document_id === documentId);
  }

  // --- Verifications (FR-07, FR-08) ---
  saveVerification(verData: Omit<Verification, 'id' | 'verified_at'>): Verification {
    // Check if verification already exists for this recommendation (rule: cannot overwrite with AI)
    const existingIndex = this.data.verifications.findIndex(
      (v) => v.recommendation_id === verData.recommendation_id
    );

    const verified_at = new Date().toISOString();
    let saved: Verification;

    if (existingIndex !== -1) {
      // Update officer's own previous decision
      saved = {
        ...this.data.verifications[existingIndex],
        ...verData,
        verified_at,
      };
      this.data.verifications[existingIndex] = saved;
    } else {
      const id = `ver-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      saved = {
        ...verData,
        id,
        verified_at,
      };
      this.data.verifications.unshift(saved);
    }

    this.save();
    return saved;
  }

  getVerificationByRecommendationId(recId: string): Verification | undefined {
    return this.data.verifications.find((v) => v.recommendation_id === recId);
  }

  // --- Similar Documents (FR-10) ---
  findSimilarDocuments(description: string, currentDocId?: string, limit: number = 4): SimilarDocumentItem[] {
    const tokens = description
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const verifiedDocs = this.data.verifications.map((v) => {
      const doc = this.data.documents.find((d) => d.id === v.document_id);
      return { verification: v, document: doc };
    }).filter((item) => item.document && item.document.id !== currentDocId);

    const scored = verifiedDocs.map(({ verification, document }) => {
      if (!document) return { item: null, score: 0 };
      const docTokens = document.description_text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      let matches = 0;
      for (const t of tokens) {
        if (docTokens.includes(t)) matches += 1;
      }

      const score = tokens.length > 0 ? matches / tokens.length : 0;
      return {
        item: {
          document_id: document.id,
          description_text: document.description_text,
          unit: document.unit,
          letter_type: document.letter_type,
          final_code: verification.final_code,
          final_title: verification.final_title,
          final_hierarchy: verification.final_hierarchy,
          verified_at: verification.verified_at,
          verified_by_name: verification.verified_by_name,
          similarity_score: Math.min(1, Math.round(score * 100) / 100),
        } as SimilarDocumentItem,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter((s) => s.item && s.score > 0.15)
      .slice(0, limit)
      .map((s) => s.item!);
  }

  // --- Classification History with Detailed Joins ---
  getHistory(options?: {
    search?: string;
    decision?: string;
    officerId?: string;
    limit?: number;
  }) {
    const { search, decision, officerId, limit = 50 } = options || {};

    let list = this.data.documents.map((doc) => {
      const recommendation = this.data.recommendations.find((r) => r.document_id === doc.id);
      const verification = recommendation
        ? this.data.verifications.find((v) => v.recommendation_id === recommendation.id)
        : undefined;

      return {
        document: doc,
        recommendation,
        verification,
      };
    });

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((item) => {
        return (
          item.document.description_text.toLowerCase().includes(q) ||
          (item.document.unit && item.document.unit.toLowerCase().includes(q)) ||
          (item.recommendation?.primary_code && item.recommendation.primary_code.toLowerCase().includes(q)) ||
          (item.verification?.final_code && item.verification.final_code.toLowerCase().includes(q))
        );
      });
    }

    if (decision && decision !== 'all') {
      if (decision === 'unverified') {
        list = list.filter((item) => !item.verification);
      } else {
        list = list.filter((item) => item.verification?.decision === decision);
      }
    }

    if (officerId && officerId !== 'all') {
      list = list.filter((item) => item.verification?.verified_by === officerId || item.document.created_by === officerId);
    }

    return list.slice(0, limit);
  }

  // --- Metrics Summary (FR-12 & Success Metrics M1-M4) ---
  calculateMetrics(officerId?: string): MetricsSummary {
    let verifications = [...this.data.verifications];
    let recommendations = [...this.data.recommendations];

    if (officerId && officerId !== 'all') {
      verifications = verifications.filter((v) => v.verified_by === officerId);
      const verifiedRecIds = new Set(verifications.map((v) => v.recommendation_id));
      recommendations = recommendations.filter((r) => verifiedRecIds.has(r.id));
    }

    const baselineMinutes = 60; // M1 baseline: 60 minutes manual search

    // M1: Average time per document (in minutes). We sum AI duration + Officer verification seconds
    let totalSeconds = 0;
    verifications.forEach((v) => {
      const rec = this.data.recommendations.find((r) => r.id === v.recommendation_id);
      const aiTime = rec?.ai_duration_seconds || 2;
      const verTime = v.verification_seconds || 45;
      totalSeconds += aiTime + verTime;
    });

    const avgMinutes = verifications.length > 0 ? (totalSeconds / verifications.length) / 60 : 1.2;
    const reductionPercent = Math.max(0, ((baselineMinutes - avgMinutes) / baselineMinutes) * 100);

    // M2: Conformity percentage (rekomendasi disetujui / total verifikasi)
    const approvedCount = verifications.filter((v) => v.decision === 'approved').length;
    const conformityPercent = verifications.length > 0 ? (approvedCount / verifications.length) * 100 : 85;

    // M3: Correction frequency (jumlah koreksi / total dokumen)
    const correctedCount = verifications.filter((v) => v.decision === 'corrected').length;
    const correctionRatePercent = verifications.length > 0 ? (correctedCount / verifications.length) * 100 : 10;

    // M4: Valid guideline references percentage (100% target)
    const validRecCount = recommendations.filter((r) => r.reference_valid).length;
    const validReferencePercent = recommendations.length > 0 ? (validRecCount / recommendations.length) * 100 : 100;

    const statusDist = {
      ditemukan: recommendations.filter((r) => r.status === 'ditemukan').length,
      ambigu: recommendations.filter((r) => r.status === 'ambigu').length,
      tidak_ditemukan: recommendations.filter((r) => r.status === 'tidak_ditemukan').length,
    };

    const decisionDist = {
      approved: approvedCount,
      alternative_chosen: verifications.filter((v) => v.decision === 'alternative_chosen').length,
      corrected: correctedCount,
    };

    // Recent 7 days trend
    const recentTrend: { [date: string]: { total: number; approved: number; corrected: number; secSum: number } } = {};
    verifications.forEach((v) => {
      const d = v.verified_at.split('T')[0];
      if (!recentTrend[d]) {
        recentTrend[d] = { total: 0, approved: 0, corrected: 0, secSum: 0 };
      }
      recentTrend[d].total += 1;
      if (v.decision === 'approved') recentTrend[d].approved += 1;
      if (v.decision === 'corrected') recentTrend[d].corrected += 1;
      recentTrend[d].secSum += v.verification_seconds || 45;
    });

    const trendArray = Object.keys(recentTrend)
      .sort()
      .map((date) => ({
        date,
        total: recentTrend[date].total,
        approved: recentTrend[date].approved,
        corrected: recentTrend[date].corrected,
        avg_seconds: Math.round(recentTrend[date].secSum / recentTrend[date].total),
      }));

    return {
      m1_average_time_minutes: Math.round(avgMinutes * 10) / 10,
      m1_baseline_minutes: baselineMinutes,
      m1_reduction_percent: Math.round(reductionPercent * 10) / 10,
      m2_conformity_percent: Math.round(conformityPercent * 10) / 10,
      m2_approved_count: approvedCount,
      m2_total_verifications: verifications.length,
      m3_correction_rate_percent: Math.round(correctionRatePercent * 10) / 10,
      m3_corrected_count: correctedCount,
      m4_valid_reference_percent: Math.round(validReferencePercent * 10) / 10,
      m4_valid_count: validRecCount,
      m4_total_recommendations: recommendations.length,
      total_documents_processed: this.data.documents.length,
      status_distribution: statusDist,
      decision_distribution: decisionDist,
      recent_trend: trendArray,
    };
  }

  // --- Users & Roles ---
  getUsers(): User[] {
    return this.data.users;
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }
}

export const db = new Database();
