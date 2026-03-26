const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
mongoose
  .connect(process.env.DATABASE)
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Database connection error:", err));
  
const { getInTouch } = require("./allpages/getintouch");
const carRoutes = require("./allpages/sellcar");

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running successfully",
  });
});


app.post("/getintouch", getInTouch);
app.use("/cars", carRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

const port = process.env.PORT || 4300;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});