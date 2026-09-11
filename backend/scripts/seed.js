/**
 * Seed script — populates Setu.AI with realistic sample data so the app
 * can be clicked through and tested end-to-end without signing up and
 * filling every screen by hand.
 *
 * Creates:
 *   - 3 MSME owner accounts, each with a live job posting
 *   - 5 worker accounts, each with a verified Skill Credit Score profile
 *   - a couple of applications (worker -> job)
 *   - one trial already in progress
 *
 * All sample accounts use the password:  setu123
 *
 * Usage:
 *   cd backend
 *   node scripts/seed.js            # add sample data (skips rows that already exist)
 *   node scripts/seed.js --reset    # wipe all tables first, then reseed
 */

const bcrypt = require("bcryptjs");
const db = require("../src/db");
const { genId } = require("../src/lib/util");

const PASSWORD = "setu123";

if (process.argv.includes("--reset")) {
  console.log("Resetting tables...");
  db.exec(`
    DELETE FROM trials;
    DELETE FROM applications;
    DELETE FROM jobs;
    DELETE FROM workers;
    DELETE FROM users;
  `);
}

function upsertUser({ username, displayName, role, uiLanguage }) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return;
  db.prepare(
    `INSERT INTO users (id, username, password_hash, display_name, role, ui_language, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(genId("user"), username, bcrypt.hashSync(PASSWORD, 10), displayName, role, uiLanguage, Date.now());
}

function insertWorker(w) {
  const existing = db.prepare("SELECT id FROM workers WHERE name = ? AND trade = ?").get(w.name, w.trade);
  if (existing) return existing.id;
  const id = genId("worker");
  db.prepare(
    `INSERT INTO workers (id, owner_username, name, trade, language, location, transcript, score, level, strengths_json, gaps_json, credential_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    w.owner,
    w.name,
    w.trade,
    w.language,
    w.location,
    w.transcript,
    w.score,
    w.level,
    JSON.stringify(w.strengths),
    JSON.stringify(w.gaps),
    w.credentialSummary,
    Date.now() - w.daysAgo * 86400000
  );
  return id;
}

