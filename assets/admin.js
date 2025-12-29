/**
 * ====== لوحة إدارة الاشتراكات ======
 * 
 * هذا الملف يحتوي على وظائف إدارة الاشتراكات:
 * - عرض حالة الاشتراك الحالي
 * - إدارة الأكواد (إضافة، حذف)
 * - تعديل مدة الاشتراك
 * - تفعيل/إلغاء الاشتراك
 */

(function () {
  'use strict';

  // ====== عناصر DOM ======
  const $ = (id) => document.getElementById(id);
  
  const currentSubscriptionInfo = $('currentSubscriptionInfo');
  const btnClearSubscription = $('btnClearSubscription');
  const btnRefresh = $('btnRefresh');
  const usersList = $('usersList');
  const newUserId = $('newUserId');
  const newUserName = $('newUserName');
  const newUserCode = $('newUserCode');
  const btnAddUser = $('btnAddUser');
  const durationValue = $('durationValue');
  const durationUnit = $('durationUnit');
  const noExpiry = $('noExpiry');
  const btnSaveDuration = $('btnSaveDuration');
  const durationPreview = $('durationPreview');
  const activationCode = $('activationCode');
  const customCode = $('customCode');
  const btnActivate = $('btnActivate');
  const adminMessages = $('adminMessages');

  // ====== دوال مساعدة ======

  /**
   * عرض رسالة للمستخدم
   * @param {string} message - نص الرسالة
   * @param {string} type - نوع الرسالة ('success', 'error', 'info')
   */
  function showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `admin-message ${type}`;
    messageEl.textContent = message;
    adminMessages.appendChild(messageEl);

    // إزالة الرسالة بعد 3 ثواني
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 3000);
  }

  /**
   * تحميل الإعدادات من قاعدة البيانات
   */
  async function loadConfig() {
    try {
      const config = {
        users: [],
        codes: [],
        duration: null
      };
      
      // تحميل المستخدمين من قاعدة البيانات
      if (typeof window.SubscriptionAPI !== 'undefined') {
        const users = await window.SubscriptionAPI.getUsers();
        if (users && users.length > 0) {
          config.users = users;
          config.codes = users.map(u => u.code);
          window.SUBSCRIPTION_USERS = users;
          window.SUBSCRIPTION_CODES = config.codes;
        }
      }
      
      // تحميل إعدادات المدة من قاعدة البيانات
      if (typeof window.SubscriptionAPI !== 'undefined') {
        const settings = await window.SubscriptionAPI.getSettings();
        if (settings && settings.duration !== undefined) {
          config.duration = settings.duration;
          window.SUBSCRIPTION_DURATION = settings.duration;
        }
      }
      
      return config;
    } catch (error) {
      console.error('خطأ في تحميل الإعدادات:', error);
      return {
        users: [],
        codes: [],
        duration: null
      };
    }
  }

  // تم إزالة دوال تحميل ملف config - الآن كل شيء في قاعدة البيانات

  /**
   * حفظ الإعدادات في قاعدة البيانات وتحديث المتغيرات العامة
   */
  async function saveConfig(config) {
    try {
      // تحديث المتغيرات العامة
      if (config.users) {
        window.SUBSCRIPTION_USERS = config.users;
        window.SUBSCRIPTION_CODES = config.users.map(u => u.code);
      }
      if (config.duration !== undefined) {
        window.SUBSCRIPTION_DURATION = config.duration;
      }
      
      showMessage('تم حفظ الإعدادات في قاعدة البيانات بنجاح', 'success');
      console.log('✅ تم حفظ الإعدادات في قاعدة البيانات');
    } catch (error) {
      console.error('خطأ في حفظ الإعدادات:', error);
      showMessage('خطأ في حفظ الإعدادات', 'error');
    }
  }

  // ====== عرض حالة الاشتراك الحالي ======

  /**
   * تحديث عرض حالة الاشتراك الحالي
   */
  function updateCurrentSubscription() {
    try {
      const stored = localStorage.getItem('subscription_verified');
      
      if (!stored) {
        let noSubscriptionHtml = `
          <p><strong class="status-inactive">❌ لا يوجد اشتراك نشط</strong></p>
          <p>لم يتم تفعيل أي اشتراك حالياً</p>
        `;
        
        // عرض قائمة الأكواد المعطلة
        const disabledCodes = JSON.parse(localStorage.getItem('disabled_codes') || '[]');
        if (disabledCodes.length > 0) {
          const disabledList = disabledCodes.map(code => 
            `<span class="disabled-code-tag" onclick="reEnableCodeFromAdmin('${code}')" title="انقر لإعادة التفعيل" style="display: inline-block; margin: 5px; padding: 5px 10px; background: #fee; border: 1px solid #fcc; border-radius: 4px; cursor: pointer;">${code} ❌</span>`
          ).join(' ');
          noSubscriptionHtml += `
            <div class="disabled-codes-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p><strong>الأكواد المعطلة:</strong></p>
              <div style="margin-top: 10px;">${disabledList}</div>
            </div>
          `;
        }
        
        currentSubscriptionInfo.innerHTML = noSubscriptionHtml;
        btnClearSubscription.style.display = 'none';
        return;
      }

      const subscriptionData = JSON.parse(stored);
      const expiryDate = subscriptionData.expiry ? new Date(subscriptionData.expiry) : null;
      const now = new Date();
      
      // التحقق من أن الكود غير معطل
      const code = subscriptionData.code || 'غير محدد';
      const isDisabled = isCodeDisabled(code);
      
      let statusHtml = `
        <p><strong class="status-active">✅ اشتراك نشط</strong></p>
        ${subscriptionData.userName ? `<p>اسم المستخدم: <strong>${subscriptionData.userName}</strong></p>` : ''}
        ${subscriptionData.user && subscriptionData.user.id ? `<p>ID المستخدم: <span class="code">${subscriptionData.user.id}</span></p>` : ''}
        <p>الكود المستخدم: <span class="code">${code}</span> ${isDisabled ? '<span style="color: red; font-weight: bold;">⚠️ معطل</span>' : ''}</p>
        <p>تاريخ التفعيل: ${new Date(subscriptionData.timestamp).toLocaleString('ar-SA')}</p>
      `;

      if (expiryDate) {
        const remaining = expiryDate - now;
        if (remaining > 0) {
          const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
          const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          
          statusHtml += `
            <p>تاريخ انتهاء الصلاحية: ${expiryDate.toLocaleString('ar-SA')}</p>
            <p>المدة المتبقية: ${days} يوم و ${hours} ساعة و ${minutes} دقيقة</p>
          `;
        } else {
          statusHtml += `<p><strong>⚠️ انتهت صلاحية الاشتراك</strong></p>`;
        }
      } else {
        statusHtml += `<p>نوع الاشتراك: <strong>دائم (بدون انتهاء صلاحية)</strong></p>`;
      }

      // إضافة قائمة الأكواد المعطلة
      const disabledCodes = JSON.parse(localStorage.getItem('disabled_codes') || '[]');
      if (disabledCodes.length > 0) {
        const disabledList = disabledCodes.map(disabledCode => 
          `<span class="disabled-code-tag" onclick="reEnableCodeFromAdmin('${disabledCode}')" title="انقر لإعادة التفعيل" style="display: inline-block; margin: 5px; padding: 5px 10px; background: #fee; border: 1px solid #fcc; border-radius: 4px; cursor: pointer;">${disabledCode} ❌</span>`
        ).join(' ');
        statusHtml += `
          <div class="disabled-codes-section" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p><strong>الأكواد المعطلة:</strong></p>
            <div style="margin-top: 10px;">${disabledList}</div>
          </div>
        `;
      }
      
      currentSubscriptionInfo.innerHTML = statusHtml;
      btnClearSubscription.style.display = 'inline-block';
    } catch (error) {
      console.error('خطأ في قراءة حالة الاشتراك:', error);
      currentSubscriptionInfo.innerHTML = '<p class="loading">خطأ في تحميل البيانات</p>';
    }
  }

  /**
   * إعادة تفعيل كود من لوحة الإدارة (دالة عامة)
   * @param {string} code - الكود المراد إعادة تفعيله
   */
  window.reEnableCodeFromAdmin = function(code) {
    if (confirm(`هل تريد إعادة تفعيل الكود "${code}"؟\n\nتحذير: إعادة التفعيل قد تسمح باستخدام الكود على أجهزة متعددة.`)) {
      if (reEnableCode(code)) {
        showMessage(`تم إعادة تفعيل الكود "${code}" بنجاح`, 'success');
        updateCurrentSubscription();
      } else {
        showMessage('فشل إعادة تفعيل الكود', 'error');
      }
    }
  };

  // ====== إدارة المستخدمين ======

  /**
   * تحميل قائمة المستخدمين من قاعدة البيانات فقط
   */
  async function loadUsers() {
    // تحميل من قاعدة البيانات فقط
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        const dbUsers = await window.SubscriptionAPI.getUsers();
        if (dbUsers && dbUsers.length > 0) {
          // تحويل التنسيق من قاعدة البيانات إلى التنسيق المطلوب
          const users = dbUsers.map(u => ({
            id: u.id,
            code: u.code,
            name: u.name
          }));
          window.SUBSCRIPTION_USERS = users;
          window.SUBSCRIPTION_CODES = users.map(u => u.code);
          return users;
        }
      } catch (error) {
        console.error('❌ فشل تحميل المستخدمين من قاعدة البيانات:', error);
      }
    }
    
    // إرجاع قائمة فارغة إذا لم توجد بيانات
    return [];
  }

  /**
   * حفظ قائمة المستخدمين
   */
  async function saveUsers(users) {
    const config = await loadConfig();
    
    // تحديث المتغيرات العامة
    window.SUBSCRIPTION_USERS = users;
    window.SUBSCRIPTION_CODES = users.map(u => u.code);
    
    // حفظ في قاعدة البيانات باستخدام sync_users
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        // تحويل التنسيق إلى التنسيق المطلوب من API
        const usersForSync = users.map(u => ({
          id: u.id,
          name: u.name,
          code: u.code
        }));
        
        await window.SubscriptionAPI.syncUsers(usersForSync);
        console.log('✅ تم حفظ المستخدمين في قاعدة البيانات');
      } catch (error) {
        console.error('❌ فشل حفظ المستخدمين في قاعدة البيانات:', error);
        showMessage('فشل حفظ المستخدمين في قاعدة البيانات: ' + error.message, 'error');
        throw error;
      }
    }
    
    // حفظ في قاعدة البيانات
    await saveConfig({ 
      users: users,
      codes: users.map(u => u.code),
      duration: config ? config.duration : null 
    });
  }

  /**
   * تحديث قائمة المستخدمين
   */
  async function updateUsersList() {
    const users = await loadUsers();
    const usersList = $('usersList');

    if (users.length === 0) {
      usersList.innerHTML = '<div class="empty-state">لا يوجد مستخدمين مسجلين</div>';
      await updateActivationCodesList();
      return;
    }

    usersList.innerHTML = users.map(user => `
      <div class="user-item">
        <div class="user-info">
          <div class="user-id"><strong>ID:</strong> ${user.id}</div>
          <div class="user-name"><strong>الاسم:</strong> ${user.name || 'غير محدد'}</div>
          <div class="user-code"><strong>الكود:</strong> <span class="code-text">${user.code}</span></div>
        </div>
        <div class="user-actions">
          <button class="btn btn-mini danger" onclick="removeUser('${user.id}')">🗑️ حذف</button>
        </div>
      </div>
    `).join('');

    // تحديث قائمة الأكواد في تفعيل الاشتراك
    await updateActivationCodesList();
  }

  /**
   * إضافة مستخدم جديد
   */
  async function addUser() {
    const userIdInput = $('newUserId');
    const userId = userIdInput ? parseInt(userIdInput.value) : null;
    const userName = $('newUserName') ? $('newUserName').value.trim() : '';
    const userCode = $('newUserCode') ? $('newUserCode').value.trim().toUpperCase() : '';
    
    if (!userId || isNaN(userId) || userId < 1) {
      showMessage('يرجى إدخال ID المستخدم (رقم صحيح أكبر من صفر)', 'error');
      return;
    }

    if (!userCode) {
      showMessage('يرجى إدخال كود الاشتراك', 'error');
      return;
    }

    const users = await loadUsers();

    // التحقق من عدم تكرار ID
    if (users.find(u => u.id === userId)) {
      showMessage('هذا ID موجود بالفعل', 'error');
      return;
    }

    // التحقق من عدم تكرار الكود
    if (users.find(u => u.code.toUpperCase() === userCode)) {
      showMessage('هذا الكود مستخدم بالفعل', 'error');
      return;
    }

    const newUser = {
      id: userId,
      code: userCode,
      name: userName || `مستخدم ${userId}`
    };

    // إضافة المستخدم في قاعدة البيانات
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        await window.SubscriptionAPI.addUser({
          user_id: userId,
          name: newUser.name,
          code: userCode
        });
        showMessage('تم إضافة المستخدم في قاعدة البيانات', 'success');
      } catch (error) {
        showMessage('فشل إضافة المستخدم في قاعدة البيانات: ' + error.message, 'error');
        return;
      }
    }

    users.push(newUser);
    await saveUsers(users); // حفظ في قاعدة البيانات
    await updateUsersList();
    
    // مسح الحقول
    if (userIdInput) userIdInput.value = '';
    if ($('newUserName')) $('newUserName').value = '';
    if ($('newUserCode')) $('newUserCode').value = '';
    
    showMessage('تم إضافة المستخدم وحفظه بنجاح', 'success');
  }

  /**
   * حذف مستخدم
   * @param {number} userId - ID المستخدم المراد حذفه (رقم)
   */
  window.removeUser = async function(userId) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم برقم ID "${userId}"؟`)) {
      return;
    }

    // حذف المستخدم من قاعدة البيانات
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        await window.SubscriptionAPI.deleteUser(userId);
        console.log('✅ تم حذف المستخدم من قاعدة البيانات');
      } catch (error) {
        console.warn('⚠️ فشل حذف المستخدم من قاعدة البيانات:', error);
        showMessage('فشل حذف المستخدم من قاعدة البيانات: ' + error.message, 'error');
        return;
      }
    }

    const users = (await loadUsers()).filter(u => u.id !== userId);
    await saveUsers(users); // حفظ في قاعدة البيانات
    await updateUsersList();
    showMessage('تم حذف المستخدم بنجاح', 'success');
  };

  // ====== إعدادات المدة ======

  /**
   * تحديث معاينة المدة
   */
  function updateDurationPreview() {
    if (noExpiry.checked) {
      durationPreview.innerHTML = '<strong>اشتراك دائم (بدون انتهاء صلاحية)</strong>';
      durationValue.disabled = true;
      durationUnit.disabled = true;
      return;
    }

    durationValue.disabled = false;
    durationUnit.disabled = false;

    const value = parseInt(durationValue.value) || 1;
    const unit = durationUnit.value;
    
    const unitNames = {
      hours: 'ساعة',
      days: 'يوم',
      months: 'شهر',
      years: 'سنة'
    };

    const unitName = value === 1 ? unitNames[unit] : (unit === 'hours' ? 'ساعات' : 
                                                      unit === 'days' ? 'أيام' : 
                                                      unit === 'months' ? 'أشهر' : 'سنوات');

    durationPreview.innerHTML = `<strong>المدة المحددة: ${value} ${unitName}</strong>`;
  }

  /**
   * حفظ إعدادات المدة
   */
  async function saveDuration() {
    const config = await loadConfig();
    
    let duration = null;
    if (!noExpiry.checked) {
      const value = parseInt(durationValue.value) || 1;
      const unit = durationUnit.value;
      duration = { value, unit };
    }

    // تحديث الإعدادات
    if (typeof window.SUBSCRIPTION_DURATION !== 'undefined') {
      window.SUBSCRIPTION_DURATION = duration;
    }

    // حفظ في قاعدة البيانات
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        await window.SubscriptionAPI.saveSettings({ duration });
        console.log('✅ تم حفظ إعدادات المدة في قاعدة البيانات');
      } catch (error) {
        console.warn('⚠️ فشل حفظ إعدادات المدة في قاعدة البيانات:', error);
      }
    }

    const updatedConfig = { 
      users: config ? (config.users || []) : [],
      codes: config ? config.codes : [], 
      duration 
    };
    
    await saveConfig(updatedConfig); // حفظ في قاعدة البيانات
    
    updateDurationPreview();
    showMessage('تم حفظ إعدادات المدة بنجاح', 'success');
    
    // تحذير: يجب إعادة تحميل الصفحة لتطبيق التغييرات
    if (confirm('تم حفظ الإعدادات. هل تريد إعادة تحميل الصفحة لتطبيق التغييرات؟')) {
      location.reload();
    }
  }

  // ====== تفعيل الاشتراك ======

  /**
   * تحديث قائمة الأكواد في تفعيل الاشتراك
   */
  async function updateActivationCodesList() {
    const users = await loadUsers();

    activationCode.innerHTML = '<option value="">-- اختر مستخدم --</option>' +
      users.map(user => `<option value="${user.code}" data-user-name="${user.name}">ID: ${user.id} - ${user.name} (${user.code})</option>`).join('');
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
   * إعادة تفعيل كود معطل
   * @param {string} code - الكود المراد إعادة تفعيله
   */
  function reEnableCode(code) {
    if (!code || typeof code !== 'string') {
      return;
    }
    
    const cleanCode = code.trim().toUpperCase();
    const disabledCodes = JSON.parse(localStorage.getItem('disabled_codes') || '[]');
    const index = disabledCodes.indexOf(cleanCode);
    
    if (index > -1) {
      disabledCodes.splice(index, 1);
      localStorage.setItem('disabled_codes', JSON.stringify(disabledCodes));
      console.log('✅ تم إعادة تفعيل الكود:', cleanCode);
      return true;
    }
    
    return false;
  }

  /**
   * تفعيل اشتراك
   */
  async function activateSubscription() {
    let code = '';
    let userId = '';
    
    if (activationCode.value) {
      const selectedOption = activationCode.options[activationCode.selectedIndex];
      code = activationCode.value;
      userId = selectedOption.getAttribute('data-user-name') || '';
    } else if (customCode.value.trim()) {
      code = customCode.value.trim().toUpperCase();
      // طلب اسم المستخدم إذا كان الكود مخصص
      const userName = prompt('يرجى إدخال اسم المستخدم:');
      if (!userName) {
        showMessage('يجب إدخال اسم المستخدم', 'error');
        return;
      }
      userId = userName;
    } else {
      showMessage('يرجى اختيار مستخدم أو إدخال كود مخصص', 'error');
      return;
    }

    // التحقق من أن الكود غير معطل
    if (isCodeDisabled(code)) {
      if (confirm(`⚠️ هذا الكود معطل بسبب استخدامه على أكثر من جهاز.\nهل تريد إعادة تفعيله؟\n\nتحذير: إعادة التفعيل قد تسمح باستخدام الكود على أجهزة متعددة.`)) {
        reEnableCode(code);
        showMessage('تم إعادة تفعيل الكود. يمكنك الآن تفعيل الاشتراك.', 'success');
      } else {
        showMessage('تم إلغاء العملية. الكود لا يزال معطلاً.', 'error');
        return;
      }
    }

    // التحقق من صحة الكود واسم المستخدم
    const users = await loadUsers();
    const user = users.find(u => u.name.trim() === userId.trim() && u.code.toUpperCase() === code.toUpperCase());
    
    if (!user) {
      if (!confirm(`الكود "${code}" واسم المستخدم "${userId}" غير متطابقين. هل تريد تفعيله على أي حال؟`)) {
        return;
      }
    }

    // الحصول على مدة الاشتراك
    const config = await loadConfig();
    const duration = config ? config.duration : null;

    // حفظ الاشتراك
    try {
      let expiry = null;
      
      if (duration && duration.value) {
        const msPerHour = 60 * 60 * 1000;
        const msPerDay = 24 * msPerHour;
        const msPerMonth = 30 * msPerDay;
        const msPerYear = 365 * msPerDay;

        let durationMs = 0;
        switch (duration.unit) {
          case 'hours':
            durationMs = duration.value * msPerHour;
            break;
          case 'days':
            durationMs = duration.value * msPerDay;
            break;
          case 'months':
            durationMs = duration.value * msPerMonth;
            break;
          case 'years':
            durationMs = duration.value * msPerYear;
            break;
        }
        expiry = new Date(Date.now() + durationMs).toISOString();
      }

      // إنشاء Device ID للجهاز الحالي
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        // إنشاء Device ID جديد
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
        
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
          const char = fingerprint.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        
        deviceId = 'device_' + Math.abs(hash).toString(36);
        localStorage.setItem('device_id', deviceId);
      }

      const subscriptionData = {
        code: code.toUpperCase(),
        userName: userId ? userId.trim() : null,
        user: user || null,
        deviceId: deviceId, // حفظ Device ID
        verified: true,
        timestamp: new Date().toISOString(),
        expiry: expiry,
        duration: duration
      };

      localStorage.setItem('subscription_verified', JSON.stringify(subscriptionData));
      
      showMessage('تم تفعيل الاشتراك بنجاح (مقيد بجهاز واحد)', 'success');
      updateCurrentSubscription();
      
      // إعادة تحميل الصفحة الرئيسية إذا كانت مفتوحة
      setTimeout(() => {
        if (confirm('تم تفعيل الاشتراك. هل تريد الانتقال للصفحة الرئيسية؟')) {
          window.location.href = 'index.html';
        }
      }, 1000);
    } catch (error) {
      console.error('خطأ في تفعيل الاشتراك:', error);
      showMessage('خطأ في تفعيل الاشتراك', 'error');
    }
  }

  /**
   * إلغاء الاشتراك
   */
  function clearSubscription() {
    if (!confirm('هل أنت متأكد من إلغاء الاشتراك الحالي؟')) {
      return;
    }

    try {
      localStorage.removeItem('subscription_verified');
      showMessage('تم إلغاء الاشتراك بنجاح', 'success');
      updateCurrentSubscription();
    } catch (error) {
      console.error('خطأ في إلغاء الاشتراك:', error);
      showMessage('خطأ في إلغاء الاشتراك', 'error');
    }
  }

  // ====== ربط الأحداث ======

  // تحديث
  btnRefresh.addEventListener('click', () => {
    updateCurrentSubscription();
    updateUsersList();
    showMessage('تم تحديث البيانات', 'info');
  });

  // تم إزالة زر تحميل ملف الإعدادات - الآن كل شيء في قاعدة البيانات

  // إلغاء الاشتراك
  btnClearSubscription.addEventListener('click', clearSubscription);

  // إضافة مستخدم
  if (btnAddUser) {
    btnAddUser.addEventListener('click', addUser);
  }
  
  if (newUserCode) {
    newUserCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        addUser();
      }
    });
  }

  // إعدادات المدة
  noExpiry.addEventListener('change', updateDurationPreview);
  durationValue.addEventListener('input', updateDurationPreview);
  durationUnit.addEventListener('change', updateDurationPreview);
  btnSaveDuration.addEventListener('click', saveDuration);

  // تفعيل الاشتراك
  btnActivate.addEventListener('click', activateSubscription);

  // ====== التهيئة ======

  /**
   * تهيئة الواجهة
   */
  async function init() {
    // تحميل الإعدادات الحالية
    const config = await loadConfig();
    
    // محاولة تحميل الإعدادات من قاعدة البيانات
    if (typeof window.SubscriptionAPI !== 'undefined') {
      try {
        const dbSettings = await window.SubscriptionAPI.getSettings();
        if (dbSettings && dbSettings.duration !== undefined) {
          if (dbSettings.duration) {
            durationValue.value = dbSettings.duration.value;
            durationUnit.value = dbSettings.duration.unit;
            noExpiry.checked = false;
          } else {
            noExpiry.checked = true;
          }
          updateDurationPreview();
        }
      } catch (error) {
        console.warn('⚠️ فشل تحميل الإعدادات من قاعدة البيانات:', error);
      }
    }
    
    if (config) {
      // تحديث قائمة المستخدمين
      await updateUsersList();
      
      // تحديث إعدادات المدة (إذا لم يتم تحميلها من قاعدة البيانات)
      if (config.duration && !noExpiry.checked) {
        durationValue.value = config.duration.value;
        durationUnit.value = config.duration.unit;
        noExpiry.checked = false;
      } else if (!config.duration) {
        noExpiry.checked = true;
      }
      updateDurationPreview();
    }

    // تحديث حالة الاشتراك
    updateCurrentSubscription();
  }

  // بدء التهيئة
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

