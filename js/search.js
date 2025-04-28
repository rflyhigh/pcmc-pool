// Search functionality
let selectedPoolId = '';
let currentUser = null;

// DOM elements
const availabilityForm = document.getElementById('availability-form');
const poolSelect = document.getElementById('pool-select');
const bookingDateInput = document.getElementById('booking-date');
const resultsContainer = document.getElementById('results-container');
const resultsLoading = document.getElementById('results-loading');
const resultsMessage = document.getElementById('results-message');
const resultsContent = document.getElementById('results-content');
const resultsTitle = document.getElementById('results-title');
const resultsBatches = document.getElementById('results-batches');

// Initialize the search page
async function initSearchPage() {
    // Set minimum date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    bookingDateInput.min = formattedDate;
    bookingDateInput.value = formattedDate;
    
    // Load pools
    await loadPools();
    
    // Set initial pool ID from URL parameter if provided
    const urlParams = new URLSearchParams(window.location.search);
    const poolIdParam = urlParams.get('pool_id');
    
    if (poolIdParam) {
        poolSelect.value = poolIdParam;
    }
    
    // Check if user is logged in
    checkUserStatus();
}

// Check if user is logged in
async function checkUserStatus() {
    const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
    
    if (session) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/api/user`, {
                headers: {
                    'Cookie': `ci_session=${session}`
                },
                credentials: 'include'
            });
            
            if (response.ok) {
                currentUser = await response.json();
            } else {
                currentUser = null;
            }
        } catch (error) {
            console.error('Error checking user status:', error);
            currentUser = null;
        }
    } else {
        currentUser = null;
    }
}

// Load pools for the select dropdown
async function loadPools() {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/pools`);
        const pools = await response.json();
        
        // Clear existing options except the first one
        const firstOption = poolSelect.options[0];
        poolSelect.innerHTML = '';
        poolSelect.appendChild(firstOption);
        
        // Add pool options
        pools.forEach(pool => {
            const option = document.createElement('option');
            option.value = pool.id;
            option.textContent = pool.name;
            poolSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading pools:', error);
        showToast('Error', 'Failed to load swimming pools. Please try again.', 'error');
    }
}

// Check availability
async function checkAvailability(e) {
    e.preventDefault();
    
    // Get form values
    selectedPoolId = poolSelect.value;
    const bookingDate = bookingDateInput.value;
    
    if (!selectedPoolId || !bookingDate) {
        showToast('Error', 'Please select a pool and date', 'error');
        return;
    }
    
    // Check if user is logged in
    const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
    if (!session) {
        // Show login required modal
        const loginRequiredModal = new bootstrap.Modal(document.getElementById('loginRequiredModal'));
        loginRequiredModal.show();
        return;
    }
    
    // User is logged in, proceed with availability check
    showResults('loading');
    
    try {
        const formData = new FormData();
        formData.append('pool_id', selectedPoolId);
        formData.append('booking_date', bookingDate);
        
        const response = await fetch(`${CONFIG.API_URL}/api/availability`, {
            method: 'POST',
            body: formData,
            headers: {
                'Cookie': `ci_session=${session}`
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to check availability');
        }
        
        const data = await response.json();
        
        // Get pool name
        const poolName = poolSelect.options[poolSelect.selectedIndex].text;
        
        // Format date for display
        const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', CONFIG.DATE_FORMAT);
        
        // Check if there are any batches
        if (data.message) {
            showResults('message', data.message);
            return;
        }
        
        if (data.batches.length === 0) {
            showResults('message', `No available batches found for ${formattedDate}.`);
            return;
        }
        
        // Show results
        resultsTitle.textContent = `Available Batches for ${poolName} on ${formattedDate}`;
        renderBatches(data.batches);
        showResults('content');
    } catch (error) {
        console.error('Error checking availability:', error);
        showResults('message', 'An error occurred while checking availability. Please try again.');
    }
}

// Render batches
function renderBatches(batches) {
    resultsBatches.innerHTML = batches.map((batch, index) => `
        <div class="col-md-6 col-lg-4 mb-4">
            <div class="time-slot-card ${batch.is_available ? '' : 'unavailable'} fade-in" style="animation-delay: ${index * 0.1}s">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="time-slot-time">
                        <i class="far fa-clock me-2"></i>${batch.time_slot}
                    </div>
                    <span class="badge ${batch.is_available ? 'bg-success' : 'bg-danger'}">
                        ${batch.is_available ? 'Available' : 'Fully Booked'}
                    </span>
                </div>
                <div class="time-slot-details">
                    <div><i class="far fa-calendar-alt me-2"></i>${batch.date}</div>
                    <div><i class="far fa-clock me-2"></i>${batch.time}</div>
                    <div class="time-slot-price"><i class="fas fa-rupee-sign me-2"></i>${batch.amount}</div>
                    <div><i class="fas fa-users me-2"></i>Available Slots: ${batch.available_slots}</div>
                </div>
                <div class="mt-3">
                    ${batch.is_available ? 
                        `<button class="btn btn-sm btn-success w-100" ${currentUser ? '' : 'disabled'}>
                            <i class="fas fa-check-circle me-1"></i> Book Now
                        </button>` : 
                        `<button class="btn btn-sm btn-secondary w-100" disabled>
                            <i class="fas fa-ban me-1"></i> Fully Booked
                        </button>`
                    }
                </div>
            </div>
        </div>
    `).join('');
}

// Show different result states
function showResults(state, message = '') {
    resultsLoading.style.display = state === 'loading' ? 'block' : 'none';
    resultsMessage.style.display = state === 'message' ? 'block' : 'none';
    resultsContent.style.display = state === 'content' ? 'block' : 'none';
    
    if (state === 'message') {
        resultsMessage.textContent = message;
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initSearchPage();
    
    if (availabilityForm) {
        availabilityForm.addEventListener('submit', checkAvailability);
    }
    
    // Handle login required button click
    const loginRequiredBtn = document.getElementById('loginRequiredBtn');
    if (loginRequiredBtn) {
        loginRequiredBtn.addEventListener('click', () => {
            bootstrap.Modal.getInstance(document.getElementById('loginRequiredModal')).hide();
            const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
            loginModal.show();
        });
    }
});