function insertJob(j) {
  const existing = db.prepare("SELECT id FROM jobs WHERE shop_name = ? AND role = ?").get(j.shopName, j.role);
  if (existing) return existing.id;
  const id = genId("job");
  db.prepare(
    `INSERT INTO jobs (id, posted_by, shop_name, sector, location, wage_band, process_description, role, required_trade, skills_needed_json, steps_json, quiz_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    j.owner,
    j.shopName,
    j.sector,
    j.location,
    j.wageBand,
    j.processDescription,
    j.role,
    j.requiredTrade,
    JSON.stringify(j.skillsNeeded),
    JSON.stringify(j.steps),
    JSON.stringify(j.quizQuestions),
    Date.now() - j.daysAgo * 86400000
  );
  return id;
}

function insertApplication(jobId, worker, shopName) {
  const existing = db
    .prepare("SELECT id FROM applications WHERE job_id = ? AND worker_username = ?")
    .get(jobId, worker.owner);
  if (existing) return;
  db.prepare(
    `INSERT INTO applications (id, job_id, worker_username, worker_name, shop_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'applied', ?)`
  ).run(genId("application"), jobId, worker.owner, worker.name, shopName, Date.now());
}

function insertTrial(jobId, workerId, workerName, shopName) {
  const existing = db.prepare("SELECT id FROM trials WHERE job_id = ? AND worker_id = ?").get(jobId, workerId);
  if (existing) return;
  db.prepare(
    `INSERT INTO trials (id, job_id, worker_id, worker_name, shop_name, status, started_at)
     VALUES (?, ?, ?, ?, ?, 'in_progress', ?)`
  ).run(genId("trial"), jobId, workerId, workerName, shopName, Date.now() - 86400000);
}

// ---- Platform admin account ----
// Admin accounts can only be created here (or directly in the DB) — the
// public /api/auth/signup endpoint only allows "worker" or "msme".
upsertUser({ username: "admin", displayName: "Platform Admin", role: "admin", uiLanguage: "en" });

// ---- MSME owner accounts ----
const msmeOwners = [
  { username: "shantimetal", displayName: "Shanti Metal Works", role: "msme", uiLanguage: "en" },
  { username: "rajgarments", displayName: "Raj Garments Unit", role: "msme", uiLanguage: "hi" },
  { username: "coastalelectric", displayName: "Coastal Electricals", role: "msme", uiLanguage: "ta" },
];
msmeOwners.forEach(upsertUser);

// ---- Worker accounts ----
const workerUsers = [
  { username: "ravi.kumar", displayName: "Ravi Kumar", role: "worker", uiLanguage: "en" },
  { username: "suresh.yadav", displayName: "Suresh Yadav", role: "worker", uiLanguage: "hi" },
  { username: "muthu.raman", displayName: "Muthu Raman", role: "worker", uiLanguage: "ta" },
  { username: "priya.devi", displayName: "Priya Devi", role: "worker", uiLanguage: "en" },
  { username: "anil.mestri", displayName: "Anil Mestri", role: "worker", uiLanguage: "hi" },
];
workerUsers.forEach(upsertUser);

// ---- Verified worker profiles ----
const workers = [
  {
    owner: "ravi.kumar", name: "Ravi Kumar", trade: "Welder", language: "English",
    location: "Coimbatore, TN",
    transcript: "I set the electrode current based on plate thickness, keep a steady arc length, and always check for undercut before moving to the next pass. I clean slag between passes and wear the full face shield and gloves every time.",
    score: 780, level: "Skilled",
    strengths: ["Correct electrode-current matching", "Consistent safety practice", "Clean MS fabrication finish"],
    gaps: ["Limited exposure to stainless/TIG work"],
    credentialSummary: "Demonstrates correct arc-welding safety practice and electrode selection for MS plate work.",
    daysAgo: 6,
  },
  {
    owner: "suresh.yadav", name: "Suresh Yadav", trade: "Plumber", language: "Hindi",
    location: "Lucknow, UP",
    transcript: "Pehle main pipe ki fitting ka size check karta hoon, Teflon tape sahi direction mein lagata hoon, aur connection karne ke baad pressure test karke leak check karta hoon. Safety ke liye main pani ka main valve pehle band karta hoon.",
    score: 780, level: "Skilled",
    strengths: ["Correct sealing technique", "Follows safety sequencing", "Good leak-diagnosis instinct"],
    gaps: ["Less familiar with CPVC solvent welding"],
    credentialSummary: "Follows correct safety sequencing and sealing technique for residential pipe joint repair.",
    daysAgo: 5,
  },
  {
    owner: "muthu.raman", name: "Muthu Raman", trade: "Welder", language: "Tamil",
    location: "Coimbatore, TN",
    transcript: "நான் எலெக்ட்ரோடு கரண்ட்டை தகட்டின் தடிமனைப் பார்த்து செட் செய்வேன், ஆர்க் நீளத்தை நிலையாக வைப்பேன். பாதுகாப்புக்காக முகக்கவசமும் கையுறையும் எப்போதும் அணிவேன். ஒவ்வொரு பாஸுக்குப் பிறகும் ஸ்லாக்கைச் சுத்தம் செய்வேன்.",
    score: 640, level: "Skilled",
    strengths: ["Correct electrode-current matching", "Follows basic safety sequence"],
    gaps: ["Finishing consistency on longer welds", "Not yet tested on stainless"],
    credentialSummary: "Demonstrates correct arc-welding safety practice and electrode selection for MS plate work.",
    daysAgo: 4,
  },
  {
    owner: "priya.devi", name: "Priya Devi", trade: "Tailor / Machine Operator", language: "English",
    location: "Tiruppur, TN",
    transcript: "I check the needle size against the fabric weight before starting, keep thread tension balanced by testing on scrap first, and inspect every tenth piece for skipped stitches. I oil the machine at the start of the shift.",
    score: 710, level: "Skilled",
    strengths: ["Pre-run fabric/needle matching", "Regular in-line quality checks", "Preventive machine maintenance habit"],
    gaps: ["Limited overlock machine experience"],
    credentialSummary: "Demonstrates correct tension-setting and in-line quality checks for garment stitching work.",
    daysAgo: 3,
  },
  {
    owner: "anil.mestri", name: "Anil Mestri", trade: "Mason", language: "Hindi",
    location: "Pune, MH",
    transcript: "Main pehle brick ko paani mein bhigo ke rakhta hoon taaki mortar sahi se bond kare. Har course ke baad spirit level se check karta hoon. Mortar ka ratio 1:6 rakhta hoon normal wall ke liye, aur curing 7 din tak karta hoon.",
    score: 690, level: "Skilled",
    strengths: ["Correct brick-wetting practice", "Uses level checks every course", "Understands mortar ratios and curing"],
    gaps: ["Less experience with RCC shuttering work"],
    credentialSummary: "Demonstrates correct brick-laying sequence, mortar ratio, and curing discipline for load-bearing walls.",
    daysAgo: 2,
  },
];
const workerIds = {};
workers.forEach((w) => {
  workerIds[w.owner] = insertWorker(w);
});

// ---- Job postings ----
const jobs = [
  {
    owner: "shantimetal", shopName: "Shanti Metal Works", sector: "Metal fabrication",
    location: "Coimbatore, TN", wageBand: "₹16,000–20,000/month",
    processDescription: "We need someone to run our MS angle-frame welding line — mostly gate and grill frames, arc welding on 3-6mm MS plate, then grinding the joints smooth before powder coating.",
    role: "MS Fabrication Welder", requiredTrade: "Welder",
    skillsNeeded: ["Arc/MMA welding", "MS fabrication", "Joint grinding", "Workshop safety"],
    steps: [
      { title: "Match electrode to plate", instruction: "Select electrode size and current setting based on the 3-6mm MS plate thickness before striking an arc." },
      { title: "Tack and align frame", instruction: "Tack-weld the angle frame at corners first and check squareness with a set square before running full welds." },
      { title: "Grind joints smooth", instruction: "Grind all welded joints flush so the surface is ready for powder coating with no visible bead." },
      { title: "Safety check-off", instruction: "Confirm face shield, gloves, and ventilation are in place before every welding session." },
    ],
    quizQuestions: [
      { question: "Why do we tack-weld corners before running the full weld?", answer: "To hold the frame square and prevent warping before the final pass." },
      { question: "What do you check before sending a frame to powder coating?", answer: "That all welded joints are ground flush with no visible bead or slag." },
    ],
    daysAgo: 6,
  },
  {
    owner: "rajgarments", shopName: "Raj Garments Unit", sector: "Garment manufacturing",
    location: "Tiruppur, TN", wageBand: "₹12,000–15,000/month",
    processDescription: "Need a machine operator for our stitching line — mostly cotton t-shirt bodies on single-needle machines, need consistent tension and someone who checks their own work for skipped stitches.",
    role: "Stitching Machine Operator", requiredTrade: "Tailor / Machine Operator",
    skillsNeeded: ["Single-needle operation", "Tension setting", "In-line quality check"],
    steps: [
      { title: "Match needle to fabric", instruction: "Pick the correct needle size for cotton jersey fabric before starting the run." },
      { title: "Test tension on scrap", instruction: "Run a short test seam on scrap fabric and adjust thread tension until stitches lie flat with no puckering." },
      { title: "Self-check every 10th piece", instruction: "Inspect every tenth stitched piece for skipped stitches or loose tension before it moves to the next station." },
    ],
    quizQuestions: [
      { question: "Why test on scrap fabric before starting the real run?", answer: "To catch tension problems before they show up on the actual order." },
    ],
    daysAgo: 5,
  },
  {
    owner: "coastalelectric", shopName: "Coastal Electricals", sector: "Electrical contracting",
    location: "Chennai, TN", wageBand: "₹15,000–19,000/month",
    processDescription: "Looking for a helper who can wire residential distribution boards — MCB installation, correct phase/neutral/earth wiring, and basic megger testing before handover.",
    role: "Electrical Wiring Assistant", requiredTrade: "Electrician",
    skillsNeeded: ["MCB wiring", "Earthing practice", "Basic testing"],
    steps: [
      { title: "Confirm supply is isolated", instruction: "Switch off and lock out the main supply before opening any distribution board." },
      { title: "Wire phase, neutral, earth", instruction: "Connect phase, neutral, and earth to the correct MCB terminals, double-checking colour coding." },
      { title: "Megger test before handover", instruction: "Run a basic insulation resistance test and note the reading before closing up the board." },
    ],
    quizQuestions: [
      { question: "What's the first thing you do before opening a distribution board?", answer: "Isolate and lock out the main supply." },
    ],
    daysAgo: 4,
  },
];
const jobIds = {};
jobs.forEach((j) => {
  jobIds[j.owner] = insertJob(j);
});

// ---- Applications: a couple of workers apply to jobs ----
insertApplication(jobIds.rajgarments, workers.find((w) => w.owner === "priya.devi"), "Raj Garments Unit");
insertApplication(jobIds.shantimetal, workers.find((w) => w.owner === "muthu.raman"), "Shanti Metal Works");

// ---- One trial already in progress ----
insertTrial(jobIds.shantimetal, workerIds["ravi.kumar"], "Ravi Kumar", "Shanti Metal Works");

// =====================================================================
// Bulk generator — layers a larger, reproducible synthetic network on top
// of the 5 hand-written "hero" workers and 3 MSMEs above (those stay put,
// since the README walkthrough refers to them by name). This gives the
// Insights dashboard and Skill Passport search enough volume to look like
// a real network instead of a 5-row demo.
//
// Reproducible: a fixed seed means re-running --reset always produces the
// same distribution, so screenshots/demos don't shift between runs.
// =====================================================================

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260911);
const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];
const pickN = (arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  return out;
};

const TRADES = [
  "Welder", "Electrician", "Tailor / Machine Operator", "Mason", "CNC Operator",
  "Fitter", "Plumber", "Carpenter", "Food Processing Operator", "Packaging Operator",
];
const SECTORS = [
  "Textiles & Garments", "Auto Components", "Food Processing", "Electronics Assembly",
  "Furniture & Woodwork", "Metal Fabrication", "Leather & Footwear", "Construction",
];
// 34 cities across 16 states.
const PLACES = [
  ["Chennai", "TN"], ["Coimbatore", "TN"], ["Madurai", "TN"], ["Tiruppur", "TN"], ["Salem", "TN"],
  ["Bengaluru", "KA"], ["Mysuru", "KA"], ["Hubballi", "KA"],
  ["Mumbai", "MH"], ["Pune", "MH"], ["Nagpur", "MH"], ["Nashik", "MH"],
  ["Lucknow", "UP"], ["Kanpur", "UP"], ["Varanasi", "UP"],
  ["New Delhi", "DL"],
  ["Ahmedabad", "GJ"], ["Surat", "GJ"], ["Rajkot", "GJ"],
  ["Kolkata", "WB"],
  ["Hyderabad", "TS"],
  ["Jaipur", "RJ"], ["Jodhpur", "RJ"],
  ["Ludhiana", "PB"], ["Amritsar", "PB"],
  ["Gurugram", "HR"], ["Faridabad", "HR"],
  ["Kochi", "KL"], ["Thiruvananthapuram", "KL"],
  ["Indore", "MP"], ["Bhopal", "MP"],
  ["Patna", "BR"],
  ["Bhubaneswar", "OD"],
  ["Guwahati", "AS"],
];
const STATE_LANGUAGE = {
  TN: "Tamil", KA: "Kannada", MH: "Marathi", UP: "Hindi", DL: "Hindi", GJ: "Gujarati",
  WB: "Bengali", TS: "Telugu", RJ: "Hindi", PB: "Punjabi", HR: "Hindi", KL: "Malayalam",
  MP: "Hindi", BR: "Bhojpuri", OD: "Odia", AS: "Bengali",
};
const FIRST_NAMES = [
  "Arjun", "Vikram", "Suresh", "Ramesh", "Ganesh", "Manoj", "Rajesh", "Sanjay", "Deepak", "Ashok",
  "Vijay", "Anil", "Sunil", "Prakash", "Mahesh", "Ravi", "Kiran", "Naveen", "Arun", "Bharat",
  "Priya", "Lakshmi", "Kavya", "Meena", "Sunita", "Anita", "Geeta", "Radha", "Pooja", "Divya",
  "Shalini", "Nisha", "Rekha", "Kalpana", "Uma", "Farhan", "Imran", "Yusuf", "Zoya", "Fatima",
];
const LAST_NAMES = [
  "Kumar", "Sharma", "Singh", "Reddy", "Rao", "Naidu", "Patel", "Yadav", "Verma", "Gupta",
  "Nair", "Pillai", "Iyer", "Devi", "Mestri", "Raman", "Shetty", "Choudhary", "Mishra", "Das",
  "Mondal", "Bose", "Ghosh", "Khan", "Ansari",
];
const SHOP_PREFIX = ["Sri", "Shree", "Om", "New", "Bharat", "National", "Jai", "Royal", "City", "United", "Ganga", "Modern"];
const SHOP_CORE = [
  "Metal Works", "Garments", "Textiles", "Electricals", "Foods", "Furniture", "Fabricators",
  "Enterprises", "Industries", "Engineering Works", "Plastics", "Leathers", "Constructions", "Traders",
];

const STRENGTH_POOL = [
  "Follows safety sequencing correctly", "Clean, consistent finish", "Good pre-run equipment checks",
  "Catches defects early", "Steady, repeatable technique", "Comfortable working from a verbal SOP",
  "Understands the reason behind each step, not just the steps",
];
const GAP_POOL = [
  "Limited exposure to advanced tooling", "Finishing consistency on longer runs",
  "Less familiar with newer machine variants", "Needs more practice under time pressure",
  "Hasn't yet worked at higher-precision tolerances",
];

function scoreAndLevel() {
  const r = rand();
  if (r < 0.10) return { score: randInt(150, 399), level: "Novice" };
  if (r < 0.45) return { score: randInt(400, 649), level: "Competent" };
  if (r < 0.85) return { score: randInt(650, 799), level: "Skilled" };
  return { score: randInt(800, 900), level: "Master" };
}

// Squaring a uniform draw skews the distribution toward small values, so
// most generated join-dates land in the last ~8 weeks with a long thin
// tail back to 6 months — growth charts trend up instead of looking flat.
function recentDaysAgo(maxDays = 180) {
  return Math.floor(rand() * rand() * maxDays);
}

const usedNames = new Set(workers.map((w) => `${w.name}|${w.trade}`));
const genWorkers = [];
for (let i = 0; i < 46; i++) {
  const trade = pick(TRADES);
  let name;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  } while (usedNames.has(`${name}|${trade}`));
  usedNames.add(`${name}|${trade}`);
  const [city, state] = pick(PLACES);
  const language = STATE_LANGUAGE[state];
  const owner = `w${i}_${name.toLowerCase().replace(/[^a-z]+/g, "")}`;
  const { score, level } = scoreAndLevel();
  upsertUser({ username: owner, displayName: name, role: "worker", uiLanguage: pick(["en", "hi", "ta"]) });
  const w = {
    owner, name, trade, language, location: `${city}, ${state}`,
    transcript: `Describes the ${trade.toLowerCase()} process step by step, including checks before starting and safety practice on the job.`,
    score, level,
    strengths: pickN(STRENGTH_POOL, randInt(2, 3)),
    gaps: pickN(GAP_POOL, randInt(1, 2)),
    credentialSummary: `Verified practical assessment for ${trade} work, graded ${level} (${score}/900).`,
    daysAgo: recentDaysAgo(),
  };
  genWorkers.push(w);
}
const genWorkerIds = {};
genWorkers.forEach((w) => {
  genWorkerIds[w.owner] = insertWorker(w);
});

const genJobs = [];
for (let i = 0; i < 19; i++) {
  const sector = pick(SECTORS);
  const requiredTrade = pick(TRADES);
  const [city, state] = pick(PLACES);
  const shopName = `${pick(SHOP_PREFIX)} ${pick(SHOP_CORE)}`;
  const owner = `m${i}_${shopName.toLowerCase().replace(/[^a-z]+/g, "")}`;
  const wageLow = randInt(10, 22) * 1000;
  const j = {
    owner, shopName, sector, location: `${city}, ${state}`,
    wageBand: `₹${wageLow.toLocaleString("en-IN")}–${(wageLow + 4000).toLocaleString("en-IN")}/month`,
    processDescription: `Day-to-day ${requiredTrade.toLowerCase()} work on the shop floor, following the unit's standard process.`,
    role: `${requiredTrade} — ${sector}`, requiredTrade,
    skillsNeeded: pickN(STRENGTH_POOL, 3),
    steps: [
      { title: "Pre-shift check", instruction: `Confirm tools and materials for ${requiredTrade.toLowerCase()} work are ready before starting.` },
      { title: "Follow the SOP", instruction: "Work through the standard steps for this task in order, checking quality as you go." },
    ],
    quizQuestions: [{ question: "What do you check before starting the shift?", answer: "Tools, materials, and safety gear." }],
    daysAgo: recentDaysAgo(),
  };
  upsertUser({ username: owner, displayName: shopName, role: "msme", uiLanguage: pick(["en", "hi", "ta"]) });
  genJobs.push(j);
}
const genJobIds = {};
genJobs.forEach((j) => {
  genJobIds[j.owner] = insertJob(j);
});

