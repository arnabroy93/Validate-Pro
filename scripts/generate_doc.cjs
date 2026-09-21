const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  ShadingType
} = require('docx');

// Helper to convert SVG string to PNG Buffer
function svgToPng(svgString, width = 800) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: width }
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

// -------------------------------------------------------------
// 1. GENERATE VISUAL SCREENSHOT GRAPHICS (SVG -> PNG)
// -------------------------------------------------------------

// Graphic 1: Validation Dashboard UI Mockup
const svgDashboard = `
<svg width="800" height="480" viewBox="0 0 800 480" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <!-- Background window frame -->
  <rect width="800" height="480" rx="12" fill="#0f172a" />
  
  <!-- Window Header Bar -->
  <rect width="800" height="40" rx="12" fill="#1e293b" />
  <rect y="28" width="800" height="12" fill="#1e293b" />
  <circle cx="24" cy="20" r="6" fill="#ef4444" />
  <circle cx="44" cy="20" r="6" fill="#f59e0b" />
  <circle cx="64" cy="20" r="6" fill="#10b981" />
  <text x="400" y="24" font-size="13" font-weight="600" fill="#94a3b8" text-anchor="middle">Validate-Pro — Student Batch Validation Dashboard</text>

  <!-- App Canvas -->
  <rect x="0" y="40" width="800" height="440" fill="#f8fafc" />

  <!-- Top Filter Bar -->
  <rect x="20" y="55" width="760" height="65" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  
  <!-- Center Selector -->
  <text x="35" y="78" font-size="11" font-weight="bold" fill="#64748b">1. SELECT CENTER</text>
  <rect x="35" y="84" width="180" height="28" rx="6" fill="#f1f5f9" stroke="#cbd5e1" />
  <text x="45" y="102" font-size="12" font-weight="bold" fill="#0f766e">APAAL — Andhra Pradesh</text>
  
  <!-- Batch Selector -->
  <text x="235" y="78" font-size="11" font-weight="bold" fill="#64748b">2. SELECT BATCH</text>
  <rect x="235" y="84" width="180" height="28" rx="6" fill="#f1f5f9" stroke="#cbd5e1" />
  <text x="245" y="102" font-size="12" font-weight="bold" fill="#0f766e">ANP-D7427 (Running)</text>

  <!-- Online Validators Badge -->
  <rect x="610" y="74" width="155" height="30" rx="15" fill="#ecfdf5" stroke="#a7f3d0" />
  <circle cx="625" cy="89" r="4" fill="#10b981" />
  <text x="635" y="93" font-size="11" font-weight="bold" fill="#065f46">3 Validators Online</text>

  <!-- Batch Progress Bar & Summary Stats -->
  <rect x="20" y="130" width="760" height="70" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="35" y="152" font-size="13" font-weight="bold" fill="#1e293b">Batch Progress: ANP-D7427</text>
  <text x="710" y="152" font-size="13" font-weight="bold" fill="#0f766e">85% Completed</text>
  
  <!-- Progress track -->
  <rect x="35" y="160" width="730" height="8" rx="4" fill="#e2e8f0" />
  <rect x="35" y="160" width="620" height="8" rx="4" fill="#0d9488" />
  
  <!-- Quick Metric Pills -->
  <text x="35" y="188" font-size="11" fill="#475569">Total Enrolled: <tspan font-weight="bold" fill="#0f172a">60</tspan></text>
  <text x="180" y="188" font-size="11" fill="#475569">Validated: <tspan font-weight="bold" fill="#16a34a">48</tspan></text>
  <text x="300" y="188" font-size="11" fill="#475569">Revalidated: <tspan font-weight="bold" fill="#d97706">3</tspan></text>
  <text x="430" y="188" font-size="11" fill="#475569">Absent: <tspan font-weight="bold" fill="#64748b">6</tspan></text>
  <text x="540" y="188" font-size="11" fill="#475569">Rejected: <tspan font-weight="bold" fill="#dc2626">2</tspan></text>
  <text x="650" y="188" font-size="11" fill="#475569">Pending: <tspan font-weight="bold" fill="#2563eb">1</tspan></text>

  <!-- Main Active Student Validation Card -->
  <rect x="20" y="210" width="480" height="255" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  
  <!-- Card Header -->
  <rect x="20" y="210" width="480" height="40" rx="8" fill="#f8fafc" stroke="#e2e8f0" />
  <circle cx="42" cy="230" r="12" fill="#ccfbf1" />
  <text x="42" y="234" font-size="11" font-weight="bold" fill="#0f766e" text-anchor="middle">RK</text>
  <text x="62" y="228" font-size="13" font-weight="bold" fill="#0f172a">Rajesh Kumar</text>
  <text x="62" y="242" font-size="11" fill="#64748b">Code: AF05312129 • Mobile: +91 98765 43210</text>
  <rect x="400" y="220" width="85" height="20" rx="10" fill="#fef3c7" stroke="#fde68a" />
  <text x="442" y="234" font-size="10" font-weight="bold" fill="#92400e" text-anchor="middle">Pending Call</text>

  <!-- Student Details Grid -->
  <text x="35" y="272" font-size="11" fill="#64748b">Father's Name:</text>
  <text x="135" y="272" font-size="11" font-weight="bold" fill="#1e293b">Suresh Kumar</text>

  <text x="35" y="292" font-size="11" fill="#64748b">Program / Trade:</text>
  <text x="135" y="292" font-size="11" font-weight="bold" fill="#1e293b">Solar Panel Technician</text>

  <text x="35" y="312" font-size="11" fill="#64748b">Batch Start Date:</text>
  <text x="135" y="312" font-size="11" font-weight="bold" fill="#1e293b">15 Aug 2026</text>

  <text x="35" y="332" font-size="11" fill="#64748b">Qualification:</text>
  <text x="135" y="332" font-size="11" font-weight="bold" fill="#1e293b">12th Standard Passed</text>

  <text x="35" y="352" font-size="11" fill="#64748b">Assigned AE:</text>
  <text x="135" y="352" font-size="11" font-weight="bold" fill="#0f766e">Manoj Sharma (AE)</text>

  <!-- Action Controls -->
  <line x1="35" y1="368" x2="485" y2="368" stroke="#f1f5f9" stroke-width="1.5" />
  
  <text x="35" y="388" font-size="11" font-weight="bold" fill="#475569">TELEPHONIC / VIDEO VERIFICATION ACTION:</text>
  
  <!-- Buttons -->
  <rect x="35" y="400" width="100" height="32" rx="6" fill="#16a34a" />
  <text x="85" y="420" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">✓ Validated</text>

  <rect x="145" y="400" width="105" height="32" rx="6" fill="#f59e0b" />
  <text x="197" y="420" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">↻ Revalidate</text>

  <rect x="260" y="400" width="85" height="32" rx="6" fill="#64748b" />
  <text x="302" y="420" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">✕ Absent</text>

  <rect x="355" y="400" width="85" height="32" rx="6" fill="#dc2626" />
  <text x="397" y="420" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">⚠ Reject</text>

  <!-- Right Side: Remarks & Recording Panel -->
  <rect x="515" y="210" width="265" height="255" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  <text x="530" y="235" font-size="12" font-weight="bold" fill="#1e293b">Call Verification Remarks</text>
  
  <rect x="530" y="248" width="235" height="75" rx="6" fill="#f8fafc" stroke="#e2e8f0" />
  <text x="540" y="270" font-size="11" fill="#334155">Candidate confirmed attendance.</text>
  <text x="540" y="286" font-size="11" fill="#334155">Video call verified with valid ID proof.</text>
  <text x="540" y="302" font-size="11" fill="#0f766e">Remarks recorded by Auditor.</text>

  <text x="530" y="342" font-size="11" font-weight="bold" fill="#475569">Call Recording Link:</text>
  <rect x="530" y="350" width="235" height="28" rx="6" fill="#f8fafc" stroke="#e2e8f0" />
  <text x="540" y="368" font-size="11" fill="#64748b">https://recordings.cloud/call_8923</text>

  <!-- Save / Submit Confirmation Button -->
  <rect x="530" y="395" width="235" height="36" rx="6" fill="#0d9488" />
  <text x="647" y="418" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">💾 Save Verification Record</text>
  <text x="647" y="448" font-size="10" fill="#94a3b8" text-anchor="middle">Cloud synced in 0.04s</text>
</svg>
`;

