/**
 * Master Data Wilayah Administratif Indonesia (Kepmendagri No. 300.2.2-2138 Tahun 2025)
 * Admin SUN89 — Biro Jasa Management System
 * 
 * Target Cakupan Resmi:
 * - 38 Provinsi
 * - 416 Kabupaten
 * - 98 Kota
 * - Total 514 Kabupaten/Kota
 */

export interface ProvinsiItem {
  kode_provinsi: string;
  nama_provinsi: string;
}

export interface WilayahAdministratifItem {
  kode_kabupaten_kota: string; // Official code e.g. "31.75"
  kode_provinsi: string; // Official province code e.g. "31"
  nama_provinsi: string;
  nama_kabupaten_kota: string;
  jenis_wilayah: "Kabupaten" | "Kota";
  status_aktif: boolean;
  sumber_referensi: string;
  tahun_referensi: number;
}

export const WILAYAH_REFERENSI = {
  sumber: "Keputusan Menteri Dalam Negeri Nomor 300.2.2-2138 Tahun 2025",
  tahun: 2025,
  totalProvinsi: 38,
  totalKabupatenKota: 514,
  totalKabupaten: 416,
  totalKota: 98,
};

export const PROVINSI_LIST: ProvinsiItem[] = [
  {
    "kode_provinsi": "11",
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "12",
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "13",
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "14",
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "15",
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "16",
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "17",
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "18",
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "19",
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "21",
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "31",
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "32",
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "33",
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "34",
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "35",
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "36",
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "51",
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "52",
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "53",
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "61",
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "62",
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "63",
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "64",
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "65",
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "71",
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "72",
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "73",
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "74",
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "75",
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "76",
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "81",
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "82",
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "91",
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "92",
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "93",
    "nama_provinsi": "Papua Selatan"
  },
  {
    "kode_provinsi": "94",
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "95",
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "96",
    "nama_provinsi": "Papua Barat Daya"
  }
];

