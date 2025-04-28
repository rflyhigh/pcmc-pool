// Dashboard functionality
let currentFilter = '';
let currentSortField = '';
let currentSortOrder = '';
let currentPage = 1;

// DOM elements
const bookingsTableBody = document.getElementById('bookings-table-body');
const bookingsLoading = document.getElementById('bookings-loading');
const noBookingsMessage = document.getElementById('no-bookings-message');
const paginationContainer = document.getElementById('pagination-container');
const pagination = document.getElementById('pagination');
const statusFilter = document.getElementById('status-filter');
const applyFilterBtn = document.getElementById('apply-filter');
const sortDateAscBtn = document.getElementById('sort-date-asc');
const sortDateDescBtn = document.getElementById('sort-date-desc');
const userNameElement = document.getElementById('user-name');

// Fetch bookings with optional filters
async function fetchBookings() {
    try {
        showLoading(true);
        
        // Check if user is logged in
        const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
        if (!session) {
            window.location.href = 'index.html';
            return;
        }
        
        // Debug
        console.log('Fetching bookings...');
        
        let url = `${CONFIG.API_URL}/api/bookings?page=${currentPage}`;
        if (currentFilter) {
            url += `&status=${currentFilter}`;
        }
        if (currentSortField && currentSortOrder) {
            url += `&sortField=${currentSortField}&sortOrder=${currentSortOrder}`;
        }
        
        console.log('Fetch URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'Cookie': `ci_session=${session}`
            },
            credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch bookings: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Bookings data:', data);
        
        renderBookings(data.bookings);
        renderPagination(data.pagination);
        
        if (data.filters && data.filters.status_options) {
            renderFilterOptions(data.filters.status_options);
        }
        
        // Update user name
        if (userNameElement) {
            const userResponse = await fetch(`${CONFIG.API_URL}/api/user`, {
                headers: {
                    'Cookie': `ci_session=${session}`
                },
                credentials: 'include'
            });
            
            if (userResponse.ok) {
                const userData = await userResponse.json();
                userNameElement.textContent = userData.name;
            }
        }
        
        showLoading(false);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        showLoading(false);
        noBookingsMessage.style.display = 'block';
        noBookingsMessage.textContent = 'Error loading bookings. Please try again.';
        noBookingsMessage.className = 'alert alert-danger';
        
        // Try to show the error in the console
        if (typeof showToast === 'function') {
            showToast('Error', 'Failed to load bookings. Please try again.', 'error');
        }
    }
}