// Graphic 2: 4-Step Student Validation Workflow
const svgWorkflow = `
<svg width="800" height="260" viewBox="0 0 800 260" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="800" height="260" rx="10" fill="#f0fdfa" stroke="#ccfbf1" stroke-width="2" />
  
  <text x="400" y="35" font-size="16" font-weight="bold" fill="#0f766e" text-anchor="middle">THE 4-STEP VALIDATION WORKFLOW IN VALIDATE-PRO</text>
  <text x="400" y="55" font-size="12" fill="#475569" text-anchor="middle">Simple, standardized, and audit-compliant process for every student batch</text>

  <!-- Step 1 -->
  <g transform="translate(30, 80)">
    <rect width="165" height="150" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    <circle cx="82" cy="30" r="18" fill="#0d9488" />
    <text x="82" y="36" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">1</text>
    <text x="82" y="70" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle">Select Batch</text>
    <text x="82" y="92" font-size="10.5" fill="#64748b" text-anchor="middle">Choose Center &amp;</text>
    <text x="82" y="107" font-size="10.5" fill="#64748b" text-anchor="middle">Batch from instant</text>
    <text x="82" y="122" font-size="10.5" fill="#64748b" text-anchor="middle">dropdown list.</text>
  </g>

  <!-- Arrow 1 -->
  <path d="M 205 155 L 225 155 M 220 148 L 227 155 L 220 162" stroke="#0d9488" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Step 2 -->
  <g transform="translate(235, 80)">
    <rect width="165" height="150" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    <circle cx="82" cy="30" r="18" fill="#0d9488" />
    <text x="82" y="36" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">2</text>
    <text x="82" y="70" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle">Call &amp; Verify</text>
    <text x="82" y="92" font-size="10.5" fill="#64748b" text-anchor="middle">Check student profile,</text>
    <text x="82" y="107" font-size="10.5" fill="#64748b" text-anchor="middle">connect via phone/video,</text>
    <text x="82" y="122" font-size="10.5" fill="#64748b" text-anchor="middle">confirm attendance.</text>
  </g>

  <!-- Arrow 2 -->
  <path d="M 410 155 L 430 155 M 425 148 L 432 155 L 425 162" stroke="#0d9488" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Step 3 -->
  <g transform="translate(440, 80)">
    <rect width="165" height="150" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    <circle cx="82" cy="30" r="18" fill="#0d9488" />
    <text x="82" y="36" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">3</text>
    <text x="82" y="70" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle">Record Status</text>
    <text x="82" y="92" font-size="10.5" fill="#64748b" text-anchor="middle">Mark Validated, Absent,</text>
    <text x="82" y="107" font-size="10.5" fill="#64748b" text-anchor="middle">or Revalidate. Add</text>
    <text x="82" y="122" font-size="10.5" fill="#64748b" text-anchor="middle">notes &amp; recording link.</text>
  </g>

  <!-- Arrow 3 -->
  <path d="M 615 155 L 635 155 M 630 148 L 637 155 L 630 162" stroke="#0d9488" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />

  <!-- Step 4 -->
  <g transform="translate(645, 80)">
    <rect width="145" height="150" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
    <circle cx="72" cy="30" r="18" fill="#16a34a" />
    <text x="72" y="36" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">4</text>
    <text x="72" y="70" font-size="13" font-weight="bold" fill="#1e293b" text-anchor="middle">Sync &amp; Report</text>
    <text x="72" y="92" font-size="10.5" fill="#64748b" text-anchor="middle">Instant cloud save.</text>
    <text x="72" y="107" font-size="10.5" fill="#64748b" text-anchor="middle">Export Excel, PDF</text>
    <text x="72" y="122" font-size="10.5" fill="#64748b" text-anchor="middle">or Power BI report.</text>
  </g>
</svg>
`;

