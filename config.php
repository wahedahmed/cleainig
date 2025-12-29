<?php
/**
 * ====== ملف إعدادات قاعدة البيانات ======
 * 
 * هذا الملف يحتوي على إعدادات الاتصال بقاعدة البيانات
 * قم بتعديل القيم حسب إعدادات XAMPP الخاصة بك
 */

// إعدادات قاعدة البيانات
define('DB_HOST', '3ql5c2.h.filess.io');        // عنوان قاعدة البيانات
define('DB_USER', 'Subscriptions_teethchest');             // اسم المستخدم (افتراضي في XAMPP: root)
define('DB_PASS', '99407c961d40927303a6c935a1f4182d6dac305c');                 // كلمة المرور (افتراضي في XAMPP: فارغة)
define('DB_NAME', 'Subscriptions_teethchest');     // اسم قاعدة البيانات
define('DB_PORT', 61032);
// إعدادات إضافية
define('DB_CHARSET', 'utf8mb4');       // ترميز قاعدة البيانات
define('TIMEZONE', 'Asia/Riyadh');     // المنطقة الزمنية

// تعيين المنطقة الزمنية
date_default_timezone_set(TIMEZONE);

/**
 * إنشاء اتصال بقاعدة البيانات
 * @return mysqli|null
 */
function getDBConnection() {
    static $conn = null;
    
    if ($conn === null) {
        try {
            // استخدام Port إذا كان محدداً
            $host = defined('DB_PORT') ? DB_HOST . ':' . DB_PORT : DB_HOST;
            $conn = new mysqli($host, DB_USER, DB_PASS, DB_NAME);
            
            // ... باقي الكود
        } catch (Exception $e) {
            error_log("خطأ في الاتصال بقاعدة البيانات: " . $e->getMessage());
            return null;
        }
    }
    
    return $conn;
}

/**
 * إغلاق اتصال قاعدة البيانات
 */
function closeDBConnection() {
    $conn = getDBConnection();
    if ($conn) {
        $conn->close();
    }
}

// السماح بالوصول من أي مصدر (للتطوير فقط - في الإنتاج يجب تقييده)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// التعامل مع طلبات OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

