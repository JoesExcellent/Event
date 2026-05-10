/* =====================================================
   TEMC RECRUITMENT SYSTEM SERVER
   Railway + Firebase + Custom Domain Ready
===================================================== */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: [
        "https://joemoboawards2025.co.uk",
        "https://www.joemoboawards2025.co.uk",
        "https://event-production-111a.up.railway.app",
        "http://localhost:3000"
    ],
    credentials: true
}));

/* =====================================================
   FIREBASE SETUP
===================================================== */

let db = null;
let bucket = null;

try {
    const firebaseJson =
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
        process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!firebaseJson) {
        throw new Error("Missing Firebase service account environment variable.");
    }

    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(firebaseJson);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });
    }

    db = admin.firestore();
    bucket = admin.storage().bucket();

    console.log("Firebase connected successfully.");

} catch (error) {
    console.error("Firebase setup error:", error.message);
}

/* =====================================================
   STATIC FRONTEND
===================================================== */

app.use(express.static(PUBLIC_DIR));

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC Recruitment backend is running",
        firebase: Boolean(db && bucket)
    });
});

/* =====================================================
   FILE UPLOAD SETUP
===================================================== */

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, DOC and DOCX files are allowed."));
        }
    }
});

/* =====================================================
   AUTH HELPERS
===================================================== */

function createAdminToken(email) {
    return jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "12h" }
    );
}

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "No admin token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        req.admin = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin token."
        });
    }
}

function requireFirebase(res) {
    if (!db || !bucket) {
        res.status(500).json({
            success: false,
            message: "Firebase is not connected. Check Railway environment variables."
        });
        return false;
    }

    return true;
}

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post("/api/admin/login", (req, res) => {
    try {
        const { email, password } = req.body;

        if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.JWT_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Admin environment variables are missing."
            });
        }

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        if (
            email.trim() !== process.env.ADMIN_EMAIL.trim() ||
            password !== process.env.ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid login details"
            });
        }

        const token = createAdminToken(email.trim());

        res.json({
            success: true,
            token,
            message: "Login successful"
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            success: false,
            message: "Server error during login."
        });
    }
});

/* =====================================================
   SUBMIT APPLICATION
===================================================== */

app.post("/api/apply", upload.single("cv"), async (req, res) => {
    try {
        if (!requireFirebase(res)) return;

        const {
            fullName,
            email,
            phone,
            position,
            about
        } = req.body;

        if (!fullName || !email || !phone || !position) {
            return res.status(400).json({
                success: false,
                message: "Please complete all required fields."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Please upload a CV."
            });
        }

        const safeOriginalName = req.file.originalname
            .replace(/[^a-zA-Z0-9.\-_]/g, "-")
            .toLowerCase();

        const filePath = `cvs/${Date.now()}-${safeOriginalName}`;
        const file = bucket.file(filePath);

        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype
            },
            resumable: false
        });

        await file.makePublic();

        const cvUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        const application = {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            position: position.trim(),
            about: about ? about.trim() : "",
            cvUrl,
            cvFileName: req.file.originalname,
            status: "New",
            rating: 0,
            notes: "",
            interviewDate: "",
            interviewTime: "",
            invitationSent: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db
            .collection("applications")
            .add(application);

        res.json({
            success: true,
            message: "Application submitted successfully.",
            id: docRef.id
        });

    } catch (error) {
        console.error("Application submission error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Application submission failed."
        });
    }
});

/* =====================================================
   GET APPLICATIONS
===================================================== */

app.get("/api/admin/applications", authenticateAdmin, async (req, res) => {
    try {
        if (!requireFirebase(res)) return;

        const snapshot = await db
            .collection("applications")
            .orderBy("createdAt", "desc")
            .get();

        const applications = [];

        snapshot.forEach(doc => {
            applications.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            applications
        });

    } catch (error) {
        console.error("Load applications error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load applications."
        });
    }
});

/* =====================================================
   UPDATE APPLICATION
===================================================== */

app.patch("/api/admin/applications/:id", authenticateAdmin, async (req, res) => {
    try {
        if (!requireFirebase(res)) return;

        const { id } = req.params;

        const allowedFields = [
            "status",
            "rating",
            "notes",
            "interviewDate",
            "interviewTime",
            "invitationSent"
        ];

        const updates = {};

        allowedFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        });

        updates.updatedAt = new Date().toISOString();

        await db
            .collection("applications")
            .doc(id)
            .update(updates);

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

app.delete("/api/admin/applications/:id", authenticateAdmin, async (req, res) => {
    try {
        if (!requireFirebase(res)) return;

        const { id } = req.params;

        await db
            .collection("applications")
            .doc(id)
            .delete();

        res.json({
            success: true,
            message: "Candidate deleted successfully."
        });

    } catch (error) {
        console.error("Delete application error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete candidate."
        });
    }
});

/* =====================================================
   MARK INTERVIEW INVITATION SENT
===================================================== */

app.post("/api/admin/applications/:id/invite", authenticateAdmin, async (req, res) => {
    try {
        if (!requireFirebase(res)) return;

        const { id } = req.params;
        const { interviewDate, interviewTime } = req.body;

        await db
            .collection("applications")
            .doc(id)
            .update({
                status: "Interview Invited",
                interviewDate: interviewDate || "",
                interviewTime: interviewTime || "",
                invitationSent: true,
                invitationSentAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

        res.json({
            success: true,
            message: "Interview invitation marked as sent."
        });

    } catch (error) {
        console.error("Interview invitation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update interview invitation."
        });
    }
});

/* =====================================================
   API 404 HANDLER
===================================================== */

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.originalUrl}`
    });
});

/* =====================================================
   FRONTEND FALLBACK
===================================================== */

app.use((req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`TEMC Recruitment backend running on port ${PORT}`);
});
