/**
 * ====== واجهة قاعدة البيانات MySQL/PHP ======
 * 
 * هذا الملف يحل محل Supabase ويستخدم PHP API للتعامل مع قاعدة البيانات
 */

(function() {
  'use strict';

  // ====== إعدادات API ======
  const API_BASE_URL = window.API_BASE_URL || ''; // يمكن تعيينه في config.js
  const QUOTES_API = API_BASE_URL + 'api/quotes.php';
  const SUBSCRIPTION_API = API_BASE_URL + 'api/subscription.php';

  // ====== دوال مساعدة ======

  // متغير لتتبع ما إذا تم عرض رسالة الخطأ بالفعل
  let serverErrorShown = false;

  /**
   * إرسال طلب HTTP
   * @param {string} url - رابط API
   * @param {string} method - طريقة الطلب (GET, POST, PUT, DELETE)
   * @param {Object} data - البيانات المرسلة (اختياري)
   * @returns {Promise} - Promise مع النتيجة
   */
  async function apiRequest(url, method = 'GET', data = null) {
    try {
      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      
      // التحقق من نوع المحتوى
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        // إذا كان المحتوى يبدأ بـ <?php، يعني أن الخادم لا يعمل
        if (text.trim().startsWith('<?php') || text.trim().startsWith('<!DOCTYPE')) {
          // عرض الرسالة مرة واحدة فقط
          if (!serverErrorShown) {
            serverErrorShown = true;
            console.error('❌ خطأ: يجب تشغيل المشروع على خادم PHP (XAMPP أو خادم آخر)');
            console.error('❌ لا يمكن فتح ملفات PHP مباشرة من المتصفح');
            console.error('❌ يرجى فتح المشروع من: http://localhost/wahed2/');
            // إظهار تنبيه للمستخدم مرة واحدة فقط
            setTimeout(() => {
              alert('⚠️ تحذير: يجب تشغيل المشروع على خادم PHP\n\n' +
                    'يرجى:\n' +
                    '1. تشغيل XAMPP\n' +
                    '2. فتح المشروع من: http://localhost/wahed2/\n\n' +
                    'لا يمكن فتح ملفات PHP مباشرة من المتصفح.');
            }, 500);
          }
          throw new Error('الخادم لا يعمل');
        }
        throw new Error(`خطأ: الخادم لم يرجع JSON. نوع المحتوى: ${contentType}`);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'خطأ في الاتصال' }));
        throw new Error(errorData.error || `خطأ HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'فشلت العملية');
      }

      return result;
    } catch (error) {
      // فقط تسجيل الخطأ بدون تكرار الرسائل
      if (!error.message.includes('الخادم لا يعمل')) {
        console.error('خطأ في طلب API:', error.message);
      }
      throw error;
    }
  }

  // ====== واجهة Supa (للتوافق مع الكود الموجود) ======

  window.Supa = {
    /**
     * إدراج سجل جديد
     * @param {Object} record - بيانات السجل
     * @returns {Promise} - Promise مع النتيجة
     */
    async insert(record) {
      try {
        const result = await apiRequest(QUOTES_API, 'POST', record);
        return {
          data: [{ id: result.id, ...record }],
          error: null
        };
      } catch (error) {
        return {
          data: null,
          error: error.message
        };
      }
    },

    /**
     * تحديث سجل موجود
     * @param {number} id - معرف السجل
     * @param {Object} record - البيانات المحدثة
     * @returns {Promise} - Promise مع النتيجة
     */
    async update(id, record) {
      try {
        const data = { id, ...record };
        const result = await apiRequest(QUOTES_API, 'PUT', data);
        return {
          data: [{ id, ...record }],
          error: null
        };
      } catch (error) {
        return {
          data: null,
          error: error.message
        };
      }
    },

    /**
     * الحصول على سجل محدد
     * @param {number} id - معرف السجل
     * @returns {Promise} - Promise مع النتيجة
     */
    async getById(id) {
      try {
        const result = await apiRequest(`${QUOTES_API}?action=get&id=${id}`, 'GET');
        return result.data;
      } catch (error) {
        console.error('خطأ في الحصول على السجل:', error);
        return null;
      }
    },

    /**
     * الحصول على قائمة السجلات
     * @param {Object} options - خيارات البحث (اختياري)
     * @returns {Promise} - Promise مع النتيجة
     */
    async list(options = {}) {
      try {
        const params = new URLSearchParams();
        if (options.tenant) params.append('tenant', options.tenant);
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);
        
        const queryString = params.toString();
        const url = `${QUOTES_API}?action=list${queryString ? '&' + queryString : ''}`;
        
        const result = await apiRequest(url, 'GET');
        return result.data || [];
      } catch (error) {
        console.error('خطأ في الحصول على القائمة:', error);
        return [];
      }
    },

    /**
     * حذف سجل
     * @param {number} id - معرف السجل
     * @returns {Promise} - Promise مع النتيجة
     */
    async delete(id) {
      try {
        const result = await apiRequest(`${QUOTES_API}?action=delete&id=${id}`, 'DELETE');
        return {
          data: null,
          error: null
        };
      } catch (error) {
        return {
          data: null,
          error: error.message
        };
      }
    }
  };

  // ====== واجهة إدارة الاشتراكات ======

  window.SubscriptionAPI = {
    /**
     * الحصول على قائمة المستخدمين
     * @returns {Promise} - Promise مع قائمة المستخدمين
     */
    async getUsers() {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=users`, 'GET');
        return result.data || [];
      } catch (error) {
        // لا تسجيل الخطأ إذا كان متعلقاً بعدم وجود خادم (تم التعامل معه بالفعل)
        if (!error.message.includes('الخادم لا يعمل')) {
          console.error('خطأ في الحصول على المستخدمين:', error.message);
        }
        return [];
      }
    },

    /**
     * إضافة مستخدم جديد
     * @param {Object} userData - بيانات المستخدم
     * @returns {Promise} - Promise مع النتيجة
     */
    async addUser(userData) {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=add_user`, 'POST', userData);
        return result;
      } catch (error) {
        throw error;
      }
    },

    /**
     * حذف مستخدم
     * @param {number} userId - معرف المستخدم
     * @returns {Promise} - Promise مع النتيجة
     */
    async deleteUser(userId) {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=delete_user&user_id=${userId}`, 'DELETE');
        return result;
      } catch (error) {
        throw error;
      }
    },

    /**
     * الحصول على إعدادات الاشتراك
     * @returns {Promise} - Promise مع الإعدادات
     */
    async getSettings() {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=settings`, 'GET');
        return result.data || { duration: null };
      } catch (error) {
        // لا تسجيل الخطأ إذا كان متعلقاً بعدم وجود خادم (تم التعامل معه بالفعل)
        if (!error.message.includes('الخادم لا يعمل')) {
          console.error('خطأ في الحصول على الإعدادات:', error.message);
        }
        return { duration: null };
      }
    },

    /**
     * حفظ إعدادات الاشتراك
     * @param {Object} settings - الإعدادات
     * @returns {Promise} - Promise مع النتيجة
     */
    async saveSettings(settings) {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=save_settings`, 'POST', settings);
        return result;
      } catch (error) {
        throw error;
      }
    },

    /**
     * مزامنة جميع المستخدمين (حذف المحذوفين وإضافة/تحديث الباقي)
     * @param {Array} users - قائمة المستخدمين
     * @returns {Promise} - Promise مع النتيجة
     */
    async syncUsers(users) {
      try {
        const result = await apiRequest(`${SUBSCRIPTION_API}?action=sync_users`, 'POST', { users });
        return result;
      } catch (error) {
        throw error;
      }
    }
  };

  console.log('✅ تم تحميل واجهة قاعدة البيانات MySQL/PHP');

})();