// Render bookings table
function renderBookings(bookings) {
    if (!bookingsTableBody) {
        console.error('bookingsTableBody element not found');
        return;
    }
    
    if (!bookings || bookings.length === 0) {
        noBookingsMessage.style.display = 'block';
        bookingsTableBody.innerHTML = '';
        return;
    }
    
    noBookingsMessage.style.display = 'none';
    
    bookingsTableBody.innerHTML = bookings.map((booking, index) => `
        <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
            <td>
                <span class="fw-bold">${booking.booking_number}</span>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="fas fa-swimming-pool text-primary me-2"></i>
                    <span>${booking.pool_name}</span>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="far fa-clock text-info me-2"></i>
                    <span>${booking.batch}</span>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="far fa-calendar-alt text-success me-2"></i>
                    <span>${booking.booking_date}</span>
                </div>
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <i class="fas fa-rupee-sign text-warning me-2"></i>
                    <span>${booking.amount}</span>
                </div>
            </td>
            <td>
                ${booking.payment_status ? 
                    `<span class="badge ${booking.payment_status === 'Paid' ? 'bg-success' : 'bg-danger'}">${booking.payment_status}</span>` : 
                    '<span class="badge bg-secondary">Not Paid</span>'
                }
            </td>
            <td>
                <span class="badge ${getStatusBadgeClass(booking.booking_status)}">${booking.booking_status}</span>
            </td>
            <td>
                ${booking.receipt_id ? 
                    `<div class="btn-group btn-group-sm">
                        <button class="btn btn-sm btn-success view-receipt" data-receipt-id="${booking.receipt_id}">
                            <i class="fas fa-eye me-1"></i> View
                        </button>
                        <a href="${CONFIG.API_URL}/api/receipt/${booking.receipt_id}" class="btn btn-sm btn-outline-success" download="receipt_${booking.receipt_id}.pdf">
                            <i class="fas fa-download"></i>
                        </a>
                    </div>` : 
                    '<span class="text-muted">No Action</span>'
                }
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to receipt buttons
    document.querySelectorAll('.view-receipt').forEach(button => {
        button.addEventListener('click', () => viewReceipt(button.dataset.receiptId));
    });
}

// Get appropriate badge class for booking status
function getStatusBadgeClass(status) {
    switch (status) {
        case 'Completed':
            return 'bg-success';
        case 'Pending':
            return 'bg-warning';
        case 'Cancelled':
            return 'bg-danger';
        default:
            return 'bg-info';
    }
}

// Render pagination
function renderPagination(paginationData) {
    if (!pagination) {
        console.error('pagination element not found');
        return;
    }
    
    if (!paginationData || paginationData.total_pages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <li class="page-item ${paginationData.current_page === 1 ? 'disabled' : ''}">
            <button class="page-link" data-page="${paginationData.current_page - 1}" aria-label="Previous">
                <span aria-hidden="true">&laquo;</span>
            </button>
        </li>
    `;
    
    // Page numbers
    for (let i = 1; i <= paginationData.total_pages; i++) {
        paginationHTML += `
            <li class="page-item ${i === paginationData.current_page ? 'active' : ''}">
                <button class="page-link" data-page="${i}">${i}</button>
            </li>
        `;
    }
    
    // Next button
    paginationHTML += `
        <li class="page-item ${paginationData.current_page === paginationData.total_pages ? 'disabled' : ''}">
            <button class="page-link" data-page="${paginationData.current_page + 1}" aria-label="Next">
                <span aria-hidden="true">&raquo;</span>
            </button>
        </li>
    `;
    
    pagination.innerHTML = paginationHTML;
    
    // Add event listeners to pagination buttons
    document.querySelectorAll('.page-link').forEach(button => {
        button.addEventListener('click', () => {
            if (!button.parentElement.classList.contains('disabled')) {
                currentPage = parseInt(button.dataset.page);
                fetchBookings();
                
                // Scroll to top of table
                document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// Render filter options
function renderFilterOptions(options) {
    if (!statusFilter) {
        console.error('statusFilter element not found');
        return;
    }
    
    if (!options || !Array.isArray(options)) {
        console.error('Invalid filter options:', options);
        return;
    }
    
    // Keep the first "All Status" option
    const firstOption = statusFilter.options[0];
    statusFilter.innerHTML = '';
    statusFilter.appendChild(firstOption);
    
    // Add the rest of the options
    options.forEach(option => {
        if (option.value) {  // Skip the "All Status" option which is already added
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.text;
            if (option.selected) {
                optionElement.selected = true;
            }
            statusFilter.appendChild(optionElement);
        }
    });
}

// View receipt
function viewReceipt(receiptId) {
    const receiptModal = new bootstrap.Modal(document.getElementById('receiptModal'));
    const receiptIframe = document.getElementById('receipt-iframe');
    const downloadReceiptLink = document.getElementById('download-receipt');
    
    // Show loading in the iframe
    receiptIframe.srcdoc = `
        <html>
            <body style="display: flex; justify-content: center; align-items: center; height: 100%; margin: 0; font-family: Arial, sans-serif;">
                <div style="text-align: center;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
                    <p style="margin-top: 20px;">Loading receipt...</p>
                </div>
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </body>
        </html>
    `;
    
    // Set the receipt URL
    const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
    const receiptUrl = `${CONFIG.API_URL}/api/receipt/${receiptId}`;
    
    // Set the download link
    downloadReceiptLink.href = receiptUrl;
    downloadReceiptLink.download = `receipt_${receiptId}.pdf`;
    
    // Show the modal
    receiptModal.show();
    
    // Check if the receipt is available
    fetch(receiptUrl, { 
        method: 'HEAD',
        headers: {
            'Cookie': `ci_session=${session}`
        },
        credentials: 'include'
    })
    .then(response => {
        if (response.ok) {
            // Set the iframe source after confirming the receipt is available
            receiptIframe.src = receiptUrl;
        } else {
            // Show error message in the iframe
            receiptIframe.srcdoc = `
                <html>
                    <body style="display: flex; justify-content: center; align-items: center; height: 100%; margin: 0; font-family: Arial, sans-serif;">
                        <div style="text-align: center; color: #721c24; background-color: #f8d7da; padding: 20px; border-radius: 5px;">
                            <h3>Error Loading Receipt</h3>
                            <p>The receipt could not be loaded. Please try downloading it directly.</p>
                        </div>
                    </body>
                </html>
            `;
        }
    })
    .catch(error => {
        console.error('Error checking receipt:', error);
        receiptIframe.srcdoc = `
            <html>
                <body style="display: flex; justify-content: center; align-items: center; height: 100%; margin: 0; font-family: Arial, sans-serif;">
                    <div style="text-align: center; color: #721c24; background-color: #f8d7da; padding: 20px; border-radius: 5px;">
                        <h3>Error</h3>
                        <p>An error occurred while checking the receipt. Please try downloading it directly.</p>
                    </div>
                </body>
            </html>
        `;
    });
}

// Show/hide loading indicator
function showLoading(isLoading) {
    if (bookingsLoading) {
        bookingsLoading.style.display = isLoading ? 'block' : 'none';
    }
}

// Check if user is logged in and redirect if not
function checkUserLoggedIn() {
    const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
    if (!session) {
        window.location.href = 'index.html';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard page loaded');
    
    // Check if user is logged in
    checkUserLoggedIn();
    
    // Check if we're on the dashboard page
    if (document.getElementById('bookings-table-body')) {
        console.log('Initializing dashboard...');
        
        // Initial load
        fetchBookings();
        
        // Filter button click
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                currentFilter = statusFilter.value;
                currentPage = 1;  // Reset to first page
                fetchBookings();
            });
        }
        
        // Sort buttons click
        if (sortDateAscBtn) {
            sortDateAscBtn.addEventListener('click', () => {
                currentSortField = 'booking_date';
                currentSortOrder = 'ASC';
                currentPage = 1;  // Reset to first page
                fetchBookings();
                
                // Update active state
                sortDateAscBtn.classList.add('active');
                sortDateDescBtn.classList.remove('active');
            });
        }
        
        if (sortDateDescBtn) {
            sortDateDescBtn.addEventListener('click', () => {
                currentSortField = 'booking_date';
                currentSortOrder = 'DESC';
                currentPage = 1;  // Reset to first page
                fetchBookings();
                
                // Update active state
                sortDateDescBtn.classList.add('active');
                sortDateAscBtn.classList.remove('active');
            });
        }
    } else {
        console.log('Not on dashboard page');
    }
});