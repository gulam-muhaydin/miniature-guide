const API_URL = '/api';

function getPopupContainer() {
    let container = document.getElementById('popup-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'popup-container';
        container.className = 'popup-container';
        document.body.appendChild(container);
    }
    return container;
}

function showPopup(message, type = 'info', duration = 2500) {
    if (!message) return;
    const container = getPopupContainer();
    const popup = document.createElement('div');
    popup.className = `popup popup-${type}`;
    popup.setAttribute('role', 'alert');
    popup.textContent = message;
    container.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add('show'));
    const removePopup = () => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 200);
    };
    setTimeout(removePopup, duration);
}

window.showPopup = showPopup;

async function fileExists(url) {
    try {
        const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        return res.ok;
    } catch (e) {
        return false;
    }
}

function initDownloadLinks() {
    const links = document.querySelectorAll('a[href="/EarnTube.apk"]');
    if (!links.length) return;

    links.forEach((link) => {
        link.addEventListener('click', async (e) => {
            const ok = await fileExists('/EarnTube.apk');
            if (ok) return;
            e.preventDefault();
            showPopup('App file available nahi hai (EarnTube.apk missing).', 'error');
        });
    });
}

document.addEventListener('DOMContentLoaded', initDownloadLinks);
document.addEventListener('DOMContentLoaded', () => {
    try {
        const uid = getCookieValue('uid');
        if (uid && window.localStorage && !window.localStorage.getItem('uid')) {
            window.localStorage.setItem('uid', uid);
        }
    } catch (e) {}
});

let isLogin = true;

function getCookieValue(name) {
    return document.cookie
        .split(';')
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))
        ?.split('=')
        .slice(1)
        .join('=') || '';
}

function setUidCookie(user) {
    const userId = user?.id || user?._id;
    if (!userId) return;
    const maxAge = 7 * 24 * 60 * 60;
    document.cookie = `uid=${encodeURIComponent(userId)}; Path=/; SameSite=Lax; Max-Age=${maxAge}`;
    try {
        window.localStorage && window.localStorage.setItem('uid', String(userId));
    } catch (e) {}
}

function updateAuthUI() {
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-btn');
    const usernameGroup = document.getElementById('username-group');
    const toggle = document.getElementById('auth-toggle');
    if (!title || !btn || !usernameGroup || !toggle) return;
    title.innerText = isLogin ? 'Welcome Back' : 'Create Account';
    if (subtitle) {
        subtitle.innerText = isLogin
            ? 'Enter your credentials to access your account'
            : 'Join thousands of users earning daily';
    }
    btn.innerText = isLogin ? 'Sign In' : 'Create Account';
    usernameGroup.style.display = isLogin ? 'none' : 'block';
    toggle.innerHTML = isLogin
        ? "New to EarnTube? <span onclick='toggleAuth()'>Create an account</span>"
        : "Already have an account? <span onclick='toggleAuth()'>Sign In</span>";
}

function toggleAuth() {
    isLogin = !isLogin;
    updateAuthUI();
}

// Auth Form Handling
if (document.getElementById('auth-form')) {
    updateAuthUI();
    document.getElementById('auth-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const username = document.getElementById('username')?.value;

        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');
        const endpoint = isLogin ? '/auth/login' : '/auth/signup';
        const body = isLogin ? { email, password } : { email, password, username, referredBy: ref };

        try {
            const res = await fetch(API_URL + endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                setUidCookie(data.user);
                checkRedirect(data.user);
            } else {
                showPopup(data.message || 'Error occurred', 'error');
            }
        } catch (err) {
            showPopup('Server error', 'error');
        }
    };
}

function checkRedirect(user) {
    const userId = user.id || user._id;
    if (user.plan === 'none') {
        const url = new URL('/plans.html', window.location.origin);
        if (userId) url.searchParams.set('uid', userId);
        window.location.href = url.toString();
    } else if (user.paymentProof && user.paymentProof.status === 'pending') {
        window.location.href = '/waiting.html';
    } else if (user.isApproved) {
        window.location.href = '/dashboard.html';
    } else if (user.paymentProof && user.paymentProof.status === 'none') {
        const url = new URL('/payment.html', window.location.origin);
        if (userId) url.searchParams.set('uid', userId);
        window.location.href = url.toString();
    } else {
        window.location.href = '/plans.html';
    }
}

// Plans Selection
function selectPlan(plan, price) {
    const url = new URL('payment.html', window.location.origin);
    url.searchParams.set('plan', plan);
    url.searchParams.set('price', price);
    const currentParams = new URLSearchParams(window.location.search);
    const uid = currentParams.get('uid') || (window.localStorage && window.localStorage.getItem('uid')) || getCookieValue('uid');
    if (uid) url.searchParams.set('uid', uid);
    window.location.href = url.toString();
}

