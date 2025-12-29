/**
 * ====== نظام المصادقة لوحة الإدارة ======
 * 
 * هذا الملف يحتوي على نظام تسجيل الدخول للوحة الإدارة
 */

(function () {
  'use strict';

  // ====== إعدادات تسجيل الدخول ======
  // يمكنك تغيير اسم المستخدم وكلمة السر هنا
  const ADMIN_CREDENTIALS = {
    username: 'wahed',      // اسم المستخدم
    password: 'Emaan1357900@##'    // كلمة السر
  };

  // مدة جلسة تسجيل الدخول (بالساعات) - null = لا يوجد انتهاء
  const SESSION_DURATION_HOURS = 24;

  // ====== عناصر DOM ======
  const $ = (id) => document.getElementById(id);
  
  const loginModal = $('loginModal');
  const adminContainer = $('adminContainer');
  const usernameInput = $('username');
  const passwordInput = $('password');
  const btnLogin = $('btnLogin');
  const loginError = $('loginError');

  // ====== دوال المصادقة ======

  /**
   * التحقق من بيانات تسجيل الدخول
   * @param {string} username - اسم المستخدم
   * @param {string} password - كلمة السر
   * @returns {boolean} - true إذا كانت البيانات صحيحة
   */
  function validateCredentials(username, password) {
    return username === ADMIN_CREDENTIALS.username && 
           password === ADMIN_CREDENTIALS.password;
  }

  /**
   * حفظ جلسة تسجيل الدخول
   */
  function saveSession() {
    try {
      const sessionData = {
        loggedIn: true,
        timestamp: new Date().toISOString(),
        expiry: SESSION_DURATION_HOURS ? 
          new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000).toISOString() : 
          null
      };
      
      localStorage.setItem('admin_session', JSON.stringify(sessionData));
    } catch (error) {
      console.error('خطأ في حفظ الجلسة:', error);
    }
  }

  /**
   * التحقق من صحة الجلسة
   * @returns {boolean} - true إذا كانت الجلسة سارية
   */
  function checkSession() {
    try {
      const sessionData = localStorage.getItem('admin_session');
      if (!sessionData) {
        return false;
      }

      const session = JSON.parse(sessionData);
      
      // التحقق من انتهاء الجلسة
      if (session.expiry) {
        const expiryDate = new Date(session.expiry);
        const now = new Date();
        if (now > expiryDate) {
          // انتهت الجلسة
          localStorage.removeItem('admin_session');
          return false;
        }
      }

      return session.loggedIn === true;
    } catch (error) {
      console.error('خطأ في قراءة الجلسة:', error);
      return false;
    }
  }

  /**
   * إنهاء الجلسة
   */
  function logout() {
    try {
      localStorage.removeItem('admin_session');
      showLogin();
    } catch (error) {
      console.error('خطأ في إنهاء الجلسة:', error);
    }
  }

  /**
   * إظهار نافذة تسجيل الدخول
   */
  function showLogin() {
    if (loginModal) {
      loginModal.style.display = 'flex';
    }
    if (adminContainer) {
      adminContainer.style.display = 'none';
    }
    
    // مسح حقول الإدخال
    if (usernameInput) usernameInput.value = '';
    if (passwordInput) passwordInput.value = '';
    if (loginError) {
      loginError.textContent = '';
      loginError.style.display = 'none';
    }
    
    // التركيز على حقل اسم المستخدم
    setTimeout(() => {
      if (usernameInput) usernameInput.focus();
    }, 100);
  }

  /**
   * إخفاء نافذة تسجيل الدخول وإظهار لوحة الإدارة
   */
  function showAdmin() {
    if (loginModal) {
      loginModal.style.display = 'none';
    }
    if (adminContainer) {
      adminContainer.style.display = 'block';
    }
  }

  /**
   * إظهار رسالة خطأ
   * @param {string} message - رسالة الخطأ
   */
  function showError(message) {
    if (loginError) {
      loginError.textContent = message;
      loginError.style.display = 'block';
    }
    
    if (passwordInput) {
      passwordInput.value = '';
      passwordInput.focus();
    }
  }

  /**
   * إخفاء رسالة الخطأ
   */
  function hideError() {
    if (loginError) {
      loginError.textContent = '';
      loginError.style.display = 'none';
    }
  }

  /**
   * محاولة تسجيل الدخول
   */
  function attemptLogin() {
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    // التحقق من إدخال البيانات
    if (!username) {
      showError('يرجى إدخال اسم المستخدم');
      if (usernameInput) usernameInput.focus();
      return;
    }

    if (!password) {
      showError('يرجى إدخال كلمة السر');
      if (passwordInput) passwordInput.focus();
      return;
    }

    // التحقق من صحة البيانات
    if (!validateCredentials(username, password)) {
      showError('اسم المستخدم أو كلمة السر غير صحيحة');
      return;
    }

    // تسجيل الدخول ناجح
    hideError();
    saveSession();
    showAdmin();
  }

  // ====== ربط الأحداث ======

  // زر تسجيل الدخول
  if (btnLogin) {
    btnLogin.addEventListener('click', attemptLogin);
  }

  // تسجيل الدخول عند الضغط على Enter
  if (usernameInput) {
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (passwordInput) {
          passwordInput.focus();
        } else {
          attemptLogin();
        }
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        attemptLogin();
      }
    });

    // إخفاء رسالة الخطأ عند البدء بالكتابة
    passwordInput.addEventListener('input', () => {
      hideError();
    });
  }

  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      hideError();
    });
  }

  // ====== API عام ======

  /**
   * API للخروج من لوحة الإدارة
   */
  window.adminLogout = function() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
      logout();
    }
  };

  // ====== التهيئة ======

  /**
   * تهيئة نظام المصادقة
   */
  function init() {
    // التحقق من الجلسة
    if (checkSession()) {
      // الجلسة سارية - إظهار لوحة الإدارة
      showAdmin();
    } else {
      // لا توجد جلسة - إظهار نافذة تسجيل الدخول
      showLogin();
    }
  }

  // بدء التهيئة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

