const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "joseph.eldridge1964@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "password123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Joseph Eldridge";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-railway";
const TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function parseServiceAccount() {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
        return parsed;
    }

    const localPath = path.join(__dirname, "serviceAccountKey.json");
    if (fs.existsSync(localPath)) return require(localPath);

    throw new Error("Firebase service account is missing. Add FIREBASE_SERVICE_ACCOUNT to Railway or add serviceAccountKey.json locally.");
}

if (!admin.apps.length) {
    const serviceAccount = parseServiceAccount();
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined
    });
}

const db = admin.firestore();
let bucket = null;
try {
    bucket = admin.storage().bucket();
} catch (error) {
    console.warn("Firebase Storage bucket not configured. Uploaded files will be stored locally.");
}

const allowedOrigins = [
    "https://joemoboawards2025.co.uk",
    "https://www.joemoboawards2025.co.uk",
    process.env.FRONTEND_ORIGIN,
    process.env.FRONTEND_ORIGIN_WWW
].filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 6
    }
});

function createToken(adminUser) {
    const payload = {
        email: adminUser.email,
        role: adminUser.role,
        exp: Date.now() + TOKEN_MAX_AGE_MS
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyToken(token) {
    if (!token || !token.includes(".")) return null;
    const [body, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
}

function requireAdmin(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    const payload = verifyToken(token);

    if (!payload || payload.email !== ADMIN_EMAIL) {
        return res.status(401).json({ success: false, message: "Admin login required" });
    }

    req.admin = payload;
    next();
}

function clean(value) {
    return String(value || "").trim();
}

function safeFileName(originalName) {
    const cleanName = path.basename(originalName || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${Date.now()}_${crypto.randomBytes(6).toString("hex")}_${cleanName}`;
}

async function saveUploadedFile(file) {
    const fileName = safeFileName(file.originalname);

    if (bucket) {
        const storagePath = `applications/${fileName}`;
        const remoteFile = bucket.file(storagePath);
        await remoteFile.save(file.buffer, {
            metadata: {
                contentType: file.mimetype || "application/octet-stream"
            },
            resumable: false
        });

        await remoteFile.makePublic().catch(() => null);

        return {
            fileName,
            storagePath,
            url: `https://storage.googleapis.com/${bucket.name}/${storagePath}`,
            mimeType: file.mimetype || "",
            size: file.size || 0,
            storage: "firebase"
        };
    }

    const localPath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(localPath, file.buffer);

    return {
        fileName,
        storagePath: `/uploads/${fileName}`,
        url: `/uploads/${fileName}`,
        mimeType: file.mimetype || "",
        size: file.size || 0,
        storage: "local"
    };
}

function formatApplication(doc) {
    const data = doc.data();
    const createdAt = data.createdAt && typeof data.createdAt.toDate === "function"
        ? data.createdAt.toDate().toISOString()
        : data.createdAt || "";

    return { id: doc.id, ...data, createdAt };
}

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC recruitment backend is running",
        firebase: true,
        storage: bucket ? "firebase" : "local fallback"
    });
});

app.post("/api/admin/login", (req, res) => {
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password || "");

    if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        const adminUser = { name: ADMIN_NAME, email: ADMIN_EMAIL, role: "owner" };
        return res.json({ success: true, token: createToken(adminUser), admin: adminUser });
    }

    return res.status(401).json({ success: false, message: "Invalid email or password" });
});