// Graphic 3: Analytics & Insights Dashboard Mockup
const svgInsights = `
<svg width="800" height="420" viewBox="0 0 800 420" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="800" height="420" rx="12" fill="#0f172a" />
  
  <!-- Window Header -->
  <rect width="800" height="36" rx="12" fill="#1e293b" />
  <rect y="24" width="800" height="12" fill="#1e293b" />
  <circle cx="20" cy="18" r="5" fill="#ef4444" />
  <circle cx="36" cy="18" r="5" fill="#f59e0b" />
  <circle cx="52" cy="18" r="5" fill="#10b981" />
  <text x="400" y="22" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="middle">Validate-Pro — Real-time Analytics &amp; Insights</text>

  <!-- Body -->
  <rect x="0" y="36" width="800" height="384" fill="#f8fafc" />

  <!-- 4 Top KPI Cards -->
  <!-- KPI 1 -->
  <rect x="20" y="50" width="175" height="75" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="35" y="70" font-size="11" font-weight="bold" fill="#64748b">TOTAL ENROLLED</text>
  <text x="35" y="98" font-size="22" font-weight="900" fill="#0f172a">150,538</text>
  <text x="35" y="114" font-size="10" fill="#16a34a">↑ 100% database coverage</text>

  <!-- KPI 2 -->
  <rect x="210" y="50" width="175" height="75" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="225" y="70" font-size="11" font-weight="bold" fill="#64748b">TOTAL VALIDATED</text>
  <text x="225" y="98" font-size="22" font-weight="900" fill="#16a34a">124,190</text>
  <text x="225" y="114" font-size="10" fill="#0d9488">82.5% Completion Rate</text>

  <!-- KPI 3 -->
  <rect x="400" y="50" width="175" height="75" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="415" y="70" font-size="11" font-weight="bold" fill="#64748b">ACTIVE BATCHES</text>
  <text x="415" y="98" font-size="22" font-weight="900" fill="#0f766e">836</text>
  <text x="415" y="114" font-size="10" fill="#64748b">Across 210 Centers</text>

  <!-- KPI 4 -->
  <rect x="590" y="50" width="190" height="75" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="605" y="70" font-size="11" font-weight="bold" fill="#64748b">AVG RESPONSE TIME</text>
  <text x="605" y="98" font-size="22" font-weight="900" fill="#6366f1">38 ms</text>
  <text x="605" y="114" font-size="10" fill="#16a34a">⚡ Sub-second query speed</text>

  <!-- Chart 1: Center Performance Leaderboard -->
  <rect x="20" y="140" width="465" height="260" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="35" y="165" font-size="13" font-weight="bold" fill="#1e293b">Center Validation Leaderboard</text>
  
  <!-- Bar 1 -->
  <text x="35" y="195" font-size="11" font-weight="bold" fill="#334155">APAAL</text>
  <rect x="90" y="183" width="300" height="16" rx="4" fill="#0d9488" />
  <text x="400" y="196" font-size="11" font-weight="bold" fill="#0f766e">96% (4,120)</text>

  <!-- Bar 2 -->
  <text x="35" y="235" font-size="11" font-weight="bold" fill="#334155">WBNAV</text>
  <rect x="90" y="223" width="270" height="16" rx="4" fill="#0d9488" />
  <text x="370" y="236" font-size="11" font-weight="bold" fill="#0f766e">89% (3,450)</text>

  <!-- Bar 3 -->
  <text x="35" y="275" font-size="11" font-weight="bold" fill="#334155">APDKN</text>
  <rect x="90" y="263" width="250" height="16" rx="4" fill="#0d9488" />
  <text x="350" y="276" font-size="11" font-weight="bold" fill="#0f766e">84% (2,980)</text>

  <!-- Bar 4 -->
  <text x="35" y="315" font-size="11" font-weight="bold" fill="#334155">UPMSG</text>
  <rect x="90" y="303" width="220" height="16" rx="4" fill="#0d9488" />
  <text x="320" y="316" font-size="11" font-weight="bold" fill="#0f766e">78% (2,150)</text>

  <!-- Bar 5 -->
  <text x="35" y="355" font-size="11" font-weight="bold" fill="#334155">BRACC</text>
  <rect x="90" y="343" width="190" height="16" rx="4" fill="#0d9488" />
  <text x="290" y="356" font-size="11" font-weight="bold" fill="#0f766e">71% (1,840)</text>

  <!-- Chart 2: Status Breakdown Pie/Donut Visual -->
  <rect x="500" y="140" width="280" height="260" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <text x="515" y="165" font-size="13" font-weight="bold" fill="#1e293b">Status Distribution</text>

  <circle cx="640" cy="245" r="55" fill="none" stroke="#e2e8f0" stroke-width="22" />
  <circle cx="640" cy="245" r="55" fill="none" stroke="#16a34a" stroke-width="22" stroke-dasharray="270 345" stroke-dashoffset="0" />
  <circle cx="640" cy="245" r="55" fill="none" stroke="#f59e0b" stroke-width="22" stroke-dasharray="40 345" stroke-dashoffset="-270" />
  <circle cx="640" cy="245" r="55" fill="none" stroke="#dc2626" stroke-width="22" stroke-dasharray="20 345" stroke-dashoffset="-310" />
  <text x="640" y="243" font-size="16" font-weight="bold" fill="#1e293b" text-anchor="middle">82.5%</text>
  <text x="640" y="258" font-size="10" fill="#64748b" text-anchor="middle">Validated</text>

  <!-- Legend -->
  <circle cx="530" cy="335" r="5" fill="#16a34a" />
  <text x="542" y="339" font-size="11" fill="#475569">Validated (82.5%)</text>

  <circle cx="660" cy="335" r="5" fill="#f59e0b" />
  <text x="672" y="339" font-size="11" fill="#475569">Revalidated (8.2%)</text>

  <circle cx="530" cy="365" r="5" fill="#64748b" />
  <text x="542" y="369" font-size="11" fill="#475569">Absent (5.8%)</text>

  <circle cx="660" cy="365" r="5" fill="#dc2626" />
  <text x="672" y="369" font-size="11" fill="#475569">Rejected (3.5%)</text>
</svg>
`;

