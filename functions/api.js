const express = require("express");
// const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const serverless = require('serverless-http');

const app = express();
const port = 3000;
const uri =
  "mongodb+srv://quiz:quiz321@quiz.q0dg9lv.mongodb.net/?retryWrites=true&w=majority&appName=quiz";
app.use(
  cors()
  // {
  // origin: 'http://192.168.1.4:5173'
  // }
);
app.use(bodyParser.json());

// const userSchema = new mongoose.Schema({
//     name: String,
//     email: String,
//     password: String,
//     totalScore: { type: Number, default: 0 }
//   });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  totalScore: { type: Number, default: 0 },
  quizHistory: [
    {
      score: { type: Number, default: 0 },
      feedback: {type: String,default:''},
      totalQuiz: { type: Number, default: 0 },
      timeTaken: { type: String },
      vdate: {type: String,default:''} ,
      vtime:  {type: String,default:''} ,
    },
  ],
});

const User = mongoose.model("User", userSchema);

// const quizSchema = new mongoose.Schema({
//   question: String,
//   options: [String],
//   correctOption: Number
// });

// const Quiz = mongoose.model('Quiz', quizSchema);

const leaderboardSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  playerName: {
    type: String,
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

leaderboardSchema.virtual("formattedDate").get(function () {
  return this.date.toDateString();
});

leaderboardSchema.index({ score: -1 });

const Leaderboard = mongoose.model("Leaderboard", leaderboardSchema);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/register", async (req, res) => {
  try {
    console.log(req.body);
    const newName = req.body.name;
    const newEmail = req.body.email;
    // const newPassword = req.body.password;
    const newPassword = await bcrypt.hash(req.body.password, 10);
    // console.log(newName, newEmail, newPassword);
    await mongoose.connect(uri);
    const existingUser = await User.findOne({ email: req.body.email });
    console.log("existing user? ", existingUser === null);
    if (existingUser) {
      console.log("User with this email already exists");
      // return res.status(400).json({ message: 'User with this email already exists' });
      // return res.json({ message: 1 }); //returning 1 if user already exists
      return res.send("1");
    } else {
      await mongoose.connect(uri);

      const newUser = await User.create({
        name: newName,
        email: newEmail,
        password: newPassword,
        totalScore: 0,
      });
      res.status(201).json(newUser);
    }
  } catch (error) {
    // Handle any errors
    console.log(error);

    res.status(400).json({ message: error });
    // res.send('Hello World!');
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log(req.body);
    const newEmail = req.body.email;
    const newPassword = req.body.password;
    // console.log(newName, newEmail, newPassword);
    await mongoose.connect(uri);
    const existingUser = await User.findOne({ email: newEmail });
    console.log("existing user ", existingUser);
    if (existingUser !== null) {
      console.log("User with this email already exists", existingUser);
      // return res.status(400).json({ message: 'User with this email already exists' });
      // return res.json({ message: 1 }); //returning 1 if user already exists
      // return res.send('1');
      const isPasswordValid = await bcrypt.compare(
        req.body.password,
        existingUser.password
      );
      // if(existingUser.password === newPassword){
      if (isPasswordValid) {
        console.log("Login successful:");
        const token = jwt.sign(
          {
            name: existingUser.name,
            email: existingUser.email,
          },
          "wecre8"
        );
        res.status(201).json(token);
      } else {
        console.log("Incorrect Password");
        res.send("2");
      }
    } else {
      res.send("1");
    }
  } catch (error) {
    console.log(error);

    res.status(400).json({ message: error });
    // res.send('Hello World!');
  }
});

app.post("/api/checkToken", async (req, res) => {
  const token = req.headers["x-access-token"];

  try {
    const decoded = jwt.verify(token, "wecre8");
    const email = decoded.email;
    await mongoose.connect(uri);

    const user = await User.findOne({ email: email });

    return res.json({ status: "ok", user: user });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", error: "invalid token" });
  }
});

app.post("/api/quote", async (req, res) => {
  const token = req.headers["x-access-token"];

  try {
    const decoded = jwt.verify(token, "wecre8");
    const email = decoded.email;
    await User.updateOne({ email: email }, { $set: { quote: req.body.quote } });

    return res.json({ status: "ok" });
  } catch (error) {
    console.log(error);
    res.json({ status: "error", error: "invalid token" });
  }
});

// app.post('/addquiz', async (req, res) => {
//   try {
//     const newQuiz = await Quiz.create(req.body);
//     res.status(201).json(newQuiz);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });

// app.post('/quiz', async (req, res) => {
//   try {
//     await mongoose.connect(uri);

//     const quiz = await Quiz.find();
//     res.status(200).json(quiz);
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// });
// leaderboard updation
app.post("/updateLeaderboard", async (req, res) => {
  try {
    const { name, email, score } = req.body;

    // Find the leaderboard entry by email
    await mongoose.connect(uri);

    const leaderboardEntry = await Leaderboard.findOne({ email });

    if (!leaderboardEntry) {
      // If the user does not exist, create a new entry with the provided score
      await Leaderboard.create({ playerName: name, email, score });
      return res
        .status(201)
        .json({ message: "New high score added successfully" });
    }

    // If the user exists, update the high score if the new score is greater
    if (score > leaderboardEntry.score) {
      leaderboardEntry.score = score;
      await leaderboardEntry.save();
      return res
        .status(200)
        .json({ message: "High score updated successfully" });
    }

    // If the new score is not greater, send a message indicating that the score was not updated
    return res.status(200).json({ message: "No new high score to update" });
  } catch (error) {
    console.error("Error updating high score:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    // Fetch leaderboard data from MongoDB
    await mongoose.connect(uri);

    const leaderboardData = await Leaderboard.find().sort({ score: -1 }).exec();

    // Send the leaderboard data as a response
    res.status(200).json(leaderboardData);
  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/updateQuizHistory", async (req, res) => {
  try {
    const { email, score, feedback, totalQuiz, timeTaken, ddate, dtime } =
      req.body;
    await mongoose.connect(uri);

    console.log("ddate", typeof(ddate), "dtime", dtime);

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Append current quiz history to user's quizHistory
    user.quizHistory.push({ score ,feedback,totalQuiz,timeTaken,vdate:ddate,vtime:dtime });

    // Check if the current score is greater than the previous total score
    if (score > user.totalScore) {
      // Update the total score to the current score
      user.totalScore = score;
    }

    // Save the updated user data
    await user.save();

    res.status(200).json({ message: "Quiz history updated successfully" });
  } catch (error) {
    console.error("Error updating quiz history:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports.handler = serverless(app);
