// Configuration file for the PCMC Swimming Pool Proxy
const CONFIG = {
    // API base URL - change this to your Render deployment URL
    API_URL: "https://your-backend-app.onrender.com",
    
    // Session cookie name
    SESSION_COOKIE_NAME: "pcmc_session",
    
    // Session duration in days
    SESSION_DURATION_DAYS: 7,
    
    // Default date format
    DATE_FORMAT: {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    },
    
    // Minimum date offset for booking (days from now)
    MIN_BOOKING_DATE_OFFSET: 0
};

// Helper functions for cookie management
const CookieUtil = {
    setCookie: function(name, value, days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = name + "=" + value + ";" + expires + ";path=/";
    },
    
    getCookie: function(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for(let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },
    
    deleteCookie: function(name) {
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
    }
};

// API request helper with session handling
const ApiClient = {
    getHeaders: function(includeContentType = true) {
        const headers = {};
        const session = CookieUtil.getCookie(CONFIG.SESSION_COOKIE_NAME);
        
        if (session) {
            headers['Cookie'] = `ci_session=${session}`;
        }
        
        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }
        
        return headers;
    },
    
    get: async function(endpoint) {
        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                method: 'GET',
                headers: this.getHeaders(),
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error fetching ${endpoint}:`, error);
            throw error;
        }
    },
    
    post: async function(endpoint, data, isFormData = false) {
        try {
            const headers = isFormData ? {} : this.getHeaders();
            
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
                method: 'POST',
                headers: headers,
                body: isFormData ? data : JSON.stringify(data),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error posting to ${endpoint}:`, error);
            throw error;
        }
    }
};