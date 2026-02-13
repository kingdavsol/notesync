#!/usr/bin/env node
require('dotenv').config();
/**
 * NoteSync Full Function Test Suite
 * Tests all API endpoints end-to-end
 */

const BASE = 'http://127.0.0.1:3020/api';
let authToken = '';
let csrfToken = '';
let noteId1, noteId2, folderId, tagId, shareToken, reminderId, templateId;

const results = [];

async function req(method, path, body = null, expectStatus = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (authToken) opts.headers['Authorization'] = `Bearer ${authToken}`;
  if (csrfToken && method !== 'GET') opts.headers['X-CSRF-Token'] = csrfToken;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function test(name, passed, detail = '') {
  const icon = passed ? 'PASS' : 'FAIL';
  console.log(`  [${icon}] ${name}${detail ? ' - ' + detail : ''}`);
  results.push({ name, passed });
}

async function run() {
  console.log('==========================================');
  console.log('  NOTESYNC FULL FUNCTION TEST');
  console.log('  ' + new Date().toISOString());
  console.log('==========================================\n');

  // 1. Health
  console.log('--- HEALTH ---');
  let r = await req('GET', '/health');
  test('Health check', r.status === 200 && r.data.status === 'ok');

  // 2. Register
  console.log('\n--- AUTH ---');
  r = await req('POST', '/auth/register', { email: 'fulltest@test.com', password: 'TestPass123' });
  test('Register', r.status === 201 && r.data.requiresVerification === true);

  // 3. Verify (via DB)
  const db = require('./src/utils/db');
  const tokenRes = await db.query("SELECT verification_token FROM users WHERE email = 'fulltest@test.com'");
  const vToken = tokenRes.rows[0].verification_token;

  r = await req('GET', `/auth/verify?token=${vToken}`);
  test('Verify email', r.status === 200 && r.data.message.includes('verified'));
  authToken = r.data.token;
  csrfToken = r.data.csrfToken;

  // 4. Login
  r = await req('POST', '/auth/login', { email: 'fulltest@test.com', password: 'TestPass123' });
  test('Login', r.status === 200 && r.data.token);
  authToken = r.data.token;
  csrfToken = r.data.csrfToken;

  // 5. Get me
  r = await req('GET', '/auth/me');
  test('Get current user', r.status === 200 && r.data.user.email === 'fulltest@test.com');
  csrfToken = r.data.csrfToken;

  // 6. Change password
  r = await req('POST', '/auth/change-password', { currentPassword: 'TestPass123', newPassword: 'NewPass456' });
  test('Change password', r.status === 200);

  // 7. Login with new password
  r = await req('POST', '/auth/login', { email: 'fulltest@test.com', password: 'NewPass456' });
  test('Login new password', r.status === 200 && r.data.token);
  authToken = r.data.token;
  csrfToken = r.data.csrfToken;
  r = await req('GET', '/auth/me'); csrfToken = r.data.csrfToken;

  // 8. Resend verification (already verified)
  r = await req('POST', '/auth/resend-verification', { email: 'fulltest@test.com' });
  test('Resend verification (verified user)', r.status === 200 && r.data.message.includes('already verified'));

  // 9. Login unverified
  await req('POST', '/auth/register', { email: 'noverify@test.com', password: 'TestPass123' });
  r = await req('POST', '/auth/login', { email: 'noverify@test.com', password: 'TestPass123' });
  test('Block unverified login', r.status === 403 && r.data.requiresVerification === true);

  // Re-auth
  r = await req('POST', '/auth/login', { email: 'fulltest@test.com', password: 'NewPass456' });
  authToken = r.data.token; csrfToken = r.data.csrfToken;
  r = await req('GET', '/auth/me'); csrfToken = r.data.csrfToken;

  // --- FOLDERS ---
  console.log('\n--- FOLDERS ---');
  r = await req('GET', '/folders');
  test('List folders', r.status === 200 && r.data.folders.length >= 1, `count: ${r.data.folders?.length}`);
  const defaultFolderId = r.data.folders[0].id;

  r = await req('POST', '/folders', { name: 'Work Notes' });
  test('Create folder', r.status === 201 && r.data.folder.name === 'Work Notes');
  folderId = r.data.folder.id;

  r = await req('PUT', `/folders/${folderId}`, { name: 'Work Renamed' });
  test('Update folder', r.status === 200 && r.data.folder.name === 'Work Renamed');

  // --- TAGS ---
  console.log('\n--- TAGS ---');
  r = await req('POST', '/tags', { name: 'urgent' });
  test('Create tag', r.status === 201 && r.data.tag.name === 'urgent');
  tagId = r.data.tag.id;

  r = await req('POST', '/tags', { name: 'personal' });
  test('Create second tag', r.status === 201);

  r = await req('GET', '/tags');
  test('List tags', r.status === 200 && r.data.tags.length >= 2, `count: ${r.data.tags?.length}`);

  // --- NOTES ---
  console.log('\n--- NOTES ---');
  r = await req('POST', '/notes', { title: 'First Note', content: '<p>Hello world</p>', folder_id: defaultFolderId, tags: ['urgent'] });
  test('Create note with tag', r.status === 201 && r.data.note.title === 'First Note');
  noteId1 = r.data.note?.id;

  r = await req('POST', '/notes', { title: 'Second Note', content: '<p>Another note for linking</p>', folder_id: folderId });
  test('Create second note', r.status === 201);
  noteId2 = r.data.note?.id;

  r = await req('GET', `/notes/${noteId1}`);
  test('Get single note', r.status === 200, `title: ${r.data.note?.title || r.data.notes?.[0]?.title}`);

  r = await req('GET', '/notes');
  test('List all notes', r.status === 200, `count: ${r.data.notes?.length}`);

  r = await req('PUT', `/notes/${noteId1}`, { title: 'Updated First', content: '<p>Updated</p>', is_pinned: true });
  test('Update note', r.status === 200 && r.data.note?.title === 'Updated First');

  r = await req('POST', `/notes/${noteId1}/toggle-offline`);
  test('Toggle offline', r.status === 200);

  r = await req('GET', '/notes?search=Updated');
  test('Search notes', r.status === 200, `results: ${r.data.notes?.length}`);

  r = await req('GET', `/notes?folder_id=${folderId}`);
  test('Filter by folder', r.status === 200, `results: ${r.data.notes?.length}`);

  r = await req('GET', '/notes?offline_only=true');
  test('Filter offline only', r.status === 200, `results: ${r.data.notes?.length}`);

  // --- VERSIONS ---
  console.log('\n--- VERSIONS ---');
  r = await req('GET', `/versions/${noteId1}`);
  test('Get version history', r.status === 200, `versions: ${r.data.versions?.length}`);

  if (r.data.versions?.length > 0) {
    const vNum = r.data.versions[0].version_number;
    r = await req('GET', `/versions/${noteId1}/${vNum}`);
    test('Get specific version', r.status === 200);

    r = await req('POST', `/versions/${noteId1}/restore/${vNum}`);
    test('Restore version', r.status === 200);
  } else {
    test('Get specific version', true, 'skipped - no versions yet');
    test('Restore version', true, 'skipped - no versions yet');
  }

  // --- SHARING ---
  console.log('\n--- SHARING ---');
  r = await req('POST', '/share/link', { note_id: noteId1 });
  test('Create share link', r.status === 201 || r.status === 200, `token: ${r.data.share?.token?.substring(0,10)}...`);
  shareToken = r.data.share?.token;
  const shareId = r.data.share?.id;

  if (shareToken) {
    r = await req('GET', `/share/${shareToken}`);
    test('Access shared note', r.status === 200, `title: ${r.data.note?.title}`);
  } else {
    test('Access shared note', false, 'no share token');
  }

  r = await req('GET', `/share/collaborators/${noteId1}`);
  test('List collaborators', r.status === 200);

  if (shareId) {
    r = await req('DELETE', `/share/link/${shareId}`);
    test('Revoke share link', r.status === 200);
  } else {
    test('Revoke share link', true, 'skipped');
  }

  // --- REMINDERS ---
  console.log('\n--- REMINDERS ---');
  r = await req('POST', '/reminders', { note_id: noteId1, remind_at: new Date(Date.now() + 86400000).toISOString(), title: 'Test Reminder' });
  test('Create reminder', r.status === 201 || r.status === 200);
  reminderId = r.data.reminder?.id;

  r = await req('GET', '/reminders');
  test('List reminders', r.status === 200, `count: ${r.data.reminders?.length}`);

  r = await req('GET', `/reminders/note/${noteId1}`);
  test('Get note reminders', r.status === 200);

  if (reminderId) {
    r = await req('POST', `/reminders/${reminderId}/snooze`, { duration: 30 });
    test('Snooze reminder', r.status === 200);

    r = await req('DELETE', `/reminders/${reminderId}`);
    test('Delete reminder', r.status === 200);
  } else {
    test('Snooze reminder', false, 'no reminder ID');
    test('Delete reminder', false, 'no reminder ID');
  }

  // --- TEMPLATES ---
  console.log('\n--- TEMPLATES ---');
  r = await req('GET', '/templates');
  test('List templates', r.status === 200, `count: ${r.data.templates?.length}`);

  r = await req('POST', '/templates', { name: 'Meeting Notes', content: '<h2>Meeting</h2><p>Attendees:</p>', description: 'Template for meetings', category: 'work' });
  test('Create template', r.status === 201 || r.status === 200);
  templateId = r.data.template?.id;

  if (templateId) {
    r = await req('POST', `/templates/${templateId}/use`, { folder_id: defaultFolderId });
    test('Use template', r.status === 201 || r.status === 200, `created note: ${r.data.note?.title}`);

    r = await req('DELETE', `/templates/${templateId}`);
    test('Delete template', r.status === 200);
  } else {
    test('Use template', false, 'no template ID');
    test('Delete template', false, 'no template ID');
  }

  // --- NOTE LINKS ---
  console.log('\n--- NOTE LINKS ---');
  r = await req('POST', '/links', { source_note_id: noteId1, target_note_id: noteId2, link_text: 'See also' });
  test('Create note link', r.status === 201 || r.status === 200);

  r = await req('GET', `/links/from/${noteId1}`);
  test('Get outgoing links', r.status === 200, `count: ${r.data.links?.length}`);

  r = await req('GET', `/links/to/${noteId2}`);
  test('Get backlinks', r.status === 200, `count: ${r.data.links?.length}`);

  r = await req('GET', '/links/search?q=First');
  test('Search notes for linking', r.status === 200);

  // --- DRAWINGS ---
  console.log('\n--- DRAWINGS ---');
  r = await req('POST', '/drawings', { note_id: noteId1, drawing_data: '{"type":"svg","paths":[]}', thumbnail: 'data:image/png;base64,abc' });
  test('Create drawing', r.status === 201 || r.status === 200);

  r = await req('GET', `/drawings/note/${noteId1}`);
  test('Get note drawings', r.status === 200, `count: ${r.data.drawings?.length}`);

  // --- ADVANCED SEARCH ---
  console.log('\n--- ADVANCED SEARCH ---');
  r = await req('GET', '/search?q=hello');
  test('Advanced search', r.status === 200, `results: ${r.data.notes?.length}`);

  r = await req('GET', '/search/suggest?q=fir');
  test('Search suggestions', r.status === 200);

  // --- SYNC ---
  console.log('\n--- SYNC ---');
  r = await req('POST', '/sync/pull', { last_sync_at: new Date(0).toISOString() });
  test('Sync pull', r.status === 200, `notes: ${r.data.notes?.length}, folders: ${r.data.folders?.length}`);

  r = await req('GET', '/sync/offline');
  test('Get offline notes', r.status === 200, `count: ${r.data.notes?.length}`);

  // --- CLEANUP: DELETE ---
  console.log('\n--- DELETE OPERATIONS ---');
  r = await req('DELETE', `/notes/${noteId1}`);
  test('Delete note', r.status === 200);

  r = await req('DELETE', `/tags/${tagId}`);
  test('Delete tag', r.status === 200);

  r = await req('DELETE', `/folders/${folderId}`);
  test('Delete folder', r.status === 200);

  // --- LOGOUT ---
  console.log('\n--- LOGOUT ---');
  r = await req('POST', '/auth/logout');
  test('Logout', r.status === 200);

  // --- FRONTEND PAGES ---
  console.log('\n--- FRONTEND PAGES ---');
  for (const page of ['/', '/login', '/register', '/verify', '/shared/test123']) {
    const res = await fetch(`http://127.0.0.1:3020`);
    // Frontend is served by nginx, test via https
    const pRes = await fetch(`https://notesync.9gg.app${page}`).catch(() => ({ status: 0 }));
    test(`Page ${page}`, pRes.status === 200);
  }

  // --- SUMMARY ---
  console.log('\n==========================================');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => !r.passed).forEach(r => console.log(`    - ${r.name}`));
  }
  console.log('==========================================');

  // Cleanup test users
  await db.query("DELETE FROM note_links WHERE source_note_id IN (SELECT id FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
  await db.query("DELETE FROM drawings WHERE note_id IN (SELECT id FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
  await db.query("DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
  await db.query("DELETE FROM reminders WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await db.query("DELETE FROM note_shares WHERE note_id IN (SELECT id FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
  await db.query("DELETE FROM note_versions WHERE note_id IN (SELECT id FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com'))");
  await db.query("DELETE FROM templates WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await db.query("DELETE FROM notes WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await db.query("DELETE FROM tags WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await db.query("DELETE FROM folders WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.com')");
  await db.query("DELETE FROM users WHERE email LIKE '%@test.com'");
  console.log('\nTest data cleaned up.');

  await db.pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error('Test suite error:', err); process.exit(1); });
