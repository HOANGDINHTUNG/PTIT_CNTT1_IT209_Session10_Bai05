# BÀI 5: TỰ ĐỘNG HÓA ĐIỀU PHỐI ĐA DỊCH VỤ VỚI DOCKER COMPOSE & FILE .ENV

- **Môn học:** DevOps / Containerization
- **Bài thực hành:** Bài 5 - Session 10
- **Mục tiêu:** 
  - Chuyển đổi toàn bộ quy trình cấu hình thủ công ở EX4 sang tệp khai báo chuẩn **Infrastructure as Code (IaC)** với `docker-compose.yml`.
  - Áp dụng nguyên tắc bảo mật thông tin nhạy cảm (12-Factor App) bằng cách tách cấu hình ra tệp `.env`, cung cấp tệp mẫu `.env.example` và đưa `.env` vào `.gitignore`.
  - Thiết lập đầy đủ các chỉ thị cấp root: `services`, `depends_on` (kèm healthcheck), `networks` và `volumes`.
  - Thực thi và quản lý vòng đời ứng dụng hoàn toàn bằng **Docker Compose CLI v2** (`docker compose`).
- **Đường dẫn nộp bài:** `homework/session_10/ex5/`

---

## 1. Cấu trúc thư mục dự án

```text
PTIT_CNTT1_IT209_Session10_Bai05/
├── .dockerignore
├── .env                 # Tệp biến môi trường cục bộ (bị .gitignore bỏ qua)
├── .env.example         # Tệp biến môi trường mẫu nộp lên GitHub
├── .gitignore           # Khai báo loại trừ .env và node_modules/
├── docker-compose.yml   # Khai báo hạ tầng dịch vụ (IaC)
├── Dockerfile           # Đóng gói backend service
├── package.json         # Phụ thuộc: express, pg
├── server.js            # Web REST API kết nối PostgreSQL
└── README.md            # Báo cáo và hướng dẫn vận hành
```

---

## 2. Thiết kế hạ tầng & Phân tích cấu hình

### 2.1. Bảo mật biến môi trường (`.env` & `.env.example`)
Tất cả các tham số nhạy cảm (User, Password, Database Name, Port) được gom vào tệp `.env`:
```ini
# .env
HOST_PORT=8080
PORT=3000
DB_NAME=appdb
DB_USER=postgres
DB_PASSWORD=secretpassword123
DB_PORT=5432
```

Tệp mẫu `.env.example` được đưa lên Git repository để các lập trình viên khác tham khảo cấu trúc cấu hình mà không làm lộ mật khẩu thực:
```ini
# .env.example
HOST_PORT=8080
PORT=3000
DB_NAME=appdb
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_PORT=5432
```

Tệp `.gitignore` bảo vệ `.env`:
```text
.env
node_modules/
npm-debug.log
```

---

### 2.2. Khai báo hạ tầng điều phối (`docker-compose.yml`)
```yaml
services:
  database:
    image: postgres:15-alpine
    container_name: database-service
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - backend-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: .
    container_name: backend-service
    restart: unless-stopped
    ports:
      - "${HOST_PORT}:8080"
    environment:
      PORT: 8080
      DB_HOST: database
      DB_PORT: ${DB_PORT:-5432}
      DB_NAME: ${DB_NAME}
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
    depends_on:
      database:
        condition: service_healthy
    networks:
      - backend-net

volumes:
  pgdata:
    name: pgdata-volume

networks:
  backend-net:
    name: backend-network
    driver: bridge
```

#### Các điểm nổi bật trong kiến trúc:
1. **Root-level Declarations:** Cấu trúc rõ ràng theo chuẩn Compose Specification gồm 3 khối gốc: `services`, `volumes`, và `networks`.
2. **`depends_on` kèm `condition: service_healthy`:** 
   - Nếu chỉ dùng `depends_on: - database` thông thường, container backend sẽ khởi chạy ngay khi container database vừa được nạp vào memory (lúc này PostgreSQL daemon bên trong chưa kịp mở socket kết nối), dễ gây lỗi crash connection.
   - Bằng cách cấu hình `healthcheck` (`pg_isready`) kết hợp `condition: service_healthy`, Docker Compose đảm bảo `backend-service` chỉ khởi động khi PostgreSQL đã sẵn sàng nhận kết nối 100%.
