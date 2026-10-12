#!/usr/bin/env node
/**
 * DMA Connect — Admin Provisioning Script
 * ────────────────────────────────────────
 * Usage:
 *   node scripts/create-admin.mjs [email] [password]
 *
 * Arguments (all optional — script prompts if omitted):
 *   email     Email of the admin Firebase Auth account
 *   password  Password to set (min 8 chars) — only used when creating a brand-new account
 *
 * Requirements:
 *   1. Place your Firebase service account JSON at:
 *        scripts/serviceAccountKey.json
 *      Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Node.js ≥ 24 (already required by this project)
 *   3. firebase-admin must be installed:
 *        npm install --save-dev firebase-admin
 *
 * What it does:
 *   ✓ Checks if an admin document already exists in Firestore admins collection
 *   ✓ If admin exists → prints details and exits (does NOT create duplicates)
 *   ✓ If user exists in Auth → uses that account, skips account creation
 *   ✓ If user does not exist → creates a new Firebase Auth account
 *   ✓ Writes admins/{uid} document in Firestore
 *   ✓ Sets Firebase custom token claim { admin: true } for instant rule evaluation
 *
 * Revoke admin:
 *   node scripts/create-admin.mjs --revoke email@example.com
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ─── Colours ──────────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  purple: '\x1b[35m',
};
const ok    = msg => console.log(`${C.green}✔${C.reset}  ${msg}`);
const warn  = msg => console.log(`${C.yellow}⚠${C.reset}  ${msg}`);
const err   = msg => console.log(`${C.red}✖${C.reset}  ${msg}`);
const info  = msg => console.log(`${C.cyan}ℹ${C.reset}  ${msg}`);
const title = msg => console.log(`\n${C.bold}${C.purple}${msg}${C.reset}\n`);
const hr    = ()  => console.log(`${C.dim}${'─'.repeat(55)}${C.reset}`);

// ─── Prompt helper ────────────────────────────────────────────────────────────
async function prompt(question, secret = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    if (secret) process.stdout.write(question);
    rl.question(secret ? '' : question, answer => {
      rl.close();
      if (secret) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

// ─── Load firebase-admin ──────────────────────────────────────────────────────
let admin;
try {
  admin = require('firebase-admin');
} catch {
  err('firebase-admin is not installed.');
  info('Run:  npm install --save-dev firebase-admin');
  process.exit(1);
}

// ─── Load service account ─────────────────────────────────────────────────────
const keyPath = join(__dirname, 'serviceAccountKey.json');
if (!existsSync(keyPath)) {
  err(`Service account key not found at:\n   ${keyPath}`);
  info('Download it from: Firebase Console → Project Settings → Service Accounts');
  info('Then save it as:  scripts/serviceAccountKey.json');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  err('Failed to parse serviceAccountKey.json — make sure it is valid JSON.');
  process.exit(1);
}

// ─── Init Admin SDK ───────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });
}

const auth = admin.auth();
const db   = admin.firestore();
// Use the named Firestore database (dma-connect)
const namedDb = admin.firestore();
namedDb.settings({ databaseId: 'dma-connect' });

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getExistingAdmin() {
  const snapshot = await namedDb.collection('admins').limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

async function getUserByEmail(email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (e) {
    if (e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function createAdminUser(email, password) {
  return auth.createUser({ email, password, emailVerified: false });
}

async function setAdminClaim(uid) {
  await auth.setCustomUserClaims(uid, { admin: true });
}

async function revokeAdminClaim(uid) {
  await auth.setCustomUserClaims(uid, { admin: false });
}

async function writeAdminDocument(uid, email, displayName) {
  await namedDb.collection('admins').doc(uid).set({
    uid,
    email,
    displayName: displayName || null,
    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
    assignedBy: 'cli-script',
  });
}

async function deleteAdminDocument(uid) {
  await namedDb.collection('admins').doc(uid).delete();
}

// ─── Revoke flow ──────────────────────────────────────────────────────────────
async function revokeAdmin(email) {
  title('DMA Connect — Revoke Admin');
  info(`Target: ${C.bold}${email}${C.reset}`);
  hr();

  const user = await getUserByEmail(email);
  if (!user) {
    err(`No Firebase Auth account found for: ${email}`);
    process.exit(1);
  }

  const adminDoc = await namedDb.collection('admins').doc(user.uid).get();
  if (!adminDoc.exists) {
    warn(`User ${email} is not currently an admin.`);
    process.exit(0);
  }

  await deleteAdminDocument(user.uid);
  await revokeAdminClaim(user.uid);

  ok(`Admin privileges revoked for ${C.bold}${email}${C.reset}`);
  info(`UID:  ${user.uid}`);
  info('The user can no longer access the Admin Console.');
  console.log();
}

// ─── Grant flow ───────────────────────────────────────────────────────────────
async function grantAdmin(email, password) {
  title('DMA Connect — Admin Provisioning');

  // 1. Check if any admin already exists
  info('Checking for existing admin...');
  const existingAdmin = await getExistingAdmin();

  if (existingAdmin) {
    hr();
    warn(`${C.bold}An admin already exists.${C.reset} No new admin was created.`);
    hr();
    info(`Email:       ${existingAdmin.email}`);
    info(`UID:         ${existingAdmin.uid}`);
    info(`Assigned At: ${existingAdmin.assignedAt?.toDate?.()?.toLocaleString?.() ?? existingAdmin.assignedAt}`);
    info(`Assigned By: ${existingAdmin.assignedBy}`);
    hr();
    info('To revoke and reassign admin, run:');
    info(`  node scripts/create-admin.mjs --revoke ${existingAdmin.email}`);
    console.log();
    process.exit(0);
  }

  ok('No existing admin found. Proceeding...');

  // 2. Prompt for email if not provided
  if (!email) {
    email = await prompt(`${C.cyan}?${C.reset}  Admin email address: `);
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    err('Invalid email address.');
    process.exit(1);
  }

  // 3. Check if Auth user exists
  hr();
  info(`Looking up Firebase Auth account for: ${C.bold}${email}${C.reset}`);
  let user = await getUserByEmail(email);

  if (user) {
    ok(`Existing account found → ${C.bold}${user.uid}${C.reset}`);
    info('Skipping account creation (using existing account).');
  } else {
    warn('No account found — creating a new Firebase Auth account...');

    if (!password) {
      password = await prompt(`${C.cyan}?${C.reset}  Set password for admin account (min 8 chars): `, true);
    }
    if (!password || password.length < 8) {
      err('Password must be at least 8 characters.');
      process.exit(1);
    }

    user = await createAdminUser(email, password);
    ok(`New Firebase Auth account created → ${C.bold}${user.uid}${C.reset}`);
  }

  // 4. Write admins document
  hr();
  info('Writing admins/{uid} document to Firestore...');
  await writeAdminDocument(user.uid, email, user.displayName);
  ok(`Firestore document created: admins/${user.uid}`);

  // 5. Set custom token claim
  info('Setting custom auth claim { admin: true }...');
  await setAdminClaim(user.uid);
  ok('Custom claim set. All future sign-ins will carry the admin flag.');

  // 6. Also update the presidents profile role if it exists
  const presidentDoc = await namedDb.collection('presidents').doc(user.uid).get();
  if (presidentDoc.exists) {
    await namedDb.collection('presidents').doc(user.uid).update({ role: 'admin' });
    ok(`Updated presidents/${user.uid} profile role → "admin"`);
  } else {
    info('No presidents profile found for this user (that is OK).');
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  hr();
  console.log(`\n${C.bold}${C.green}  Admin setup complete!${C.reset}\n`);
  console.log(`  ${C.bold}Email${C.reset}:        ${email}`);
  console.log(`  ${C.bold}UID${C.reset}:          ${user.uid}`);
  console.log(`  ${C.bold}Firestore${C.reset}:    admins/${user.uid} ✓`);
  console.log(`  ${C.bold}Custom Claim${C.reset}: { admin: true } ✓`);
  console.log();
  console.log(`  ${C.dim}The admin must sign out and sign back in for the`);
  console.log(`  custom claim to take effect in their active session.${C.reset}`);
  console.log();
  console.log(`  ${C.bold}Deploy Firestore rules to enable admin access:${C.reset}`);
  console.log(`  ${C.dim}npx --yes firebase-tools@latest deploy --only firestore --project dma-connect-foundation${C.reset}`);
  console.log();
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  // Handle --revoke flag
  const revokeIdx = args.indexOf('--revoke');
  if (revokeIdx !== -1) {
    const revokeEmail = args[revokeIdx + 1];
    if (!revokeEmail) {
      err('Provide an email to revoke: node scripts/create-admin.mjs --revoke email@example.com');
      process.exit(1);
    }
    await revokeAdmin(revokeEmail);
    process.exit(0);
  }

  // Grant admin flow
  const [email, password] = args;
  await grantAdmin(email, password);
}

main().catch(e => {
  err(`Unexpected error: ${e.message}`);
  if (e.code) info(`Error code: ${e.code}`);
  process.exit(1);
});
