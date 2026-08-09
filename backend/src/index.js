import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import studentsRoutes from './routes/students.routes.js';
import guardiansRoutes from './routes/guardians.routes.js';
import staffRoutes from './routes/staff.routes.js';
import classesRoutes from './routes/classes.routes.js';
import subjectsRoutes from './routes/subjects.routes.js';
import termsRoutes from './routes/terms.routes.js';
import enrollmentsRoutes from './routes/enrollments.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import timetableRoutes from './routes/timetable.routes.js';
import gradingSchemesRoutes from './routes/gradingSchemes.routes.js';
import examsRoutes from './routes/exams.routes.js';
import resultsRoutes from './routes/results.routes.js';
import announcementsRoutes from './routes/announcements.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import feesRoutes from './routes/fees.routes.js';
import aiRoutes from './routes/ai.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import cronRoutes from './routes/cron.routes.js';

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();

// This is a pure JSON API (no HTML/JS ever served), so the CSP is
// deliberately locked down to default-src 'none' — it's defense-in-depth in
// case an error page or misconfigured route ever renders in a browser.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    // The frontend calls this API cross-origin (see FRONTEND_URL/CORS
    // below) — helmet's same-origin default here would block those fetch()
    // responses from being read by the browser.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
  }),
);
// helmet doesn't ship Permissions-Policy (the spec is still in flux) — set
// it directly since this API doesn't use any of these browser features.
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), midi=(), interest-cohort=()',
  );
  next();
});

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }),
);
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/guardians', guardiansRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/academic', termsRoutes); // /api/academic/sessions, /api/academic/terms
app.use('/api/enrollments', enrollmentsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/grading-schemes', gradingSchemesRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/cron', cronRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Nuruddeen SMS backend listening on port ${PORT}`);
});