app.post("/api/apply", upload.any(), async (req, res) => {
    try {
        const files = req.files || [];
        const savedFiles = [];

        for (const file of files) {
            savedFiles.push(await saveUploadedFile(file));
        }

        const cv = savedFiles[0] || null;
        const extraFiles = savedFiles.slice(1);

        const application = {
            fullName: clean(req.body.fullName || req.body.name),
            email: clean(req.body.email).toLowerCase(),
            phone: clean(req.body.phone),
            position: clean(req.body.position),
            about: clean(req.body.about || req.body.message),
            cvFile: cv ? cv.fileName : "",
            cvUrl: cv ? cv.url : "",
            cvStoragePath: cv ? cv.storagePath : "",
            files: savedFiles,
            extraFiles,
            status: "New",
            rating: 0,
            notes: "",
            favourite: false,
            interviewDate: "",
            interviewTime: "",
            interviewLocation: "",
            invitationSent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (!application.fullName || !application.email || !application.phone || !application.position || !application.cvFile) {
            return res.status(400).json({ success: false, message: "Please complete all required fields and upload a CV." });
        }

        const docRef = await db.collection("applications").add(application);
        const savedDoc = await docRef.get();

        return res.json({
            success: true,
            message: "Application submitted successfully",
            application: formatApplication(savedDoc)
        });
    } catch (error) {
        console.error("Application submit error:", error);
        return res.status(500).json({ success: false, message: "Server error submitting application" });
    }
});

app.get("/api/applications", requireAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection("applications").orderBy("createdAt", "desc").get();
        const applications = snapshot.docs.map(formatApplication);
        return res.json({ success: true, applications });
    } catch (error) {
        console.error("Get applications error:", error);
        return res.status(500).json({ success: false, message: "Server error loading applications" });
    }
});

app.patch("/api/applications/:id/status", requireAdmin, async (req, res) => {
    try {
        const allowed = ["New", "Reviewed", "Interview", "Rejected"];
        const status = allowed.includes(req.body.status) ? req.body.status : "New";
        await db.collection("applications").doc(req.params.id).update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ success: true, message: "Status updated" });
    } catch (error) {
        console.error("Status update error:", error);
        return res.status(500).json({ success: false, message: "Failed to update status" });
    }
});

app.patch("/api/applications/:id/rating", requireAdmin, async (req, res) => {
    try {
        const rating = Math.max(0, Math.min(5, Number(req.body.rating || 0)));
        await db.collection("applications").doc(req.params.id).update({ rating, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ success: true, message: "Rating updated" });
    } catch (error) {
        console.error("Rating update error:", error);
        return res.status(500).json({ success: false, message: "Failed to update rating" });
    }
});

app.patch("/api/applications/:id/notes", requireAdmin, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).update({ notes: clean(req.body.notes), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ success: true, message: "Notes saved" });
    } catch (error) {
        console.error("Notes update error:", error);
        return res.status(500).json({ success: false, message: "Failed to save notes" });
    }
});

app.patch("/api/applications/:id/interview", requireAdmin, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).update({
            interviewDate: clean(req.body.interviewDate),
            interviewTime: clean(req.body.interviewTime),
            interviewLocation: clean(req.body.interviewLocation),
            status: "Interview",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true, message: "Interview details saved" });
    } catch (error) {
        console.error("Interview update error:", error);
        return res.status(500).json({ success: false, message: "Failed to save interview details" });
    }
});

app.patch("/api/applications/:id/favourite", requireAdmin, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).update({ favourite: Boolean(req.body.favourite), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ success: true, message: "Shortlist updated" });
    } catch (error) {
        console.error("Favourite update error:", error);
        return res.status(500).json({ success: false, message: "Failed to update shortlist" });
    }
});

app.post("/api/applications/:id/send-invitation", requireAdmin, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).update({
            invitationSent: true,
            status: "Interview",
            invitationSentAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return res.json({ success: true, message: "Interview invitation marked as sent" });
    } catch (error) {
        console.error("Invitation error:", error);
        return res.status(500).json({ success: false, message: "Failed to send invitation" });
    }
});

app.delete("/api/applications/:id", requireAdmin, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).delete();
        return res.json({ success: true, message: "Candidate deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete candidate" });
    }
});

app.use((err, req, res, next) => {
    console.error("Server error:", err);
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Server error" });
});

app.listen(PORT, () => {
    console.log(`TEMC recruitment backend running on port ${PORT}`);
});
