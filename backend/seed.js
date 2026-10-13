/**
 * seed.js — Demo Data Seeder
 * Run: node seed.js
 * Seeds: 1 coordinator, 5 students, locations, items, assets, transactions
 * M.Sc. DFIS example from problem statement
 */

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const User        = require('./models/User');
const Student     = require('./models/Student');
const Item        = require('./models/Item');
const Asset       = require('./models/Asset');
const Location    = require('./models/Location');
const Transaction = require('./models/Transaction');
const StockLog    = require('./models/StockLog');
const Policy      = require('./models/Policy');

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ── Clear all existing data ───────────────────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Item.deleteMany({}),
      Asset.deleteMany({}),
      Location.deleteMany({}),
      Transaction.deleteMany({}),
      StockLog.deleteMany({}),
      Policy.deleteMany({}),
    ]);
    console.log('🗑️  Cleared existing data');

    // ── Policy ────────────────────────────────────────────────────────────────
    const policy = await Policy.create({
      issueDays: 15, renewalDays: 15, maxRenewals: 3, maxIssueQty: 10,
      notes: 'Department inventory policy — M.Sc. DFIS',
    });
    console.log('📋 Policy created');

    // ── Coordinator ───────────────────────────────────────────────────────────
    const coordinator = await User.create({
      username: 'admin',
      password: 'admin123',
      role:     'coordinator',
      name:     'Dr. Ramesh Kumar',
      isActive: true,
    });
    console.log('👨‍💼 Coordinator created: admin / admin123');

    // ── Locations ─────────────────────────────────────────────────────────────
    const loc1 = await Location.create({
      department: 'Computer Science',
      type:       'laboratory',
      name:       'DFIS Lab — Cupboard A',
      building:   'Tech Block',
      floor:      '2nd Floor',
    });
    const loc2 = await Location.create({
      department: 'Computer Science',
      type:       'laboratory',
      name:       'Networking Lab — Rack 1',
      building:   'Tech Block',
      floor:      '1st Floor',
    });
    const loc3 = await Location.create({
      department: 'Computer Science',
      type:       'room',
      name:       'Store Room 101',
      building:   'Admin Block',
      floor:      'Ground Floor',
    });
    console.log('📍 Locations created');

    // ── Items ─────────────────────────────────────────────────────────────────
    // Asset-tracked: Development Boards
    const boardItem = await Item.create({
      code:         'DEV-BOARD',
      name:         'Development Board',
      category:     'Electronics',
      description:  'Raspberry Pi 4 Model B — 4GB RAM development board for embedded systems',
      makeModel:    'Raspberry Pi 4B',
      trackingType: 'asset',
      totalQty:     10,
      locationId:   loc1._id,
    });

    // Quantity-tracked: USB Cables
    const cableItem = await Item.create({
      code:         'USB-CABLE',
      name:         'USB Cable',
      category:     'Accessories',
      description:  'USB Type-A to Type-C cable, 1.5m — for device connectivity',
      makeModel:    'Generic USB-C 1.5m',
      trackingType: 'quantity',
      totalQty:     20,
      locationId:   loc1._id,
    });

    // Quantity-tracked: USB Adapters
    const adapterItem = await Item.create({
      code:         'USB-ADAPT',
      name:         'USB Adapter',
      category:     'Accessories',
      description:  'USB Type-A to Type-C adapter dongle',
      makeModel:    'Generic USB Adapter',
      trackingType: 'quantity',
      totalQty:     15,
      locationId:   loc2._id,
    });

    // Asset-tracked: Laptops
    const laptopItem = await Item.create({
      code:         'LAPTOP',
      name:         'Laptop',
      category:     'Computing',
      description:  'Dell Inspiron 15 — for student project use',
      makeModel:    'Dell Inspiron 15 3000',
      trackingType: 'asset',
      totalQty:     5,
      locationId:   loc3._id,
    });

    console.log('📦 Items created');

    // ── Assets: 10 Development Boards ────────────────────────────────────────
    const assets = [];
    for (let i = 1; i <= 10; i++) {
      const tag = `DB-${String(i).padStart(3, '0')}`;
      const a   = await Asset.create({
        itemId:       boardItem._id,
        assetTag:     tag,
        serialNumber: `SN-RPi4-${2024000 + i}`,
        locationId:   loc1._id,
        condition:    'good',
        status:       'available',
      });
      assets.push(a);
    }

    // 5 Laptops: LP-001 to LP-005
    const laptopAssets = [];
    for (let i = 1; i <= 5; i++) {
      const a = await Asset.create({
        itemId:       laptopItem._id,
        assetTag:     `LP-${String(i).padStart(3, '0')}`,
        serialNumber: `SN-DELL-${5000 + i}`,
        locationId:   loc3._id,
        condition:    i === 3 ? 'damaged' : 'good',
        status:       'available',
      });
      laptopAssets.push(a);
    }

    console.log('🖥️  Assets created (10 Dev Boards + 5 Laptops)');

    // ── Students ──────────────────────────────────────────────────────────────
    const studentData = [
      { name: 'Aarav Sharma',   enrollmentNo: 'DFIS001', programme: 'M.Sc. DFIS', semester: 1, contact: '9876543210', email: 'aarav@dfis.edu',   username: 'dfis001', password: 'student123' },
      { name: 'Priya Patel',    enrollmentNo: 'DFIS002', programme: 'M.Sc. DFIS', semester: 1, contact: '9876543211', email: 'priya@dfis.edu',   username: 'dfis002', password: 'student123' },
      { name: 'Rahul Verma',    enrollmentNo: 'DFIS003', programme: 'M.Sc. DFIS', semester: 1, contact: '9876543212', email: 'rahul@dfis.edu',   username: 'dfis003', password: 'student123' },
      { name: 'Sneha Gupta',    enrollmentNo: 'DFIS004', programme: 'M.Sc. DFIS', semester: 1, contact: '9876543213', email: 'sneha@dfis.edu',   username: 'dfis004', password: 'student123' },
      { name: 'Karan Mehta',    enrollmentNo: 'DFIS005', programme: 'M.Sc. DFIS', semester: 1, contact: '9876543214', email: 'karan@dfis.edu',   username: 'dfis005', password: 'student123' },
    ];

    const students = [];
    for (const sd of studentData) {
      const student = await Student.create({
        name: sd.name, enrollmentNo: sd.enrollmentNo,
        programme: sd.programme, semester: sd.semester,
        contact: sd.contact, email: sd.email,
      });
      const user = await User.create({
        username:  sd.username,
        password:  sd.password,
        role:      'student',
        name:      sd.name,
        studentId: student._id,
      });
      student.userId = user._id;
      await student.save();
      students.push(student);
    }
    console.log('🎓 5 Students created (DFIS001–DFIS005 / student123)');

    // ── Transactions ──────────────────────────────────────────────────────────

    // Transaction 1 (OVERDUE): DFIS001 — DB-001 + 2 USB Cables
    // Issue: 25 Sep 2026 → Due: 10 Oct 2026 → OVERDUE (today is 13 Oct)
    const t1IssueDate = new Date('2026-09-25');
    const t1DueDate   = addDays(t1IssueDate, 15); // 10 Oct

    const t1 = await Transaction.create({
      studentId:     students[0]._id,
      itemId:        boardItem._id,
      assetId:       assets[0]._id,     // DB-001
      issuedQty:     1,
      returnedQty:   0,
      outstandingQty: 1,
      purpose:       'M.Sc. DFIS Sem 1 — Embedded Systems practical project',
      issueDate:     t1IssueDate,
      dueDate:       t1DueDate,
      issuingStaff:  coordinator._id,
      status:        'overdue',
    });
    // Mark DB-001 as issued
    assets[0].status = 'issued';
    await assets[0].save();

    // Cable transaction for same student (overdue)
    const t2 = await Transaction.create({
      studentId:     students[0]._id,
      itemId:        cableItem._id,
      assetId:       null,
      issuedQty:     2,
      returnedQty:   0,
      outstandingQty: 2,
      purpose:       'M.Sc. DFIS Sem 1 — Embedded Systems practical project',
      issueDate:     t1IssueDate,
      dueDate:       t1DueDate,
      issuingStaff:  coordinator._id,
      status:        'overdue',
    });

    // Transaction 2 (ACTIVE, due 16 Oct — 3 days left): DFIS002 — DB-002 + 2 USB Cables
    // Issue: 1 Oct 2026 → Due: 16 Oct 2026 (upcoming)
    const t3IssueDate = new Date('2026-10-01');
    const t3DueDate   = addDays(t3IssueDate, 15); // 16 Oct

    const t3 = await Transaction.create({
      studentId:     students[1]._id,
      itemId:        boardItem._id,
      assetId:       assets[1]._id,     // DB-002
      issuedQty:     1,
      returnedQty:   0,
      outstandingQty: 1,
      purpose:       'Network security lab assignment',
      issueDate:     t3IssueDate,
      dueDate:       t3DueDate,
      issuingStaff:  coordinator._id,
      status:        'active',
    });
    assets[1].status = 'issued';
    await assets[1].save();

    const t4 = await Transaction.create({
      studentId:     students[1]._id,
      itemId:        cableItem._id,
      assetId:       null,
      issuedQty:     2,
      returnedQty:   0,
      outstandingQty: 2,
      purpose:       'Network security lab assignment',
      issueDate:     t3IssueDate,
      dueDate:       t3DueDate,
      issuingStaff:  coordinator._id,
      status:        'active',
    });

    // Transaction 3 (ACTIVE + PENDING RENEWAL): DFIS003 — DB-003
    const t5IssueDate = new Date('2026-10-01');
    const t5DueDate   = addDays(t5IssueDate, 15); // 16 Oct

    const t5 = await Transaction.create({
      studentId:     students[2]._id,
      itemId:        boardItem._id,
      assetId:       assets[2]._id,     // DB-003
      issuedQty:     1,
      returnedQty:   0,
      outstandingQty: 1,
      purpose:       'Final semester project — IoT prototype',
      issueDate:     t5IssueDate,
      dueDate:       t5DueDate,
      issuingStaff:  coordinator._id,
      status:        'active',
      renewalRequests: [{
        requestDate:    new Date('2026-10-13'),
        approvalStatus: 'pending',
      }],
    });
    assets[2].status = 'issued';
    await assets[2].save();

    // Transaction 4 (PARTIALLY RETURNED): DFIS004 — 5 USB Cables, returned 2
    const t6IssueDate = new Date('2026-10-05');
    const t6DueDate   = addDays(t6IssueDate, 15); // 20 Oct

    const t6 = await Transaction.create({
      studentId:     students[3]._id,
      itemId:        cableItem._id,
      assetId:       null,
      issuedQty:     5,
      returnedQty:   2,
      outstandingQty: 3,
      purpose:       'Hardware lab — networking setup',
      issueDate:     t6IssueDate,
      dueDate:       t6DueDate,
      issuingStaff:  coordinator._id,
      status:        'partially_returned',
      returns: [{
        returnDate:        new Date('2026-10-10'),
        qtyReturned:       2,
        conditionOnReturn: 'good',
        receivingStaff:    coordinator._id,
        notes:             'Returned in good condition',
      }],
    });

    // Transaction 5 (RETURNED): DFIS005 — Adapter (fully returned)
    const t7IssueDate = new Date('2026-09-15');
    const t7DueDate   = addDays(t7IssueDate, 15); // 30 Sep

    const t7 = await Transaction.create({
      studentId:     students[4]._id,
      itemId:        adapterItem._id,
      assetId:       null,
      issuedQty:     3,
      returnedQty:   3,
      outstandingQty: 0,
      purpose:       'Laptop setup for programming',
      issueDate:     t7IssueDate,
      dueDate:       t7DueDate,
      issuingStaff:  coordinator._id,
      status:        'returned',
      returns: [{
        returnDate:        new Date('2026-09-28'),
        qtyReturned:       3,
        conditionOnReturn: 'good',
        receivingStaff:    coordinator._id,
        notes:             'All returned in good condition',
      }],
    });

    console.log('📄 Sample transactions created');

    // ── Stock logs ────────────────────────────────────────────────────────────
    await StockLog.create([
      { itemId: boardItem._id,   type: 'new_stock', quantityChange: 10, reason: 'Initial purchase batch 2026',        performedBy: coordinator._id },
      { itemId: cableItem._id,   type: 'new_stock', quantityChange: 20, reason: 'Initial stock — USB cables',         performedBy: coordinator._id },
      { itemId: adapterItem._id, type: 'new_stock', quantityChange: 15, reason: 'Initial stock — USB adapters',       performedBy: coordinator._id },
      { itemId: laptopItem._id,  type: 'new_stock', quantityChange:  5, reason: 'Laptops procured for student use',   performedBy: coordinator._id },
      {
        itemId: laptopItem._id, type: 'condition_change', quantityChange: 1,
        conditionFrom: 'good', conditionTo: 'damaged',
        assetId: laptopAssets[2]._id,
        reason: 'LP-003 screen cracked during lab session', performedBy: coordinator._id,
      },
    ]);
    console.log('📊 Stock logs created');

    console.log('\n✅ ─────────── SEED COMPLETE ───────────');
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   Coordinator: admin / admin123');
    console.log('   Student 1:   dfis001 / student123  (Aarav Sharma — OVERDUE)');
    console.log('   Student 2:   dfis002 / student123  (Priya Patel  — Due 16 Oct)');
    console.log('   Student 3:   dfis003 / student123  (Rahul Verma  — Renewal Pending)');
    console.log('   Student 4:   dfis004 / student123  (Sneha Gupta  — Partial Return)');
    console.log('   Student 5:   dfis005 / student123  (Karan Mehta  — All Returned)');
    console.log('');
    console.log('📦 Items seeded:');
    console.log('   Development Boards (DB-001 to DB-010) — asset-tracked');
    console.log('   USB Cables (qty: 20) — quantity-tracked');
    console.log('   USB Adapters (qty: 15) — quantity-tracked');
    console.log('   Laptops (LP-001 to LP-005) — asset-tracked');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed Error:', err.message);
    process.exit(1);
  }
};

seed();
