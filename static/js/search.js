// Search functionality
let selectedPoolId = '';
const minDate = new Date().toISOString().split('T')[0];  // Today's date

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
    bookingDateInput.min = minDate;
    bookingDateInput.value = minDate;
    
    // Load pools
    await loadPools();
    
    // Set initial pool ID if provided
    if (typeof initialPoolId !== 'undefined' && initialPoolId) {
        poolSelect.value = initialPoolId;
    }
}

// Load pools for the select dropdown
async function loadPools() {
    try {
        const response = await fetch('/api/pools');
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
    try {
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) {
            // Show login required modal
            const loginRequiredModal = new bootstrap.Modal(document.getElementById('loginRequiredModal'));
            loginRequiredModal.show();
            return;
        }
        
        // User is logged in, proceed with availability check
        showResults('loading');
        
        const formData = new FormData();
        formData.append('pool_id', selectedPoolId);
        formData.append('booking_date', bookingDate);
        
        const response = await fetch('/api/availability', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Failed to check availability');
        }
        
        const data = await response.json();
        
        // Get pool name
        const poolName = poolSelect.options[poolSelect.selectedIndex].text;
        
        // Format date for display
        const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
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
});