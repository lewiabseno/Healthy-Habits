const toastEl = document.getElementById('toast');
let toastTimer = null;

export function showToast(message, type = '') {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.className = 'toast' + (type ? ' ' + type : '');
  // Force reflow
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimer = null;
  }, 3000);
}
