<?php
/**
 * ====== API نظام الاشتراكات ======
 * 
 * هذا الملف يحتوي على عمليات إدارة المستخدمين والأكواد
 */

require_once '../config.php';

// الحصول على طريقة الطلب
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// الحصول على البيانات المرسلة
$input = json_decode(file_get_contents('php://input'), true);

// الاتصال بقاعدة البيانات
$conn = getDBConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'فشل الاتصال بقاعدة البيانات'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// معالجة الطلبات
try {
    switch ($method) {
        case 'GET':
            if ($action === 'users') {
                // الحصول على قائمة المستخدمين
                $stmt = $conn->prepare("SELECT * FROM subscription_users ORDER BY user_id ASC");
                $stmt->execute();
                $result = $stmt->get_result();
                $users = [];
                
                while ($row = $result->fetch_assoc()) {
                    $users[] = [
                        'id' => intval($row['user_id']),
                        'code' => $row['code'],
                        'name' => $row['user_name']
                    ];
                }
                
                echo json_encode([
                    'success' => true,
                    'data' => $users
                ], JSON_UNESCAPED_UNICODE);
                $stmt->close();
            } elseif ($action === 'settings') {
                // الحصول على إعدادات الاشتراك
                $stmt = $conn->prepare("SELECT * FROM subscription_settings ORDER BY id DESC LIMIT 1");
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($row = $result->fetch_assoc()) {
                    $settings = [
                        'duration' => $row['no_expiry'] ? null : [
                            'value' => intval($row['duration_value']),
                            'unit' => $row['duration_unit']
                        ]
                    ];
                    
                    echo json_encode([
                        'success' => true,
                        'data' => $settings
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    // إعدادات افتراضية
                    echo json_encode([
                        'success' => true,
                        'data' => [
                            'duration' => null
                        ]
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'إجراء غير صحيح'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'POST':
            if ($action === 'add_user') {
                // إضافة أو تحديث مستخدم
                if (!isset($input['user_id']) || !isset($input['code']) || !isset($input['name'])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'جميع الحقول مطلوبة (user_id, code, name)'
                    ], JSON_UNESCAPED_UNICODE);
                    break;
                }
                
                $user_id = intval($input['user_id']);
                $code = strtoupper(trim($input['code']));
                $name = trim($input['name']);
                
                // استخدام INSERT ... ON DUPLICATE KEY UPDATE لتحديث المستخدم الموجود
                $stmt = $conn->prepare("INSERT INTO subscription_users (user_id, user_name, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), code = VALUES(code)");
                $stmt->bind_param("iss", $user_id, $name, $code);
                
                if ($stmt->execute()) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم حفظ المستخدم بنجاح'
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'error' => 'فشل حفظ المستخدم: ' . $stmt->error
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } elseif ($action === 'sync_users') {
                // مزامنة جميع المستخدمين (حذف المحذوفين وإضافة/تحديث الباقي)
                if (!isset($input['users']) || !is_array($input['users'])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'قائمة المستخدمين مطلوبة'
                    ], JSON_UNESCAPED_UNICODE);
                    break;
                }
                
                $users = $input['users'];
                $user_ids = [];
                
                // بدء المعاملة
                $conn->begin_transaction();
                
                try {
                    // حذف المستخدمين غير الموجودين في القائمة الجديدة
                    if (count($users) > 0) {
                        $user_ids = array_map(function($u) { return intval($u['id']); }, $users);
                        $placeholders = implode(',', array_fill(0, count($user_ids), '?'));
                        $deleteStmt = $conn->prepare("DELETE FROM subscription_users WHERE user_id NOT IN ($placeholders)");
                        $deleteStmt->bind_param(str_repeat('i', count($user_ids)), ...$user_ids);
                        $deleteStmt->execute();
                        $deleteStmt->close();
                    } else {
                        // إذا كانت القائمة فارغة، حذف الجميع
                        $deleteStmt = $conn->prepare("DELETE FROM subscription_users");
                        $deleteStmt->execute();
                        $deleteStmt->close();
                    }
                    
                    // إضافة أو تحديث المستخدمين
                    $stmt = $conn->prepare("INSERT INTO subscription_users (user_id, user_name, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), code = VALUES(code)");
                    
                    foreach ($users as $user) {
                        $user_id = intval($user['id']);
                        $code = strtoupper(trim($user['code']));
                        $name = trim($user['name']);
                        
                        // التحقق من وجود كود مستخدم من قبل user_id آخر وحذفه
                        $checkCodeStmt = $conn->prepare("SELECT user_id FROM subscription_users WHERE code = ? AND user_id != ?");
                        $checkCodeStmt->bind_param("si", $code, $user_id);
                        $checkCodeStmt->execute();
                        $codeResult = $checkCodeStmt->get_result();
                        if ($codeResult->fetch_assoc()) {
                            // حذف المستخدم القديم الذي يستخدم نفس الكود
                            $deleteCodeStmt = $conn->prepare("DELETE FROM subscription_users WHERE code = ? AND user_id != ?");
                            $deleteCodeStmt->bind_param("si", $code, $user_id);
                            $deleteCodeStmt->execute();
                            $deleteCodeStmt->close();
                        }
                        $checkCodeStmt->close();
                        
                        // إضافة أو تحديث المستخدم
                        $stmt->bind_param("iss", $user_id, $name, $code);
                        $stmt->execute();
                    }
                    
                    $stmt->close();
                    
                    // تأكيد المعاملة
                    $conn->commit();
                    
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم مزامنة المستخدمين بنجاح'
                    ], JSON_UNESCAPED_UNICODE);
                } catch (Exception $e) {
                    // التراجع عن المعاملة في حالة الخطأ
                    $conn->rollback();
                    throw $e;
                }
            } elseif ($action === 'save_settings') {
                // حفظ إعدادات الاشتراك
                $duration = $input['duration'] ?? null;
                $no_expiry = ($duration === null) ? 1 : 0;
                $duration_value = ($duration && isset($duration['value'])) ? intval($duration['value']) : null;
                $duration_unit = ($duration && isset($duration['unit'])) ? $duration['unit'] : null;
                
                // حذف الإعدادات القديمة وإدراج جديدة
                $deleteStmt = $conn->prepare("DELETE FROM subscription_settings");
                $deleteStmt->execute();
                $deleteStmt->close();
                
                $stmt = $conn->prepare("INSERT INTO subscription_settings (duration_value, duration_unit, no_expiry) VALUES (?, ?, ?)");
                $stmt->bind_param("isi", $duration_value, $duration_unit, $no_expiry);
                
                if ($stmt->execute()) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم حفظ الإعدادات بنجاح'
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'error' => 'فشل حفظ الإعدادات: ' . $stmt->error
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'إجراء غير صحيح'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'DELETE':
            if ($action === 'delete_user' && isset($_GET['user_id'])) {
                // حذف مستخدم
                $user_id = intval($_GET['user_id']);
                $stmt = $conn->prepare("DELETE FROM subscription_users WHERE user_id = ?");
                $stmt->bind_param("i", $user_id);
                
                if ($stmt->execute()) {
                    if ($stmt->affected_rows > 0) {
                        echo json_encode([
                            'success' => true,
                            'message' => 'تم حذف المستخدم بنجاح'
                        ], JSON_UNESCAPED_UNICODE);
                    } else {
                        http_response_code(404);
                        echo json_encode([
                            'success' => false,
                            'error' => 'المستخدم غير موجود'
                        ], JSON_UNESCAPED_UNICODE);
                    }
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'error' => 'فشل حذف المستخدم: ' . $stmt->error
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'معرف المستخدم مطلوب'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode([
                'success' => false,
                'error' => 'طريقة الطلب غير مدعومة'
            ], JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'خطأ في الخادم: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} finally {
    closeDBConnection();
}

