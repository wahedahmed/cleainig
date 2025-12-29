<?php
/**
 * ====== API عروض الأسعار ======
 * 
 * هذا الملف يحتوي على عمليات إدارة عروض الأسعار
 */

// تعيين headers قبل أي إخراج
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// التعامل مع طلبات OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
            if ($action === 'get' && isset($_GET['id'])) {
                // الحصول على عرض سعر محدد
                $id = intval($_GET['id']);
                $stmt = $conn->prepare("SELECT * FROM quotes WHERE id = ?");
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($row = $result->fetch_assoc()) {
                    // تحويل bullets من JSON
                    $row['bullets'] = json_decode($row['bullets'] ?? '[]', true);
                    echo json_encode([
                        'success' => true,
                        'data' => $row
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    http_response_code(404);
                    echo json_encode([
                        'success' => false,
                        'error' => 'عرض السعر غير موجود'
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } elseif ($action === 'list') {
                // الحصول على قائمة عروض الأسعار
                $tenant = $_GET['tenant'] ?? null;
                $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
                $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
                
                $query = "SELECT * FROM quotes";
                $params = [];
                $types = '';
                
                if ($tenant) {
                    $query .= " WHERE tenant = ?";
                    $params[] = $tenant;
                    $types .= 's';
                }
                
                $query .= " ORDER BY id DESC LIMIT ? OFFSET ?";
                $params[] = $limit;
                $params[] = $offset;
                $types .= 'ii';
                
                $stmt = $conn->prepare($query);
                if (!empty($params)) {
                    $stmt->bind_param($types, ...$params);
                }
                $stmt->execute();
                $result = $stmt->get_result();
                $quotes = [];
                
                while ($row = $result->fetch_assoc()) {
                    // تحويل bullets من JSON
                    $row['bullets'] = json_decode($row['bullets'] ?? '[]', true);
                    $quotes[] = $row;
                }
                
                echo json_encode([
                    'success' => true,
                    'data' => $quotes
                ], JSON_UNESCAPED_UNICODE);
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
            // إضافة عرض سعر جديد
            if (!isset($input['client']) || !isset($input['place'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'الحقول المطلوبة: client, place'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            // تحويل bullets إلى JSON
            $bullets = isset($input['bullets']) ? json_encode($input['bullets'], JSON_UNESCAPED_UNICODE) : '[]';
            
            $stmt = $conn->prepare("INSERT INTO quotes (
                date, client, place, status, unit_type, units_count,
                subtotal, discount, discount_type, tax_mode, tax, currency,
                pay_plan, p1, total, bullets, tenant, valid, valid_days,
                pay_to, iban, acct, signer, signer_phone, logo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            
            $stmt->bind_param("sssssiddssssidsssississsss",
                $input['date'] ?? null,
                $input['client'],
                $input['place'],
                $input['status'] ?? 'active',
                $input['unit_type'] ?? null,
                $input['units_count'] ?? 1,
                $input['subtotal'] ?? 0,
                $input['discount'] ?? 0,
                $input['discount_type'] ?? 'amount',
                $input['tax_mode'] ?? 'exclusive',
                $input['tax'] ?? 15,
                $input['currency'] ?? 'SAR',
                $input['pay_plan'] ?? 1,
                $input['p1'] ?? 100,
                $input['total'] ?? 0,
                $bullets,
                $input['tenant'] ?? null,
                $input['valid'] ?? 1,
                $input['valid_days'] ?? 30,
                $input['pay_to'] ?? null,
                $input['iban'] ?? null,
                $input['acct'] ?? null,
                $input['signer'] ?? null,
                $input['signer_phone'] ?? null,
                $input['logo'] ?? null
            );
            
            if ($stmt->execute()) {
                $id = $conn->insert_id;
                echo json_encode([
                    'success' => true,
                    'id' => $id,
                    'message' => 'تم إضافة عرض السعر بنجاح'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'فشل إضافة عرض السعر: ' . $stmt->error
                ], JSON_UNESCAPED_UNICODE);
            }
            $stmt->close();
            break;
            
        case 'PUT':
            // تحديث عرض سعر موجود
            if (!isset($input['id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'معرف عرض السعر مطلوب'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $id = intval($input['id']);
            $bullets = isset($input['bullets']) ? json_encode($input['bullets'], JSON_UNESCAPED_UNICODE) : '[]';
            
            $stmt = $conn->prepare("UPDATE quotes SET
                date = ?, client = ?, place = ?, status = ?, unit_type = ?, units_count = ?,
                subtotal = ?, discount = ?, discount_type = ?, tax_mode = ?, tax = ?, currency = ?,
                pay_plan = ?, p1 = ?, total = ?, bullets = ?, tenant = ?, valid = ?, valid_days = ?,
                pay_to = ?, iban = ?, acct = ?, signer = ?, signer_phone = ?, logo = ?
                WHERE id = ?");
            
            $stmt->bind_param("sssssiddssssidsssississsssi",
                $input['date'] ?? null,
                $input['client'],
                $input['place'],
                $input['status'] ?? 'active',
                $input['unit_type'] ?? null,
                $input['units_count'] ?? 1,
                $input['subtotal'] ?? 0,
                $input['discount'] ?? 0,
                $input['discount_type'] ?? 'amount',
                $input['tax_mode'] ?? 'exclusive',
                $input['tax'] ?? 15,
                $input['currency'] ?? 'SAR',
                $input['pay_plan'] ?? 1,
                $input['p1'] ?? 100,
                $input['total'] ?? 0,
                $bullets,
                $input['tenant'] ?? null,
                $input['valid'] ?? 1,
                $input['valid_days'] ?? 30,
                $input['pay_to'] ?? null,
                $input['iban'] ?? null,
                $input['acct'] ?? null,
                $input['signer'] ?? null,
                $input['signer_phone'] ?? null,
                $input['logo'] ?? null,
                $id
            );
            
            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم تحديث عرض السعر بنجاح'
                    ], JSON_UNESCAPED_UNICODE);
                } else {
                    http_response_code(404);
                    echo json_encode([
                        'success' => false,
                        'error' => 'عرض السعر غير موجود'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'فشل تحديث عرض السعر: ' . $stmt->error
                ], JSON_UNESCAPED_UNICODE);
            }
            $stmt->close();
            break;
            
        case 'DELETE':
            if (isset($_GET['id'])) {
                // حذف عرض سعر
                $id = intval($_GET['id']);
                $stmt = $conn->prepare("DELETE FROM quotes WHERE id = ?");
                $stmt->bind_param("i", $id);
                
                if ($stmt->execute()) {
                    if ($stmt->affected_rows > 0) {
                        echo json_encode([
                            'success' => true,
                            'message' => 'تم حذف عرض السعر بنجاح'
                        ], JSON_UNESCAPED_UNICODE);
                    } else {
                        http_response_code(404);
                        echo json_encode([
                            'success' => false,
                            'error' => 'عرض السعر غير موجود'
                        ], JSON_UNESCAPED_UNICODE);
                    }
                } else {
                    http_response_code(500);
                    echo json_encode([
                        'success' => false,
                        'error' => 'فشل حذف عرض السعر: ' . $stmt->error
                    ], JSON_UNESCAPED_UNICODE);
                }
                $stmt->close();
            } else {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'معرف عرض السعر مطلوب'
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

