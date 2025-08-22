import express from "express";
import path from "path";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import store from "./lib/store.js";
import multer from "multer";
import fs from "fs";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 5*1024*1024 } });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended:true}));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieSession({
  name:"eh_sess",
  keys:[process.env.SESSION_SECRET || "dev_secret"],
  maxAge: 50*365*24*60*60*1000 // 50 years
}));

// Seed admin
async function ensureAdmin(){
  const users = (await store.get("users")) || [];
  const adminEmail = process.env.ADMIN_EMAIL || "admin@englishhaven.com";
  const adminPass = process.env.ADMIN_PASSWORD || "enghaven(f)";
  const exists = users.find(u=>u.email===adminEmail);
  if (!exists){
    const hash = await bcrypt.hash(adminPass, 10);
    users.push({ id:nanoid(), name:"Admin", email:adminEmail, phone:"", role:"admin", passwordHash:hash });
    await store.set("users", users);
  }
}
ensureAdmin();

// Helpers
function requireAuth(req,res,next){
  if (!req.session.user) return res.redirect("/login?next="+encodeURIComponent(req.path));
  next();
}
function requireAdmin(req,res,next){
  if (!req.session.user || req.session.user.role!=="admin") return res.redirect("/login");
  next();
}

// Home
app.get("/", async (req,res)=>{
  res.render("home", { user:req.session.user });
});

// Auth
app.get("/signup", (req,res)=> res.render("signup", {error:null}));
app.post("/signup", async (req,res)=>{
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.render("signup",{error:"All fields required"});
  const users = (await store.get("users")) || [];
  if (users.find(u=>u.email===email)) return res.render("signup",{error:"Email already exists"});
  const hash = await bcrypt.hash(password, 10);
  const user = { id:nanoid(), name, email, phone: phone||"", role:"student", passwordHash:hash };
  users.push(user);
  await store.set("users", users);
  req.session.user = { id:user.id, name:user.name, email:user.email, role:user.role };
  res.redirect("/enroll");
});

app.get("/login", (req,res)=> res.render("login",{error:null,next:req.query.next||"/portal"}));
app.post("/login", async (req,res)=>{
  const { email, password, next } = req.body;
  const users = (await store.get("users")) || [];
  const user = users.find(u=>u.email===email);
  if (!user) return res.render("login",{error:"Invalid credentials", next: next||"/portal"});
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.render("login",{error:"Invalid credentials", next: next||"/portal"});
  req.session.user = { id:user.id, name:user.name, email:user.email, role:user.role };
  res.redirect(next || "/portal");
});

app.post("/logout", (req,res)=>{
  req.session = null;
  res.redirect("/");
});

// Enroll
app.get("/enroll", requireAuth, async (req,res)=>{
  const batches = (await store.get("batches")) || [];
  res.render("enroll", { user:req.session.user, batches });
});

app.post("/enroll", requireAuth, upload.single("proof"), async (req,res)=>{
  const { batchId, timing, method } = req.body;
  if (!batchId || !timing || !method) return res.send("Missing fields");
  // Save file (fallback: save to /tmp path and store path)
  let proofPath = null;
  if (req.file){
    const outPath = `/tmp/${Date.now()}-${req.file.originalname}`;
    fs.writeFileSync(outPath, req.file.buffer);
    proofPath = outPath;
  }
  const enrollments = (await store.get("enrollments")) || [];
  const exists = enrollments.find(e=>e.userId===req.session.user.id);
  const now = Date.now();
  const record = {
    id:nanoid(),
    userId:req.session.user.id,
    courseId:"english-language",
    batchId,
    timing,
    payment:{ method, proof: proofPath, lastPaidAt: now }
  };
  if (exists){
    // update payment
    exists.payment = { method, proof: proofPath, lastPaidAt: now };
    await store.set("enrollments", enrollments);
  } else {
    enrollments.push(record);
    await store.set("enrollments", enrollments);
  }
  res.redirect("/portal");
});

