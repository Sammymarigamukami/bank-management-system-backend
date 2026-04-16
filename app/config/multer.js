const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = "uploads";

// Ensure temporary directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); 
  },
  filename: (req, file, cb) => {
    // Generates a unique name: 1713295200000-id_card.pdf
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

module.exports = { upload };