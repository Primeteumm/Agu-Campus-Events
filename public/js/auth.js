const API_URL = '/api';

const authModal = document.getElementById('authModal');
const cardContainer = document.getElementById('cardContainer');
const openAuthBtn = document.getElementById('openAuthModal');

function openModal() {
    authModal.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeModal() {
    authModal.classList.remove('active');
    setTimeout(() => cardContainer.classList.remove('flipped'), 350);
    clearErrors();
}

openAuthBtn.addEventListener('click', openModal);
document.getElementById('closeLogin').addEventListener('click', closeModal);
document.getElementById('closeSignup').addEventListener('click', closeModal);

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
});

document.getElementById('goToSignup').addEventListener('click', (e) => {
    e.preventDefault();
    cardContainer.classList.add('flipped');
    clearErrors();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

document.getElementById('goToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    cardContainer.classList.remove('flipped');
    clearErrors();
});

function clearErrors() {
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
    document.getElementById('signupSuccess').textContent = '';
}

function saveSessionAndRedirect(data) {
    const tok = data.token || data.access_token;
    if (tok) localStorage.setItem('token', tok);
    if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
    if (typeof persistUser === 'function') persistUser(data.user);
    else localStorage.setItem('user', JSON.stringify(data.user));
}

// ── Login ──
let _loginLoading = false;
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (_loginLoading) return;
    _loginLoading = true;

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.querySelector('#loginForm .btn-submit');
    errorEl.textContent = '';

    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Login failed';
            return;
        }

        saveSessionAndRedirect(data);
        closeModal();
        updateNavbar();
        if (typeof syncSidebarFromStorage === 'function') syncSidebarFromStorage();
        if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
        window.dispatchEvent(new CustomEvent('auth-updated', { detail: { token: localStorage.getItem('token'), user: data.user } }));
    } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
    } finally {
        _loginLoading = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
});

// ── Register (no email verification) ──
let _signupLoading = false;
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (_signupLoading) return;
    _signupLoading = true;

    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const accountType = document.querySelector('input[name="accountType"]:checked')?.value || 'student';
    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');
    const submitBtn = document.querySelector('#signupForm .btn-submit');
    errorEl.textContent = '';
    successEl.textContent = '';

    submitBtn.classList.add('btn-loading');
    submitBtn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password, accountType }),
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Registration failed';
            return;
        }

        if (!data.token && !data.access_token) {
            successEl.style.color = 'var(--success)';
            successEl.textContent = data.message || 'Registration successful. You can log in now.';
            // Switch to login side slightly after viewing message
            setTimeout(() => {
                document.getElementById('goToLogin').click();
            }, 3000);
            return;
        }

        saveSessionAndRedirect(data);
        closeModal();
        updateNavbar();
        if (typeof syncSidebarFromStorage === 'function') syncSidebarFromStorage();
        if (typeof dispatchUserUpdated === 'function') dispatchUserUpdated();
        window.dispatchEvent(new CustomEvent('auth-updated', { detail: { token: localStorage.getItem('token'), user: data.user } }));
    } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
    } finally {
        _signupLoading = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.disabled = false;
    }
});

// ── Navbar ──
function updateNavbar() {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const actionsDiv = document.querySelector('.navbar-actions');
    const loginBtn = document.getElementById('openAuthModal');

    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';

        const old = actionsDiv.querySelector('.user-info');
        if (old) old.remove();

        const displayName = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'user-name';
        nameSpan.textContent = displayName;

        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn-logout';
        logoutBtn.id = 'logoutBtn';
        logoutBtn.type = 'button';
        logoutBtn.innerHTML = '<i data-lucide="log-out" class="icon"></i><span>Logout</span>';

        userInfo.appendChild(nameSpan);
        userInfo.appendChild(logoutBtn);

        const themeBtn = actionsDiv.querySelector('.theme-toggle');
        if (themeBtn) actionsDiv.insertBefore(userInfo, themeBtn);
        else actionsDiv.appendChild(userInfo);

        if (typeof lucide !== 'undefined') lucide.createIcons();

        logoutBtn.addEventListener('click', () => {
            if (typeof clearProfileMeCache === 'function') clearProfileMeCache();
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            location.reload();
        });
    } else {
        if (loginBtn) loginBtn.style.display = 'flex';
        const old = actionsDiv.querySelector('.user-info');
        if (old) old.remove();
    }
}

updateNavbar();
if (typeof syncSidebarFromStorage === 'function') {
    syncSidebarFromStorage();
}
