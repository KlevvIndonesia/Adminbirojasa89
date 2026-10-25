# KONTEKS LENGKAP PROYEK ADMIN SUN89

## 1. Struktur Proyek (Directory Tree)

```text
.
Ôö£ÔöÇÔöÇ .env.example
Ôö£ÔöÇÔöÇ .gitignore
Ôö£ÔöÇÔöÇ ATTRIBUTIONS.md
Ôö£ÔöÇÔöÇ PROJECT_CONTEXT.md
Ôö£ÔöÇÔöÇ README.md
Ôö£ÔöÇÔöÇ check_db.js
Ôö£ÔöÇÔöÇ default_shadcn_theme.css
Ôö£ÔöÇÔöÇ deploy/
Ôöé   Ôö£ÔöÇÔöÇ .env.production.template
Ôöé   Ôö£ÔöÇÔöÇ admin-sun89.service
Ôöé   Ôö£ÔöÇÔöÇ backup-offsite.sh
Ôöé   Ôö£ÔöÇÔöÇ caddy/
Ôöé   Ôöé   ÔööÔöÇÔöÇ Caddyfile
Ôöé   Ôö£ÔöÇÔöÇ deploy.sh
Ôöé   ÔööÔöÇÔöÇ nginx/
Ôöé       ÔööÔöÇÔöÇ admin-sun89.conf
Ôö£ÔöÇÔöÇ docs/
Ôöé   Ôö£ÔöÇÔöÇ audit_arsitektur_data/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 00_RINGKASAN_EKSEKUTIF.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 01_PETA_ARSITEKTUR.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 02_INVENTARIS_VARIABEL_FRONTEND.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 03_DATA_DICTIONARY_DATABASE.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 04_DATA_LINEAGE_FRONTEND_BACKEND_DB.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 05_KATALOG_API.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 06_AUDIT_LOGIKA_BISNIS.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 07_AUDIT_INTEGRITAS_KEAMANAN.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 08_ERD_KONSEPTUAL.mmd
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 09_ERD_FISIK_SQLITE.mmd
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 10_PETA_DEPENDENSI_DATA.mmd
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 11_REGISTER_TEMUAN_DAN_PRIORITAS.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 12_ROADMAP_PERBAIKAN.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 13_CAKUPAN_AUDIT_DAN_KETERBATASAN.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 14_DESAIN_PERBAIKAN_P0.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 15_IMPLEMENTASI_P0_FASE1_UPLOAD.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 16_IMPLEMENTASI_P0_FASE2_TRANSAKSI_ORDER.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 17_IMPLEMENTASI_P0_FASE3_PRICING.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 18_IMPLEMENTASI_P0_FASE4_ORDER.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 19_IMPLEMENTASI_P1A_INTEGRITAS_RELASI.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 20_IMPLEMENTASI_P1B_OTORISASI_BACKEND.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 21_IMPLEMENTASI_P1C_KONSISTENSI_ALIAS.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ 22_ANALISIS_MENYELURUH_DATA_PENJUALAN.md
Ôöé   Ôöé   ÔööÔöÇÔöÇ 23_INVENTARIS_VARIABEL_DATA_PENJUALAN_PER_LAYANAN.md
Ôöé   Ôö£ÔöÇÔöÇ deployment.md
Ôöé   ÔööÔöÇÔöÇ production-runbook.md
Ôö£ÔöÇÔöÇ e2e/
Ôöé   Ôö£ÔöÇÔöÇ auth-flow.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ data-penjualan-toolbar-ux.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ document-flow.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ fixtures/
Ôöé   Ôöé   ÔööÔöÇÔöÇ sample_ktp.pdf
Ôöé   Ôö£ÔöÇÔöÇ modules-flow.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ responsive-regression-audit.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ routing-history-integrity.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ routing-slugs.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ security-cross-module.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ table-layout-employee-selectors.spec.ts
Ôöé   Ôö£ÔöÇÔöÇ table-layout-vertical-fill.spec.ts
Ôöé   ÔööÔöÇÔöÇ tabs-visual-states.spec.ts
Ôö£ÔöÇÔöÇ eslint.config.js
Ôö£ÔöÇÔöÇ index.html
Ôö£ÔöÇÔöÇ metadata.json
Ôö£ÔöÇÔöÇ package.json
Ôö£ÔöÇÔöÇ playwright.config.ts
Ôö£ÔöÇÔöÇ postcss.config.mjs
Ôö£ÔöÇÔöÇ public/
Ôöé   ÔööÔöÇÔöÇ logo-sun89.jpg
Ôö£ÔöÇÔöÇ releases/
Ôöé   ÔööÔöÇÔöÇ 0.0.1/
Ôöé       Ôö£ÔöÇÔöÇ package.json
Ôöé       Ôö£ÔöÇÔöÇ release-manifest.json
Ôöé       ÔööÔöÇÔöÇ server/
Ôöé           ÔööÔöÇÔöÇ src/
Ôöé               Ôö£ÔöÇÔöÇ app.ts
Ôöé               Ôö£ÔöÇÔöÇ config/
Ôöé               Ôöé   ÔööÔöÇÔöÇ env.ts
Ôöé               Ôö£ÔöÇÔöÇ controllers/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ auditController.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ authController.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ documentController.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ financeController.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ orderController.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ pricingController.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ userController.ts
Ôöé               Ôö£ÔöÇÔöÇ database/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ db.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ schema.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ seed.ts
Ôöé               Ôö£ÔöÇÔöÇ middleware/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ auth.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ errorHandler.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ logger.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ rateLimiter.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ securityHeaders.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ validation.ts
Ôöé               Ôö£ÔöÇÔöÇ repositories/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ dbAuditRepository.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ dbDocumentRepository.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ dbFinanceRepository.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ dbOrderRepository.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ dbPricingRepository.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ dbUserRepository.ts
Ôöé               Ôö£ÔöÇÔöÇ routes/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ auditRoutes.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ authRoutes.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ documentRoutes.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ financeRoutes.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ orderRoutes.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ pricingRoutes.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ userRoutes.ts
Ôöé               Ôö£ÔöÇÔöÇ server.ts
Ôöé               Ôö£ÔöÇÔöÇ services/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ auditService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ authService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ documentService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ documentTicketService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ financeService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ orderService.ts
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ pricingService.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ userService.ts
Ôöé               Ôö£ÔöÇÔöÇ storage/
Ôöé               Ôöé   Ôö£ÔöÇÔöÇ documentStorageAdapter.ts
Ôöé               Ôöé   ÔööÔöÇÔöÇ localDiskDocumentStorage.ts
Ôöé               ÔööÔöÇÔöÇ utils/
Ôöé                   Ôö£ÔöÇÔöÇ backupRestore.ts
Ôöé                   Ôö£ÔöÇÔöÇ crypto.ts
Ôöé                   ÔööÔöÇÔöÇ fileValidation.ts
Ôö£ÔöÇÔöÇ scratch/
Ôöé   Ôö£ÔöÇÔöÇ analyze_reconciliation.py
Ôöé   Ôö£ÔöÇÔöÇ apply_detail_page_anatomy.cjs
Ôöé   Ôö£ÔöÇÔöÇ audit_data_flow.mjs
Ôöé   Ôö£ÔöÇÔöÇ audit_direct_output.txt
Ôöé   Ôö£ÔöÇÔöÇ audit_workbook_direct.py
Ôöé   Ôö£ÔöÇÔöÇ audit_workbook_sheets.py
Ôöé   Ôö£ÔöÇÔöÇ bukti_transfer_sample.png
Ôöé   Ôö£ÔöÇÔöÇ capture_buat_order_samsat.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_clean_targets.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_detail_and_preview.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_detail_profit_final.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_detail_profit_pending.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_detail_proofs.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_dialogs.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_final_checks.mjs
Ôöé   Ôö£ÔöÇÔöÇ capture_final_screenshots.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_finance_detail.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_full_proofs.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_loaded_ui.mjs
Ôöé   Ôö£ÔöÇÔöÇ capture_messenger_and_upload_modal.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_revised_finance_proof.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_step3_bottom.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_ui_proofs.cjs
Ôöé   Ôö£ÔöÇÔöÇ capture_upload_section.cjs
Ôöé   Ôö£ÔöÇÔöÇ check-extended-calculations.ts
Ôöé   Ôö£ÔöÇÔöÇ check_browser_store.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_console.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_console_errors.mjs
Ôöé   Ôö£ÔöÇÔöÇ check_db.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_db_status.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_messenger_task_ui.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_profit_buttons.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_route.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_toast.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_transactions_and_files.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_users.cjs
Ôöé   Ôö£ÔöÇÔöÇ check_workspace_ui.cjs
Ôöé   Ôö£ÔöÇÔöÇ clean_contracts.cjs
Ôöé   Ôö£ÔöÇÔöÇ clean_doc_rows.cjs
Ôöé   Ôö£ÔöÇÔöÇ clean_orders_db.cjs
Ôöé   Ôö£ÔöÇÔöÇ compare_detailed_output.txt
Ôöé   Ôö£ÔöÇÔöÇ compare_detailed_sheets.py
Ôöé   Ôö£ÔöÇÔöÇ data_penjualan_tabs.png
Ôöé   Ôö£ÔöÇÔöÇ debug_bbn_motor.ts
Ôöé   Ôö£ÔöÇÔöÇ debug_chrome.ts
Ôöé   Ôö£ÔöÇÔöÇ debug_notifikasi.cjs
Ôöé   Ôö£ÔöÇÔöÇ debug_page.cjs
Ôöé   Ôö£ÔöÇÔöÇ debug_page.ts
Ôöé   Ôö£ÔöÇÔöÇ debug_page_elements.cjs
Ôöé   Ôö£ÔöÇÔöÇ debug_screen.cjs
Ôöé   Ôö£ÔöÇÔöÇ debug_step3.cjs
Ôöé   Ôö£ÔöÇÔöÇ debug_submit.cjs
Ôöé   Ôö£ÔöÇÔöÇ deep_sheet_audit.py
Ôöé   Ôö£ÔöÇÔöÇ deep_sheet_audit.txt
Ôöé   Ôö£ÔöÇÔöÇ deep_sheet_audit_utf8.txt
Ôöé   Ôö£ÔöÇÔöÇ dump_15_scenarios_detail.ts
Ôöé   Ôö£ÔöÇÔöÇ ensure_schema.cjs
Ôöé   Ôö£ÔöÇÔöÇ execute_database_reset.cjs
Ôöé   Ôö£ÔöÇÔöÇ fetch_and_build_wilayah.cjs
Ôöé   Ôö£ÔöÇÔöÇ finance_belum_bayar.png
Ôöé   Ôö£ÔöÇÔöÇ finance_cashback_pending.png
Ôöé   Ôö£ÔöÇÔöÇ finance_profit_pending.png
Ôöé   Ôö£ÔöÇÔöÇ generate_wilayah_ts.cjs
Ôöé   Ôö£ÔöÇÔöÇ inspect_detail.cjs
Ôöé   Ôö£ÔöÇÔöÇ inspect_sheet_groups.py
Ôöé   Ôö£ÔöÇÔöÇ integrity_check.cjs
Ôöé   Ôö£ÔöÇÔöÇ messenger_samsat_view.png
Ôöé   Ôö£ÔöÇÔöÇ migrate_wilayah_db.cjs
Ôöé   Ôö£ÔöÇÔöÇ mutasi_ld_page_debug.png
Ôöé   Ôö£ÔöÇÔöÇ page_dump.html
Ôöé   Ôö£ÔöÇÔöÇ parse_wilayah_dataset.cjs
Ôöé   Ôö£ÔöÇÔöÇ patch_update_invoice.cjs
Ôöé   Ôö£ÔöÇÔöÇ proof_data_penjualan_verified.png
Ôöé   Ôö£ÔöÇÔöÇ proof_laba_rugi_verified.png
Ôöé   Ôö£ÔöÇÔöÇ proof_messenger_history_verified.png
Ôöé   Ôö£ÔöÇÔöÇ proof_tagihan_verified.png
Ôöé   Ôö£ÔöÇÔöÇ qa_session.ts
Ôöé   Ôö£ÔöÇÔöÇ query_ord5_audit.cjs
Ôöé   Ôö£ÔöÇÔöÇ reconciliation_summary.txt
Ôöé   Ôö£ÔöÇÔöÇ reindex.cjs
Ôöé   Ôö£ÔöÇÔöÇ reset_initial_state.cjs
Ôöé   Ôö£ÔöÇÔöÇ restore_ord5.cjs
Ôöé   Ôö£ÔöÇÔöÇ run_full_browser_qa.ts
Ôöé   Ôö£ÔöÇÔöÇ sample_proof.png
Ôöé   Ôö£ÔöÇÔöÇ seed_514_samsat_db.cjs
Ôöé   Ôö£ÔöÇÔöÇ sheet_groups_output.txt
Ôöé   Ôö£ÔöÇÔöÇ summarize_sheet_audit.py
Ôöé   Ôö£ÔöÇÔöÇ test_api_endpoints.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_browser_profit_flow.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_browser_router.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_cancel_flow.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_capture_all.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_clear_dialog.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_complete_mutasi_ld.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_full_flow.mjs
Ôöé   Ôö£ÔöÇÔöÇ test_login_nav.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_login_properly.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_login_svp.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_mutasi_ld_full_e2e.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_open_form.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_profit_detail.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_runtime_finance_flow.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_verify_mutasi_ld_final.cjs
Ôöé   Ôö£ÔöÇÔöÇ test_verify_mutasi_ld_revisi.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_api_order_provider.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_buat_order.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_buat_order_bank_card.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_buat_order_pm.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_contract_data.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_finance_content.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_finance_detail.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_finance_store.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_pending_condition.cjs
Ôöé   Ôö£ÔöÇÔöÇ update_permission_store.cjs
Ôöé   Ôö£ÔöÇÔöÇ verified_buat_order_2steps.png
Ôöé   Ôö£ÔöÇÔöÇ verified_data_penjualan_5_tabs.png
Ôöé   Ôö£ÔöÇÔöÇ verified_data_penjualan_statuses.png
Ôöé   Ôö£ÔöÇÔöÇ verified_finance_belum_bayar.png
Ôöé   Ôö£ÔöÇÔöÇ verified_messenger_samsat.png
Ôöé   Ôö£ÔöÇÔöÇ verified_rekap_order_table.png
Ôöé   Ôö£ÔöÇÔöÇ verify-master-data-scenarios.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_all_4.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_proofs.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_requirements.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_three_features.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_three_features_auth.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_user_requests.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_all_workbook_scenarios.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_batch_roles_and_workflow.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_buat_order_layout.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_buat_order_simplified.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_buat_order_sync.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_clean_orders_and_dates.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_clean_samsat_ui.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_detailed_flow.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_eye_action.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_final_suite.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_finance_foundation.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_finance_revisions.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_financial_audit.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_frontend_backend_integration.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_global_full_container.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_hardening_e2e.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_labarugi_messenger_history.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_link_wilayah_modal.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_master_wilayah_ui.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_messenger_active_and_history.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_messenger_fix.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_messenger_workspace.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_mutasi_ld_revisi.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_param_box.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_phase_reconciliation.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_phase_takeover_notes_docs.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_post_review.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_reset_and_payment_proof.mjs
Ôöé   Ôö£ÔöÇÔöÇ verify_samsat_switch.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_tab_switching_runtime.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_tahap5_tables_forms.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_tahap6_notifications.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_tahun_pajak_removal.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_ui_adjustments.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_ui_corrections.ts
Ôöé   Ôö£ÔöÇÔöÇ verify_ui_revisions.cjs
Ôöé   Ôö£ÔöÇÔöÇ verify_ui_submit_to_backend.cjs
Ôöé   Ôö£ÔöÇÔöÇ view_group.py
Ôöé   Ôö£ÔöÇÔöÇ vite_error.html
Ôöé   ÔööÔöÇÔöÇ wilayah_indonesia_514.json
Ôö£ÔöÇÔöÇ scratch_inspect_db.js
Ôö£ÔöÇÔöÇ scripts/
Ôöé   Ôö£ÔöÇÔöÇ analyze-bundle.mjs
Ôöé   Ôö£ÔöÇÔöÇ analyze-imports.mjs
Ôöé   Ôö£ÔöÇÔöÇ backup.ts
Ôöé   Ôö£ÔöÇÔöÇ extract_project_context.py
Ôöé   Ôö£ÔöÇÔöÇ monitor-health.ts
Ôöé   Ôö£ÔöÇÔöÇ package-release.ts
Ôöé   Ôö£ÔöÇÔöÇ patch-realpath.cjs
Ôöé   Ôö£ÔöÇÔöÇ smoke-test.ts
Ôöé   Ôö£ÔöÇÔöÇ test-pengeluaran-direct.ts
Ôöé   ÔööÔöÇÔöÇ verify-dr.ts
Ôö£ÔöÇÔöÇ server/
Ôöé   Ôö£ÔöÇÔöÇ data/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ database.sqlite
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ database.sqlite-shm
Ôöé   Ôöé   ÔööÔöÇÔöÇ database.sqlite-wal
Ôöé   Ôö£ÔöÇÔöÇ database.sqlite
Ôöé   Ôö£ÔöÇÔöÇ src/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ app.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ config/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ defaultPermissions.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ env.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ controllers/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ auditController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ authController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimationController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengerController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ paymentMethodController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ permissionController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricingController.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ userController.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ wilayahController.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ database/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ db.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ schema.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ seed.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ wilayahData.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ middleware/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ auth.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ errorHandler.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ logger.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ rateLimiter.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ securityHeaders.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ validation.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ repositories/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbAuditRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbDocumentRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbEstimationRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbFinanceRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbMessengerRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbNotificationSettingsRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbOrderRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbPaymentMethodRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbPermissionRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbPricingRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dbUserRepository.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ dbWilayahRepository.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ routes/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ auditRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ authRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimationRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengerRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ paymentMethodRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ permissionRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricingRoutes.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ userRoutes.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ wilayahRoutes.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ server.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ services/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ auditService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ authService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentTicketService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimationService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengerService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationConfigService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ paymentMethodService.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricingService.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ userService.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ storage/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentStorageAdapter.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ localDiskDocumentStorage.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ utils/
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ aliasNormalizer.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ backupRestore.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ crypto.ts
Ôöé   Ôöé       ÔööÔöÇÔöÇ fileValidation.ts
Ôöé   ÔööÔöÇÔöÇ sun89.db
Ôö£ÔöÇÔöÇ src/
Ôöé   Ôö£ÔöÇÔöÇ api/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ client/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ apiClient.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ apiConfig.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ endpoints/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ customersApi.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeApi.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengersApi.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationsApi.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ordersApi.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ usersApi.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ vehiclesApi.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ types/
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ common.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ customer.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ finance.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ messenger.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ order.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ user.ts
Ôöé   Ôöé       ÔööÔöÇÔöÇ vehicle.ts
Ôöé   Ôö£ÔöÇÔöÇ app/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ App.tsx
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Attributions.md
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ assets/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ logoSun89Base64.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ components/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ AccessManagement.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ AuditLog.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Auth.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ BiayaLayanan.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ BuatOrder.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Dashboard.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ DataPenjualan.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ DocumentPreviewModal.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ EnhancedTable.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ EnhancedTableWithDialogs.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ErrorBoundary.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Finance.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ FinanceAddPage.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ FinanceContent.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ FinanceDateFilter.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ FinanceDetailPage.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ FinancePaymentMethodSummary.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ HargaDasarSamsat.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ InvoiceA5Dialog.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ InvoiceDialog.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ManajemenPengguna.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MasterData.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MasterDataContent.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerDashboard.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerDocuments.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerHistory.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerTask.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MetodePembayaranMaster.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MutasiCostFields.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ NotFoundPage.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ NotificationDialog.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ NotificationHistory.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ NotificationPopover.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Order.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ OrderHistory.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ OrderTracking.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ PenjualanAdd.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ PlateNumberInput.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Profile.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ProvinsiFilterSelect.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ RiwayatAudit.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ SearchableSamsatSelect.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ Settings.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ ThemeProvider.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ WilayahSamsatManager.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimation/
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ CalculationExplanationModal.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ EstimationMasterManager.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ EstimatorExtended.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ EstimatorR2Tahunan.tsx
Ôöé   Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ EstimatorR4Tahunan.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ figma/
Ôöé   Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ ImageWithFallback.tsx
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messenger/
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerActiveProcesses.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerDashboardView.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerMobileTaskDetail.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerProfileView.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerReimbursementView.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerSamsatView.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerTaskCard.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerTaskDetailModal.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerTaskHistory.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerTasksView.tsx
Ôöé   Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ MessengerWaitingReasonDialog.tsx
Ôöé   Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ MessengerWorkspace.tsx
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ ui/
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ TablePagination.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ accordion.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ alert-dialog.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ alert.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ aspect-ratio.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ avatar.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ badge.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ breadcrumb.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ button.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ calendar.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ card.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ carousel.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ chart.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ checkbox.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ collapsible.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ command.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ context-menu.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ dialog.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ drawer.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ dropdown-menu.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ empty-state.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ form.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ hover-card.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ input-otp.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ input.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ label.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ menubar.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ navigation-menu.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ pagination.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ popover.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ progress.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ radio-group.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ resizable.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ scroll-area.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ select.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ separator.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ sheet.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ sidebar.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ skeleton.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ slider.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ sonner.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ status-config.ts
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ switch.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ table.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ tabs.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ textarea.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ toggle-group.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ toggle.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ tooltip.tsx
Ôöé   Ôöé   Ôöé       Ôö£ÔöÇÔöÇ use-mobile.ts
Ôöé   Ôöé   Ôöé       ÔööÔöÇÔöÇ utils.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ config/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ appConfig.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ navigationConfig.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ routeConfig.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ data/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ dashboardAdapter.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimationStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeDummyData.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ karyawanPenggunaAdapter.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengerTaskAdapter.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationAdapter.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ notificationSettingsStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ paymentMethodStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ penjualanContractData.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ permissionStore.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricingReference.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ pricingStore.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ utils/
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ auditLog.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ costCalculation.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ documentSvgGenerator.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ fileCompressor.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ financeExport.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ financeFormatters.tsx
Ôöé   Ôöé       ÔööÔöÇÔöÇ useLiveSync.tsx
Ôöé   Ôö£ÔöÇÔöÇ data/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ api/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ apiDocumentProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ apiFinanceProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ apiOrderProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ apiPricingProvider.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ apiUserProvider.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mock/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeMockData.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeMockFixtures.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mockDocumentProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mockFinanceProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mockOrderProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mockPricingProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ mockUserProvider.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderMockData.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ penjualanMockData.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ providers/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ documentProvider.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ repositories/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ documentRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ financeRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messengerRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ orderRepository.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricingRepository.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ userRepository.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ storage/
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé       Ôö£ÔöÇÔöÇ memoryStorage.ts
Ôöé   Ôöé       ÔööÔöÇÔöÇ storageTypes.ts
Ôöé   Ôö£ÔöÇÔöÇ domain/
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ customer/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ document/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimation/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ defaultTemplates.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ estimationEngine.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ excelDateUtils.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ finance/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ labaRugiCanonical.ts
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ paymentMapping.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ index.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ messenger/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ order/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ pricing/
Ôöé   Ôöé   Ôöé   Ôö£ÔöÇÔöÇ types.ts
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ wilayahIndonesiaData.ts
Ôöé   Ôöé   Ôö£ÔöÇÔöÇ user/
Ôöé   Ôöé   Ôöé   ÔööÔöÇÔöÇ types.ts
Ôöé   Ôöé   ÔööÔöÇÔöÇ vehicle/
Ôöé   Ôöé       ÔööÔöÇÔöÇ types.ts
Ôöé   Ôö£ÔöÇÔöÇ main.tsx
Ôöé   ÔööÔöÇÔöÇ styles/
Ôöé       Ôö£ÔöÇÔöÇ default_theme.css
Ôöé       Ôö£ÔöÇÔöÇ design-tokens.css
Ôöé       Ôö£ÔöÇÔöÇ fonts.css
Ôöé       Ôö£ÔöÇÔöÇ globals.css
Ôöé       Ôö£ÔöÇÔöÇ index.css
Ôöé       Ôö£ÔöÇÔöÇ tailwind.css
Ôöé       ÔööÔöÇÔöÇ theme.css
Ôö£ÔöÇÔöÇ tests/
Ôöé   Ôö£ÔöÇÔöÇ audit-log.test.ts
Ôöé   Ôö£ÔöÇÔöÇ auth.test.ts
Ôöé   Ôö£ÔöÇÔöÇ backend-integration.test.ts
Ôöé   Ôö£ÔöÇÔöÇ buat-order-r2-estimation.test.ts
Ôöé   Ôö£ÔöÇÔöÇ buat-order-r4-estimation.test.ts
Ôöé   Ôö£ÔöÇÔöÇ canonical-identity-integration.test.ts
Ôöé   Ôö£ÔöÇÔöÇ cross-module-data-integrity.test.ts
Ôöé   Ôö£ÔöÇÔöÇ document-storage.test.ts
Ôöé   Ôö£ÔöÇÔöÇ estimation-extended.test.ts
Ôöé   Ôö£ÔöÇÔöÇ estimation-r2-annual.test.ts
Ôöé   Ôö£ÔöÇÔöÇ estimation-r4-annual.test.ts
Ôöé   Ôö£ÔöÇÔöÇ finance-sync.test.ts
Ôöé   Ôö£ÔöÇÔöÇ messenger.test.ts
Ôöé   Ôö£ÔöÇÔöÇ mock-provider.test.ts
Ôöé   Ôö£ÔöÇÔöÇ operational-resilience.test.ts
Ôöé   Ôö£ÔöÇÔöÇ order-repository.test.ts
Ôöé   Ôö£ÔöÇÔöÇ order-sales-projection.test.ts
Ôöé   Ôö£ÔöÇÔöÇ order-store-compatibility.test.ts
Ôöé   Ôö£ÔöÇÔöÇ order-workflow.test.ts
Ôöé   Ôö£ÔöÇÔöÇ permission.test.ts
Ôöé   Ôö£ÔöÇÔöÇ persistence-refresh.test.ts
Ôöé   Ôö£ÔöÇÔöÇ pricing.test.ts
Ôöé   Ôö£ÔöÇÔöÇ provider-swap.test.ts
Ôöé   Ôö£ÔöÇÔöÇ provider-switching.test.ts
Ôöé   Ôö£ÔöÇÔöÇ release-engineering.test.ts
Ôöé   Ôö£ÔöÇÔöÇ runtime-provider-wiring.test.ts
Ôöé   ÔööÔöÇÔöÇ security-hardening.test.ts
Ôö£ÔöÇÔöÇ tsconfig.json
ÔööÔöÇÔöÇ vite.config.ts
```

