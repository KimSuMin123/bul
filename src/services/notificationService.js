// ==============================================================================
// Sehwa Buddha Academy - PWA & Admin Push Notification Service
// Handles Service Worker registration, Web Notifications API, and real-time alerts
// ==============================================================================

import { isExternalDbConfigured, remoteDb } from './apiClient';

let swRegistration = null;
let broadcastChannel = null;

// Initialize Broadcast Channel for cross-tab notifications
try {
  broadcastChannel = new BroadcastChannel('buddha_notification_channel');
} catch (e) {
  console.warn('BroadcastChannel not supported in this environment');
}

/**
 * Play a soothing, crystal-clear chime sound using Web Audio API (No external mp3 required)
 */
export function playAlertChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note (peaceful chime)
    osc1.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.3); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440.00, ctx.currentTime); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.3); // E5

    gainNode.gain.setValueAtTime(0.01, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.3);
    osc2.stop(ctx.currentTime + 1.3);

    // Auto-close AudioContext to prevent memory/resource leaks
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch (err) {
    console.warn('Could not play alert chime:', err);
  }
}

/**
 * Register Service Worker for PWA and Push Notifications
 */
export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    console.log('✓ Service Worker registered successfully (PWA ready):', reg.scope);
    return reg;
  } catch (error) {
    console.warn('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Check if Web Notifications are supported by the browser/device
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission ('default' | 'granted' | 'denied')
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    throw new Error('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
  }

  const result = await Notification.requestPermission();
  return result;
}

/**
 * Send an OS-level Push Notification to the Administrator
 */
export async function sendAdminPushNotification({ title, body, data = {} }) {
  // Always play notification chime sound
  playAlertChime();

  // 1. Broadcast to open admin tabs via BroadcastChannel
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'NEW_ENROLLMENT_ALERT',
      title,
      body,
      data,
      timestamp: Date.now()
    });
  }

  // 2. If Notification permission is granted, dispatch OS-level notification
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      // Try via Service Worker first (works in PWA standalone & background)
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg) {
          reg.active?.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options: {
              body,
              icon: '/images/logo.png',
              badge: '/images/favicon-96x96.png',
              data: { url: '/#admin', ...data },
              tag: `enrollment-${Date.now()}`
            }
          });
          return true;
        }
      }

      // Fallback: Standard browser Notification constructor
      const notif = new Notification(title, {
        body,
        icon: '/images/logo.png',
        badge: '/images/favicon-96x96.png',
        tag: `enrollment-${Date.now()}`
      });
      notif.onclick = () => {
        window.focus();
        window.location.hash = 'admin';
        notif.close();
      };
      return true;
    } catch (e) {
      console.warn('Failed to display OS notification:', e);
    }
  }

  return false;
}

/**
 * Send test push notification for admin verification
 */
export async function sendTestNotification() {
  const permission = getNotificationPermission();
  if (permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (granted !== 'granted') {
      throw new Error('알림 권한이 허용되지 않았습니다. 브라우저 설정에서 알림을 허용해 주세요.');
    }
  }

  return sendAdminPushNotification({
    title: '🔔 [세화붓다아카데미] 관리자 푸시 알림 테스트',
    body: '수강신청 실시간 알림이 정상적으로 연동되었습니다. 수강생 신청 시 즉시 전달됩니다!',
    data: { url: '/#admin', type: 'test' }
  });
}

/**
 * Dispatch notification when a student applies for a course
 */
export async function notifyAdminCourseApplication({ studentName, courseTitle, studentId, courseId }) {
  const cleanName = studentName || '학인(수강생)';
  const cleanCourse = courseTitle || '강좌';

  return sendAdminPushNotification({
    title: '🔔 [세화붓다아카데미] 새로운 수강신청 접수!',
    body: `${cleanName}님이 [${cleanCourse}] 수강을 신청했습니다. (대면 수납 대기)`,
    data: {
      url: '/#admin',
      type: 'course_application',
      studentId,
      courseId
    }
  });
}

/**
 * Background polling listener for Admin to detect incoming enrollments from other devices
 */
export function startAdminEnrollmentListener(onNewEnrollment) {
  if (typeof window === 'undefined') return () => {};

  let lastCheckedIds = new Set();
  let isFirstRun = true;
  let isChecking = false;

  const checkNewEnrollments = async () => {
    if (!isExternalDbConfigured || isChecking) return;
    isChecking = true;
    try {
      const enrollments = await remoteDb.getEnrollments();
      if (!Array.isArray(enrollments)) return;

      const currentPending = enrollments.filter(e => e.status === 'pending' || e.status === 'applied');

      if (isFirstRun) {
        currentPending.forEach(e => lastCheckedIds.add(e.id));
        isFirstRun = false;
        return;
      }

      // Check if any new pending enrollment arrived
      for (const item of currentPending) {
        if (!lastCheckedIds.has(item.id)) {
          lastCheckedIds.add(item.id);
          // New enrollment detected!
          if (onNewEnrollment) {
            onNewEnrollment(item);
          }
        }
      }
    } catch (e) {
      // Quiet fail on network hiccups
    } finally {
      isChecking = false;
    }
  };

  // Initial check
  checkNewEnrollments();

  // Poll every 12 seconds
  const intervalId = setInterval(checkNewEnrollments, 12000);

  // Also listen to cross-tab BroadcastChannel
  let channelHandler = null;
  if (broadcastChannel) {
    channelHandler = (event) => {
      if (event.data && event.data.type === 'NEW_ENROLLMENT_ALERT') {
        playAlertChime();
        if (onNewEnrollment) {
          onNewEnrollment(event.data);
        }
      }
    };
    broadcastChannel.addEventListener('message', channelHandler);
  }

  return () => {
    clearInterval(intervalId);
    if (broadcastChannel && channelHandler) {
      broadcastChannel.removeEventListener('message', channelHandler);
    }
  };
}
