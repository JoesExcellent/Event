const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));

let db = null;

try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }

        db = admin.firestore();
        console.log("Firebase connected successfully.");
    } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT is missing.");
    }
} catch (error) {
    console.error("Firebase setup failed:", error.message);
}

const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, cb) {
            cb(null, UPLOADS_DIR);
        },
        filename(req, file, cb) {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
            cb(null, Date.now() + "-" + safeName);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "No valid login token provided."
        });
    }

    try {
        req.user = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Login expired. Please log in again."
        });
    }
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function sendEmailWithResend({ to, subject, html, text }) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is missing.");
    }

    const from = process.env.EMAIL_FROM || "Joe's Excellent Events & Management <recruitment@joemoboawards2025.co.uk>";
    const replyTo = process.env.EMAIL_REPLY_TO || "joseph.eldridge1964@gmail.com";
    const copyTo = process.env.EMAIL_COPY_TO || "joseph.eldridge1964@gmail.com";

    const payload = {
        from,
        to: [to],
        bcc: copyTo && copyTo !== to ? [copyTo] : undefined,
        subject,
        html,
        text,
        reply_to: replyTo
    };

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || result.error || "Resend email failed.");
    }

    return result;
}

function buildInterviewEmail(application, details) {
    const name = application.fullName || "Candidate";
    const email = application.email;
    const position = application.position || "the position applied for";
    const date = details.interviewDate || "To be confirmed";
    const time = details.interviewTime || "To be confirmed";
    const location = details.interviewLocation || "Joe's Excellent Events & Management, Newcastle upon Tyne";
    const message = details.interviewMessage || "Thank you for your application. We are pleased to invite you to attend an interview.";

    const subject = "Interview Invitation - Joe's Excellent Events & Management";

    const text = `Dear ${name},

${message}

Interview Details:
Position: ${position}
Date: ${date}
Time: ${time}
Location: ${location}

Please reply to confirm that you are able to attend.

Kind regards,
Joe's Excellent Events & Management
Recruitment Team`;

    const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#061726;color:#ffffff;padding:30px;">
            <div style="max-width:700px;margin:auto;background:#13283b;border:1px solid #ff6a00;border-radius:18px;padding:30px;">
                <h1 style="color:#ff6a00;text-align:center;">Interview Invitation</h1>
                <p>Dear ${escapeHtml(name)},</p>
                <p style="white-space:pre-line;">${escapeHtml(message)}</p>
                <h2 style="color:#ff6a00;">Interview Details</h2>
                <p><strong>Position:</strong> ${escapeHtml(position)}</p>
                <p><strong>Date:</strong> ${escapeHtml(date)}</p>
                <p><strong>Time:</strong> ${escapeHtml(time)}</p>
                <p><strong>Location:</strong> ${escapeHtml(location)}</p>
                <p><strong>Candidate Email:</strong> ${escapeHtml(email)}</p>
                <p>Please reply to confirm that you are able to attend.</p>
                <p style="margin-top:30px;">
                    Kind regards,<br>
                    <strong>Joe's Excellent Events & Management</strong><br>
                    Recruitment Team
                </p>
            </div>
        </div>
    `;

    return { subject, text, html };
}

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        firebaseConnected: !!db,
        resendReady: !!process.env.RESEND_API_KEY,
        emailFrom: process.env.EMAIL_FROM || null,
        emailCopyTo: process.env.EMAIL_COPY_TO || null
    });
});

app.post("/admin/login", (req, res) => {
    const { email, password } = req.body;

    const users = [
        { role: "admin", email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
        { role: "recruiter", email: process.env.RECRUITER_EMAIL, password: process.env.RECRUITER_PASSWORD },
        { role: "viewer", email: process.env.VIEWER_EMAIL, password: process.env.VIEWER_PASSWORD }
    ];

    const user = users.find(u => u.email && u.password && u.email === email && u.password === password);

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password."
        });
    }

    const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "8h" });

    res.json({
        success: true,
        message: "Login successful.",
        token,
        role: user.role
    });
});

app.post(
    "/api/apply",
    upload.fields([
        { name: "cv", maxCount: 1 },
        { name: "extraFiles", maxCount: 5 }
    ]),
    async (req, res) => {
        try {
            const cvFile = req.files?.cv?.[0] || null;
            const extraFiles = req.files?.extraFiles || [];

            const applicationData = {
                fullName: req.body.fullName || "",
                email: req.body.email || "",
                phone: req.body.phone || "",
                address: req.body.address || "",
                position: req.body.position || "",
                availability: req.body.availability || "",
                message: req.body.message || "",
                status: "New",
                rating: 0,
                notes: "",
                interviewDate: "",
                interviewTime: "",
                interviewLocation: "",
                interviewMessage: "",
                invitationSent: false,
                invitationSentAt: "",
                invitationEmailId: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                cv: cvFile ? `/uploads/${cvFile.filename}` : "",
                extraFiles: extraFiles.map(file => `/uploads/${file.filename}`)
            };

            if (!applicationData.fullName || !applicationData.email) {
                return res.status(400).json({
                    success: false,
                    message: "Full name and email are required."
                });
            }

            const docRef = await db.collection("applications").add(applicationData);

            res.json({
                success: true,
                message: "Application submitted successfully.",
                id: docRef.id
            });

        } catch (error) {
            console.error("Application error:", error.message);

            res.status(500).json({
                success: false,
                message: "Application was not submitted."
            });
        }
    }
);

app.get("/api/applications", verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection("applications").orderBy("createdAt", "desc").get();

        const applications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({
            success: true,
            applications
        });

    } catch (error) {
        console.error("Fetch applications error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to fetch applications."
        });
    }
});

app.patch("/api/applications/:id", verifyToken, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).update({
            ...req.body,
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: "Application updated successfully."
        });

    } catch (error) {
        console.error("Update application error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to update application."
        });
    }
});

app.delete("/api/applications/:id", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot delete applications."
            });
        }

        await db.collection("applications").doc(req.params.id).delete();

        res.json({
            success: true,
            message: "Application deleted successfully."
        });

    } catch (error) {
        console.error("Delete application error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to delete application."
        });
    }
});

app.post("/api/applications/:id/invite", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot send interview invitations."
            });
        }

        const docRef = db.collection("applications").doc(req.params.id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: "Application not found."
            });
        }

        const application = {
            id: doc.id,
            ...doc.data()
        };

        if (!application.email) {
            return res.status(400).json({
                success: false,
                message: "Candidate email address is missing."
            });
        }

        const emailContent = buildInterviewEmail(application, req.body);

        const emailResult = await sendEmailWithResend({
            to: application.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        });

        await docRef.update({
            status: "Interview Invited",
            interviewDate: req.body.interviewDate || "",
            interviewTime: req.body.interviewTime || "",
            interviewLocation: req.body.interviewLocation || "",
            interviewMessage: req.body.interviewMessage || "",
            invitationSent: true,
            invitationSentAt: new Date().toISOString(),
            invitationEmailId: emailResult.id || "",
            updatedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: `Interview invitation email sent to ${application.email}. A copy was also sent to ${process.env.EMAIL_COPY_TO || "joseph.eldridge1964@gmail.com"}.`,
            emailId: emailResult.id || null
        });

    } catch (error) {
        console.error("Resend invite error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message || "Failed to send interview invitation email."
        });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});