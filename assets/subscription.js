/**
 * ====== نظام إدارة الاشتراكات ======
 * 
 * هذا الملف يحتوي على نظام التحقق من كود الاشتراك:
 * - التحقق من صحة الكود المدخل
 * - حفظ حالة التحقق
 * - إخفاء/إظهار المحتوى بناءً على حالة التحقق
 */

(function () {
  'use strict';

  // ====== إعدادات النظام ======
  // يتم تحميل الإعدادات من قاعدة البيانات
  
  // متغيرات مؤقتة للإعدادات (سيتم تحميلها من قاعدة البيانات)
  let VALID_CODES = [];
  let SUBSCRIPTION_DURATION = null;
  
  /**
   * تحميل الإعدادات من قاعدة البيانات
   */
  async function loadSubscriptionSettings() {
    try {
      // تحميل المستخدمين والأكواد
      if (typeof window.SubscriptionAPI !== 'undefined') {
        const users = await window.SubscriptionAPI.getUsers();
        if (users && users.length > 0) {
          window.SUBSCRIPTION_USERS = users;
          VALID_CODES = users.map(u => u.code);
          window.SUBSCRIPTION_CODES = VALID_CODES;
        } else {
          // قيم افتراضية إذا لم توجد بيانات في قاعدة البيانات
          VALID_CODES = [];
          window.SUBSCRIPTION_CODES = [];
        }
      }
      
      // تحميل إعدادات المدة
      if (typeof window.SubscriptionAPI !== 'undefined') {
        const settings = await window.SubscriptionAPI.getSettings();
        if (settings && settings.duration !== undefined) {
          SUBSCRIPTION_DURATION = settings.duration;
          window.SUBSCRIPTION_DURATION = settings.duration;
        } else {
          SUBSCRIPTION_DURATION = null;
          window.SUBSCRIPTION_DURATION = null;
        }
      }
    } catch (error) {
      console.warn('⚠️ فشل تحميل الإعدادات من قاعدة البيانات:', error);
      // قيم افتراضية في حالة الفشل
      VALID_CODES = [];
      SUBSCRIPTION_DURATION = null;
    }
  }

  // ====== عناصر DOM ======
  const $ = (id) => document.getElementById(id);
  
  let subscriptionModal = null;
  let codeInput = null;
  let submitBtn = null;
  let errorMsg = null;
  let mainContent = null;
  let countdownTimer = null;
  let countdownInterval = null;

  // ====== دوال التحقق والوقت ======

  /**
   * إنشاء معرف فريد للجهاز (Device ID)
   * @returns {string} - معرف الجهاز
   */
  function generateDeviceId() {
    try {
      // محاولة استخدام localStorage للحصول على Device ID محفوظ
      let deviceId = localStorage.getItem('device_id');
      
      if (!deviceId) {
        // إنشاء Device ID جديد بناءً على خصائص المتصفح
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        
        const fingerprint = [
          navigator.userAgent,
          navigator.language,
          screen.width + 'x' + screen.height,
          new Date().getTimezoneOffset(),
          canvas.toDataURL(),
          navigator.hardwareConcurrency || '',
          navigator.platform
        ].join('|');
        
        // إنشاء hash بسيط
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
          const char = fingerprint.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        
        deviceId = 'device_' + Math.abs(hash).toString(36);
        localStorage.setItem('device_id', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('خطأ في إنشاء Device ID:', error);
      // Fallback: استخدام timestamp عشوائي
      return 'device_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
  }

  /**
   * حساب المدة بالمللي ثانية بناءً على القيمة والوحدة
   * @param {number} value - القيمة العددية
   * @param {string} unit - الوحدة الزمنية ('hours', 'days', 'months', 'years')
   * @returns {number} - المدة بالمللي ثانية
   */
  function calculateDurationMs(value, unit) {
    const now = new Date();
    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    const msPerMonth = 30 * msPerDay; // تقريبي
    const msPerYear = 365 * msPerDay; // تقريبي

    switch (unit) {
      case 'hours':
        return value * msPerHour;
      case 'days':
        return value * msPerDay;
      case 'months':
        return value * msPerMonth;
      case 'years':
        return value * msPerYear;
      default:
        return value * msPerDay; // افتراضي: أيام
    }
  }

  /**
   * التحقق من أن الكود غير معطل
   * @param {string} code - الكود المراد التحقق منه
   * @returns {boolean} - true إذا كان الكود معطلاً
   */
  function isCodeDisabled(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }
    
    const cleanCode = code.trim().toUpperCase();
    const disabledCodes = JSON.parse(localStorage.getItem('disabled_codes') || '[]');
    return disabledCodes.includes(cleanCode);
  }

  /**
   * تعطيل الكود بالكامل
   * @param {string} code - الكود المراد تعطيله
   */
  function disableCode(code) {
    if (!code || typeof code !== 'string') {
      return;
    }
    
    const cleanCode = code.trim().toUpperCase();
    const disabledCodes = JSON.parse(localStorage.getItem('disabled_codes') || '[]');
    
    if (!disabledCodes.includes(cleanCode)) {
      disabledCodes.push(cleanCode);
      localStorage.setItem('disabled_codes', JSON.stringify(disabledCodes));
      console.warn('🚫 تم تعطيل الكود:', cleanCode);
    }
    
    // إزالة الكود من الخريطة
    const codeDeviceMap = JSON.parse(localStorage.getItem('code_device_map') || '{}');
    if (codeDeviceMap[cleanCode]) {
      delete codeDeviceMap[cleanCode];
      localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
    }
    
    // إلغاء أي اشتراك مرتبط بهذا الكود
    const stored = localStorage.getItem('subscription_verified');
    if (stored) {
      try {
        const subscriptionData = JSON.parse(stored);
        if (subscriptionData.code && subscriptionData.code.toUpperCase() === cleanCode) {
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
          if (countdownTimer) {
            removeCountdown();
          }
        }
      } catch (e) {
        console.error('خطأ في قراءة الاشتراك:', e);
      }
    }
  }

  /**
   * تحميل المستخدمين من قاعدة البيانات
   * @returns {Promise<Array>} - قائمة المستخدمين
   */
  async function loadUsersFromDB() {
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        const dbUsers = await window.SubscriptionAPI.getUsers();
        if (dbUsers && dbUsers.length > 0) {
          // تحويل التنسيق
          const users = dbUsers.map(u => ({
            id: u.id,
            code: u.code,
            name: u.name
          }));
          // تحديث المتغيرات العامة
          window.SUBSCRIPTION_USERS = users;
          window.SUBSCRIPTION_CODES = users.map(u => u.code);
          return users;
        }
      } catch (error) {
        console.warn('⚠️ فشل تحميل المستخدمين من قاعدة البيانات:', error);
      }
    }
    return null;
  }

  /**
   * التحقق من صحة الكود واسم المستخدم
   * @param {string} code - الكود المراد التحقق منه
   * @param {string} userName - اسم المستخدم
   * @returns {Promise<Object>} - {valid: boolean, user: Object|null}
   */
  async function validateCodeAndUser(code, userName) {
    if (!code || typeof code !== 'string' || !userName || typeof userName !== 'string') {
      return { valid: false, user: null };
    }
    
    const cleanCode = code.trim().toUpperCase();
    const cleanUserName = userName.trim();
    
    // التحقق من أن الكود غير معطل
    if (isCodeDisabled(cleanCode)) {
      return { valid: false, user: null, disabled: true };
    }
    
    // تحميل المستخدمين من قاعدة البيانات فقط
    const users = await loadUsersFromDB() || [];
    
    // البحث عن المستخدم المطابق بالاسم والكود
    if (users.length > 0) {
      const user = users.find(u => 
        u.name.trim() === cleanUserName && u.code.toUpperCase() === cleanCode
      );
      
      if (user) {
        // التحقق مرة أخرى من أن الكود غير معطل
        if (isCodeDisabled(cleanCode)) {
          return { valid: false, user: null, disabled: true };
        }
        return { valid: true, user: user };
      }
    }
    
    // إذا لم يتم العثور على المستخدم في قاعدة البيانات، الكود غير صحيح
    return { valid: false, user: null };
  }

  /**
   * التحقق من صحة الكود المدخل
   * @param {string} code - الكود المراد التحقق منه
   * @returns {Promise<boolean>} - true إذا كان الكود صحيحاً
   */
  async function isValidCode(code) {
    if (!code || typeof code !== 'string') {
      return false;
    }
    
    const cleanCode = code.trim().toUpperCase();
    
    // التحقق من قاعدة البيانات
    const users = await loadUsersFromDB() || [];
    return users.some(u => u.code.toUpperCase() === cleanCode);
  }

  /**
   * حفظ حالة التحقق في localStorage
   * @param {string} code - الكود الصحيح
   * @param {string} userName - اسم المستخدم
   * @param {Object} user - معلومات المستخدم
   */
  async function saveSubscription(code, userName, user) {
    try {
      // تحميل الإعدادات من قاعدة البيانات أولاً
      await loadSubscriptionSettings();
      
      let expiry = null;
      
      // استخدام الإعدادات المحملة من قاعدة البيانات
      const duration = SUBSCRIPTION_DURATION || window.SUBSCRIPTION_DURATION;
      
      if (duration && duration.value) {
        const durationMs = calculateDurationMs(
          duration.value, 
          duration.unit
        );
        expiry = new Date(Date.now() + durationMs).toISOString();
      }

      // إنشاء أو الحصول على Device ID
      const deviceId = generateDeviceId();
      const currentCode = code.trim().toUpperCase();
      
      // التحقق من استخدام هذا الكود على جهاز آخر
      // نحفظ معلومات الكود والجهاز في localStorage منفصل
      const codeDeviceMap = JSON.parse(localStorage.getItem('code_device_map') || '{}');
      
      // إذا كان الكود مستخدماً على جهاز آخر، تعطيل الكود بالكامل
      if (codeDeviceMap[currentCode] && codeDeviceMap[currentCode] !== deviceId) {
        console.error('🚫 تم اكتشاف استخدام هذا الكود على جهاز آخر - سيتم تعطيل الكود بالكامل');
        // تعطيل الكود بالكامل
        disableCode(currentCode);
        throw new Error('تم تعطيل هذا الكود بسبب استخدامه على أكثر من جهاز');
      }
      
      // حفظ ربط الكود بالجهاز الحالي
      codeDeviceMap[currentCode] = deviceId;
      localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
      
      const subscriptionData = {
        code: currentCode,
        userName: userName ? userName.trim() : null,
        user: user || null,
        deviceId: deviceId, // حفظ Device ID
        verified: true,
        timestamp: new Date().toISOString(),
        expiry: expiry,
        duration: duration ? {
          value: duration.value,
          unit: duration.unit
        } : null
      };
      
      localStorage.setItem('subscription_verified', JSON.stringify(subscriptionData));
      console.log('✅ تم حفظ حالة الاشتراك', subscriptionData);
      
      // بدء العداد التنازلي
      if (expiry) {
        startCountdown();
      }
    } catch (error) {
      console.error('❌ خطأ في حفظ حالة الاشتراك:', error);
    }
  }

  /**
   * التحقق من تطابق إعدادات الاشتراك الحالية مع المحفوظة
   * @returns {Promise<boolean>} - true إذا كانت الإعدادات متطابقة
   */
  async function checkSubscriptionSettingsMatch() {
    try {
      // تحميل الإعدادات من قاعدة البيانات أولاً
      await loadSubscriptionSettings();
      
      const stored = localStorage.getItem('subscription_verified');
      if (!stored) {
        return true; // لا يوجد اشتراك محفوظ
      }

      const subscriptionData = JSON.parse(stored);
      
      // استخدام الإعدادات المحملة
      const duration = SUBSCRIPTION_DURATION || window.SUBSCRIPTION_DURATION;
      
      // إذا كانت الإعدادات الحالية null (لا يوجد انتهاء صلاحية)
      if (!duration || !duration.value) {
        // إذا كان الاشتراك المحفوظ له انتهاء صلاحية، يجب إعادة التحقق
        if (subscriptionData.expiry) {
          return false;
        }
        return true;
      }

      // التحقق من تطابق الإعدادات
      if (subscriptionData.duration) {
        const currentDuration = {
          value: duration.value,
          unit: duration.unit
        };
        
        // إذا تغيرت الإعدادات، يجب إعادة التحقق
        if (subscriptionData.duration.value !== currentDuration.value ||
            subscriptionData.duration.unit !== currentDuration.unit) {
          return false;
        }
      } else {
        // إذا كان الاشتراك القديم بدون معلومات المدة، يجب إعادة التحقق
        if (duration && duration.value) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ خطأ في التحقق من تطابق الإعدادات:', error);
      return false;
    }
  }

  /**
   * التحقق من حالة الاشتراك المحفوظة
   * @returns {Promise<boolean>} - true إذا كانت الاشتراك سارية
   */
  async function checkStoredSubscription() {
    try {
      const stored = localStorage.getItem('subscription_verified');
      if (!stored) {
        return false;
      }

      // التحقق من تطابق الإعدادات أولاً
      const settingsMatch = await checkSubscriptionSettingsMatch();
      if (!settingsMatch) {
        console.log('⚠️ تغيرت إعدادات الاشتراك - يجب إعادة التحقق');
        localStorage.removeItem('subscription_verified');
        sessionStorage.removeItem('subscription_session_verified');
        if (countdownTimer) {
          removeCountdown();
        }
        return false;
      }

      const subscriptionData = JSON.parse(stored);
      
      // التحقق من انتهاء الصلاحية
      if (subscriptionData.expiry) {
        const expiryDate = new Date(subscriptionData.expiry);
        const now = new Date();
        if (now > expiryDate) {
          // انتهت الصلاحية
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
          if (countdownTimer) {
            removeCountdown();
          }
          return false;
        }
      }

      // التحقق من صحة الكود المحفوظ
      if (subscriptionData.verified) {
        // للتوافق مع الكود القديم، نعيد true إذا كان هناك اشتراك محفوظ
        // (التحقق الفعلي يتم في verifyAndUnlock)
        if (subscriptionData.userName || subscriptionData.userId || subscriptionData.code) {
          // بدء العداد التنازلي إذا كان موجوداً
          if (subscriptionData.expiry) {
            startCountdown();
          }
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ خطأ في قراءة حالة الاشتراك:', error);
      return false;
    }
  }

  /**
   * حذف حالة الاشتراك المحفوظة
   */
  function clearSubscription() {
    try {
      const stored = localStorage.getItem('subscription_verified');
      if (stored) {
        try {
          const subscriptionData = JSON.parse(stored);
          const codeDeviceMap = JSON.parse(localStorage.getItem('code_device_map') || '{}');
          
          // إزالة الكود من الخريطة
          if (subscriptionData.code) {
            const code = subscriptionData.code.toUpperCase();
            if (codeDeviceMap[code]) {
              delete codeDeviceMap[code];
              localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
            }
          }
        } catch (e) {
          console.error('خطأ في قراءة الاشتراك:', e);
        }
      }
      
      localStorage.removeItem('subscription_verified');
      sessionStorage.removeItem('subscription_session_verified');
      removeCountdown();
      console.log('✅ تم حذف حالة الاشتراك');
    } catch (error) {
      console.error('❌ خطأ في حذف حالة الاشتراك:', error);
    }
  }

  // ====== العداد التنازلي ======

  /**
   * تنسيق الوقت المتبقي بشكل مقروء
   * @param {number} ms - الوقت بالمللي ثانية
   * @returns {Object} - كائن يحتوي على الوقت المتبقي
   */
  function formatTimeRemaining(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) {
      return {
        value: years,
        unit: 'سنة',
        plural: 'سنوات',
        remaining: days % 365
      };
    } else if (months > 0) {
      return {
        value: months,
        unit: 'شهر',
        plural: 'أشهر',
        remaining: days % 30
      };
    } else if (days > 0) {
      return {
        value: days,
        unit: 'يوم',
        plural: 'أيام',
        remaining: hours % 24
      };
    } else if (hours > 0) {
      return {
        value: hours,
        unit: 'ساعة',
        plural: 'ساعات',
        remaining: minutes % 60
      };
    } else if (minutes > 0) {
      return {
        value: minutes,
        unit: 'دقيقة',
        plural: 'دقائق',
        remaining: seconds % 60
      };
    } else {
      return {
        value: seconds,
        unit: 'ثانية',
        plural: 'ثواني',
        remaining: 0
      };
    }
  }

  /**
   * تحديث عرض العداد التنازلي
   */
  function updateCountdown() {
    try {
      const stored = localStorage.getItem('subscription_verified');
      if (!stored) {
        removeCountdown();
        return;
      }

      const subscriptionData = JSON.parse(stored);
      if (!subscriptionData.expiry) {
        removeCountdown();
        return;
      }

      const expiryDate = new Date(subscriptionData.expiry);
      const now = new Date();
      const remaining = expiryDate - now;

      if (remaining <= 0) {
        // انتهت الصلاحية
        if (countdownTimer) {
          countdownTimer.innerHTML = '<span class="countdown-expired">⏰ انتهت صلاحية الاشتراك</span>';
        }
        clearInterval(countdownInterval);
        setTimeout(() => {
          clearSubscription();
          location.reload();
        }, 2000);
        return;
      }

      const time = formatTimeRemaining(remaining);
      const unitText = time.value === 1 ? time.unit : time.plural;
      
      let displayText = `⏳ المدة المتبقية: ${time.value} ${unitText}`;
      
      // إضافة التفاصيل الإضافية للدقة
      if (time.remaining > 0) {
        const remainingMs = remaining - (time.value * (
          time.unit === 'سنة' ? 365 * 24 * 60 * 60 * 1000 :
          time.unit === 'شهر' ? 30 * 24 * 60 * 60 * 1000 :
          time.unit === 'يوم' ? 24 * 60 * 60 * 1000 :
          time.unit === 'ساعة' ? 60 * 60 * 1000 :
          time.unit === 'دقيقة' ? 60 * 1000 : 1000
        ));
        
        if (remainingMs > 0) {
          const remainingTime = formatTimeRemaining(remainingMs);
          if (remainingTime.value > 0 && (time.value < 7 || time.unit === 'ساعة' || time.unit === 'دقيقة')) {
            const remainingUnitText = remainingTime.value === 1 ? remainingTime.unit : remainingTime.plural;
            displayText += ` و ${remainingTime.value} ${remainingUnitText}`;
          }
        }
      }

      if (countdownTimer) {
        countdownTimer.innerHTML = `<span class="countdown-text">${displayText}</span>`;
      }
    } catch (error) {
      console.error('❌ خطأ في تحديث العداد:', error);
    }
  }

  /**
   * إنشاء عنصر العداد التنازلي
   */
  function createCountdown() {
    // التحقق من وجود العداد مسبقاً
    if (countdownTimer) {
      return;
    }

    const countdown = document.createElement('div');
    countdown.id = 'subscriptionCountdown';
    countdown.className = 'subscription-countdown';
    countdown.innerHTML = '<span class="countdown-text">⏳ جاري التحميل...</span>';
    
    // إدراج العداد في بداية body (قبل أي محتوى آخر)
    if (document.body.firstChild) {
      document.body.insertBefore(countdown, document.body.firstChild);
    } else {
      document.body.appendChild(countdown);
    }
    countdownTimer = countdown;
  }

  /**
   * بدء العداد التنازلي
   */
  function startCountdown() {
    createCountdown();
    updateCountdown(); // تحديث فوري
    
    // تحديث كل ثانية
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    countdownInterval = setInterval(updateCountdown, 1000);
  }

  /**
   * إزالة العداد التنازلي
   */
  function removeCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    
    if (countdownTimer && countdownTimer.parentNode) {
      countdownTimer.parentNode.removeChild(countdownTimer);
      countdownTimer = null;
    }
  }

  // ====== واجهة المستخدم ======

  /**
   * إنشاء نموذج إدخال الكود
   */
  function createSubscriptionModal() {
    // إنشاء العنصر الرئيسي
    const modal = document.createElement('div');
    modal.id = 'subscriptionModal';
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="subscription-content">
        <div class="subscription-header">
          <h2>🔐 نظام الاشتراكات</h2>
          <p>يرجى إدخال اسم المستخدم وكود الاشتراك للوصول إلى النظام</p>
        </div>
        <div class="subscription-body">
          <div class="input-group">
            <label for="subscriptionUserName">اسم المستخدم</label>
            <input 
              type="text" 
              id="subscriptionUserName" 
              placeholder="أدخل اسم المستخدم" 
              autocomplete="off"
              autofocus
            />
          </div>
          <div class="input-group">
            <label for="subscriptionCode">كود الاشتراك</label>
            <input 
              type="text" 
              id="subscriptionCode" 
              placeholder="أدخل كود الاشتراك" 
              autocomplete="off"
            />
            <div id="subscriptionError" class="error-message-text"></div>
          </div>
        </div>
        <div class="subscription-footer">
          <button id="subscriptionSubmit" class="btn primary">تأكيد</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  /**
   * إظهار رسالة خطأ
   * @param {string} message - رسالة الخطأ
   */
  function showError(message) {
    if (errorMsg) {
      errorMsg.textContent = message;
      errorMsg.style.display = 'block';
    }
    
    if (codeInput) {
      codeInput.classList.add('error');
      codeInput.focus();
    }
  }

  /**
   * إخفاء رسالة الخطأ
   */
  function hideError() {
    if (errorMsg) {
      errorMsg.textContent = '';
      errorMsg.style.display = 'none';
    }
    
    if (codeInput) {
      codeInput.classList.remove('error');
    }
  }

  /**
   * التحقق من الكود وإظهار المحتوى
   */
  async function verifyAndUnlock() {
    if (!codeInput) return;

    const userNameInput = $('subscriptionUserName');
    const userName = userNameInput ? userNameInput.value.trim() : '';
    const code = codeInput.value.trim();
    
    // التحقق من إدخال اسم المستخدم
    if (!userName) {
      showError('يرجى إدخال اسم المستخدم');
      if (userNameInput) userNameInput.focus();
      return;
    }

    // التحقق من إدخال كود
    if (!code) {
      showError('يرجى إدخال كود الاشتراك');
      if (codeInput) codeInput.focus();
      return;
    }

    // التحقق من صحة الكود واسم المستخدم
    const validation = await validateCodeAndUser(code, userName);
    if (!validation.valid) {
      if (validation.disabled) {
        showError('⚠️ هذا الكود معطل بسبب استخدامه على أكثر من جهاز. يرجى التواصل مع الدعم الفني.');
      } else {
        showError('اسم المستخدم أو كود الاشتراك غير صحيح. يرجى التحقق والمحاولة مرة أخرى');
      }
      if (codeInput) codeInput.value = '';
      if (codeInput) codeInput.focus();
      return;
    }

    // التحقق من أن الكود غير معطل
    if (isCodeDisabled(code)) {
      showError('⚠️ هذا الكود معطل بسبب استخدامه على أكثر من جهاز. يرجى التواصل مع الدعم الفني.');
      if (codeInput) codeInput.value = '';
      if (codeInput) codeInput.focus();
      return;
    }
    
    // التحقق من Device ID والكود المستخدم
    const currentDeviceId = generateDeviceId();
    const currentCode = code.trim().toUpperCase();
    const stored = localStorage.getItem('subscription_verified');
    const codeDeviceMap = JSON.parse(localStorage.getItem('code_device_map') || '{}');
    
    // التحقق من استخدام الكود على جهاز آخر
    if (codeDeviceMap[currentCode] && codeDeviceMap[currentCode] !== currentDeviceId) {
      showError('⚠️ تم اكتشاف استخدام هذا الكود على جهاز آخر. سيتم تعطيل الكود بالكامل.');
      // تعطيل الكود بالكامل
      disableCode(currentCode);
      if (codeInput) codeInput.value = '';
      if (codeInput) codeInput.focus();
      return;
    }
    
    if (stored) {
      try {
        const subscriptionData = JSON.parse(stored);
        
        // إذا كان هناك Device ID محفوظ وكان مختلفاً، إلغاء الاشتراك
        if (subscriptionData.deviceId && subscriptionData.deviceId !== currentDeviceId) {
          showError('⚠️ تم اكتشاف استخدام هذا الكود على جهاز آخر. تم إلغاء الاشتراك لأسباب أمنية.');
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
          // إزالة الكود من الخريطة
          if (subscriptionData.code && codeDeviceMap[subscriptionData.code.toUpperCase()]) {
            delete codeDeviceMap[subscriptionData.code.toUpperCase()];
            localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
          }
          if (countdownTimer) {
            removeCountdown();
          }
          // نتابع لإضافة الاشتراك الجديد
        }
        
        // إذا كان الكود مختلفاً عن المحفوظ، إلغاء الاشتراك القديم
        if (subscriptionData.code && subscriptionData.code.toUpperCase() !== currentCode) {
          // إزالة الكود القديم من الخريطة
          if (codeDeviceMap[subscriptionData.code.toUpperCase()]) {
            delete codeDeviceMap[subscriptionData.code.toUpperCase()];
            localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
          }
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
        }
      } catch (error) {
        console.error('خطأ في قراءة الاشتراك المحفوظ:', error);
      }
    }

    // الكود واسم المستخدم صحيحان - حفظ الحالة وإظهار المحتوى
    hideError();
    
    try {
      await saveSubscription(code, userName, validation.user);
      
      // حفظ حالة التحقق في sessionStorage للجلسة الحالية
      sessionStorage.setItem('subscription_session_verified', 'true');
      
      unlockContent();
    } catch (error) {
      if (error.message.includes('تعطيل')) {
        showError('⚠️ تم تعطيل هذا الكود بسبب استخدامه على أكثر من جهاز. يرجى التواصل مع الدعم الفني.');
        if (codeInput) codeInput.value = '';
        if (codeInput) codeInput.focus();
      } else {
        showError('حدث خطأ أثناء حفظ الاشتراك. يرجى المحاولة مرة أخرى.');
        console.error('خطأ في حفظ الاشتراك:', error);
      }
    }
  }

  /**
   * إظهار المحتوى الرئيسي وإخفاء نموذج الكود
   */
  function unlockContent() {
    // التأكد من العثور على mainContent إذا لم يكن موجوداً
    if (!mainContent) {
      mainContent = document.querySelector('.paper') || document.querySelector('main') || document.body;
    }
    
    if (subscriptionModal) {
      subscriptionModal.style.display = 'none';
    }
    
    if (mainContent) {
      mainContent.style.display = '';
      mainContent.style.visibility = 'visible';
      mainContent.style.opacity = '1';
    }

    // إزالة النموذج من DOM بعد فترة قصيرة
    setTimeout(() => {
      if (subscriptionModal && subscriptionModal.parentNode) {
        subscriptionModal.parentNode.removeChild(subscriptionModal);
      }
    }, 300);

    // تحديث حالة الاشتراك النشط
    window._subscriptionActive = true;

    // إرسال حدث للسماح بإعادة تهيئة التطبيق
    const event = new CustomEvent('subscriptionVerified');
    window.dispatchEvent(event);
    
    console.log('✅ تم إظهار المحتوى الرئيسي');
  }

  /**
   * إخفاء المحتوى الرئيسي وإظهار نموذج الكود
   */
  function lockContent() {
    // التأكد من العثور على mainContent إذا لم يكن موجوداً
    if (!mainContent) {
      mainContent = document.querySelector('.paper') || document.querySelector('main') || document.body;
    }
    
    if (mainContent) {
      mainContent.style.display = 'none';
    }
    
    if (subscriptionModal) {
      subscriptionModal.style.display = 'flex';
    }
    
    console.log('🔒 تم إخفاء المحتوى الرئيسي');
  }

  // ====== تهيئة النظام ======

  /**
   * تهيئة نظام الاشتراكات
   * يطلب إدخال الكود مرة واحدة فقط عند فتح التبويبة لأول مرة
   */
  async function initSubscription() {
    // تحميل الإعدادات من قاعدة البيانات أولاً
    await loadSubscriptionSettings();
    // الحصول على العناصر الرئيسية
    mainContent = document.querySelector('.paper') || document.querySelector('main') || document.body;
    
    // التحقق من أن المستخدم دخل الكود في هذه الجلسة (sessionStorage)
    const sessionVerified = sessionStorage.getItem('subscription_session_verified');
    
    // التحقق من Device ID والصلاحية والكود المستخدم
    const stored = localStorage.getItem('subscription_verified');
    if (stored) {
      try {
        const subscriptionData = JSON.parse(stored);
        const currentDeviceId = generateDeviceId();
        const codeDeviceMap = JSON.parse(localStorage.getItem('code_device_map') || '{}');
        const currentCode = subscriptionData.code ? subscriptionData.code.toUpperCase() : null;
        
        // التحقق من أن الكود غير معطل
        if (currentCode && isCodeDisabled(currentCode)) {
          console.error('🚫 هذا الكود معطل - إلغاء الاشتراك');
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
          if (countdownTimer) {
            removeCountdown();
          }
          alert('⚠️ هذا الكود معطل بسبب استخدامه على أكثر من جهاز.\nتم إلغاء الاشتراك.\nيرجى التواصل مع الدعم الفني.');
          return;
        }
        
        // التحقق من ربط الكود بالجهاز
        if (currentCode && codeDeviceMap[currentCode]) {
          // إذا كان الكود مرتبطاً بجهاز آخر، تعطيل الكود
          if (codeDeviceMap[currentCode] !== currentDeviceId) {
            console.error('🚫 هذا الكود مستخدم على جهاز آخر - تعطيل الكود');
            disableCode(currentCode);
            sessionStorage.removeItem('subscription_session_verified');
            alert('⚠️ تم اكتشاف استخدام هذا الكود على جهاز آخر.\nتم تعطيل الكود بالكامل.\nيرجى التواصل مع الدعم الفني.');
            return;
          }
        }
        
        // التحقق من Device ID المحفوظ مع الاشتراك
        if (subscriptionData.deviceId && subscriptionData.deviceId !== currentDeviceId) {
          console.error('🚫 Device ID مختلف - تعطيل الكود');
          if (currentCode) {
            disableCode(currentCode);
          }
          sessionStorage.removeItem('subscription_session_verified');
          alert('⚠️ تم اكتشاف استخدام هذا الكود على جهاز آخر.\nتم تعطيل الكود بالكامل.\nيرجى التواصل مع الدعم الفني.');
          return;
        }
        
        // التحقق من انتهاء الصلاحية
        if (subscriptionData.expiry) {
          const expiryDate = new Date(subscriptionData.expiry);
          const now = new Date();
          if (now > expiryDate) {
            console.warn('⚠️ انتهت صلاحية الاشتراك');
            localStorage.removeItem('subscription_verified');
            sessionStorage.removeItem('subscription_session_verified');
            // إزالة الكود من الخريطة
            if (currentCode && codeDeviceMap[currentCode]) {
              delete codeDeviceMap[currentCode];
              localStorage.setItem('code_device_map', JSON.stringify(codeDeviceMap));
            }
            if (countdownTimer) {
              removeCountdown();
            }
          }
        }
        
        // التحقق مرة أخرى من أن الكود غير معطل (في حالة تعطيله من جهاز آخر)
        if (currentCode && isCodeDisabled(currentCode)) {
          console.error('🚫 هذا الكود معطل - إلغاء الاشتراك');
          localStorage.removeItem('subscription_verified');
          sessionStorage.removeItem('subscription_session_verified');
          if (countdownTimer) {
            removeCountdown();
          }
          alert('⚠️ هذا الكود معطل بسبب استخدامه على أكثر من جهاز.\nتم إلغاء الاشتراك.\nيرجى التواصل مع الدعم الفني.');
          return;
        }
      } catch (error) {
        console.error('خطأ في قراءة الاشتراك:', error);
      }
    }

    // التحقق من وجود اشتراك صحيح - إذا كان موجوداً وصحيحاً، نستخدمه
    const settingsMatch = await checkSubscriptionSettingsMatch();
    const hasValidSubscription = await checkStoredSubscription();
    
    // إذا كان هناك اشتراك صحيح، إظهار المحتوى مباشرة
    if (hasValidSubscription && settingsMatch) {
      // يوجد اشتراك صحيح - إظهار المحتوى مباشرة
      console.log('✅ يوجد اشتراك نشط - إظهار المحتوى');
      
      // إذا لم يكن هناك sessionVerified، نضيفه (للتأكد من عدم طلب الكود عند تحديث الصفحة)
      if (!sessionVerified) {
        sessionStorage.setItem('subscription_session_verified', 'true');
      }
      
      unlockContent();
      
      // بدء العداد التنازلي إذا كان موجوداً
      if (stored) {
        try {
          const subscriptionData = JSON.parse(stored);
          if (subscriptionData.expiry) {
            startCountdown();
          }
        } catch (error) {
          console.error('خطأ في قراءة الاشتراك:', error);
        }
      }
      return;
    }
    
    // لا يوجد اشتراك صحيح - طلب إدخال الكود
    console.log('🔒 يطلب إدخال بيانات الاشتراك (أول مرة في هذه الجلسة)');
    
    // إنشاء وإظهار النموذج
    subscriptionModal = createSubscriptionModal();
    lockContent();

    // الحصول على عناصر النموذج
    const userNameInput = $('subscriptionUserName');
    codeInput = $('subscriptionCode');
    submitBtn = $('subscriptionSubmit');
    errorMsg = $('subscriptionError');

    // ربط الأحداث
    if (submitBtn) {
      submitBtn.addEventListener('click', verifyAndUnlock);
    }

    if (userNameInput) {
      // الانتقال لحقل الكود عند الضغط على Enter
      userNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (codeInput) {
            codeInput.focus();
          }
        }
      });

      // إخفاء رسالة الخطأ عند البدء بالكتابة
      userNameInput.addEventListener('input', () => {
        hideError();
      });
    }

    if (codeInput) {
      // التحقق عند الضغط على Enter
      codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyAndUnlock();
        }
      });

      // إخفاء رسالة الخطأ عند البدء بالكتابة
      codeInput.addEventListener('input', () => {
        hideError();
      });
    }

    // التركيز على حقل اسم المستخدم
    setTimeout(() => {
      if (userNameInput) userNameInput.focus();
    }, 100);
  }

  // ====== API عام ======

  /**
   * متغير لتتبع حالة الاشتراك النشط في الجلسة الحالية
   */
  window._subscriptionActive = false;

  /**
   * API للتحقق من حالة الاشتراك من خارج الملف
   * @returns {boolean} - true إذا تم التحقق من الكود في الجلسة الحالية
   */
  window.isSubscriptionActive = function() {
    // نتحقق من حالة الاشتراك في الجلسة الحالية فقط
    // في كل مرة يتم فتح الصفحة، يجب إدخال الكود مرة أخرى
    return window._subscriptionActive === true;
  };

  /**
   * API لإلغاء الاشتراك (للتطوير والاختبار)
   */
  window.clearSubscription = function() {
    clearSubscription();
    location.reload();
  };

  // ====== بدء التهيئة ======

  // انتظار تحميل DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSubscription().catch(error => {
        console.error('❌ خطأ في تهيئة نظام الاشتراكات:', error);
      });
    });
  } else {
    initSubscription().catch(error => {
      console.error('❌ خطأ في تهيئة نظام الاشتراكات:', error);
    });
  }

})();

