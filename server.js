/* =====================================================
   JOE'S EXCELLENT EVENTS & MANAGEMENT
   FULL WORKING SERVER.JS
===================================================== */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 8080;

/* =====================================================
   BASIC SETUP
===================================================== */

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(express.static(path.join(__dirname, "public")));

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

/* =====================================================
   FIREBASE SETUP
===================================================== */

function initialiseFirebase() {
    if (admin.apps.length) return;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        return;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8");
        const serviceAccount = JSON.parse(json);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        return;
    }

    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
}

initialiseFirebase();

const db = admin.firestore();

/* =====================================================
   MULTER FILE UPLOADS
===================================================== */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* =====================================================
   AUTH
===================================================== */

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

function createToken(user) {
    return jwt.sign(
        {
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: "12h" }
    );
}

function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorised." });
    }

    try {
        req.user = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired login." });
    }
}

function requireEditor(req, res, next) {
    if (!req.user || req.user.role === "viewer") {
        return res.status(403).json({ message: "Viewer accounts cannot make changes." });
    }

    next();
}

/* =====================================================
   HELPERS
===================================================== */

function nowIso() {
    return new Date().toISOString();
}

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function bool(value) {
    return value === true || value === "true";
}

function publicUrl(req, filePath) {
    if (!filePath) return "";
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    return `${protocol}://${host}${filePath}`;
}

function fileInfo(req, file) {
    if (!file) return null;

    const urlPath = `/uploads/${file.filename}`;

    return {
        originalName: file.originalname,
        filename: file.filename,
        path: urlPath,
        url: publicUrl(req, urlPath),
        mimetype: file.mimetype,
        size: file.size
    };
}

function replaceTemplateVars(text, data) {
    if (!text) return "";

    return String(text).replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, function (_, key) {
        return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
    });
}

