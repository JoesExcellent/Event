/* =====================================================
   JOE'S EXCELLENT EVENT MANAGEMENT - SERVER.JS
   Railway + Firebase Admin + Interview Email Invitations
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
   EMAIL HELPERS - RESEND
===================================================== */

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function buildInterviewEmail(application, details) {
    const candidateName = application.fullName || "Candidate";
    const position = application.position || "the position applied for";
    const interviewDate = details.interviewDate || "to be confirmed";
    const interviewTime = details.interviewTime || "to be confirmed";
    const interviewLocation = details.interviewLocation || "to be confirmed";

    const customMessage = details.interviewMessage || `
Thank you for your application to Joe’s Excellent Events & Management.

We are pleased to invite you to attend an interview to discuss your application, experience and interest in joining our team.
`;

    const subject = `Interview Invitation - Joe's Excellent Events & Management`;

    const plainText = `Dear ${candidateName},

${customMessage}

Interview Details:
Position: ${position}
Date: ${interviewDate}
Time: ${interviewTime}
Location: ${interviewLocation}

Please reply to confirm that you are able to attend.

Kind regards,

Joe's Excellent Events & Management
Recruitment Team`;

    const html = `
        <div style="font-family: Arial, Helvetica, sans-serif; background:#061726; color:#ffffff; padding:30px;">
            <div style="max-width:700px; margin:auto; background:#13283b; border-radius:18px; padding:30px; border:1px solid #ff6a00;">
                <h1 style="color:#ff6a00; text-align:center;">Interview Invitation</h1>

                <p>Dear ${escapeHtml(candidateName)},</p>

                <p style="white-space:pre-line;">${escapeHtml(customMessage)}</p>

                <h2 style="color:#ff6a00;">Interview Details</h2>

                <p><strong>Position:</strong> ${escapeHtml(position)}</p>
                <p><strong>Date:</strong> ${escapeHtml(interviewDate)}</p>
                <p><strong>Time:</strong> ${escapeHtml(interviewTime)}</p>
                <p><strong>Location:</strong> ${escapeHtml(interviewLocation)}</p>

                <p>Please reply to confirm that you are able to attend.</p>

                <p style="margin-top:30px;">
                    Kind regards,<br>
                    <strong>Joe's Excellent Events & Management</strong><br>
                    Recruitment Team
                </p>
            </div>
        </div>
    `;

    return { subject, plainText, html };
}

async function sendEmailWithResend({ to, subject, html, plainText }) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is missing from Railway variables.");
    }

    const fromAddress = process.env.EMAIL_FROM || "Joe's Excellent Events & Management <onboarding@resend.dev>";
    const replyTo = process.env.EMAIL_REPLY_TO || process.env.EMAIL_USER || process.env.ADMIN_EMAIL || "";

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: fromAddress,
            to,
            subject,
            html,
            text: plainText,
            reply_to: replyTo || undefined
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Resend email failed.");
    }

    return result;
}

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        firebaseConnected: !!db,
        storageConnected: !!bucket,
        emailReady: !!process.env.RESEND_API_KEY
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
                address,
                position,
                availability,
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
                address: address || "",
                position: position || "",
                availability: availability || "",
                message: message || "",
                status: "New",
                rating: 0,
                notes: "",
                interviewDate: "",
                interviewTime: "",
                interviewLocation: "",
                interviewMessage: "",
                invitationSent: false,
                invitationSentAt: "",
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
   SEND ACTIVE INTERVIEW INVITATION EMAIL
===================================================== */

app.post("/api/applications/:id/invite", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot send interview invitations."
            });
        }

        const {
            interviewDate,
            interviewTime,
            interviewLocation,
            interviewMessage
        } = req.body;

        let application = null;

        if (db) {
            const doc = await db.collection("applications").doc(id).get();

            if (!doc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Application not found."
                });
            }

            application = {
                id: doc.id,
                ...doc.data()
            };
        } else {
            const localFile = path.join(__dirname, "applications.json");

            if (!fs.existsSync(localFile)) {
                return res.status(404).json({
                    success: false,
                    message: "No local applications file found."
                });
            }

            const applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
            application = applications.find(app => app.id === id);

            if (!application) {
                return res.status(404).json({
                    success: false,
                    message: "Application not found."
                });
            }
        }

        if (!application.email) {
            return res.status(400).json({
                success: false,
                message: "Candidate email address is missing."
            });
        }

        const emailContent = buildInterviewEmail(application, {
            interviewDate,
            interviewTime,
            interviewLocation,
            interviewMessage
        });

        const emailResult = await sendEmailWithResend({
            to: application.email,
            subject: emailContent.subject,
            html: emailContent.html,
            plainText: emailContent.plainText
        });

        const updateData = {
            status: "Interview Invited",
            interviewDate: interviewDate || "",
            interviewTime: interviewTime || "",
            interviewLocation: interviewLocation || "",
            interviewMessage: interviewMessage || "",
            invitationSent: true,
            invitationSentAt: new Date().toISOString(),
            invitationEmailId: emailResult.id || "",
            updatedAt: new Date().toISOString()
        };

        if (db) {
            await db.collection("applications").doc(id).update(updateData);
        } else {
            const localFile = path.join(__dirname, "applications.json");
            const applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
            const index = applications.findIndex(app => app.id === id);

            applications[index] = {
                ...applications[index],
                ...updateData
            };

            fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
        }

        res.json({
            success: true,
            message: `Interview invitation email sent to ${application.email}.`,
            emailId: emailResult.id || null
        });

    } catch (error) {
        console.error("Interview invitation email error:", error);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to send interview invitation email."
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