// js/notificationManager.js - REMOVE export statement
class NotificationManager {
    static permission = null;
    static registration = null;

    static async init() {
        console.log('🔔 Initializing NotificationManager...');
        console.log('📱 User Agent:', navigator.userAgent);
        console.log('🔍 Is Mobile Chrome:', this.isMobileChrome());
        console.log('🔔 Notification API available:', 'Notification' in window);
        console.log('🔧 Service Worker available:', 'serviceWorker' in navigator);
        
        this.permission = Notification.permission;
        console.log('📋 Current permission status:', this.permission);
        
        if ('Notification' in window && 'serviceWorker' in navigator) {
            try {
                // Try to get a ready registration, but fall back to getRegistration
                try {
                    this.registration = await navigator.serviceWorker.ready;
                } catch (e) {
                    console.warn('navigator.serviceWorker.ready failed, trying getRegistration()', e);
                    try {
                        this.registration = await navigator.serviceWorker.getRegistration();
                    } catch (e2) {
                        console.warn('navigator.serviceWorker.getRegistration failed', e2);
                        this.registration = null;
                    }
                }

                // Ensure registration has an active worker
                if (this.registration && !this.registration.active) {
                    const r = await navigator.serviceWorker.getRegistration();
                    if (r && r.active) this.registration = r;
                }
                
                console.log('🔧 Service Worker registration:', this.registration ? 'Available' : 'Not available');
                
                // Request permission when not already decided
                if (this.permission === 'default') {
                    console.log('🎯 Requesting notification permission for the current device...');
                    await this.requestPermission();
                } else {
                    console.log('⏭️ Notification permission already set:', this.permission);
                }
                
                this.setupNotificationListeners();
            } catch (error) {
                console.error('❌ Notification initialization failed:', error);
            }
        } else {
            console.warn('⚠️ Notification API or Service Worker not supported');
        }
    }

    static isMobileChrome() {
        const userAgent = navigator.userAgent;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
        const isChrome = /Chrome|CriOS/i.test(userAgent) && !/Edg/i.test(userAgent); // Include CriOS (Chrome on iOS)
        return isMobile && isChrome;
    }

    static async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    static async showNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }

        const notificationOptions = {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            data: {
                url: window.location.href
            },
            ...options
        };

        // Show notification via service worker if active, otherwise fallback
        if (this.registration && this.registration.active) {
            try {
                await this.registration.showNotification(title, notificationOptions);
                return;
            } catch (err) {
                console.warn('ServiceWorkerRegistration.showNotification failed, falling back:', err);
            }
        }

        // Fallback to regular Notification API
        try {
            if ('Notification' in window) {
                new Notification(title, notificationOptions);
                return;
            }
        } catch (err) {
            console.warn('Fallback Notification() failed:', err);
        }

        // Final fallback: in-app toast via casaLink if available
        try {
            if (window.casaLink && typeof window.casaLink.showNotification === 'function') {
                // Use textual body override
                const text = notificationOptions.body || title;
                window.casaLink.showNotification(text, 'info');
                return;
            }
        } catch (err) {
            console.warn('In-app notification fallback failed:', err);
        }
    }

    static setupNotificationListeners() {
        // Listen for notification clicks
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                this.handleNotificationClick(event.data);
            }
        });

        // Listen for push events (if push is implemented)
        if ('PushManager' in window) {
            navigator.serviceWorker.addEventListener('push', (event) => {
                this.handlePushEvent(event);
            });
        }
    }

    static handleNotificationClick(data) {
        // Handle notification actions
        switch (data.action) {
            case 'view_bill':
                window.casaLink?.showPage('tenantBilling');
                break;
            case 'view_maintenance':
                window.casaLink?.showPage('tenantMaintenance');
                break;
            case 'view_properties':
                window.casaLink?.showPage('properties');
                break;
            case 'view_activity':
                window.casaLink?.showPage('activity-log');
                break;
            default:
                // Default behavior
                window.focus();
        }
    }

    static async scheduleReminder(title, body, triggerTime, data = {}) {
        if ('Notification' in window && 'showTrigger' in Notification.prototype) {
            try {
                const registration = await navigator.serviceWorker.ready;
                
                await registration.showNotification(title, {
                    body: body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    tag: 'reminder', // Group similar notifications
                    showTrigger: new TimestampTrigger(triggerTime),
                    data: data
                });
                
                console.log('Scheduled notification for:', triggerTime);
            } catch (error) {
                console.error('Error scheduling notification:', error);
            }
        }
    }

    // Tenant-specific notifications
    static notifyRentDue(bill) {
        const daysUntilDue = Math.ceil((new Date(bill.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        let message = '';
        if (daysUntilDue === 0) {
            message = 'Your rent payment is due today!';
        } else if (daysUntilDue === 1) {
            message = 'Your rent payment is due tomorrow!';
        } else if (daysUntilDue > 0) {
            message = `Your rent payment of ₱${bill.totalAmount} is due in ${daysUntilDue} days`;
        } else {
            message = `Your rent payment of ₱${bill.totalAmount} is overdue by ${Math.abs(daysUntilDue)} days`;
        }

        this.showNotification('Rent Due Reminder', {
            body: message,
            tag: 'rent-reminder',
            actions: [
                { action: 'view_bill', title: 'View Bill' },
                { action: 'pay_now', title: 'Pay Now' }
            ]
        });
    }

    // Landlord-specific notifications
    static notifyNewMaintenance(request) {
        this.showNotification('New Maintenance Request', {
            body: `New ${request.type} request from ${request.tenantName}`,
            tag: 'maintenance-request',
            actions: [
                { action: 'view_maintenance', title: 'View Request' },
                { action: 'assign_staff', title: 'Assign Staff' }
            ]
        });
    }

    static notifyPropertyEdited(propertyData, changes) {
        const propertyName = propertyData.name || propertyData.apartmentName || 'Property';
        let changeSummary = '';
        
        if (changes && Object.keys(changes).length > 0) {
            const changeList = Object.keys(changes).map(field => {
                const displayName = field === 'numberOfRooms' ? 'rooms' :
                                  field === 'numberOfFloors' ? 'floors' :
                                  field === 'apartmentName' ? 'name' :
                                  field;
                return `${displayName} updated`;
            });
            changeSummary = ` (${changeList.join(', ')})`;
        }

        this.showNotification('Property Updated', {
            body: `${propertyName} has been edited${changeSummary}`,
            tag: 'property-edited',
            actions: [
                { action: 'view_properties', title: 'View Properties' },
                { action: 'view_activity', title: 'View Activity' }
            ],
            data: {
                propertyId: propertyData.id || propertyData.propertyId,
                changes: changes
            }
        });
    }
}
window.NotificationManager = NotificationManager;