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

Application Reference: {{applicationReference}}

Please keep this reference safe. You will need it with your email address to access your Candidate Portal.

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

Application Reference: {{applicationReference}}

Please keep this reference safe. You will need it with your email address to access your Candidate Portal.

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

function getRecruiterNotificationEmail() {
    return process.env.RECRUITER_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || "joseph.eldridge1964@gmail.com";
}

function maskApplicationReference(reference) {
    const ref = String(reference || "").trim();

    if (!ref) {
        return "N/A";
    }

    if (ref.length <= 4) {
        return "****";
    }

    const visibleEnding = ref.slice(-4);
    const maskedLength = Math.max(ref.length - 4, 4);

    return `${"*".repeat(maskedLength)}${visibleEnding}`;
}

async function sendRecruiterInterviewResponseNotification(application, responseData, responseValue, timestamp) {
    const recruiterEmail = getRecruiterNotificationEmail();
    const candidateName = application.fullName || application.name || "Candidate";
    const candidateEmail = application.email || "N/A";
    const position = application.position || "N/A";
    const interviewDate = application.interviewDate || "N/A";
    const interviewTime = application.interviewTime || "N/A";
    const interviewLocation = application.interviewLocation || "N/A";
    const maskedReference = maskApplicationReference(application.id || application.applicationReference || "");
    const responseLabel = responseValue === "declined" ? "Declined" : "Accepted";

    const subject = `Candidate Interview ${responseLabel} - ${candidateName}`;

    const body = `A candidate has responded to an interview invitation through the Candidate Portal.

Candidate Name: ${candidateName}
Candidate Email: ${candidateEmail}
Position: ${position}
Application Reference: ${maskedReference}
Interview Date: ${interviewDate}
Interview Time: ${interviewTime}
Interview Location: ${interviewLocation}
Candidate Response: ${responseData.interviewResponse}
Response Recorded At: ${timestamp}

Please review the candidate record in the admin dashboard.

Kind regards,

Candidate Portal
Joe's Excellent Events & Management`;

    return sendEmail({
        to: recruiterEmail,
        subject,
        html: buildEmailHtml(`Candidate Interview ${responseLabel}`, "Recruitment Team", body)
    });
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
        applicationReference: application.id || application.applicationReference || application.applicationId || "",
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


async function logAudit({
    actionType = "",
    actorType = "SYSTEM",
    actorEmail = "",
    candidateId = "",
    candidateName = "",
    candidateEmail = "",
    description = "",
    extra = {}
}) {
    try {
        const timestamp = nowIso();

        const record = {
            actionType,
            actorType,
            actorEmail,
            candidateId,
            candidateName,
            candidateEmail,
            description,
            createdAt: timestamp,
            updatedAt: timestamp,
            extra
        };

        await db.collection("auditLogs").add(record);
        return record;
    } catch (error) {
        console.error("Audit logging failed:", error);
        return null;
    }
}


async function createNotification({
    type = "",
    title = "",
    candidateId = "",
    candidateName = "",
    candidateEmail = "",
    candidatePosition = "",
    message = "",
    actorType = "SYSTEM",
    actorEmail = "",
    source = "system",
    extra = {}
}) {
    try {
        const timestamp = nowIso();

        const record = {
            type,
            title: title || type,
            candidateId,
            candidateName,
            candidateEmail,
            candidatePosition,
            message,
            actorType,
            actorEmail,
            source,
            read: false,
            archived: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            extra
        };

        await db.collection("notifications").add(record);
        return record;
    } catch (error) {
        console.error("Notification creation failed:", error);
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

        await logAudit({
            actionType: "ADMIN_LOGIN",
            actorType: "ADMIN",
            actorEmail: user.email,
            description: `Admin login successful for ${user.email}.`,
            extra: {
                role: user.role,
                adminId: user.id
            }
        });

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

            const matchedVacancy = await findVacancyForApplication(application.position);

            if (matchedVacancy) {
                application.vacancyId = matchedVacancy.id;
                application.vacancyTitle = matchedVacancy.title || application.position;
                application.vacancyCategory = matchedVacancy.category || "General";
                application.vacancyStatusAtApplication = matchedVacancy.status || "Published";
            }

            const docRef = await db.collection("applications").add(application);

            try {
                const emailResult = await sendTemplateEmail("applicationReceived", { id: docRef.id, ...application });

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


            await createNotification({
                type: "NEW_APPLICATION",
                title: "New Application Received",
                candidateId: docRef.id,
                candidateName: application.fullName || application.name || "Candidate",
                candidateEmail: application.email || "",
                candidatePosition: application.position || "",
                message: `${application.fullName || application.name || "Candidate"} applied for ${application.position || "a role"}.`,
                actorType: "CANDIDATE",
                actorEmail: application.email || "",
                source: "Application Form",
                extra: {
                    phone: application.phone || "",
                    availability: application.availability || ""
                }
            });

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

function vacancyMatchKey(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function getApplicationStatusBucket(application) {
    return String(application.status || "New").trim();
}

function applicationBelongsToVacancy(application, vacancy) {
    if (!application || !vacancy) return false;

    if (application.vacancyId && vacancy.id && String(application.vacancyId) === String(vacancy.id)) {
        return true;
    }

    const applicationPosition = vacancyMatchKey(application.position || application.vacancyTitle || application.role);
    const vacancyTitle = vacancyMatchKey(vacancy.title);

    return Boolean(applicationPosition && vacancyTitle && applicationPosition === vacancyTitle);
}

function buildVacancyIntelligence(vacancies = [], applications = []) {
    return vacancies.map(vacancy => {
        const matchedApplications = applications.filter(application => applicationBelongsToVacancy(application, vacancy));

        const intelligence = {
            applicationsReceived: matchedApplications.length,
            shortlisted: matchedApplications.filter(app => app.shortlisted === true || getApplicationStatusBucket(app) === "Shortlisted").length,
            interviewInvited: matchedApplications.filter(app => {
                const status = getApplicationStatusBucket(app);
                return status === "Interview Invited" || status === "Interview Completed" || status === "To Be Interviewed";
            }).length,
            offerMade: matchedApplications.filter(app => {
                const status = getApplicationStatusBucket(app);
                const response = String(app.offerResponseStatus || "");
                return ["Offer Made", "Offer Accepted", "Offer Declined", "Hired"].includes(status) || response.includes("Offer") || app.offerSent === true;
            }).length,
            hired: matchedApplications.filter(app => getApplicationStatusBucket(app) === "Hired").length,
            rejected: matchedApplications.filter(app => getApplicationStatusBucket(app) === "Rejected").length
        };

        intelligence.conversionRate = intelligence.applicationsReceived
            ? Number(((intelligence.hired / intelligence.applicationsReceived) * 100).toFixed(1))
            : 0;

        return {
            ...vacancy,
            intelligence
        };
    });
}

async function findVacancyForApplication(position) {
    const cleanPosition = clean(position);

    if (!cleanPosition) return null;

    try {
        const snapshot = await db
            .collection("vacancies")
            .where("title", "==", cleanPosition)
            .limit(1)
            .get();

        if (snapshot.empty) return null;

        const doc = snapshot.docs[0];
        return normaliseVacancyForClient(doc);
    } catch (error) {
        console.error("Vacancy lookup failed:", error);
        return null;
    }
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



async function listAuditLogsHandler(req, res) {
    try {
        const snapshot = await db
            .collection("auditLogs")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const auditLogs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ auditLogs });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load audit trail records." });
    }
}

app.get("/api/admin/audit-logs", requireAuth, listAuditLogsHandler);


async function listNotificationsHandler(req, res) {
    try {
        const snapshot = await db
            .collection("notifications")
            .orderBy("createdAt", "desc")
            .limit(50)
            .get();

        const notifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.json({ notifications });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load notifications." });
    }
}

app.get("/api/admin/notifications", requireAuth, listNotificationsHandler);


async function updateNotificationStatusHandler(req, res) {
    try {
        const { id } = req.params;
        const { read, archived } = req.body || {};

        if (!id) {
            return res.status(400).json({ message: "Notification ID is required." });
        }

        const updateData = { updatedAt: nowIso() };

        if (typeof read === "boolean") updateData.read = read;
        if (typeof archived === "boolean") updateData.archived = archived;

        await db.collection("notifications").doc(id).update(updateData);

        await logAudit({
            actionType: "NOTIFICATION_UPDATED",
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            candidateId: id,
            candidateName: "Notification Centre",
            candidateEmail: "",
            description: "Notification status updated from the Admin Dashboard.",
            metadata: updateData
        });

        res.json({ message: "Notification updated successfully.", id, updateData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to update notification." });
    }
}

app.patch("/api/admin/notifications/:id", requireAuth, updateNotificationStatusHandler);



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


function applyOfferStateSynchronisation(updateData, application = {}) {
    const nextStatus = clean(updateData.status || application.status || "");
    const nextOfferResponse = clean(updateData.offerResponseStatus || application.offerResponseStatus || "");

    if (nextStatus === "Offer Made") {
        updateData.offerResponseStatus = nextOfferResponse && nextOfferResponse !== "Not Yet Recorded" ? nextOfferResponse : "Offer Pending";
        if (!updateData.contractStatus && !application.contractStatus) updateData.contractStatus = "Sent";
        if (!updateData.onboardingStatus && !application.onboardingStatus) updateData.onboardingStatus = "Not Started";
        if (!application.offerTrackingCreatedAt && !updateData.offerTrackingCreatedAt) updateData.offerTrackingCreatedAt = nowIso();
    }

    if (nextStatus === "Offer Accepted" || nextOfferResponse === "Offer Accepted") {
        updateData.status = nextStatus === "Hired" ? "Hired" : "Offer Accepted";
        updateData.offerResponseStatus = "Offer Accepted";
        if (!updateData.contractStatus && !application.contractStatus) updateData.contractStatus = "Sent";
        if (!updateData.onboardingStatus && !application.onboardingStatus) updateData.onboardingStatus = "In Progress";
        if (!application.offerTrackingCreatedAt && !updateData.offerTrackingCreatedAt) updateData.offerTrackingCreatedAt = nowIso();
    }

    if (nextStatus === "Offer Declined" || nextOfferResponse === "Offer Declined") {
        updateData.status = "Offer Declined";
        updateData.offerResponseStatus = "Offer Declined";
        updateData.onboardingStatus = updateData.onboardingStatus || application.onboardingStatus || "Not Started";
        if (!application.offerTrackingCreatedAt && !updateData.offerTrackingCreatedAt) updateData.offerTrackingCreatedAt = nowIso();
    }

    if (nextStatus === "Hired") {
        updateData.status = "Hired";
        updateData.offerResponseStatus = "Offer Accepted";
        updateData.contractStatus = updateData.contractStatus || application.contractStatus || "Completed";
        updateData.onboardingStatus = updateData.onboardingStatus || application.onboardingStatus || "In Progress";
        if (!application.offerTrackingCreatedAt && !updateData.offerTrackingCreatedAt) updateData.offerTrackingCreatedAt = nowIso();
    }

    return updateData;
}

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

        applyOfferStateSynchronisation(updateData, application);

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
            offerResponseStatus: ["Offer Accepted", "Offer Declined"].includes(application.offerResponseStatus) ? application.offerResponseStatus : "Offer Pending",
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

        if (offerResponseStatus === "Offer Pending") {
            updateData.status = application.status || "Offer Made";
        }

        if (offerResponseStatus === "Offer Accepted") {
            updateData.status = application.status === "Hired" ? "Hired" : "Offer Accepted";
            updateData.onboardingStatus = onboardingStatus || application.onboardingStatus || "In Progress";
            updateData.contractStatus = contractStatus || application.contractStatus || "Sent";
        }

        if (offerResponseStatus === "Offer Declined") {
            updateData.status = "Offer Declined";
            updateData.onboardingStatus = onboardingStatus || application.onboardingStatus || "Not Started";
        }

        if (!application.offerTrackingCreatedAt) {
            updateData.offerTrackingCreatedAt = nowIso();
        }

        applyOfferStateSynchronisation(updateData, application);

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

        if (offerResponseStatus === "Offer Accepted" || offerResponseStatus === "Offer Declined") {
            await logAudit({
                actionType: offerResponseStatus === "Offer Accepted" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                actorType: req.user?.email ? "ADMIN" : "SYSTEM",
                actorEmail: req.user?.email || "system",
                candidateId: application.id,
                candidateName: application.fullName || application.name || "Candidate",
                candidateEmail: application.email || "",
                description: `${application.fullName || application.name || "Candidate"} offer response recorded as ${offerResponseStatus}.`,
                extra: {
                    candidateStartDate,
                    contractStatus: updateData.contractStatus,
                    onboardingStatus: updateData.onboardingStatus
                }
            });

            await createNotification({
                type: offerResponseStatus === "Offer Accepted" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                title: offerResponseStatus,
                candidateId: application.id,
                candidateName: application.fullName || application.name || "Candidate",
                candidateEmail: application.email || "",
                candidatePosition: application.position || "",
                message: `${application.fullName || application.name || "Candidate"} offer response recorded as ${offerResponseStatus}.`,
                actorType: req.user?.email ? "ADMIN" : "SYSTEM",
                actorEmail: req.user?.email || "system",
                source: "Admin Dashboard",
                extra: {
                    candidateStartDate,
                    contractStatus: updateData.contractStatus,
                    onboardingStatus: updateData.onboardingStatus
                }
            });

        }

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

        const hireTimestamp = nowIso();
        const hireDate = new Date().toISOString().slice(0, 10);
        const existingEmploymentNotes = clean(application.employmentNotes || "");
        const hiredNote = "Candidate marked as hired. Employment confirmation email sent.";
        const employmentNotes = existingEmploymentNotes
            ? `${existingEmploymentNotes}\n${hiredNote}`
            : hiredNote;

        const updatedApplication = {
            ...application,
            status: "Hired",
            offerResponseStatus: "Offer Accepted",
            employmentStatus: "Hired",
            employmentConfirmationStatus: "Confirmation Sent",
            hireDate
        };

        const emailResult = await sendTemplateEmail("hiredEmail", updatedApplication);

        await ref.update({
            status: "Hired",
            hiredAt: hireTimestamp,
            hireDate,
            hiredEmailSent: true,
            hiredEmailSentAt: hireTimestamp,
            hiredEmailId: emailResult.id || "",
            offerResponseStatus: "Offer Accepted",
            contractStatus: application.contractStatus || "Sent",
            onboardingStatus: "Completed",
            readyToStart: "Yes",
            contractAcceptanceStatus: application.contractAcceptanceStatus === "Accepted" ? "Accepted" : "Sent",
            eSignatureStatus: application.eSignatureStatus === "Signed" ? "Signed" : "Sent",
            employmentStatus: "Hired",
            employmentConfirmationStatus: "Confirmation Sent",
            employmentNotes,
            lastCommunicationAction: "Employment Confirmation Email Sent",
            lastCommunicationAt: hireTimestamp,
            updatedAt: hireTimestamp
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
        const vacancySnapshot = await db.collection("vacancies").orderBy("createdAt", "desc").get();
        const applicationSnapshot = await db.collection("applications").get();

        const vacancies = vacancySnapshot.docs.map(normaliseVacancyForClient);
        const applications = applicationSnapshot.docs.map(normaliseApplicationForClient);
        const vacanciesWithIntelligence = buildVacancyIntelligence(vacancies, applications);

        res.json({ vacancies: vacanciesWithIntelligence });
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
        applicationReference: application.id || "",
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
        interviewStatus: application.interviewStatus || "",
        interviewResponse: application.interviewResponse || "Pending",
        interviewResponseAt: application.interviewResponseAt || "",
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
        employmentStatus: application.employmentStatus || (application.status === "Hired" ? "Hired" : "Pending"),
        employmentConfirmationStatus: application.employmentConfirmationStatus || (application.hiredEmailSent ? "Confirmation Sent" : "Awaiting Confirmation"),
        hireDate: application.hireDate || application.hiredAt || "",
        employmentNotes: application.employmentNotes || "",
        lastCommunicationAction: application.lastCommunicationAction || "No recent communication recorded.",
        lastCommunicationAt: application.lastCommunicationAt || ""
    };
}

async function findCandidateApplicationByEmailAndReference(email, applicationReference) {
    const requestedEmail = clean(email).toLowerCase();
    const requestedReference = clean(applicationReference);

    if (!requestedEmail || !requestedReference) return null;

    const doc = await db.collection("applications").doc(requestedReference).get();

    if (!doc.exists) {
        return null;
    }

    const application = {
        id: doc.id,
        ...doc.data()
    };

    if ((application.email || "").toLowerCase() !== requestedEmail) {
        return null;
    }

    return application;
}

app.post("/api/candidate/login", async (req, res) => {
    try {
        const email = clean(req.body.email);
        const applicationReference = clean(req.body.applicationReference);

        if (!email) {
            return res.status(400).json({ message: "Please enter your email address." });
        }

        if (!applicationReference) {
            return res.status(400).json({ message: "Please enter your application reference." });
        }

        const application = await findCandidateApplicationByEmailAndReference(email, applicationReference);

        if (!application) {
            return res.status(404).json({ message: "Invalid email address or application reference. Please check both details and try again." });
        }

        const token = createCandidateToken(application);

        await logAudit({
            actionType: "CANDIDATE_PORTAL_LOGIN",
            actorType: "CANDIDATE",
            actorEmail: application.email || email,
            candidateId: application.id || applicationReference,
            candidateName: application.fullName || application.name || "Candidate",
            candidateEmail: application.email || email,
            description: `Candidate portal login successful for ${application.fullName || application.name || "Candidate"}.`
        });


        await createNotification({
            type: "CANDIDATE_PORTAL_LOGIN",
            title: "Candidate Portal Login",
            candidateId: application.id || applicationReference,
            candidateName: application.fullName || application.name || "Candidate",
            candidateEmail: application.email || email,
            candidatePosition: application.position || "",
            message: `${application.fullName || application.name || "Candidate"} logged into the Candidate Portal.`,
            actorType: "CANDIDATE",
            actorEmail: application.email || email,
            source: "Candidate Portal"
        });

        const candidatePayload = cleanCandidateApplication(application);
        candidatePayload.employmentDocumentAssignment = await getEmploymentDocumentAssignmentForCandidate(application.id);

        res.json({
            message: "Candidate login successful.",
            token,
            candidate: candidatePayload
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

        const candidatePayload = cleanCandidateApplication(application);
        candidatePayload.employmentDocumentAssignment = await getEmploymentDocumentAssignmentForCandidate(application.id);

        res.json({
            candidate: candidatePayload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load candidate profile." });
    }
});

app.post("/api/candidate/interview-response", requireCandidateAuth, async (req, res) => {
    try {
        const responseValue = clean(req.body.response).toLowerCase();

        const responseMap = {
            accepted: {
                status: "Interview Accepted",
                interviewResponse: "Interview Accepted",
                interviewStatus: "Interview Accepted",
                lastCommunicationAction: "Interview Accepted",
                confirmationMessage: "Your interview attendance has been confirmed."
            },
            declined: {
                status: "Interview Declined",
                interviewResponse: "Interview Declined",
                interviewStatus: "Interview Declined",
                lastCommunicationAction: "Interview Declined",
                confirmationMessage: "You have declined this interview invitation."
            }
        };

        const responseData = responseMap[responseValue];

        if (!responseData) {
            return res.status(400).json({ message: "Invalid interview response." });
        }

        const docRef = db.collection("applications").doc(req.candidate.applicationId);
        const doc = await docRef.get();

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

        const timestamp = nowIso();

        const responseHistoryEntry = {
            action: responseData.lastCommunicationAction,
            timestamp,
            source: "Candidate Portal"
        };

        const updateData = {
            status: responseData.status,
            interviewResponse: responseData.interviewResponse,
            interviewStatus: responseData.interviewStatus,
            interviewResponseAt: timestamp,
            lastCommunicationAction: responseData.lastCommunicationAction,
            lastCommunicationAt: timestamp,
            updatedAt: timestamp,
            responseHistory: admin.firestore.FieldValue.arrayUnion(responseHistoryEntry)
        };

        await docRef.update(updateData);

        const existingResponseHistory = Array.isArray(application.responseHistory)
            ? application.responseHistory
            : [];

        const updatedApplication = {
            ...application,
            ...updateData,
            responseHistory: [
                ...existingResponseHistory,
                responseHistoryEntry
            ]
        };

        await logCommunication({
            applicationId: doc.id,
            application: updatedApplication,
            communicationType: "Candidate Response",
            action: responseData.lastCommunicationAction,
            status: "Recorded",
            subject: responseData.lastCommunicationAction,
            extra: {
                recruiterEmail: "candidate-portal",
                followUp: responseValue === "declined" ? "Candidate declined interview. Recruiter follow-up required." : "Candidate accepted interview."
            }
        });

        await logAudit({
            actionType: responseValue === "accepted" ? "INTERVIEW_ACCEPTED" : "INTERVIEW_DECLINED",
            actorType: "CANDIDATE",
            actorEmail: updatedApplication.email || req.candidate.email || "",
            candidateId: doc.id,
            candidateName: updatedApplication.fullName || updatedApplication.name || "Candidate",
            candidateEmail: updatedApplication.email || "",
            description: `${updatedApplication.fullName || updatedApplication.name || "Candidate"} ${responseValue === "accepted" ? "accepted" : "declined"} the interview invitation through the Candidate Portal.`,
            extra: {
                interviewDate: updatedApplication.interviewDate || "",
                interviewTime: updatedApplication.interviewTime || "",
                interviewLocation: updatedApplication.interviewLocation || ""
            }
        });



        await createNotification({
            type: responseValue === "accepted" ? "INTERVIEW_ACCEPTED" : "INTERVIEW_DECLINED",
            title: responseValue === "accepted" ? "Interview Accepted" : "Interview Declined",
            candidateId: doc.id,
            candidateName: updatedApplication.fullName || updatedApplication.name || "Candidate",
            candidateEmail: updatedApplication.email || "",
            candidatePosition: updatedApplication.position || "",
            message: `${updatedApplication.fullName || updatedApplication.name || "Candidate"} ${responseValue === "accepted" ? "accepted" : "declined"} the interview invitation.`,
            actorType: "CANDIDATE",
            actorEmail: updatedApplication.email || req.candidate.email || "",
            source: "Candidate Portal",
            extra: {
                interviewDate: updatedApplication.interviewDate || "",
                interviewTime: updatedApplication.interviewTime || "",
                interviewLocation: updatedApplication.interviewLocation || ""
            }
        });

        try {
            await sendRecruiterInterviewResponseNotification(updatedApplication, responseData, responseValue, timestamp);
        } catch (notificationError) {
            console.error("Recruiter interview response notification failed:", notificationError);
        }

        res.json({
            message: responseData.confirmationMessage,
            candidate: cleanCandidateApplication(updatedApplication)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to save interview response." });
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

        await logAudit({
            actionType: "PORTAL_DOCUMENTS_UPDATED",
            actorType: req.user?.email ? "ADMIN" : "SYSTEM",
            actorEmail: req.user?.email || "system",
            candidateId: application.id,
            candidateName: application.fullName || application.name || "Candidate",
            candidateEmail: application.email || "",
            description: `Portal access and document settings updated for ${application.fullName || application.name || "Candidate"}.`,
            extra: {
                portalAccessStatus,
                documentDownloadStatus,
                contractAcceptanceStatus,
                eSignatureStatus,
                selfServiceStatus,
                portalAccessDate
            }
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
Application Reference: ${application.id || "N/A"}
Start Date: ${application.candidateStartDate || "To be confirmed"}

Please keep this reference safe. You will need it with your email address to access your Candidate Portal.

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
   EMPLOYMENT DOCUMENTS CENTRE
===================================================== */

function normaliseEmploymentDocumentForClient(doc) {
    const data = doc.data ? doc.data() : doc;

    return {
        id: doc.id || data.id || "",
        documentType: data.documentType || "Employment Document",
        documentName: data.documentName || "Untitled Document",
        uploadedBy: data.uploadedBy || "Unknown Admin",
        uploadedAt: data.uploadedAt || data.createdAt || "",
        updatedAt: data.updatedAt || "",
        active: data.active !== false
    };
}

async function listEmploymentDocumentsHandler(req, res) {
    try {
        const snapshot = await db
            .collection("employmentDocuments")
            .orderBy("uploadedAt", "desc")
            .get();

        const documents = snapshot.docs.map(normaliseEmploymentDocumentForClient);

        res.json({ documents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load employment documents." });
    }
}

async function createEmploymentDocumentHandler(req, res) {
    try {
        const documentType = clean(req.body.documentType);
        const documentName = clean(req.body.documentName);

        if (!documentType) {
            return res.status(400).json({ message: "Document type is required." });
        }

        if (!documentName) {
            return res.status(400).json({ message: "Document name is required." });
        }

        const documentRecord = {
            documentType,
            documentName,
            uploadedBy: req.user?.email || "Unknown Admin",
            uploadedAt: nowIso(),
            updatedAt: nowIso(),
            active: true
        };

        const ref = await db.collection("employmentDocuments").add(documentRecord);
        const savedDocument = { id: ref.id, ...documentRecord };

        await logAudit({
            actionType: "EMPLOYMENT_DOCUMENT_CREATED",
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            candidateId: ref.id,
            candidateName: "Employment Documents Centre",
            candidateEmail: "",
            description: `${documentType} employment document record created: ${documentName}.`,
            metadata: savedDocument
        });

        res.json({
            message: "Employment document saved successfully.",
            document: savedDocument
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to save employment document." });
    }
}

async function deleteEmploymentDocumentHandler(req, res) {
    try {
        const id = clean(req.params.id);

        if (!id) {
            return res.status(400).json({ message: "Employment document ID is required." });
        }

        const ref = db.collection("employmentDocuments").doc(id);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Employment document not found." });
        }

        const documentData = normaliseEmploymentDocumentForClient(doc);
        await ref.delete();

        await logAudit({
            actionType: "EMPLOYMENT_DOCUMENT_DELETED",
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            candidateId: id,
            candidateName: "Employment Documents Centre",
            candidateEmail: "",
            description: `${documentData.documentType} employment document record deleted: ${documentData.documentName}.`,
            metadata: documentData
        });

        res.json({ message: "Employment document deleted successfully.", id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to delete employment document." });
    }
}



/* =====================================================
   EMPLOYMENT DOCUMENT ASSIGNMENTS
===================================================== */

function normaliseEmploymentDocumentAssignmentForClient(doc) {
    const data = doc.data ? doc.data() : doc;

    return {
        id: doc.id || data.id || data.candidateId || "",
        candidateId: data.candidateId || doc.id || "",
        candidateName: data.candidateName || "Candidate",
        candidateEmail: data.candidateEmail || "",
        position: data.position || "",
        employmentContractDocumentId: data.employmentContractDocumentId || data.employmentContract || "",
        welcomePackDocumentId: data.welcomePackDocumentId || data.welcomePack || "",
        handbookDocumentId: data.handbookDocumentId || data.employeeHandbook || data.handbook || "",
        inductionPackDocumentId: data.inductionPackDocumentId || data.inductionPack || "",
        companyPoliciesDocumentId: data.companyPoliciesDocumentId || data.companyPolicies || "",
        assignedBy: data.assignedBy || "Unknown Admin",
        assignedAt: data.assignedAt || data.createdAt || "",
        updatedAt: data.updatedAt || "",
        active: data.active !== false
    };
}

async function getEmploymentDocumentAssignmentForCandidate(candidateId) {
    const id = clean(candidateId);
    if (!id) return null;

    const doc = await db.collection("employmentDocumentAssignments").doc(id).get();
    if (!doc.exists) return null;

    return normaliseEmploymentDocumentAssignmentForClient(doc);
}

async function listEmploymentDocumentAssignmentsHandler(req, res) {
    try {
        const snapshot = await db
            .collection("employmentDocumentAssignments")
            .orderBy("updatedAt", "desc")
            .get();

        const assignments = snapshot.docs.map(normaliseEmploymentDocumentAssignmentForClient);
        res.json({ assignments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load employment document assignments." });
    }
}

async function getEmploymentDocumentAssignmentHandler(req, res) {
    try {
        const candidateId = clean(req.params.candidateId);

        if (!candidateId) {
            return res.status(400).json({ message: "Candidate ID is required." });
        }

        const assignment = await getEmploymentDocumentAssignmentForCandidate(candidateId);
        res.json({ assignment });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load employment document assignment." });
    }
}

async function saveEmploymentDocumentAssignmentHandler(req, res) {
    try {
        const candidateId = clean(req.body.candidateId);

        if (!candidateId) {
            return res.status(400).json({ message: "Candidate is required before documents can be assigned." });
        }

        const candidateDoc = await db.collection("applications").doc(candidateId).get();
        if (!candidateDoc.exists) {
            return res.status(404).json({ message: "Candidate application not found." });
        }

        const candidate = { id: candidateDoc.id, ...candidateDoc.data() };
        const candidateName = clean(req.body.candidateName) || candidate.fullName || candidate.name || "Candidate";
        const candidateEmail = clean(req.body.candidateEmail) || candidate.email || "";
        const position = clean(req.body.position) || candidate.position || "";

        const assignmentRecord = {
            candidateId,
            candidateName,
            candidateEmail,
            position,
            employmentContractDocumentId: clean(req.body.employmentContractDocumentId),
            welcomePackDocumentId: clean(req.body.welcomePackDocumentId),
            handbookDocumentId: clean(req.body.handbookDocumentId),
            inductionPackDocumentId: clean(req.body.inductionPackDocumentId),
            companyPoliciesDocumentId: clean(req.body.companyPoliciesDocumentId),
            assignedBy: req.user?.email || "Unknown Admin",
            assignedAt: req.body.assignedAt || nowIso(),
            updatedAt: nowIso(),
            active: true
        };

        await db.collection("employmentDocumentAssignments").doc(candidateId).set(assignmentRecord, { merge: true });

        await db.collection("applications").doc(candidateId).set({
            documentDownloadStatus: "Available",
            employmentDocumentsAssigned: true,
            employmentDocumentsUpdatedAt: nowIso(),
            updatedAt: nowIso()
        }, { merge: true });

        await logAudit({
            actionType: "EMPLOYMENT_DOCUMENTS_ASSIGNED",
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            candidateId,
            candidateName,
            candidateEmail,
            description: `Employment documents assigned to ${candidateName}.`,
            metadata: assignmentRecord
        });

        await createNotification({
            type: "EMPLOYMENT_DOCUMENTS_ASSIGNED",
            title: "Employment Documents Assigned",
            candidateId,
            candidateName,
            candidateEmail,
            candidatePosition: position,
            message: `Employment documents have been assigned to ${candidateName}.`,
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            source: "Employment Documents Centre"
        });

        res.json({
            message: "Employment documents assigned successfully.",
            assignment: { id: candidateId, ...assignmentRecord }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to assign employment documents." });
    }
}

async function deleteEmploymentDocumentAssignmentHandler(req, res) {
    try {
        const candidateId = clean(req.params.candidateId);

        if (!candidateId) {
            return res.status(400).json({ message: "Candidate ID is required." });
        }

        const ref = db.collection("employmentDocumentAssignments").doc(candidateId);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).json({ message: "Employment document assignment not found." });
        }

        const assignment = normaliseEmploymentDocumentAssignmentForClient(doc);
        await ref.delete();

        await db.collection("applications").doc(candidateId).set({
            documentDownloadStatus: "Not Available",
            employmentDocumentsAssigned: false,
            employmentDocumentsUpdatedAt: nowIso(),
            updatedAt: nowIso()
        }, { merge: true });

        await logAudit({
            actionType: "EMPLOYMENT_DOCUMENT_ASSIGNMENT_CLEARED",
            actorType: "ADMIN",
            actorEmail: req.user?.email || "Unknown Admin",
            candidateId,
            candidateName: assignment.candidateName,
            candidateEmail: assignment.candidateEmail,
            description: `Employment document assignment cleared for ${assignment.candidateName}.`,
            metadata: assignment
        });

        res.json({ message: "Employment document assignment cleared successfully.", candidateId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to clear employment document assignment." });
    }
}

app.get("/api/admin/employment-document-assignments", requireAuth, listEmploymentDocumentAssignmentsHandler);
app.get("/api/admin/employment-document-assignments/:candidateId", requireAuth, getEmploymentDocumentAssignmentHandler);
app.post("/api/admin/employment-document-assignments", requireAuth, requireEditor, saveEmploymentDocumentAssignmentHandler);
app.delete("/api/admin/employment-document-assignments/:candidateId", requireAuth, requireEditor, deleteEmploymentDocumentAssignmentHandler);

app.get("/api/admin/employment-documents", requireAuth, listEmploymentDocumentsHandler);
app.get("/api/employment-documents", requireAuth, listEmploymentDocumentsHandler);
app.post("/api/admin/employment-documents", requireAuth, requireEditor, createEmploymentDocumentHandler);
app.post("/api/employment-documents", requireAuth, requireEditor, createEmploymentDocumentHandler);
app.delete("/api/admin/employment-documents/:id", requireAuth, requireEditor, deleteEmploymentDocumentHandler);
app.delete("/api/employment-documents/:id", requireAuth, requireEditor, deleteEmploymentDocumentHandler);

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