export const WILAYAH_ADMINISTRATIF_LIST: WilayahAdministratifItem[] = [
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.01",
    "nama_kabupaten_kota": "Kabupaten Aceh Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.02",
    "nama_kabupaten_kota": "Kabupaten Aceh Tenggara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.03",
    "nama_kabupaten_kota": "Kabupaten Aceh Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.04",
    "nama_kabupaten_kota": "Kabupaten Aceh Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.05",
    "nama_kabupaten_kota": "Kabupaten Aceh Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.06",
    "nama_kabupaten_kota": "Kabupaten Aceh Besar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.07",
    "nama_kabupaten_kota": "Kabupaten Pidie",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.08",
    "nama_kabupaten_kota": "Kabupaten Aceh Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.09",
    "nama_kabupaten_kota": "Kabupaten Simeulue",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.10",
    "nama_kabupaten_kota": "Kabupaten Aceh Singkil",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.11",
    "nama_kabupaten_kota": "Kabupaten Bireuen",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.12",
    "nama_kabupaten_kota": "Kabupaten Aceh Barat Daya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.13",
    "nama_kabupaten_kota": "Kabupaten Gayo Lues",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.14",
    "nama_kabupaten_kota": "Kabupaten Aceh Jaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.15",
    "nama_kabupaten_kota": "Kabupaten Nagan Raya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.16",
    "nama_kabupaten_kota": "Kabupaten Aceh Tamiang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.17",
    "nama_kabupaten_kota": "Kabupaten Bener Meriah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.18",
    "nama_kabupaten_kota": "Kabupaten Pidie Jaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.71",
    "nama_kabupaten_kota": "Kota Banda Aceh",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.72",
    "nama_kabupaten_kota": "Kota Sabang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.73",
    "nama_kabupaten_kota": "Kota Lhokseumawe",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.74",
    "nama_kabupaten_kota": "Kota Langsa",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "11",
    "kode_kabupaten_kota": "11.75",
    "nama_kabupaten_kota": "Kota Subulussalam",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Aceh"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.01",
    "nama_kabupaten_kota": "Kabupaten Tapanuli Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.02",
    "nama_kabupaten_kota": "Kabupaten Tapanuli Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.03",
    "nama_kabupaten_kota": "Kabupaten Tapanuli Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.04",
    "nama_kabupaten_kota": "Kabupaten Nias",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.05",
    "nama_kabupaten_kota": "Kabupaten Langkat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.06",
    "nama_kabupaten_kota": "Kabupaten Karo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.07",
    "nama_kabupaten_kota": "Kabupaten Deli Serdang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.08",
    "nama_kabupaten_kota": "Kabupaten Simalungun",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.09",
    "nama_kabupaten_kota": "Kabupaten Asahan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.10",
    "nama_kabupaten_kota": "Kabupaten Labuhanbatu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.11",
    "nama_kabupaten_kota": "Kabupaten Dairi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.12",
    "nama_kabupaten_kota": "Kabupaten Toba",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.13",
    "nama_kabupaten_kota": "Kabupaten Mandailing Natal",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.14",
    "nama_kabupaten_kota": "Kabupaten Nias Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.15",
    "nama_kabupaten_kota": "Kabupaten Pakpak Bharat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.16",
    "nama_kabupaten_kota": "Kabupaten Humbang Hasundutan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.17",
    "nama_kabupaten_kota": "Kabupaten Samosir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.18",
    "nama_kabupaten_kota": "Kabupaten Serdang Bedagai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.19",
    "nama_kabupaten_kota": "Kabupaten Batu Bara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.20",
    "nama_kabupaten_kota": "Kabupaten Padang Lawas Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.21",
    "nama_kabupaten_kota": "Kabupaten Padang Lawas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.22",
    "nama_kabupaten_kota": "Kabupaten Labuhanbatu Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.23",
    "nama_kabupaten_kota": "Kabupaten Labuhanbatu Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.24",
    "nama_kabupaten_kota": "Kabupaten Nias Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.25",
    "nama_kabupaten_kota": "Kabupaten Nias Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.71",
    "nama_kabupaten_kota": "Kota Medan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.72",
    "nama_kabupaten_kota": "Kota Pematangsiantar",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.73",
    "nama_kabupaten_kota": "Kota Sibolga",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.74",
    "nama_kabupaten_kota": "Kota Tanjungbalai",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.75",
    "nama_kabupaten_kota": "Kota Binjai",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.76",
    "nama_kabupaten_kota": "Kota Tebing Tinggi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.77",
    "nama_kabupaten_kota": "Kota Padangsidimpuan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "12",
    "kode_kabupaten_kota": "12.78",
    "nama_kabupaten_kota": "Kota Gunungsitoli",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Utara"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.01",
    "nama_kabupaten_kota": "Kabupaten Pesisir Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.02",
    "nama_kabupaten_kota": "Kabupaten Solok",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.03",
    "nama_kabupaten_kota": "Kabupaten Sijunjung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.04",
    "nama_kabupaten_kota": "Kabupaten Tanah Datar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.05",
    "nama_kabupaten_kota": "Kabupaten Padang Pariaman",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.06",
    "nama_kabupaten_kota": "Kabupaten Agam",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.07",
    "nama_kabupaten_kota": "Kabupaten Lima Puluh Kota",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.08",
    "nama_kabupaten_kota": "Kabupaten Pasaman",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.09",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Mentawai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.10",
    "nama_kabupaten_kota": "Kabupaten Dharmasraya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.11",
    "nama_kabupaten_kota": "Kabupaten Solok Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.12",
    "nama_kabupaten_kota": "Kabupaten Pasaman Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.71",
    "nama_kabupaten_kota": "Kota Padang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.72",
    "nama_kabupaten_kota": "Kota Solok",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.73",
    "nama_kabupaten_kota": "Kota Sawahlunto",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.74",
    "nama_kabupaten_kota": "Kota Padang Panjang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.75",
    "nama_kabupaten_kota": "Kota Bukittinggi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.76",
    "nama_kabupaten_kota": "Kota Payakumbuh",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "13",
    "kode_kabupaten_kota": "13.77",
    "nama_kabupaten_kota": "Kota Pariaman",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Barat"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.01",
    "nama_kabupaten_kota": "Kabupaten Kampar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.02",
    "nama_kabupaten_kota": "Kabupaten Indragiri Hulu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.03",
    "nama_kabupaten_kota": "Kabupaten Bengkalis",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.04",
    "nama_kabupaten_kota": "Kabupaten Indragiri Hilir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.05",
    "nama_kabupaten_kota": "Kabupaten Pelalawan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.06",
    "nama_kabupaten_kota": "Kabupaten Rokan Hulu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.07",
    "nama_kabupaten_kota": "Kabupaten Rokan Hilir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.08",
    "nama_kabupaten_kota": "Kabupaten Siak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.09",
    "nama_kabupaten_kota": "Kabupaten Kuantan Singingi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.10",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Meranti",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.71",
    "nama_kabupaten_kota": "Kota Pekanbaru",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "14",
    "kode_kabupaten_kota": "14.72",
    "nama_kabupaten_kota": "Kota Dumai",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Riau"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.01",
    "nama_kabupaten_kota": "Kabupaten Kerinci",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.02",
    "nama_kabupaten_kota": "Kabupaten Merangin",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.03",
    "nama_kabupaten_kota": "Kabupaten Sarolangun",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.04",
    "nama_kabupaten_kota": "Kabupaten Batanghari",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.05",
    "nama_kabupaten_kota": "Kabupaten Muaro Jambi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.06",
    "nama_kabupaten_kota": "Kabupaten Tanjung Jabung Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.07",
    "nama_kabupaten_kota": "Kabupaten Tanjung Jabung Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.08",
    "nama_kabupaten_kota": "Kabupaten Bungo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.09",
    "nama_kabupaten_kota": "Kabupaten Tebo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.71",
    "nama_kabupaten_kota": "Kota Jambi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "15",
    "kode_kabupaten_kota": "15.72",
    "nama_kabupaten_kota": "Kota Sungai Penuh",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jambi"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.01",
    "nama_kabupaten_kota": "Kabupaten Ogan Komering Ulu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.02",
    "nama_kabupaten_kota": "Kabupaten Ogan Komering Ilir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.03",
    "nama_kabupaten_kota": "Kabupaten Muara Enim",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.04",
    "nama_kabupaten_kota": "Kabupaten Lahat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.05",
    "nama_kabupaten_kota": "Kabupaten Musi Rawas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.06",
    "nama_kabupaten_kota": "Kabupaten Musi Banyuasin",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.07",
    "nama_kabupaten_kota": "Kabupaten Banyuasin",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.08",
    "nama_kabupaten_kota": "Kabupaten Ogan Komering Ulu Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.09",
    "nama_kabupaten_kota": "Kabupaten Ogan Komering Ulu Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.10",
    "nama_kabupaten_kota": "Kabupaten Ogan Ilir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.11",
    "nama_kabupaten_kota": "Kabupaten Empat Lawang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.12",
    "nama_kabupaten_kota": "Kabupaten Penukal Abab Lematang Ilir",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.13",
    "nama_kabupaten_kota": "Kabupaten Musi Rawas Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.71",
    "nama_kabupaten_kota": "Kota Palembang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.72",
    "nama_kabupaten_kota": "Kota Pagar Alam",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.73",
    "nama_kabupaten_kota": "Kota Lubuk Linggau",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "16",
    "kode_kabupaten_kota": "16.74",
    "nama_kabupaten_kota": "Kota Prabumulih",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sumatera Selatan"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.01",
    "nama_kabupaten_kota": "Kabupaten Bengkulu Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.02",
    "nama_kabupaten_kota": "Kabupaten Rejang Lebong",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.03",
    "nama_kabupaten_kota": "Kabupaten Bengkulu Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.04",
    "nama_kabupaten_kota": "Kabupaten Kaur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.05",
    "nama_kabupaten_kota": "Kabupaten Seluma",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.06",
    "nama_kabupaten_kota": "Kabupaten Mukomuko",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.07",
    "nama_kabupaten_kota": "Kabupaten Lebong",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.08",
    "nama_kabupaten_kota": "Kabupaten Kepahiang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.09",
    "nama_kabupaten_kota": "Kabupaten Bengkulu Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "17",
    "kode_kabupaten_kota": "17.71",
    "nama_kabupaten_kota": "Kota Bengkulu",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bengkulu"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.01",
    "nama_kabupaten_kota": "Kabupaten Lampung Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.02",
    "nama_kabupaten_kota": "Kabupaten Lampung Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.03",
    "nama_kabupaten_kota": "Kabupaten Lampung Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.04",
    "nama_kabupaten_kota": "Kabupaten Lampung Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.05",
    "nama_kabupaten_kota": "Kabupaten Tulang Bawang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.06",
    "nama_kabupaten_kota": "Kabupaten Tanggamus",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.07",
    "nama_kabupaten_kota": "Kabupaten Lampung Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.08",
    "nama_kabupaten_kota": "Kabupaten Way Kanan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.09",
    "nama_kabupaten_kota": "Kabupaten Pesawaran",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.10",
    "nama_kabupaten_kota": "Kabupaten Pringsewu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.11",
    "nama_kabupaten_kota": "Kabupaten Mesuji",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.12",
    "nama_kabupaten_kota": "Kabupaten Tulang Bawang Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.13",
    "nama_kabupaten_kota": "Kabupaten Pesisir Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.71",
    "nama_kabupaten_kota": "Kota Bandar Lampung",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "18",
    "kode_kabupaten_kota": "18.72",
    "nama_kabupaten_kota": "Kota Metro",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Lampung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.01",
    "nama_kabupaten_kota": "Kabupaten Bangka",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.02",
    "nama_kabupaten_kota": "Kabupaten Belitung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.03",
    "nama_kabupaten_kota": "Kabupaten Bangka Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.04",
    "nama_kabupaten_kota": "Kabupaten Bangka Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.05",
    "nama_kabupaten_kota": "Kabupaten Bangka Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.06",
    "nama_kabupaten_kota": "Kabupaten Belitung Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "19",
    "kode_kabupaten_kota": "19.71",
    "nama_kabupaten_kota": "Kota Pangkal Pinang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Bangka Belitung"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.01",
    "nama_kabupaten_kota": "Kabupaten Bintan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.02",
    "nama_kabupaten_kota": "Kabupaten Karimun",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.03",
    "nama_kabupaten_kota": "Kabupaten Natuna",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.04",
    "nama_kabupaten_kota": "Kabupaten Lingga",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.05",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Anambas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.71",
    "nama_kabupaten_kota": "Kota Batam",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "21",
    "kode_kabupaten_kota": "21.72",
    "nama_kabupaten_kota": "Kota Tanjung Pinang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kepulauan Riau"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.01",
    "nama_kabupaten_kota": "Kabupaten Administrasi Kepulauan Seribu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.71",
    "nama_kabupaten_kota": "Kota Administrasi Jakarta Pusat",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.72",
    "nama_kabupaten_kota": "Kota Administrasi Jakarta Utara",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.73",
    "nama_kabupaten_kota": "Kota Administrasi Jakarta Barat",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.74",
    "nama_kabupaten_kota": "Kota Administrasi Jakarta Selatan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "31",
    "kode_kabupaten_kota": "31.75",
    "nama_kabupaten_kota": "Kota Administrasi Jakarta Timur",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Khusus Ibukota Jakarta"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.01",
    "nama_kabupaten_kota": "Kabupaten Bogor",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.02",
    "nama_kabupaten_kota": "Kabupaten Sukabumi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.03",
    "nama_kabupaten_kota": "Kabupaten Cianjur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.04",
    "nama_kabupaten_kota": "Kabupaten Bandung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.05",
    "nama_kabupaten_kota": "Kabupaten Garut",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.06",
    "nama_kabupaten_kota": "Kabupaten Tasikmalaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.07",
    "nama_kabupaten_kota": "Kabupaten Ciamis",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.08",
    "nama_kabupaten_kota": "Kabupaten Kuningan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.09",
    "nama_kabupaten_kota": "Kabupaten Cirebon",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.10",
    "nama_kabupaten_kota": "Kabupaten Majalengka",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.11",
    "nama_kabupaten_kota": "Kabupaten Sumedang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.12",
    "nama_kabupaten_kota": "Kabupaten Indramayu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.13",
    "nama_kabupaten_kota": "Kabupaten Subang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.14",
    "nama_kabupaten_kota": "Kabupaten Purwakarta",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.15",
    "nama_kabupaten_kota": "Kabupaten Karawang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.16",
    "nama_kabupaten_kota": "Kabupaten Bekasi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.17",
    "nama_kabupaten_kota": "Kabupaten Bandung Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.18",
    "nama_kabupaten_kota": "Kabupaten Pangandaran",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.71",
    "nama_kabupaten_kota": "Kota Bogor",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.72",
    "nama_kabupaten_kota": "Kota Sukabumi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.73",
    "nama_kabupaten_kota": "Kota Bandung",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.74",
    "nama_kabupaten_kota": "Kota Cirebon",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.75",
    "nama_kabupaten_kota": "Kota Bekasi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.76",
    "nama_kabupaten_kota": "Kota Depok",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.77",
    "nama_kabupaten_kota": "Kota Cimahi",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.78",
    "nama_kabupaten_kota": "Kota Tasikmalaya",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "32",
    "kode_kabupaten_kota": "32.79",
    "nama_kabupaten_kota": "Kota Banjar",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Barat"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.01",
    "nama_kabupaten_kota": "Kabupaten Cilacap",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.02",
    "nama_kabupaten_kota": "Kabupaten Banyumas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.03",
    "nama_kabupaten_kota": "Kabupaten Purbalingga",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.04",
    "nama_kabupaten_kota": "Kabupaten Banjarnegara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.05",
    "nama_kabupaten_kota": "Kabupaten Kebumen",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.06",
    "nama_kabupaten_kota": "Kabupaten Purworejo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.07",
    "nama_kabupaten_kota": "Kabupaten Wonosobo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.08",
    "nama_kabupaten_kota": "Kabupaten Magelang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.09",
    "nama_kabupaten_kota": "Kabupaten Boyolali",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.10",
    "nama_kabupaten_kota": "Kabupaten Klaten",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.11",
    "nama_kabupaten_kota": "Kabupaten Sukoharjo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.12",
    "nama_kabupaten_kota": "Kabupaten Wonogiri",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.13",
    "nama_kabupaten_kota": "Kabupaten Karanganyar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.14",
    "nama_kabupaten_kota": "Kabupaten Sragen",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.15",
    "nama_kabupaten_kota": "Kabupaten Grobogan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.16",
    "nama_kabupaten_kota": "Kabupaten Blora",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.17",
    "nama_kabupaten_kota": "Kabupaten Rembang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.18",
    "nama_kabupaten_kota": "Kabupaten Pati",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.19",
    "nama_kabupaten_kota": "Kabupaten Kudus",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.20",
    "nama_kabupaten_kota": "Kabupaten Jepara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.21",
    "nama_kabupaten_kota": "Kabupaten Demak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.22",
    "nama_kabupaten_kota": "Kabupaten Semarang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.23",
    "nama_kabupaten_kota": "Kabupaten Temanggung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.24",
    "nama_kabupaten_kota": "Kabupaten Kendal",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.25",
    "nama_kabupaten_kota": "Kabupaten Batang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.26",
    "nama_kabupaten_kota": "Kabupaten Pekalongan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.27",
    "nama_kabupaten_kota": "Kabupaten Pemalang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.28",
    "nama_kabupaten_kota": "Kabupaten Tegal",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.29",
    "nama_kabupaten_kota": "Kabupaten Brebes",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.71",
    "nama_kabupaten_kota": "Kota Magelang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.72",
    "nama_kabupaten_kota": "Kota Surakarta",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.73",
    "nama_kabupaten_kota": "Kota Salatiga",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.74",
    "nama_kabupaten_kota": "Kota Semarang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.75",
    "nama_kabupaten_kota": "Kota Pekalongan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "33",
    "kode_kabupaten_kota": "33.76",
    "nama_kabupaten_kota": "Kota Tegal",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Tengah"
  },
  {
    "kode_provinsi": "34",
    "kode_kabupaten_kota": "34.01",
    "nama_kabupaten_kota": "Kabupaten Kulon Progo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "34",
    "kode_kabupaten_kota": "34.02",
    "nama_kabupaten_kota": "Kabupaten Bantul",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "34",
    "kode_kabupaten_kota": "34.03",
    "nama_kabupaten_kota": "Kabupaten Gunungkidul",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "34",
    "kode_kabupaten_kota": "34.04",
    "nama_kabupaten_kota": "Kabupaten Sleman",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "34",
    "kode_kabupaten_kota": "34.71",
    "nama_kabupaten_kota": "Kota Yogyakarta",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Daerah Istimewa Yogyakarta"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.01",
    "nama_kabupaten_kota": "Kabupaten Pacitan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.02",
    "nama_kabupaten_kota": "Kabupaten Ponorogo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.03",
    "nama_kabupaten_kota": "Kabupaten Trenggalek",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.04",
    "nama_kabupaten_kota": "Kabupaten Tulungagung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.05",
    "nama_kabupaten_kota": "Kabupaten Blitar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.06",
    "nama_kabupaten_kota": "Kabupaten Kediri",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.07",
    "nama_kabupaten_kota": "Kabupaten Malang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.08",
    "nama_kabupaten_kota": "Kabupaten Lumajang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.09",
    "nama_kabupaten_kota": "Kabupaten Jember",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.10",
    "nama_kabupaten_kota": "Kabupaten Banyuwangi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.11",
    "nama_kabupaten_kota": "Kabupaten Bondowoso",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.12",
    "nama_kabupaten_kota": "Kabupaten Situbondo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.13",
    "nama_kabupaten_kota": "Kabupaten Probolinggo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.14",
    "nama_kabupaten_kota": "Kabupaten Pasuruan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.15",
    "nama_kabupaten_kota": "Kabupaten Sidoarjo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.16",
    "nama_kabupaten_kota": "Kabupaten Mojokerto",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.17",
    "nama_kabupaten_kota": "Kabupaten Jombang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.18",
    "nama_kabupaten_kota": "Kabupaten Nganjuk",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.19",
    "nama_kabupaten_kota": "Kabupaten Madiun",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.20",
    "nama_kabupaten_kota": "Kabupaten Magetan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.21",
    "nama_kabupaten_kota": "Kabupaten Ngawi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.22",
    "nama_kabupaten_kota": "Kabupaten Bojonegoro",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.23",
    "nama_kabupaten_kota": "Kabupaten Tuban",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.24",
    "nama_kabupaten_kota": "Kabupaten Lamongan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.25",
    "nama_kabupaten_kota": "Kabupaten Gresik",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.26",
    "nama_kabupaten_kota": "Kabupaten Bangkalan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.27",
    "nama_kabupaten_kota": "Kabupaten Sampang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.28",
    "nama_kabupaten_kota": "Kabupaten Pamekasan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.29",
    "nama_kabupaten_kota": "Kabupaten Sumenep",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.71",
    "nama_kabupaten_kota": "Kota Kediri",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.72",
    "nama_kabupaten_kota": "Kota Blitar",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.73",
    "nama_kabupaten_kota": "Kota Malang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.74",
    "nama_kabupaten_kota": "Kota Probolinggo",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.75",
    "nama_kabupaten_kota": "Kota Pasuruan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.76",
    "nama_kabupaten_kota": "Kota Mojokerto",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.77",
    "nama_kabupaten_kota": "Kota Madiun",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.78",
    "nama_kabupaten_kota": "Kota Surabaya",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "35",
    "kode_kabupaten_kota": "35.79",
    "nama_kabupaten_kota": "Kota Batu",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Jawa Timur"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.01",
    "nama_kabupaten_kota": "Kabupaten Pandeglang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.02",
    "nama_kabupaten_kota": "Kabupaten Lebak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.03",
    "nama_kabupaten_kota": "Kabupaten Tangerang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.04",
    "nama_kabupaten_kota": "Kabupaten Serang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.71",
    "nama_kabupaten_kota": "Kota Tangerang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.72",
    "nama_kabupaten_kota": "Kota Cilegon",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.73",
    "nama_kabupaten_kota": "Kota Serang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "36",
    "kode_kabupaten_kota": "36.74",
    "nama_kabupaten_kota": "Kota Tangerang Selatan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Banten"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.01",
    "nama_kabupaten_kota": "Kabupaten Jembrana",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.02",
    "nama_kabupaten_kota": "Kabupaten Tabanan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.03",
    "nama_kabupaten_kota": "Kabupaten Badung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.04",
    "nama_kabupaten_kota": "Kabupaten Gianyar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.05",
    "nama_kabupaten_kota": "Kabupaten Klungkung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.06",
    "nama_kabupaten_kota": "Kabupaten Bangli",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.07",
    "nama_kabupaten_kota": "Kabupaten Karangasem",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.08",
    "nama_kabupaten_kota": "Kabupaten Buleleng",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "51",
    "kode_kabupaten_kota": "51.71",
    "nama_kabupaten_kota": "Kota Denpasar",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Bali"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.01",
    "nama_kabupaten_kota": "Kabupaten Lombok Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.02",
    "nama_kabupaten_kota": "Kabupaten Lombok Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.03",
    "nama_kabupaten_kota": "Kabupaten Lombok Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.04",
    "nama_kabupaten_kota": "Kabupaten Sumbawa",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.05",
    "nama_kabupaten_kota": "Kabupaten Dompu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.06",
    "nama_kabupaten_kota": "Kabupaten Bima",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.07",
    "nama_kabupaten_kota": "Kabupaten Sumbawa Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.08",
    "nama_kabupaten_kota": "Kabupaten Lombok Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.71",
    "nama_kabupaten_kota": "Kota Mataram",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "52",
    "kode_kabupaten_kota": "52.72",
    "nama_kabupaten_kota": "Kota Bima",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Barat"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.01",
    "nama_kabupaten_kota": "Kabupaten Kupang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.02",
    "nama_kabupaten_kota": "Kabupaten Timor Tengah Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.03",
    "nama_kabupaten_kota": "Kabupaten Timor Tengah Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.04",
    "nama_kabupaten_kota": "Kabupaten Belu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.05",
    "nama_kabupaten_kota": "Kabupaten Alor",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.06",
    "nama_kabupaten_kota": "Kabupaten Flores Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.07",
    "nama_kabupaten_kota": "Kabupaten Sikka",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.08",
    "nama_kabupaten_kota": "Kabupaten Ende",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.09",
    "nama_kabupaten_kota": "Kabupaten Ngada",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.10",
    "nama_kabupaten_kota": "Kabupaten Manggarai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.11",
    "nama_kabupaten_kota": "Kabupaten Sumba Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.12",
    "nama_kabupaten_kota": "Kabupaten Sumba Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.13",
    "nama_kabupaten_kota": "Kabupaten Lembata",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.14",
    "nama_kabupaten_kota": "Kabupaten Rote Ndao",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.15",
    "nama_kabupaten_kota": "Kabupaten Manggarai Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.16",
    "nama_kabupaten_kota": "Kabupaten Nagekeo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.17",
    "nama_kabupaten_kota": "Kabupaten Sumba Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.18",
    "nama_kabupaten_kota": "Kabupaten Sumba Barat Daya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.19",
    "nama_kabupaten_kota": "Kabupaten Manggarai Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.20",
    "nama_kabupaten_kota": "Kabupaten Sabu Raijua",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.21",
    "nama_kabupaten_kota": "Kabupaten Malaka",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "53",
    "kode_kabupaten_kota": "53.71",
    "nama_kabupaten_kota": "Kota Kupang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Nusa Tenggara Timur"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.01",
    "nama_kabupaten_kota": "Kabupaten Sambas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.02",
    "nama_kabupaten_kota": "Kabupaten Mempawah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.03",
    "nama_kabupaten_kota": "Kabupaten Sanggau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.04",
    "nama_kabupaten_kota": "Kabupaten Ketapang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.05",
    "nama_kabupaten_kota": "Kabupaten Sintang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.06",
    "nama_kabupaten_kota": "Kabupaten Kapuas Hulu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.07",
    "nama_kabupaten_kota": "Kabupaten Bengkayang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.08",
    "nama_kabupaten_kota": "Kabupaten Landak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.09",
    "nama_kabupaten_kota": "Kabupaten Sekadau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.10",
    "nama_kabupaten_kota": "Kabupaten Melawi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.11",
    "nama_kabupaten_kota": "Kabupaten Kayong Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.12",
    "nama_kabupaten_kota": "Kabupaten Kubu Raya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.71",
    "nama_kabupaten_kota": "Kota Pontianak",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "61",
    "kode_kabupaten_kota": "61.72",
    "nama_kabupaten_kota": "Kota Singkawang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Barat"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.01",
    "nama_kabupaten_kota": "Kabupaten Kotawaringin Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.02",
    "nama_kabupaten_kota": "Kabupaten Kotawaringin Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.03",
    "nama_kabupaten_kota": "Kabupaten Kapuas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.04",
    "nama_kabupaten_kota": "Kabupaten Barito Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.05",
    "nama_kabupaten_kota": "Kabupaten Barito Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.06",
    "nama_kabupaten_kota": "Kabupaten Katingan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.07",
    "nama_kabupaten_kota": "Kabupaten Seruyan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.08",
    "nama_kabupaten_kota": "Kabupaten Sukamara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.09",
    "nama_kabupaten_kota": "Kabupaten Lamandau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.10",
    "nama_kabupaten_kota": "Kabupaten Gunung Mas",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.11",
    "nama_kabupaten_kota": "Kabupaten Pulang Pisau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.12",
    "nama_kabupaten_kota": "Kabupaten Murung Raya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.13",
    "nama_kabupaten_kota": "Kabupaten Barito Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "62",
    "kode_kabupaten_kota": "62.71",
    "nama_kabupaten_kota": "Kota Palangkaraya",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Tengah"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.01",
    "nama_kabupaten_kota": "Kabupaten Tanah Laut",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.02",
    "nama_kabupaten_kota": "Kabupaten Kotabaru",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.03",
    "nama_kabupaten_kota": "Kabupaten Banjar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.04",
    "nama_kabupaten_kota": "Kabupaten Barito Kuala",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.05",
    "nama_kabupaten_kota": "Kabupaten Tapin",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.06",
    "nama_kabupaten_kota": "Kabupaten Hulu Sungai Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.07",
    "nama_kabupaten_kota": "Kabupaten Hulu Sungai Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.08",
    "nama_kabupaten_kota": "Kabupaten Hulu Sungai Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.09",
    "nama_kabupaten_kota": "Kabupaten Tabalong",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.10",
    "nama_kabupaten_kota": "Kabupaten Tanah Bumbu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.11",
    "nama_kabupaten_kota": "Kabupaten Balangan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.71",
    "nama_kabupaten_kota": "Kota Banjarmasin",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "63",
    "kode_kabupaten_kota": "63.72",
    "nama_kabupaten_kota": "Kota Banjarbaru",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Selatan"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.01",
    "nama_kabupaten_kota": "Kabupaten Paser",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.02",
    "nama_kabupaten_kota": "Kabupaten Kutai Kartanegara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.03",
    "nama_kabupaten_kota": "Kabupaten Berau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.07",
    "nama_kabupaten_kota": "Kabupaten Kutai Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.08",
    "nama_kabupaten_kota": "Kabupaten Kutai Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.09",
    "nama_kabupaten_kota": "Kabupaten Penajam Paser Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.11",
    "nama_kabupaten_kota": "Kabupaten Mahakam Ulu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.71",
    "nama_kabupaten_kota": "Kota Balikpapan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.72",
    "nama_kabupaten_kota": "Kota Samarinda",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "64",
    "kode_kabupaten_kota": "64.74",
    "nama_kabupaten_kota": "Kota Bontang",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Timur"
  },
  {
    "kode_provinsi": "65",
    "kode_kabupaten_kota": "65.01",
    "nama_kabupaten_kota": "Kabupaten Bulungan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "65",
    "kode_kabupaten_kota": "65.02",
    "nama_kabupaten_kota": "Kabupaten Malinau",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "65",
    "kode_kabupaten_kota": "65.03",
    "nama_kabupaten_kota": "Kabupaten Nunukan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "65",
    "kode_kabupaten_kota": "65.04",
    "nama_kabupaten_kota": "Kabupaten Tana Tidung",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "65",
    "kode_kabupaten_kota": "65.71",
    "nama_kabupaten_kota": "Kota Tarakan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Kalimantan Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.01",
    "nama_kabupaten_kota": "Kabupaten Bolaang Mongondow",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.02",
    "nama_kabupaten_kota": "Kabupaten Minahasa",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.03",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Sangihe",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.04",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Talaud",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.05",
    "nama_kabupaten_kota": "Kabupaten Minahasa Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.06",
    "nama_kabupaten_kota": "Kabupaten Minahasa Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.07",
    "nama_kabupaten_kota": "Kabupaten Minahasa Tenggara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.08",
    "nama_kabupaten_kota": "Kabupaten Bolaang Mongondow Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.09",
    "nama_kabupaten_kota": "Kabupaten Kep. Siau Tagulandang Biaro",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.10",
    "nama_kabupaten_kota": "Kabupaten Bolaang Mongondow Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.11",
    "nama_kabupaten_kota": "Kabupaten Bolaang Mongondow Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.71",
    "nama_kabupaten_kota": "Kota Manado",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.72",
    "nama_kabupaten_kota": "Kota Bitung",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.73",
    "nama_kabupaten_kota": "Kota Tomohon",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "71",
    "kode_kabupaten_kota": "71.74",
    "nama_kabupaten_kota": "Kota Kotamobagu",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Utara"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.01",
    "nama_kabupaten_kota": "Kabupaten Banggai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.02",
    "nama_kabupaten_kota": "Kabupaten Poso",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.03",
    "nama_kabupaten_kota": "Kabupaten Donggala",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.04",
    "nama_kabupaten_kota": "Kabupaten Toli-Toli",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.05",
    "nama_kabupaten_kota": "Kabupaten Buol",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.06",
    "nama_kabupaten_kota": "Kabupaten Morowali",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.07",
    "nama_kabupaten_kota": "Kabupaten Banggai Kepulauan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.08",
    "nama_kabupaten_kota": "Kabupaten Parigi Moutong",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.09",
    "nama_kabupaten_kota": "Kabupaten Tojo Una Una",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.10",
    "nama_kabupaten_kota": "Kabupaten Sigi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.11",
    "nama_kabupaten_kota": "Kabupaten Banggai Laut",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.12",
    "nama_kabupaten_kota": "Kabupaten Morowali Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "72",
    "kode_kabupaten_kota": "72.71",
    "nama_kabupaten_kota": "Kota Palu",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tengah"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.01",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Selayar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.02",
    "nama_kabupaten_kota": "Kabupaten Bulukumba",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.03",
    "nama_kabupaten_kota": "Kabupaten Bantaeng",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.04",
    "nama_kabupaten_kota": "Kabupaten Jeneponto",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.05",
    "nama_kabupaten_kota": "Kabupaten Takalar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.06",
    "nama_kabupaten_kota": "Kabupaten Gowa",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.07",
    "nama_kabupaten_kota": "Kabupaten Sinjai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.08",
    "nama_kabupaten_kota": "Kabupaten Bone",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.09",
    "nama_kabupaten_kota": "Kabupaten Maros",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.10",
    "nama_kabupaten_kota": "Kabupaten Pangkajene dan Kepulauan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.11",
    "nama_kabupaten_kota": "Kabupaten Barru",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.12",
    "nama_kabupaten_kota": "Kabupaten Soppeng",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.13",
    "nama_kabupaten_kota": "Kabupaten Wajo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.14",
    "nama_kabupaten_kota": "Kabupaten Sidenreng Rappang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.15",
    "nama_kabupaten_kota": "Kabupaten Pinrang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.16",
    "nama_kabupaten_kota": "Kabupaten Enrekang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.17",
    "nama_kabupaten_kota": "Kabupaten Luwu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.18",
    "nama_kabupaten_kota": "Kabupaten Tana Toraja",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.22",
    "nama_kabupaten_kota": "Kabupaten Luwu Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.24",
    "nama_kabupaten_kota": "Kabupaten Luwu Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.26",
    "nama_kabupaten_kota": "Kabupaten Toraja Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.71",
    "nama_kabupaten_kota": "Kota Makassar",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.72",
    "nama_kabupaten_kota": "Kota Parepare",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "73",
    "kode_kabupaten_kota": "73.73",
    "nama_kabupaten_kota": "Kota Palopo",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Selatan"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.01",
    "nama_kabupaten_kota": "Kabupaten Kolaka",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.02",
    "nama_kabupaten_kota": "Kabupaten Konawe",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.03",
    "nama_kabupaten_kota": "Kabupaten Muna",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.04",
    "nama_kabupaten_kota": "Kabupaten Buton",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.05",
    "nama_kabupaten_kota": "Kabupaten Konawe Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.06",
    "nama_kabupaten_kota": "Kabupaten Bombana",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.07",
    "nama_kabupaten_kota": "Kabupaten Wakatobi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.08",
    "nama_kabupaten_kota": "Kabupaten Kolaka Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.09",
    "nama_kabupaten_kota": "Kabupaten Konawe Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.10",
    "nama_kabupaten_kota": "Kabupaten Buton Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.11",
    "nama_kabupaten_kota": "Kabupaten Kolaka Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.12",
    "nama_kabupaten_kota": "Kabupaten Konawe Kepulauan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.13",
    "nama_kabupaten_kota": "Kabupaten Muna Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.14",
    "nama_kabupaten_kota": "Kabupaten Buton Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.15",
    "nama_kabupaten_kota": "Kabupaten Buton Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.71",
    "nama_kabupaten_kota": "Kota Kendari",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "74",
    "kode_kabupaten_kota": "74.72",
    "nama_kabupaten_kota": "Kota Bau Bau",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Tenggara"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.01",
    "nama_kabupaten_kota": "Kabupaten Gorontalo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.02",
    "nama_kabupaten_kota": "Kabupaten Boalemo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.03",
    "nama_kabupaten_kota": "Kabupaten Bone Bolango",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.04",
    "nama_kabupaten_kota": "Kabupaten Pohuwato",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.05",
    "nama_kabupaten_kota": "Kabupaten Gorontalo Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "75",
    "kode_kabupaten_kota": "75.71",
    "nama_kabupaten_kota": "Kota Gorontalo",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Gorontalo"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.01",
    "nama_kabupaten_kota": "Kabupaten Pasangkayu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.02",
    "nama_kabupaten_kota": "Kabupaten Mamuju",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.03",
    "nama_kabupaten_kota": "Kabupaten Mamasa",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.04",
    "nama_kabupaten_kota": "Kabupaten Polewali Mandar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.05",
    "nama_kabupaten_kota": "Kabupaten Majene",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "76",
    "kode_kabupaten_kota": "76.06",
    "nama_kabupaten_kota": "Kabupaten Mamuju Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Sulawesi Barat"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.01",
    "nama_kabupaten_kota": "Kabupaten Maluku Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.02",
    "nama_kabupaten_kota": "Kabupaten Maluku Tenggara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.03",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Tanimbar",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.04",
    "nama_kabupaten_kota": "Kabupaten Buru",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.05",
    "nama_kabupaten_kota": "Kabupaten Seram Bagian Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.06",
    "nama_kabupaten_kota": "Kabupaten Seram Bagian Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.07",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Aru",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.08",
    "nama_kabupaten_kota": "Kabupaten Maluku Barat Daya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.09",
    "nama_kabupaten_kota": "Kabupaten Buru Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.71",
    "nama_kabupaten_kota": "Kota Ambon",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "81",
    "kode_kabupaten_kota": "81.72",
    "nama_kabupaten_kota": "Kota Tual",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.01",
    "nama_kabupaten_kota": "Kabupaten Halmahera Barat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.02",
    "nama_kabupaten_kota": "Kabupaten Halmahera Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.03",
    "nama_kabupaten_kota": "Kabupaten Halmahera Utara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.04",
    "nama_kabupaten_kota": "Kabupaten Halmahera Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.05",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Sula",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.06",
    "nama_kabupaten_kota": "Kabupaten Halmahera Timur",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.07",
    "nama_kabupaten_kota": "Kabupaten Pulau Morotai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.08",
    "nama_kabupaten_kota": "Kabupaten Pulau Taliabu",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.71",
    "nama_kabupaten_kota": "Kota Ternate",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "82",
    "kode_kabupaten_kota": "82.72",
    "nama_kabupaten_kota": "Kota Tidore Kepulauan",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Maluku Utara"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.03",
    "nama_kabupaten_kota": "Kabupaten Jayapura",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.05",
    "nama_kabupaten_kota": "Kabupaten Kepulauan Yapen",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.06",
    "nama_kabupaten_kota": "Kabupaten Biak Numfor",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.10",
    "nama_kabupaten_kota": "Kabupaten Sarmi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.11",
    "nama_kabupaten_kota": "Kabupaten Keerom",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.15",
    "nama_kabupaten_kota": "Kabupaten Waropen",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.19",
    "nama_kabupaten_kota": "Kabupaten Supiori",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.20",
    "nama_kabupaten_kota": "Kabupaten Mamberamo Raya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "91",
    "kode_kabupaten_kota": "91.71",
    "nama_kabupaten_kota": "Kota Jayapura",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.02",
    "nama_kabupaten_kota": "Kabupaten Manokwari",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.03",
    "nama_kabupaten_kota": "Kabupaten Fak Fak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.06",
    "nama_kabupaten_kota": "Kabupaten Teluk Bintuni",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.07",
    "nama_kabupaten_kota": "Kabupaten Teluk Wondama",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.08",
    "nama_kabupaten_kota": "Kabupaten Kaimana",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.11",
    "nama_kabupaten_kota": "Kabupaten Manokwari Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "92",
    "kode_kabupaten_kota": "92.12",
    "nama_kabupaten_kota": "Kabupaten Pegunungan Arfak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat"
  },
  {
    "kode_provinsi": "93",
    "kode_kabupaten_kota": "93.01",
    "nama_kabupaten_kota": "Kabupaten Merauke",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Selatan"
  },
  {
    "kode_provinsi": "93",
    "kode_kabupaten_kota": "93.02",
    "nama_kabupaten_kota": "Kabupaten Boven Digoel",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Selatan"
  },
  {
    "kode_provinsi": "93",
    "kode_kabupaten_kota": "93.03",
    "nama_kabupaten_kota": "Kabupaten Mappi",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Selatan"
  },
  {
    "kode_provinsi": "93",
    "kode_kabupaten_kota": "93.04",
    "nama_kabupaten_kota": "Kabupaten Asmat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Selatan"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.01",
    "nama_kabupaten_kota": "Kabupaten Nabire",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.02",
    "nama_kabupaten_kota": "Kabupaten Puncak Jaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.03",
    "nama_kabupaten_kota": "Kabupaten Paniai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.04",
    "nama_kabupaten_kota": "Kabupaten Mimika",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.05",
    "nama_kabupaten_kota": "Kabupaten Puncak",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.06",
    "nama_kabupaten_kota": "Kabupaten Dogiyai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.07",
    "nama_kabupaten_kota": "Kabupaten Intan Jaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "94",
    "kode_kabupaten_kota": "94.08",
    "nama_kabupaten_kota": "Kabupaten Deiyai",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Tengah"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.01",
    "nama_kabupaten_kota": "Kabupaten Jayawijaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.02",
    "nama_kabupaten_kota": "Kabupaten Pegunungan Bintang",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.03",
    "nama_kabupaten_kota": "Kabupaten Yahukimo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.04",
    "nama_kabupaten_kota": "Kabupaten Tolikara",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.05",
    "nama_kabupaten_kota": "Kabupaten Mamberamo Tengah",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.06",
    "nama_kabupaten_kota": "Kabupaten Yalimo",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.07",
    "nama_kabupaten_kota": "Kabupaten Lanny Jaya",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "95",
    "kode_kabupaten_kota": "95.08",
    "nama_kabupaten_kota": "Kabupaten Nduga",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Pegunungan"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.01",
    "nama_kabupaten_kota": "Kabupaten Sorong",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.02",
    "nama_kabupaten_kota": "Kabupaten Sorong Selatan",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.03",
    "nama_kabupaten_kota": "Kabupaten Raja Ampat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.04",
    "nama_kabupaten_kota": "Kabupaten Tambrauw",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.05",
    "nama_kabupaten_kota": "Kabupaten Maybrat",
    "jenis_wilayah": "Kabupaten",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  },
  {
    "kode_provinsi": "96",
    "kode_kabupaten_kota": "96.71",
    "nama_kabupaten_kota": "Kota Sorong",
    "jenis_wilayah": "Kota",
    "status_aktif": true,
    "sumber_referensi": "Kepmendagri No. 300.2.2-2138 Tahun 2025",
    "tahun_referensi": 2025,
    "nama_provinsi": "Papua Barat Daya"
  }
];

