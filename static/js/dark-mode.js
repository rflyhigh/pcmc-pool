// Dark mode toggle functionality
document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    
    // Check for saved theme preference or use preferred color scheme
    const savedTheme = localStorage.getItem('theme');
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set initial theme
    if (savedTheme === 'dark' || (!savedTheme && prefersDarkMode)) {
        htmlElement.setAttribute('data-bs-theme', 'dark');
        updateThemeIcon('dark');
    } else {
        htmlElement.setAttribute('data-bs-theme', 'light');
        updateThemeIcon('light');
    }
    
    // Theme toggle button click handler
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = htmlElement.getAttribute('data-bs-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Add transition effect
        document.body.style.transition = 'background-color 0.5s ease, color 0.5s ease';
        document.querySelectorAll('.card, .navbar, .footer, .jumbotron, .modal-content, .btn, .alert, .time-slot-card').forEach(el => {
            el.style.transition = 'background-color 0.5s ease, color 0.5s ease, box-shadow 0.5s ease, transform 0.5s ease';
        });
        
        // Change theme with animation
        htmlElement.setAttribute('data-bs-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        
        // Add a subtle animation to cards
        document.querySelectorAll('.card').forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate__animated', 'animate__pulse');
                setTimeout(() => card.classList.remove('animate__animated', 'animate__pulse'), 1000);
            }, index * 50);
        });
        
        // Remove transitions after animation completes
        setTimeout(() => {
            document.body.style.transition = '';
            document.querySelectorAll('.card, .navbar, .footer, .jumbotron, .modal-content, .btn, .alert, .time-slot-card').forEach(el => {
                el.style.transition = '';
            });
        }, 500);
    });
    
    // Update theme icon based on current theme
    function updateThemeIcon(theme) {
        const icon = themeToggleBtn.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
            themeToggleBtn.setAttribute('title', 'Switch to light mode');
            themeToggleBtn.setAttribute('data-bs-toggle', 'tooltip');
            themeToggleBtn.setAttribute('data-bs-placement', 'bottom');
        } else {
            icon.className = 'fas fa-moon';
            themeToggleBtn.setAttribute('title', 'Switch to dark mode');
            themeToggleBtn.setAttribute('data-bs-toggle', 'tooltip');
            themeToggleBtn.setAttribute('data-bs-placement', 'bottom');
        }
        
        // Initialize tooltip
        new bootstrap.Tooltip(themeToggleBtn);
    }
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            htmlElement.setAttribute('data-bs-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });
});