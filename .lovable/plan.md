

# 🧪 TestHub - Platform Testing Newman & k6

Website dashboard untuk mengelola dan menjalankan API testing (Newman) dan load testing (k6 Cloud), dengan style modern terinspirasi Supabase Dashboard.

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Eksekusi**: Newman via Edge Functions, k6 via k6 Cloud API (Grafana)
- **Theme**: Light/Dark mode toggle

---

## 1. Authentication & User Management
- Halaman Login & Register dengan email/password
- Profil user sederhana
- Setiap user memiliki workspace/project terpisah

## 2. Layout & Navigation (Supabase-style)
- Sidebar navigasi dengan menu: Dashboard, Newman, k6, Settings
- Top bar dengan user avatar, theme toggle (light/dark), dan project selector
- Clean, spacious design dengan warna netral dan aksen hijau/biru
- Responsive untuk desktop & tablet

## 3. Modul Newman (API Testing)
- **Collection Manager**: Upload multiple Postman collection files (JSON), lihat daftar collection, preview endpoint
- **Environment Manager**: Buat & kelola environment variables (dev, staging, prod), editor key-value pairs
- **Test Runner**: Pilih collection + environment → jalankan via Edge Function → lihat progress
- **Results**: Detail hasil per request (status, response time, test assertions pass/fail)

## 4. Modul k6 (Load Testing)
- **Swagger Import**: Upload file OpenAPI/Swagger → otomatis generate skenario k6
- **Environment Manager**: Atur base URL, headers, auth tokens per environment
- **Test Configuration**: Atur virtual users (VUs), duration, thresholds
- **Execution**: Kirim test ke k6 Cloud API → monitor status → ambil hasil
- **Script Preview**: Lihat & edit generated k6 script sebelum dijalankan

## 5. Dashboard & Reporting
- **Overview Dashboard**: Ringkasan test terbaru, success rate, trend chart
- **Newman Reports**: Tabel hasil test dengan detail per collection — pass/fail count, response time stats, grafik timeline
- **k6 Reports**: Metrics dari k6 Cloud — RPS, response time percentiles (p50, p95, p99), error rate, VU chart
- **History**: Riwayat semua test run dengan filter berdasarkan tanggal, status, dan tipe test

## 6. Settings
- API key management untuk k6 Cloud
- Pengaturan notifikasi (opsional)
- Manajemen project/workspace

