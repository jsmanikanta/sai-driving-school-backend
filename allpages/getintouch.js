const { Resend } = require("resend");
const User = require("./getintouch_model");

const resend = new Resend(process.env.RESEND_API_KEY);

const getInTouch = async (req, res) => {
  const { name, mobilenumber, email, type, description } = req.body;

  if (!name || !mobilenumber || !email || !type || !description) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const newUser = new User({
      name,
      mobilenumber,
      email,
      type,
      description,
    });

    await newUser.save();

    // ✅ Admin Email HTML
    const adminEmailHtml = `
      <h2>New Contact Query Received</h2>

      <h3>User Details:</h3>
      <ul>
        <li><b>Name:</b> ${name}</li>
        <li><b>Mobile:</b> ${mobilenumber}</li>
        <li><b>Email:</b> ${email}</li>
        <li><b>Type:</b> ${type}</li>
        <li><b>Description:</b> ${description}</li>
      </ul>

      <p><b>Submitted At:</b> ${new Date().toLocaleString()}</p>
    `;

    // ✅ Send Mail to Admin
    await resend.emails.send({
      from: "Contact Form <admin@mybookhub.store>", // must be verified domain
      to: "admin@saidrivingschoolandtravels.in",
      subject: "New Contact Query - Driving School / PrintKart",
      html: adminEmailHtml,
    });

    res.status(201).json({
      message: "Query submitted successfully",
      user: newUser,
    });
  } catch (error) {
    console.error("GetInTouch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { getInTouch };