3. **Internal DNS Service Discovery:** Backend kết nối thẳng vào database thông qua hostname `database` tương ứng với tên service được định nghĩa trong cùng mạng `backend-net`.

---

## 3. Các bước kiểm tra & Vận hành với Docker Compose v2

### Bước 1: Khởi tạo và chạy ngầm toàn bộ dịch vụ (`docker compose up -d`)
```bash
docker compose up -d
```

**Kết quả đầu ra (Terminal Output):**
```text
[+] Running 4/4
 ✔ Network backend-network     Created                                   0.1s 
 ✔ Volume pgdata-volume        Created                                   0.1s 
 ✔ Container database-service  Healthy                                  10.2s 
 ✔ Container backend-service   Started                                   0.8s 
```
> **Đánh giá:** Docker Compose tự động tạo mạng `backend-network`, tạo volume `pgdata-volume`, khởi động database và chờ healthcheck đạt trạng thái `Healthy` trước khi khởi động `backend-service`.

---

### Bước 2: Kiểm tra trạng thái các dịch vụ (`docker compose ps`)
```bash
docker compose ps
```

**Kết quả đầu ra:**
```text
NAME               IMAGE                COMMAND                  SERVICE    CREATED          STATUS                    PORTS
backend-service    ptit_session10_ex5   "node server.js"         backend    12 seconds ago   Up 2 seconds              0.0.0.0:8080->8080/tcp
database-service   postgres:15-alpine   "docker-entrypoint.s…"   database   22 seconds ago   Up 12 seconds (healthy)   5432/tcp
```
> **Đánh giá:** Cả 2 service đều ở trạng thái `Up` (Running), database đạt trạng thái `healthy`, port `8080` của host được ánh xạ chính xác.

---

### Bước 3: Xem log hợp nhất các dịch vụ (`docker compose logs`)
```bash
docker compose logs
```

**Kết quả đầu ra:**
```text
database-service  | 2026-10-13 15:24:00.123 UTC [1] LOG:  starting PostgreSQL 15.8 on x86_64-pc-linux-musl...
database-service  | 2026-10-13 15:24:05.456 UTC [1] LOG:  database system is ready to accept connections
backend-service   | Backend service listening on port 8080
```

---

### Bước 4: Kiểm tra phản hồi API kết nối Database (`curl`)
Gửi HTTP GET tới API backend:
```bash
curl -i http://localhost:8080/
```

**Kết quả đầu ra:**
```text
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 215
Date: Tue, 13 Oct 2026 15:24:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{
  "status": "success",
  "message": "Hello from Docker Compose v2 Multi-service Stack!",
  "database": {
    "status": "Connected",
    "host": "database",
    "db_name": "appdb",
    "server_time": "2026-10-13T15:24:20.312Z"
  }
}
```
> **Đánh giá:** Backend kết nối thành công tới database service thông qua DNS nội bộ `database`, truy vấn thành công thời gian hệ thống của PostgreSQL (`SELECT NOW()`).

---

### Bước 5: Dọn dẹp và dừng hệ thống (`docker compose down`)
```bash
# Dừng và xóa container, network nhưng vẫn giữ volume dữ liệu
docker compose down
```

**Kết quả đầu ra:**
```text
[+] Running 3/3
 ✔ Container backend-service   Removed                                   0.5s 
 ✔ Container database-service  Removed                                   0.5s 
 ✔ Network backend-network     Removed                                   0.2s 
```

> **Lưu ý:** Nếu muốn xóa cả Named Volume dữ liệu, sử dụng cờ `-v`:
> ```bash
> docker compose down -v
> ```

---

## 4. Đánh giá & Kết luận

1. **Chuẩn hóa IaC:** Toàn bộ cụm dịch vụ được quản lý tập trung trong tệp `docker-compose.yml`, giúp việc triển khai môi trường mới chỉ cần một lệnh duy nhất (`docker compose up -d`).
2. **Bảo mật tối đa:** Thông tin nhạy cảm đã được tách bạch vào `.env` và bảo vệ nghiêm ngặt qua `.gitignore`. Tệp `.env.example` cung cấp đầy đủ thông tin mẫu hỗ trợ phát triển theo nhóm.
3. **Độ tin cậy cao:** Cơ chế `healthcheck` kết hợp `condition: service_healthy` giải quyết triệt để vấn đề race condition khi khởi động các dịch vụ phụ thuộc vào cơ sở dữ liệu.
