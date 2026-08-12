// Bootstraps the system with the one thing that can't be created through
// the API itself: the first admin account (everything else requires an
// authenticated admin to create it — chicken-and-egg problem for the very
// first login).
//
// Run with: npm run seed
// Change ADMIN_EMAIL / ADMIN_PASSWORD via env vars before running in
// production — never leave the printed default password in place.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin account already exists for ${adminEmail} — skipping.`);
  } else {
    const staff = await prisma.staff.create({
      data: {
        employeeId: 'ADMIN-001',
        firstName: 'School',
        lastName: 'Administrator',
        phone: '+2348167367179',
        email: adminEmail,
        role: 'ADMIN',
      },
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        staffId: staff.id,
        mustResetPassword: true,
      },
    });

    console.log('Created first admin account:');
    console.log(`  email:    ${adminEmail}`);
    console.log(`  password: ${adminPassword}`);
    console.log('  (forced password reset on first login — this temp password is single-use)');
  }

  // Optional: a full set of demo accounts (teacher, guardian, student) so
  // every role can be logged into right after setup, without hand-creating
  // records through the UI first. Opt-in and off by default — this is
  // meant for local/dev/demo environments only, never production.
  // Enable with SEED_DEMO_ACCOUNTS=true.
  if (process.env.SEED_DEMO_ACCOUNTS === 'true') {
    await seedDemoAccounts();
  }

  // A minimal starter grading scheme so Exam records have something to
  // reference once Phase 3 (results) is built. Safe to edit/replace later.
  const existingScheme = await prisma.gradingScheme.findUnique({
    where: { name: 'Standard Secondary' },
  });
  if (!existingScheme) {
    await prisma.gradingScheme.create({
      data: {
        name: 'Standard Secondary',
        description: 'Default WAEC-style A1–F9 grading band for JSS/SSS.',
        bands: {
          create: [
            { minScore: 75, maxScore: 100, grade: 'A1', remark: 'Excellent' },
            { minScore: 70, maxScore: 74, grade: 'B2', remark: 'Very Good' },
            { minScore: 65, maxScore: 69, grade: 'B3', remark: 'Good' },
            { minScore: 60, maxScore: 64, grade: 'C4', remark: 'Credit' },
            { minScore: 55, maxScore: 59, grade: 'C5', remark: 'Credit' },
            { minScore: 50, maxScore: 54, grade: 'C6', remark: 'Credit' },
            { minScore: 45, maxScore: 49, grade: 'D7', remark: 'Pass' },
            { minScore: 40, maxScore: 44, grade: 'E8', remark: 'Pass' },
            { minScore: 0, maxScore: 39, grade: 'F9', remark: 'Fail' },
          ],
        },
      },
    });
    console.log('Created default grading scheme: Standard Secondary');
  }

  // Nigerian university 5-point CGPA grading (A=5.0 ... F=0.0) - the scale
  // used by NUC-accredited universities (UNILAG, UI, OAU, ABU, etc.). GPA
  // points aren't stored as their own column (GradingBand only has
  // grade/remark), so they're folded into the remark text instead.
  const existingUniScheme = await prisma.gradingScheme.findUnique({
    where: { name: 'Nigerian University (5-Point CGPA)' },
  });
  if (!existingUniScheme) {
    await prisma.gradingScheme.create({
      data: {
        name: 'Nigerian University (5-Point CGPA)',
        description: 'Standard Nigerian university grading scale, as used for CGPA calculation.',
        bands: {
          create: [
            { minScore: 70, maxScore: 100, grade: 'A', remark: 'Excellent (5.0)' },
            { minScore: 60, maxScore: 69, grade: 'B', remark: 'Very Good (4.0)' },
            { minScore: 50, maxScore: 59, grade: 'C', remark: 'Good (3.0)' },
            { minScore: 45, maxScore: 49, grade: 'D', remark: 'Fair (2.0)' },
            { minScore: 40, maxScore: 44, grade: 'E', remark: 'Pass (1.0)' },
            { minScore: 0, maxScore: 39, grade: 'F', remark: 'Fail (0.0)' },
          ],
        },
      },
    });
    console.log('Created default grading scheme: Nigerian University (5-Point CGPA)');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Creates one demo Teacher, one demo Guardian, and one demo Student (linked
// to the guardian, with a portal account of its own) — every login role
// covered by a fixed, printed set of credentials. All demo phone numbers
// and emails are namespaced (`demo.*`) so they're easy to spot and clean
// up later, and every step is guarded with a findUnique/skip so re-running
// the seed is always safe.
async function seedDemoAccounts() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'DemoPass123!';
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  // A class for the demo student to belong to — reuses one if it already
  // exists (e.g. created for real use) instead of creating a duplicate.
  let demoClass = await prisma.class.findUnique({ where: { name: 'JSS1' } });
  if (!demoClass) {
    demoClass = await prisma.class.create({
      data: { name: 'JSS1', level: 'JUNIOR_SECONDARY', sortOrder: 4 },
    });
    console.log('Created demo class: JSS1');
  }

  // Teacher
  const teacherEmail = 'demo.teacher@example.com';
  const existingTeacherUser = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!existingTeacherUser) {
    const teacher = await prisma.staff.create({
      data: {
        employeeId: 'DEMO-TEACH-001',
        firstName: 'Demo',
        lastName: 'Teacher',
        phone: '+2348160000001',
        email: teacherEmail,
        role: 'TEACHER',
        staffClasses: { create: [{ classId: demoClass.id }] },
      },
    });
    await prisma.user.create({
      data: {
        email: teacherEmail,
        passwordHash,
        role: 'TEACHER',
        staffId: teacher.id,
        mustResetPassword: true,
      },
    });
    console.log('Created demo teacher account.');
  } else {
    console.log('Demo teacher already exists — skipping.');
  }

  // Guardian
  const guardianEmail = 'demo.guardian@example.com';
  let guardian = await prisma.guardian.findUnique({ where: { email: guardianEmail } });
  let guardianUserCreated = false;
  if (!guardian) {
    guardian = await prisma.guardian.create({
      data: {
        firstName: 'Demo',
        lastName: 'Guardian',
        phone: '+2348160000002',
        email: guardianEmail,
      },
    });
  }
  const existingGuardianUser = await prisma.user.findUnique({ where: { guardianId: guardian.id } });
  if (!existingGuardianUser) {
    await prisma.user.create({
      data: {
        email: guardianEmail,
        passwordHash,
        role: 'GUARDIAN',
        guardianId: guardian.id,
        mustResetPassword: true,
      },
    });
    guardianUserCreated = true;
    console.log('Created demo guardian account.');
  } else {
    console.log('Demo guardian already exists — skipping.');
  }

  // Student — linked to the demo guardian, with its own portal account
  // using the same synthetic-email pattern as the real provision-account
  // route (see routes/students.routes.js).
  const admissionNumber = 'DEMO-STU-001';
  let student = await prisma.student.findUnique({ where: { admissionNumber } });
  if (!student) {
    student = await prisma.student.create({
      data: {
        admissionNumber,
        firstName: 'Demo',
        lastName: 'Student',
        dateOfBirth: new Date('2012-01-01'),
        gender: 'MALE',
        status: 'ACTIVE',
        currentClassId: demoClass.id,
      },
    });
    await prisma.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: 'GUARDIAN',
        isPrimary: true,
      },
    });
    console.log('Created demo student record.');
  } else {
    console.log('Demo student already exists — skipping.');
  }

  const loginDomain = process.env.STUDENT_LOGIN_EMAIL_DOMAIN || 'students.portal.local';
  const studentLoginEmail = `${admissionNumber.toLowerCase()}@${loginDomain}`;
  const existingStudentUser = await prisma.user.findUnique({ where: { studentId: student.id } });
  if (!existingStudentUser) {
    await prisma.user.create({
      data: {
        email: studentLoginEmail,
        passwordHash,
        role: 'STUDENT',
        studentId: student.id,
        mustResetPassword: true,
      },
    });
    console.log('Created demo student portal account.');
  } else {
    console.log('Demo student account already exists — skipping.');
  }

  console.log('');
  console.log('Demo accounts ready (all use the same password unless overridden with SEED_DEMO_PASSWORD):');
  console.log(`  Teacher:  ${teacherEmail} / ${demoPassword}`);
  console.log(`  Guardian: ${guardianEmail} / ${demoPassword}`);
  console.log(`  Student:  ${studentLoginEmail} / ${demoPassword}`);
  console.log('  (all forced to reset password on first login)');
}
