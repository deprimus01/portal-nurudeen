'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle, ChevronLeft, ChevronRight, Loader2, Save, X, ZoomIn, ZoomOut, RotateCcw,
} from 'lucide-react';
import type { ImportRecord, SchoolClass, Guardian } from '../../lib/types';
import { fetchImportSourceImageUrl, correctImportRecord, type ImportRecordCorrection } from '../../lib/studentImportApi';
import { getErrorMessage } from '../../lib/errors';

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  otherNames: 'Other Names',
  dateOfBirth: 'Date of Birth',
  gender: 'Gender',
  classInput: 'Class',
  guardianFirstName: 'Guardian First Name',
  guardianLastName: 'Guardian Last Name',
  guardianPhone: 'Guardian Phone',
  guardianEmail: 'Guardian Email',
  guardianRelationship: 'Relationship',
};

// Fields with a plain text correction. gender and dateOfBirth get their
// own input types below; classInput isn't correctable here at all since
// class selection needs the real class list + id, handled by the full
// RecordEditor — shown read-only in this view with a note to use
// "Correct" for that field instead.
const EDITABLE_TEXT_FIELDS = new Set([
  'firstName', 'lastName', 'otherNames',
  'guardianFirstName', 'guardianLastName', 'guardianPhone', 'guardianEmail',
]);

function confidenceLabel(confidence: number): { text: string; color: string } {
  if (confidence >= 80) return { text: 'High confidence', color: 'var(--success)' };
  if (confidence >= 50) return { text: 'Medium confidence', color: 'var(--warn)' };
  return { text: 'Low confidence — check carefully', color: 'var(--danger)' };
}

function currentValueFor(record: ImportRecord, field: string): string {
  const m = record.mappedData as unknown as Record<string, unknown>;
  const value = m[field];
  return value === null || value === undefined ? '' : String(value);
}

interface SourceVerificationModalProps {
  batchId: string;
  record: ImportRecord;
  classes: SchoolClass[];
  guardianOptions: Guardian[];
  onClose: () => void;
  onSaved: (updated: ImportRecord) => void;
}

