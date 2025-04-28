// Global variables
let currentUser = null;
let pools = [];

// DOM elements
const authSection = document.getElementById('auth-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const poolsContainer = document.getElementById('pools-container');
const poolsLoading = document.getElementById('pools-loading');
const currentYearElement = document.getElementById('current-year');

// Set active nav item
function setActiveNavItem() {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    if (path === '/') {
        document.getElementById('nav-home').classList.add('active');
    } else if (path.includes('/search')) {
        document.getElementById('nav-search').classList.add('active');
    } else if (path.includes('/dashboard')) {
        document.getElementById('nav-dashboard').classList.add('active');
    }
}

// Check if user is logged in
async function checkAuth() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            currentUser = await response.json();
            renderAuthSection();
            document.querySelectorAll('.user-only').forEach(el => {
                el.style.display = 'block';
            });
        } else {
            currentUser = null;
            renderAuthSection();
            document.querySelectorAll('.user-only').forEach(el => {
                el.style.display = 'none';
            });
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        currentUser = null;
        renderAuthSection();
    }
    
    // If we're on the pools page, load the pools
    if (poolsContainer) {
        fetchPools();
    }
}

// Render auth section based on login status
function renderAuthSection() {
    if (currentUser) {
        authSection.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-outline-light dropdown-toggle" type="button" id="userDropdown" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="fas fa-user me-1"></i> ${currentUser.name}
                </button>
                <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
                    <li><a class="dropdown-item" href="/dashboard"><i class="fas fa-tachometer-alt me-2"></i>Dashboard</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><button id="logout-btn" class="dropdown-item"><i class="fas fa-sign-out-alt me-2"></i>Logout</button></li>
                </ul>
            </div>
        `;
        document.getElementById('logout-btn').addEventListener('click', logout);
    } else {
        authSection.innerHTML = `
            <button id="login-btn" class="btn btn-outline-light">
                <i class="fas fa-sign-in-alt me-1"></i> Login
            </button>
        `;
        document.getElementById('login-btn').addEventListener('click', showLoginModal);
    }
}

// Show login modal
function showLoginModal() {
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email_or_aadhar = document.getElementById('email_or_aadhar').value;
    const password = document.getElementById('password').value;
    
    // Show loading state
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Logging in...';
    
    const formData = new FormData();
    formData.append('email_or_aadhar', email_or_aadhar);
    formData.append('password', password);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                loginError.style.display = 'none';
                
                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                
                // Clear the form
                loginForm.reset();
                
                // Update auth state
                checkAuth();
                
                // Show success toast
                showToast('Login successful', 'Welcome back!', 'success');
            } else {
                loginError.textContent = data.message || 'Login failed';
                loginError.style.display = 'block';
            }
        } else {
            const error = await response.json();
            loginError.textContent = error.detail || 'Login failed';
            loginError.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'An error occurred. Please try again.';
        loginError.style.display = 'block';
    } finally {
        // Restore button state
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// Handle logout
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        renderAuthSection();
        document.querySelectorAll('.user-only').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show success toast
        showToast('Logged out', 'You have been successfully logged out', 'info');
        
        // Redirect to home if on dashboard
        if (window.location.pathname.includes('/dashboard')) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error', 'Logout failed. Please try again.', 'error');
    }
}

// Fetch all pools
async function fetchPools() {
    if (!poolsContainer || !poolsLoading) return;
    
    try {
        poolsLoading.style.display = 'block';
        poolsContainer.innerHTML = '';
        
        const response = await fetch('/api/pools');
        pools = await response.json();
        
        poolsLoading.style.display = 'none';
        renderPools();
    } catch (error) {
        console.error('Error fetching pools:', error);
        poolsLoading.style.display = 'none';
        poolsContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Error loading pools. Please try again later.
                </div>
            </div>
        `;
    }
}

