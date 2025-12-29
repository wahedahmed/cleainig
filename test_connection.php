<?php
/**
 * ====== ملف اختبار الاتصال بقاعدة البيانات ======
 * 
 * استخدم هذا الملف للتحقق من أن الاتصال بقاعدة البيانات يعمل بشكل صحيح
 * افتحه في المتصفح: http://localhost/quote_system/test_connection.php
 */

require_once 'config.php';

?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>اختبار الاتصال بقاعدة البيانات</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }
        .test-item {
            margin: 20px 0;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #2196F3;
            background: #f9f9f9;
        }
        .success {
            border-left-color: #4CAF50;
            background: #e8f5e9;
            color: #2e7d32;
        }
        .error {
            border-left-color: #f44336;
            background: #ffebee;
            color: #c62828;
        }
        .info {
            border-left-color: #2196F3;
            background: #e3f2fd;
            color: #1565c0;
        }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 اختبار الاتصال بقاعدة البيانات</h1>
        
        <?php
        // اختبار 1: الاتصال بقاعدة البيانات
        echo '<div class="test-item">';
        echo '<h3>1. اختبار الاتصال بقاعدة البيانات</h3>';
        $conn = getDBConnection();
        if ($conn) {
            echo '<p class="success">✅ نجح الاتصال بقاعدة البيانات!</p>';
            echo '<p><strong>معلومات الاتصال:</strong></p>';
            echo '<ul>';
            echo '<li>المضيف: <code>' . DB_HOST . '</code></li>';
            echo '<li>المستخدم: <code>' . DB_USER . '</code></li>';
            echo '<li>قاعدة البيانات: <code>' . DB_NAME . '</code></li>';
            echo '<li>الترميز: <code>' . DB_CHARSET . '</code></li>';
            echo '</ul>';
        } else {
            echo '<p class="error">❌ فشل الاتصال بقاعدة البيانات!</p>';
            echo '<p>يرجى التحقق من:</p>';
            echo '<ul>';
            echo '<li>أن MySQL يعمل في XAMPP</li>';
            echo '<li>إعدادات <code>config.php</code></li>';
            echo '<li>أن قاعدة البيانات <code>' . DB_NAME . '</code> موجودة</li>';
            echo '</ul>';
        }
        echo '</div>';

        if ($conn) {
            // اختبار 2: التحقق من وجود الجداول
            echo '<div class="test-item">';
            echo '<h3>2. التحقق من وجود الجداول</h3>';
            $tables = ['quotes', 'subscription_users', 'subscription_settings'];
            $allTablesExist = true;
            
            foreach ($tables as $table) {
                $result = $conn->query("SHOW TABLES LIKE '$table'");
                if ($result && $result->num_rows > 0) {
                    echo '<p class="success">✅ جدول <code>' . $table . '</code> موجود</p>';
                } else {
                    echo '<p class="error">❌ جدول <code>' . $table . '</code> غير موجود</p>';
                    $allTablesExist = false;
                }
            }
            
            if (!$allTablesExist) {
                echo '<p class="info">💡 قم بتشغيل ملف <code>database.sql</code> في phpMyAdmin</p>';
            }
            echo '</div>';

            // اختبار 3: التحقق من البيانات
            if ($allTablesExist) {
                echo '<div class="test-item">';
                echo '<h3>3. التحقق من البيانات</h3>';
                
                // التحقق من عروض الأسعار
                $result = $conn->query("SELECT COUNT(*) as count FROM quotes");
                if ($result) {
                    $row = $result->fetch_assoc();
                    echo '<p class="info">📊 عدد عروض الأسعار: <code>' . $row['count'] . '</code></p>';
                }
                
                // التحقق من المستخدمين
                $result = $conn->query("SELECT COUNT(*) as count FROM subscription_users");
                if ($result) {
                    $row = $result->fetch_assoc();
                    echo '<p class="info">👥 عدد المستخدمين: <code>' . $row['count'] . '</code></p>';
                    
                    if ($row['count'] > 0) {
                        echo '<p><strong>المستخدمون المسجلون:</strong></p>';
                        $users = $conn->query("SELECT user_id, user_name, code FROM subscription_users");
                        echo '<ul>';
                        while ($user = $users->fetch_assoc()) {
                            echo '<li>ID: <code>' . $user['user_id'] . '</code> - ' . 
                                 htmlspecialchars($user['user_name']) . 
                                 ' (كود: <code>' . htmlspecialchars($user['code']) . '</code>)</li>';
                        }
                        echo '</ul>';
                    }
                }
                
                // التحقق من الإعدادات
                $result = $conn->query("SELECT * FROM subscription_settings ORDER BY id DESC LIMIT 1");
                if ($result && $result->num_rows > 0) {
                    $settings = $result->fetch_assoc();
                    echo '<p class="info">⚙️ إعدادات الاشتراك:</p>';
                    if ($settings['no_expiry']) {
                        echo '<p>اشتراك دائم (بدون انتهاء صلاحية)</p>';
                    } else {
                        echo '<p>المدة: <code>' . $settings['duration_value'] . '</code> ' . 
                             htmlspecialchars($settings['duration_unit']) . '</p>';
                    }
                }
                
                echo '</div>';
            }

            // اختبار 4: اختبار API
            echo '<div class="test-item">';
            echo '<h3>4. اختبار API</h3>';
            echo '<p class="info">يمكنك اختبار API من خلال:</p>';
            echo '<ul>';
            echo '<li><a href="api/quotes.php?action=list" target="_blank">عروض الأسعار</a></li>';
            echo '<li><a href="api/subscription.php?action=users" target="_blank">المستخدمين</a></li>';
            echo '<li><a href="api/subscription.php?action=settings" target="_blank">الإعدادات</a></li>';
            echo '</ul>';
            echo '</div>';

            closeDBConnection();
        }
        ?>

        <div class="test-item info">
            <h3>📝 ملاحظات</h3>
            <p>إذا كانت جميع الاختبارات ناجحة، يمكنك الآن استخدام النظام.</p>
            <p>افتح <a href="index.html">الصفحة الرئيسية</a> للبدء.</p>
        </div>
    </div>
</body>
</html>

