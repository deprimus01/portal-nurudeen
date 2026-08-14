import { callGroq } from '../groq.js';
import { prisma } from '../prisma.js';
import { logAction } from '../auditLog.js';
import { FIELD_SLOTS } from './fieldDictionary.js';

// Phase 4, strictly additive and never authoritative (PRD/TRD §3, §18.5):
// this only runs when Phase 1's deterministic synonym matching leaves
// headers unmapped, and its output is just another candidate mapping fed
// into the exact same preview → correction → confirm pipeline every other
// field goes through. It never decides what gets written to
// Student/Guardian on its own, and the system works identically with it
// disabled or unconfigured.

const AI_MAPPING_HOURLY_LIMIT = 10;

const FIELD_DESCRIPTIONS = {
  fullName: 'the student\u2019s full name in one column',
  firstName: 'student\u2019s first/given name',
  lastName: 'student\u2019s last/family name/surname',
  otherNames: 'student\u2019s middle name(s)',
  admissionNumber: 'the student\u2019s serial number \u2014 a number assigned sequentially within their class (not a school-wide code)',
  dateOfBirth: 'student\u2019s date of birth',
  gender: 'student\u2019s gender/sex',
  className: 'the class/form/grade the student is in',
  guardianFullName: 'parent/guardian\u2019s full name in one column',
  guardianFirstName: 'parent/guardian\u2019s first name',
  guardianLastName: 'parent/guardian\u2019s last name',
  guardianPhone: 'parent/guardian\u2019s phone number',
  guardianEmail: 'parent/guardian\u2019s email address',
  guardianRelationship: 'how the guardian relates to the student (father/mother/guardian)',
};

// express-rate-limit's aiRateLimiter (middleware/rateLimit.js) is an
// in-memory, per-process store tied to the request/response cycle — this
// call happens inside background batch processing (processBatch.js),
// detached from any request, so that middleware can't wrap it directly.
// AuditLog already records every AI action across the app; counting this
// batch's own action type within it gives the same "cap paid Groq usage
// per user per hour" effect without new infrastructure. Deliberately a
// smaller budget than the general 30/hr AI limit — imports are
// infrequent and each call already covers every unmapped header in a
// file at once, unlike a chat-style feature.
async function withinHourlyLimit(userId) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: { userId, action: 'import.aiFieldMapping', createdAt: { gte: oneHourAgo } },
  });
  return count < AI_MAPPING_HOURLY_LIMIT;
}

function stripJsonFences(text) {
  return text.replace(/^```json\s*|^```\s*|```\s*$/g, '').trim();
}

// `unmappedHeaders` — raw header strings the synonym dictionary couldn't
// place. `claimedFields` — the Set of field slots already taken by a
// deterministically-matched header, so AI suggestions can't collide with
// a mapping Phase 1 already resolved confidently.
//
// Returns { mapping, used, skippedReason }. `mapping` is always safe to
// merge into the working header→field map as-is: only slots that were
// genuinely unclaimed and genuinely on the known field list are ever
// included, regardless of what the model actually said.
export async function suggestAiFieldMappings({ userId, unmappedHeaders, claimedFields }) {
  if (unmappedHeaders.length === 0) {
    return { mapping: {}, used: false, skippedReason: null };
  }

  const availableSlots = FIELD_SLOTS.filter((slot) => !claimedFields.has(slot));
  if (availableSlots.length === 0) {
    return { mapping: {}, used: false, skippedReason: 'no_available_slots' };
  }

  let allowed;
  try {
    allowed = await withinHourlyLimit(userId);
  } catch {
    allowed = false; // fail closed on the rate-limit check itself — never blocks the import either way
  }
  if (!allowed) {
    return { mapping: {}, used: false, skippedReason: 'rate_limited' };
  }

  const slotList = availableSlots.map((slot) => `- ${slot}: ${FIELD_DESCRIPTIONS[slot]}`).join('\n');
  const systemPrompt = `You map spreadsheet column headers from a Nigerian secondary school's student register to a fixed set of known fields. Available fields:\n${slotList}\n\nRespond with ONLY a single JSON object mapping each given header (copy it exactly as written, as the key) to one of the field names above, or null if it clearly doesn't match any of them well. Do not guess \u2014 if you're not reasonably confident, use null. No markdown fences, no explanation, just the JSON object.`;
  const userPrompt = `Headers: ${JSON.stringify(unmappedHeaders)}`;

  // Every failure mode here (misconfigured key, network, Groq outage,
  // malformed response) falls back to "no AI mapping" rather than
  // failing the import — PRD/TRD §9: "AI mapping failure/timeout: import
  // is never blocked by an AI outage."
  let raw;
  try {
    raw = await callGroq({ systemPrompt, userPrompt, maxTokens: 220 });
  } catch (err) {
    console.error('AI field mapping call failed:', err);
    return { mapping: {}, used: false, skippedReason: 'ai_unavailable' };
  }

  let parsed;
  try {
    parsed = JSON.parse(stripJsonFences(raw));
  } catch {
    return { mapping: {}, used: false, skippedReason: 'invalid_response' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { mapping: {}, used: false, skippedReason: 'invalid_response' };
  }

  const mapping = {};
  const claimed = new Set(claimedFields);
  for (const header of unmappedHeaders) {
    const suggested = parsed[header];
    if (typeof suggested === 'string' && FIELD_SLOTS.includes(suggested) && !claimed.has(suggested)) {
      mapping[header] = suggested;
      claimed.add(suggested);
    }
  }

  if (Object.keys(mapping).length === 0) {
    return { mapping: {}, used: false, skippedReason: 'no_confident_matches' };
  }

  await logAction({
    userId,
    action: 'import.aiFieldMapping',
    entityType: 'ImportBatch',
    metadata: { unmappedHeaders, suggested: mapping },
  });

  return { mapping, used: true, skippedReason: null };
}
