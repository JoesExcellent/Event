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

    interviewReminder7Day: {
        name: "7 Day Interview Reminder",
        subject: "Interview Reminder - 7 Days Remaining",
        body: `This is a friendly reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place in 7 days.

Interview Details
Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please contact us if you require any adjustments, have any questions, or need to rearrange.

We look forward to meeting you.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    interviewReminder24Hour: {
        name: "24 Hour Interview Reminder",
        subject: "Interview Reminder - Tomorrow",
        body: `This is a reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place tomorrow.

Interview Details
Date: {{interviewDate}}
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please arrive promptly and bring any documents or information requested during the recruitment process.

If you need assistance or need to contact us before your interview, please do so as soon as possible.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
    },

    interviewReminderSameDay: {
        name: "Same Day Interview Reminder",
        subject: "Interview Reminder - Today",
        body: `This is a reminder that your interview for the position of {{position}} with Joe's Excellent Events & Management is scheduled to take place today.

Interview Details
Time: {{interviewTime}}
Location: {{interviewLocation}}

Please aim to arrive 10-15 minutes early where possible.

We wish you every success and look forward to meeting you.

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

    hiredEmail: {
        name: "Employment Confirmation",
        subject: "Employment Confirmation - {{position}}",
        body: `We are delighted to confirm that you have been marked as hired for the position of {{position}} with Joe's Excellent Events & Management.

Our recruitment team will contact you with the next steps, onboarding information and any employment documents required.

We are very pleased to welcome you to the team and look forward to working with you.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`
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

function getTemplateCategory(templateId) {
    const categoryMap = {
        applicationReceived: "Application",
        interviewInvitation: "Interview",
        interviewReminder: "Interview",
        interviewReminder7Day: "Interview",
        interviewReminder24Hour: "Interview",
        interviewReminderSameDay: "Interview",
        offerEmail: "Offer",
        hiredEmail: "Hiring",
        rejectionEmail: "Rejection"
    };

    return categoryMap[templateId] || "General";
}

function normaliseTemplateForClient(templateId, template, source = "default") {
    return {
        id: templateId,
        name: template?.name || templateId,
        category: template?.category || getTemplateCategory(templateId),
        subject: template?.subject || "",
        body: template?.body || "",
        source,
        createdAt: template?.createdAt || "",
        updatedAt: template?.updatedAt || ""
    };
}

async function listEmailTemplatesHandler(req, res) {
    try {
        const templates = [];

        for (const templateId of Object.keys(defaultTemplates)) {
            const doc = await db.collection("emailTemplates").doc(templateId).get();
            const savedData = doc.exists ? doc.data() : {};
            const template = {
                ...defaultTemplates[templateId],
                ...savedData
            };

            templates.push(normaliseTemplateForClient(
                templateId,
                template,
                doc.exists ? "custom" : "default"
            ));
        }

        res.json({ templates });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load email templates." });
    }
}

async function updateEmailTemplateHandler(req, res) {
    try {
        const templateId = clean(req.params.id);

        if (!defaultTemplates[templateId]) {
            return res.status(404).json({ message: "Template not found." });
        }

        const subject = clean(req.body.subject);
        const body = clean(req.body.body);

        if (!subject || !body) {
            return res.status(400).json({ message: "Template subject and body are required." });
        }

        const payload = {
            name: defaultTemplates[templateId].name,
            category: getTemplateCategory(templateId),
            subject,
            body,
            updatedAt: nowIso(),
            updatedBy: req.user?.email || "system"
        };

        await db.collection("emailTemplates").doc(templateId).set(payload, { merge: true });

        res.json({
            message: "Email template saved successfully.",
            template: normaliseTemplateForClient(templateId, payload, "custom")
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to save email template." });
    }
}

async function restoreEmailTemplateHandler(req, res) {
    try {
        const templateId = clean(req.params.id);

        if (!defaultTemplates[templateId]) {
            return res.status(404).json({ message: "Template not found." });
        }

        await db.collection("emailTemplates").doc(templateId).delete();

        res.json({
            message: "Email template restored successfully.",
            template: normaliseTemplateForClient(templateId, defaultTemplates[templateId], "default")
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to restore email template." });
    }
}

app.get("/api/admin/email-templates", requireAuth, listEmailTemplatesHandler);
app.get("/api/email-templates", requireAuth, listEmailTemplatesHandler);
app.patch("/api/admin/email-templates/:id", requireAuth, requireEditor, updateEmailTemplateHandler);
app.patch("/api/email-templates/:id", requireAuth, requireEditor, updateEmailTemplateHandler);
app.post("/api/admin/email-templates/:id/restore", requireAuth, requireEditor, restoreEmailTemplateHandler);
app.post("/api/email-templates/:id/restore", requireAuth, requireEditor, restoreEmailTemplateHandler);


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


function formatInterviewDate(value) {
    const raw = clean(value);
    if (!raw) return "";

    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return raw;

    return date.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}

function formatInterviewTime(value) {
    const raw = clean(value);
    if (!raw) return "";

    const time = new Date(`2000-01-01T${raw}`);
    if (Number.isNaN(time.getTime())) return raw;

    return time.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    }).replace("am", "AM").replace("pm", "PM");
}

function formatInterviewLocation(value) {
    const raw = clean(value);
    if (!raw) return "";

    const normalised = raw.toLowerCase().trim();

    if (normalised === "teams" || normalised === "microsoft teams") {
        return "Microsoft Teams";
    }

    if (normalised === "zoom") {
        return "Zoom Meeting";
    }

    if (normalised === "telephone" || normalised === "phone") {
        return "Telephone Interview";
    }

    if (normalised === "in person" || normalised === "in-person") {
        return "In-person Interview";
    }

    return raw;
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
        interviewDate: formatInterviewDate(extraData.interviewDate || application.interviewDate || ""),
        interviewTime: formatInterviewTime(extraData.interviewTime || application.interviewTime || ""),
        interviewLocation: formatInterviewLocation(extraData.interviewLocation || application.interviewLocation || ""),
        rawInterviewDate: extraData.interviewDate || application.interviewDate || "",
        rawInterviewTime: extraData.interviewTime || application.interviewTime || "",
        rawInterviewLocation: extraData.interviewLocation || application.interviewLocation || "",
        ...extraData,
        interviewDate: formatInterviewDate(extraData.interviewDate || application.interviewDate || ""),
        interviewTime: formatInterviewTime(extraData.interviewTime || application.interviewTime || ""),
        interviewLocation: formatInterviewLocation(extraData.interviewLocation || application.interviewLocation || "")
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


function normaliseCommunicationForClient(doc) {
    return { id: doc.id, ...doc.data() };
}

async function logCommunication({
    applicationId = "",
    application = {},
    communicationType = "Communication",
    action = "Communication Sent",
    status = "Sent",
    emailId = "",
    subject = "",
    extra = {}
}) {
    try {
        const candidateName = application.fullName || application.name || extra.candidateName || "Candidate";
        const email = application.email || extra.email || "";
        const position = application.position || extra.position || "";
        const sentAt = nowIso();

        const record = {
            applicationId: applicationId || application.id || "",
            candidateId: applicationId || application.id || "",
            candidateName,
            email,
            position,
            communicationType,
            type: communicationType,
            action,
            status,
            emailId: emailId || "",
            subject: subject || "",
            sentAt,
            createdAt: sentAt,
            recruiterEmail: extra.recruiterEmail || "system",
            followUp: extra.followUp || "No urgent follow-up"
        };

        await db.collection("communications").add(record);
        return record;
    } catch (error) {
        console.error("Communication logging failed:", error);
        return null;
    }
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

async function adminLoginHandler(req, res) {
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
}

app.post("/api/admin/login", adminLoginHandler);
app.post("/admin/login", adminLoginHandler);

/* =====================================================
   PUBLIC APPLICATION SUBMISSION
===================================================== */

const applicationUpload = upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "extraFiles", maxCount: 1 }
]);

async function applicationSubmitHandler(req, res) {
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

                await logCommunication({
                    applicationId: docRef.id,
                    application: { id: docRef.id, ...application },
                    communicationType: "Application Received Email",
                    action: "Application Received Email Sent",
                    status: "Sent",
                    emailId: emailResult.id || ""
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

app.post("/apply", applicationUpload, applicationSubmitHandler);
app.post("/api/apply", applicationUpload, applicationSubmitHandler);


function normaliseApplicationForClient(doc) {
    const data = { id: doc.id, ...doc.data() };

    if (data.cv && typeof data.cv === "object") {
        data.cvFile = data.cv;
        data.cv = data.cv.url || data.cv.path || "";
    }

    if (data.extraFile && typeof data.extraFile === "object") {
        data.extraFileUrl = data.extraFile.url || data.extraFile.path || "";
    }

    return data;
}

function normaliseVacancyForClient(doc) {
    return { id: doc.id, ...doc.data() };
}

/* =====================================================
   ADMIN APPLICATIONS
===================================================== */

async function listApplicationsHandler(req, res) {
    try {
        const snapshot = await db.collection("applications").orderBy("createdAt", "desc").get();
        const applications = snapshot.docs.map(normaliseApplicationForClient);

        res.json({ applications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load applications." });
    }
}

app.get("/api/admin/applications", requireAuth, listApplicationsHandler);
app.get("/api/applications", requireAuth, listApplicationsHandler);


async function listCommunicationsHandler(req, res) {
    try {
        const snapshot = await db
            .collection("communications")
            .orderBy("sentAt", "desc")
            .limit(500)
            .get();

        const communications = snapshot.docs.map(normaliseCommunicationForClient);

        res.json({ communications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load communication records." });
    }
}

app.get("/api/admin/communications", requireAuth, listCommunicationsHandler);
app.get("/api/communications", requireAuth, listCommunicationsHandler);

async function updateApplicationHandler(req, res) {
    try {
        const id = req.params.id;
        const ref = db.collection("applications").doc(id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Application not found." });
        }

        const application = {
            id: doc.id,
            ...doc.data()
        };

        const updateData = {
            ...req.body,
            updatedAt: nowIso()
        };

        delete updateData.id;

        await ref.update(updateData);

        if (updateData.status && updateData.status !== application.status) {
            await logCommunication({
                applicationId: id,
                application: {
                    ...application,
                    ...updateData
                },
                communicationType: "Candidate Status",
                action: `Status Updated To ${updateData.status}`,
                status: "Recorded",
                emailId: "",
                extra: { recruiterEmail: req.user?.email || "system" }
            });
        }

        res.json({
            message: "Application updated successfully.",
            id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update application." });
    }
}

app.patch("/api/admin/applications/:id", requireAuth, requireEditor, updateApplicationHandler);
app.patch("/api/applications/:id", requireAuth, requireEditor, updateApplicationHandler);

async function deleteApplicationHandler(req, res) {
    try {
        await db.collection("applications").doc(req.params.id).delete();

        res.json({
            message: "Application deleted successfully."
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete application." });
    }
}

app.delete("/api/admin/applications/:id", requireAuth, requireEditor, deleteApplicationHandler);
app.delete("/api/applications/:id", requireAuth, requireEditor, deleteApplicationHandler);

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

        await logCommunication({
            applicationId: application.id,
            application: updatedApplication,
            communicationType: "Interview Invitation",
            action: "Interview Invitation Sent",
            status: "Sent",
            emailId: emailResult.id || "",
            extra: { recruiterEmail: req.user?.email || "system" }
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
app.post("/api/applications/:id/invite", requireAuth, requireEditor, handleInterviewInvite);

async function handleInterviewReminder(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const reminderType = String(req.body?.reminderType || "general").toLowerCase();

        const reminderMap = {
            "7day": {
                templateId: "interviewReminder7Day",
                action: "7 Day Interview Reminder Sent",
                responseMessage: "7 Day reminder sent successfully.",
                sentField: "sevenDayReminderSent",
                sentAtField: "sevenDayReminderSentAt",
                emailIdField: "sevenDayReminderEmailId"
            },
            "24hour": {
                templateId: "interviewReminder24Hour",
                action: "24 Hour Interview Reminder Sent",
                responseMessage: "24 Hour reminder sent successfully.",
                sentField: "twentyFourHourReminderSent",
                sentAtField: "twentyFourHourReminderSentAt",
                emailIdField: "twentyFourHourReminderEmailId"
            },
            "sameday": {
                templateId: "interviewReminderSameDay",
                action: "Same Day Interview Reminder Sent",
                responseMessage: "Same Day reminder sent successfully.",
                sentField: "sameDayReminderSent",
                sentAtField: "sameDayReminderSentAt",
                emailIdField: "sameDayReminderEmailId"
            },
            "general": {
                templateId: "interviewReminder",
                action: "Interview Reminder Sent",
                responseMessage: "Interview reminder sent successfully.",
                sentField: "reminderSent",
                sentAtField: "reminderSentAt",
                emailIdField: "reminderEmailId"
            }
        };

        const selectedReminder = reminderMap[reminderType] || reminderMap.general;

        const reminderData = {
            interviewDate: req.body?.interviewDate || application.interviewDate || "",
            interviewTime: req.body?.interviewTime || application.interviewTime || "",
            interviewLocation: req.body?.interviewLocation || application.interviewLocation || ""
        };

        const emailResult = await sendTemplateEmail(
            selectedReminder.templateId,
            application,
            reminderData
        );

        const updateData = {
            reminderSent: true,
            reminderSentAt: nowIso(),
            reminderEmailId: emailResult.id || "",
            reminderType,
            lastCommunicationAction: selectedReminder.action,
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        };

        updateData[selectedReminder.sentField] = true;
        updateData[selectedReminder.sentAtField] = nowIso();
        updateData[selectedReminder.emailIdField] = emailResult.id || "";

        await ref.update(updateData);

        res.json({
            message: selectedReminder.responseMessage,
            reminderType,
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send interview reminder." });
    }
}

app.post("/api/admin/applications/:id/reminder", requireAuth, requireEditor, handleInterviewReminder);
app.post("/api/admin/applications/:id/interview-reminder", requireAuth, requireEditor, handleInterviewReminder);
app.post("/api/applications/:id/reminder", requireAuth, requireEditor, handleInterviewReminder);

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
            offerResponseStatus: application.offerResponseStatus || "Offer Pending",
            contractStatus: application.contractStatus || "Sent",
            onboardingStatus: application.onboardingStatus || "Not Started",
            offerTrackingCreatedAt: application.offerTrackingCreatedAt || nowIso(),
            lastCommunicationAction: "Offer Email Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        await logCommunication({
            applicationId: application.id,
            application: updatedApplication,
            communicationType: "Offer Email",
            action: "Offer Email Sent",
            status: "Sent",
            emailId: emailResult.id || "",
            extra: { recruiterEmail: req.user?.email || "system" }
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
app.post("/api/applications/:id/offer", requireAuth, requireEditor, handleOfferEmail);

async function handleOfferTrackingUpdate(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const offerResponseStatus = clean(req.body.offerResponseStatus) || application.offerResponseStatus || "Offer Pending";
        const candidateStartDate = clean(req.body.candidateStartDate) || "";
        const contractStatus = clean(req.body.contractStatus) || "";
        const onboardingStatus = clean(req.body.onboardingStatus) || "";
        const offerOnboardingNotes = clean(req.body.offerOnboardingNotes) || "";

        const updateData = {
            offerResponseStatus,
            candidateStartDate,
            contractStatus,
            onboardingStatus,
            offerOnboardingNotes,
            offerTrackingUpdatedAt: nowIso(),
            lastCommunicationAction: `Offer Tracking Updated - ${offerResponseStatus}`,
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        };

        if (!application.offerTrackingCreatedAt) {
            updateData.offerTrackingCreatedAt = nowIso();
        }

        if (offerResponseStatus === "Offer Accepted" && !onboardingStatus) {
            updateData.onboardingStatus = "In Progress";
        }

        if (offerResponseStatus === "Offer Declined") {
            updateData.onboardingStatus = onboardingStatus || "Not Started";
        }

        await ref.update(updateData);

        await logCommunication({
            applicationId: application.id,
            application: {
                ...application,
                ...updateData
            },
            communicationType: "Offer Tracking",
            action: `Offer Tracking Updated - ${offerResponseStatus}`,
            status: "Recorded",
            emailId: "",
            extra: {
                recruiterEmail: req.user?.email || "system",
                candidateStartDate,
                contractStatus: updateData.contractStatus,
                onboardingStatus: updateData.onboardingStatus
            }
        });

        res.json({
            message: "Offer tracking updated successfully.",
            applicationId: application.id,
            offerResponseStatus,
            candidateStartDate,
            contractStatus: updateData.contractStatus,
            onboardingStatus: updateData.onboardingStatus
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to update offer tracking." });
    }
}

app.patch("/api/admin/applications/:id/offer-tracking", requireAuth, requireEditor, handleOfferTrackingUpdate);
app.patch("/api/applications/:id/offer-tracking", requireAuth, requireEditor, handleOfferTrackingUpdate);

async function handleHireEmail(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const updatedApplication = {
            ...application,
            status: "Hired"
        };

        const emailResult = await sendTemplateEmail("hiredEmail", updatedApplication);

        await ref.update({
            status: "Hired",
            hiredAt: nowIso(),
            hiredEmailSent: true,
            hiredEmailSentAt: nowIso(),
            hiredEmailId: emailResult.id || "",
            offerResponseStatus: application.offerResponseStatus || "Offer Accepted",
            onboardingStatus: application.onboardingStatus || "In Progress",
            lastCommunicationAction: "Employment Confirmation Email Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        });

        await logCommunication({
            applicationId: application.id,
            application: updatedApplication,
            communicationType: "Employment Confirmation Email",
            action: "Employment Confirmation Email Sent",
            status: "Sent",
            emailId: emailResult.id || "",
            extra: { recruiterEmail: req.user?.email || "system" }
        });

        res.json({
            message: "Candidate marked as hired and employment confirmation email sent.",
            emailId: emailResult.id || ""
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to mark candidate as hired." });
    }
}

app.post("/api/admin/applications/:id/hire", requireAuth, requireEditor, handleHireEmail);
app.post("/api/admin/applications/:id/hired", requireAuth, requireEditor, handleHireEmail);
app.post("/api/applications/:id/hire", requireAuth, requireEditor, handleHireEmail);

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

        await logCommunication({
            applicationId: application.id,
            application: updatedApplication,
            communicationType: "Rejection Email",
            action: "Rejection Email Sent",
            status: "Sent",
            emailId: emailResult.id || "",
            extra: { recruiterEmail: req.user?.email || "system" }
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
app.post("/api/applications/:id/rejection", requireAuth, requireEditor, handleRejectionEmail);
app.post("/api/applications/:id/reject", requireAuth, requireEditor, handleRejectionEmail);

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
        const vacancies = snapshot.docs.map(normaliseVacancyForClient);

        res.json({ vacancies });
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

        res.json({ vacancies });
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

        res.json({ vacancies });
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
        const body = req.body || {};
        const bodyKeys = Object.keys(body);

        let payload;

        if (bodyKeys.length === 1 && Object.prototype.hasOwnProperty.call(body, "status")) {
            payload = {
                status: clean(body.status) || "Draft",
                updatedAt: nowIso()
            };
        } else {
            payload = vacancyPayload(body, true);
        }

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
   AUTOMATED REMINDER SCHEDULING
===================================================== */

const scheduledReminderConfig = {
    "7day": {
        templateId: "interviewReminder7Day",
        label: "7 Day Interview Reminder",
        action: "7 Day Interview Reminder Sent",
        sentField: "sevenDayReminderSent",
        sentAtField: "sevenDayReminderSentAt",
        emailIdField: "sevenDayReminderEmailId",
        daysBefore: 7
    },
    "24hour": {
        templateId: "interviewReminder24Hour",
        label: "24 Hour Interview Reminder",
        action: "24 Hour Interview Reminder Sent",
        sentField: "twentyFourHourReminderSent",
        sentAtField: "twentyFourHourReminderSentAt",
        emailIdField: "twentyFourHourReminderEmailId",
        daysBefore: 1
    },
    "sameday": {
        templateId: "interviewReminderSameDay",
        label: "Same Day Interview Reminder",
        action: "Same Day Interview Reminder Sent",
        sentField: "sameDayReminderSent",
        sentAtField: "sameDayReminderSentAt",
        emailIdField: "sameDayReminderEmailId",
        daysBefore: 0
    }
};

function buildInterviewDateTime(interviewDate, interviewTime) {
    const date = clean(interviewDate);
    const time = clean(interviewTime) || "09:00";

    if (!date) return null;

    const candidateDate = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);

    if (Number.isNaN(candidateDate.getTime())) {
        return null;
    }

    return candidateDate;
}

function calculateReminderDueAt(interviewDate, interviewTime, reminderType) {
    const interviewDateTime = buildInterviewDateTime(interviewDate, interviewTime);
    const config = scheduledReminderConfig[reminderType];

    if (!interviewDateTime || !config) return "";

    const dueDate = new Date(interviewDateTime.getTime());
    dueDate.setDate(dueDate.getDate() - config.daysBefore);

    return dueDate.toISOString();
}

function normaliseReminderForClient(doc) {
    return { id: doc.id, ...doc.data() };
}

async function upsertReminderSchedule(application, reminderType, details, recruiterEmail) {
    const config = scheduledReminderConfig[reminderType];
    const dueAt = calculateReminderDueAt(details.interviewDate, details.interviewTime, reminderType);

    if (!config || !dueAt) return null;

    const applicationId = application.id || "";
    const existingSnapshot = await db.collection("reminderQueue")
        .where("applicationId", "==", applicationId)
        .where("reminderType", "==", reminderType)
        .limit(1)
        .get();

    const now = nowIso();
    const payload = {
        applicationId,
        candidateId: applicationId,
        candidateName: application.fullName || application.name || "Candidate",
        email: application.email || "",
        position: application.position || "",
        reminderType,
        reminderLabel: config.label,
        templateId: config.templateId,
        action: config.action,
        dueAt,
        scheduledFor: dueAt,
        status: "Scheduled",
        interviewDate: details.interviewDate || application.interviewDate || "",
        interviewTime: details.interviewTime || application.interviewTime || "",
        interviewLocation: details.interviewLocation || application.interviewLocation || "",
        recruiterEmail: recruiterEmail || "system",
        updatedAt: now
    };

    if (existingSnapshot.empty) {
        payload.createdAt = now;
        const ref = await db.collection("reminderQueue").add(payload);
        return { id: ref.id, ...payload };
    }

    const existingDoc = existingSnapshot.docs[0];
    const existingData = existingDoc.data();

    if (String(existingData.status || "").toLowerCase() === "sent") {
        return { id: existingDoc.id, ...existingData, skipped: true };
    }

    await existingDoc.ref.set(payload, { merge: true });
    return { id: existingDoc.id, ...existingData, ...payload };
}

async function scheduleInterviewRemindersHandler(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const details = {
            interviewDate: clean(req.body?.interviewDate) || application.interviewDate || "",
            interviewTime: clean(req.body?.interviewTime) || application.interviewTime || "",
            interviewLocation: clean(req.body?.interviewLocation) || application.interviewLocation || ""
        };

        if (!details.interviewDate) {
            return res.status(400).json({ message: "Interview date is required before reminders can be scheduled." });
        }

        const scheduled = [];

        for (const reminderType of ["7day", "24hour", "sameday"]) {
            const reminder = await upsertReminderSchedule(application, reminderType, details, req.user?.email || "system");
            if (reminder) scheduled.push(reminder);
        }

        await ref.update({
            interviewDate: details.interviewDate,
            interviewTime: details.interviewTime,
            interviewLocation: details.interviewLocation,
            reminderScheduleCreated: true,
            reminderScheduleCreatedAt: nowIso(),
            updatedAt: nowIso()
        });

        res.json({
            message: `${scheduled.length} interview reminders scheduled successfully.`,
            reminders: scheduled
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to schedule interview reminders." });
    }
}

async function listReminderQueueHandler(req, res) {
    try {
        const snapshot = await db.collection("reminderQueue")
            .orderBy("dueAt", "asc")
            .limit(500)
            .get();

        res.json({ reminders: snapshot.docs.map(normaliseReminderForClient) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load reminder queue." });
    }
}

async function sendReminderQueueItem(reminderId, recruiterEmail = "system") {
    const reminderRef = db.collection("reminderQueue").doc(reminderId);
    const reminderDoc = await reminderRef.get();

    if (!reminderDoc.exists) {
        throw new Error("Reminder record not found.");
    }

    const reminder = { id: reminderDoc.id, ...reminderDoc.data() };

    if (String(reminder.status || "").toLowerCase() === "sent") {
        return { reminder, alreadySent: true };
    }

    const found = await getApplicationOr404(reminder.applicationId, {
        status: () => ({ json: () => null })
    });

    if (!found) {
        throw new Error("Application linked to reminder was not found.");
    }

    const { ref, application } = found;
    const config = scheduledReminderConfig[reminder.reminderType] || scheduledReminderConfig["7day"];

    const reminderData = {
        interviewDate: reminder.interviewDate || application.interviewDate || "",
        interviewTime: reminder.interviewTime || application.interviewTime || "",
        interviewLocation: reminder.interviewLocation || application.interviewLocation || ""
    };

    try {
        await reminderRef.update({
            status: "Sending",
            processingAt: nowIso(),
            updatedAt: nowIso()
        });

        const emailResult = await sendTemplateEmail(config.templateId, application, reminderData);
        const sentAt = nowIso();

        const applicationUpdate = {
            reminderSent: true,
            reminderSentAt: sentAt,
            reminderEmailId: emailResult.id || "",
            reminderType: reminder.reminderType,
            lastCommunicationAction: config.action,
            lastCommunicationAt: sentAt,
            updatedAt: sentAt
        };

        applicationUpdate[config.sentField] = true;
        applicationUpdate[config.sentAtField] = sentAt;
        applicationUpdate[config.emailIdField] = emailResult.id || "";

        await ref.update(applicationUpdate);

        await reminderRef.update({
            status: "Sent",
            sentAt,
            emailId: emailResult.id || "",
            updatedAt: sentAt
        });

        await logCommunication({
            applicationId: application.id,
            application,
            communicationType: config.label,
            action: config.action,
            status: "Sent",
            emailId: emailResult.id || "",
            extra: { recruiterEmail }
        });

        return { reminder: { ...reminder, status: "Sent", sentAt }, emailId: emailResult.id || "" };
    } catch (error) {
        await reminderRef.update({
            status: "Failed",
            errorMessage: error.message || "Reminder send failed.",
            updatedAt: nowIso()
        });

        throw error;
    }
}

async function sendReminderQueueItemHandler(req, res) {
    try {
        const result = await sendReminderQueueItem(req.params.id, req.user?.email || "system");

        res.json({
            message: result.alreadySent ? "Reminder had already been sent." : "Scheduled reminder sent successfully.",
            emailId: result.emailId || "",
            reminder: result.reminder
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send scheduled reminder." });
    }
}

async function processDueRemindersCore(recruiterEmail = "system", options = {}) {
    const now = nowIso();
    const batchLimit = Number(options.batchLimit || 25);

    const snapshot = await db.collection("reminderQueue")
        .orderBy("dueAt", "asc")
        .limit(100)
        .get();

    const dueDocs = snapshot.docs.filter(doc => {
        const data = doc.data();
        const status = String(data.status || "Scheduled").toLowerCase();
        return status !== "sent" &&
               status !== "cancelled" &&
               status !== "failed" &&
               String(data.dueAt || "") <= now;
    }).slice(0, batchLimit);

    let sent = 0;
    let failed = 0;
    const results = [];

    for (const doc of dueDocs) {
        try {
            const result = await sendReminderQueueItem(doc.id, recruiterEmail);
            sent += result.alreadySent ? 0 : 1;
            results.push({ id: doc.id, status: result.alreadySent ? "Already Sent" : "Sent" });
        } catch (error) {
            console.error("Due reminder failed:", error);
            failed += 1;
            results.push({ id: doc.id, status: "Failed", message: error.message || "Reminder failed." });
        }
    }

    return {
        message: `${sent} due reminders sent. ${failed} failed.`,
        checkedAt: now,
        dueCount: dueDocs.length,
        sent,
        failed,
        results
    };
}

async function processDueRemindersHandler(req, res) {
    try {
        const result = await processDueRemindersCore(req.user?.email || "system");
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to process due reminders." });
    }
}

app.get("/api/admin/reminder-queue", requireAuth, listReminderQueueHandler);
app.get("/api/reminder-queue", requireAuth, listReminderQueueHandler);
app.post("/api/admin/applications/:id/schedule-reminders", requireAuth, requireEditor, scheduleInterviewRemindersHandler);
app.post("/api/applications/:id/schedule-reminders", requireAuth, requireEditor, scheduleInterviewRemindersHandler);
app.post("/api/admin/reminder-queue/:id/send", requireAuth, requireEditor, sendReminderQueueItemHandler);
app.post("/api/reminder-queue/:id/send", requireAuth, requireEditor, sendReminderQueueItemHandler);
app.post("/api/admin/reminders/process-due", requireAuth, requireEditor, processDueRemindersHandler);
app.post("/api/reminders/process-due", requireAuth, requireEditor, processDueRemindersHandler);


/* =====================================================
   PHASE 5A.1 - CANDIDATE SELF-SERVICE PORTAL
===================================================== */

function createCandidateToken(application) {
    return jwt.sign(
        {
            role: "candidate",
            applicationId: application.id,
            email: application.email
        },
        JWT_SECRET,
        { expiresIn: "12h" }
    );
}

function requireCandidateAuth(req, res, next) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Candidate login required." });
    }

    try {
        const payload = jwt.verify(header.replace("Bearer ", ""), JWT_SECRET);

        if (!payload || payload.role !== "candidate" || !payload.applicationId) {
            return res.status(401).json({ message: "Invalid candidate login." });
        }

        req.candidate = payload;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Candidate login expired. Please sign in again." });
    }
}

function cleanCandidateApplication(application) {
    return {
        id: application.id || "",
        fullName: application.fullName || application.name || "Candidate",
        name: application.name || application.fullName || "Candidate",
        email: application.email || "",
        phone: application.phone || "",
        address: application.address || "",
        position: application.position || "N/A",
        availability: application.availability || "N/A",
        status: application.status || "New",
        createdAt: application.createdAt || "",
        updatedAt: application.updatedAt || "",
        interviewDate: application.interviewDate || "",
        interviewTime: application.interviewTime || "",
        interviewLocation: application.interviewLocation || "",
        interviewStatus: application.interviewStatus || (application.invitationSent ? "Interview Invitation Sent" : "Not Scheduled"),
        interviewResponse: application.interviewResponse || "pending",
        interviewResponseDate: application.interviewResponseDate || "",
        invitationSent: Boolean(application.invitationSent),
        reminderSent: Boolean(application.reminderSent),
        offerResponseStatus: application.offerResponseStatus || "Not Yet Recorded",
        candidateStartDate: application.candidateStartDate || "",
        contractStatus: application.contractStatus || "Not Sent",
        onboardingStatus: application.onboardingStatus || "Not Started",
        welcomePackStatus: application.welcomePackStatus || "Not Sent",
        handbookStatus: application.handbookStatus || "Not Sent",
        rtwStatus: application.rtwStatus || "Pending",
        dbsStatus: application.dbsStatus || "Not Required",
        trainingStatus: application.trainingStatus || "Not Started",
        inductionDate: application.inductionDate || "",
        inductionStatus: application.inductionStatus || "Not Scheduled",
        readyToStart: application.readyToStart || "No",
        portalAccessStatus: application.portalAccessStatus || "Not Created",
        documentDownloadStatus: application.documentDownloadStatus || "Not Available",
        contractAcceptanceStatus: application.contractAcceptanceStatus || "Not Sent",
        eSignatureStatus: application.eSignatureStatus || "Not Required",
        selfServiceStatus: application.selfServiceStatus || "Not Enabled",
        portalAccessDate: application.portalAccessDate || "",
        portalAccessNotes: application.portalAccessNotes || "",
        lastCommunicationAction: application.lastCommunicationAction || "No recent communication recorded.",
        lastCommunicationAt: application.lastCommunicationAt || ""
    };
}

async function findCandidateApplicationByEmail(email) {
    const requestedEmail = clean(email).toLowerCase();

    if (!requestedEmail) return null;

    let snapshot = await db
        .collection("applications")
        .where("email", "==", requestedEmail)
        .limit(1)
        .get();

    if (snapshot.empty) {
        snapshot = await db
            .collection("applications")
            .where("email", "==", clean(email))
            .limit(1)
            .get();
    }

    if (snapshot.empty) {
        return null;
    }

    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data()
    };
}

app.post("/api/candidate/login", async (req, res) => {
    try {
        const email = clean(req.body.email);

        if (!email) {
            return res.status(400).json({ message: "Please enter your email address." });
        }

        const application = await findCandidateApplicationByEmail(email);

        if (!application) {
            return res.status(404).json({ message: "No application was found for that email address." });
        }

        const token = createCandidateToken(application);

        res.json({
            message: "Candidate login successful.",
            token,
            candidate: cleanCandidateApplication(application)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Candidate login failed." });
    }
});

app.get("/api/candidate/profile", requireCandidateAuth, async (req, res) => {
    try {
        const doc = await db.collection("applications").doc(req.candidate.applicationId).get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Candidate application not found." });
        }

        const application = {
            id: doc.id,
            ...doc.data()
        };

        if ((application.email || "").toLowerCase() !== (req.candidate.email || "").toLowerCase()) {
            return res.status(403).json({ message: "Candidate profile mismatch." });
        }

        res.json({
            candidate: cleanCandidateApplication(application)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load candidate profile." });
    }
});


app.patch("/api/candidate/interview-response", requireCandidateAuth, async (req, res) => {
    try {
        const response = clean(req.body.response);

        if (response !== "accepted") {
            return res.status(400).json({ message: "Invalid interview response." });
        }

        const ref = db.collection("applications").doc(req.candidate.applicationId);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Candidate application not found." });
        }

        const application = {
            id: doc.id,
            ...doc.data()
        };

        if ((application.email || "").toLowerCase() !== (req.candidate.email || "").toLowerCase()) {
            return res.status(403).json({ message: "Candidate profile mismatch." });
        }

        const updatedAt = nowIso();
        const updateData = {
            interviewResponse: "accepted",
            interviewResponseDate: updatedAt,
            interviewStatus: "Confirmed By Candidate",
            lastCommunicationAction: "Candidate confirmed interview attendance.",
            lastCommunicationAt: updatedAt,
            updatedAt
        };

        await ref.update(updateData);

        const updatedDoc = await ref.get();
        const updatedApplication = {
            id: updatedDoc.id,
            ...updatedDoc.data()
        };

        res.json({
            message: "Interview attendance confirmed.",
            candidate: cleanCandidateApplication(updatedApplication)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to confirm interview attendance." });
    }
});

/* =====================================================
   CONTACT MESSAGES
===================================================== */



/* =====================================================
   PHASE 4F - CANDIDATE PORTAL ACCESS
===================================================== */

async function handlePortalAccessUpdate(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        const portalAccessStatus = clean(req.body.portalAccessStatus) || "";
        const documentDownloadStatus = clean(req.body.documentDownloadStatus) || "";
        const contractAcceptanceStatus = clean(req.body.contractAcceptanceStatus) || "";
        const eSignatureStatus = clean(req.body.eSignatureStatus) || "";
        const selfServiceStatus = clean(req.body.selfServiceStatus) || "";
        const portalAccessDate = clean(req.body.portalAccessDate) || "";
        const portalAccessNotes = clean(req.body.portalAccessNotes) || "";

        const updateData = {
            portalAccessStatus,
            documentDownloadStatus,
            contractAcceptanceStatus,
            eSignatureStatus,
            selfServiceStatus,
            portalAccessDate,
            portalAccessNotes,
            portalAccessUpdatedAt: nowIso(),
            lastCommunicationAction: `Portal Access Updated - ${portalAccessStatus || "Recorded"}`,
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        };

        if (!application.portalAccessCreatedAt) {
            updateData.portalAccessCreatedAt = nowIso();
        }

        await ref.update(updateData);

        await logCommunication({
            applicationId: application.id,
            application: { ...application, ...updateData },
            communicationType: "Candidate Portal",
            action: `Portal Access Updated - ${portalAccessStatus || "Recorded"}`,
            status: "Recorded",
            emailId: "",
            extra: { recruiterEmail: req.user?.email || "system" }
        });

        res.json({
            message: "Candidate portal access saved successfully.",
            application: { ...application, ...updateData }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to save candidate portal access." });
    }
}

async function handlePortalInvite(req, res) {
    try {
        const found = await getApplicationOr404(req.params.id, res);
        if (!found) return;

        const { ref, application } = found;

        if (!application.email) {
            return res.status(400).json({ message: "Candidate email address is missing." });
        }

        const portalAccessStatus = clean(req.body.portalAccessStatus) || "Invite Sent";
        const documentDownloadStatus = clean(req.body.documentDownloadStatus) || "Available";
        const contractAcceptanceStatus = clean(req.body.contractAcceptanceStatus) || application.contractAcceptanceStatus || "Sent";
        const eSignatureStatus = clean(req.body.eSignatureStatus) || application.eSignatureStatus || "Pending";
        const selfServiceStatus = clean(req.body.selfServiceStatus) || "Enabled";
        const portalAccessDate = clean(req.body.portalAccessDate) || new Date().toISOString().slice(0, 10);
        const portalAccessNotes = clean(req.body.portalAccessNotes) || application.portalAccessNotes || "";

        const candidateName = application.fullName || application.name || "Candidate";
        const subject = `Candidate Portal Access - ${application.position || "Onboarding"}`;
        const body = `Your candidate portal access has been prepared.

You will be able to review onboarding documents, employment information, contract status and first day instructions through the portal.

Position: ${application.position || "N/A"}
Start Date: ${application.candidateStartDate || "To be confirmed"}

Please check your onboarding information carefully and contact us if anything needs to be updated.

Kind regards,

Recruitment Team
Joe's Excellent Events & Management`;

        const emailResult = await sendEmail({
            to: application.email,
            subject,
            html: buildEmailHtml("Candidate Portal Access", candidateName, body)
        });

        const updateData = {
            portalAccessStatus,
            documentDownloadStatus,
            contractAcceptanceStatus,
            eSignatureStatus,
            selfServiceStatus,
            portalAccessDate,
            portalAccessNotes,
            portalInviteSentAt: nowIso(),
            portalAccessUpdatedAt: nowIso(),
            lastCommunicationAction: "Candidate Portal Invite Sent",
            lastCommunicationAt: nowIso(),
            updatedAt: nowIso()
        };

        if (!application.portalAccessCreatedAt) {
            updateData.portalAccessCreatedAt = nowIso();
        }

        await ref.update(updateData);

        await logCommunication({
            applicationId: application.id,
            application: { ...application, ...updateData },
            communicationType: "Candidate Portal Invite",
            action: "Candidate Portal Invite Sent",
            status: "Sent",
            emailId: emailResult.id || "",
            subject,
            extra: { recruiterEmail: req.user?.email || "system" }
        });

        res.json({
            message: "Candidate portal invite sent successfully.",
            emailId: emailResult.id || "",
            application: { ...application, ...updateData }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message || "Failed to send candidate portal invite." });
    }
}

