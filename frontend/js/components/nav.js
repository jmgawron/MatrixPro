import { Store } from '../state.js';
import { Router } from '../router.js';
import { renderAvatarThumbnail } from './avatars.js';

const ROLE_RANK = { engineer: 1, manager: 2, admin: 3 };

const NAV_ITEMS = [
  { label: 'Home', href: '/', minRole: null },
  { label: 'My Plan', href: '/my-plan', minRole: 'engineer' },
  { label: 'My Team', href: '/my-team', minRole: 'manager' },
  { label: 'Catalog', href: '/catalog', minRole: 'engineer' },
  { label: 'Skill Explorer', href: '/skill-explorer', minRole: 'engineer' },
  { label: 'Admin', href: '/admin', minRole: 'admin' },
];

function rankOf(role) {
  return ROLE_RANK[role] ?? 0;
}

function canAccess(item, userRole) {
  if (!item.minRole) return true;
  return rankOf(userRole) >= rankOf(item.minRole);
}

function buildNavLinks(userRole, isLoggedIn) {
  const visible = NAV_ITEMS.filter(item => canAccess(item, userRole));
  return visible.map(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${item.href}`;
    a.textContent = item.label;
    a.setAttribute('data-route-link', '');
    li.appendChild(a);
    return li;
  });
}

function buildAuthItem(isLoggedIn, user) {
  const li = document.createElement('li');
  li.className = 'nav-auth';
  if (isLoggedIn) {
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-user-dropdown';

    const trigger = document.createElement('button');
    trigger.className = 'nav-user-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');

    const avatarHtml = renderAvatarThumbnail(user?.avatar, 28);
    const nameText = user?.name ?? user?.email ?? 'Account';
    trigger.innerHTML = `${avatarHtml}<span class="nav-user-name">${nameText}</span><svg class="nav-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

    const menu = document.createElement('div');
    menu.className = 'nav-dropdown-menu';

    const settingsLink = document.createElement('a');
    settingsLink.href = '#/settings';
    settingsLink.className = 'nav-dropdown-item';
    settingsLink.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-6.7-1.4 1.4M6.7 17.3l-1.4 1.4m0-13.4 1.4 1.4m10.6 10.6 1.4 1.4"/></svg> Settings`;
    settingsLink.addEventListener('click', () => { menu.classList.remove('open'); });

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-dropdown-item nav-dropdown-logout';
    logoutBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout`;
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('matrixpro_token');
      Store.set('user', null);
      Router.go('/login');
    });

    menu.appendChild(settingsLink);
    menu.appendChild(logoutBtn);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        menu.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    li.appendChild(wrapper);
  }
  return li;
}

function closeAllDropdowns() {
  document.querySelectorAll('.nav-dropdown-menu.open').forEach(m => m.classList.remove('open'));
  document.querySelectorAll('.nav-user-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
}

function renderNav() {
  const navLinks = document.getElementById('navLinks');
  const mobileMenu = document.getElementById('mobileMenu');
  if (!navLinks) return;

  const user = Store.get('user');
  const userRole = user?.role ?? null;
  const isLoggedIn = !!user;

  navLinks.innerHTML = '';
  mobileMenu.innerHTML = '';

  const items = buildNavLinks(userRole, isLoggedIn);
  items.forEach(li => navLinks.appendChild(li));
  navLinks.appendChild(buildAuthItem(isLoggedIn, user));

  const currentPath = Router.current();
  const allLinks = NAV_ITEMS.filter(item => canAccess(item, userRole));
  allLinks.forEach(item => {
    const a = document.createElement('a');
    a.href = `#${item.href}`;
    a.textContent = item.label;
    a.setAttribute('data-route-link', '');
    const isActive = item.href === currentPath || (item.href !== '/' && currentPath.startsWith(item.href));
    if (isActive) a.classList.add('active');
    mobileMenu.appendChild(a);
  });

  if (isLoggedIn) {
    const settingsA = document.createElement('a');
    settingsA.href = '#/settings';
    settingsA.textContent = 'Settings';
    settingsA.addEventListener('click', () => closeMobileMenu());
    mobileMenu.appendChild(settingsA);

    const logoutA = document.createElement('a');
    logoutA.href = '#';
    logoutA.textContent = 'Logout';
    logoutA.addEventListener('click', e => {
      e.preventDefault();
      localStorage.removeItem('matrixpro_token');
      Store.set('user', null);
      Router.go('/login');
      closeMobileMenu();
    });
    mobileMenu.appendChild(logoutA);
  }
}

function closeMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.getElementById('navHamburger');
  menu?.classList.remove('open');
  if (hamburger) {
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.classList.remove('open');
  }
}

export function initNav(routes) {
  renderNav();

  Store.on('user', () => renderNav());

  window.addEventListener('hashchange', () => {
    renderNav();
    closeMobileMenu();
  });

  document.addEventListener('click', () => closeAllDropdowns());

  const hamburger = document.getElementById('navHamburger');
  hamburger?.addEventListener('click', () => {
    const menu = document.getElementById('mobileMenu');
    const isOpen = menu?.classList.contains('open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      menu?.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      hamburger.classList.add('open');
    }
  });
}
