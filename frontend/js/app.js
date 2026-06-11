import { Router } from './router.js?v=9';
import { Store } from './state.js';
import { api } from './api.js';
import { parseBuildFromModuleUrl, formatAppVersion } from './version.js';
import { initNav } from './components/nav.js?v=9';
import { initThemeToggle } from './components/theme.js';
import { initFeedbackButton } from './components/feedback.js';

import { mountHome } from './pages/home.js?v=30';
import { mountLogin } from './pages/login.js?v=3';
import { mountMyPlan } from './pages/my-plan.js?v=60';
import { mountMyTeam } from './pages/my-team.js?v=27';
import { mountCatalog } from './pages/catalog.js?v=45';
import { mountSkillExplorer } from './pages/skill-explorer.js?v=19';
import { mountSettings } from './pages/settings.js';
import { mountAdmin } from './pages/admin.js?v=7';

Store.set('appVersion', formatAppVersion(parseBuildFromModuleUrl(import.meta.url)));

const routes = {
  '/': { mount: mountHome, title: 'Home', minRole: null, public: true },
  '/login': { mount: mountLogin, title: 'Login', minRole: null, public: true },
  '/my-plan': { mount: mountMyPlan, title: 'My Plan', minRole: 'engineer', excludeRoles: ['admin'] },
  '/my-plan/:id': { mount: mountMyPlan, title: 'My Plan', minRole: 'manager', excludeRoles: ['admin'] },
  '/my-team': { mount: mountMyTeam, title: 'My Team', minRole: 'manager', excludeRoles: ['admin'] },
  '/catalog': { mount: mountCatalog, title: 'Catalog Explorer', minRole: 'engineer' },
  '/skill-explorer': { mount: mountSkillExplorer, title: 'Skill Explorer', minRole: 'engineer' },
  '/settings': { mount: mountSettings, title: 'Settings', minRole: 'engineer' },
  '/admin': { mount: mountAdmin, title: 'Admin Panel', minRole: 'admin' },
};

async function init() {
  initThemeToggle();
  initFeedbackButton();

  const token = localStorage.getItem('matrixpro_token');
  if (token) {
    try {
      const user = await api.get('/api/auth/me');
      Store.set('user', user);
    } catch {
      localStorage.removeItem('matrixpro_token');
    }
  }

  initNav(routes);
  Router.init(routes, document.getElementById('app'));
}

init().catch((err) => {
  console.error('MatrixPro init failed:', err);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<div class="empty-state"><h2>Failed to start</h2><p>${err?.message || 'Unknown error'}</p></div>`;
  }
});
