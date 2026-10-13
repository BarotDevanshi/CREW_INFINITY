# 📘 Department Inventory Management — API Documentation

**Base URL:** `http://localhost:3000/api`
**Auth:** Bearer Token (JWT) — include in every protected request:
```
Authorization: Bearer <token>
```

---

## 🔐 Auth Endpoints

### POST `/auth/login`
Login as coordinator or student.
```json
// Request Body
{ "username": "admin", "password": "admin123" }

// Response 200
{
  "success": true,
  "token": "<jwt_token>",
  "user": {
    "id": "...",
    "username": "admin",
    "name": "Dr. Ramesh Kumar",
    "role": "coordinator",
    "studentId": null,
    "student": null
  }
}
```

### GET `/auth/me` 🔒
Returns currently logged-in user info.

### POST `/auth/change-password` 🔒
```json
{ "currentPassword": "admin123", "newPassword": "newpass456" }
```

---

## 📍 Location Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/locations` | 🔒 Any | List all locations |
| GET    | `/locations/:id` | 🔒 Any | Get single location |
| POST   | `/locations` | 👨‍💼 Coord | Add new location |
| PUT    | `/locations/:id` | 👨‍💼 Coord | Update location |
| DELETE | `/locations/:id` | 👨‍💼 Coord | Soft-delete location |

**GET `/locations` Query Params:** `?department=&type=laboratory|room|cupboard|other&search=`

**POST `/locations` Body:**
```json
{
  "department": "Computer Science",
  "type": "laboratory",
  "name": "DFIS Lab — Cupboard A",
  "building": "Tech Block",
  "floor": "2nd Floor",
  "notes": "Optional"
}
```

---

## 📦 Item Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/items` | 🔒 Any | List all items with live available qty |
| GET    | `/items/:id` | 🔒 Any | Single item with stock breakdown |
| POST   | `/items` | 👨‍💼 Coord | Create item |
| PUT    | `/items/:id` | 👨‍💼 Coord | Update item |
| DELETE | `/items/:id` | 👨‍💼 Coord | Soft-delete item |
| GET    | `/items/:id/assets` | 👨‍💼 Coord | All individual assets of an item |

**GET `/items` Query Params:** `?category=&trackingType=asset|quantity&search=`

**POST `/items` Body:**
```json
{
  "code": "DEV-BOARD",
  "name": "Development Board",
  "category": "Electronics",
  "description": "Raspberry Pi 4B",
  "makeModel": "Raspberry Pi 4 Model B",
  "trackingType": "asset",
  "totalQty": 10,
  "locationId": "<location_id>"
}
```

**GET `/items` Response includes:**
```json
{
  "availableQty": 7,
  "issuedQty": 3,
  "damagedQty": 0,
  "lostQty": 0,
  "maintenanceQty": 0
}
```

---

## 🖥️ Asset Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/assets` | 👨‍💼 Coord | List all assets |
| GET    | `/assets/:id` | 👨‍💼 Coord | Single asset |
| POST   | `/assets` | 👨‍💼 Coord | Add individual asset |
| PUT    | `/assets/:id` | 👨‍💼 Coord | Update asset (condition, location) |
| DELETE | `/assets/:id` | 👨‍💼 Coord | Retire asset |

**GET `/assets` Query Params:** `?itemId=&status=available|issued|retired&condition=good|damaged|lost|maintenance&search=`

**POST `/assets` Body:**
```json
{
  "itemId": "<item_id>",
  "assetTag": "DB-001",
  "serialNumber": "SN-RPi4-2024001",
  "locationId": "<location_id>",
  "condition": "good",
  "notes": "Optional"
}
```

**PUT `/assets/:id` — Update Condition:**
```json
{
  "condition": "damaged",
  "reason": "Screen cracked during lab session"
}
```

---

## 👥 Student Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/students` | 👨‍💼 Coord | List all students |
| GET    | `/students/:id` | 👨‍💼 Coord | Single student |
| POST   | `/students` | 👨‍💼 Coord | Register student (creates login too) |
| PUT    | `/students/:id` | 👨‍💼 Coord | Update student details |
| DELETE | `/students/:id` | 👨‍💼 Coord | Deactivate student |
| GET    | `/students/:id/transactions` | 🔒 Own/Coord | Student's transactions |

