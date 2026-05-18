/* =====================================================
   JOE'S EXCELLENT EVENT MANAGEMENT - SERVER.JS
   Secure Railway + Firebase Admin version
===================================================== */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =====================================================
   FOLDERS
===================================================== */

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* =====================================================
   CORS SETUP
===================================================== */

const allowedOrigins = [
    "https://www.joemoboawards2025.co.uk",
    "https://joemoboawards2025.co.uk",
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_ORIGIN_WWW
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

/* =====================================================
   FIREBASE ADMIN SETUP
===================================================== */

let db = null;
let bucket = null;

try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT is missing.");
    } else {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET
            });
        }

        db = admin.firestore();

        if (process.env.FIREBASE_STORAGE_BUCKET) {
            bucket = admin.storage().bucket();
        }

        console.log("Firebase connected successfully.");
    }
} catch (error) {
    console.error("Firebase setup failed:", error.message);
}

/* =====================================================
   MULTER FILE UPLOAD SETUP
===================================================== */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const uniqueName = Date.now() + "-" + safeOriginalName;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, Word, JPG and PNG files are allowed."));
        }
    }
});

/* =====================================================
   AUTH HELPERS
===================================================== */

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-immediately";

function createToken(user) {
    return jwt.sign(user, JWT_SECRET, { expiresIn: "8h" });
}

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "No valid login token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Login expired. Please log in again."
        });
    }
}

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        firebaseConnected: !!db,
        storageConnected: !!bucket
    });
});

/* =====================================================
   ADMIN / RECRUITER LOGIN
===================================================== */

app.post("/admin/login", (req, res) => {
    const { email, password } = req.body;

    const users = [
        {
            role: "admin",
            email: process.env.ADMIN_EMAIL,
            password: process.env.ADMIN_PASSWORD
        },
        {
            role: "recruiter",
            email: process.env.RECRUITER_EMAIL,
            password: process.env.RECRUITER_PASSWORD
        },
        {
            role: "viewer",
            email: process.env.VIEWER_EMAIL,
            password: process.env.VIEWER_PASSWORD
        }
    ];

    const matchedUser = users.find(user =>
        user.email &&
        user.password &&
        user.email === email &&
        user.password === password
    );

    if (!matchedUser) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password."
        });
    }

    const token = createToken({
        email: matchedUser.email,
        role: matchedUser.role
    });

    res.json({
        success: true,
        message: "Login successful.",
        token,
        role: matchedUser.role
    });
});

/* =====================================================
   APPLICATION FORM SUBMISSION
===================================================== */

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

            const cvFile = req.files && req.files.cv ? req.files.cv[0] : null;
            const extraFiles = req.files && req.files.extraFiles ? req.files.extraFiles : [];

            const applicationData = {
                fullName,
                email,
                phone: phone || "",
                position: position || "",
                message: message || "",
                status: "New",
                rating: 0,
                notes: "",
                interviewDate: "",
                interviewTime: "",
                interviewLocation: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                cv: cvFile ? `/uploads/${cvFile.filename}` : "",
                extraFiles: extraFiles.map(file => `/uploads/${file.filename}`)
            };

            let savedId = null;

            if (db) {
                const docRef = await db.collection("applications").add(applicationData);
                savedId = docRef.id;
            } else {
                const localFile = path.join(__dirname, "applications.json");
                let applications = [];

                if (fs.existsSync(localFile)) {
                    applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
                }

                savedId = Date.now().toString();
                applications.push({
                    id: savedId,
                    ...applicationData
                });

                fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
            }

            res.json({
                success: true,
                message: "Application submitted successfully.",
                id: savedId
            });

        } catch (error) {
            console.error("Application submission error:", error);

            res.status(500).json({
                success: false,
                message: "Server error. Application was not submitted."
            });
        }
    }
);

/* =====================================================
   GET ALL APPLICATIONS
===================================================== */

app.get("/api/applications", verifyToken, async (req, res) => {
    try {
        let applications = [];

        if (db) {
            const snapshot = await db
                .collection("applications")
                .orderBy("createdAt", "desc")
                .get();

            applications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            const localFile = path.join(__dirname, "applications.json");

            if (fs.existsSync(localFile)) {
                applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
            }
        }

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

/* =====================================================
   UPDATE APPLICATION
===================================================== */

app.patch("/api/applications/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const updateData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        if (db) {
            await db.collection("applications").doc(id).update(updateData);
        } else {
            const localFile = path.join(__dirname, "applications.json");

            if (!fs.existsSync(localFile)) {
                return res.status(404).json({
                    success: false,
                    message: "No local applications file found."
                });
            }

            const applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
            const index = applications.findIndex(app => app.id === id);

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Application not found."
                });
            }

            applications[index] = {
                ...applications[index],
                ...updateData
            };

            fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
        }

        res.json({
            success: true,
            message: "Application updated successfully."
        });

    } catch (error) {
        console.error("Update application error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update application."
        });
    }
});

/* =====================================================
   DELETE APPLICATION
===================================================== */

app.delete("/api/applications/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot delete applications."
            });
        }

        if (db) {
            await db.collection("applications").doc(id).delete();
        } else {
            const localFile = path.join(__dirname, "applications.json");

            if (!fs.existsSync(localFile)) {
                return res.status(404).json({
                    success: false,
                    message: "No local applications file found."
                });
            }

            let applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
            applications = applications.filter(app => app.id !== id);

            fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
        }

        res.json({
            success: true,
            message: "Application deleted successfully."
        });

    } catch (error) {
        console.error("Delete application error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete application."
        });
    }
});

/* =====================================================
   SEND INTERVIEW INVITATION PLACEHOLDER
===================================================== */

app.post("/api/applications/:id/invite", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            interviewDate,
            interviewTime,
            interviewLocation,
            interviewMessage
        } = req.body;

        const updateData = {
            status: "Interview Invited",
            interviewDate: interviewDate || "",
            interviewTime: interviewTime || "",
            interviewLocation: interviewLocation || "",
            interviewMessage: interviewMessage || "",
            updatedAt: new Date().toISOString()
        };

        if (db) {
            await db.collection("applications").doc(id).update(updateData);
        }

        res.json({
            success: true,
            message: "Interview invitation details saved successfully."
        });

    } catch (error) {
        console.error("Interview invitation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save interview invitation details."
        });
    }
});

/* =====================================================
   FRONTEND ROUTES
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/careers", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "careers.html"));
});

/* =====================================================
   404 HANDLER
===================================================== */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

/* =====================================================
   ERROR HANDLER
===================================================== */

app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    res.status(500).json({
        success: false,
        message: error.message || "Internal server error."
    });
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});