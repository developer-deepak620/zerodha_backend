require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");

const { isLoggedIn } = require("./middleware");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const passport = require("passport");
const LocalStrategy = require("passport-local");

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://zerodha-frontend-chi-inky.vercel.app",
  "https://zerodha-dashboard-gules-kappa.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false); // ⚠️ important (no crash)
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");

const db_url = process.env.MONGO_URL;
const port = process.env.PORT || 9876;

if (!db_url) {
  console.log("MONGO_URL missing");
  process.exit(1);
}

mongoose.connect(db_url)
  .then(() => console.log("Connected to DB"))
  .catch((err) => console.log(err));

// ---------------- SESSION ----------------
app.set("trust proxy", 1); // 🔥 IMPORTANT for Render HTTPS

const sessionOptions = {
  store: MongoStore.create({
    mongoUrl: db_url,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
  }),
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,   
    sameSite: "none", 
  },
};

app.use(session(sessionOptions));

// ---------------- PASSPORT ----------------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(UserModel.authenticate()));
passport.serializeUser(UserModel.serializeUser());
passport.deserializeUser(UserModel.deserializeUser());


// SIGNUP
app.post("/signup", async (req, res, next) => {
  try {
    let { username, email, password } = req.body;

    let newUser = new UserModel({ username, email });
    let registeredUser = await UserModel.register(newUser, password);

    req.login(registeredUser, (err) => {
      if (err) return next(err);
      res.json({ success: true, user: registeredUser });
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// LOGIN
app.post("/login", passport.authenticate("local"), (req, res) => {
  res.json({ success: true });
});

// LOGOUT
app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Logged out" });
    });
  });
});

// CHECK AUTH
app.get("/check", (req, res) => {
  res.json({
    loggedIn: req.isAuthenticated(),
    user: req.user || null,
  });
});

// PROTECTED ROUTES
app.get("/allHoldings", isLoggedIn, async (req, res) => {
  let data = await HoldingsModel.find({});
  res.json(data);
});

app.get("/allPositions", isLoggedIn, async (req, res) => {
  let data = await PositionsModel.find({});
  res.json(data);
});

app.post("/newOrder", isLoggedIn, async (req, res) => {
  let order = new OrdersModel(req.body);
  await order.save();
  res.json({ success: true });
});

app.get("/allOrders", isLoggedIn, async (req, res) => {
  let data = await OrdersModel.find({});
  res.json(data);
});

app.listen(port, "0.0.0.0", () =>
  console.log(`Server running on ${port}`)
);