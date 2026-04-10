const _state = {};
const _listeners = {};

function dispatch(key, value) {
  window.dispatchEvent(new CustomEvent('store:change', { detail: { key, value } }));
  if (_listeners[key]) {
    _listeners[key].forEach(cb => cb(value));
  }
}

export const Store = {
  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
    dispatch(key, value);
  },

  on(key, callback) {
    if (!_listeners[key]) _listeners[key] = new Set();
    _listeners[key].add(callback);
    return () => _listeners[key].delete(callback);
  },

  get userRole() {
    return _state.user?.role ?? null;
  },

  get isLoggedIn() {
    return !!_state.user;
  },

  get isManager() {
    return ['manager', 'admin'].includes(_state.user?.role);
  },

  get isAdmin() {
    return _state.user?.role === 'admin';
  },
};
