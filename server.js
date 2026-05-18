const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   BASIC SETUP
========================= */

app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

/* =========================
   FIREBASE ADMIN SETUP
========================= */

let db = null;
let bucket = null;

try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn("FIREBASE_SERVICE_ACCOUNT is missing. Firebase is not connected.");
    } else {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });

        db = admin.firestore();

        if (process.env.FIREBASE_STORAGE_BUCKET) {
            bucket = admin.storage().bucket();
        }

        console.log("Firebase Admin connected successfully.");
    }
} catch (error) {
    console.error("Firebase Admin setup failed:", error.message);
}

/* =========================
   FILE UPLOAD SETUP
========================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, Date.now() + "-" + safeName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        firebaseConnected: !!db,
        storageConnected: !!bucket
    });
});

/* =========================
   APPLICATION FORM ROUTE
========================= */

app.post(
    "/api/apply",
    upload.fields([
        { name: "cv", maxCount: 1 },
        { name: "extraFiles", maxCount: 5 }
    ]),
    async (req, res) => {
        try {
            const {
                fullName,
                email,
                phone,
                position,
                message
            } = req.body;

            if (!fullName || !email) {
                return res.status(400).json({
                    success: false,
                    message: "Full name and email are required."
                });
            }

            const cvFile = req.files?.cv?.[0] || null;
            const extraFiles = req.files?.extraFiles || [];

            const applicationData = {
                fullName,
                email,
                phone: phone || "",
                position: position || "",
                message: message || "",
                status: "New",
                rating: 0,
                notes: "",
                createdAt: new Date().toISOString(),
                cv: cvFile ? `/uploads/${cvFile.filename}` : "",
                extraFiles: extraFiles.map(file => `/uploads/${file.filename}`)
            };

            if (db) {
                await db.collection("applications").add(applicationData);
            }

            res.json({
                success: true,
                message: "Application submitted successfully."
            });

        } catch (error) {
            console.error("Application error:", error);

            res.status(500).json({
                success: false,
                message: "Server error. Application was not submitted."
            });
        }
    }
);

/* =========================
   GET APPLICATIONS
========================= */

app.get("/api/applications", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: "Firebase is not connected."
            });
        }

        const snapshot = await db
            .collection("applications")
            .orderBy("createdAt", "desc")
            .get();

        const applications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            applications
        });

    } catch (error) {
        console.error("Fetch applications error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch applications."
        });
    }
});

/* =========================
   UPDATE APPLICATION
========================= */

app.patch("/api/applications/:id", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: "Firebase is not connected."
            });
        }

        const { id } = req.params;

        await db.collection("applications").doc(id).update({
            ...req.body,
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Application updated successfully."
        });

    } catch (error) {
        console.error("Update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update application."
        });
    }
});

/* =========================
   DELETE APPLICATION
========================= */

app.delete("/api/applications/:id", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: "Firebase is not connected."
            });
        }

        const { id } = req.params;

        await db.collection("applications").doc(id).delete();

        res.json({
            success: true,
            message: "Application deleted successfully."
        });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete application."
        });
    }
});

/* =========================
   FALLBACK PAGE ROUTE
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});