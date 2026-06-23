"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Clearing database...');
    await prisma.notification.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.document.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.admissionApplication.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.setting.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('Seeding owner account...');
    const hashedPassword = await bcryptjs_1.default.hash('password123', 10);
    const owner = await prisma.user.create({
        data: {
            email: 'owner@hostelhub.com',
            password: hashedPassword,
            name: 'Amil Dev',
            role: 'OWNER',
        },
    });
    console.log('Seeding settings...');
    await prisma.setting.createMany({
        data: [
            { key: 'business_name', value: 'HostelHub Operations', userId: owner.id },
            { key: 'currency', value: 'INR', userId: owner.id },
            { key: 'rent_auto_generate', value: 'true', userId: owner.id },
        ],
    });
    console.log('Seeding branches...');
    const branch1 = await prisma.branch.create({
        data: {
            name: 'Greenwood Residency',
            address: '12, 4th Cross, Koramangala, Bangalore - 560034',
            phone: '9876543210',
            googleMapsLocation: 'https://maps.google.com/?q=Koramangala',
            rentDueDay: 5,
            userId: owner.id,
            status: 'ACTIVE',
        },
    });
    const branch2 = await prisma.branch.create({
        data: {
            name: 'Sunrise Boys Hostel',
            address: '45, Outer Ring Road, Marathahalli, Bangalore - 560103',
            phone: '8765432109',
            googleMapsLocation: 'https://maps.google.com/?q=Marathahalli',
            rentDueDay: 10,
            userId: owner.id,
            status: 'ACTIVE',
        },
    });
    console.log('Seeding rooms...');
    // Greenwood Rooms
    const gwRoom101 = await prisma.room.create({
        data: {
            roomNumber: '101',
            floor: '1st Floor',
            roomType: '2 Share',
            capacity: 2,
            monthlyRent: 6500,
            admissionFee: 1500,
            status: 'AVAILABLE',
            branchId: branch1.id,
        },
    });
    const gwRoom102 = await prisma.room.create({
        data: {
            roomNumber: '102',
            floor: '1st Floor',
            roomType: '3 Share',
            capacity: 3,
            monthlyRent: 5000,
            admissionFee: 1500,
            status: 'PARTIAL',
            branchId: branch1.id,
        },
    });
    const gwRoom103 = await prisma.room.create({
        data: {
            roomNumber: '103',
            floor: '1st Floor',
            roomType: '4 Share',
            capacity: 4,
            monthlyRent: 4000,
            admissionFee: 1500,
            status: 'FULL',
            branchId: branch1.id,
        },
    });
    const gwRoom104 = await prisma.room.create({
        data: {
            roomNumber: '104',
            floor: '1st Floor',
            roomType: '2 Share',
            capacity: 2,
            monthlyRent: 7000,
            admissionFee: 1500,
            status: 'MAINTENANCE',
            branchId: branch1.id,
        },
    });
    // Sunrise Rooms
    const srRoom201 = await prisma.room.create({
        data: {
            roomNumber: '201',
            floor: '2nd Floor',
            roomType: '2 Share',
            capacity: 2,
            monthlyRent: 6000,
            admissionFee: 1200,
            status: 'AVAILABLE',
            branchId: branch2.id,
        },
    });
    const srRoom202 = await prisma.room.create({
        data: {
            roomNumber: '202',
            floor: '2nd Floor',
            roomType: '3 Share',
            capacity: 3,
            monthlyRent: 4500,
            admissionFee: 1200,
            status: 'PARTIAL',
            branchId: branch2.id,
        },
    });
    console.log('Seeding tenants...');
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 5);
    // gwRoom102 has 1 active tenant (Partial)
    const tenant1 = await prisma.tenant.create({
        data: {
            name: 'Adithya Sen',
            phone: '9000000001',
            whatsappNumber: '9000000001',
            address: '14, Hillside Avenue, Kolkata, West Bengal',
            guardianName: 'Amit Sen',
            guardianPhone: '9000000002',
            nearestPoliceStation: 'Kolkata North',
            occupation: 'Software Engineer',
            workLocation: 'Manyata Tech Park, Bangalore',
            joiningDate: new Date('2025-01-10'),
            status: 'ACTIVE',
            profilePhotoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
            roomId: gwRoom102.id,
        },
    });
    // gwRoom103 is full (4 tenants)
    const gwRoom103Tenants = [
        { name: 'Rahul Sharma', phone: '9000000011', work: 'Infosys' },
        { name: 'Siddharth Nair', phone: '9000000012', work: 'Wipro' },
        { name: 'Vijay Kumar', phone: '9000000013', work: 'Accenture' },
        { name: 'Mohammed Ali', phone: '9000000014', work: 'Cognizant' },
    ];
    const tenants103 = [];
    for (let i = 0; i < gwRoom103Tenants.length; i++) {
        const t = gwRoom103Tenants[i];
        const tenant = await prisma.tenant.create({
            data: {
                name: t.name,
                phone: t.phone,
                whatsappNumber: t.phone,
                address: `${12 + i}, Garden Road, Chennai, Tamil Nadu`,
                guardianName: `${t.name.split(' ')[0]} Senior`,
                guardianPhone: '9000000020',
                nearestPoliceStation: 'Chennai Central',
                occupation: 'Analyst',
                workLocation: t.work,
                joiningDate: new Date('2025-03-01'),
                status: 'ACTIVE',
                profilePhotoUrl: `https://images.unsplash.com/photo-${1500000000000 + i * 100000000}?w=150`,
                roomId: gwRoom103.id,
            },
        });
        tenants103.push(tenant);
    }
    // srRoom202 has 1 active tenant (Partial)
    const tenant6 = await prisma.tenant.create({
        data: {
            name: 'Rohan Gupta',
            phone: '9000000021',
            whatsappNumber: '9000000021',
            address: '22, Link Road, Mumbai, Maharashtra',
            guardianName: 'Sanjay Gupta',
            guardianPhone: '9000000022',
            nearestPoliceStation: 'Mumbai Bandra',
            occupation: 'MBA Student',
            workLocation: 'Alliance University, Bangalore',
            joiningDate: new Date('2025-05-15'),
            status: 'ACTIVE',
            profilePhotoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
            roomId: srRoom202.id,
        },
    });
    console.log('Seeding rent payments history...');
    // Adithya (tenant1) has paid last month, but is pending this month
    await prisma.payment.create({
        data: {
            amount: 5000,
            status: 'PAID',
            paymentType: 'RENT',
            dueDate: lastMonth,
            paidDate: lastMonth,
            paymentMethod: 'RAZORPAY',
            transactionId: 'pay_txn_prev_1',
            tenantId: tenant1.id,
            branchId: branch1.id,
        },
    });
    await prisma.payment.create({
        data: {
            amount: 5000,
            status: 'PENDING',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth(), 5),
            tenantId: tenant1.id,
            branchId: branch1.id,
        },
    });
    // Room 103 tenants: 2 paid this month, 1 pending, 1 overdue
    // Tenant 0 paid
    await prisma.payment.create({
        data: {
            amount: 4000,
            status: 'PAID',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth(), 5),
            paidDate: new Date(now.getFullYear(), now.getMonth(), 3),
            paymentMethod: 'RAZORPAY',
            transactionId: 'pay_txn_curr_1',
            tenantId: tenants103[0].id,
            branchId: branch1.id,
        },
    });
    // Tenant 1 paid
    await prisma.payment.create({
        data: {
            amount: 4000,
            status: 'PAID',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth(), 5),
            paidDate: new Date(now.getFullYear(), now.getMonth(), 4),
            paymentMethod: 'CASH',
            tenantId: tenants103[1].id,
            branchId: branch1.id,
        },
    });
    // Tenant 2 pending
    await prisma.payment.create({
        data: {
            amount: 4000,
            status: 'PENDING',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth(), 5),
            tenantId: tenants103[2].id,
            branchId: branch1.id,
        },
    });
    // Tenant 3 overdue
    await prisma.payment.create({
        data: {
            amount: 4000,
            status: 'OVERDUE',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth() - 1, 5), // Due last month, unpaid
            tenantId: tenants103[3].id,
            branchId: branch1.id,
        },
    });
    // Rohan (tenant6) paid this month
    await prisma.payment.create({
        data: {
            amount: 4500,
            status: 'PAID',
            paymentType: 'RENT',
            dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
            paidDate: new Date(now.getFullYear(), now.getMonth(), 8),
            paymentMethod: 'RAZORPAY',
            transactionId: 'pay_txn_curr_2',
            tenantId: tenant6.id,
            branchId: branch2.id,
        },
    });
    console.log('Seeding public admissions applications...');
    await prisma.admissionApplication.create({
        data: {
            name: 'Vikas Sharma',
            phone: '9111111111',
            whatsappNumber: '9111111111',
            address: '77, West Chowk, Jaipur, Rajasthan',
            guardianName: 'Hari Sharma',
            guardianPhone: '9111111112',
            nearestPoliceStation: 'Jaipur North',
            occupation: 'Tech Analyst',
            workLocation: 'Deloitte, Bangalore',
            joiningDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
            preferredRoomType: '2 Share',
            notes: 'Need a quiet room near the corridor',
            branchId: branch1.id,
            status: 'PENDING',
            paymentStatus: 'PAID',
            paymentId: 'pay_adm_mock_1',
        },
    });
    await prisma.admissionApplication.create({
        data: {
            name: 'Sameer Sen',
            phone: '9222222222',
            whatsappNumber: '9222222222',
            address: '4, Lake Road, Bhopal, Madhya Pradesh',
            guardianName: 'Praveen Sen',
            guardianPhone: '9222222223',
            nearestPoliceStation: 'Bhopal Central',
            occupation: 'Developer Internship',
            workLocation: 'Siemens, Bangalore',
            joiningDate: new Date(now.getFullYear(), now.getMonth() + 1, 5),
            preferredRoomType: '3 Share',
            branchId: branch2.id,
            status: 'PENDING',
            paymentStatus: 'PENDING',
        },
    });
    console.log('Seeding notifications...');
    await prisma.notification.createMany({
        data: [
            {
                title: 'New Admission Received',
                message: 'Applicant Vikas Sharma submitted admission fee payment of ₹1500 for Greenwood Residency.',
                type: 'NEW_ADMISSION',
                userId: owner.id,
                isRead: false,
            },
            {
                title: 'Rent Payment Received',
                message: 'Rent of ₹4500 received online from Rohan Gupta (Room 202).',
                type: 'RENT_PAYMENT_RECEIVED',
                userId: owner.id,
                isRead: true,
            },
        ],
    });
    console.log('Database Seeding Complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
