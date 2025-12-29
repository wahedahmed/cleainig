<?php
/**
 * ====== API عروض الأسعار ======
 * 
 * هذا الملف يحتوي على جميع عمليات CRUD لعروض الأسعار
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
            if ($action === 'get' && isset($_GET['id'])) {
                // الحصول على عرض سعر محدد
                $id = intval($_GET['id']);
                $stmt = $conn->prepare("SELECT * FROM quotes WHERE id = ?");
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $result = $stmt->get_result();
                
                if ($row = $result->fetch_assoc()) {
                    // تحويل bullets من JSON إلى array
                    if ($row['bullets']) {
                        $row['bullets'] = json_decode($row['bullets'], true);
                    } else {
                        $row['bullets'] = [];
                    }
                    
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
                $limit = intval($_GET['limit'] ?? 100);
                $offset = intval($_GET['offset'] ?? 0);
                
                if ($tenant) {
                    $stmt = $conn->prepare("SELECT * FROM quotes WHERE tenant = ? ORDER BY created_at DESC LIMIT ? OFFSET ?");
                    $stmt->bind_param("sii", $tenant, $limit, $offset);
                } else {
                    $stmt = $conn->prepare("SELECT * FROM quotes ORDER BY created_at DESC LIMIT ? OFFSET ?");
                    $stmt->bind_param("ii", $limit, $offset);
                }
                
                $stmt->execute();
                $result = $stmt->get_result();
                $quotes = [];
                
                while ($row = $result->fetch_assoc()) {
                    // تحويل bullets من JSON إلى array
                    if ($row['bullets']) {
                        $row['bullets'] = json_decode($row['bullets'], true);
                    } else {
                        $row['bullets'] = [];
                    }
                    $quotes[] = $row;
                }
                
                echo json_encode([
                    'success' => true,
                    'data' => $quotes,
                    'count' => count($quotes)
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
            // إنشاء عرض سعر جديد
            if (!isset($input['client']) || !isset($input['place'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'اسم العميل والموقع مطلوبان'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            // تحويل bullets إلى JSON
            $bullets = isset($input['bullets']) && is_array($input['bullets']) 
                ? json_encode($input['bullets'], JSON_UNESCAPED_UNICODE) 
                : '[]';
            
            $stmt = $conn->prepare("
                INSERT INTO quotes (
                    date, client, place, status, unit_type, units_count,
                    subtotal, discount, discount_type, tax_mode, tax, currency,
                    pay_plan, p1, total, valid, valid_days,
                    pay_to, iban, acct, signer, signer_phone, logo, bullets, tenant
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $date = $input['date'] ?? null;
            $client = $input['client'];
            $place = $input['place'];
            $status = $input['status'] ?? 'active';
            $unit_type = $input['unit_type'] ?? null;
            $units_count = intval($input['units_count'] ?? 1);
            $subtotal = floatval($input['subtotal'] ?? 0);
            $discount = floatval($input['discount'] ?? 0);
            $discount_type = $input['discount_type'] ?? 'amount';
            $tax_mode = $input['tax_mode'] ?? 'exclusive';
            $tax = floatval($input['tax'] ?? 15);
            $currency = $input['currency'] ?? 'SAR';
            $pay_plan = intval($input['pay_plan'] ?? 1);
            $p1 = intval($input['p1'] ?? 100);
            $total = floatval($input['total'] ?? 0);
            $valid = isset($input['valid']) ? (int)$input['valid'] : 0;
            $valid_days = intval($input['valid_days'] ?? 30);
            $pay_to = $input['pay_to'] ?? null;
            $iban = $input['iban'] ?? null;
            $acct = $input['acct'] ?? null;
            $signer = $input['signer'] ?? null;
            $signer_phone = $input['signer_phone'] ?? null;
            $logo = $input['logo'] ?? null;
            $tenant = $input['tenant'] ?? null;
            
            $stmt->bind_param(
                "sssssiidssdsiiiiisssssss",
                $date, $client, $place, $status, $unit_type, $units_count,
                $subtotal, $discount, $discount_type, $tax_mode, $tax, $currency,
                $pay_plan, $p1, $total, $valid, $valid_days,
                $pay_to, $iban, $acct, $signer, $signer_phone, $logo, $bullets, $tenant
            );
            
            if ($stmt->execute()) {
                $id = $conn->insert_id;
                echo json_encode([
                    'success' => true,
                    'id' => $id,
                    'message' => 'تم حفظ العرض بنجاح'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'فشل حفظ العرض: ' . $stmt->error
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
                    'error' => 'معرف العرض مطلوب'
                ]);
                break;
            }
            
            $id = intval($input['id']);
            
            // التحقق من وجود العرض
            $checkStmt = $conn->prepare("SELECT id FROM quotes WHERE id = ?");
            $checkStmt->bind_param("i", $id);
            $checkStmt->execute();
            $checkResult = $checkStmt->get_result();
            
            if (!$checkResult->fetch_assoc()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'error' => 'عرض السعر غير موجود'
                ], JSON_UNESCAPED_UNICODE);
                $checkStmt->close();
                break;
            }
            $checkStmt->close();
            
            // تحويل bullets إلى JSON
            $bullets = isset($input['bullets']) && is_array($input['bullets']) 
                ? json_encode($input['bullets'], JSON_UNESCAPED_UNICODE) 
                : '[]';
            
            $stmt = $conn->prepare("
                UPDATE quotes SET
                    date = ?, client = ?, place = ?, status = ?, unit_type = ?, units_count = ?,
                    subtotal = ?, discount = ?, discount_type = ?, tax_mode = ?, tax = ?, currency = ?,
                    pay_plan = ?, p1 = ?, total = ?, valid = ?, valid_days = ?,
                    pay_to = ?, iban = ?, acct = ?, signer = ?, signer_phone = ?, logo = ?, bullets = ?, tenant = ?
                WHERE id = ?
            ");
            
            $date = $input['date'] ?? null;
            $client = $input['client'] ?? '';
            $place = $input['place'] ?? '';
            $status = $input['status'] ?? 'active';
            $unit_type = $input['unit_type'] ?? null;
            $units_count = intval($input['units_count'] ?? 1);
            $subtotal = floatval($input['subtotal'] ?? 0);
            $discount = floatval($input['discount'] ?? 0);
            $discount_type = $input['discount_type'] ?? 'amount';
            $tax_mode = $input['tax_mode'] ?? 'exclusive';
            $tax = floatval($input['tax'] ?? 15);
            $currency = $input['currency'] ?? 'SAR';
            $pay_plan = intval($input['pay_plan'] ?? 1);
            $p1 = intval($input['p1'] ?? 100);
            $total = floatval($input['total'] ?? 0);
            $valid = isset($input['valid']) ? (int)$input['valid'] : 0;
            $valid_days = intval($input['valid_days'] ?? 30);
            $pay_to = $input['pay_to'] ?? null;
            $iban = $input['iban'] ?? null;
            $acct = $input['acct'] ?? null;
            $signer = $input['signer'] ?? null;
            $signer_phone = $input['signer_phone'] ?? null;
            $logo = $input['logo'] ?? null;
            $tenant = $input['tenant'] ?? null;
            
            $stmt->bind_param(
                "sssssiidssdsiiiiisssssssi",
                $date, $client, $place, $status, $unit_type, $units_count,
                $subtotal, $discount, $discount_type, $tax_mode, $tax, $currency,
                $pay_plan, $p1, $total, $valid, $valid_days,
                $pay_to, $iban, $acct, $signer, $signer_phone, $logo, $bullets, $tenant,
                $id
            );
            
            if ($stmt->execute()) {
                echo json_encode([
                    'success' => true,
                    'id' => $id,
                    'message' => 'تم تحديث العرض بنجاح'
                ], JSON_UNESCAPED_UNICODE);
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'فشل تحديث العرض: ' . $stmt->error
                ], JSON_UNESCAPED_UNICODE);
            }
            $stmt->close();
            break;
            
        case 'DELETE':
            // حذف عرض سعر
            if (!isset($_GET['id'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => 'معرف العرض مطلوب'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $id = intval($_GET['id']);
            $stmt = $conn->prepare("DELETE FROM quotes WHERE id = ?");
            $stmt->bind_param("i", $id);
            
            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    echo json_encode([
                        'success' => true,
                        'message' => 'تم حذف العرض بنجاح'
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
                    'error' => 'فشل حذف العرض: ' . $stmt->error
                ], JSON_UNESCAPED_UNICODE);
            }
            $stmt->close();
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