// Portal
app.get("/portal", requireAuth, async (req,res)=>{
  const user = req.session.user;
  const enrollments = (await store.get("enrollments")) || [];
  const enrollment = enrollments.find(e=>e.userId===user.id);
  if (!enrollment){
    return res.render("not_enrolled", { user });
  }
  const paidLabel = (Date.now() - enrollment.payment.lastPaidAt) > (30*24*60*60*1000) ? "Pending" : "Paid";
  const quizzes = (await store.get("quizzes")) || [];
  const myQuizzes = quizzes.filter(q=>q.batchId===enrollment.batchId);
  res.render("portal", { user, enrollment, paidLabel, quizzes: myQuizzes });
});

// Attendance
app.post("/attendance/mark", requireAuth, async (req,res)=>{
  const user = req.session.user;
  const attendances = (await store.get("attendance")) || [];
  const today = new Date(); today.setHours(0,0,0,0);
  const key = `${user.id}-${today.getTime()}`;
  if (attendances.find(a=>a.key===key)) return res.redirect("/portal");
  attendances.push({ key, userId:user.id, at: Date.now() });
  await store.set("attendance", attendances);
  res.redirect("/portal");
});

// Admin
app.get("/admin", requireAdmin, async (req,res)=>{
  const users = (await store.get("users")) || [];
  const enrollments = (await store.get("enrollments")) || [];
  const batches = (await store.get("batches")) || [];
  const quizzes = (await store.get("quizzes")) || [];
  res.render("admin", { user:req.session.user, users, enrollments, batches, quizzes });
});

app.post("/admin/batch/new", requireAdmin, async (req,res)=>{
  const { name, timeSlot } = req.body;
  if (!name || !timeSlot) return res.redirect("/admin");
  const batches = (await store.get("batches")) || [];
  batches.push({ id:nanoid(), name, timeSlot });
  await store.set("batches", batches);
  res.redirect("/admin");
});

app.post("/admin/quiz/new", requireAdmin, async (req,res)=>{
  const { batchId, title, timeLimit, maxTries, questions } = req.body;
  const quizzes = (await store.get("quizzes")) || [];
  let qList = [];
  try{ qList = JSON.parse(questions || "[]"); } catch(e){ qList = []; }
  quizzes.push({ id:nanoid(), batchId, title, timeLimit: parseInt(timeLimit||"600"), maxTries: parseInt(maxTries||"3"), questions: qList });
  await store.set("quizzes", quizzes);
  res.redirect("/admin");
});

// Quiz routes
app.get("/quiz/:id", requireAuth, async (req,res)=>{
  const quizzes = (await store.get("quizzes")) || [];
  const quiz = quizzes.find(q=>q.id===req.params.id);
  if (!quiz) return res.send("Quiz not found");
  res.render("quiz", { user:req.session.user, quiz });
});

app.post("/quiz/:id/forfeit", requireAuth, async (req,res)=>{
  // Called when tab is switched (front-end blur). We won't overcomplicate; just acknowledge.
  res.json({ ok:true });
});

app.post("/quiz/:id/submit", requireAuth, async (req,res)=>{
  const quizzes = (await store.get("quizzes")) || [];
  const quiz = quizzes.find(q=>q.id===req.params.id);
  if (!quiz) return res.send("Quiz not found");
  // Very basic scoring: expects answers as "q0","q1",...
  let score = 0;
  quiz.questions.forEach((q, idx)=>{
    if ((req.body[`q${idx}`]||"").trim().toLowerCase() === (q.answer||"").trim().toLowerCase()) score++;
  });
  const results = (await store.get("results")) || [];
  results.push({ id:nanoid(), quizId:quiz.id, userId:req.session.user.id, score, at:Date.now() });
  await store.set("results", results);
  res.redirect("/portal");
});

// Utility route to see proof image (local fallback)
app.get("/proof/:userId", requireAdmin, async (req,res)=>{
  const enrollments = (await store.get("enrollments")) || [];
  const e = enrollments.find(x=>x.userId===req.params.userId);
  if (!e || !e.payment || !e.payment.proof) return res.send("No proof uploaded");
  const p = e.payment.proof;
  try{
    const buf = fs.readFileSync(p);
    res.setHeader("Content-Type","image/jpeg");
    res.send(buf);
  }catch(err){
    res.send("Proof not available on this platform. Configure Cloudinary in .env for durable uploads.");
  }
});

// Views for WhatsApp number injection
const WHATSAPP = "+92 322 2694045";

// Start
const port = process.env.PORT || 3000;
app.listen(port, ()=> console.log("English Haven running on http://localhost:"+port));
