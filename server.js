const express = require("express");
const cors = require("cors");
const multer = require("multer");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

/* ---------------- MIDDLEWARE ---------------- */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
    origin: [
        "https://joemoboawards2025.co.uk",
        "https://www.joemoboawards2025.co.uk",
        "http://localhost:3000"
    ],
    credentials: true
}));

app.use(express.static(PUBLIC_DIR));

/* ---------------- FIREBASE SETUP ---------------- */

if (!admin.apps.length) {
    let serviceAccountRaw =
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
        process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountRaw) {
        throw new Error("Missing Firebase service account environment variable.");
    }

    const serviceAccount = JSON.parse(serviceAccountRaw);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/* ---------------- FILE UPLOAD SETUP ---------------- */

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
            cb(new Error("Only PDF, DOC, and DOCX files are allowed."));
        }
    }
});

/* ---------------- AUTH HELPERS ---------------- */

function createToken(email) {
    return jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "8h" }
    );
}

function verifyAdmin(req, res, next) {
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
            message: "Invalid or expired admin token."
        });
    }
}

/* ---------------- BASIC ROUTES ---------------- */

app.get("/", (req, res) => {
    res.send("TEMC Recruitment Backend Running");
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC Recruitment backend is running"
    });
});

/* ---------------- APPLICATION SUBMISSION ---------------- */

app.post("/api/apply", upload.single("cv"), async (req, res) => {
    try {
        const { fullName, email, phone, position, about } = req.body;

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

        const safeFileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;
        const filePath = `cvs/${safeFileName}`;

        const file = bucket.file(filePath);

        await file.save(req.file.buffer, {
            metadata: {
                contentType: req.file.mimetype
            }
        });

        await file.makePublic();

        const cvUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        const applicationData = {
            fullName,
            email,
            phone,
            position,
            about: about || "",
            cvUrl,
            cvFileName: req.file.originalname,
            status: "New",
            rating: 0,
            notes: "",
            interviewDate: "",
            interviewTime: "",
            invitationSent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection("applications").add(applicationData);

        res.json({
            success: true,
            message: "Application submitted successfully.",
            id: docRef.id
        });

    } catch (error) {
        console.error("Application error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Server error submitting application."
        });
    }
});

/* ---------------- ADMIN LOGIN ---------------- */

app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;

    if (
        email === process.env.ADMIN_EMAIL &&
        password === process.env.ADMIN_PASSWORD
    ) {
        return res.json({
            success: true,
            token: createToken(email),
            message: "Login successful"
        });
    }

    res.status(401).json({
        success: false,
        message: "Invalid admin email or password."
    });
});

/* ---------------- GET APPLICATIONS ---------------- */

app.get("/api/admin/applications", verifyAdmin, async (req, res) => {
    try {
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
        console.error("Fetch applications error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to load applications."
        });
    }
});

/* ---------------- UPDATE APPLICATION ---------------- */

app.patch("/api/admin/applications/:id", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection("applications").doc(id).update({
            ...req.body,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

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

/* ---------------- DELETE APPLICATION ---------------- */

app.delete("/api/admin/applications/:id", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection("applications").doc(id).delete();

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

/* ---------------- MARK INVITATION SENT ---------------- */

app.post("/api/admin/applications/:id/invite", verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { interviewDate, interviewTime } = req.body;

        await db.collection("applications").doc(id).update({
            status: "Interview Invited",
            interviewDate: interviewDate || "",
            interviewTime: interviewTime || "",
            invitationSent: true,
            invitationSentAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({
            success: true,
            message: "Interview invitation marked as sent."
        });

    } catch (error) {
        console.error("Invitation update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update invitation status."
        });
    }
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
    console.log(`TEMC Recruitment backend running on port ${PORT}`);
});
