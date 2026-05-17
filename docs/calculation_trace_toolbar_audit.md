# Calculation Trace / Step-by-step Toolbar Audit

Tanggal audit: 2026-05-14  
Scope: toolbar palette, task window, realtime unit display, dependency chain, equation steps, dan basis literatur lokal/eksternal.

## Executive Summary

Status akhir: PASS dengan satu perbaikan yang sudah diterapkan.

Temuan utama:

- Fluid Basis, Pipe, Vessel H, Vessel V, Heat Exchanger, Valve, SRC, dan SNK sudah menampilkan Calculation Trace dengan Dependency Chain dan Equation Steps.
- Pump, Tank, PTF, dan LIC sudah menampilkan Calculation Trace / Step-by-step Report dan Equation Steps, tetapi tidak semua memakai heading eksplisit bernama Dependency Chain. Untuk Pump dependency ditampilkan sebagai Boundary & Path / Suction Path; untuk Tank sebagai Flow Balance / Pressure & Venting; untuk PTF/LIC sebagai Attached Pipe / Realtime Readouts.
- Realtime unit switching berfungsi di Fluid Basis dan mayoritas object task window. Saat audit runtime ditemukan gap di Tank: beberapa readout/trace masih memakai satuan internal metric dan `mbar` tank venting salah dibaca sebagai `bar` ketika US Customary dipilih. Gap ini sudah diperbaiki.

## Perbaikan Yang Diterapkan

- `core/unit-system.js`
  - Menambahkan konversi `mbar` source-unit agar 25 mbar g tampil sebagai 0.362594 psig, bukan 362.594 psig.
  - Menambahkan quantity `area` agar area tank trace berubah dari m2 ke ft2 pada US Customary.
- `properties/object-properties.js`
  - Tank Hydraulic Readout, SRC Feed Flow Breakdown, dan Tank Calculation Trace sekarang memakai formatter unit-aware.
- `tests/unit-system-validation.cjs`
  - Menambahkan regresi untuk mbar gauge, mbar vacuum, reverse conversion ke internal mbar, dan area m2 to ft2.
- Production bundle dibangun ulang melalui `tools/build-production-assets.mjs`.

## Toolbar / Task Window Matrix

| Toolbar / Window | Realtime display | Unit switch | Dependency Chain | Equation Steps | Literature basis |
|---|---:|---:|---:|---:|---:|
| Fluid Basis | PASS | PASS | PASS | PASS | PASS |
| Pump | PASS, setelah hydraulic/NPSH solved | PASS | PARTIAL, path/dependency tidak memakai heading eksplisit | PASS | PASS |
| Tank | PASS | PASS, setelah perbaikan | PARTIAL, flow/pressure dependency berupa section bukan heading eksplisit | PASS | PASS |
| Vessel H | PASS | PASS | PASS | PASS | PASS |
| Vessel V | PASS | PASS | PASS | PASS | PASS |
| Heat Exchanger | PASS | PASS | PASS | PASS | PASS |
| Valve | PASS | PASS | PASS | PASS | PASS |
| Source / SRC | PASS | PASS | PASS | PASS | PASS |
| Sink / SNK | PASS | PASS | PASS | PASS | PASS |
| PTF Line Monitor | PASS saat attached pipe tersedia | PASS | PARTIAL, attached-pipe dependency ada di Input Basis | PASS | PASS |
| LIC Level Controller | PASS | PASS | PARTIAL, controller dependency ada di Input Basis | PASS | PASS |
| Pipe task window | PASS | PASS | PASS | PASS | PASS |

Catatan: Pipe bukan item toolbar palette langsung; pipe dibuat lewat mode connect / hydraulic connection. Karena pipe task window adalah bagian utama hydraulic trace, tetap diaudit.

## Runtime Evidence

Browser audit pada `http://127.0.0.1:4173/`:

- Fluid Basis, Metric -> US Customary:
  - Temperature berubah dari 25.000 deg C ke 77.000 deg F.
  - Density berubah dari 997.047 kg/m3 ke 62.244 lb/ft3.
  - Vapor Pressure berubah dari 0.031698 bar a ke 0.459744 psia.
  - Vapor Pressure Head berubah dari 0.324 m ke 1.063 ft.
  - Dependency Chain dan Equation Steps tetap tampil.
- Tank task window, US Customary setelah perbaikan:
  - Base Elevation tampil ft, Diameter tampil in, Volume tampil ft3.
  - Tank Design Pressure 25 mbar g tampil 0.362594 psig.
  - Design Vacuum 5 mbar vacuum tampil 0.072519 psi.
  - Pressure Vent Set 20 mbar g tampil 0.290 psig.
  - Tank trace menampilkan area dalam ft2 dan Equation Steps tetap tampil.

## Literature Conformance

Rujukan lokal yang dipakai:

- `pdf_ref/ref1-fluid-mechanics-fundaments-and-applications.pdf`
  - Specific volume, specific weight, pressure head, Bernoulli energy balance, vapor pressure/cavitation.
- `pdf_ref/ref2-introduction-fluid-mechanics.pdf`
  - Energy equation, Darcy-Weisbach, Reynolds regime, friction factor/Moody, minor loss K.
- `pdf_ref/ref3-cavitations_and_centrifugal_pump_book_edward.pdf`
  - Konteks cavitation pada centrifugal pump dan gejala/risiko operasi.
- `pdf_ref/ref4-standar_ANSI-9-6-2024_rotodynamic_pump_guidline_for_NPSH_margin-hydraulic-institute.pdf`
  - Basis NPSHA/NPSHR, NPSH margin, dan aplikasi Hydraulic Institute.

Rujukan eksternal tepercaya yang sesuai:

- NIST Chemistry WebBook SRD 69: https://webbook.nist.gov/chemistry/fluid/
  - Fluid thermophysical properties seperti density, Cp, viscosity, specific volume, speed of sound, dan vapor-pressure related data.
- IAPWS SR6-08(2011): https://www.iapws.org/relguide/LiquidWater.pdf
  - Water property basis untuk liquid water at 0.1 MPa.
- Hydraulic Institute / ANSI-HI 9.6.1 update note: https://www.pumps.org/2025/03/18/understanding-the-2024-updates-to-ansi-hi-9-6-1-rotodynamic-pumps-guideline-for-npsh-margin/
  - NPSHA sebagai system characteristic, NPSHR sebagai pump/manufacturer characteristic, dan NPSH margin untuk reliabilitas rotodynamic pump.

## Verification

Automated checks:

- `tests/*.cjs`: 28/28 PASS.
- `tools/build-production-assets.mjs`: PASS, production JS/CSS bundle rebuilt.

Manual/browser checks:

- Fluid Basis unit switch PASS.
- Tank task window unit regression PASS after fix.

## Residual Notes

- Jika standar UI diminta seragam 100%, Pump/Tank/PTF/LIC sebaiknya diberi heading eksplisit `Dependency Chain`, walaupun dependency-nya sudah ada secara fungsional di section lain.
- Pump trace membutuhkan network lengkap dan hasil NPSH solved. Saat belum complete, empty-state trace adalah perilaku yang benar.
- PTF trace membutuhkan pipe attachment; LIC menampilkan controller trace tanpa pipe hydraulic dependency.
