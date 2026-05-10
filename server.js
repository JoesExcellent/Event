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

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* ---------------- MIDDLEWARE ---------------- */

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

/* ---------------- FIREBASE SETUP ---------------- */

let db = null;
let bucket = null;

try {
    if (!admin.apps.length) {
        let serviceAccount = null;

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
            serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } else if (fs.existsSync(path.join(__dirname, "serviceAccountKey.json"))) {
            serviceAccount = require("./serviceAccountKey.json");
        }

        if (!serviceAccount) {
            throw new Error("Firebase service account is missing.");
        }

        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
        });
    }

    db = admin.firestore();

    if (process.env.FIREBASE_STORAGE_BUCKET) {
        bucket = admin.storage().bucket();
    }

    console.log("Firebase connected successfully.");

} catch (error) {
    console.error("Firebase setup error:", error.message);
}

/* ---------------- FILE UPLOAD SETUP ---------------- */

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, `${Date.now()}_${safeName}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* ---------------- HELPERS ---------------- */

function requireDb(res) {
    if (!db) {
        res.status(500).json({
            success: false,
            message: "Firestore is not connected."
        });
        return false;
    }

    return true;
}

function createToken(email) {
    return jwt.sign(
        { email },
        process.env.JWT_SECRET || "local-dev-secret",
        { expiresIn: "12h" }
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
        req.admin = jwt.verify(
            token,
            process.env.JWT_SECRET || "local-dev-secret"
        );

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin token."
        });
    }
}

/* ---------------- PAGE ROUTES ---------------- */

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/home", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "home.html"));
});

app.get("/careers", (req, res) => {
    const careersPath = path.join(PUBLIC_DIR, "careers.html");

    if (fs.existsSync(careersPath)) {
        return res.sendFile(careersPath);
    }

    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/contact", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "contact us.html"));
});

/* ---------------- HEALTH CHECK ---------------- */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC recruitment backend is running",
        firebase: Boolean(db)
    });
});

/* ---------------- ADMIN LOGIN ---------------- */

app.post("/api/admin/login", (req, res) => {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL || "joseph.eldridge1964@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "password123";

    if (email === adminEmail && password === adminPassword) {
        return res.json({
            success: true,
            token: createToken(email),
            admin: {
                name: "Joseph Eldridge",
                email: adminEmail,
                role: "owner"
            }
        });
    }

    res.status(401).json({
        success: false,
        message: "Invalid login details"
    });
});

/* ---------------- SUBMIT APPLICATION ---------------- */

app.post("/api/apply", upload.any(), async (req, res) => {
    try {
        if (!requireDb(res)) return;

        const uploadedFiles = req.files || [];

        const cvFile = uploadedFiles.length > 0
            ? uploadedFiles[0].filename
            : "";

        const extraFiles = uploadedFiles.length > 1
            ? uploadedFiles.slice(1).map(file => file.filename)
            : [];

        const cvUrl = cvFile ? `/uploads/${cvFile}` : "";

        const newApplication = {
            fullName: req.body.fullName || req.body.name || "",
            firstName: req.body.firstName || "",
            lastName: req.body.lastName || "",
            email: req.body.email || "",
            phone: req.body.phone || "",
            position: req.body.position || "",
            about: req.body.about || req.body.message || "",
            message: req.body.message || req.body.about || "",
            cvFile,
            cvUrl,
            extraFiles,
            status: "New",
            rating: 0,
            notes: "",
            favourite: false,
            interviewDate: "",
            interviewTime: "",
            interviewLocation: "",
            invitationSent: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const docRef = await db.collection("applications").add(newApplication);

        res.json({
            success: true,
            message: "Application submitted successfully",
            application: {
                id: docRef.id,
                ...newApplication
            }
        });

    } catch (error) {
        console.error("Application submit error:", error);

        res.status(500).json({
            success: false,
            message: "Server error submitting application"
        });
    }
});

/* ---------------- GET APPLICATIONS ---------------- */

async function getApplications(req, res) {
    try {
        if (!requireDb(res)) return;

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
        console.error("Get applications error:", error);

        res.status(500).json({
            success: false,
            message: "Server error loading applications"
        });
    }
}

app.get("/api/applications", getApplications);
app.get("/api/admin/applications", verifyAdmin, getApplications);

/* ---------------- UPDATE APPLICATION ---------------- */

app.patch("/api/admin/applications/:id", verifyAdmin, async (req, res) => {
    try {
        if (!requireDb(res)) return;

        const allowedFields = [
            "status",
            "rating",
            "notes",
            "favourite",
            "interviewDate",
            "interviewTime",
            "interviewLocation",
            "invitationSent"
        ];

        const updates = {};

        allowedFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        });

        updates.updatedAt = new Date().toISOString();

        await db.collection("applications").doc(req.params.id).update(updates);

        res.json({
            success: true,
            message: "Application updated successfully"
        });

    } catch (error) {
        console.error("Application update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update application"
        });
    }
});

/* ---------------- OLD UPDATE ROUTES KEPT FOR COMPATIBILITY ---------------- */

app.patch("/api/applications/:id/status", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            status: req.body.status || "New",
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update status"
        });
    }
});

app.patch("/api/applications/:id/rating", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            rating: Number(req.body.rating || 0),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update rating"
        });
    }
});

app.patch("/api/applications/:id/notes", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            notes: req.body.notes || "",
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to save notes"
        });
    }
});

app.patch("/api/applications/:id/interview", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            interviewDate: req.body.interviewDate || "",
            interviewTime: req.body.interviewTime || "",
            interviewLocation: req.body.interviewLocation || "",
            status: "Interview",
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to save interview details"
        });
    }
});

app.patch("/api/applications/:id/favourite", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            favourite: Boolean(req.body.favourite),
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update shortlist"
        });
    }
});

/* ---------------- INVITATION ---------------- */

app.post("/api/admin/applications/:id/invite", verifyAdmin, async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            invitationSent: true,
            status: "Interview Invited",
            interviewDate: req.body.interviewDate || "",
            interviewTime: req.body.interviewTime || "",
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Interview invitation marked as sent"
        });

    } catch (error) {
        console.error("Invitation error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update invitation"
        });
    }
});

app.post("/api/applications/:id/send-invitation", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).update({
            invitationSent: true,
            status: "Interview",
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Interview invitation marked as sent"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to send invitation"
        });
    }
});

/* ---------------- DELETE APPLICATION ---------------- */

app.delete("/api/admin/applications/:id", verifyAdmin, async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).delete();

        res.json({
            success: true,
            message: "Candidate deleted successfully"
        });

    } catch (error) {
        console.error("Delete error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete candidate"
        });
    }
});

app.delete("/api/applications/:id", async (req, res) => {
    try {
        if (!requireDb(res)) return;

        await db.collection("applications").doc(req.params.id).delete();

        res.json({
            success: true,
            message: "Candidate deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete candidate"
        });
    }
});

/* ---------------- API 404 ---------------- */

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: `API route not found: ${req.originalUrl}`
    });
});

/* ---------------- ERROR HANDLER ---------------- */

app.use((err, req, res, next) => {
    console.error("Server error:", err);

    res.status(500).json({
        success: false,
        message: err.message || "Server error"
    });
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, "0.0.0.0", () => {
    console.log(`TEMC recruitment backend running on port ${PORT}`);
});
