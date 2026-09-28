// Applies the saved theme before the app renders, so there is no flash of the wrong theme.
// Kept as an external file because the Content-Security-Policy blocks inline scripts.
// Must match STORAGE_KEY in src/app/ThemeProvider.tsx.
;(function () {
  var pref = 'system'
  try {
    var v = localStorage.getItem('pf.theme')
    if (v === 'light' || v === 'dark' || v === 'system') pref = v
  } catch {}
  var theme = pref
  if (pref === 'system') {
    try {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    } catch {
      theme = 'dark'
    }
  }
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
})()
