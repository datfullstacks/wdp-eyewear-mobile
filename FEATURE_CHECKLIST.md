# Danh sách tính năng ứng dụng Mobile WDP301

## ✅ CHỨC NĂNG ĐÃ HOÀN THÀNH

### 1. **Duyệt danh mục sản phẩm**
- ✅ Hiển thị danh sách sản phẩm
- ✅ Tìm kiếm sản phẩm theo tên
- ✅ Hiển thị số lượng kết quả theo bộ lọc
- ✅ File: `src/screens/ProductsScreen.js`

### 2. **Lọc & Sắp xếp sản phẩm**
- ✅ Lọc theo loại: `FRAME`, `LENS`
- ✅ Lọc theo giá: Dưới 500k, 500k-2tr, Trên 2tr
- ✅ Lọc theo trạng thái: Có sẵn (`IN_STOCK`), Đặt trước (`PREORDER`)
- ✅ Lọc theo thương hiệu (Brand)
- ✅ Lọc theo màu sắc (Color)
- ✅ Lọc theo size
- ✅ Xóa từng filter chip hoặc clear all
- ✅ Sắp xếp: Mặc định, Bán chạy, Giá tăng/giảm, Giảm giá nhiều, Đánh giá cao
- ✅ File: `src/screens/ProductsScreen.js`

### 3. **Xem chi tiết sản phẩm**
- ✅ Hiển thị đầy đủ thông tin sản phẩm
- ✅ Specs/Điểm nổi bật
- ✅ Mô tả sản phẩm
- ✅ Hướng dẫn chọn size
- ✅ Hiển thị rating trung bình, số đánh giá, số đã bán
- ✅ Chọn biến thể màu/size (đối với FRAME)
- ✅ Chọn loại đơn hàng: `READY`, `PREORDER`, `CUSTOM`
- ✅ File: `src/screens/ProductDetailScreen.js`

### 4. **Xem media sản phẩm**
- ✅ Ảnh 2D theo sản phẩm/biến thể
- ⚠️ Có toggle 2D/3D trên UI
- ⚠️ File: `src/screens/ProductDetailScreen.js` (phần `model3D?.enabled`)

### 5. **Quản lý giỏ hàng**
- ✅ Thêm sản phẩm vào giỏ
- ✅ Xóa sản phẩm khỏi giỏ
- ✅ Quản lý số lượng tăng/giảm
- ✅ Tách key giỏ theo biến thể + loại đơn + prescription
- ✅ Lưu trữ local bằng Zustand + AsyncStorage
- ✅ Kiểm tra điều kiện đơn lens có prescription trước checkout
- ✅ File: `src/screens/CartScreen.js`, `src/store/cartStore.js`

### 6. **Các loại đơn hàng**

#### 6a. **In-Stock (Có sẵn)**
- ✅ Hỗ trợ loại đơn `READY`
- ✅ Label và thông tin giao nhanh

#### 6b. **Pre-order (Đặt trước)**
- ✅ Hỗ trợ loại đơn `PREORDER`
- ✅ Hiển thị ETA dự kiến
- ✅ Xử lý tách phần trả trước/trả sau ở checkout

#### 6c. **Prescription Order (Đặt theo đơn kính)**
- ✅ Hỗ trợ loại đơn `CUSTOM`
- ✅ Nhập thông số mắt (OD/OS) cho lens
- ✅ Lưu, quản lý prescription riêng
- ✅ File: `src/screens/PrescriptionScreen.js`, `src/store/cartStore.js`

### 7. **Thanh toán (Checkout)**
- ✅ Form checkout đầy đủ
- ✅ Chọn phương thức vận chuyển
- ✅ Quản lý địa chỉ giao hàng (CRUD)
- ✅ Lấy quote/tính tổng tiền
- ✅ Hỗ trợ xử lý preorder: trả trước + COD phần còn lại
- ✅ File: `src/screens/CheckoutScreen.js`, `src/services/checkoutService.js`