## 2. Dependensi & Konfigurasi Lingkungan

File: `package.json`
```json
{
  "name": "Admin-SUN89",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "build": "node -r ./scripts/patch-realpath.cjs ./node_modules/vite/bin/vite.js build",
    "dev": "node -r ./scripts/patch-realpath.cjs ./node_modules/vite/bin/vite.js --host 0.0.0.0 --port 3000",
    "server": "npx --prefer-offline tsx server/src/server.ts",
    "dev:server": "npx --prefer-offline tsx watch server/src/server.ts",
    "lint": "eslint .",
    "test": "npx --prefer-offline tsx --test --test-concurrency=1 tests/**/*.test.ts",
    "test:e2e": "playwright test",
    "typecheck": "tsc --noEmit",
    "release:package": "npx tsx scripts/package-release.ts",
    "smoke-test": "npx tsx scripts/smoke-test.ts",
    "backup": "npx tsx scripts/backup.ts",
    "monitor": "npx tsx scripts/monitor-health.ts",
    "verify:dr": "npx tsx scripts/verify-dr.ts"
  },
  "dependencies": {
    "@emotion/react": "npm:@emotion/react",
    "@emotion/styled": "npm:@emotion/styled",
    "@mui/icons-material": "npm:@mui/icons-material",
    "@mui/material": "npm:@mui/material",
    "@popperjs/core": "npm:@popperjs/core",
    "@radix-ui/react-accordion": "npm:@radix-ui/react-accordion",
    "@radix-ui/react-alert-dialog": "npm:@radix-ui/react-alert-dialog",
    "@radix-ui/react-aspect-ratio": "npm:@radix-ui/react-aspect-ratio",
    "@radix-ui/react-avatar": "npm:@radix-ui/react-avatar",
    "@radix-ui/react-checkbox": "npm:@radix-ui/react-checkbox",
    "@radix-ui/react-collapsible": "npm:@radix-ui/react-collapsible",
    "@radix-ui/react-context-menu": "npm:@radix-ui/react-context-menu",
    "@radix-ui/react-dialog": "npm:@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu": "npm:@radix-ui/react-dropdown-menu",
    "@radix-ui/react-hover-card": "npm:@radix-ui/react-hover-card",
    "@radix-ui/react-label": "npm:@radix-ui/react-label",
    "@radix-ui/react-menubar": "npm:@radix-ui/react-menubar",
    "@radix-ui/react-navigation-menu": "npm:@radix-ui/react-navigation-menu",
    "@radix-ui/react-popover": "npm:@radix-ui/react-popover",
    "@radix-ui/react-progress": "npm:@radix-ui/react-progress",
    "@radix-ui/react-radio-group": "npm:@radix-ui/react-radio-group",
    "@radix-ui/react-scroll-area": "npm:@radix-ui/react-scroll-area",
    "@radix-ui/react-select": "npm:@radix-ui/react-select",
    "@radix-ui/react-separator": "npm:@radix-ui/react-separator",
    "@radix-ui/react-slider": "npm:@radix-ui/react-slider",
    "@radix-ui/react-slot": "npm:@radix-ui/react-slot",
    "@radix-ui/react-switch": "npm:@radix-ui/react-switch",
    "@radix-ui/react-tabs": "npm:@radix-ui/react-tabs",
    "@radix-ui/react-toggle": "npm:@radix-ui/react-toggle",
    "@radix-ui/react-toggle-group": "npm:@radix-ui/react-toggle-group",
    "@radix-ui/react-tooltip": "npm:@radix-ui/react-tooltip",
    "@types/multer": "^2.3.0",
    "class-variance-authority": "npm:class-variance-authority",
    "clsx": "npm:clsx",
    "cmdk": "npm:cmdk",
    "cors": "^2.8.6",
    "date-fns": "npm:date-fns",
    "embla-carousel-react": "npm:embla-carousel-react",
    "express": "^5.2.1",
    "heic2any": "^0.0.4",
    "input-otp": "npm:input-otp",
    "lucide-react": "npm:lucide-react",
    "motion": "npm:motion",
    "multer": "^2.4.0",
    "next-themes": "npm:next-themes",
    "react": "^18.3.1 || ^19.0.0",
    "react-day-picker": "npm:react-day-picker",
    "react-dnd": "npm:react-dnd",
    "react-dnd-html5-backend": "npm:react-dnd-html5-backend",
    "react-dom": "^18.3.1 || ^19.0.0",
    "react-hook-form": "npm:react-hook-form",
    "react-popper": "npm:react-popper",
    "react-resizable-panels": "npm:react-resizable-panels",
    "react-responsive-masonry": "npm:react-responsive-masonry",
    "react-router": "npm:react-router",
    "react-slick": "npm:react-slick",
    "recharts": "npm:recharts",
    "sonner": "npm:sonner",
    "tailwind-merge": "npm:tailwind-merge",
    "tw-animate-css": "npm:tw-animate-css",
    "vaul": "npm:vaul"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.63.0",
    "@tailwindcss/vite": "4.1.12",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/node": "^26.6.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "4.7.0",
    "eslint": "^10.11.0",
    "eslint-plugin-react-hooks": "^7.1.1",
    "tailwindcss": "4.1.12",
    "typescript": "~5.7.3",
    "typescript-eslint": "^8.70.1",
    "vite": "6.3.5"
  },
  "overrides": {
    "vite": "6.3.5"
  }
}

```

File: `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Type Checking */
    "strict": true,
    "noFallthroughCasesInSwitch": true,

    /* Paths */
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/app/*"],
      "@app/*": ["./src/app/*"],
      "@domain/*": ["./src/domain/*"],
      "@data/*": ["./src/data/*"],
      "@api/*": ["./src/api/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}

```

File: `vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used ÔÇô do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
      '@app': path.resolve(__dirname, './src/app'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@data': path.resolve(__dirname, './src/data'),
      '@api': path.resolve(__dirname, './src/api'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('motion')) {
              return 'vendor-motion';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
})

```

