#!/bin/bash
cat src/index.css | awk '
/^@theme \{/ {
  print "@theme {"
  print "  --color-white: var(--white);"
  print "  --color-slate-900: var(--slate-900);"
  print "  --color-slate-800: var(--slate-800);"
  print "  --color-slate-700: var(--slate-700);"
  print "  --color-slate-600: var(--slate-600);"
  print "  --color-slate-500: var(--slate-500);"
  print "  --color-slate-400: var(--slate-400);"
  print "  --color-slate-300: var(--slate-300);"
  print "  --color-slate-200: var(--slate-200);"
  print "  --color-slate-100: var(--slate-100);"
  print "  --color-slate-50: var(--slate-50);"
  next
}
/:root \{/ {
  print ":root {"
  print "    --white: #ffffff;"
  print "    --slate-900: #0f172a;"
  print "    --slate-800: #1e293b;"
  print "    --slate-700: #334155;"
  print "    --slate-600: #475569;"
  print "    --slate-500: #64748b;"
  print "    --slate-400: #94a3b8;"
  print "    --slate-300: #cbd5e1;"
  print "    --slate-200: #e2e8f0;"
  print "    --slate-100: #f1f5f9;"
  print "    --slate-50: #f8fafc;"
  next
}
/\.theme-midnight \{/ {
  print ".theme-midnight {"
  print "    --white: #0f172a;"
  print "    --slate-900: #f8fafc;"
  print "    --slate-800: #f1f5f9;"
  print "    --slate-700: #e2e8f0;"
  print "    --slate-600: #cbd5e1;"
  print "    --slate-500: #94a3b8;"
  print "    --slate-400: #64748b;"
  print "    --slate-300: #475569;"
  print "    --slate-200: #334155;"
  print "    --slate-100: #1e293b;"
  print "    --slate-50: #020617;"
  next
}
{ print }
' > src/index.css.tmp
mv src/index.css.tmp src/index.css