// Graphic 4: Reports & Export Hub
const svgReports = `
<svg width="800" height="320" viewBox="0 0 800 320" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <rect width="800" height="320" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  
  <rect width="800" height="50" rx="10" fill="#f8fafc" stroke="#e2e8f0" />
  <text x="25" y="32" font-size="15" font-weight="bold" fill="#0f766e">Reports &amp; Data Export Hub</text>
  
  <!-- Export Action Buttons -->
  <rect x="420" y="12" width="110" height="28" rx="6" fill="#15803d" />
  <text x="475" y="30" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">📥 Excel (.xlsx)</text>

  <rect x="540" y="12" width="110" height="28" rx="6" fill="#dc2626" />
  <text x="595" y="30" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">📄 PDF Report</text>

  <rect x="660" y="12" width="115" height="28" rx="6" fill="#0f766e" />
  <text x="717" y="30" font-size="11" font-weight="bold" fill="#ffffff" text-anchor="middle">📊 Power BI Feed</text>

  <!-- Table Header -->
  <rect x="20" y="65" width="760" height="30" fill="#f1f5f9" />
  <text x="35" y="85" font-size="11" font-weight="bold" fill="#475569">CENTER</text>
  <text x="110" y="85" font-size="11" font-weight="bold" fill="#475569">BATCH CODE</text>
  <text x="210" y="85" font-size="11" font-weight="bold" fill="#475569">ENROLLED</text>
  <text x="290" y="85" font-size="11" font-weight="bold" fill="#475569">VALIDATED</text>
  <text x="380" y="85" font-size="11" font-weight="bold" fill="#475569">REVAL</text>
  <text x="440" y="85" font-size="11" font-weight="bold" fill="#475569">ABSENT</text>
  <text x="510" y="85" font-size="11" font-weight="bold" fill="#475569">REJECTED</text>
  <text x="590" y="85" font-size="11" font-weight="bold" fill="#475569">ASSIGNED AE</text>
  <text x="700" y="85" font-size="11" font-weight="bold" fill="#475569">STATUS</text>

  <!-- Row 1 -->
  <rect x="20" y="95" width="760" height="35" fill="#ffffff" stroke="#f1f5f9" stroke-width="1" />
  <text x="35" y="117" font-size="11" font-weight="bold" fill="#0f766e">APAAL</text>
  <text x="110" y="117" font-size="11" font-weight="bold" fill="#1e293b">ANP-D7427</text>
  <text x="210" y="117" font-size="11" fill="#334155">60</text>
  <text x="290" y="117" font-size="11" font-weight="bold" fill="#16a34a">52</text>
  <text x="380" y="117" font-size="11" fill="#d97706">3</text>
  <text x="440" y="117" font-size="11" fill="#64748b">4</text>
  <text x="510" y="117" font-size="11" fill="#dc2626">1</text>
  <text x="590" y="117" font-size="11" fill="#334155">Manoj Sharma</text>
  <rect x="690" y="103" width="75" height="20" rx="10" fill="#ecfdf5" />
  <text x="727" y="117" font-size="10" font-weight="bold" fill="#047857" text-anchor="middle">87% Done</text>

  <!-- Row 2 -->
  <rect x="20" y="130" width="760" height="35" fill="#f8fafc" stroke="#f1f5f9" stroke-width="1" />
  <text x="35" y="152" font-size="11" font-weight="bold" fill="#0f766e">WBNAV</text>
  <text x="110" y="152" font-size="11" font-weight="bold" fill="#1e293b">ANP-D7237</text>
  <text x="210" y="152" font-size="11" fill="#334155">40</text>
  <text x="290" y="152" font-size="11" font-weight="bold" fill="#16a34a">38</text>
  <text x="380" y="152" font-size="11" fill="#d97706">1</text>
  <text x="440" y="152" font-size="11" fill="#64748b">1</text>
  <text x="510" y="152" font-size="11" fill="#dc2626">0</text>
  <text x="590" y="152" font-size="11" fill="#334155">S. Chatterjee</text>
  <rect x="690" y="138" width="75" height="20" rx="10" fill="#ecfdf5" />
  <text x="727" y="152" font-size="10" font-weight="bold" fill="#047857" text-anchor="middle">95% Done</text>

  <!-- Row 3 -->
  <rect x="20" y="165" width="760" height="35" fill="#ffffff" stroke="#f1f5f9" stroke-width="1" />
  <text x="35" y="187" font-size="11" font-weight="bold" fill="#0f766e">UPMSG</text>
  <text x="110" y="187" font-size="11" font-weight="bold" fill="#1e293b">ANP-D7495</text>
  <text x="210" y="187" font-size="11" fill="#334155">49</text>
  <text x="290" y="187" font-size="11" font-weight="bold" fill="#16a34a">44</text>
  <text x="380" y="187" font-size="11" fill="#d97706">2</text>
  <text x="440" y="187" font-size="11" fill="#64748b">2</text>
  <text x="510" y="187" font-size="11" fill="#dc2626">1</text>
  <text x="590" y="187" font-size="11" fill="#334155">P. K. Verma</text>
  <rect x="690" y="173" width="75" height="20" rx="10" fill="#ecfdf5" />
  <text x="727" y="187" font-size="10" font-weight="bold" fill="#047857" text-anchor="middle">90% Done</text>

  <!-- Row 4 -->
  <rect x="20" y="200" width="760" height="35" fill="#f8fafc" stroke="#f1f5f9" stroke-width="1" />
  <text x="35" y="222" font-size="11" font-weight="bold" fill="#0f766e">APDKN</text>
  <text x="110" y="222" font-size="11" font-weight="bold" fill="#1e293b">ANP-D6605</text>
  <text x="210" y="222" font-size="11" fill="#334155">208</text>
  <text x="290" y="222" font-size="11" font-weight="bold" fill="#16a34a">175</text>
  <text x="380" y="222" font-size="11" fill="#d97706">12</text>
  <text x="440" y="222" font-size="11" fill="#64748b">15</text>
  <text x="510" y="222" font-size="11" fill="#dc2626">6</text>
  <text x="590" y="222" font-size="11" fill="#334155">R. Srinivas</text>
  <rect x="690" y="208" width="75" height="20" rx="10" fill="#ecfdf5" />
  <text x="727" y="222" font-size="10" font-weight="bold" fill="#047857" text-anchor="middle">84% Done</text>

  <!-- Footer summary -->
  <text x="35" y="280" font-size="12" font-weight="bold" fill="#1e293b">Total Batches in Report: 836</text>
  <text x="300" y="280" font-size="12" font-weight="bold" fill="#0f766e">Total Verified Students: 124,190</text>
  <text x="600" y="280" font-size="11" fill="#64748b">Instant Live Data Query: 0.04s</text>
</svg>
`;