**GET `/students` Query Params:** `?programme=&semester=&search=`

**POST `/students` Body:**
```json
{
  "name": "Aarav Sharma",
  "enrollmentNo": "DFIS001",
  "programme": "M.Sc. DFIS",
  "semester": 1,
  "contact": "9876543210",
  "email": "aarav@dfis.edu",
  "address": "Optional",
  "username": "dfis001",
  "password": "student123"
}
```

---

## 📤 Transaction Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/transactions` | 👨‍💼 Coord | All transactions |
| GET    | `/transactions/overdue` | 👨‍💼 Coord | All overdue transactions |
| GET    | `/transactions/upcoming-due` | 👨‍💼 Coord | Due in next N days |
| GET    | `/transactions/pending-renewals` | 👨‍💼 Coord | Pending renewal requests |
| GET    | `/transactions/my` | 🎓 Student | Own transactions |
| GET    | `/transactions/:id` | 🔒 Own/Coord | Single transaction |
| POST   | `/transactions/issue` | 👨‍💼 Coord | Issue item to student |
| POST   | `/transactions/:id/return` | 👨‍💼 Coord | Record return (partial/full) |
| POST   | `/transactions/:id/renewal-request` | 🎓 Student | Request renewal |
| PUT    | `/transactions/:id/renewal-approve` | 👨‍💼 Coord | Approve renewal |
| PUT    | `/transactions/:id/renewal-reject` | 👨‍💼 Coord | Reject renewal |

---

### POST `/transactions/issue`
```json
// Request Body
{
  "studentId": "<student_id>",
  "itemId": "<item_id>",
  "assetId": "<asset_id>",   // Required only for trackingType=asset
  "quantity": 1,
  "purpose": "Lab project",
  "issueDate": "2026-10-01"
}

// Response 201
{
  "success": true,
  "message": "Development Board (DB-001) issued to Aarav Sharma. Due: Thu Oct 16 2026",
  "acknowledgement": {
    "transactionId": "...",
    "student": "Aarav Sharma",
    "enrollmentNo": "DFIS001",
    "item": "Development Board",
    "assetTag": "DB-001",
    "issuedQty": 1,
    "purpose": "Lab project",
    "issueDate": "2026-10-01T00:00:00.000Z",
    "dueDate": "2026-10-16T00:00:00.000Z",
    "issuingStaff": "Dr. Ramesh Kumar"
  }
}

// Error if asset already issued
{
  "success": false,
  "message": "Asset DB-001 is currently issued. Cannot be issued to another student."
}

// Error if insufficient quantity
{
  "success": false,
  "message": "5 USB Cable(s) were requested, but only 3 are currently available.",
  "requested": 5,
  "available": 3
}
```

---

### POST `/transactions/:id/return`
```json
// Request Body
{
  "returnedQty": 1,
  "conditionOnReturn": "good",
  "actualReturnDate": "2026-10-14",
  "notes": "Returned in good condition"
}

// Response 200
{
  "success": true,
  "message": "Item fully returned."
  // OR "Partial return recorded. 2 unit(s) still outstanding."
}
```

---

### POST `/transactions/:id/renewal-request`  *(Student only)*
```json
// No body needed

// Response 200
{
  "success": true,
  "message": "Renewal request submitted. Due date remains unchanged until coordinator approves."
}
```

---

### PUT `/transactions/:id/renewal-approve`
```json
// Request Body
{
  "renewalRequestId": "<renewal_subdoc_id>",
  "remarks": "Approved for project completion"
}

// Response 200
{
  "success": true,
  "message": "Renewal approved. New due date: Fri Oct 31 2026"
}
```

---

### GET `/transactions/overdue`
```json
// Response
{
  "data": [{
    "overdueDays": 3,
    "overdueMessage": "Development Board DB-001 issued to student enrolment number DFIS001 was due on Sat Oct 10 2026 and is overdue by 3 day(s).",
    "studentId": { "name": "Aarav Sharma", "enrollmentNo": "DFIS001", "contact": "..." },
    "itemId": { "name": "Development Board", "code": "DEV-BOARD" }
  }]
}
```

