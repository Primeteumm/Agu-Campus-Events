const API_URL = 'http://localhost:3000/api';

// ===========================
// DOM Elements
// ===========================
const authModal = document.getElementById('authModal');
const cardContainer = document.getElementById('cardContainer');
const openAuthBtn = document.getElementById('openAuthModal');

// ===========================
// Modal Open / Close
// ===========================
function openModal() {
    authModal.classList.add('active');
}

function closeModal() {
    authModal.classList.remove('active');
    // Reset flip to login side after close
    setTimeout(() => cardContainer.classList.remove('flipped'), 350);
    clearErrors();
}

openAuthBtn.addEventListener('click', openModal);
document.getElementById('closeLogin').addEventListener('click', closeModal);
document.getElementById('closeSignup').addEventListener('click', closeModal);

// Close on overlay click
authModal.addEventListener('click', (e) => {
    if (e.target === authModal) closeModal();
});

// ===========================
// Card Flip
// ===========================
document.getElementById('goToSignup').addEventListener('click', (e) => {
    e.preventDefault();
    cardContainer.classList.add('flipped');
    clearErrors();
});

document.getElementById('goToLogin').addEventListener('click', (e) => {
    e.preventDefault();
    cardContainer.classList.remove('flipped');
    clearErrors();
});

// ===========================
// Clear Errors
// ===========================
function clearErrors() {
    document.getElementById('loginError').textContent = '';
    document.getElementById('signupError').textContent = '';
    document.getElementById('signupSuccess').textContent = '';
}

// ===========================
// Login Form
// ===========================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Login failed';
            return;
        }

        // Save token and user info
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        closeModal();
        updateNavbar();
    } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
    }
});

// ===========================
// Signup Form
// ===========================
document.getElementById('signupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            errorEl.textContent = data.message || 'Registration failed';
            return;
        }

        // Show success and flip back to login
        successEl.textContent = 'Account created! Redirecting to login...';
        setTimeout(() => {
            cardContainer.classList.remove('flipped');
            successEl.textContent = '';
            // Pre-fill email in login form
            document.getElementById('loginEmail').value = email;
        }, 1500);
    } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
    }
});

// ===========================
// Navbar Update (Login State)
// ===========================
function updateNavbar() {
    const user = JSON.parse(localStorage.getItem('user'));
    const actionsDiv = document.querySelector('.navbar-actions');

    if (user) {
        // Replace login button with user info + logout
        openAuthBtn.style.display = 'none';

        // Remove old user-info if exists
        const old = actionsDiv.querySelector('.user-info');
        if (old) old.remove();

        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <span class="user-name">${user.name}</span>
            <button class="btn-logout" id="logoutBtn">
                <i data-lucide="log-out" class="icon"></i>
                <span>Logout</span>
            </button>
        `;
        actionsDiv.insertBefore(userInfo, actionsDiv.querySelector('.theme-toggle'));
        lucide.createIcons();

        // Logout handler
        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            location.reload();
        });
    } else {
        openAuthBtn.style.display = 'flex';
    }
}

// Check login state on page load
updateNavbar();
