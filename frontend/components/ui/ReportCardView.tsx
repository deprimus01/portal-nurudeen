'use client';

import { motion } from 'framer-motion';
import { Printer } from 'lucide-react';
import type { ReportCard } from '../../lib/types';

const EASE = [0.16, 1, 0.3, 1] as const;

function gradeColor(grade: string | null) {
  if (!grade) return { bg: 'var(--surface-2)', fg: 'var(--muted)' };
  const g = grade.trim().toUpperCase();
  if (g.startsWith('A')) return { bg: 'rgba(201, 151, 74, 0.14)', fg: '#B8863E' };
  if (g.startsWith('B')) return { bg: 'rgba(0, 85, 251, 0.1)', fg: '#0055FB' };
  if (g.startsWith('C')) return { bg: 'rgba(217, 119, 6, 0.1)', fg: '#D97706' };
  return { bg: 'rgba(220, 38, 38, 0.1)', fg: '#DC2626' };
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ReportCardView({ report, allowPrint = true }: { report: ReportCard; allowPrint?: boolean }) {
  return (
    <motion.div
      className="report-wrap"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="report-card" id="report-card-print">
        <div className="report-head">
          <div className="report-school">
            <div className="shell-brand-mark" style={{ width: 44, height: 44, fontSize: 16 }}>NS</div>
            <div>
              <h3 style={{ fontSize: 16 }}>Nuruddeen Schools, Gusau</h3>
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>
                {report.exam.name} · {report.exam.session}, {report.exam.term}
              </p>
            </div>
          </div>
          {allowPrint && (
            <button className="btn btn-outline no-print" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
          <div className="shell-avatar" style={{ width: 52, height: 52, fontSize: 18, borderRadius: 14 }}>
            {initialsFor(report.student.name)}
          </div>
          <div>
            <div style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 700, fontSize: 16 }}>
              {report.student.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {report.exam.class}
            </div>
          </div>
        </div>

        {!report.complete && (
          <p className="error-text" style={{ marginTop: 0 }}>
            Not all subject scores have been entered yet - this report card is incomplete.
          </p>
        )}

        <div className="subject-grid">
          {report.rows.map((r, i) => {
            const c = gradeColor(r.grade);
            return (
              <motion.div
                className="subject-card"
                key={r.subject}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.03, ease: EASE }}
              >
                <div className="sn">{r.subject}</div>
                <div className="grade-row">
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.score ?? '—'}/100</span>
                  <span className="grade-pill" style={{ background: c.bg, color: c.fg }}>{r.grade ?? '—'}</span>
                </div>
                {r.remark && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>{r.remark}</div>}
              </motion.div>
            );
          })}
        </div>

        {report.average !== null && (
          <div className="panel" style={{ background: 'var(--surface-2)', boxShadow: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>Overall average</span>
            <span style={{ fontFamily: "'Lexend', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--gold)' }}>
              {report.average}
            </span>
          </div>
        )}

        {report.comment && (
          <div className="panel" style={{ background: 'var(--surface-2)', boxShadow: 'none' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--muted)' }}>Teacher&apos;s remark</div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{report.comment}</p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, fontSize: 11, color: 'var(--muted)' }}>
          <div>Class teacher&apos;s signature: ______________</div>
          <div>Principal&apos;s signature: ______________</div>
        </div>
      </div>
    </motion.div>
  );
}