// Fast lookup maps
const wilayahByKodeMap = new Map<string, WilayahAdministratifItem>();
const wilayahByNameMap = new Map<string, WilayahAdministratifItem>();

WILAYAH_ADMINISTRATIF_LIST.forEach((w) => {
  wilayahByKodeMap.set(w.kode_kabupaten_kota, w);
  wilayahByNameMap.set(w.nama_kabupaten_kota.toLowerCase(), w);
});

export function findWilayahByKode(kode: string): WilayahAdministratifItem | undefined {
  return wilayahByKodeMap.get(kode);
}

export function findWilayahByName(name: string): WilayahAdministratifItem | undefined {
  if (!name) return undefined;
  const normalized = name.toLowerCase().trim();
  return (
    wilayahByNameMap.get(normalized) ||
    WILAYAH_ADMINISTRATIF_LIST.find((w) => {
      const lower = w.nama_kabupaten_kota.toLowerCase();
      return lower.includes(normalized) || normalized.includes(lower.replace(/^(kabupaten|kota)s+/i, ""));
    })
  );
}

export function getWilayahByProvinsi(kodeProvinsi: string): WilayahAdministratifItem[] {
  return WILAYAH_ADMINISTRATIF_LIST.filter((w) => w.kode_provinsi === kodeProvinsi);
}