export function SourceVerificationModal({ batchId, record, onClose, onSaved }: SourceVerificationModalProps) {
  const boxes = record.fieldBoxes || [];
  const pages = Array.from(new Set(boxes.map((b) => b.page))).sort((a, b) => a - b);

  const [activePage, setActivePage] = useState(pages[0] || 1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(boxes[0]?.field || null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(boxes.map((b) => [b.field, currentValueFor(record, b.field)])),
  );
  // dateOfBirth needs a normalized yyyy-mm-dd for the <input type="date">
  // regardless of what raw text OCR read for it — seeded separately from
  // `values` (which keeps the raw OCR text for display/other fields).
  const [dobValue, setDobValue] = useState<string>(() => {
    const iso = record.mappedData.dateOfBirth;
    return iso ? iso.slice(0, 10) : '';
  });
  const [genderValue, setGenderValue] = useState<string>(record.mappedData.gender || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  // Fetch (and re-fetch on page change) the source image as a blob URL —
  // never a plain <img src> to the API, since that would skip the auth
  // header and the server's ownership check.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setImageLoading(true);
    setImageError(null);
    fetchImportSourceImageUrl(batchId, activePage)
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        objectUrl = url;
        setImageUrl(url);
      })
      .catch((err) => setImageError(getErrorMessage(err, 'Could not load the source image.')))
      .finally(() => { if (!cancelled) setImageLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [batchId, activePage]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [focusedField]);

  const focusedBox = boxes.find((b) => b.field === focusedField) || null;

  // Draws the currently-focused field's region into the canvas, cropped
  // and zoomed. Redraws whenever the image, focused field, zoom, or pan
  // changes — a canvas repaint is cheap enough to just redo from
  // scratch rather than tracking finer-grained dirty state.
  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas || !focusedBox || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasW = canvas.width;
    const canvasH = canvas.height;
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#f4f5f7';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Crop window: the field's bbox expanded with padding for
    // surrounding context, then shrunk by the zoom level and re-centered
    // by the pan offset — all in original-image pixel units.
    const paddingX = focusedBox.bbox.width * 0.6;
    const paddingY = focusedBox.bbox.height * 1.2;
    const baseW = focusedBox.bbox.width + paddingX * 2;
    const baseH = focusedBox.bbox.height + paddingY * 2;
    const cropW = Math.max(20, baseW / zoom);
    const cropH = Math.max(20, baseH / zoom);
    const centerX = focusedBox.bbox.x + focusedBox.bbox.width / 2 + pan.x;
    const centerY = focusedBox.bbox.y + focusedBox.bbox.height / 2 + pan.y;

    const srcX = Math.max(0, Math.min(img.naturalWidth - cropW, centerX - cropW / 2));
    const srcY = Math.max(0, Math.min(img.naturalHeight - cropH, centerY - cropH / 2));
    const srcW = Math.min(cropW, img.naturalWidth - srcX);
    const srcH = Math.min(cropH, img.naturalHeight - srcY);

    // Fit the crop into the canvas while preserving aspect ratio.
    const scale = Math.min(canvasW / srcW, canvasH / srcH);
    const destW = srcW * scale;
    const destH = srcH * scale;
    const destX = (canvasW - destW) / 2;
    const destY = (canvasH - destH) / 2;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, destX, destY, destW, destH);

    // Highlight the exact bbox within the drawn crop.
    const boxDestX = destX + (focusedBox.bbox.x - srcX) * scale;
    const boxDestY = destY + (focusedBox.bbox.y - srcY) * scale;
    const boxDestW = focusedBox.bbox.width * scale;
    const boxDestH = focusedBox.bbox.height * scale;
    ctx.strokeStyle = '#0055FB';
    ctx.lineWidth = 2;
    ctx.strokeRect(boxDestX, boxDestY, boxDestW, boxDestH);
    ctx.fillStyle = 'rgba(0, 85, 251, 0.08)';
    ctx.fillRect(boxDestX, boxDestY, boxDestW, boxDestH);
  }, [imageUrl, focusedBox, zoom, pan]);

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragState.current || !focusedBox) return;
    // Convert screen-pixel drag distance back into original-image pixel
    // units using the same crop-to-canvas scale computed at draw time —
    // approximated here from the current zoom/crop window size.
    const paddingX = focusedBox.bbox.width * 0.6;
    const baseW = focusedBox.bbox.width + paddingX * 2;
    const cropW = Math.max(20, baseW / zoom);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = canvas.width / cropW;
    const dx = (e.clientX - dragState.current.startX) / scale;
    const dy = (e.clientY - dragState.current.startY) / scale;
    setPan({ x: dragState.current.panX - dx, y: dragState.current.panY - dy });
  }
  function handlePointerUp() {
    dragState.current = null;
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const correction: ImportRecordCorrection = {};
      for (const [field, value] of Object.entries(values)) {
        if (EDITABLE_TEXT_FIELDS.has(field)) {
          (correction as Record<string, string>)[field] = value;
        }
      }
      if (boxes.some((b) => b.field === 'dateOfBirth') && dobValue) {
        correction.dateOfBirth = dobValue;
      }
      if (boxes.some((b) => b.field === 'gender') && (genderValue === 'MALE' || genderValue === 'FEMALE')) {
        correction.gender = genderValue;
      }
      const { record: updated } = await correctImportRecord(batchId, record.id, correction);
      onSaved(updated);
      onClose();
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Could not save these corrections.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 56, 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-verification-title"
    >
      <motion.div
        className="card"
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ maxWidth: 900, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h3 id="source-verification-title" style={{ margin: 0, fontSize: '1rem' }}>
            Review Source — Row {record.rowNumber}
          </h3>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          {/* Image / crop viewer */}
          <div style={{ padding: '1rem 1.25rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
            {pages.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.82rem' }}>
                <button type="button" className="btn-ghost" disabled={activePage <= pages[0]} onClick={() => setActivePage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                Page {activePage} of {pages[pages.length - 1]}
                <button type="button" className="btn-ghost" disabled={activePage >= pages[pages.length - 1]} onClick={() => setActivePage((p) => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            <div style={{ position: 'relative', width: '100%', height: 260, borderRadius: 10, overflow: 'hidden', background: '#f4f5f7' }}>
              {imageLoading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={24} className="onboarding-spin" color="var(--muted-2)" />
                </div>
              )}
              {imageError && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
                  {imageError}
                </div>
              )}
              {imageUrl && (
                <>
                  {/* Hidden full-resolution source image — never displayed directly, only drawn cropped into the canvas. */}
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt=""
                    style={{ display: 'none' }}
                    onLoad={() => setZoom((z) => z)} // trigger a redraw once natural dimensions are known
                  />
                  <canvas
                    ref={canvasRef}
                    width={800}
                    height={260}
                    style={{ width: '100%', height: '100%', cursor: focusedBox ? 'grab' : 'default', touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted-2)' }}>Drag to pan, use the buttons to zoom</span>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} aria-label="Zoom out">
                  <ZoomOut size={16} />
                </button>
                <button type="button" className="btn-ghost" onClick={() => setZoom((z) => Math.min(5, z + 0.5))} aria-label="Zoom in">
                  <ZoomIn size={16} />
                </button>
                <button type="button" className="btn-ghost" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="Reset view">
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Field list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem' }}>
            {boxes.map((box) => {
              const conf = confidenceLabel(box.confidence);
              const isFocused = box.field === focusedField;
              const editable = EDITABLE_TEXT_FIELDS.has(box.field);
              return (
                <div
                  key={box.field}
                  onClick={() => setFocusedField(box.field)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.5rem',
                    borderRadius: 8, cursor: 'pointer',
                    background: isFocused ? 'rgba(0, 85, 251, 0.06)' : 'transparent',
                    border: isFocused ? '1px solid rgba(0, 85, 251, 0.3)' : '1px solid transparent',
                    marginBottom: '0.4rem',
                  }}
                >
                  <div style={{ flex: '0 0 110px' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-2)' }}>{FIELD_LABELS[box.field] || box.field}</div>
                    <div style={{ fontSize: '0.72rem', color: conf.color, fontWeight: 600 }}>{conf.text}</div>
                  </div>
                  <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    {box.field === 'gender' ? (
                      <select value={genderValue} onChange={(e) => setGenderValue(e.target.value)} style={{ width: '100%' }}>
                        <option value="" disabled>Select…</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    ) : box.field === 'dateOfBirth' ? (
                      <input type="date" value={dobValue} onChange={(e) => setDobValue(e.target.value)} style={{ width: '100%' }} />
                    ) : editable ? (
                      <input
                        value={values[box.field] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [box.field]: e.target.value }))}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <div style={{ fontSize: '0.88rem', padding: '0.4rem 0' }}>
                        {values[box.field]} <span style={{ color: 'var(--muted-2)', fontSize: '0.78rem' }}>(use &ldquo;Correct&rdquo; to change this field)</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {boxes.length === 0 && (
              <p style={{ color: 'var(--muted-2)', fontSize: '0.85rem' }}>No source regions were recorded for this row.</p>
            )}
          </div>
        </div>

        {saveError && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: 6, alignItems: 'center', padding: '0 1.25rem' }}>
            <AlertCircle size={14} /> {saveError}
          </p>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', padding: '1rem 1.25rem', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={15} className="onboarding-spin" /> : <Save size={15} />}
            {saving ? 'Saving…' : 'Save Corrections'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