### 8. **Phương thức thanh toán**
- ✅ SePay QR
- ✅ COD
- ✅ Parse và hiển thị metadata thanh toán từ server/fallback
- ✅ File: `src/screens/CheckoutScreen.js`, `src/screens/CheckoutStatusScreen.js`

### 9. **Theo dõi trạng thái đơn hàng**
- ✅ Danh sách đơn hàng
- ✅ Trạng thái đơn: pending, confirmed, processing, shipped, delivered, cancelled, returned
- ✅ Trạng thái thanh toán: `PENDING_QR`, `PENDING_COD`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`
- ✅ Hiển thị QR/thông tin thanh toán cho đơn chưa tất toán
- ✅ File: `src/screens/OrdersScreen.js`, `src/screens/CheckoutStatusScreen.js`

### 10. **Quản lý tài khoản**

#### 10a. **Xác thực**
- ✅ Đăng nhập
- ✅ Đăng ký
- ✅ Đăng nhập Google (qua Supabase flow)
- ✅ Lưu token bằng SecureStore
- ✅ Gắn token vào request API qua interceptor
- ✅ File: `src/screens/LoginScreen.js`, `src/screens/RegisterScreen.js`, `src/store/authStore.js`, `src/services/tokenStorage.js`, `src/services/apiClient.js`

#### 10b. **Hồ sơ cá nhân**
- ✅ Xem thông tin profile
- ✅ Thống kê nhanh: đơn hàng, favorites, addresses, prescription
- ✅ File: `src/screens/ProfileScreen.js`

#### 10c. **Quản lý địa chỉ**
- ✅ Thêm/Xóa/Sửa địa chỉ
- ✅ Đặt địa chỉ mặc định
- ✅ File: `src/screens/AddressBookScreen.js`, `src/services/userService.js`

#### 10d. **Lịch sử mua hàng**
- ✅ Xem danh sách đơn
- ✅ Xem trạng thái đơn
- ✅ File: `src/screens/OrdersScreen.js`

#### 10e. **Phương thức thanh toán đã lưu**
- ✅ Thêm/Xóa/Sửa payment methods
- ✅ Đặt default payment method
- ✅ File: `src/screens/PaymentsScreen.js`, `src/services/userService.js`

### 11. **Wishlist/Favorites**
- ✅ Thêm/Xóa yêu thích
- ✅ Xem danh sách yêu thích
- ✅ Xóa toàn bộ favorites
- ✅ Đồng bộ qua API người dùng
- ✅ File: `src/screens/FavoritesScreen.js`, `src/store/favoriteStore.js`, `src/services/userService.js`

### 12. **Thông báo (Notifications)**
- ✅ Xem danh sách thông báo
- ✅ Đánh dấu đã đọc từng cái / đọc tất cả
- ✅ File: `src/screens/NotificationsScreen.js`, `src/services/userService.js`

### 13. **Hỗ trợ khách hàng**
- ✅ Tạo support ticket
- ✅ Xem danh sách ticket
- ✅ Phản hồi ticket
- ✅ File: `src/screens/SupportScreen.js`, `src/services/supportService.js`

---

## ⚠️ CHỨC NĂNG ĐANG CÓ NHƯNG CHƯA HOÀN CHỈNH

### 1. **3D Product Viewer**
- **Trạng thái**: ⚠️ Có UI toggle nhưng chưa render 3D thật
- **Đã có**:
  - Cờ dữ liệu `model3D.enabled`
  - Nút chuyển 2D/3D trong màn hình chi tiết
- **Thiếu**:
  - Component render model 3D (`.glb/.gltf`)
  - Điều hướng camera/zoom/rotate
  - Pipeline asset 3D
- **File liên quan**: `src/screens/ProductDetailScreen.js`

### 2. **Reviews & Q&A sản phẩm**
- **Trạng thái**: ⚠️ Mới ở mức preview
- **Đã có**:
  - `ratingCount`, `qaCount` trong dữ liệu
  - Accordion section hiển thị placeholder
- **Thiếu**:
  - Form gửi đánh giá/hỏi đáp
  - Danh sách review/Q&A thực tế từ API
  - Cơ chế vote/like/report
- **File liên quan**: `src/screens/ProductDetailScreen.js`, `src/data/mockProducts.js`

### 3. **Image Gallery/Lightbox**
- **Trạng thái**: ⚠️ Bán phần
- **Đã có**: Ảnh chính sản phẩm
- **Thiếu**:
  - Gallery nhiều ảnh
  - Zoom/pan/fullscreen lightbox
- **File liên quan**: `src/screens/ProductDetailScreen.js`

### 4. **Product Recommendation nâng cao**
- **Trạng thái**: ⚠️ Bán phần
- **Đã có**: Related products theo type/brand
- **Thiếu**: Recommendation theo hành vi mua, lịch sử xem, favorites
- **File liên quan**: `src/services/productService.js`, `src/screens/ProductDetailScreen.js`

---

## ❌ CHỨC NĂNG CHƯA CÓ / THIẾU

### 1. **Return/Exchange/Warranty (đổi trả/bảo hành)**
- **Trạng thái**: ❌ Chưa có flow độc lập
- **Thiếu**:
  - Screen tạo yêu cầu đổi/trả/bảo hành
  - API service chuyên cho return request
  - Timeline xử lý return

### 2. **Return Status Tracking riêng**
- **Trạng thái**: ❌ Chưa có
- **Thiếu**:
  - Trạng thái theo vòng đời return (Pending/Approved/Rejected/In Progress/Completed)

### 3. **Coupons & Promo Codes**
- **Trạng thái**: ❌ Chưa có
- **Thiếu**:
  - Input coupon
  - Validate coupon
  - Tính toán discount theo mã

### 4. **Realtime Chat / Live Support**
- **Trạng thái**: ❌ Chưa có
- **Hiện tại**: mới có ticket dạng bất đồng bộ

### 5. **Comparison Tool (So sánh sản phẩm)**
- **Trạng thái**: ❌ Chưa có

### 6. **Wishlist Sharing**
- **Trạng thái**: ❌ Chưa có

### 7. **Advanced Search**
- **Trạng thái**: ⚠️ Mới search theo tên
- **Thiếu**:
  - Search theo specs/brand/thuộc tính nâng cao
  - Search history / recent searches

---

## 📌 TÓM TẮT CẬP NHẬT SO VỚI BẢN CŨ

- Đã chuyển các mục **Brand/Color/Size Filter** từ ❌ sang ✅ (đã có trong UI + logic filter).
- Đã xác nhận lại **brand field** có trong dữ liệu sản phẩm.
- Đã cập nhật trạng thái **COD** từ “chưa rõ logic” sang ✅ (đã có logic trong checkout/status).
- Đã chuẩn hóa phần auth token: dùng `tokenStorage` + `authStore` + interceptor `apiClient`.

## 📈 ĐÁNH GIÁ TIẾN ĐỘ TỔNG QUAN

### Đã implement
- Khoảng **75-80% core flow**:
  - Browse/search/filter/sort
  - Product detail
  - Cart + prescription
  - Checkout + payment status
  - Orders
  - Account management
  - Favorites/Notifications/Support tickets

### Chưa implement hoặc mới bán phần
- Khoảng **20-25% advanced features**:
  - 3D viewer thật
  - Reviews/Q&A đầy đủ
  - Returns/Exchange/Warranty
  - Coupon/promo
  - Live chat
  - Comparison
### Ưu tiên implement tiếp:
1. **3D Viewer** - UI đã có, chỉ cần backend
2. **Brand/Color/Size Filter** - Dữ liệu có, chỉ cần UI
3. **Returns Management** - Quan trọng cho UX
4. **Product Reviews** - Tăng credibility
5. **Q&A Section** - Giúp customer decision-making