export const INITIAL_10_SAMSAT = [
  { id: "samsat-jakarta-timur", name: "Samsat Jakarta Timur", wilayah: "Jakarta Timur", alamat: "Jl. Raya Pondok Gede", kode_kabupaten_kota: "31.75" },
  { id: "samsat-jakarta-barat", name: "Samsat Jakarta Barat", wilayah: "Jakarta Barat", alamat: "Jl. Daan Mogot", kode_kabupaten_kota: "31.73" },
  { id: "samsat-jakarta-selatan", name: "Samsat Jakarta Selatan", wilayah: "Jakarta Selatan", alamat: "Jl. TB Simatupang", kode_kabupaten_kota: "31.74" },
  { id: "samsat-jakarta-utara", name: "Samsat Jakarta Utara", wilayah: "Jakarta Utara", alamat: "Jl. Yos Sudarso", kode_kabupaten_kota: "31.72" },
  { id: "samsat-jakarta-pusat", name: "Samsat Jakarta Pusat", wilayah: "Jakarta Pusat", alamat: "Jl. Gn. Sahari", kode_kabupaten_kota: "31.71" },
  { id: "samsat-depok", name: "Samsat Depok", wilayah: "Depok", alamat: "Jl. Margonda Raya", kode_kabupaten_kota: "32.76" },
  { id: "samsat-bekasi", name: "Samsat Bekasi", wilayah: "Bekasi", alamat: "Jl. Ahmad Yani", kode_kabupaten_kota: "32.75" },
  { id: "samsat-tangerang", name: "Samsat Tangerang", wilayah: "Tangerang", alamat: "Jl. Gatot Subroto", kode_kabupaten_kota: "36.71" },
  { id: "samsat-bogor", name: "Samsat Bogor", wilayah: "Bogor", alamat: "Jl. Pajajaran", kode_kabupaten_kota: "32.71" },
  { id: "samsat-tangerang-selatan", name: "Samsat Tangerang Selatan", wilayah: "Tangerang Selatan", alamat: "Jl. Pahlawan Seribu", kode_kabupaten_kota: "36.74" },
];

export function buildSamsatMasterList() {
  const result = [...INITIAL_10_SAMSAT];
  const coveredCodes = new Set(INITIAL_10_SAMSAT.map(s => s.kode_kabupaten_kota));

  WILAYAH_ADMINISTRATIF_LIST.forEach((w) => {
    if (!coveredCodes.has(w.kode_kabupaten_kota)) {
      const cleanName = w.nama_kabupaten_kota.replace(/^(kabupaten|kota)\s+/i, "").trim();
      const slug = `samsat-${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const uniqueId = result.some(s => s.id === slug) ? `${slug}-${w.kode_kabupaten_kota.replace(".", "")}` : slug;
      result.push({
        id: uniqueId,
        name: `Samsat ${cleanName}`,
        wilayah: cleanName,
        alamat: `Kantor Samsat ${cleanName}, ${w.nama_provinsi}`,
        kode_kabupaten_kota: w.kode_kabupaten_kota,
      });
      coveredCodes.add(w.kode_kabupaten_kota);
    }
  });

  return result;
}

export const SAMSAT_OFFICES_514 = buildSamsatMasterList();

