const mongoose = require("mongoose");

const getintouchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobilenumber: { type: String, required: true },
    email: { type: String, required: true },
    type: {
      type: String,
      enum: ["driving_school", "travels", "rto"],
      required: true,
    },
    description: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("GetInTouch", getintouchSchema);