// Payment Form
if (document.getElementById('payment-form')) {
    let isSubmittingPayment = false;
    document.getElementById('payment-form').onsubmit = async (e) => {
        e.preventDefault();
        if (isSubmittingPayment) return;
        const method = 'JazzCash';
        const transactionId = document.getElementById('transactionId')?.value;
        const params = new URLSearchParams(window.location.search);
        const plan = params.get('plan');
        const userId = params.get('uid') || (window.localStorage && window.localStorage.getItem('uid')) || getCookieValue('uid');

        const form = document.getElementById('payment-form');
        const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
        const btnText = submitBtn ? submitBtn.querySelector('.btn-text') : null;
        const btnLoader = submitBtn ? submitBtn.querySelector('.btn-loader') : null;

        if (!userId) {
            showPopup('Session missing. Please open Plans page and select plan again.', 'warning');
            return;
        }

        try {
            isSubmittingPayment = true;
            if (submitBtn) submitBtn.disabled = true;
            if (btnLoader) btnLoader.classList.remove('hidden');
            if (btnText) btnText.classList.add('hidden');

            const res = await fetch(API_URL + '/payment/submit', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Id': userId
                },
                credentials: 'include',
                body: JSON.stringify({ method, transactionId, plan, userId })
            });
            const data = await res.json();
            if (res.ok) {
                showPopup('Payment proof submitted! Please wait for approval.', 'success');
                window.location.href = '/waiting.html';
            } else {
                if (res.status === 401 || res.status === 404) {
                    showPopup(data.message || 'Session expired. Please try again.', 'warning');
                }
                showPopup(data.message || 'Error submitting payment', 'error');
            }
        } catch (err) {
            showPopup('Error submitting payment', 'error');
        } finally {
            isSubmittingPayment = false;
            if (submitBtn) submitBtn.disabled = false;
            if (btnLoader) btnLoader.classList.add('hidden');
            if (btnText) btnText.classList.remove('hidden');
        }
    };
}

// Dashboard Logic
async function checkUserStatus() {
    try {
        const res = await fetch(API_URL + '/user/profile', {
            credentials: 'include'
        });
        const user = await res.json();
        
        if (!res.ok) {
            if (res.status === 401 || res.status === 404) {
                window.location.href = '/index.html';
            }
            return;
        }

        const currentPage = window.location.pathname.split('/').pop();

        if (!user.isApproved) {
            if (currentPage === 'dashboard.html') {
                window.location.href = '/waiting.html';
                return;
            }
            if (document.getElementById('user-display')) {
                document.getElementById('user-display').innerText = user.username;
            }
            if (document.getElementById('status-message')) {
                document.getElementById('status-message').style.display = 'block';
            }
            if (document.getElementById('main-content')) {
                document.getElementById('main-content').style.display = 'none';
            }
        } else {
            if (currentPage === 'waiting.html') {
                window.location.href = '/dashboard.html';
                return;
            }
            if (document.getElementById('user-display')) {
                document.getElementById('user-display').innerText = user.username;
            }
            if (document.getElementById('status-message')) {
                document.getElementById('status-message').style.display = 'none';
            }
            if (document.getElementById('main-content')) {
                document.getElementById('main-content').style.display = 'block';
                document.getElementById('balance').innerText = `Rs. ${user.balance}`;
                document.getElementById('current-plan').innerText = user.plan;
                if (document.getElementById('total-referrals')) {
                    document.getElementById('total-referrals').innerText = user.referralCount || 0;
                }
                if (document.getElementById('videos-left')) {
                    document.getElementById('videos-left').innerText = `${user.videosLeft} Left`;
                }
            }
        }
    } catch (err) {
        console.error('Error fetching status');
    }
}

async function watchVideo() {
    // In a real app, this would hit an API to increment balance
    showPopup('Video watched! Rs. 50 added to balance (demo only)', 'success');
    // Refresh status
    checkUserStatus();
}

function logout() {
    fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' })
        .finally(() => {
            try {
                window.localStorage && window.localStorage.removeItem('uid');
            } catch (e) {}
            window.location.href = '/index.html';
        });
}

function initMobileHamburgerMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    const body = document.body;
    const topBar = document.querySelector('.top-bar');

    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const buildButton = () => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hamburger-btn';
        btn.setAttribute('aria-label', 'Menu');
        btn.innerHTML = `
            <span class="hamburger-lines" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
            </span>
        `;
        return btn;
    };

    let button = document.querySelector('.hamburger-btn');
    if (!button) {
        button = buildButton();
        if (topBar) {
            topBar.insertBefore(button, topBar.firstChild);
        } else {
            button.classList.add('hamburger-floating');
            document.body.appendChild(button);
        }
    }

    const closeMenu = () => body.classList.remove('sidebar-open');
    const toggleMenu = () => body.classList.toggle('sidebar-open');

    button.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', closeMenu);

    sidebar.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.closest && target.closest('a')) closeMenu();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMenu();
    });
}

document.addEventListener('DOMContentLoaded', initMobileHamburgerMenu);
