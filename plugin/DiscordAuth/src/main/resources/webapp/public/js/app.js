// ─── DOM要素 ─────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const navUserSection = $('#nav-user-section');
const navAvatar = $('#nav-avatar');
const navUsername = $('#nav-username');
const loginSection = $('#login-section');
const dashboardSection = $('#dashboard-section');
const guildWarning = $('#guild-warning');
const statusLinked = $('#status-linked');
const statusUnlinked = $('#status-unlinked');
const linkForm = $('#link-form');
const unlinkBtn = $('#unlink-btn');
const mcAvatar = $('#mc-avatar');
const mcUsername = $('#mc-username');
const mcUuid = $('#mc-uuid');
const mcInput = $('#mc-input');
const linkBtn = $('#link-btn');
const toastContainer = $('#toast-container');

// ─── トースト通知 ─────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeOut');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── APIヘルパー ─────────────────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  return res.json();
}

// ─── UI描画 ──────────────────────────────────────────────
function renderLoggedOut() {
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  navUserSection.classList.add('hidden');
}

function renderLoggedIn(user, status) {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  navUserSection.classList.remove('hidden');

  // ナビゲーターのユーザー情報
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`;
  navAvatar.src = avatarUrl;
  navUsername.textContent = user.globalName || user.username;

  // サーバーメンバーシップチェック
  if (!status.isInGuild) {
    guildWarning.classList.remove('hidden');
    linkForm.classList.add('hidden');
    statusUnlinked.classList.remove('hidden');
    statusLinked.classList.add('hidden');
    unlinkBtn.classList.add('hidden');
    return;
  }
  guildWarning.classList.add('hidden');

  if (status.linked && status.account) {
    // 連携済み表示
    statusLinked.classList.remove('hidden');
    statusUnlinked.classList.add('hidden');
    linkForm.classList.add('hidden');
    unlinkBtn.classList.remove('hidden');

    mcAvatar.src = `https://mc-heads.net/avatar/${status.account.minecraft_uuid}/56`;
    mcUsername.textContent = status.account.minecraft_username;
    mcUuid.textContent = status.account.minecraft_uuid;
  } else {
    // 連携フォーム表示
    statusLinked.classList.add('hidden');
    statusUnlinked.classList.remove('hidden');
    linkForm.classList.remove('hidden');
    unlinkBtn.classList.add('hidden');
  }
}

// ─── 初期化 ──────────────────────────────────────────────
async function init() {
  // URLのエラーパラメータを確認
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  if (error) {
    const messages = {
      token_failed: 'Discord認証に失敗しました。もう一度お試しください。',
      no_code: 'Discord認証コードが取得できませんでした。',
      auth_failed: '認証エラーが発生しました。もう一度お試しください。',
      oauth_denied: 'Discord認証がキャンセルされました。',
    };
    showToast(messages[error] || '認証エラーが発生しました。', 'error');
    // URLからエラーパラメータを削除
    window.history.replaceState({}, '', '/');
  }

  try {
    const authData = await api('/auth/me');

    if (!authData.loggedIn) {
      renderLoggedOut();
      return;
    }

    const statusData = await api('/api/status');
    renderLoggedIn(authData.user, statusData);
  } catch (err) {
    console.error('初期化エラー:', err);
    renderLoggedOut();
  }
}

// ─── アカウント連携 ──────────────────────────────────────
linkBtn.addEventListener('click', async () => {
  const username = mcInput.value.trim();
  if (!username || username.length < 3) {
    showToast('有効なMinecraftユーザー名を入力してください（3文字以上）', 'error');
    return;
  }

  linkBtn.disabled = true;
  linkBtn.innerHTML = '<div class="spinner"></div> 連携中...';

  try {
    const result = await api('/api/link', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });

    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast(`${result.account.minecraft_username} との連携が完了しました！`, 'success');
      mcInput.value = '';
      // UIを更新
      const statusData = await api('/api/status');
      const authData = await api('/auth/me');
      renderLoggedIn(authData.user, statusData);
    }
  } catch (err) {
    showToast('連携に失敗しました。もう一度お試しください。', 'error');
  } finally {
    linkBtn.disabled = false;
    linkBtn.innerHTML = '連携する';
  }
});

// ─── アカウント連携解除 ──────────────────────────────────
unlinkBtn.addEventListener('click', async () => {
  if (!confirm('Minecraftアカウントの連携を解除しますか？')) return;

  unlinkBtn.disabled = true;
  try {
    const result = await api('/api/unlink', { method: 'POST' });
    if (result.error) {
      showToast(result.error, 'error');
    } else {
      showToast('アカウントの連携を解除しました', 'success');
      const statusData = await api('/api/status');
      const authData = await api('/auth/me');
      renderLoggedIn(authData.user, statusData);
    }
  } catch (err) {
    showToast('連携解除に失敗しました。もう一度お試しください。', 'error');
  } finally {
    unlinkBtn.disabled = false;
  }
});

// ─── Enterキーで送信 ─────────────────────────────────────
mcInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') linkBtn.click();
});

// 起動
init();
