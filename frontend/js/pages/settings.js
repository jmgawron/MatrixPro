import { api } from '../api.js';
import { Store } from '../state.js';
import { showToast } from '../components/toast.js';
import { AVATAR_CATALOG, getAvatarSvg, renderAvatarThumbnail } from '../components/avatars.js';

export function mountSettings(container) {
  container.innerHTML = '<div class="settings-loading">Loading...</div>';
  renderSettingsPage(container);
}

async function renderSettingsPage(container) {
  const user = Store.get('user');
  if (!user) return;

  container.innerHTML = `
    <div class="settings-page">
      <div class="page-hero settings-hero">
        <div class="hero-content">
          <h1 class="hero-title">Settings</h1>
          <p class="hero-subtitle">Manage your profile and preferences</p>
        </div>
      </div>
      <div class="settings-grid">
        <section class="settings-card profile-card">
          <h2 class="settings-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </h2>
          <div class="profile-avatar-section">
            <div class="profile-avatar-current" id="currentAvatar">
              ${renderAvatarThumbnail(user.avatar, 72)}
            </div>
            <button class="btn btn-secondary btn-sm" id="changeAvatarBtn">Change Avatar</button>
          </div>
          <form id="profileForm" class="settings-form">
            <div class="form-row">
              <div class="form-group">
                <label for="profileName">First Name</label>
                <input type="text" id="profileName" value="${escHtml(user.name)}" required>
              </div>
              <div class="form-group">
                <label for="profileSurname">Last Name</label>
                <input type="text" id="profileSurname" value="${escHtml(user.surname || '')}" required>
              </div>
            </div>
            <div class="form-group">
              <label for="profileEmail">Email</label>
              <input type="email" id="profileEmail" value="${escHtml(user.email)}" disabled>
              <span class="form-hint">Contact an administrator to change your email</span>
            </div>
            <div class="form-group">
              <label>Role</label>
              <input type="text" value="${user.role}" disabled class="form-input-muted">
            </div>
            <button type="submit" class="btn btn-primary">Save Profile</button>
          </form>
        </section>

        <section class="settings-card password-card">
          <h2 class="settings-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Change Password
          </h2>
          <form id="passwordForm" class="settings-form">
            <div class="form-group">
              <label for="currentPassword">Current Password</label>
              <input type="password" id="currentPassword" required autocomplete="current-password">
            </div>
            <div class="form-group">
              <label for="newPassword">New Password</label>
              <input type="password" id="newPassword" required minlength="6" autocomplete="new-password">
              <span class="form-hint">Minimum 6 characters</span>
            </div>
            <div class="form-group">
              <label for="confirmPassword">Confirm New Password</label>
              <input type="password" id="confirmPassword" required autocomplete="new-password">
            </div>
            <button type="submit" class="btn btn-primary">Change Password</button>
          </form>
        </section>
      </div>

      <div id="avatarPickerOverlay" class="avatar-picker-overlay hidden">
        <div class="avatar-picker-modal">
          <div class="avatar-picker-header">
            <h3>Choose Your Avatar</h3>
            <button class="avatar-picker-close" id="closeAvatarPicker">&times;</button>
          </div>
          <div class="avatar-picker-grid" id="avatarGrid"></div>
        </div>
      </div>
    </div>
  `;

  // Avatar picker
  const avatarGrid = container.querySelector('#avatarGrid');
  AVATAR_CATALOG.forEach(av => {
    const btn = document.createElement('button');
    btn.className = 'avatar-picker-item' + (user.avatar === av.id ? ' selected' : '');
    btn.title = av.label;
    btn.innerHTML = renderAvatarThumbnail(av.id, 48);
    btn.addEventListener('click', async () => {
      try {
        const updated = await api.put('/api/auth/me/profile', { avatar: av.id });
        Store.set('user', { ...user, avatar: av.id });
        container.querySelector('#currentAvatar').innerHTML = renderAvatarThumbnail(av.id, 72);
        avatarGrid.querySelectorAll('.avatar-picker-item').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        container.querySelector('#avatarPickerOverlay').classList.add('hidden');
        showToast({ message: 'Avatar updated', type: 'success' });
      } catch (err) {
        showToast({ message: 'Failed to update avatar', type: 'error' });
      }
    });
    avatarGrid.appendChild(btn);
  });

  container.querySelector('#changeAvatarBtn').addEventListener('click', () => {
    container.querySelector('#avatarPickerOverlay').classList.remove('hidden');
  });
  container.querySelector('#closeAvatarPicker').addEventListener('click', () => {
    container.querySelector('#avatarPickerOverlay').classList.add('hidden');
  });
  container.querySelector('#avatarPickerOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add('hidden');
    }
  });

  // Profile form
  container.querySelector('#profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#profileName').value.trim();
    const surname = container.querySelector('#profileSurname').value.trim();
    if (!name) return;
    try {
      const updated = await api.put('/api/auth/me/profile', { name, surname });
      Store.set('user', { ...Store.get('user'), name: updated.name, surname: updated.surname });
      showToast({ message: 'Profile updated', type: 'success' });
    } catch (err) {
      showToast({ message: 'Failed to update profile', type: 'error' });
    }
  });

  // Password form
  container.querySelector('#passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = container.querySelector('#currentPassword').value;
    const newPassword = container.querySelector('#newPassword').value;
    const confirmPassword = container.querySelector('#confirmPassword').value;

    if (newPassword !== confirmPassword) {
      showToast({ message: 'Passwords do not match', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      showToast({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }
    try {
      await api.put('/api/auth/me/password', { current_password: currentPassword, new_password: newPassword });
      container.querySelector('#passwordForm').reset();
      showToast({ message: 'Password changed successfully', type: 'success' });
    } catch (err) {
      const msg = err?.message || 'Failed to change password';
      showToast({ message: msg, type: 'error' });
    }
  });
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