app.patch("/api/admin/applications/:id/portal-access", requireAuth, requireEditor, handlePortalAccessUpdate);
app.patch("/api/applications/:id/portal-access", requireAuth, requireEditor, handlePortalAccessUpdate);
app.post("/api/admin/applications/:id/portal-invite", requireAuth, requireEditor, handlePortalInvite);
app.post("/api/applications/:id/portal-invite", requireAuth, requireEditor, handlePortalInvite);

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

async function listContactMessagesHandler(req, res) {
    try {
        const snapshot = await db.collection("contactMessages").orderBy("createdAt", "desc").get();
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.json({ messages });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load contact messages." });
    }
}

async function updateContactMessageHandler(req, res) {
    try {
        await db.collection("contactMessages").doc(req.params.id).update({
            ...req.body,
            updatedAt: nowIso()
        });

        res.json({ message: "Contact message updated successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update contact message." });
    }
}

async function deleteContactMessageHandler(req, res) {
    try {
        await db.collection("contactMessages").doc(req.params.id).delete();

        res.json({ message: "Contact message deleted successfully." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete contact message." });
    }
}

app.get("/api/admin/contact-messages", requireAuth, listContactMessagesHandler);
app.get("/api/contact-messages", requireAuth, listContactMessagesHandler);
app.patch("/api/contact-messages/:id", requireAuth, requireEditor, updateContactMessageHandler);
app.delete("/api/contact-messages/:id", requireAuth, requireEditor, deleteContactMessageHandler);
app.patch("/api/admin/contact-messages/:id", requireAuth, requireEditor, updateContactMessageHandler);
app.delete("/api/admin/contact-messages/:id", requireAuth, requireEditor, deleteContactMessageHandler);

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
   AUTOMATIC REMINDER PROCESSOR
===================================================== */

let automaticReminderProcessorRunning = false;

async function runAutomaticReminderProcessor() {
    if (automaticReminderProcessorRunning) return;

    automaticReminderProcessorRunning = true;

    try {
        const result = await processDueRemindersCore("automatic-reminder-processor", { batchLimit: 25 });

        if (result.dueCount > 0 || result.failed > 0) {
            console.log(`[Reminder Processor] ${result.message}`);
        }
    } catch (error) {
        console.error("Automatic reminder processor failed:", error);
    } finally {
        automaticReminderProcessorRunning = false;
    }
}

const automaticReminderProcessorEnabled = String(process.env.AUTO_REMINDER_PROCESSOR_ENABLED || "true").toLowerCase() !== "false";
const automaticReminderProcessorMinutes = Math.max(1, Number(process.env.AUTO_REMINDER_PROCESSOR_MINUTES || 5));

if (automaticReminderProcessorEnabled) {
    setInterval(runAutomaticReminderProcessor, automaticReminderProcessorMinutes * 60 * 1000);
    setTimeout(runAutomaticReminderProcessor, 15000);
    console.log(`Automatic reminder processor active every ${automaticReminderProcessorMinutes} minute(s).`);
}

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});