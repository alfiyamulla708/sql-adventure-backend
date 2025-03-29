const express = require("express");
// const { MongoClient, ServerApiVersion } = require('mongodb');
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
// Get the client
const mysql = require("mysql2");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config();

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Create the connection to database
const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  port: process.env.MYSQL_PORT,
  connectTimeout: 20000,
});

let socketServer;
const connectedUsers = {};

const app = express();
const port = 3000;
const uri =
  "mongodb+srv://quiz:quiz321@quiz.q0dg9lv.mongodb.net/?retryWrites=true&w=majority&appName=quiz";
app.use(cors());
app.use(bodyParser.json());

// User modal
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  totalScore: { type: Number, default: 0 },
  quizHistory: [
    {
      score: { type: Number, default: 0 },
      feedback: { type: String, default: "" },
      totalQuiz: { type: Number, default: 0 },
      timeTaken: { type: String },
      vdate: { type: String, default: "" },
      vtime: { type: String, default: "" },
    },
  ],
  initialGoogleFormCompleted: {
    type: Boolean,
    default: false,
  },
  finalGoogleFormCompleted: {
    type: Boolean,
    default: false,
  },
});
const User = mongoose.model("User", userSchema);

// Leader modal
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

// Game modal
const gameSchema = new mongoose.Schema(
  {
    userId: String,
    email: String,
    name: String,
    totalTime: String,
    certificate: String,
    feedback: {
      type: [
        {
          levelName: {
            type: String,
            trim: true,
          },
          levelType: {
            type: String,
            trim: true,
          },
          link: {
            type: String,
            trim: true,
          },
          linkType: {
            type: String,
            trim: true,
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const GameModal = mongoose.model("game", gameSchema);

// GameQuestion modal
const gameQuestionSchema = new mongoose.Schema(
  {
    gameId: String,
    level: String,
    questionNo: String,
    questionTime: String,
    attempt: String,
  },
  {
    timestamps: true,
  }
);

const GameQuestionModal = mongoose.model("gameQuestion", gameQuestionSchema);

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
    // await mongoose.connect(uri);
    const existingUser = await User.findOne({ email: req.body.email });
    console.log("existing user? ", existingUser === null);
    if (existingUser) {
      console.log("User with this email already exists");
      // return res.status(400).json({ message: 'User with this email already exists' });
      // return res.json({ message: 1 }); //returning 1 if user already exists
      return res.send("1");
    } else {
      // await mongoose.connect(uri);

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
    // await mongoose.connect(uri);
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

app.post("/getUserData", async (req, res) => {
  try {
    const { email } = req.body;

    const response = await User.findOne({ email }).lean();

    res.status(201).json(response);
  } catch (error) {
    console.log("error: ", error);
  }
});

app.post("/api/checkToken", async (req, res) => {
  const token = req.headers["x-access-token"];

  try {
    const decoded = jwt.verify(token, "wecre8");
    const email = decoded.email;
    // await mongoose.connect(uri);

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

// leaderboard updation
app.post("/updateLeaderboard", async (req, res) => {
  try {
    const { name, email, score } = req.body;

    // Find the leaderboard entry by email
    // await mongoose.connect(uri);

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
    // await mongoose.connect(uri);

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
    // await mongoose.connect(uri);

    console.log("ddate", typeof ddate, "dtime", dtime);

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Append current quiz history to user's quizHistory
    user.quizHistory.push({
      score,
      feedback,
      totalQuiz,
      timeTaken,
      vdate: ddate,
      vtime: dtime,
    });

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

app.post("/executeSqlQuery", async (req, res) => {
  let { query } = req.body;
  console.log(query);

  let response = {};

  // A simple SELECT query
  try {
    connection.query(query.trim(), function (err, results, fields) {
      console.log("results: ", results);
      console.log("Array.isArray(results): ", Array.isArray(results));

      if (results) {
        console.log("Inside results");
        if (Array.isArray(results)) {
          console.log("This is array");
          response["type"] = "array";
          response["data"] = results;
        } else {
          console.log("This is string");
          response["type"] = "string";
          response["data"] = results;
        }
      }

      if (err) {
        response["type"] = "error";
        response["data"] = err.sqlMessage;
      }
      console.log("response: ", response);
      console.log("err: ", err);

      res.status(200).json(response);
    });
  } catch (error) {
    console.log("error: ", error);
  }
});

app.post("/saveGameResult", async (req, res) => {
  try {
    // await mongoose.connect(uri);

    const { userId, email, name, totalTime } = req.body;

    const result = await GameModal.create({
      userId,
      email,
      name,
      totalTime,
    });
    // console.log("result: ", result);

    res.status(201).json(result._id);
  } catch (error) {
    console.log(error);

    res.status(400).json({ message: error });
  }
});

app.post("/saveGameQuestion", async (req, res) => {
  try {
    // await mongoose.connect(uri);

    const { gameId, level, questionNo, questionTime, attempt } = req.body;

    const result = await GameQuestionModal.create({
      gameId,
      level,
      questionNo,
      questionTime,
      attempt,
    });

    res.status(201).json("Question Response Saved");
  } catch (error) {
    console.log(error);

    res.status(400).json({ message: error });
  }
});

app.post("/getGameQuestion", async (req, res) => {
  try {
    // await mongoose.connect(uri);

    const { userId } = req.body;
    console.log("userId: ", userId);

    const result = await GameModal.find({
      userId,
    })
      .sort({ createdAt: -1 })
      .lean();
    console.log("result: ", result);

    res.status(201).json(result);
  } catch (error) {
    console.log(error);

    res.status(400).json({ message: error });
  }
});

// app.post("/generateCertificate", async (req, res) => {
//   const { name, email } = req.body;
//   const newUuid = uuidv4();

//   // Set headers for PDF download
//   res.setHeader("Content-Type", "application/pdf");
//   res.setHeader("Content-Disposition", "attachment; filename=certificate.pdf");

//   // Create the PDF document
//   const doc = new PDFDocument({ size: "A4", layout: "landscape" });

//   // Pipe the PDF to the response so the user can download it immediately
//   doc.pipe(res);

//   // Add background image and text to the certificate
//   doc.image(path.join(__dirname, "assets", "certificate.png"), 0, 0, {
//     width: doc.page.width,
//     height: doc.page.height,
//   });
//   doc.moveDown(16).fontSize(24).text(name, { align: "center" });

//   // Define certificate file name and output path
//   const certificateName = `certificate_${newUuid}.pdf`;
//   const outputFilePath = path.join(
//     __dirname,
//     "public",
//     "certificates",
//     certificateName
//   );

//   await GameModal.findOneAndUpdate(
//     { email },
//     { certificate: certificateName },
//     { sort: { createdAt: -1 } }
//   );

//   // Also pipe the PDF to a file stream so it gets saved on disk
//   const fileStream = fs.createWriteStream(outputFilePath);
//   doc.pipe(fileStream);

//   // End the PDF document
//   doc.end();

//   // Once the file is fully written, read it and upload to Supabase Storage
//   fileStream.on("finish", async () => {
//     try {
//       const fileData = fs.readFileSync(outputFilePath);
//       const { data, error } = await supabase.storage
//         .from("sql-adventure")
//         .upload(certificateName, fileData);
//       if (error) {
//         console.error("Error uploading certificate to Supabase:", error);
//       } else {
//         console.log("Successfully uploaded certificate to Supabase:", data);
//       }
//     } catch (err) {
//       console.error("Error reading file for upload:", err);
//     }
//   });
// });

app.post("/generateCertificate", async (req, res) => {
  const { name, email, certificateName } = req.body;
  const newUuid = uuidv4();

  // Define certificate file name and output path
  // const certificateName = `certificate_${newUuid}.pdf`;
  const outputFilePath = path.join(
    __dirname,
    "public",
    "certificates",
    certificateName
  );

  // Set headers for PDF download/display
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${certificateName}`
  );

  // Create a new PDF document
  const doc = new PDFDocument({ size: "A4", layout: "landscape" });

  // Accumulate PDF data in memory
  let buffers = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  doc.on("end", async () => {
    const pdfData = Buffer.concat(buffers);

    // Write PDF to disk
    fs.writeFileSync(outputFilePath, pdfData);

    // Upload the PDF buffer to Supabase Storage
    const { data, error } = await supabase.storage
      .from("sql-adventure") // Use your correct bucket name here
      .upload(certificateName, pdfData, {
        contentType: "application/pdf",
      });
    if (error) {
      console.error("Error uploading certificate to Supabase:", error);
    } else {
      console.log("Successfully uploaded certificate to Supabase:", data);

      // Update your database record with the certificate name (if needed)
      const certificateLink = `https://nleyuffkuxkklxwoqmuv.supabase.co/storage/v1/object/public/sql-adventure//${certificateName}`;
      await GameModal.findOneAndUpdate(
        { email },
        { certificate: certificateLink },
        { sort: { createdAt: -1 } }
      );
    }

    // Send the PDF buffer as the response so it displays or downloads correctly
    res.end(pdfData);
  });

  // Add content to the PDF: background image and text
  doc.image(path.join(__dirname, "assets", "certificate.png"), 0, 0, {
    width: doc.page.width,
    height: doc.page.height,
  });
  doc.moveDown(16).fontSize(24).text(name, { align: "center" });

  // Finalize the PDF and trigger the "end" event
  doc.end();
});

app.post("/getGoogleFormStatus", async (req, res) => {
  try {
    const { email } = req.body;

    const userResponse = await User.findOne({ email }).lean();

    res.status(200).json(userResponse);
  } catch (error) {
    console.log("error: ", error);
  }
});

app.post("/setInitialGoogleForm", async (req, res) => {
  try {
    const { email, message } = req.body;
    let emailFound = true;

    const response = await User.findOne({ email }).lean();
    if (response) {
      await User.findOneAndUpdate(
        { email },
        {
          initialGoogleFormCompleted: true,
        }
      );
    } else {
      emailFound = false;
    }

    // Emit an event to the specific user if they're connected
    if (connectedUsers[email] && socketServer) {
      socketServer
        .to(connectedUsers[email])
        .emit("initialGoogleFormSubmitted", {
          emailFound,
        });
      console.log(`Emitted event to ${email}`);
    } else {
      console.log(`User ${email} not connected. Skipping event emit.`);
    }

    res.status(200).json("Success");
  } catch (error) {
    console.log("error: ", error);
  }
});

app.post("/setFinalGoogleForm", async (req, res) => {
  try {
    const { email } = req.body;
    let message = "Email found";

    const response = await findOne({ email }).lean();
    if (response) {
      await User.findOneAndUpdate(
        { email },
        {
          initialGoogleFormCompleted: true,
        }
      );
    } else {
      message = "Email not found";
    }

    // Emit an event to the specific user if they're connected
    if (connectedUsers[email] && socketServer) {
      socketServer
        .to(connectedUsers[email])
        .emit("initialGoogleFormSubmitted", {
          message,
        });
      console.log(`Emitted event to ${email} with code ${code}`);
    } else {
      console.log(`User ${email} not connected. Skipping event emit.`);
    }

    res.status(200).json("Success");
  } catch (error) {
    console.log("error: ", error);
  }
});

app.post("/saveSuggestion", async (req, res) => {
  try {
    const { email, data } = req.body;

    await GameModal.findOneAndUpdate(
      { email },
      { feedback: data },
      { sort: { createdAt: -1 } }
    );

    res.status(200).json("Success");
  } catch (error) {
    console.log("error: ", error);
  }
});

mongoose
  .connect(uri)
  .then(() => {
    const webServer = app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

    socketServer = new Server(webServer, {
      cors: "*",
      connectTimeout: 60000,
    });

    socketServer.on("connection", (socket) => {
      console.log("Connection established");

      socket.on("register", (payload) => {
        connectedUsers[payload.email] = socket.id;
        console.log("Registered user:", payload.email, "Socket ID:", socket.id);
        console.log(
          "Updated connectedUsers:",
          JSON.stringify(connectedUsers, null, 2)
        );
      });

      socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
        for (let email in connectedUsers) {
          if (connectedUsers[email] === socket.id) {
            delete connectedUsers[email];
            break;
          }
        }
      });
    });
  })
  .catch((err) => {
    console.log("err: ", err);
  });
