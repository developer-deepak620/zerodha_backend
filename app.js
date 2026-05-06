require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

const { isLoggedIn } = require("./middleware");
const session = require("express-session");
const MongoStore = require("connect-mongo");
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
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

app.options("*", cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { HoldingsModel } = require("./model/HoldingsModel");
const { PositionsModel } = require("./model/PositionsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");

const db_url = process.env.MONGO_URL;
const port = process.env.PORT || 9876;

// mongoDB connect
main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(db_url);
}


const sessionOptions = {
  store: MongoStore.create({
    mongoUrl: db_url,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    touchAfter: 24 * 3600,
  }),
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};
app.use(session(sessionOptions));

// Passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(UserModel.authenticate()));

passport.serializeUser(UserModel.serializeUser());
passport.deserializeUser(UserModel.deserializeUser());


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

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.send("Logged in");
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("https://zerodha-frontend-chi-inky.vercel.app/signup");
    });
  });
});

app.get("/me", (req, res) => {
  if (req.isAuthenticated()) {
    return res.json({ user: req.user });
  } else {
    return res.status(401).json({ user: null });
  }
});


app.get("/check", (req, res) => {
  res.json({
    loggedIn: req.isAuthenticated(),
    user: req.user || null,
  });
});

// today end

app.get("/allHoldings", isLoggedIn, async (req, res) => {
  let allHoldings = await HoldingsModel.find({});
  res.json(allHoldings);
});

app.get("/allPositions", isLoggedIn, async (req, res) => {
  let allPositions = await PositionsModel.find({});
  res.json(allPositions);
});

app.post("/newOrder", isLoggedIn, async (req, res) => {
  let newOrder = new OrdersModel({
    name: req.body.name,
    qty: req.body.qty,
    price: req.body.price,
    mode: req.body.mode,
  });

  newOrder.save();

  res.send("Order saved");
});

app.get("/allOrders", isLoggedIn, async (req, res) => {
  let allOrders = await OrdersModel.find({});
  res.json(allOrders);
});

app.listen(port, () => console.log(`app started at port no ${port}`));