// ---- Applications: 27 more worker -> job applications (29 total with the 2 above) ----
const allGenWorkers = genWorkers;
const allGenJobOwners = Object.keys(genJobIds);
const usedPairs = new Set();
let appsMade = 0;
let guard = 0;
while (appsMade < 27 && guard < 2000) {
  guard++;
  const w = pick(allGenWorkers);
  const jobOwner = pick(allGenJobOwners);
  const jobId = genJobIds[jobOwner];
  const key = `${jobId}|${w.owner}`;
  if (usedPairs.has(key)) continue;
  usedPairs.add(key);
  const job = genJobs.find((j) => j.owner === jobOwner);
  insertApplication(jobId, w, job.shopName);
  appsMade++;
}

// ---- Trials: 4 more in-progress trials (5 total with the one above) ----
let trialsMade = 0;
guard = 0;
const usedTrialPairs = new Set();
while (trialsMade < 4 && guard < 2000) {
  guard++;
  const w = pick(allGenWorkers);
  const jobOwner = pick(allGenJobOwners);
  const key = `${jobOwner}|${w.owner}`;
  if (usedTrialPairs.has(key)) continue;
  usedTrialPairs.add(key);
  const job = genJobs.find((j) => j.owner === jobOwner);
  insertTrial(genJobIds[jobOwner], genWorkerIds[w.owner], w.name, job.shopName);
  trialsMade++;
}

console.log("Seed complete.");
console.log("");
console.log("Sample accounts (password for all: setu123):");
console.log("  Admin:      admin");
console.log("  MSME owners:", msmeOwners.map((u) => u.username).join(", "));
console.log("  Workers:    ", workerUsers.map((u) => u.username).join(", "));
console.log("");
console.log("Try: log in as shantimetal -> My postings -> Run AI match");
console.log("     log in as ravi.kumar -> Skill passport / My resume");
