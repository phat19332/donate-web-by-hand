document.addEventListener('DOMContentLoaded', () => {
    const qrImage = document.getElementById('qr-image');
    const donateButtons = document.querySelectorAll('.donate-btn');
    const qrStatus = qrImage.parentElement.nextElementSibling; // The "Quét mã cho nhanh..." paragraph

    // Bank Information (from index.html)
    const BANK_ID = '970418'; // BIDV
    const ACCOUNT_NO = '8826688195';
    const ACCOUNT_NAME = 'NGUYEN TAN BAO';

    /**
     * Updates the QR code based on amount and description
     * @param {string} amount 
     * @param {string} description 
     */
    function updateQRCode(amount, description) {
        // Show loading state
        qrImage.style.opacity = '0.5';
        if (qrStatus) {
            qrStatus.textContent = `Đang tạo mã QR cho ${parseInt(amount).toLocaleString()} VNĐ...`;
            qrStatus.classList.add('animate-pulse');
        }

        // Construct VietQR URL
        // Template: compact2 (shows bank logo and account info)
        const encodedDesc = encodeURIComponent(description);
        const encodedName = encodeURIComponent(ACCOUNT_NAME);
        const vietQRUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-compact2.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;

        // Update image
        qrImage.src = vietQRUrl;

        // Reset visibility when loaded
        qrImage.onload = () => {
            qrImage.style.opacity = '1';
            if (qrStatus) {
                qrStatus.textContent = `Mã QR: ${parseInt(amount).toLocaleString()} VNĐ - ${description}`;
                qrStatus.classList.remove('animate-pulse');
                qrStatus.classList.add('text-secondary');
            }
        };

        // Handle error
        qrImage.onerror = () => {
            qrImage.style.opacity = '1';
            if (qrStatus) {
                qrStatus.textContent = 'Lỗi khi tạo mã QR. Vui lòng thử lại!';
                qrStatus.classList.remove('animate-pulse', 'text-secondary');
                qrStatus.classList.add('text-red-500');
            }
        };

        // Scroll to QR code on mobile for better UX
        if (window.innerWidth < 1024) {
            qrImage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Add click listeners to all donate buttons
    donateButtons.forEach(button => {
        button.addEventListener('click', () => {
            const amount = button.getAttribute('data-amount');
            const tierName = button.getAttribute('data-tier');
            const description = `Ung ho DLG - ${tierName}`;
            
            updateQRCode(amount, description);
            
            // Add a temporary "Clicked" effect
            button.classList.add('scale-125', 'bg-primary/20');
            setTimeout(() => {
                button.classList.remove('scale-125', 'bg-primary/20');
            }, 300);
        });
    });

    // Interaction for the manual input if it existed (from user snippet)
    // We'll add this logic just in case the user wants to add the input later
    const urlInput = document.getElementById('url_input');
    const btnMake = document.getElementById('btn_make');
    const makeQrDiv = document.getElementById('make_qr');

    if (btnMake && urlInput) {
        btnMake.addEventListener('click', () => {
            const text = urlInput.value.trim();
            if (text) {
                // Using qrcode.js for generic text/URL QR codes
                if (makeQrDiv) {
                    makeQrDiv.innerHTML = '';
                    makeQrDiv.style.display = 'block';
                    new QRCode(makeQrDiv, {
                        text: text,
                        width: 128,
                        height: 128,
                        colorDark: "#32CD32",
                        colorLight: "#000000",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                }
            }
        });
    }

    // "COMING SOON" Notification Handler
    const comingSoonLinks = document.querySelectorAll('.coming-soon');
    comingSoonLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('COMMING SOON', '#FFFF00'); // Electric Yellow
        });
    });

    /**
     * Shows a premium toast notification
     * @param {string} message 
     * @param {string} color 
     */
    function showToast(message, color) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-3 rounded-md font-headline font-bold uppercase tracking-widest text-sm glass-panel border border-primary/40 shadow-[0_0_30px_rgba(50,205,50,0.2)] animate-bounce';
        toast.style.borderColor = color;
        toast.style.color = color;
        toast.style.textShadow = `0 0 10px ${color}80`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'all 0.5s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => toast.remove(), 500);
        }, 2000);
    }

    // --- Backend & Real-time Integration ---
    
    // Connect to Socket.io server
    const socket = io();

    const progressPercent = document.getElementById('progress-percent');
    const progressBar = document.getElementById('progress-bar');
    const currentAmountText = document.getElementById('current-amount');
    const progressGoalText = document.getElementById('progress-goal');
    const donatorList = document.getElementById('donator-list');

    /**
     * Updates the main dashboard with new stats
     */
    function updateDashboard(data) {
        const { total_collected, goal, donators } = data;
        const percent = Math.min(Math.round((total_collected / goal) * 100), 100);

        // Update Progress Bar
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (currentAmountText) currentAmountText.textContent = `${total_collected.toLocaleString()} VNĐ`;
        if (progressGoalText) progressGoalText.textContent = `Mục tiêu: ${goal.toLocaleString()} VNĐ`;

        // Update Donator Marquee
        if (donatorList && donators) {
            donatorList.innerHTML = '';
            // Duplicate list for seamless loop
            const displayList = [...donators, ...donators]; 
            displayList.forEach(donator => {
                const item = document.createElement('span');
                item.className = 'font-label text-[10px] text-on-surface-variant uppercase tracking-widest px-8 border-r border-primary/20';
                item.innerHTML = `<span class="text-primary">${donator.name}</span> - <span class="text-secondary">${donator.amount.toLocaleString()} VNĐ</span>`;
                donatorList.appendChild(item);
            });
        }
    }

    /**
     * Celebration effect for a successful donation
     */
    function triggerSuccessEffect(donation) {
        // Fireworks (Confetti)
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        // Show specialized Thank You Toast
        showToast(`CẢM ƠN ${donation.name.toUpperCase()} ĐÃ ỦNG HỘ ${donation.amount.toLocaleString()} VNĐ!`, '#32CD32');
    }

    // Socket Event Listeners
    socket.on('init_data', (data) => {
        console.log('Stats initialized:', data);
        updateDashboard(data);
    });

    socket.on('donation_received', (data) => {
        console.log('New donation!', data);
        updateDashboard({
            total_collected: data.total_collected,
            goal: parseInt(progressGoalText.textContent.replace(/\D/g, '')) || 20000000,
            donators: [data.new_donation] // Simplification for marquee update
        });
        
        // Trigger celebration
        triggerSuccessEffect(data.new_donation);
        
        // Refresh full donator list from API after a short delay
        setTimeout(() => {
            fetch('/api/stats')
                .then(res => res.json())
                .then(stats => updateDashboard(stats));
        }, 2000);
    });

});