### GET `/transactions/upcoming-due?days=3`
Returns transactions due within next 3 days (default). Change `days` param as needed.

---

## 📊 Stock Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/stock/log` | 👨‍💼 Coord | Full stock adjustment log |
| POST   | `/stock/adjust` | 👨‍💼 Coord | Record stock adjustment |
| GET    | `/stock/policy` | 🔒 Any | Get current policy |
| PUT    | `/stock/policy` | 👨‍💼 Coord | Update policy |

**POST `/stock/adjust` Body:**
```json
// Add new stock
{
  "itemId": "<id>",
  "type": "new_stock",
  "quantityChange": 5,
  "reason": "New batch purchased"
}

// Mark items as damaged (quantity-based)
{
  "itemId": "<id>",
  "type": "condition_change",
  "quantityChange": 2,
  "conditionFrom": "good",
  "conditionTo": "damaged",
  "reason": "Found damaged during inspection"
}

// Retire items
{
  "itemId": "<id>",
  "type": "retirement",
  "quantityChange": 1,
  "reason": "Item beyond repair"
}
```

**PUT `/stock/policy` Body:**
```json
{
  "issueDays": 15,
  "renewalDays": 15,
  "maxRenewals": 3,
  "maxIssueQty": 5,
  "notes": "Updated policy"
}
```

---

## 📋 Report Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/reports/summary` | 👨‍💼 Coord | Overall dashboard summary |
| GET    | `/reports/student/:id` | 👨‍💼 Coord | All transactions by student |
| GET    | `/reports/item/:id` | 👨‍💼 Coord | All transactions by item |
| GET    | `/reports/programme/:name` | 👨‍💼 Coord | By programme (e.g. M.Sc.%20DFIS) |
| GET    | `/reports/location/:id` | 👨‍💼 Coord | Items & transactions by location |
| GET    | `/reports/stock` | 👨‍💼 Coord | Full stock breakdown all items |

**GET `/reports/summary` Response:**
```json
{
  "data": {
    "totalItems": 4,
    "totalQty": 50,
    "totalStudents": 5,
    "activeTransactions": 4,
    "overdueTransactions": 2,
    "pendingRenewals": 1,
    "totalDamaged": 1,
    "totalLost": 0,
    "totalMaintenance": 0
  }
}
```

**GET `/reports/stock` Response per item:**
```json
{
  "name": "Development Board",
  "totalQty": 10,
  "availableQty": 7,
  "issuedQty": 3,
  "overdueQty": 1,
  "damagedQty": 0,
  "lostQty": 0,
  "maintenanceQty": 0
}
```

---

## 🔑 Legend

| Icon | Meaning |
|------|---------|
| 🔒 | Requires login (any role) |
| 👨‍💼 Coord | Coordinator only |
| 🎓 Student | Student only (own data) |

---

## ⚡ Quick Start for Frontend Dev

```javascript
// 1. Login
const res = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const { token, user } = await res.json();

// 2. Save token
localStorage.setItem('token', token);

// 3. Use in every request
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('token')}`
};

// 4. Fetch overdue items
const overdue = await fetch('http://localhost:3000/api/transactions/overdue', { headers });
const { data } = await overdue.json();

// 5. Issue an item
await fetch('http://localhost:3000/api/transactions/issue', {
  method: 'POST',
  headers,
  body: JSON.stringify({
    studentId: '...',
    itemId: '...',
    assetId: '...',       // only for asset-tracked items
    quantity: 1,
    purpose: 'Lab project',
    issueDate: '2026-10-13'
  })
});
```

---

## 📦 Transaction Status Values

| Status | Meaning |
|--------|---------|
| `active` | Item issued, all quantity outstanding |
| `partially_returned` | Some qty returned, some still outstanding |
| `returned` | Fully returned |
| `overdue` | Past due date, not returned/renewed |

## 🏷️ Asset Condition Values

| Condition | Issuable? |
|-----------|-----------|
| `good` | ✅ Yes |
| `damaged` | ❌ No |
| `lost` | ❌ No |
| `maintenance` | ❌ No |

## 📊 computedStatus field
All transaction responses include `computedStatus` (real-time overdue check) and `overdueDays` fields computed on each request — these are more accurate than the stored `status` field for displaying to users.
