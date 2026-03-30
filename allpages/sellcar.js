const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const { Resend } = require("resend");
const mongoose = require("mongoose");
const Car = require("./sellcar_model");

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
});

/* ================= HELPERS ================= */

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const uploadToCloudinary = (fileBuffer, folder = "sellcars") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

const parseBoolean = (value) => {
  return (
    value === true || value === "true" || value === "yes" || value === "on"
  );
};

const sendError = (res, status, message, error = null) => {
  return res.status(status).json({
    success: false,
    message,
    ...(error ? { error: error.message || error } : {}),
  });
};

/* ================= CREATE CAR ================= */

router.post("/add", upload.array("images", 10), async (req, res) => {
  try {
    const {
      carTitle,
      brand,
      model,
      variant,
      year,
      regNo,
      fuelType,
      kmDriven,
      insurance,
      location,
      price,
      negotiable,
      description,
      name,
      phone,
      email,
      whatsappAvailable,
    } = req.body;

    let imageUrls = [];

    if (req.files && req.files.length > 0) {
      const uploadedImages = await Promise.all(
        req.files.map((file) => uploadToCloudinary(file.buffer, "sellcars")),
      );
      imageUrls = uploadedImages.map((img) => img.secure_url);
    }

    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        imageUrls = [...imageUrls, ...req.body.images];
      } else if (typeof req.body.images === "string") {
        imageUrls.push(req.body.images);
      }
    }

    const newCar = new Car({
      carTitle,
      brand,
      model,
      variant,
      year,
      regNo,
      fuelType,
      kmDriven,
      insurance,
      location,
      price,
      negotiable: parseBoolean(negotiable),
      description,
      images: imageUrls,
      name,
      phone,
      email,
      whatsappAvailable: parseBoolean(whatsappAvailable),
      status: "pending",
    });

    const savedCar = await newCar.save();

    try {
      const adminEmailHtml = `
        <h2>New Car Sale Request Submitted</h2>

        <h3>Seller Details:</h3>
        <ul>
          <li><b>Name:</b> ${savedCar.name || "N/A"}</li>
          <li><b>Phone:</b> ${savedCar.phone || "N/A"}</li>
          <li><b>Email:</b> ${savedCar.email || "N/A"}</li>
          <li><b>WhatsApp Available:</b> ${
            savedCar.whatsappAvailable ? "Yes" : "No"
          }</li>
        </ul>

        <h3>Car Details:</h3>
        <ul>
          <li><b>Title:</b> ${savedCar.carTitle || "N/A"}</li>
          <li><b>Brand:</b> ${savedCar.brand || "N/A"}</li>
          <li><b>Model:</b> ${savedCar.model || "N/A"}</li>
          <li><b>Variant:</b> ${savedCar.variant || "N/A"}</li>
          <li><b>Year:</b> ${savedCar.year || "N/A"}</li>
          <li><b>Registration No:</b> ${savedCar.regNo || "N/A"}</li>
          <li><b>Fuel Type:</b> ${savedCar.fuelType || "N/A"}</li>
          <li><b>KM Driven:</b> ${savedCar.kmDriven || "N/A"}</li>
          <li><b>Insurance:</b> ${savedCar.insurance || "N/A"}</li>
          <li><b>Location:</b> ${savedCar.location || "N/A"}</li>
          <li><b>Price:</b> ${savedCar.price || "N/A"}</li>
          <li><b>Negotiable:</b> ${savedCar.negotiable ? "Yes" : "No"}</li>
          <li><b>Description:</b> ${savedCar.description || "N/A"}</li>
          <li><b>Status:</b> ${savedCar.status}</li>
        </ul>

        <p><b>Submitted At:</b> ${new Date().toLocaleString()}</p>

        ${
          savedCar.images && savedCar.images.length > 0
            ? `<p><b>First Image:</b> <a href="${savedCar.images[0]}" target="_blank">View Car Image</a></p>`
            : `<p><b>Images:</b> No images uploaded</p>`
        }
      `;

      await resend.emails.send({
        from: "Sell Car <admin@mybookhub.store>",
        to: "admin@saidrivingschoolandtravels.in",
        subject: "New Car Sale Request Submitted",
        html: adminEmailHtml,
        reply_to: savedCar.email,
      });
    } catch (mailError) {
      console.error("Admin email send error:", mailError);
    }

    return res.status(201).json({
      success: true,
      message: "Car submitted successfully. Waiting for admin approval.",
      data: savedCar,
    });
  } catch (error) {
    console.error("Create car error:", error);
    return sendError(res, 500, "Failed to create car", error);
  }
});