File: `.env.example`
```bash
# ==============================================================================
# Admin SUN89 ÔÇö Biro Jasa Management System
# Production & Deployment Environment Configuration Template
# ==============================================================================
# Copy this file to `.env` or set environment variables in your deployment environment.
# NEVER commit real production secrets, passwords, or credentials into source control.
#
# Variable Classification:
# [REQ-PROD] : REQUIRED in Production (Application fails to start if missing or insecure)
# [OPTIONAL] : Optional with safe default
# [DEV-ONLY] : Used only for local development / testing
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. SERVER & RUNTIME CONFIGURATION
# ------------------------------------------------------------------------------
# [OPTIONAL] Port on which Express listens (Default: 3001)
PORT=3001

# [REQ-PROD] Runtime Environment: 'production', 'development', or 'test'
NODE_ENV=production

# [OPTIONAL] Reverse Proxy Trust Setting (Default: 1)
# Set to '1' when behind Nginx, Caddy, Cloudflare, or AWS ALB
# Enables accurate req.ip from X-Forwarded-For and req.secure from X-Forwarded-Proto
TRUST_PROXY=1

# ------------------------------------------------------------------------------
# 2. AUTHENTICATION & SECRETS
# ------------------------------------------------------------------------------
# [REQ-PROD] JSON Web Token Signing Secret
# MUST be set explicitly in production, MUST be at least 32 characters with high entropy.
# Example generation command: openssl rand -base64 48
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS_LONG

# ------------------------------------------------------------------------------
# 3. DATABASE & PERSISTENT STORAGE
# ------------------------------------------------------------------------------
# [OPTIONAL] SQLite database file path (Default: server/data/database.sqlite)
DB_PATH=server/data/database.sqlite

# [OPTIONAL] Persistent document uploads directory (Default: server/uploads)
# MUST NOT be exposed as a public static asset directory.
UPLOAD_DIR=server/uploads

# [OPTIONAL] Maximum uploaded file size in bytes (Default: 5242880 = 5MB, max: 52428800 = 50MB)
MAX_FILE_SIZE_BYTES=5242880

# ------------------------------------------------------------------------------
# 4. SECURITY & ACCESS CONTROL
# ------------------------------------------------------------------------------
# [REQ-PROD] Authorized CORS Origins (Comma-separated)
# Wildcard '*' is STRICTLY FORBIDDEN in production.
# Example: https://admin.birojasa.com,https://app.birojasa.com
CORS_ORIGIN=https://admin.birojasa.com

# [OPTIONAL] Short-Lived Document Access Ticket TTL in seconds (Default: 60)
TICKET_TTL_SECONDS=60

# ------------------------------------------------------------------------------
# 5. RATE LIMITING (SLIDING WINDOW)
# ------------------------------------------------------------------------------
# [OPTIONAL] Max login attempts per minute per IP (Default: 10)
RATE_LIMIT_LOGIN_MAX=10

# [OPTIONAL] Max general API requests per 15 minutes per IP (Default: 600 in prod, 5000 in dev)
RATE_LIMIT_API_MAX=600

# [OPTIONAL] Max document uploads per minute per IP (Default: 30)
RATE_LIMIT_UPLOAD_MAX=30

# ------------------------------------------------------------------------------
# 6. FRONTEND CLIENT CONFIGURATION (Vite build-time)
# ------------------------------------------------------------------------------
# [OPTIONAL] Data Provider mode: 'api' for production, 'mock' for local isolated dev
VITE_APP_DATA_PROVIDER=api

# [OPTIONAL] Public API Base URL accessible by client browser
VITE_API_BASE_URL=https://admin.birojasa.com/api

```

File: `server/src/config/env.ts`
```typescript
/**
 * Backend Environment Configuration & Production Validator
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// Automatically load root .env file in Node.js 20+
if (typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile();
  } catch {
    // Non-fatal if .env doesn't exist
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Project root is 3 levels up from server/src/config
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, "../../..");
export const PROJECT_ROOT = process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT) : DEFAULT_PROJECT_ROOT;

export function resolveConfigPath(configuredPath: string | undefined, defaultRelative: string): string {
  if (!configuredPath || configuredPath.trim() === "") {
    return path.resolve(PROJECT_ROOT, defaultRelative);
  }
  return path.isAbsolute(configuredPath) ? path.resolve(configuredPath) : path.resolve(PROJECT_ROOT, configuredPath);
}

const DEFAULT_DEV_JWT = "sun89-secure-birojasa-secret-key-2026";

export interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  JWT_SECRET: string;
  DB_PATH: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  BACKUP_DIR?: string;
  MAX_FILE_SIZE_BYTES: number;
  TRUST_PROXY: string | number;
  TICKET_TTL_SECONDS: number;
  RATE_LIMIT_LOGIN_MAX: number;
  RATE_LIMIT_API_MAX: number;
  RATE_LIMIT_UPLOAD_MAX: number;
}

export function validateEnv(env: Partial<EnvConfig> & { getAllowedOrigins?: () => string[] }): void {
  const isProduction = env.NODE_ENV === "production";

  // 1. Port Validation
  const port = env.PORT !== undefined ? Number(env.PORT) : 3001;
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`FATAL CONFIGURATION: Invalid PORT configured: ${env.PORT}. Must be between 1 and 65535.`);
  }

  // 2. Production Secret & Hardening Validation
  if (isProduction) {
    const jwtSecret = env.JWT_SECRET || "";
    if (!jwtSecret || jwtSecret === DEFAULT_DEV_JWT || jwtSecret.length < 32) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: In production mode, JWT_SECRET must be explicitly set and be at least 32 characters long."
      );
    }

    // Insecure placeholder check
    const insecurePlaceholders = [
      "sun89-secure-birojasa-secret-key-2026",
      "sun89-change-this-in-production-secret-token-key-2026",
      "change-me-in-production-secret-key-32chars",
      "12345678901234567890123456789012",
    ];
    if (insecurePlaceholders.includes(jwtSecret)) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Insecure placeholder detected in JWT_SECRET. A unique, high-entropy secret must be provided."
      );
    }

    // CORS Origin validation
    const rawOrigins = env.CORS_ORIGIN || "";
    const origins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0 || origins.includes("*")) {
      throw new Error(
        "FATAL SECURITY CONFIGURATION: Wildcard CORS origin ('*') is strictly forbidden with credentialed API access in production."
      );
    }
  }

  // 3. File Size Validation
  const maxBytes = env.MAX_FILE_SIZE_BYTES !== undefined ? Number(env.MAX_FILE_SIZE_BYTES) : 5242880;
  if (isNaN(maxBytes) || maxBytes <= 0 || maxBytes > 52428800) {
    throw new Error("FATAL CONFIGURATION: MAX_FILE_SIZE_BYTES must be a positive integer not exceeding 50MB (52428800).");
  }

  // 4. Ticket TTL Validation
  const ticketTtl = env.TICKET_TTL_SECONDS !== undefined ? Number(env.TICKET_TTL_SECONDS) : 60;
  if (isNaN(ticketTtl) || ticketTtl < 10 || ticketTtl > 300) {
    throw new Error("FATAL CONFIGURATION: TICKET_TTL_SECONDS must be between 10 and 300 seconds.");
  }

  // 5. Upload Directory Validation
  if (env.UPLOAD_DIR !== undefined && (!env.UPLOAD_DIR || typeof env.UPLOAD_DIR !== "string" || env.UPLOAD_DIR.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: UPLOAD_DIR must be a non-empty string path.");
  }

  // 6. Database Path Validation
  if (env.DB_PATH !== undefined && (!env.DB_PATH || typeof env.DB_PATH !== "string" || env.DB_PATH.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: DB_PATH must be a non-empty string path.");
  }

  // 7. Backup Directory Validation
  if (env.BACKUP_DIR !== undefined && (!env.BACKUP_DIR || typeof env.BACKUP_DIR !== "string" || env.BACKUP_DIR.trim() === "")) {
    throw new Error("FATAL CONFIGURATION: BACKUP_DIR must be a non-empty string path.");
  }
}

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "3001", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_DEV_JWT,
  PROJECT_ROOT,
  DB_PATH: resolveConfigPath(process.env.DB_PATH, "server/data/database.sqlite"),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173",
  UPLOAD_DIR: resolveConfigPath(process.env.UPLOAD_DIR, "server/uploads"),
  BACKUP_DIR: resolveConfigPath(process.env.BACKUP_DIR, "server/backups"),
  MAX_FILE_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_BYTES || "5242880", 10), // 5MB default
  TRUST_PROXY: process.env.TRUST_PROXY || "1",
  TICKET_TTL_SECONDS: parseInt(process.env.TICKET_TTL_SECONDS || "60", 10),
  RATE_LIMIT_LOGIN_MAX: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || "10", 10),
  RATE_LIMIT_API_MAX: parseInt(process.env.RATE_LIMIT_API_MAX || (process.env.NODE_ENV === "production" ? "600" : "5000"), 10),
  RATE_LIMIT_UPLOAD_MAX: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || "30", 10),

  /**
   * Returns list of authorized CORS origins
   */
  getAllowedOrigins(): string[] {
    const raw = this.CORS_ORIGIN || "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173";
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  },

  /**
   * Fail-fast production environment validation
   */
  validate(): void {
    validateEnv(this);
  },
};

// Validate environment on module load
CONFIG.validate();


```

File: `deploy/.env.production.template`
```bash
# ==============================================================================
# Admin SUN89 ÔÇö Biro Jasa Management System
# Production Environment Configuration Template
# 
# INSTRUCTIONS:
# 1. Copy this file to: /opt/admin-sun89/shared/.env
# 2. Set strict permissions: chmod 600 /opt/admin-sun89/shared/.env
# 3. Ensure owner is application user: chown sun89:sun89 /opt/admin-sun89/shared/.env
# 4. Fill in unique, high-entropy secrets (NEVER commit secrets to Git)
# ==============================================================================

# [REQUIRED] Production Environment Mode
NODE_ENV=production

# [REQUIRED] Express Backend Port (Binds to loopback interface 127.0.0.1)
PORT=3001

# [REQUIRED] High-Entropy Secret Key (Minimum 32 characters, unique to production)
# Generate via: openssl rand -base64 48
JWT_SECRET=REPLACE_WITH_HIGH_ENTROPY_64_CHARACTER_SECRET_KEY_BEFORE_LAUNCH

# [REQUIRED] Authorized CORS Origins (Comma-separated, NO WILDCARDS ALLOWED in production)
CORS_ORIGIN=https://admin.birojasa.com

# [REQUIRED] Persistent Datastore Paths (Absolute paths pointing to /opt/admin-sun89/shared/)
DB_PATH=/opt/admin-sun89/shared/data/database.sqlite
UPLOAD_DIR=/opt/admin-sun89/shared/uploads
BACKUP_DIR=/opt/admin-sun89/shared/backups

# [REQUIRED] Reverse Proxy Trust Configuration
# Set to 1 because Nginx or Caddy terminates TLS and forwards requests locally
TRUST_PROXY=1

# [OPTIONAL] Rate Limiting Bounds (Requests per 1-minute window)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=600
AUTH_RATE_LIMIT_MAX_REQUESTS=10
UPLOAD_RATE_LIMIT_MAX_REQUESTS=30

# [OPTIONAL] Upload Payload Constraints (Bytes)
# Default: 5242880 (5MB). Server hard ceiling: 10485760 (10MB)
MAX_FILE_SIZE_BYTES=5242880

```

File: `deploy/nginx/admin-sun89.conf`
```nginx
# Admin SUN89 ÔÇö Biro Jasa Management System
# Production Nginx Reverse Proxy Configuration
# Place in: /etc/nginx/sites-available/admin-sun89
# Enable with: sudo ln -s /etc/nginx/sites-available/admin-sun89 /etc/nginx/sites-enabled/

# 1. HTTP -> HTTPS Redirect
server {
    listen 80;
    listen [::]:80;
    server_name admin.birojasa.com;

    # ACME Challenge for Let's Encrypt renewal
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# 2. HTTPS Main Virtual Host
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name admin.birojasa.com;

    # SSL Certificates (Managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/admin.birojasa.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.birojasa.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # Modern TLS Protocols and Ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

    # Upload Payload Bounds
    client_max_body_size 10M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml image/svg+xml;

    # Static Frontend SPA
    root /opt/admin-sun89/current/dist;
    index index.html;

    # SPA Routing (Fallback all non-file routes to index.html)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Asset Caching (Vite hashed bundles)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, no-transform, immutable";
    }

    # CRITICAL SECURITY INVARIANT: Deny direct access to internal storage
    location /uploads {
        deny all;
        return 404;
    }

    # Reverse Proxy to Express API (:3001)
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Disable buffering for streaming document downloads
        proxy_buffering off;
    }

    # Access and Error Logs
    access_log /var/log/nginx/admin-sun89-access.log;
    error_log /var/log/nginx/admin-sun89-error.log warn;
}

```

File: `deploy/caddy/Caddyfile`
```caddyfile
# Admin SUN89 ÔÇö Biro Jasa Management System
# Production Caddy Reverse Proxy Configuration (Automatic HTTPS via Let's Encrypt / ZeroSSL)
# Place in: /etc/caddy/Caddyfile

admin.birojasa.com {
    # Automatic TLS management with HTTP -> HTTPS redirection
    tls admin@birojasa.com

    # Security Headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "geolocation=(), microphone=(), camera=()"
        -Server
    }

    # Request Body Size Limit (10MB for document uploads)
    request_body {
        max_size 10MB
    }

    # CRITICAL: Prevent direct access to internal storage
    @denied_uploads path /uploads*
    respond @denied_uploads 404

    # Reverse Proxy /api/* to Express Backend (:3001)
    handle /api/* {
        reverse_proxy 127.0.0.1:3001 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    # Serve Static Frontend SPA
    handle {
        root * /opt/admin-sun89/current/dist
        try_files {path} /index.html
        file_server
    }

    # Logging
    log {
        output file /var/log/caddy/admin-sun89.log {
            roll_size 50mb
            roll_keep 5
        }
    }
}

```

File: `deploy/admin-sun89.service`
```text
[Unit]
Description=Admin SUN89 ÔÇö Biro Jasa Management System Express Backend
Documentation=file:///opt/admin-sun89/current/docs/deployment.md
After=network.target

[Service]
Type=simple
User=sun89
Group=sun89
WorkingDirectory=/opt/admin-sun89/current
EnvironmentFile=/opt/admin-sun89/shared/.env
ExecStart=/usr/bin/node /opt/admin-sun89/current/node_modules/tsx/dist/cli.mjs /opt/admin-sun89/current/server/src/server.ts
Restart=always
RestartSec=5
TimeoutStopSec=10
KillSignal=SIGTERM

# Hardening / Sandboxing
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=admin-sun89

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target

```

## 3. Entry Point & Arsitektur Inti

File: `server/src/server.ts`
```typescript
/**
 * Express Server Runner with Graceful Shutdown
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import { createApp } from "./app";
import { CONFIG } from "./config/env";
import { closeDb } from "./database/db";

const app = createApp();

const server = app.listen(CONFIG.PORT, () => {
  console.log(`[SUN89 Backend] Server started successfully.`);
  console.log(`[SUN89 Backend] Version: 1.0.0 (Phase 7.7 Baseline)`);
  console.log(`[SUN89 Backend] Environment: ${CONFIG.NODE_ENV}`);
  console.log(`[SUN89 Backend] Listening port: ${CONFIG.PORT}`);
  console.log(`[SUN89 Backend] Database path: ${CONFIG.DB_PATH}`);
  console.log(`[SUN89 Backend] Uploads storage: ${CONFIG.UPLOAD_DIR}`);
  console.log(`[SUN89 Backend] Backups directory: ${CONFIG.BACKUP_DIR}`);
  console.log(`[SUN89 Backend] Liveness probe: http://localhost:${CONFIG.PORT}/api/health/live`);
  console.log(`[SUN89 Backend] Readiness probe: http://localhost:${CONFIG.PORT}/api/health/ready`);
});

