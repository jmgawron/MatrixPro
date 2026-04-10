const THEME_KEY = 'matrixpro-theme';

function applyTheme(theme) {
  const btn = document.getElementById('themeToggle');
  if (theme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    if (btn) btn.textContent = '☀️';
  } else {
    document.body.removeAttribute('data-theme');
    if (btn) btn.textContent = '🌙';
  }
}

export function initThemeToggle() {
  const saved = localStorage.getItem(THEME_KEY) ?? 'dark';
  applyTheme(saved);

  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const next = isLight ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}