// Render pools
function renderPools() {
    if (!poolsContainer) return;
    
    if (pools.length === 0) {
        poolsContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    No swimming pools available.
                </div>
            </div>
        `;
        return;
    }
    
    poolsContainer.innerHTML = pools.map((pool, index) => `
        <div class="col-md-4 mb-4 fade-in" style="animation-delay: ${index * 0.1}s">
            <div class="card pool-card h-100">
                <div class="position-relative">
                    <img src="${pool.image_url || '/static/images/pool-placeholder.jpg'}" class="card-img-top" alt="${pool.name}">
                    <div class="position-absolute top-0 end-0 m-2">
                        <span class="badge bg-primary">Pool #${pool.id}</span>
                    </div>
                </div>
                <div class="card-body">
                    <h5 class="card-title">${pool.name}</h5>
                    <p class="card-text">
                        <i class="fas fa-map-marker-alt text-danger me-2"></i>
                        ${pool.address}
                    </p>
                </div>
                <div class="card-footer bg-white border-0">
                    <div class="d-flex justify-content-between">
                        <button class="btn btn-outline-primary view-details" data-pool-id="${pool.id}">
                            <i class="fas fa-info-circle me-1"></i> Details
                        </button>
                        <a href="/search?pool_id=${pool.id}" class="btn btn-primary">
                            <i class="fas fa-calendar-check me-1"></i> Book Now
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    document.querySelectorAll('.view-details').forEach(button => {
        button.addEventListener('click', () => showPoolDetails(parseInt(button.dataset.poolId)));
    });
}

// Show pool details
async function showPoolDetails(poolId) {
    try {
        // Show loading state
        document.getElementById('poolDetailsTitle').textContent = 'Loading...';
        document.getElementById('poolDetailsImage').src = '/static/images/pool-placeholder.jpg';
        document.getElementById('poolDetailsAddress').textContent = 'Loading...';
        document.getElementById('googleMap').innerHTML = '<div class="d-flex justify-content-center align-items-center h-100"><div class="spinner-border text-primary"></div></div>';
        
        const poolDetailsModal = new bootstrap.Modal(document.getElementById('poolDetailsModal'));
        poolDetailsModal.show();
        
        const response = await fetch(`/api/pool/${poolId}`);
        const pool = await response.json();
        
        document.getElementById('poolDetailsTitle').textContent = pool.name;
        document.getElementById('poolDetailsImage').src = pool.image_url || '/static/images/pool-placeholder.jpg';
        document.getElementById('poolDetailsAddress').textContent = pool.address;
        
        // Set up Google Map iframe if available
        const googleMap = document.getElementById('googleMap');
        if (pool.google_map_url) {
            googleMap.innerHTML = `<iframe src="${pool.google_map_url}" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
        } else {
            googleMap.innerHTML = '<div class="alert alert-info">Map not available</div>';
        }
        
        // Set up check availability button
        const checkAvailabilityBtn = document.getElementById('checkAvailabilityBtn');
        checkAvailabilityBtn.href = `/search?pool_id=${poolId}`;
    } catch (error) {
        console.error('Error fetching pool details:', error);
        const poolDetailsModal = bootstrap.Modal.getInstance(document.getElementById('poolDetailsModal'));
        poolDetailsModal.hide();
        showToast('Error', 'Failed to load pool details. Please try again.', 'error');
    }
}

// Global showToast function
window.showToast = function(title, message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast fade-in`;
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Set background color based on type
    let bgClass = 'bg-info';
    let iconClass = 'fa-info-circle';
    
    if (type === 'success') {
        bgClass = 'bg-success';
        iconClass = 'fa-check-circle';
    } else if (type === 'error') {
        bgClass = 'bg-danger';
        iconClass = 'fa-exclamation-circle';
    } else if (type === 'warning') {
        bgClass = 'bg-warning';
        iconClass = 'fa-exclamation-triangle';
    }
    
    toast.innerHTML = `
        <div class="toast-header ${bgClass} text-white">
            <i class="fas ${iconClass} me-2"></i>
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    bsToast.show();
    
    // Remove toast from DOM after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
};

// Set current year in footer
function setCurrentYear() {
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    setActiveNavItem();
    checkAuth();
    setCurrentYear();
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Handle login required button click
    const loginRequiredBtn = document.getElementById('loginRequiredBtn');
    if (loginRequiredBtn) {
        loginRequiredBtn.addEventListener('click', () => {
            bootstrap.Modal.getInstance(document.getElementById('loginRequiredModal')).hide();
            showLoginModal();
        });
    }
});