/* ================= USER ROUTES ================= */

router.get("/all", async (req, res) => {
  try {
    const cars = await Car.find({ status: "approved" }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cars.length,
      data: cars,
    });
  } catch (error) {
    console.error("Fetch approved cars error:", error);
    return sendError(res, 500, "Failed to fetch cars", error);
  }
});

/* ================= ADMIN ROUTES ================= */

router.get("/admin/pending", async (req, res) => {
  try {
    const cars = await Car.find({ status: "pending" }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cars.length,
      data: cars,
    });
  } catch (error) {
    console.error("Fetch pending cars error:", error);
    return sendError(res, 500, "Failed to fetch pending cars", error);
  }
});

router.get("/pending", async (req, res) => {
  try {
    const cars = await Car.find({ status: "pending" }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cars.length,
      data: cars,
    });
  } catch (error) {
    console.error("Fetch pending cars error:", error);
    return sendError(res, 500, "Failed to fetch pending cars", error);
  }
});

router.get("/admin/all", async (req, res) => {
  try {
    const cars = await Car.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: cars.length,
      data: cars,
    });
  } catch (error) {
    console.error("Fetch all cars error:", error);
    return sendError(res, 500, "Failed to fetch all cars", error);
  }
});

router.put("/admin/approve/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid car id");
    }

    const updatedCar = await Car.findByIdAndUpdate(
      id,
      {
        status: "approved",
        approvedAt: new Date(),
        rejectedAt: null,
        rejectionReason: "",
      },
      { new: true, runValidators: true },
    );

    if (!updatedCar) {
      return sendError(res, 404, "Car not found");
    }

    return res.status(200).json({
      success: true,
      message: "Car approved successfully",
      data: updatedCar,
    });
  } catch (error) {
    console.error("Approve car error:", error);
    return sendError(res, 500, "Failed to approve car", error);
  }
});

router.put("/admin/reject/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid car id");
    }

    const updatedCar = await Car.findByIdAndUpdate(
      id,
      {
        status: "rejected",
        rejectedAt: new Date(),
        approvedAt: null,
        rejectionReason: rejectionReason || "",
      },
      { new: true, runValidators: true },
    );

    if (!updatedCar) {
      return sendError(res, 404, "Car not found");
    }

    return res.status(200).json({
      success: true,
      message: "Car rejected successfully",
      data: updatedCar,
    });
  } catch (error) {
    console.error("Reject car error:", error);
    return sendError(res, 500, "Failed to reject car", error);
  }
});

router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid car id");
    }

    const deletedCar = await Car.findByIdAndDelete(id);

    if (!deletedCar) {
      return sendError(res, 404, "Car not found");
    }

    return res.status(200).json({
      success: true,
      message: "Car deleted successfully",
      data: deletedCar,
    });
  } catch (error) {
    console.error("Delete car error:", error);
    return sendError(res, 500, "Failed to delete car", error);
  }
});

/* ================= SINGLE CAR ROUTE - KEEP LAST ================= */

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, "Invalid car id");
    }

    const car = await Car.findById(id);

    if (!car) {
      return sendError(res, 404, "Car not found");
    }

    return res.status(200).json({
      success: true,
      data: car,
    });
  } catch (error) {
    console.error("Fetch car error:", error);
    return sendError(res, 500, "Failed to fetch car", error);
  }
});

module.exports = router;