console.log('Rendering screenshots from SVG to PNG buffers...');
const imgDashboardPng = svgToPng(svgDashboard, 800);
const imgWorkflowPng = svgToPng(svgWorkflow, 800);
const imgInsightsPng = svgToPng(svgInsights, 800);
const imgReportsPng = svgToPng(svgReports, 800);

console.log('Screenshots successfully rendered.');

// -------------------------------------------------------------
// 2. BUILD THE WORD DOCUMENT (.docx)
// -------------------------------------------------------------

function createHeading1(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    keepWithNext: true
  });
}

function createHeading2(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    keepWithNext: true
  });
}

function createHeading3(text) {
  return new Paragraph({
    text: text,
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 80 },
    keepWithNext: true
  });
}

function createBodyParagraph(text) {
  return new Paragraph({
    children: [new TextRun({ text: text, font: 'Calibri', size: 22 })],
    spacing: { before: 80, after: 120, line: 280 }
  });
}

function createBulletItem(boldPrefix, normalText) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [
      new TextRun({ text: boldPrefix + ': ', bold: true, font: 'Calibri', size: 22, color: '0f766e' }),
      new TextRun({ text: normalText, font: 'Calibri', size: 22, color: '334155' })
    ],
    spacing: { before: 40, after: 60, line: 260 }
  });
}

function createCalloutBox(title, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      left: { style: BorderStyle.SINGLE, size: 24, color: '0d9488' }
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: 'f0fdfa' },
            margins: { top: 140, bottom: 140, left: 200, right: 200 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: '💡 ' + title, bold: true, font: 'Calibri', size: 22, color: '0f766e' })
                ],
                spacing: { after: 60 }
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: text, font: 'Calibri', size: 21, color: '1e293b' })
                ],
                spacing: { line: 260 }
              })
            ]
          })
        ]
      })
    ]
  });
}

function createImageBlock(imageBuffer, caption) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: imageBuffer,
          transformation: {
            width: 580,
            height: 320
          }
        })
      ],
      spacing: { before: 180, after: 60 }
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Figure: ' + caption, italics: true, font: 'Calibri', size: 19, color: '64748b' })
      ],
      spacing: { before: 40, after: 180 }
    })
  ];
}