function plainToHtml(text) {
    return String(text || "")
        .split(/\n+/)
        .filter(line => line.trim())
        .map(line => `<p>${escapeHtml(line.trim())}</p>`)
        .join("");
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function bodyAlreadyHasGreeting(body) {
    return /^Dear\s+.+?,?/i.test(String(body || "").trim());
}

function buildEmailHtml(title, candidateName, bodyText) {
    const safeTitle = escapeHtml(title || "Application Update");
    const safeCandidateName = escapeHtml(candidateName || "Candidate");

    const renderedBody = String(bodyText || "").trim();

    const greetingHtml = bodyAlreadyHasGreeting(renderedBody)
        ? ""
        : `<p>Dear ${safeCandidateName},</p>`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#061421;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <div style="max-width:900px;margin:0 auto;padding:48px 24px;background:#061421;">
        <div style="background:#132f44;border:2px solid #ff6a00;border-radius:28px;padding:56px 52px;color:#ffffff;">
            <h1 style="margin:0 0 42px 0;text-align:center;color:#ff6a00;font-size:42px;line-height:1.2;">
                ${safeTitle}
            </h1>

            <div style="font-size:21px;line-height:1.75;color:#ffffff;">
                ${greetingHtml}
                ${plainToHtml(renderedBody)}
            </div>
        </div>
    </div>
</body>
</html>
`;
}

/* =====================================================
   EMAIL TEMPLATES
===================================================== */

const defaultTemplates = {
    applicationReceived: {
        name: "Application Received",
        subject: "Application Received - {{position}}",
        body: `Dear {{candidateName}},

Thank you for your application for the position of {{position}} with Joe's Excellent Events & Management.

We are pleased to confirm that your application has been received successfully and has been added to our recruitment system for review.

Our recruitment team will carefully assess your application, qualifications and experience against the requirements of the role.

If your application is shortlisted, we will contact you regarding the next stage of the recruitment process.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    interviewInvitation: {
        name: "Interview Invitation",
        subject: "Interview Invitation - {{position}}",
        body: `Thank you for your application to Joe's Excellent Events & Management.

We are pleased to invite you to attend an interview for the position of {{position}}.

Interview Details
Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please arrive promptly and contact us if you require any adjustments or need to rearrange.

We look forward to meeting you and discussing your experience and suitability for the role.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    interviewReminder: {
        name: "Interview Reminder",
        subject: "Interview Reminder - {{position}}",
        body: `This is a friendly reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is approaching.

Interview Details
Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please arrive 10-15 minutes early and bring any requested documents.

If you are unable to attend or need adjustments, please contact us as soon as possible.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    offerEmail: {
        name: "Offer Made",
        subject: "Conditional Offer of Employment - {{position}}",
        body: `Following your recent interview, we are delighted to offer you the position of {{position}} with Joe's Excellent Events & Management.

We were impressed by your experience, skills and professionalism throughout the recruitment process and believe you will make a valuable contribution to our organisation.

This offer is subject to the completion of any required pre-employment checks and the agreement of final employment terms.

Please reply to this email to confirm your acceptance of this offer.

Kind regards,

Joe's Excellent Events & Management Recruitment Team`
    },

    rejectionEmail: {
        name: "Rejection Email",
        subject: "Application Outcome - {{position}}",
        body: `Thank you for taking the time to apply for the position of {{position}} with Joe's Excellent Events & Management.

After careful consideration, we regret to inform you that we will not be progressing your application further on this occasion.

This decision was not easy due to the quality of applications received.

We sincerely appreciate your interest in joining our organisation and encourage you to apply for future opportunities that match your skills and experience.

We wish you every success in your future career.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    }
};

async function getTemplate(templateId) {
    try {
        const doc = await db.collection("emailTemplates").doc(templateId).get();

        if (doc.exists) {
            return {
                ...defaultTemplates[templateId],
                ...doc.data()
            };
        }
    } catch (error) {
        console.error("Template load error:", error);
    }

    return defaultTemplates[templateId];
}

async function sendEmail({ to, subject, html }) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is missing.");
    }

    const fromEmail = process.env.FROM_EMAIL || "Joe's Excellent Events & Management <onboarding@resend.dev>";

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: fromEmail,
            to,
            subject,
            html
        })
    });

    const result = await response.json();

    if (!response.ok) {
        console.error("Resend error:", result);
        throw new Error(result.message || "Email failed to send.");
    }

    return result;
}

async function sendTemplateEmail(templateId, application, extraData = {}) {
    const template = await getTemplate(templateId);

    const data = {
        candidateName: application.fullName || application.name || "Candidate",
        position: application.position || "the position",
        email: application.email || "",
        phone: application.phone || "",
        address: application.address || "",
        availability: application.availability || "",
        message: application.message || "",
        interviewDate: extraData.interviewDate || application.interviewDate || "",
        interviewTime: extraData.interviewTime || application.interviewTime || "",
        interviewLocation: extraData.interviewLocation || application.interviewLocation || "",
        ...extraData
    };

    const subject = replaceTemplateVars(template.subject || template.name || "Application Update", data);
    const body = replaceTemplateVars(template.body || "", data);

    const html = buildEmailHtml(template.name || subject, data.candidateName, body);

    return sendEmail({
        to: application.email,
        subject,
        html
    });
}

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        ok: true,
        service: "Joe's Excellent Events & Management Recruitment System",
        time: nowIso()
    });
});

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post("/api/admin/login", async (req, res) => {
    try {
        const email = clean(req.body.email).toLowerCase();
        const password = clean(req.body.password);

        const defaultEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
        const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";

        let user = null;

        const adminSnapshot = await db.collection("admins").where("email", "==", email).limit(1).get();

        if (!adminSnapshot.empty) {
            const adminDoc = adminSnapshot.docs[0];
            const adminData = adminDoc.data();

            if (adminData.password === password) {
                user = {
                    id: adminDoc.id,
                    email: adminData.email,
                    role: adminData.role || "owner"
                };
            }
        }

        if (!user && email === defaultEmail && password === defaultPassword) {
            user = {
                id: "default-admin",
                email: defaultEmail,
                role: "owner"
            };
        }

        if (!user) {
            return res.status(401).json({ message: "Invalid login details." });
        }

        res.json({
            message: "Login successful.",
            token: createToken(user),
            role: user.role,
            email: user.email
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Login failed." });
    }
});

/* =====================================================
   PUBLIC APPLICATION SUBMISSION
===================================================== */

app.post(
    "/apply",
    upload.fields([
        { name: "cv", maxCount: 1 },
        { name: "extraFiles", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const cvFile = req.files?.cv?.[0] || null;
            const extraFile = req.files?.extraFiles?.[0] || null;

            const application = {
                fullName: clean(req.body.fullName),
                name: clean(req.body.fullName),
                email: clean(req.body.email),
                phone: clean(req.body.phone),
                address: clean(req.body.address),
                position: clean(req.body.position),
                availability: clean(req.body.availability),
                message: clean(req.body.message),
                status: "New",
                rating: 0,
                notes: "",
                shortlisted: false,
                invitationSent: false,
                reminderSent: false,
                offerSent: false,
                rejectionSent: false,
                cv: fileInfo(req, cvFile),
                extraFile: fileInfo(req, extraFile),
                createdAt: nowIso(),
                updatedAt: nowIso()
            };

            if (!application.fullName || !application.email || !application.position) {
                return res.status(400).json({ message: "Please complete all required fields." });
            }

            const docRef = await db.collection("applications").add(application);

            try {
                const emailResult = await sendTemplateEmail("applicationReceived", application);

                await docRef.update({
                    applicationReceivedSent: true,
                    applicationReceivedEmailId: emailResult.id || "",
                    lastCommunicationAction: "Application Received Email Sent",
                    lastCommunicationAt: nowIso()
                });
            } catch (emailError) {
                console.error("Application received email failed:", emailError);
            }

            res.json({
                message: "Application submitted successfully.",
                id: docRef.id
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Application could not be submitted." });
        }
    }
);

/* =====================================================
   ADMIN APPLICATIONS
===================================================== */

app.get("/api/admin/applications", requireAuth, async (req, res) => {
    try {
        const snapshot = await db.collection("applications").orderBy("createdAt", "desc").get();

        const applications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json(applications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load applications." });
    }
});

app.patch("/api/admin/applications/:id", requireAuth, requireEditor, async (req, res) => {
    try {
        const id = req.params.id;
        const ref = db.collection("applications").doc(id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Application not found." });
        }

        const updateData = {
            ...req.body,
            updatedAt: nowIso()
        };

        delete updateData.id;

        await ref.update(updateData);

        res.json({
            message: "Application updated successfully.",
            id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update application." });
    }
});

app.delete("/api/admin/applications/:id", requireAuth, requireEditor, async (req, res) => {
    try {
        await db.collection("applications").doc(req.params.id).delete();

        res.json({
            message: "Application deleted successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete application." });
    }
});

/* =====================================================
   ADMIN EMAIL ACTIONS
===================================================== */

async function getApplicationOr404(id, res) {
    const ref = db.collection("applications").doc(id);
    const doc = await ref.get();

    if (!doc.exists) {
        res.status(404).json({ message: "Application not found." });
        return null;
    }

    return {
        ref,
        application: {
            id: doc.id,
            ...doc.data()
        }
    };
}

async function handleInterviewInvite(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const interviewDate = clean(req.body.interviewDate);
        const interviewTime = clean(req.body.interviewTime);
        const interviewLocation = clean(req.body.interviewLocation);
        const interviewMessage = clean(req.body.interviewMessage);

        const updatedApplication = {
            ...application,
            interviewDate,
            interviewTime,
            interviewLocation,
            interviewMessage,
            status: "Interview Invited"
        };

        const emailResult = await sendTemplateEmail("interviewInvitation", updatedApplication);

        await ref.update({
            interviewDate,
            interviewTime,
            interviewLocation,
            interviewMessage,
            status: "Interview Invited",
            invitationSent: true,
            invitationSentAt: nowIso(),
            invitationEmailId: emailResult.id || "",
            lastCommunicationAction: "Interview Invitation Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        res.json({
            message: "Interview invitation sent successfully.",
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send interview invitation." });
    }
}

app.post("/api/admin/applications/:id/invite", requireAuth, requireEditor, handleInterviewInvite);
app.post("/api/admin/applications/:id/send-invite", requireAuth, requireEditor, handleInterviewInvite);
app.post("/api/admin/applications/:id/interview-invite", requireAuth, requireEditor, handleInterviewInvite);

async function handleInterviewReminder(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const emailResult = await sendTemplateEmail("interviewReminder", application);

        await ref.update({
            reminderSent: true,
            reminderSentAt: nowIso(),
            reminderEmailId: emailResult.id || "",
            lastCommunicationAction: "Interview Reminder Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        res.json({
            message: "Interview reminder sent successfully.",
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send interview reminder." });
    }
}

app.post("/api/admin/applications/:id/reminder", requireAuth, requireEditor, handleInterviewReminder);
app.post("/api/admin/applications/:id/interview-reminder", requireAuth, requireEditor, handleInterviewReminder);

async function handleOfferEmail(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const updatedApplication = {
            ...application,
            status: "Offer Made"
        };

        const emailResult = await sendTemplateEmail("offerEmail", updatedApplication);

        await ref.update({
            status: "Offer Made",
            offerSent: true,
            offerSentAt: nowIso(),
            offerEmailId: emailResult.id || "",
            lastCommunicationAction: "Offer Email Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        res.json({
            message: "Offer email sent successfully.",
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send offer email." });
    }
}

app.post("/api/admin/applications/:id/offer", requireAuth, requireEditor, handleOfferEmail);
app.post("/api/admin/applications/:id/send-offer", requireAuth, requireEditor, handleOfferEmail);

async function handleRejectionEmail(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const updatedApplication = {
            ...application,
            status: "Rejected"
        };

        const emailResult = await sendTemplateEmail("rejectionEmail", updatedApplication);

        await ref.update({
            status: "Rejected",
            rejectionSent: true,
            rejectionSentAt: nowIso(),
            rejectionEmailId: emailResult.id || "",
            lastCommunicationAction: "Rejection Email Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        res.json({
            message: "Rejection email sent successfully.",
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send rejection email." });
    }
}

app.post("/api/admin/applications/:id/reject", requireAuth, requireEditor, handleRejectionEmail);
app.post("/api/admin/applications/:id/rejection", requireAuth, requireEditor, handleRejectionEmail);

/* =====================================================
   VACANCIES
===================================================== */

function vacancyPayload(body) {
    return {
        title: clean(body.title),
        location: clean(body.location),
        type: clean(body.type),
        category: clean(body.category) || "General",
        salaryMin: clean(body.salaryMin),
        salaryMax: clean(body.salaryMax),
        closingDate: clean(body.closingDate),
        status: clean(body.status) || "Draft",
        description: clean(body.description),
        responsibilities: Array.isArray(body.responsibilities)
            ? body.responsibilities
            : clean(body.responsibilities).split(/\n+/).map(item => item.trim()).filter(Boolean),
        requirements: Array.isArray(body.requirements)
            ? body.requirements
            : clean(body.requirements).split(/\n+/).map(item => item.trim()).filter(Boolean),
        updatedAt: nowIso()
    };
}

app.get("/api/admin/vacancies", requireAuth, async (req, res) => {
    try {
        const snapshot = await db.collection("vacancies").orderBy("createdAt", "desc").get();

        res.json(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load vacancies." });
    }
});

app.get("/api/vacancies", async (req, res) => {
    try {
        const snapshot = await db.collection("vacancies").where("status", "==", "Published").get();

        const vacancies = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        vacancies.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        res.json(vacancies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load live vacancies." });
    }
});

app.get("/api/public/vacancies", async (req, res) => {
    try {
        const snapshot = await db.collection("vacancies").where("status", "==", "Published").get();

        const vacancies = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        vacancies.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

        res.json(vacancies);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load live vacancies." });
    }
});

app.post("/api/admin/vacancies", requireAuth, requireEditor, async (req, res) => {
    try {
        const payload = vacancyPayload(req.body);

        if (!payload.title) {
            return res.status(400).json({ message: "Job title is required." });
        }

        const docRef = await db.collection("vacancies").add({
            ...payload,
            createdAt: nowIso()
        });

        res.json({
            message: "Vacancy created successfully.",
            id: docRef.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to create vacancy." });
    }
});

app.patch("/api/admin/vacancies/:id", requireAuth, requireEditor, async (req, res) => {
    try {
        const payload = vacancyPayload(req.body);

        await db.collection("vacancies").doc(req.params.id).update(payload);

        res.json({
            message: "Vacancy updated successfully.",
            id: req.params.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update vacancy." });
    }
});

app.delete("/api/admin/vacancies/:id", requireAuth, requireEditor, async (req, res) => {
    try {
        await db.collection("vacancies").doc(req.params.id).delete();

        res.json({
            message: "Vacancy deleted successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete vacancy." });
    }
});

/* =====================================================
   CONTACT MESSAGES
===================================================== */

app.post("/api/contact", async (req, res) => {
    try {
        const message = {
            name: clean(req.body.name),
            email: clean(req.body.email),
            phone: clean(req.body.phone),
            subject: clean(req.body.subject),
            message: clean(req.body.message),
            createdAt: nowIso()
        };

        await db.collection("contactMessages").add(message);

        res.json({
            message: "Message sent successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to send message." });
    }
});

app.get("/api/admin/contact-messages", requireAuth, async (req, res) => {
    try {
        const snapshot = await db.collection("contactMessages").orderBy("createdAt", "desc").get();

        res.json(snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load contact messages." });
    }
});

/* =====================================================
   FALLBACK
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((req, res) => {
    res.status(404).json({
        message: "Route not found."
    });
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});