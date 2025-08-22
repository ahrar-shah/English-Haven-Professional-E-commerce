const express = require("express");
const path = require("path");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files (CSS, JS etc.)
app.use(express.static(path.join(__dirname)));

// EJS setup (your .ejs files are in project root)
app.set("views", __dirname);
app.set("view engine", "ejs");

// Routes
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/portal", (req, res) => {
  res.render("portal");
});

app.get("/admin", (req, res) => {
  res.render("admin");
});

app.get("/quiz", (req, res) => {
  res.render("quiz");
});

app.get("/enroll", (req, res) => {
  res.render("enroll");
});

app.get("/not-enrolled", (req, res) => {
  res.render("not_enrolled");
});

// Export (important for Vercel)
module.exports = app;

// Local dev only
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