console.log('Constructing Document Structure...');

const doc = new Document({
  styles: {
    default: {
      document: {
        run: {
          font: 'Calibri',
          size: 22,
          color: '1e293b'
        }
      }
    },
    heading1: {
      run: {
        font: 'Calibri',
        size: 32,
        bold: true,
        color: '0f766e'
      }
    },
    heading2: {
      run: {
        font: 'Calibri',
        size: 26,
        bold: true,
        color: '0d9488'
      }
    },
    heading3: {
      run: {
        font: 'Calibri',
        size: 23,
        bold: true,
        color: '334155'
      }
    }
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: 1200,
            bottom: 1200,
            left: 1200,
            right: 1200
          }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: 'Validate-Pro — Application User Guide & Feature Manual', font: 'Calibri', size: 18, color: '94a3b8' })
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: '94a3b8' }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: '94a3b8' }),
                new TextRun({ text: ' of ', font: 'Calibri', size: 18, color: '94a3b8' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18, color: '94a3b8' })
              ]
            })
          ]
        })
      },
      children: [
        // COVER / TITLE SECTION
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'VALIDATE-PRO', bold: true, font: 'Calibri', size: 48, color: '0f766e' })
          ],
          spacing: { before: 200, after: 60 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Comprehensive User Guide & Feature Overview', bold: true, font: 'Calibri', size: 28, color: '0d9488' })
          ],
          spacing: { after: 80 }
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'A Layman-Friendly Guide to Student Batch Validation, Live Presence, Analytics & Reporting', italics: true, font: 'Calibri', size: 22, color: '64748b' })
          ],
          spacing: { after: 240 }
        }),

        // Metadata table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 8, color: 'e2e8f0' },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: 'e2e8f0' },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'f1f5f9' },
            insideVertical: { style: BorderStyle.NONE }
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Application Name:', bold: true, font: 'Calibri', size: 20, color: '0f766e' })] })]
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Validate-Pro (Student Batch Validation & Analytics Engine)', font: 'Calibri', size: 20 })] })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Target Audience:', bold: true, font: 'Calibri', size: 20, color: '0f766e' })] })]
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Validators, Academic Executives (AEs), Center Managers, Auditors, Leadership', font: 'Calibri', size: 20 })] })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Scale & Capacity:', bold: true, font: 'Calibri', size: 20, color: '0f766e' })] })]
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: '150,538+ Student Records • 836+ Batches • 210 Training Centers', font: 'Calibri', size: 20 })] })]
                })
              ]
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Document Version:', bold: true, font: 'Calibri', size: 20, color: '0f766e' })] })]
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: 'Version 2.4 (September 2026 Edition)', font: 'Calibri', size: 20 })] })]
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 200, after: 100 } }),

        // SECTION 1: WHAT IS VALIDATE-PRO
        createHeading1('1. What is Validate-Pro? (Executive Summary)'),
        createBodyParagraph(
          'Validate-Pro is an enterprise web application designed to simplify, accelerate, and audit the student verification process for vocational training centers, skill development programs, and educational institutions.'
        ),
        createBodyParagraph(
          'Before Validate-Pro, verification teams struggled with heavy, disorganized Excel sheets spread across multiple computers. Calling students, recording their attendance, and collating validation reports used to take days. Validate-Pro brings all student records into a single, lightning-fast cloud portal that works on any computer or mobile tablet.'
        ),
        createCalloutBox(
          'The Core Mission of Validate-Pro',
          'To ensure that 100% of enrolled students across all training centers are legitimately verified via phone or video call, with an unalterable timestamped audit trail, zero duplicate calls, and instant reporting for management and government/partner compliance.'
        ),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 2: CORE CONCEPTS
        createHeading1('2. Core Concepts Explained in Plain English'),
        createBodyParagraph(
          'If you are new to the platform, here are the simple terms used throughout the system:'
        ),
        createBulletItem(
          'Center Code (e.g., APAAL, WBNAV, UPMSG)',
          'The unique code assigned to a specific training campus or district center where courses are conducted.'
        ),
        createBulletItem(
          'Batch Code (e.g., ANP-D7427)',
          'A group of students studying together under a specific trade (e.g., Solar Technician, Electrician) starting on the same date.'
        ),
        createBulletItem(
          'Student Code (e.g., AF05312129)',
          'The unique identification number of the enrolled student.'
        ),
        createBulletItem(
          'Academic Executive (AE) / Assessor',
          'The trainer or center coordinator responsible for running the batch on the ground.'
        ),
        createBulletItem(
          'Validator / Auditor',
          'The team member using Validate-Pro who calls the student to verify their enrollment, attendance, and identity.'
        ),
        createBulletItem(
          'Validation Status',
          'The final outcome of the verification call: Validated (Present & verified), Revalidated (Follow-up call needed), Absent (Did not answer), or Rejected (Invalid enrollment).'
        ),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 3: 4-STEP WORKFLOW
        createHeading1('3. The 4-Step Validation Workflow'),
        createBodyParagraph(
          'The validation process in Validate-Pro has been streamlined into four intuitive steps that any team member can master in minutes:'
        ),
        ...createImageBlock(imgWorkflowPng, 'The 4-Step Standardized Validation Workflow in Validate-Pro'),
        createBulletItem(
          'Step 1 — Choose Center & Batch',
          'Select your assigned center from the dropdown. The system automatically populates all active running batches for that center in under 40 milliseconds.'
        ),
        createBulletItem(
          'Step 2 — Connect with the Student',
          'The student profile card displays their full name, phone number, father\'s name, date of birth, trade, and batch start date. Tap the call button or dial the mobile number.'
        ),
        createBulletItem(
          'Step 3 — Record Verification Outcome',
          'Choose the appropriate status button (Validated, Revalidate, Absent, or Reject). Toggle microphone and video checkmarks if video verification was conducted, enter call notes/remarks, and paste a recording URL if available.'
        ),
        createBulletItem(
          'Step 4 — Instant Cloud Sync & Reporting',
          'Click Save. The batch completion progress bar updates instantly, and the record is stored permanently in the audit ledger.'
        ),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 4: KEY FEATURES BREAKDOWN
        createHeading1('4. Key Features & Capabilities Breakdown'),
        createBodyParagraph(
          'Validate-Pro comes packed with powerful, user-centric tools designed for maximum efficiency and audit accuracy:'
        ),

        createHeading2('Feature 1: High-Speed Validation Dashboard'),
        createBodyParagraph(
          'The Validation Dashboard is the primary workspace where validators spend their workday. It is designed to minimize clicks and eliminate screen fatigue.'
        ),
        ...createImageBlock(imgDashboardPng, 'Validate-Pro Live Validation Dashboard Interface'),
        createBulletItem(
          'Instant Center & Batch Search',
          'Smart autocomplete and indexed search across all 210 centers and 836 batches without lag.'
        ),
        createBulletItem(
          'Real-time Batch Progress Bar',
          'Displays live percentages and individual counts (Validated, Revalidated, Absent, Rejected, Pending).'
        ),
        createBulletItem(
          'Complete Student Information Cards',
          'Quick glance at student name, student code, mobile, father\'s name, DOB, qualification, and trade.'
        ),
        createBulletItem(
          '1-Click Status Recording',
          'Color-coded buttons for fast data entry: Green (Validated), Amber (Revalidate), Gray (Absent), Red (Rejected).'
        ),
        createBulletItem(
          'Validation History Timeline Modal',
          'Inspect previous verification attempts for any student, including previous auditor remarks and exact timestamps.'
        ),

        createHeading2('Feature 2: Live Team Presence & Collision Prevention'),
        createBodyParagraph(
          'When dozens of auditors work simultaneously, accidental double-calling of the same student can lead to customer irritation and wasted time. Validate-Pro solves this with a built-in Live Presence heartbeat system.'
        ),
        createBulletItem(
          'Live Online Validator Pill',
          'A glowing green indicator shows how many team members are actively logged in.'
        ),
        createBulletItem(
          'Real-time Active Batch Modal',
          'Clicking the Online Validators badge opens a modal showing exactly which Center and Batch each auditor is working on in real time.'
        ),
        createBulletItem(
          'Automatic Inactive Cleanup',
          'If a validator closes their tab or is inactive for more than 20 seconds, the system releases their presence state automatically.'
        ),

        createHeading2('Feature 3: Interactive Analytics & Global Insights'),
        createBodyParagraph(
          'The Insights dashboard gives managers, team leads, and program directors birds-eye visibility into project progress.'
        ),
        ...createImageBlock(imgInsightsPng, 'Real-time KPI Analytics & Insights Dashboard'),
        createBulletItem(
          'Top Executive KPI Cards',
          'Instant visibility into Total Enrolled (150,538), Total Validated (124,190), Active Batches (836), and Validation Rate (82.5%).'
        ),
        createBulletItem(
          'Center Performance Leaderboard',
          'Compare completion percentages across all 210 centers to spot underperforming locations that need support.'
        ),
        createBulletItem(
          'Academic Executive (AE) Workload Ranking',
          'Analyze validation velocity by field trainer/assessor.'
        ),
        createBulletItem(
          'Status Breakdown Visuals',
          'Interactive donut charts and stacked bars illustrating validation trends over time.'
        ),

        createHeading2('Feature 4: Reports & 1-Click Multi-Format Exporting'),
        createBodyParagraph(
          'Exporting clean data for management presentations, government skill development audits, or training partner reviews takes just one click.'
        ),
        ...createImageBlock(imgReportsPng, 'Multi-Format Reports & Data Export Center'),
        createBulletItem(
          'Summary vs. Detailed Views',
          'Toggle between aggregated batch-level metrics and comprehensive student-by-student records.'
        ),
        createBulletItem(
          'Excel Export (.xlsx)',
          'Downloads fully formatted spreadsheets with styled headers, ready for analysis.'
        ),
        createBulletItem(
          'Printable PDF Summary Reports',
          'Generates clean, professional PDF tables with center code, batch code, student counts, and completion status.'
        ),
        createBulletItem(
          'Live Power BI Feed (OData/JSON)',
          'Direct integration endpoint enabling business intelligence teams to connect Microsoft Power BI directly to the database with CORS support.'
        ),

        createHeading2('Feature 5: Excel Batch Upload & Smart Database Merging'),
        createBodyParagraph(
          'Adding new batches or updating existing enrollments is effortless. Simply upload any standard spreadsheet file.'
        ),
        createBulletItem(
          'Drag-and-Drop XLSX & CSV Support',
          'Upload files directly from your computer.'
        ),
        createBulletItem(
          'Intelligent Column Auto-Mapping',
          'Automatically matches messy column headers (e.g., "Student Name", "Candidate_Name", "Name") to the standard database schema.'
        ),
        createBulletItem(
          'Safe Merge & Deduplication',
          'New students are inserted, existing students are updated, and past validation records are never lost or overwritten.'
        ),

        createHeading2('Feature 6: Role-Based Access Control (RBAC) & Security'),
        createBodyParagraph(
          'Validate-Pro ensures that users only access what their role permits:'
        ),
        createBulletItem(
          'Admin Role',
          'Full control over users, feature switches, system health, database maintenance, and raw uploads.'
        ),
        createBulletItem(
          'Validator Role',
          'Access to the live validation dashboard, student cards, personal activity logs, and batch filtering.'
        ),
        createBulletItem(
          'Viewer Role',
          'Read-only access to reports, statistics, and high-level summaries without permission to alter records.'
        ),

        createHeading2('Feature 7: Admin Feature Controls (Dynamic Switchboard)'),
        createBodyParagraph(
          'Administrators can toggle individual modules (Insights, My Activity, Reports, User Activity, System Health, Power BI, Upload Logs) ON or OFF across the app in real time with a single click, without writing code or redeploying.'
        ),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 5: STEP-BY-STEP USER GUIDES
        createHeading1('5. Step-by-Step "How-To" Guides'),

        createHeading2('Guide A: How to Validate a Student Batch'),
        createBulletItem('Step 1', 'Log in with your assigned email and password.'),
        createBulletItem('Step 2', 'Click on "Validation" in the left sidebar navigation.'),
        createBulletItem('Step 3', 'Click the "Select Center" dropdown and choose your center (e.g., APAAL).'),
        createBulletItem('Step 4', 'Click the "Select Batch" dropdown and pick the batch you want to work on.'),
        createBulletItem('Step 5', 'The student cards will load. Review the student details and initiate the call.'),
        createBulletItem('Step 6', 'Click the appropriate outcome button (Validated, Revalidate, Absent, or Reject).'),
        createBulletItem('Step 7', 'Type any relevant notes in the Remarks box and click "Save Verification Record".'),
        createBulletItem('Step 8', 'Repeat for the remaining students until the batch progress reaches 100%.'),

        createHeading2('Guide B: How to Download an Excel or PDF Report'),
        createBulletItem('Step 1', 'Click on "Reports" in the left sidebar navigation.'),
        createBulletItem('Step 2', 'Use the filter bar to select a specific Center, Batch, or Date Range (or leave empty for all).'),
        createBulletItem('Step 3', 'Choose between "Summary View" (Batch totals) or "Detailed View" (Student-by-student).'),
        createBulletItem('Step 4', 'Click "Export Excel (.xlsx)" to download a spreadsheet, or "Download PDF" for a formatted document.'),

        createHeading2('Guide C: How to Upload a New Batch Excel File (Admins)'),
        createBulletItem('Step 1', 'Click on "Validation" or "Excel Upload Logs" in the sidebar.'),
        createBulletItem('Step 2', 'Click the "Upload Excel File" button.'),
        createBulletItem('Step 3', 'Drag and drop your `.xlsx` or `.csv` file into the upload box.'),
        createBulletItem('Step 4', 'Verify the detected column headers and click "Confirm & Sync to Database".'),
        createBulletItem('Step 5', 'The system will process the records and update the batch list in seconds.'),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 6: FAQ
        createHeading1('6. Frequently Asked Questions (FAQ) & Troubleshooting'),
        createBulletItem(
          'Q1: What should I do if a student does not answer the phone?',
          'Mark the student as "Absent". This increments their absent count. You or a teammate can re-attempt calling them later.'
        ),
        createBulletItem(
          'Q2: What if the student is currently working and asks to be called back later?',
          'Select "Revalidate", type the agreed callback time in the Remarks box (e.g., "Call back after 6 PM"), and save.'
        ),
        createBulletItem(
          'Q3: Will my entered data be lost if my internet disconnects temporarily?',
          'No. Validate-Pro caches your active session. If a network drop occurs, the system automatically retries when connection is restored.'
        ),
        createBulletItem(
          'Q4: Can two validators work on the same batch simultaneously?',
          'Yes. Validate-Pro handles concurrent updates safely. However, checking the "Online Validators" pill is recommended to coordinate which students each auditor is calling.'
        ),
        createBulletItem(
          'Q5: How fast does the system load with over 150,000 students?',
          'Center and batch metadata loads in approximately 30 to 40 milliseconds thanks to targeted database indexing and server-side response compression.'
        ),

        new Paragraph({ spacing: { before: 140, after: 80 } }),

        // SECTION 7: SUMMARY & DOWNLOAD INSTRUCTIONS
        createHeading1('7. Document Information & Support Contact'),
        createBodyParagraph(
          'This user guide is maintained for all Validate-Pro stakeholders. For technical support, account provisioning, or custom reporting requests, please reach out to your system administrator or technical support team.'
        ),
        createCalloutBox(
          'Downloadable Word Document (.docx)',
          'This complete user manual is available as a downloadable Word file directly from the Validate-Pro application navigation and through the public server link.'
        )
      ]
    }
  ]
});

console.log('Packaging Word Document into Buffer...');
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = path.join(process.cwd(), 'public', 'Validate_Pro_User_Guide_and_Feature_Overview.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log('Word document successfully written to:', outputPath);
  console.log('File size:', buffer.length, 'bytes');
}).catch((err) => {
  console.error('Error generating document:', err);
});