// Graceful Shutdown Handling (Milestone 17)
function handleShutdown(signal: string) {
  console.log(`[SUN89 Backend] Received ${signal}. Starting graceful shutdown...`);

  const forceTimeout = setTimeout(() => {
    console.error("[SUN89 Backend] Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
  forceTimeout.unref();

  server.close((err) => {
    if (err) {
      console.error("[SUN89 Backend] Error closing HTTP server:", err);
      process.exit(1);
    }
    console.log("[SUN89 Backend] HTTP server closed cleanly.");
    closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export { app, server };

```

File: `server/src/app.ts`
```typescript
/**
 * Express Application Assembly with Hardened Security
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import express, { Express, Request, Response } from "express";
import cors from "cors";
import fs from "node:fs";
import { CONFIG } from "./config/env";
import { db } from "./database/db";
import { requestLogger } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";
import { securityHeaders } from "./middleware/securityHeaders";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { seedDatabase } from "./database/seed";

import { authRouter } from "./routes/authRoutes";
import { orderRouter } from "./routes/orderRoutes";
import { pricingRouter } from "./routes/pricingRoutes";
import { financeRouter } from "./routes/financeRoutes";
import { userRouter } from "./routes/userRoutes";
import { auditRouter } from "./routes/auditRoutes";
import { documentRouter } from "./routes/documentRoutes";
import { estimationRouter } from "./routes/estimationRoutes";
import { wilayahRouter, samsatOfficeRouter } from "./routes/wilayahRoutes";
import { notificationRouter } from "./routes/notificationRoutes";
import { permissionRouter } from "./routes/permissionRoutes";
import { paymentMethodRouter } from "./routes/paymentMethodRoutes";
import { messengerRouter } from "./routes/messengerRoutes";

export function createApp(): Express {
  // Initialize Database Seeds if needed
  seedDatabase();

  const app = express();

  // Reverse Proxy & Forwarded Headers Configuration (Milestone 4)
  const trustProxySetting = CONFIG.TRUST_PROXY === "true" ? true
    : CONFIG.TRUST_PROXY === "false" ? false
    : !isNaN(Number(CONFIG.TRUST_PROXY)) ? Number(CONFIG.TRUST_PROXY)
    : CONFIG.TRUST_PROXY;
  app.set("trust proxy", trustProxySetting);

  // 1. Security Headers (Milestone 14)
  app.use(securityHeaders);

  // 2. Hardened CORS Configuration (Milestone 9)
  const allowedOrigins = CONFIG.getAllowedOrigins();
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, test agents, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        return callback(new Error(`CORS Error: Origin '${origin}' is not authorized.`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Idempotency-Key", "x-idempotency-key", "Accept", "Cache-Control", "cache-control"],
    })
  );

  // 3. Payload size limiting (Milestone 19)
  app.use(express.json({ limit: "10mb" }));
  app.use(requestLogger);

  // 4. Health Probes: Liveness & Readiness Endpoints (exempt from rate limits)
  // Liveness probe (fast, lightweight process-alive check)
  const livenessHandler = (req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: "admin-sun89-api",
      database: "sqlite-connected",
    });
  };
  app.get("/api/health", livenessHandler);
  app.get("/api/health/live", livenessHandler);

  // Readiness probe (checks critical dependencies: DB connectivity, storage directory writability)
  app.get("/api/health/ready", (req: Request, res: Response) => {
    const checks: Record<string, string> = {
      database: "unknown",
      storage: "unknown",
      config: "healthy",
    };
    let isReady = true;

    // 1. Check SQLite database responsiveness
    try {
      const row = db.prepare("SELECT 1 AS alive").get() as { alive?: number };
      if (row && row.alive === 1) {
        checks.database = "healthy";
      } else {
        checks.database = "degraded";
        isReady = false;
      }
    } catch {
      checks.database = "unhealthy";
      isReady = false;
    }

    // 2. Check persistent document upload directory accessibility and writability
    try {
      if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
        fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
      }
      fs.accessSync(CONFIG.UPLOAD_DIR, fs.constants.W_OK);
      checks.storage = "healthy";
    } catch {
      checks.storage = "unhealthy";
      isReady = false;
    }

    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json({
      status: isReady ? "ready" : "not_ready",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  // 5. Rate Limiting for all business API routes (Milestone 15)
  app.use("/api", apiRateLimiter);

  // Mount Feature Routes
  app.use("/api/auth", authRouter);
  app.use("/api/orders", orderRouter);
  app.use("/api/pricing", pricingRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/users", userRouter);
  app.use("/api/audit-logs", auditRouter);
  app.use("/api/documents", documentRouter);
  app.use("/api/estimation", estimationRouter);
  app.use("/api/wilayah", wilayahRouter);
  app.use("/api/samsat/offices", samsatOfficeRouter);
  app.use("/api/notifications", notificationRouter);
  app.use("/api/permissions", permissionRouter);
  app.use("/api/payment-methods", paymentMethodRouter);
  app.use("/api/messenger", messengerRouter);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Endpoint '${req.method} ${req.originalUrl}' tidak ditemukan.`,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Centralized Error Handler (Milestone 16)
  app.use(errorHandler);

  return app;
}

```

File: `src/main.tsx`
```tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./app/App";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

File: `src/app/config/routeConfig.ts`
```typescript
/**
 * Canonical Route Configuration & Metadata
 * Admin SUN89 ÔÇö Biro Jasa Management System
 * 
 * Provides centralized route paths, titles, breadcrumbs, and permission mappings.
 */

export interface RouteMeta {
  path: string;
  id: string; // Permission ID used by permissionStore.canViewPage
  title: string;
  description: string;
  breadcrumbs: string[];
  parentGroupId?: string;
}

export const DATA_PENJUALAN_CATEGORIES: Record<string, string> = {
  "mutasi-ld": "Mutasi LD",
  "mutasi-as": "Mutasi AS",
  "bbn": "BBN",
  "perpanjangan-pajak": "Perpanjangan Pajak",
  "lain-lain": "Lain-Lain",
};

export const CANONICAL_ROUTES: Record<string, RouteMeta> = {
  "/dashboard": {
    path: "/dashboard",
    id: "dashboard",
    title: "Dashboard",
    description: "Ringkasan performa operasional dan finansial",
    breadcrumbs: ["Dashboard"],
    parentGroupId: "dashboard",
  },
  // Finance
  "/finance/profit": {
    path: "/finance/profit",
    id: "finance-profit",
    title: "Profit",
    description: "Pantau margin keuntungan dan rincian transaksi per berkas",
    breadcrumbs: ["Finance", "Profit"],
    parentGroupId: "finance",
  },
  "/finance/kas-messenger": {
    path: "/finance/kas-messenger",
    id: "finance-kas-messenger",
    title: "Kas Messenger",
    description: "Kelola pencatatan kas petty cash dan operasional messenger",
    breadcrumbs: ["Finance", "Kas Messenger"],
    parentGroupId: "finance",
  },
  "/finance/kas-kantor": {
    path: "/finance/kas-kantor",
    id: "finance-kas-kantor",
    title: "Kas Kantor",
    description: "Kelola transaksi kas kantor",
    breadcrumbs: ["Finance", "Kas Kantor"],
    parentGroupId: "finance",
  },
  "/finance/pengeluaran": {
    path: "/finance/pengeluaran",
    id: "finance-pengeluaran",
    title: "Pengeluaran",
    description: "Catat dan monitor seluruh pos pengeluaran operasional kantor",
    breadcrumbs: ["Finance", "Pengeluaran"],
    parentGroupId: "finance",
  },
  "/finance/data-penjualan": {
    path: "/finance/data-penjualan",
    id: "finance-penjualan",
    title: "Data Penjualan",
    description: "Kelola dan pantau data penjualan berkas",
    breadcrumbs: ["Finance", "Data Penjualan"],
    parentGroupId: "finance",
  },
  "/finance/belum-bayar": {
    path: "/finance/belum-bayar",
    id: "finance-belum-bayar",
    title: "Belum & Kurang Bayar",
    description: "Monitoring transaksi customer yang belum lunas atau kurang bayar",
    breadcrumbs: ["Finance", "Belum & Kurang Bayar"],
    parentGroupId: "finance",
  },
  "/finance/profit-pending": {
    path: "/finance/profit-pending",
    id: "finance-profit-pending",
    title: "Profit Terpending",
    description: "Monitoring profit transaksi yang masih berstatus pending verifikasi",
    breadcrumbs: ["Finance", "Profit Terpending"],
    parentGroupId: "finance",
  },
  "/finance/cashback-pending": {
    path: "/finance/cashback-pending",
    id: "finance-cashback-pending",
    title: "Cashback Terpending",
    description: "Monitoring cashback rekanan yang masih tertahan atau pending pencairan",
    breadcrumbs: ["Finance", "Cashback Terpending"],
    parentGroupId: "finance",
  },
  "/finance/laba-rugi": {
    path: "/finance/laba-rugi",
    id: "finance-laba-rugi",
    title: "Laba Rugi",
    description: "Analisis performa keuangan, total pendapatan, dan laba bersih",
    breadcrumbs: ["Finance", "Laba Rugi"],
    parentGroupId: "finance",
  },
  // Master Data
  "/master-data/samsat": {
    path: "/master-data/samsat",
    id: "master-samsat",
    title: "Data Samsat",
    description: "Kelola data Samsat yang digunakan dalam sistem",
    breadcrumbs: ["Master Data", "Samsat"],
    parentGroupId: "master-data",
  },
  "/master-data/metode-pembayaran": {
    path: "/master-data/metode-pembayaran",
    id: "master-metode-pembayaran",
    title: "Metode Pembayaran",
    description: "Kelola nomor rekening resmi dan metode pembayaran transaksi",
    breadcrumbs: ["Master Data", "Metode Pembayaran"],
    parentGroupId: "master-data",
  },
  "/master-data/biaya-layanan": {
    path: "/master-data/biaya-layanan",
    id: "master-biaya-layanan",
    title: "Biaya Layanan",
    description: "Kelola tarif dan biaya jasa pengurusan dokumen",
    breadcrumbs: ["Master Data", "Biaya Layanan"],
    parentGroupId: "master-data",
  },
  "/master-data/harga-dasar": {
    path: "/master-data/harga-dasar",
    id: "master-harga-dasar-samsat",
    title: "Harga Dasar Samsat",
    description: "Kelola harga dasar penerbitan dan estimasi resmi samsat",
    breadcrumbs: ["Master Data", "Harga Dasar Samsat"],
    parentGroupId: "master-data",
  },
  // Management
  "/manajemen/karyawan": {
    path: "/manajemen/karyawan",
    id: "manajemen-karyawan",
    title: "Karyawan",
    description: "Kelola data karyawan dan staf operasional",
    breadcrumbs: ["Manajemen", "Karyawan"],
    parentGroupId: "manajemen",
  },
  "/manajemen/pengguna": {
    path: "/manajemen/pengguna",
    id: "manajemen-pengguna",
    title: "Pengguna",
    description: "Kelola akun pengguna dan hak akses login",
    breadcrumbs: ["Manajemen", "Pengguna"],
    parentGroupId: "manajemen",
  },
  "/manajemen/hak-akses": {
    path: "/manajemen/hak-akses",
    id: "access-management",
    title: "Hak Akses",
    description: "Konfigurasi matriks perizinan role dan kontrol modul",
    breadcrumbs: ["Manajemen", "Hak Akses"],
    parentGroupId: "manajemen",
  },
  "/manajemen/riwayat-aktivitas": {
    path: "/manajemen/riwayat-aktivitas",
    id: "audit-log",
    title: "Riwayat Aktivitas",
    description: "Audit trail pencatatan aktivitas dan log keamanan sistem",
    breadcrumbs: ["Manajemen", "Riwayat Aktivitas"],
    parentGroupId: "manajemen",
  },
  // Messenger
  "/messenger/tasks": {
    path: "/messenger/tasks",
    id: "messenger-task",
    title: "Messenger Task",
    description: "Kelola penugasan, status kurir, dan pengantaran dokumen",
    breadcrumbs: ["Messenger", "Messenger Task"],
    parentGroupId: "messenger-menu",
  },
  "/messenger/history": {
    path: "/messenger/history",
    id: "messenger-history",
    title: "Messenger History",
    description: "Arsip riwayat pekerjaan Messenger selesai, kronologi proses, dan rincian pengajuan biaya",
    breadcrumbs: ["Messenger", "Messenger History"],
    parentGroupId: "messenger-menu",
  },
  // Order
  "/order/buat": {
    path: "/order/buat",
    id: "buat-order",
    title: "Buat Order",
    description: "Formulir pendaftaran dan estimasi order biro jasa baru",
    breadcrumbs: ["Order", "Buat Order"],
    parentGroupId: "order-menu",
  },
  "/order/tracking": {
    path: "/order/tracking",
    id: "order-tracking",
    title: "Order Tracking",
    description: "Monitoring status dan tahapan pengerjaan order aktif",
    breadcrumbs: ["Order", "Order Tracking"],
    parentGroupId: "order-menu",
  },
  "/order/rekap": {
    path: "/order/rekap",
    id: "order-history",
    title: "Rekap Order",
    description: "Arsip order selesai dan riwayat transaksi terlunasi",
    breadcrumbs: ["Order", "Rekap Order"],
    parentGroupId: "order-menu",
  },
  // Utilities
  "/settings": {
    path: "/settings",
    id: "settings",
    title: "Pengaturan",
    description: "Kelola preferensi dan konfigurasi sistem",
    breadcrumbs: ["Pengaturan"],
  },
  "/notifikasi": {
    path: "/notifikasi",
    id: "notifikasi",
    title: "Riwayat Notifikasi",
    description: "Pusat log pemberitahuan, pengingat tagihan, dan pesan operasional",
    breadcrumbs: ["Notifikasi"],
  },
  "/profile": {
    path: "/profile",
    id: "profile",
    title: "Profil Saya",
    description: "Informasi profil akun dan kredensial pengguna",
    breadcrumbs: ["Profil Saya"],
  },
  // Messenger Dedicated Workspace
  "/messenger/workspace": {
    path: "/messenger/workspace",
    id: "messenger-task",
    title: "Messenger Workspace",
    description: "Workspace operasional lapangan petugas kurir",
    breadcrumbs: ["Messenger Workspace"],
  },
};

/**
 * Resolve metadata for any pathname, including dynamic parameter routes.
 */
export function getRouteMeta(pathname: string): RouteMeta {
  // Normalize pathname: remove trailing slash except root
  const normalized = pathname.length > 1 && pathname.endsWith("/") 
    ? pathname.slice(0, -1) 
    : pathname;

  // Direct match
  if (CANONICAL_ROUTES[normalized]) {
    return CANONICAL_ROUTES[normalized];
  }

  // Data Penjualan category match: /finance/data-penjualan/:category
  if (normalized.startsWith("/finance/data-penjualan/")) {
    const category = normalized.replace("/finance/data-penjualan/", "").split("/")[0];
    const categoryLabel = DATA_PENJUALAN_CATEGORIES[category] || category;
    return {
      path: normalized,
      id: "finance-penjualan",
      title: `Data Penjualan ÔÇö ${categoryLabel}`,
      description: `Rekapitulasi transaksi ${categoryLabel} dan kalkulasi samsat`,
      breadcrumbs: ["Finance", "Data Penjualan", categoryLabel],
      parentGroupId: "finance",
    };
  }

  // Default fallback for unknown or unmapped routes
  return {
    path: normalized,
    id: "unknown",
    title: "Admin SUN89",
    description: "Sistem Manajemen Biro Jasa",
    breadcrumbs: ["Beranda"],
  };
}

```

File: `src/app/App.tsx`
```tsx
import { useState, useEffect, lazy, Suspense } from "react";
import { useLocation, useNavigate, Routes, Route, Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { 
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Sun,
  Moon,
  ShieldAlert,
} from "lucide-react";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Auth } from "./components/Auth";
import { NotificationPopover } from "./components/NotificationPopover";
import { useNotifications } from "./data/notificationAdapter";
import { Button } from "./components/ui/button";
import { NotFoundPage } from "./components/NotFoundPage";
import { HeaderReloadButton } from "./utils/useLiveSync";

// Page-level code splitting for on-demand bundle delivery
const Dashboard = lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const Finance = lazy(() => import("./components/Finance").then(m => ({ default: m.Finance })));
const MasterData = lazy(() => import("./components/MasterData").then(m => ({ default: m.MasterData })));
const MessengerTask = lazy(() => import("./components/MessengerTask").then(m => ({ default: m.MessengerTask })));
const MessengerHistory = lazy(() => import("./components/MessengerHistory").then(m => ({ default: m.MessengerHistory })));
const MessengerWorkspace = lazy(() => import("./components/messenger/MessengerWorkspace").then(m => ({ default: m.MessengerWorkspace })));
const BuatOrder = lazy(() => import("./components/BuatOrder").then(m => ({ default: m.BuatOrder })));
const OrderTracking = lazy(() => import("./components/OrderTracking").then(m => ({ default: m.OrderTracking })));
const OrderHistory = lazy(() => import("./components/OrderHistory").then(m => ({ default: m.OrderHistory })));
const SettingsPage = lazy(() => import("./components/Settings").then(m => ({ default: m.Settings })));
const NotificationHistory = lazy(() => import("./components/NotificationHistory").then(m => ({ default: m.NotificationHistory })));
const Profile = lazy(() => import("./components/Profile").then(m => ({ default: m.Profile })));
const AuditLog = lazy(() => import("./components/AuditLog").then(m => ({ default: m.AuditLog })));
const AccessManagement = lazy(() => import("./components/AccessManagement").then(m => ({ default: m.AccessManagement })));

function PageLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <span className="text-xs font-medium">Memuat halaman...</span>
      </div>
    </div>
  );
}

import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import { cn } from "./components/ui/utils";
import { usePermissionStore, permissionStore } from "./data/permissionStore";
import { orderStore } from "./data/orderStore";
import { financeStore } from "./data/financeStore";
import { pricingStore } from "./data/pricingStore";
import { auditLog } from "./utils/auditLog";
import { APP_CONFIG } from "./config/appConfig";
import { menuItems, MenuItem } from "./config/navigationConfig";
import { getRouteMeta } from "./config/routeConfig";

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  // Synchronous initialization from localStorage prevents flash-of-unauth redirect on refresh/deep-link
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem("auth_user") && localStorage.getItem("auth_token"));
    } catch {
      return false;
    }
  });

  const [userRole, setUserRole] = useState<'administrator' | 'finance' | 'admin' | 'messenger' | null>(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.role || null;
      }
    } catch {}
    return null;
  });

  const [userName, setUserName] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.nama || savedUser.name || "";
      }
    } catch {}
    return "";
  });

  const [userId, setUserId] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        return savedUser.userId || String(savedUser.id || "");
      }
    } catch {}
    return "";
  });

  const [employeeId, setEmployeeId] = useState(() => {
    try {
      const savedUserStr = localStorage.getItem("auth_user");
      if (savedUserStr) {
        const savedUser = JSON.parse(savedUserStr);
        const uName = (savedUser.nama || savedUser.name || "").toLowerCase();
        const defaultMsgId = uName.includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001';
        return savedUser.employeeId || (savedUser.role === 'messenger' ? defaultMsgId : '');
      }
    } catch {}
    return "";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([
    "finance",
    "master-data",
    "manajemen",
    "messenger-menu",
    "order-menu"
  ]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { theme } = useTheme();

  // Authoritative Role & Permission Store
  const { canViewPage, getFilteredMenuItems } = usePermissionStore();

  // Dynamic notifications derived from real unpaid invoices & active orders
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Accessibility: close mobile sidebar on Escape key
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileSidebarOpen]);

  // Verify token on mount and initialize stores if authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      handleLogout();
      return;
    }

    // Verify token validity against backend /api/auth/me
    fetch(`${APP_CONFIG.apiBaseUrl}/auth/me`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (res.status === 401) {
          handleLogout();
        } else if (res.ok) {
          try {
            const payload = await res.json();
            if (payload?.success && payload.data) {
              if (payload.data.role && payload.data.role !== userRole) {
                setUserRole(payload.data.role);
                const savedUserStr = localStorage.getItem("auth_user");
                if (savedUserStr) {
                  try {
                    const saved = JSON.parse(savedUserStr);
                    saved.role = payload.data.role;
                    localStorage.setItem("auth_user", JSON.stringify(saved));
                  } catch {}
                }
              }
            }
          } catch {}

          // Initialize all core stores in parallel with valid token
          Promise.allSettled([
            orderStore.initFromApi(),
            financeStore.initFromApi(),
            pricingStore.initFromApi(),
            auditLog.initFromApi(),
            permissionStore.initFromApi(),
          ]).catch(() => {});
        }
      })
      .catch(() => {
        // Network fallback
        orderStore.initFromApi().catch(() => {});
      });
  }, [isAuthenticated]);

  // Global listener for 401 Unauthorized events from background API requests
  useEffect(() => {
    const onUnauthorized = () => {
      handleLogout();
    };
    window.addEventListener("sun89_auth_unauthorized", onUnauthorized);
    return () => window.removeEventListener("sun89_auth_unauthorized", onUnauthorized);
  }, []);

  const handleLogin = (
    role: 'administrator' | 'finance' | 'admin' | 'messenger',
    name: string,
    id: string,
    empId?: string
  ) => {
    setUserRole(role);
    setUserName(name);
    setUserId(id);
    const defaultMsgId = name?.toLowerCase().includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001';
    const finalEmpId = empId || (role === 'messenger' ? defaultMsgId : '');
    setEmployeeId(finalEmpId);
    setIsAuthenticated(true);

    try {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          role,
          jabatan: role.toUpperCase(),
          nama: name,
          name,
          userId: id,
          id,
          employeeId: finalEmpId,
        })
      );
    } catch {
      // ignore
    }

    // Initialize all core stores in parallel with fresh session
    Promise.allSettled([
      orderStore.initFromApi(),
      financeStore.initFromApi(),
      pricingStore.initFromApi(),
      auditLog.initFromApi(),
      permissionStore.initFromApi(),
    ]).catch(() => {});

    // Target route after login
    const targetPath = (location.state as any)?.from?.pathname || (role === 'messenger' ? '/messenger/workspace' : '/dashboard');
    navigate(targetPath, { replace: true });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setUserRole(null);
    setUserName("");
    setUserId("");
    setEmployeeId("");
    navigate("/login", { replace: true });
  };

  // 1. Unauthenticated Route Flow
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Auth onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} />
      </Routes>
    );
  }

  // 2. Redirect authenticated users away from /login
  if (location.pathname === "/login") {
    return <Navigate to={userRole === 'messenger' ? '/messenger/workspace' : '/dashboard'} replace />;
  }

  // 3. Dedicated Messenger Workspace for Messenger Role
  if (userRole === 'messenger') {
    return (
      <Suspense fallback={<PageLoadingFallback />}>
        <MessengerWorkspace
          onLogout={handleLogout}
          currentUser={{
            userId,
            userName,
            role: 'messenger',
            employeeId: employeeId || (userName?.toLowerCase().includes("andi") ? 'EMP-MSG-002' : 'EMP-MSG-001'),
          }}
        />
      </Suspense>
    );
  }

  // 4. Standard Desktop / Admin Shell
  const filteredMenuItems = getFilteredMenuItems(userRole, menuItems);
  const routeMeta = getRouteMeta(location.pathname);
  const isAllowed = userRole ? canViewPage(userRole, routeMeta.id) : false;

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobileSidebarOpen) {
      setIsMobileSidebarOpen(false);
    }
  };

  return (
    <div className="flex h-screen h-[100dvh] max-h-screen w-full overflow-hidden overscroll-none bg-background">
      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 lg:hidden"
            />
            {/* Sidebar */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu navigasi utama"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed inset-y-0 left-0 w-[280px] max-w-[85vw] glass-sidebar z-50 lg:hidden flex flex-col"
            >
              <SidebarContent 
                isSidebarOpen={true}
                currentPath={location.pathname}
                onNavigate={handleNavigate}
                handleLogout={handleLogout}
                expandedMenus={expandedMenus}
                setExpandedMenus={setExpandedMenus}
                filteredMenuItems={filteredMenuItems}
                onClose={() => setIsMobileSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isSidebarOpen ? 280 : 80,
        }}
        className="glass-sidebar hidden lg:flex flex-col relative z-30 transition-all duration-300 shrink-0 h-full max-h-screen overflow-visible"
      >
        <SidebarContent 
          isSidebarOpen={isSidebarOpen}
          currentPath={location.pathname}
          onNavigate={handleNavigate}
          handleLogout={handleLogout}
          expandedMenus={expandedMenus}
          setExpandedMenus={setExpandedMenus}
          filteredMenuItems={filteredMenuItems}
        />

        {/* Toggle Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label={isSidebarOpen ? "Kecilkan menu samping" : "Perluas menu samping"}
          aria-expanded={isSidebarOpen}
          className="hidden lg:flex absolute -right-3 top-5 w-6 h-6 items-center justify-center rounded-full bg-card border border-border shadow-md hover:bg-muted text-muted-foreground hover:text-foreground transition-all z-40 cursor-pointer"
        >
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isSidebarOpen ? "rotate-180" : "")} />
        </button>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border/80 px-3 sm:px-4 py-2.5 md:px-6 md:py-3 flex items-center justify-between shrink-0 shadow-xs z-10 gap-2 min-w-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMobileSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={isMobileSidebarOpen}
              className="lg:hidden h-8 w-8 p-0 shrink-0"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-base leading-tight font-semibold text-foreground truncate">
                {routeMeta.title}
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block truncate">
                {routeMeta.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Realtime Live Sync Indicator & Reload Button */}
            <HeaderReloadButton
              variant="admin"
              toastMessage="Data order & status operasional diperbarui"
            />
            <ThemeToggle />
            <NotificationPopover
              open={isNotificationOpen}
              onOpenChange={setIsNotificationOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              onMarkAllAsRead={markAllAsRead}
              onMarkAsRead={markAsRead}
            >
              <Button
                variant="ghost"
                size="sm"
                className="relative h-8 w-8 p-0 shrink-0"
                aria-label={`Notifikasi sistem${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ""}`}
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 min-w-4 h-4 p-0 flex items-center justify-center bg-rose-500 text-white text-[10px] font-semibold rounded-full px-1 border-0">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </NotificationPopover>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
              aria-label="Pengaturan sistem"
              className="hidden sm:flex h-8 w-8 p-0 shrink-0"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <button
              type="button"
              className="flex items-center gap-2 pl-1.5 sm:pl-2.5 md:pl-3 border-l border-border/80 cursor-pointer hover:bg-muted/60 rounded-lg px-1.5 py-1 sm:px-2 transition-colors shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => navigate("/profile")}
              aria-label="Buka profil admin"
            >
              <Avatar className="w-7 h-7">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-xs font-medium text-foreground leading-tight">{userName || "Admin"}</p>
                <p className="text-[11px] text-muted-foreground">{userRole ? userRole.toUpperCase() : "Admin"}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Breadcrumb Bar (Below Header - No border line, compact spacing) */}
        {routeMeta.breadcrumbs && routeMeta.breadcrumbs.length > 1 && (
          <div className="px-3 sm:px-4 pt-2 pb-0 md:px-6 shrink-0 flex items-center">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] md:text-xs text-muted-foreground truncate">
              {routeMeta.breadcrumbs.map((crumb, idx) => {
                const isLast = idx === routeMeta.breadcrumbs.length - 1;
                return (
                  <span key={crumb} className="inline-flex items-center gap-1.5">
                    {idx > 0 && <span className="opacity-40">/</span>}
                    <span className={cn(isLast ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {crumb}
                    </span>
                  </span>
                );
              })}
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-auto overscroll-contain min-w-0 w-full">
          <ErrorBoundary
            resetKey={location.pathname}
            fallbackTitle={`Terjadi kendala saat memuat ${routeMeta.title}`}
            onReset={() => navigate("/dashboard")}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <div className={cn(
                "min-h-full w-full min-w-0 animate-in fade-in duration-150 text-left flex flex-col page-shell",
                routeMeta.breadcrumbs && routeMeta.breadcrumbs.length > 1 && "pt-1.5 sm:pt-2 md:pt-2.5"
              )}>
                {!isAllowed && routeMeta.id !== "unknown" ? (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-foreground">Akses Ditolak</h2>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Akses Ditolak: Anda tidak memiliki izin untuk mengakses halaman ini.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/dashboard")}
                    >
                      Kembali ke Dashboard
                    </Button>
                  </div>
                ) : (
                  <Routes>
                    {/* Root Redirect */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    {/* Main Dashboard */}
                    <Route path="/dashboard" element={<Dashboard />} />

                    {/* Finance Routes */}
                    <Route path="/finance/profit" element={<Finance defaultTab="profit" />} />
                    <Route path="/finance/kas-messenger" element={<Finance defaultTab="kas-messenger" />} />
                    <Route path="/finance/kas-kantor" element={<Finance defaultTab="kas-kantor" />} />
                    <Route path="/finance/pengeluaran" element={<Finance defaultTab="pengeluaran" />} />
                    <Route path="/finance/data-penjualan" element={<Navigate to="/finance/data-penjualan/mutasi-ld" replace />} />
                    <Route path="/finance/data-penjualan/:category" element={<Finance defaultTab="penjualan" />} />
                    <Route path="/finance/belum-bayar" element={<Finance defaultTab="belum-bayar" />} />
                    <Route path="/finance/profit-pending" element={<Finance defaultTab="profit-pending" />} />
                    <Route path="/finance/cashback-pending" element={<Finance defaultTab="cashback-pending" />} />
                    <Route path="/finance/tagihan" element={<Navigate to="/finance/belum-bayar" replace />} />
                    <Route path="/finance/laba-rugi" element={<Finance defaultTab="laba-rugi" />} />

                    {/* Master Data Routes */}
                    <Route path="/master-data/samsat" element={<MasterData defaultTab="samsat" />} />
                    <Route path="/master-data/metode-pembayaran" element={<MasterData defaultTab="metode-pembayaran" />} />
                    <Route path="/master-data/biaya-layanan" element={<MasterData defaultTab="biaya-layanan" />} />
                    <Route path="/master-data/harga-dasar" element={<MasterData defaultTab="harga-dasar-samsat" />} />

                    {/* Management Routes */}
                    <Route path="/manajemen/karyawan" element={<MasterData defaultTab="karyawan" />} />
                    <Route path="/manajemen/pengguna" element={<MasterData defaultTab="pengguna" />} />
                    <Route path="/manajemen/hak-akses" element={<AccessManagement currentUserId={userId} currentUserName={userName} />} />
                    <Route path="/manajemen/riwayat-aktivitas" element={<AuditLog currentUserRole={userRole || 'admin'} />} />

                    {/* Messenger Tasks & History (Admin View) */}
                    <Route path="/messenger/tasks" element={<MessengerTask />} />
                    <Route path="/messenger/history" element={<MessengerHistory />} />
                    <Route path="/messenger/workspace" element={<MessengerWorkspace onLogout={handleLogout} currentUser={{ userId, userName, role: userRole || 'admin', employeeId }} />} />

                    {/* Order Routes */}
                    <Route path="/order/buat" element={
                      <BuatOrder 
                        onOrderCreated={() => navigate("/order/tracking")} 
                        currentUserName={userName} 
                        currentUserRole={userRole || "admin"} 
                        currentUserId={userId} 
                      />
                    } />
                    <Route path="/order/tracking" element={<OrderTracking userRole={userRole} userName={userName} userId={userId} />} />
                    <Route path="/order/rekap" element={<OrderHistory />} />

                    {/* Utility Routes */}
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/notifikasi" element={<NotificationHistory />} />
                    <Route path="/profile" element={<Profile />} />

                    {/* 404 Catch-All */}
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                )}
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ 
  isSidebarOpen, 
  currentPath, 
  onNavigate,
  handleLogout,
  expandedMenus,
  setExpandedMenus,
  filteredMenuItems,
  onClose
}: { 
  isSidebarOpen: boolean;
  currentPath: string;
  onNavigate: (path: string) => void;
  handleLogout: () => void;
  expandedMenus: string[];
  setExpandedMenus: (menus: string[]) => void;
  filteredMenuItems: MenuItem[];
  onClose?: () => void;
}) {
  const toggleMenu = (menuId: string) => {
    if (expandedMenus.includes(menuId)) {
      setExpandedMenus(expandedMenus.filter(id => id !== menuId));
    } else {
      setExpandedMenus([...expandedMenus, menuId]);
    }
  };

  const isItemActive = (path: string) => {
    if (path === "/finance/data-penjualan") {
      return currentPath.startsWith("/finance/data-penjualan");
    }
    if (path === "/dashboard") {
      return currentPath === "/dashboard" || currentPath === "/";
    }
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const isParentActive = (item: MenuItem) => {
    if (item.subItems && item.subItems.length > 0) {
      return item.subItems.some(sub => isItemActive(sub.path));
    }
    return isItemActive(item.path);
  };

  return (
    <>
      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-border/80 shrink-0">
        <div className="flex items-center justify-between">
          <motion.div
            animate={{ opacity: isSidebarOpen ? 1 : 0 }}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              <span>BJ</span>
            </div>
            {isSidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-foreground leading-tight truncate">
                  Admin SUN89
                </h1>
                <p className="text-[11px] text-muted-foreground font-normal truncate">Biro Jasa System</p>
              </div>
            )}
          </motion.div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              aria-label="Tutup menu navigasi"
              className="lg:hidden h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto overscroll-contain">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = isParentActive(item);
          const isExpanded = expandedMenus.includes(item.id);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          
          return (
            <div key={item.id}>
              {/* Main Menu Item */}
              <motion.button
                onClick={() => {
                  if (hasSubItems) {
                    toggleMenu(item.id);
                    if (!isExpanded && isSidebarOpen) {
                      onNavigate(item.subItems![0].path);
                    }
                  } else {
                    onNavigate(item.path);
                  }
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors relative group text-sm font-medium",
                  isActive
                    ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 relative z-10", isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground group-hover:text-foreground")} />
                {isSidebarOpen && (
                  <>
                    <span className={cn("relative z-10 flex-1 text-left truncate", isActive ? "text-primary dark:text-blue-400" : "text-foreground/80 group-hover:text-foreground")}>
                      {item.label}
                    </span>
                    {hasSubItems && (
                      <ChevronDown 
                        className={cn(
                          "w-4 h-4 transition-transform relative z-10 shrink-0", 
                          isExpanded ? "rotate-180" : "",
                          isActive ? "text-primary dark:text-blue-400" : "text-muted-foreground"
                        )} 
                      />
                    )}
                  </>
                )}
              </motion.button>

              {/* Sub Menu Items */}
              {hasSubItems && isSidebarOpen && (
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border/60 pl-2">
                        {item.subItems!.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = isItemActive(subItem.path);

                          return (
                            <motion.button
                              key={subItem.id}
                              onClick={() => onNavigate(subItem.path)}
                              whileHover={{ x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors text-xs relative",
                                isSubActive
                                  ? "bg-primary/10 text-primary dark:bg-primary/15 dark:text-blue-400 font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <SubIcon className={cn("w-3.5 h-3.5 flex-shrink-0", isSubActive ? "text-primary dark:text-blue-400" : "text-muted-foreground")} />
                              <span className={cn("truncate", isSubActive ? "text-primary dark:text-blue-400" : "text-foreground/75")}>
                                {subItem.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="px-3 py-3 border-t border-border/80 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm transition-colors",
            !isSidebarOpen && "justify-center"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {isSidebarOpen && <span>Logout</span>}
        </Button>
      </div>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={toggleTheme}
      className="relative"
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Terjadi kendala pada sistem Admin SUN89">
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

```

## 4. Model Data (Database Schema & Entities)

File: `server/src/database/db.ts`
```typescript
/**
 * SQLite Database Connection
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "../config/env";

const dbDir = path.dirname(CONFIG.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(CONFIG.DB_PATH);

// Enable foreign keys, WAL mode, and busy timeout for concurrent operations
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA busy_timeout = 5000;");

import { initializeSchema } from "./schema";
initializeSchema(db);

let inTransaction = false;

export function runInTransaction<T>(fn: () => T): T {
  if (inTransaction) {
    return fn();
  }
  inTransaction = true;
  db.exec("BEGIN TRANSACTION;");
  try {
    const result = fn();
    db.exec("COMMIT;");
    inTransaction = false;
    return result;
  } catch (err) {
    try {
      db.exec("ROLLBACK;");
    } catch {
      // ignore rollback errors if already aborted
    }
    inTransaction = false;
    throw err;
  }
}

export function closeDb(): void {
  try {
    db.close();
    console.log("[SUN89 Database] SQLite connection closed successfully.");
  } catch (err) {
    console.error("[SUN89 Database] Error closing database:", err);
  }
}


```

File: `server/src/database/schema.ts`
```typescript
/**
 * Database Schema Definitions and Initializer
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import type { DatabaseSync } from "node:sqlite";

export function initializeSchema(targetDb: DatabaseSync): void {
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      nama TEXT NOT NULL,
      jabatan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Aktif',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_no TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      nomor_hp TEXT NOT NULL,
      layanan TEXT NOT NULL,
      nopol TEXT NOT NULL,
      current_step INTEGER NOT NULL DEFAULT 1,
      current_stage_name TEXT NOT NULL DEFAULT 'Verifikasi',
      payment_status TEXT NOT NULL DEFAULT 'Belum Lunas',
      total_biaya REAL NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(current_stage_name);
    CREATE INDEX IF NOT EXISTS idx_orders_archived ON orders(is_archived);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer);

    CREATE TABLE IF NOT EXISTS samsat_pricing (
      id TEXT PRIMARY KEY,
      nama_item TEXT NOT NULL,
      kategori TEXT NOT NULL,
      tipe_kendaraan TEXT NOT NULL,
      biaya_dasar REAL NOT NULL DEFAULT 0,
      deskripsi TEXT,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wilayah_administratif (
      kode_kabupaten_kota TEXT PRIMARY KEY,
      kode_provinsi TEXT NOT NULL,
      nama_provinsi TEXT NOT NULL,
      nama_kabupaten_kota TEXT NOT NULL,
      jenis_wilayah TEXT NOT NULL CHECK(jenis_wilayah IN ('Kabupaten', 'Kota')),
      status_aktif INTEGER NOT NULL DEFAULT 1,
      sumber_referensi TEXT NOT NULL DEFAULT 'Kepmendagri No. 300.2.2-2138 Tahun 2025',
      tahun_referensi INTEGER NOT NULL DEFAULT 2025,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_wilayah_provinsi ON wilayah_administratif(kode_provinsi);
    CREATE INDEX IF NOT EXISTS idx_wilayah_nama ON wilayah_administratif(nama_kabupaten_kota);

    CREATE TABLE IF NOT EXISTS samsat_offices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      alamat TEXT,
      kode_kabupaten_kota TEXT,
      is_verified INTEGER NOT NULL DEFAULT 1,
      status_aktif INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (kode_kabupaten_kota) REFERENCES wilayah_administratif(kode_kabupaten_kota)
    );

    CREATE INDEX IF NOT EXISTS idx_samsat_wilayah ON samsat_offices(kode_kabupaten_kota);

    CREATE TABLE IF NOT EXISTS estimation_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      service_type TEXT NOT NULL,
      tipe_kendaraan TEXT NOT NULL,
      koefisien_denda REAL NOT NULL DEFAULT 0.48,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_estimation_service ON estimation_templates(service_type);
    CREATE INDEX IF NOT EXISTS idx_estimation_vehicle ON estimation_templates(tipe_kendaraan);

    CREATE TABLE IF NOT EXISTS finance_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      order_no TEXT NOT NULL,
      customer TEXT NOT NULL,
      layanan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      total_tagihan REAL NOT NULL DEFAULT 0,
      dibayar REAL NOT NULL DEFAULT 0,
      sisa REAL NOT NULL DEFAULT 0,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_order ON finance_invoices(order_no);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON finance_invoices(status);

    CREATE TABLE IF NOT EXISTS kas_kantor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      status TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      kredit REAL NOT NULL DEFAULT 0,
      saldo REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      kategori TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pengeluaran (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      nominal REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      kategori TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      nama_metode TEXT NOT NULL UNIQUE,
      bank TEXT NOT NULL,
      nama_rekening TEXT,
      nomor_rekening TEXT,
      status TEXT NOT NULL DEFAULT 'Aktif',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      order_no TEXT,
      invoice_id TEXT,
      document_type TEXT NOT NULL,
      original_name TEXT NOT NULL,
      storage_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_id TEXT,
      uploaded_by_role TEXT,
      metadata_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES finance_invoices(invoice_no) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_documents_order ON documents(order_no);
    CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_documents_storage_name ON documents(storage_name);

    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      recipient_emails TEXT NOT NULL DEFAULT '[]',
      notify_tagihan_reminder INTEGER NOT NULL DEFAULT 1,
      notify_tagihan_perubahan INTEGER NOT NULL DEFAULT 1,
      notify_order_update INTEGER NOT NULL DEFAULT 1,
      notify_proses_gagal INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      title TEXT NOT NULL,
      reference_no TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_notif_logs_created ON notification_logs(created_at);

    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS messenger_reimbursements (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      messenger_name TEXT NOT NULL,
      order_no TEXT,
      category TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      approved_amount REAL DEFAULT 0,
      rejected_amount REAL DEFAULT 0,
      date TEXT NOT NULL,
      note TEXT,
      receipt_url TEXT,
      receipt_name TEXT,
      status TEXT NOT NULL DEFAULT 'Diajukan',
      items_json TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT,
      paid_at TEXT,
      paid_by TEXT,
      payment_method TEXT,
      transaction_ref TEXT,
      pengeluaran_id INTEGER,
      kas_messenger_id INTEGER,
      channel TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_reimb_employee ON messenger_reimbursements(employee_id);
    CREATE INDEX IF NOT EXISTS idx_reimb_order ON messenger_reimbursements(order_no);
    CREATE INDEX IF NOT EXISTS idx_reimb_status ON messenger_reimbursements(status);

    CREATE TABLE IF NOT EXISTS kas_messenger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tanggal TEXT NOT NULL,
      jenis TEXT NOT NULL,
      messenger TEXT NOT NULL,
      keterangan TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      kredit REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      penanggung_jawab TEXT,
      order_no TEXT,
      reimbursement_id TEXT,
      receipt_url TEXT,
      kategori TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_kas_messenger_messenger ON kas_messenger(messenger);
    CREATE INDEX IF NOT EXISTS idx_kas_messenger_tanggal ON kas_messenger(tanggal);

    CREATE TABLE IF NOT EXISTS service_pricing_configs (
      id TEXT PRIMARY KEY,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      samsat_id TEXT NOT NULL,
      wilayah TEXT NOT NULL,
      biaya_jasa REAL NOT NULL DEFAULT 0,
      biaya_antar_jemput REAL NOT NULL DEFAULT 50000,
      data_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_service_pricing_service ON service_pricing_configs(service_id);
    CREATE INDEX IF NOT EXISTS idx_service_pricing_samsat ON service_pricing_configs(samsat_id);

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      user_id TEXT,
      request_hash TEXT NOT NULL,
      resource_id TEXT,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_idempotency_scope ON idempotency_keys(scope, key);

    CREATE TABLE IF NOT EXISTS invoice_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      order_no TEXT NOT NULL,
      nominal REAL NOT NULL CHECK(nominal > 0),
      metode_pembayaran TEXT NOT NULL,
      nama_bank TEXT,
      nomor_rekening TEXT,
      tanggal_bayar TEXT NOT NULL,
      document_id TEXT,
      kas_kantor_id INTEGER,
      status_verifikasi TEXT NOT NULL DEFAULT 'TERVERIFIKASI',
      idempotency_key TEXT UNIQUE,
      verified_by TEXT,
      verified_at TEXT,
      catatan TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_no) REFERENCES finance_invoices(invoice_no) ON DELETE CASCADE,
      FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE RESTRICT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
      FOREIGN KEY (kas_kantor_id) REFERENCES kas_kantor(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inv_payments_invoice ON invoice_payments(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_inv_payments_order ON invoice_payments(order_no);
    CREATE INDEX IF NOT EXISTS idx_inv_payments_idempotency ON invoice_payments(idempotency_key);
  `);

  migrateDocumentsTable(targetDb);
  migrateOrdersTable(targetDb);
  migrateFinanceInvoicesTable(targetDb);
  migrateKasKantorTable(targetDb);
  migratePengeluaranTable(targetDb);
  migrateUsersTable(targetDb);
  migrateKasMessengerTable(targetDb);
  migrateMessengerReimbursementsTable(targetDb);
  migrateIdempotencyKeysTable(targetDb);
  reconcileLegacyDocuments(targetDb);
  backfillHistoricalFinanceData(targetDb);

  targetDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
  `);
}

export function reconcileLegacyDocuments(targetDb: DatabaseSync): { matchedCount: number; unidentifiedCount: number } {
  try {
    const ordersStmt = targetDb.prepare("SELECT order_no, data_json FROM orders");
    const orderRows = ordersStmt.all() as { order_no: string; data_json: string }[];
    const linkStmt = targetDb.prepare(
      "UPDATE documents SET order_no = ?, updated_at = datetime('now') WHERE id = ? AND (order_no IS NULL OR order_no != ?)"
    );

    let linkedCount = 0;
    for (const orderRow of orderRows) {
      if (!orderRow.data_json || !orderRow.order_no) continue;
      const docIds = orderRow.data_json.match(/DOC-[A-Za-z0-9_-]+/g);
      if (docIds && docIds.length > 0) {
        const uniqueDocIds = [...new Set(docIds)];
        for (const docId of uniqueDocIds) {
          try {
            const info: any = linkStmt.run(orderRow.order_no, docId, orderRow.order_no);
            if (info?.changes > 0) {
              linkedCount += info.changes;
            }
          } catch {
            // Ignore single doc linking collision
          }
        }
      }
    }

    const unlinkedStmt = targetDb.prepare("SELECT COUNT(*) as count FROM documents WHERE order_no IS NULL");
    const unlinkedRow = unlinkedStmt.get() as { count: number };
    const linkedTotalStmt = targetDb.prepare("SELECT COUNT(*) as count FROM documents WHERE order_no IS NOT NULL");
    const linkedTotalRow = linkedTotalStmt.get() as { count: number };

    console.log(
      `[SUN89 Reconciliation] Documents linked to orders: ${linkedTotalRow?.count || 0} total (newly reconciled: ${linkedCount}), unidentified: ${unlinkedRow?.count || 0}`
    );

    return {
      matchedCount: linkedTotalRow?.count || 0,
      unidentifiedCount: unlinkedRow?.count || 0,
    };
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during document reconciliation:", err);
    return { matchedCount: 0, unidentifiedCount: 0 };
  }
}

function migrateDocumentsTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(documents)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));

    // Check if foreign keys are already applied
    const foreignKeys = targetDb.prepare("PRAGMA foreign_key_list(documents)").all() as { table: string }[];
    const hasOrderFk = foreignKeys.some((fk) => fk.table === "orders");
    const hasInvoiceFk = foreignKeys.some((fk) => fk.table === "finance_invoices");

    if (!hasOrderFk || !hasInvoiceFk || !columnNames.has("is_active") || !columnNames.has("updated_at")) {
      // Validate & clean existing references safely before applying foreign keys
      targetDb.exec(`
        UPDATE documents SET order_no = NULL 
        WHERE order_no IS NOT NULL AND order_no NOT IN (SELECT order_no FROM orders);

        UPDATE documents SET invoice_id = NULL 
        WHERE invoice_id IS NOT NULL AND invoice_id NOT IN (SELECT invoice_no FROM finance_invoices);
      `);

      const isActiveExpr = columnNames.has("is_active") ? "COALESCE(is_active, 1)" : "1";
      const updatedAtExpr = columnNames.has("updated_at") ? "COALESCE(updated_at, created_at)" : "created_at";

      // Recreate table with foreign key constraints
      targetDb.exec(`
        CREATE TABLE documents_migrated (
          id TEXT PRIMARY KEY,
          order_no TEXT,
          invoice_id TEXT,
          document_type TEXT NOT NULL,
          original_name TEXT NOT NULL,
          storage_name TEXT NOT NULL UNIQUE,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          uploaded_by TEXT NOT NULL,
          uploaded_by_id TEXT,
          uploaded_by_role TEXT,
          metadata_json TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (order_no) REFERENCES orders(order_no) ON DELETE SET NULL,
          FOREIGN KEY (invoice_id) REFERENCES finance_invoices(invoice_no) ON DELETE SET NULL
        );

        INSERT INTO documents_migrated (
          id, order_no, invoice_id, document_type, original_name,
          storage_name, mime_type, size_bytes, sha256,
          uploaded_by, uploaded_by_id, uploaded_by_role, metadata_json,
          is_active, created_at, updated_at
        )
        SELECT
          id, order_no, invoice_id, document_type, original_name,
          storage_name, mime_type, size_bytes, sha256,
          uploaded_by, uploaded_by_id, uploaded_by_role, metadata_json,
          ${isActiveExpr}, created_at, ${updatedAtExpr}
        FROM documents;

        DROP TABLE documents;
        ALTER TABLE documents_migrated RENAME TO documents;

        CREATE INDEX IF NOT EXISTS idx_documents_order ON documents(order_no);
        CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_documents_storage_name ON documents(storage_name);
        CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
      `);
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during documents table migration:", err);
  }
}

function migrateOrdersTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("biaya_antar_jemput")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN biaya_antar_jemput REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("biaya_jasa")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN biaya_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("nama_penerima_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN nama_penerima_keluar TEXT;");
    }
    if (!columnNames.has("bank_uang_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN bank_uang_keluar TEXT;");
    }
    if (!columnNames.has("metode_pembayaran_keluar")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN metode_pembayaran_keluar TEXT;");
    }
    if (!columnNames.has("alasan_pending")) {
      targetDb.exec("ALTER TABLE orders ADD COLUMN alasan_pending TEXT;");
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during orders table migration:", err);
  }
}

function migrateFinanceInvoicesTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(finance_invoices)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("biaya_antar_jemput")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_antar_jemput REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("biaya_jasa")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("nama_penerima_keluar")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN nama_penerima_keluar TEXT;");
    }
    if (!columnNames.has("biaya_samsat")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN biaya_samsat REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("pendapatan_jasa")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN pendapatan_jasa REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("overpayment")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN overpayment REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("settlement_condition")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN settlement_condition TEXT NOT NULL DEFAULT 'BALANCED';");
    }
    if (!columnNames.has("refund_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'NONE';");
    }
    if (!columnNames.has("cashback_nominal")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_nominal REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("cashback_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_status TEXT NOT NULL DEFAULT 'PENDING';");
    }
    if (!columnNames.has("cashback_doc_id")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN cashback_doc_id TEXT;");
    }
    if (!columnNames.has("profit_final")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN profit_final REAL NOT NULL DEFAULT 0;");
    }
    if (!columnNames.has("profit_status")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN profit_status TEXT NOT NULL DEFAULT 'PENDING';");
    }
    if (!columnNames.has("alasan_pending")) {
      targetDb.exec("ALTER TABLE finance_invoices ADD COLUMN alasan_pending TEXT;");
    }

    targetDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_invoices_settlement ON finance_invoices(settlement_condition);
      CREATE INDEX IF NOT EXISTS idx_invoices_profit_status ON finance_invoices(profit_status);
      CREATE INDEX IF NOT EXISTS idx_invoices_cashback_status ON finance_invoices(cashback_status);
    `);
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during finance_invoices table migration:", err);
  }
}

function migrateKasKantorTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(kas_kantor)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("penanggung_jawab")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN penanggung_jawab TEXT;");
    }
    if (!columnNames.has("order_no")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN order_no TEXT;");
    }
    if (!columnNames.has("invoice_no")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN invoice_no TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE kas_kantor ADD COLUMN kategori TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_kas_kantor_order ON kas_kantor(order_no);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during kas_kantor table migration:", err);
  }
}

function migratePengeluaranTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(pengeluaran)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("penanggung_jawab")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN penanggung_jawab TEXT;");
    }
    if (!columnNames.has("order_no")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN order_no TEXT;");
    }
    if (!columnNames.has("invoice_no")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN invoice_no TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE pengeluaran ADD COLUMN kategori TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_pengeluaran_order ON pengeluaran(order_no);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during pengeluaran table migration:", err);
  }
}

function migrateUsersTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("phone")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN phone TEXT;");
    }
    if (!columnNames.has("wilayah")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN wilayah TEXT;");
    }
    if (!columnNames.has("employee_id")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN employee_id TEXT;");
    }
    if (!columnNames.has("alamat")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN alamat TEXT;");
    }
    if (!columnNames.has("tanggal_lahir")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN tanggal_lahir TEXT;");
    }
    if (!columnNames.has("gaji_pokok")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN gaji_pokok REAL DEFAULT 0;");
    }
    if (!columnNames.has("tanggal_bergabung")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN tanggal_bergabung TEXT;");
    }
    if (!columnNames.has("jenis_kelamin")) {
      targetDb.exec("ALTER TABLE users ADD COLUMN jenis_kelamin TEXT;");
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during users table migration:", err);
  }
}

function migrateKasMessengerTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(kas_messenger)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("reimbursement_id")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN reimbursement_id TEXT;");
    }
    if (!columnNames.has("receipt_url")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN receipt_url TEXT;");
    }
    if (!columnNames.has("kategori")) {
      targetDb.exec("ALTER TABLE kas_messenger ADD COLUMN kategori TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_kas_messenger_reimb ON kas_messenger(reimbursement_id);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during kas_messenger table migration:", err);
  }
}

function migrateMessengerReimbursementsTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(messenger_reimbursements)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("kas_messenger_id")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN kas_messenger_id INTEGER;");
    }
    if (!columnNames.has("channel")) {
      targetDb.exec("ALTER TABLE messenger_reimbursements ADD COLUMN channel TEXT;");
    }
    targetDb.exec("CREATE INDEX IF NOT EXISTS idx_reimb_kas_msg ON messenger_reimbursements(kas_messenger_id);");
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during messenger_reimbursements table migration:", err);
  }
}

function migrateIdempotencyKeysTable(targetDb: DatabaseSync): void {
  try {
    const tableInfo = targetDb.prepare("PRAGMA table_info(idempotency_keys)").all() as { name: string }[];
    if (!tableInfo || tableInfo.length === 0) return;

    const columnNames = new Set(tableInfo.map((c) => c.name));
    if (!columnNames.has("user_id")) {
      targetDb.exec("ALTER TABLE idempotency_keys ADD COLUMN user_id TEXT;");
    }
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during idempotency_keys table migration:", err);
  }
}

export interface BackfillHistoricalFinanceResult {
  backfilledInvoices: number;
  backfilledPayments: number;
  kasKantorStats: {
    mapped: number;
    unmatched: number;
    ambiguous: number;
    remainingEmpty: number;
  };
  pengeluaranStats: {
    mapped: number;
    unmatched: number;
    ambiguous: number;
    remainingEmpty: number;
  };
}

export function backfillHistoricalFinanceData(targetDb: DatabaseSync): BackfillHistoricalFinanceResult {
  const result: BackfillHistoricalFinanceResult = {
    backfilledInvoices: 0,
    backfilledPayments: 0,
    kasKantorStats: { mapped: 0, unmatched: 0, ambiguous: 0, remainingEmpty: 0 },
    pengeluaranStats: { mapped: 0, unmatched: 0, ambiguous: 0, remainingEmpty: 0 },
  };

  try {
    // 1. Gather all known valid orders and invoices for strict relational verification
    const knownOrders = new Set<string>();
    const ordRows = targetDb.prepare("SELECT order_no FROM orders").all() as { order_no: string }[];
    for (const r of ordRows) {
      if (r.order_no) knownOrders.add(r.order_no);
    }

    const knownInvoices = new Map<string, string | null>();
    const invRows = targetDb.prepare("SELECT invoice_no, order_no FROM finance_invoices").all() as { invoice_no: string; order_no: string | null }[];
    for (const r of invRows) {
      if (r.invoice_no) knownInvoices.set(r.invoice_no, r.order_no || null);
    }

    // 2. Backfill finance_invoices & invoice_payments (existing idempotent logic)
    const invStmt = targetDb.prepare("SELECT id, invoice_no, order_no, total_tagihan, dibayar, sisa, status, data_json, created_at FROM finance_invoices");
    const invoices = invStmt.all() as any[];

    const updateInvStmt = targetDb.prepare(`
      UPDATE finance_invoices SET
        biaya_samsat = ?,
        pendapatan_jasa = ?,
        overpayment = ?,
        settlement_condition = ?,
        refund_status = ?,
        cashback_nominal = ?,
        cashback_status = ?,
        profit_final = ?,
        profit_status = ?
      WHERE id = ?
    `);

    const insertPaymentStmt = targetDb.prepare(`
      INSERT OR IGNORE INTO invoice_payments (
        invoice_no, order_no, nominal, metode_pembayaran, nama_bank,
        nomor_rekening, tanggal_bayar, document_id, status_verifikasi,
        idempotency_key, verified_by, verified_at, catatan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const inv of invoices) {
      let parsedJson: any = {};
      try {
        parsedJson = JSON.parse(inv.data_json || "{}");
      } catch {}

      const biayaSamsat = Number(parsedJson.biayaSamsat || parsedJson.biaya_samsat || 0);
      const totalTagihan = Number(inv.total_tagihan || parsedJson.totalTagihan || 0);
      const pendapatanJasa = Math.max(0, totalTagihan - biayaSamsat);
      const overpayment = Number(parsedJson.overpayment || 0);
      const settlementCondition = parsedJson.settlementCondition || (inv.status === "Lunas" ? "BALANCED" : "UNDERPAID");
      const refundStatus = parsedJson.refundStatus || "NONE";
      const cashbackNominal = Number(parsedJson.cashback || parsedJson.jumlahCashback || 0);
      const cashbackStatus = parsedJson.cashbackStatus || (cashbackNominal > 0 ? "PENDING" : "APPROVED");
      const profitFinal = Number(parsedJson.profit || 0);
      const profitStatus = parsedJson.profitStatus || (inv.status === "Lunas" ? "REALIZED" : "PENDING");

      updateInvStmt.run(
        biayaSamsat,
        pendapatanJasa,
        overpayment,
        settlementCondition,
        refundStatus,
        cashbackNominal,
        cashbackStatus,
        profitFinal,
        profitStatus,
        inv.id
      );
      result.backfilledInvoices++;

      // Check if order has paymentRecords
      let orderJson: any = {};
      if (inv.order_no) {
        try {
          const ordRow = targetDb.prepare("SELECT data_json FROM orders WHERE order_no = ?").get(inv.order_no) as any;
          if (ordRow?.data_json) orderJson = JSON.parse(ordRow.data_json);
        } catch {}
      }

      const pRecords = orderJson?.payment?.paymentRecords || parsedJson?.paymentRecords || [];
      if (Array.isArray(pRecords) && pRecords.length > 0) {
        for (const pr of pRecords) {
          const nominal = Number(pr.nominal || 0);
          if (nominal <= 0) continue;
          const key = `BACKFILL-${inv.invoice_no}-${pr.id || nominal}-${pr.tanggal || "init"}`;
          insertPaymentStmt.run(
            inv.invoice_no,
            inv.order_no,
            nominal,
            pr.metodePembayaran || pr.metode || "Transfer BCA",
            pr.namaBank || null,
            pr.noRekening || null,
            pr.tanggal || inv.created_at || new Date().toISOString(),
            pr.buktiPembayaran?.documentId || null,
            pr.statusVerifikasi || "TERVERIFIKASI",
            key,
            pr.verifiedBy || "System Migration",
            pr.verifiedAt || new Date().toISOString(),
            pr.catatan || "Migrasi historis payment record"
          );
          result.backfilledPayments++;
        }
      } else if (Number(inv.dibayar || 0) > 0) {
        // Synthesize single historical payment for existing balance
        const nominal = Number(inv.dibayar);
        const key = `BACKFILL-${inv.invoice_no}-INIT`;
        insertPaymentStmt.run(
          inv.invoice_no,
          inv.order_no,
          nominal,
          parsedJson.metodePembayaran || "Transfer Bank",
          parsedJson.bank || null,
          null,
          parsedJson.tanggalBayar || inv.created_at || new Date().toISOString(),
          null,
          "TERVERIFIKASI",
          key,
          "System Migration",
          new Date().toISOString(),
          "Saldo terbayar historis awal"
        );
        result.backfilledPayments++;
      }
    }

    // 3. Backfill kas_kantor relations (order_no, invoice_no)
    const updateKasStmt = targetDb.prepare(`
      UPDATE kas_kantor SET
        order_no = COALESCE(order_no, ?),
        invoice_no = COALESCE(invoice_no, ?)
      WHERE id = ?
    `);

    const kasRows = targetDb.prepare("SELECT id, keterangan, order_no, invoice_no FROM kas_kantor").all() as any[];
    for (const row of kasRows) {
      if (row.order_no && row.invoice_no) {
        continue;
      }

      const text = row.keterangan || "";
      const invMatches = Array.from(new Set(text.match(/\bINV-[A-Za-z0-9_-]+\b/g) || []));
      const rawOrdMatches = Array.from(new Set(text.match(/\bORD-[0-9]+\b/g) || []));
      const ordMatches = rawOrdMatches.filter((ord) => !invMatches.some((inv) => inv.includes(ord)));

      if (invMatches.length > 1 || ordMatches.length > 1) {
        result.kasKantorStats.ambiguous++;
      } else if (invMatches.length === 1) {
        const invNo = invMatches[0];
        if (knownInvoices.has(invNo)) {
          const ordNo = knownInvoices.get(invNo) || (ordMatches.length === 1 && knownOrders.has(ordMatches[0]) ? ordMatches[0] : null);
          updateKasStmt.run(ordNo, invNo, row.id);
          result.kasKantorStats.mapped++;
        } else {
          result.kasKantorStats.unmatched++;
        }
      } else if (ordMatches.length === 1) {
        const ordNo = ordMatches[0];
        if (knownOrders.has(ordNo)) {
          updateKasStmt.run(ordNo, null, row.id);
          result.kasKantorStats.mapped++;
        } else {
          result.kasKantorStats.unmatched++;
        }
      } else {
        result.kasKantorStats.remainingEmpty++;
      }
    }

    // 4. Backfill pengeluaran relations (order_no, invoice_no)
    const updatePengeluaranStmt = targetDb.prepare(`
      UPDATE pengeluaran SET
        order_no = COALESCE(order_no, ?),
        invoice_no = COALESCE(invoice_no, ?)
      WHERE id = ?
    `);

    const pengeluaranRows = targetDb.prepare("SELECT id, keterangan, order_no, invoice_no FROM pengeluaran").all() as any[];
    for (const row of pengeluaranRows) {
      if (row.order_no && row.invoice_no) {
        continue;
      }

      const text = row.keterangan || "";
      const invMatches = Array.from(new Set(text.match(/\bINV-[A-Za-z0-9_-]+\b/g) || []));
      const rawOrdMatches = Array.from(new Set(text.match(/\bORD-[0-9]+\b/g) || []));
      const ordMatches = rawOrdMatches.filter((ord) => !invMatches.some((inv) => inv.includes(ord)));

      if (invMatches.length > 1 || ordMatches.length > 1) {
        result.pengeluaranStats.ambiguous++;
      } else if (invMatches.length === 1) {
        const invNo = invMatches[0];
        if (knownInvoices.has(invNo)) {
          const ordNo = knownInvoices.get(invNo) || (ordMatches.length === 1 && knownOrders.has(ordMatches[0]) ? ordMatches[0] : null);
          updatePengeluaranStmt.run(ordNo, invNo, row.id);
          result.pengeluaranStats.mapped++;
        } else {
          result.pengeluaranStats.unmatched++;
        }
      } else if (ordMatches.length === 1) {
        const ordNo = ordMatches[0];
        if (knownOrders.has(ordNo)) {
          updatePengeluaranStmt.run(ordNo, null, row.id);
          result.pengeluaranStats.mapped++;
        } else {
          result.pengeluaranStats.unmatched++;
        }
      } else {
        result.pengeluaranStats.remainingEmpty++;
      }
    }

    if (
      result.backfilledInvoices > 0 ||
      result.backfilledPayments > 0 ||
      result.kasKantorStats.mapped > 0 ||
      result.pengeluaranStats.mapped > 0
    ) {
      console.log(
        `[SUN89 Migration] Backfill completed: ` +
        `${result.backfilledInvoices} invoices, ${result.backfilledPayments} payments, ` +
        `KasKantor[mapped=${result.kasKantorStats.mapped}, unmatched=${result.kasKantorStats.unmatched}, ambig=${result.kasKantorStats.ambiguous}, empty=${result.kasKantorStats.remainingEmpty}], ` +
        `Pengeluaran[mapped=${result.pengeluaranStats.mapped}, unmatched=${result.pengeluaranStats.unmatched}, ambig=${result.pengeluaranStats.ambiguous}, empty=${result.pengeluaranStats.remainingEmpty}]`
      );
    }
    return result;
  } catch (err) {
    console.warn("[SUN89 Migration] Warning during finance backfill:", err);
    return result;
  }
}

```

File: `src/domain/order/types.ts`
```typescript
/**
 * Canonical Domain Types for Orders
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import { OrderCostBreakdownItem, OrderCostSnapshot } from "../pricing/types";
import type {
  MessengerComponentProgress,
  TaskPriority,
  ChecklistSebelumBerangkat,
  PickupProof,
  DeliveryHandoverProof,
  MessengerTimelineEvent,
} from "../messenger/types";

export interface StructuredAddress {
  kota: string;
  kecamatan: string;
  kelurahan: string;
  detail: string;
  rtRw: string;
  nomor: string;
  landmark: string;
  mapsUrl?: string;
}

export interface OrderDocument {
  name: string;
  status: "Sudah Tersedia" | "Belum Tersedia" | "Baru Diupload" | "Diperbarui";
  updatedAt?: string;
  isOptional?: boolean;
  fileType?: "image" | "pdf" | string;
  fileUrl?: string;
  fileSize?: string;
  documentId?: string;
}

export interface SamsatProcessItem {
  id: string;
  name: string;
  category: "Mutasi Keluar" | "Mutasi Masuk" | "Layanan Standar";
  status: "Selesai" | "Sedang Diproses" | "Belum Diproses";
  completedAt?: string;
  basePrice: number;
  actualCost?: number;
}

export interface PaymentProof {
  fileName: string;
  fileType: "image" | "pdf";
  fileUrl?: string;
  uploadedAt: string;
  fileSize?: string;
  documentId?: string;
}

export type SettlementCondition =
  | "PENDING_FINALIZATION"
  | "BALANCED"
  | "UNDERPAID"
  | "OVERPAID"
  | "SETTLED";

export type RefundStatus = "NONE" | "PENDING" | "PROCESSED";

export interface DocumentApprovalMetadata {
  stage5Verified: boolean;
  stage5VerifiedBy?: string;
  stage5VerifiedAt?: string;
  stage6Approved: boolean;
  stage6ApprovedBy?: string;
  stage6ApprovedAt?: string;
  approvedDocsSnapshot?: string[];
}

export interface RekapDocument {
  id: string;
  orderId: string;
  phase: "BEFORE" | "AFTER";
  documentType: "STNK" | "BPKB" | "SKKP" | "OTHER";
  label: string;
  fileType: "IMAGE" | "PDF";
  fileUrl: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PaymentCorrectionHistoryItem {
  nominalLama: number;
  nominalBaru: number;
  tanggal: string;
  admin: string;
  catatan?: string;
}

export interface PaymentRecordItem {
  id: string;
  nominal: number;
  tanggal: string;
  metodePembayaran: string;
  namaBank?: string;
  namaRekening?: string;
  noRekening?: string;
  buktiPembayaran?: PaymentProof;
  statusVerifikasi: "MENUNGGU_BUKTI" | "MENUNGGU_VERIFIKASI" | "TERVERIFIKASI" | "DITOLAK";
  verifiedAt?: string;
  verifiedBy?: string;
  alasanPenolakan?: string;
  catatan?: string;
  uploadedBy?: string;
}

export interface OrderPayment {
  tipePembayaran: "Bayar di Awal" | "Bayar di Akhir" | "Tempo";
  metodePembayaran: string;
  statusPembayaran: "Lunas" | "Belum Bayar" | "Kurang Bayar" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang";
  totalBiaya: number;
  totalEstimasi?: number;
  dibayar: number;
  kurang: number;
  overpayment?: number;
  nominalDibayarAwal?: number;
  nominalPembayaranAwalTerkonfirmasi?: number;
  riwayatKoreksiPembayaran?: PaymentCorrectionHistoryItem[];
  paymentRecords?: PaymentRecordItem[];
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundProcessedAt?: string;
  refundProcessedBy?: string;
  tanggalBayar?: string;
  namaBank?: string;
  namaRekening?: string;
  noRekening?: string;
  buktiPembayaran?: PaymentProof;
  isPaymentVerified?: boolean;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  invoiceNo?: string;
}

export interface AdditionalProcessItem {
  id: string;
  name: string;
  category?: string;
  note?: string;
  nominal: number;
  status: "DILAPORKAN_MENUNGGU_REVIEW" | "DISETUJUI" | "DITOLAK";
  reportedBy: string;
  reportedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface CustomCostItem {
  id: string;
  name: string;
  category: "Mutasi Keluar" | "Mutasi Masuk" | "Lainnya";
  actualCost: number;
  basePrice: number;
}

export interface OperationalOrder {
  orderNo: string;
  clientRequestId?: string;
  customer: string;
  nomorHP: string;
  layanan: string;
  currentStep: number; // 1 to 8
  currentStageName: string;
  catatanOrder?: string;
  createdAt: string;
  tanggalMasukBerkas?: string;
  tanggalPengeluaranSamsat?: string;

  // Data Pemilik & Kendaraan
  namaPemilik: string;
  kepemilikanKendaraan: string;
  jenisKendaraan: string;
  tahunKendaraan: number | string;
  nopol: string;
  pkbBerlakuSd: string;
  tahunPajak: string;
  bulanPajak: string;
  nominalPkbTerakhir: number;
  nominalSwdkllj: number;
  kodePromo?: string;
  wilayahSamsatAsal: string;
  wilayahSamsatTujuan?: string;

  // Alamat Terstruktur
  alamatPenjemputan: StructuredAddress;
  alamatPengantaran: StructuredAddress;

  // Dokumen
  clientDocuments: Record<string, OrderDocument>;
  updatedDocuments: string[]; // Hasil Samsat
  documentNotes?: string;
  documentsVerified?: boolean;
  documentApproval?: DocumentApprovalMetadata;

  // Estimasi Biaya
  biayaJasa: number;
  biayaAntarJemput?: number;
  pkb: number;
  swdkllj: number;
  dendaSwdkllj: number;
  totalEstimasi: number;

  // Metadata Pengeluaran Samsat
  namaPenerimaKeluar?: string;
  bankUangKeluar?: string;
  metodePembayaranKeluar?: string;

  // Biaya Final Aktual (Stage 5 & 6)
  finalBiayaJasa?: number;
  finalPkb?: number;
  finalSwdkllj?: number;
  finalDendaSwdkllj?: number;
  finalMutasiKeluar?: number;
  finalMutasiMasuk?: number;
  finalBiayaLainnya?: number;
  customCostItems?: CustomCostItem[];
  keteranganMutasiKeluar?: string;
  keteranganMutasiMasuk?: string;
  keteranganBiayaLainnya?: string;
  isVerified?: boolean;

  // Penjadwalan Jemput (Stage 2)
  tanggalJemput?: string;
  messenger?: string;
  assignedMessengerId?: string;
  assignedMessengerName?: string;
  catatanPenjadwalan?: string;
  isScheduled?: boolean;
  pickupCompleted?: boolean;
  pickupCompletedAt?: string;

  // Samsat Tracking & Field Operation (Stage 4)
  samsatProcesses: SamsatProcessItem[];
  currentSamsatProcess?: string;
  isSamsatScheduled?: boolean;
  tanggalProsesSamsat?: string;
  samsatMessenger?: string;
  samsatMessengerId?: string;
  catatanSamsat?: string;
  samsatStatus?: "Terjadwal Samsat" | "Menuju Samsat" | "Sedang Proses Samsat" | "Selesai" | string;
  samsatSubstatus?: string;
  samsatJourneyStartedAt?: string;
  samsatArrivedAt?: string;
  samsatCompletedAt?: string;
  additionalProcesses?: AdditionalProcessItem[];

  // Penjemputan Dokumen Hasil Samsat (Bagian E)
  samsatPickupMessenger?: string;
  samsatPickupMessengerId?: string;
  samsatPickupStatus?: "Belum Dijadwal" | "Terjadwal" | "Sedang Jemput Dokumen Samsat" | "Dokumen Samsat Diterima di Kantor" | string;
  samsatPickupStartedAt?: string;
  samsatPickupCompletedAt?: string;
  samsatPickupNotes?: string;

  // Supervisi SPV
  approvedBySpv?: boolean;
  spvNotes?: string;
  spvName?: string;
  spvApprovedAt?: string;

  // Pengantaran Dokumen (Stage 7)
  tanggalPengantaran?: string;
  messengerPengantar?: string;
  catatanPengantaran?: string;
  isDeliveryScheduled?: boolean;
  deliveryStartedAt?: string;
  deliveryStatus?: string;

  // Dokumen Telah Diterima (Stage 8)
  tanggalDiterima?: string;
  isReceived?: boolean;
  receiverName?: string;

  // Pembayaran
  payment: OrderPayment;

  // Back-office Order Source & Creator
  orderSource?: "Offline / Loket" | "Walk-in" | "Telepon / WA" | string;
  createdBy?: string;
  createdById?: string;
  createdByRole?: string;

  // Stage 1 Verification Metadata
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;

  // Messenger Task Overrides / Status
  messengerTaskStatus?: "Belum Diambil" | "Dalam Proses" | "Selesai" | "Pending" | "Dibatalkan" | "Dokumen Sudah Tersedia" | "Sedang Dijemput" | "Terjadwal Jemput";
  messengerTaskNotes?: string;
  catatanKendala?: string;
  pickupChecklist?: Record<string, boolean>;
  messengerTaskPriority?: TaskPriority;
  messengerComponentProgress?: Record<string, MessengerComponentProgress>;
  messengerTimeline?: MessengerTimelineEvent[];
  checklistSebelumBerangkat?: ChecklistSebelumBerangkat;
  pickupProof?: PickupProof;
  deliveryHandover?: DeliveryHandoverProof;
  deliveryProof?: any;
  metodePengantaran?: string;
  samsatMessengerNama?: string;
  samsatPickupMessengerNama?: string;
  samsatPickupDate?: string;
  deadlineAt?: string;
  startedAt?: string;

  // Master Pricing Snapshot & Service Method (Batch 5)
  metodeLayanan?: "Antar Jemput" | "Datang Langsung";
  costBreakdown?: OrderCostBreakdownItem[];
  costSnapshot?: OrderCostSnapshot;
  estimationResult?: any;

  // Final Cost Reconciliation & Rekap Order
  finalCost?: number;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  rekapDocuments?: RekapDocument[];
  completedAt?: string;
}

export const STAGES = [
  "Verifikasi",
  "Penjadwalan",
  "Verifikasi Dokumen",
  "Proses Samsat",
  "Verifikasi Ulang",
  "Supervisi",
  "Pengantaran",
  "Dokumen Telah Diterima",
] as const;

export type StageName = typeof STAGES[number];

export function getDefaultSamsatProcesses(layanan: string, isFinished: boolean = false): SamsatProcessItem[] {
  // If not finished and no active processes configured, start empty so new orders don't show phantom processes
  if (!isFinished) {
    return [];
  }

  if (layanan.includes("Mutasi Keluar")) {
    return [
      { id: "mk-1", name: "Cek Blokir Kendaraan", category: "Mutasi Keluar", status: "Selesai", completedAt: "09:30", basePrice: 30000, actualCost: 30000 },
      { id: "mk-2", name: "Cek Fisik Bantuan & Hadir", category: "Mutasi Keluar", status: "Selesai", completedAt: "10:15", basePrice: 80000, actualCost: 80000 },
      { id: "mk-3", name: "Legalisir Hadir & CF", category: "Mutasi Keluar", status: "Selesai", completedAt: "11:00", basePrice: 60000, actualCost: 60000 },
      { id: "mk-4", name: "Loket Pembukuan & TU", category: "Mutasi Keluar", status: "Selesai", completedAt: "13:00", basePrice: 45000, actualCost: 45000 },
      { id: "mk-5", name: "Cetak SKP & Fiskal Antar Daerah", category: "Mutasi Keluar", status: "Selesai", completedAt: "14:20", basePrice: 70000, actualCost: 75000 },
      { id: "mk-6", name: "Loket Arsip & Pengeluaran Berkas", category: "Mutasi Keluar", status: "Selesai", completedAt: "15:00", basePrice: 40000, actualCost: 40000 },
    ];
  }

  if (layanan.includes("Mutasi Masuk")) {
    return [
      { id: "mm-1", name: "Pendaftaran Berkas Mutasi Masuk", category: "Mutasi Masuk", status: "Selesai", completedAt: "08:45", basePrice: 50000, actualCost: 50000 },
      { id: "mm-2", name: "Cek Fisik Ulang & Pengesahan", category: "Mutasi Masuk", status: "Selesai", completedAt: "10:00", basePrice: 80000, actualCost: 80000 },
      { id: "mm-3", name: "Penetapan Pajak Baru (Bapenda)", category: "Mutasi Masuk", status: "Selesai", completedAt: "11:30", basePrice: 0, actualCost: 0 },
      { id: "mm-4", name: "Penerbitan BPKB Baru (Polda)", category: "Mutasi Masuk", status: "Selesai", completedAt: "13:30", basePrice: 225000, actualCost: 225000 },
      { id: "mm-5", name: "Penerbitan STNK & TNKB Plat Baru", category: "Mutasi Masuk", status: "Selesai", completedAt: "15:00", basePrice: 100000, actualCost: 100000 },
    ];
  }

  return [];
}

```

File: `src/domain/finance/types.ts`
```typescript
/**
 * Canonical Domain Types for Finance, Invoicing, and Accounting
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

import { SettlementCondition, RefundStatus } from "../order/types";

export type PaymentStatus = "Belum Bayar" | "Kurang Bayar" | "Lunas" | "Kelebihan Bayar";
export type RealizationStatus = "PENDING" | "REALIZED";
export type BillingLifecycleStatus = "ACTIVE" | "COMPLETED";

export type PaymentDueTrigger = "IMMEDIATE" | "AFTER_DOCUMENT_RECEIVED";
export type CollectionState = "BELUM_JATUH_TEMPO" | "JATUH_TEMPO" | "LUNAS";

export interface PaymentSyncPayload {
  orderNo: string;
  statusPembayaran: "Lunas" | "Belum Bayar" | "Kurang Bayar" | "Kelebihan Bayar" | "Belum Lunas" | "Kurang";
  dibayar: number;
  kurang: number;
  totalBiaya: number;
  tanggalBayar?: string;
  metodePembayaran?: string;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  overpayment?: number;
}

export type PaymentSyncCallback = (payload: PaymentSyncPayload) => void;

export interface InvoiceBillingRecord {
  id: number;
  tanggal: string;
  customer: string;
  nopol: string;
  jenisLayanan: string;
  layanan?: string;
  totalTagihan: number;
  terbayar: number;
  dibayar?: number;
  sisa: number;
  status: PaymentStatus;
  billingStatus?: BillingLifecycleStatus; // "ACTIVE" for active tagihan, "COMPLETED" when finalized
  completedAt?: string;
  completedBy?: string;
  jatuhTempo: string;
  invoice: string;
  invoiceNo?: string;
  orderNo?: string;
  namaBerkas?: string;
  samsat?: string;
  r4r2?: "R4" | "R2";
  tandaTerima?: string;
  bpkb?: string;
  ttbBPKB?: string;

  // Customer Contact Details
  phone?: string;
  email?: string;
  alamat?: string;

  // Realization Tracking
  biayaSamsat: number;
  profit: number;
  profitStatus: RealizationStatus;
  cashback: number;
  cashbackPersen?: string | number;
  cashbackStatus: RealizationStatus;

  // Cash Realization into Kas Kantor (Guarantees no duplicate cash inflow)
  isCashRealized: boolean;
  cashRecordedAmount: number; // Cumulative amount already debited to Kas Kantor
  tanggalBayar?: string;
  metodePembayaran?: string;
  bank?: string;
  alasanPending?: string;
  keterangan?: string;

  // Final Cost Reconciliation & Collection Status
  dueTrigger?: PaymentDueTrigger;
  collectionStatus?: CollectionState;
  settlementCondition?: SettlementCondition;
  refundStatus?: RefundStatus;
  overpayment?: number;
}

export type PenjualanContractCategory =
  | "mutasi-ld"
  | "mutasi-as"
  | "bbn"
  | "perpanjangan-pajak"
  | "lain-lain"
  | "belum-kurang-bayar"
  | "profit-terpending"
  | "cashback-terpending";

export interface ProfitItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  rekening: string;
  invoice: string;
  tanggalTTB: string;
  ttb: string;
  jemputDokumen?: string;
  prosesSamsat?: string;
  pengantaranKembali?: string;
  metodePembayaran?: string;
  // 4 Structured disbursement fields (Decision 4)
  metodePencairan?: "Cash" | "Transfer Bank" | string;
  namaBank?: string;
  nomorRekening?: string;
  namaPemilikRekening?: string;
  bank?: string;
  namaRekening?: string;
  noRekening?: string;
  tanggalBayar?: string;
  tanggalUangMasuk?: string;
  status?: string;
}

export interface KasMessengerItem {
  id: number;
  tanggal: string;
  jenis: string;
  messenger: string;
  keterangan: string;
  in: number;
  out: number;
  total: number;
  penanggungJawab?: string;
  orderNo?: string;
  reimbursementId?: string;
  receiptUrl?: string;
  kategori?: string;
}

export interface KasKantorItem {
  id: number;
  tanggal: string;
  status: string;
  keterangan: string;
  debit: number;
  kredit: number;
  total: number;
  invoiceRef?: string;
  penanggungJawab?: string;
}

export interface PengeluaranItem {
  id: number;
  tanggal: string;
  keterangan: string;
  nominal: number;
  penanggungJawab?: string;
}

export interface BelumKurangBayarItem {
  id: number;
  tanggal: string;
  nopol: string;
  customer: string;
  namaBerkas: string;
  pengurusan: string;
  uangMasuk: number;
  biayaSamsat: number;
  profit: number;
  status: string;
  invoice: string;
  sisaPembayaran: number;
  jatuhTempo: string;
}

export function derivePaymentStatus(totalTagihan: number, terbayar: number): PaymentStatus {
  if (terbayar <= 0) return "Belum Bayar";
  if (terbayar < totalTagihan) return "Kurang Bayar";
  if (terbayar > totalTagihan) return "Kelebihan Bayar";
  return "Lunas";
}

```

File: `src/domain/user/types.ts`
```typescript
/**
 * Canonical Domain Types for Users, Roles, and Access Management
 * Admin SUN89 ÔÇö Biro Jasa Management System
 */

export type UserRole = "administrator" | "finance" | "admin" | "messenger" | "SVP" | "CLILEN" | string;

export interface SystemUser {
  id: number | string;
  nama: string;
  jabatan: string;
  email: string;
  status: "Aktif" | "Nonaktif" | string;
  telepon?: string;
  avatar?: string;
  lastLogin?: string;
  createdAt?: string;
}

export interface UserPermission {
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove?: boolean;
}

export interface UserAccess {
  userId: number | string;
  role: UserRole;
  permissions: UserPermission[];
}

```

