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

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

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

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename(req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, Date.now() + "-" + safeName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

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


function buildApplicationReceivedEmail(application) {
    const candidateName = application.fullName || "Candidate";
    const position = application.position || "the position you applied for";
    const subject = `Application Received - ${position}`;

    const plainText = `Dear ${candidateName},

Thank you for your application for the position of ${position} with Joe's Excellent Events & Management.

We are pleased to confirm that your application has been received successfully and has entered our recruitment process. Our recruitment team will review your application, qualifications and experience carefully against the requirements of the role.

If your application is shortlisted, we will contact you regarding the next stage of the recruitment process. Due to the volume of applications we may receive, we are unable to provide individual feedback to all applicants.

We appreciate your interest in joining Joe's Excellent Events & Management and wish you every success.

Kind regards,

Joe's Excellent Events & Management
Recruitment Team`;

    const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#061726;color:#ffffff;padding:30px;">
            <div style="max-width:700px;margin:auto;background:#13283b;border:1px solid #ff6a00;border-radius:18px;padding:30px;">
                <h1 style="color:#ff6a00;text-align:center;">Application Received</h1>

                <p>Dear ${escapeHtml(candidateName)},</p>

                <p>Thank you for your application for the position of <strong>${escapeHtml(position)}</strong> with Joe's Excellent Events & Management.</p>

                <p>We are pleased to confirm that your application has been received successfully and has entered our recruitment process.</p>

                <p>Our recruitment team will review your application, qualifications and experience carefully against the requirements of the role.</p>

                <p>If your application is shortlisted, we will contact you regarding the next stage of the recruitment process. Due to the volume of applications we may receive, we are unable to provide individual feedback to all applicants.</p>

                <p>We appreciate your interest in joining Joe's Excellent Events & Management and wish you every success.</p>

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

function buildInterviewEmail(application, details) {
    const candidateName = application.fullName || "Candidate";
    const position = application.position || "the position applied for";
    const interviewDate = details.interviewDate || "To be confirmed";
    const interviewTime = details.interviewTime || "To be confirmed";
    const interviewLocation = details.interviewLocation || "Joe's Excellent Events & Management, Newcastle upon Tyne";

    const message = details.interviewMessage || `Thank you for your application.

We are pleased to invite you to attend an interview with Joe's Excellent Events & Management.`;

    const subject = "Interview Invitation - Joe's Excellent Events & Management";

    const plainText = `Dear ${candidateName},

${message}

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
        <div style="font-family:Arial,Helvetica,sans-serif;background:#061726;color:#ffffff;padding:30px;">
            <div style="max-width:700px;margin:auto;background:#13283b;border:1px solid #ff6a00;border-radius:18px;padding:30px;">
                <h1 style="color:#ff6a00;text-align:center;">Interview Invitation</h1>

                <p>Dear ${escapeHtml(candidateName)},</p>

                <p style="white-space:pre-line;">${escapeHtml(message)}</p>

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

function buildContactEmail(contactData) {
    const subject = `New Contact Message - ${contactData.subject || "Website Enquiry"}`;

    const plainText = `New Contact Us Message

Name: ${contactData.name}
Email: ${contactData.email}
Phone: ${contactData.phone}
Subject: ${contactData.subject}

Message:
${contactData.message}

Sent: ${contactData.createdAt}`;

    const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#061726;color:#ffffff;padding:30px;">
            <div style="max-width:700px;margin:auto;background:#13283b;border:1px solid #ff6a00;border-radius:18px;padding:30px;">
                <h1 style="color:#ff6a00;text-align:center;">New Contact Us Message</h1>

                <p><strong>Name:</strong> ${escapeHtml(contactData.name)}</p>
                <p><strong>Email:</strong> ${escapeHtml(contactData.email)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(contactData.phone)}</p>
                <p><strong>Subject:</strong> ${escapeHtml(contactData.subject)}</p>

                <h2 style="color:#ff6a00;">Message</h2>
                <p style="white-space:pre-line;">${escapeHtml(contactData.message)}</p>

                <p style="margin-top:30px;">
                    <strong>Sent:</strong> ${escapeHtml(contactData.createdAt)}
                </p>
            </div>
        </div>
    `;

    return { subject, plainText, html };
}

async function sendEmailWithResend({ to, subject, html, plainText }) {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is missing.");
    }

    const fromAddress = process.env.EMAIL_FROM || "Joe's Excellent Events & Management <onboarding@resend.dev>";
    const replyTo = process.env.EMAIL_REPLY_TO || "joseph.eldridge1964@gmail.com";

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
            reply_to: replyTo
        })
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result.message || "Resend email failed.");
    }

    return result;
}

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is running",
        firebaseConnected: !!db,
        resendReady: !!process.env.RESEND_API_KEY
    });
});

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

    const user = users.find(u =>
        u.email &&
        u.password &&
        u.email === email &&
        u.password === password
    );

    if (!user) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password."
        });
    }

    const token = createToken({
        email: user.email,
        role: user.role
    });

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

            const cvFile = req.files?.cv?.[0] || null;
            const extraFiles = req.files?.extraFiles || [];

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
                invitationEmailId: "",
                applicationReceivedEmailSent: false,
                applicationReceivedEmailSentAt: "",
                applicationReceivedEmailId: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                cv: cvFile ? `/uploads/${cvFile.filename}` : "",
                extraFiles: extraFiles.map(file => `/uploads/${file.filename}`)
            };

            let savedId;

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

            try {
                const applicationReceivedEmail = buildApplicationReceivedEmail(applicationData);

                const emailResult = await sendEmailWithResend({
                    to: email,
                    subject: applicationReceivedEmail.subject,
                    html: applicationReceivedEmail.html,
                    plainText: applicationReceivedEmail.plainText
                });

                const emailUpdateData = {
                    applicationReceivedEmailSent: true,
                    applicationReceivedEmailSentAt: new Date().toISOString(),
                    applicationReceivedEmailId: emailResult.id || "",
                    updatedAt: new Date().toISOString()
                };

                if (db) {
                    await db.collection("applications").doc(savedId).update(emailUpdateData);

                    await db.collection("candidateCommunications").add({
                        applicationId: savedId,
                        candidateName: fullName,
                        candidateEmail: email,
                        position: position || "",
                        emailType: "Application Received",
                        status: "Sent",
                        resendEmailId: emailResult.id || "",
                        sentAt: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    });
                } else {
                    const localFile = path.join(__dirname, "applications.json");
                    const applications = JSON.parse(fs.readFileSync(localFile, "utf8"));
                    const index = applications.findIndex(app => app.id === savedId);

                    if (index !== -1) {
                        applications[index] = {
                            ...applications[index],
                            ...emailUpdateData
                        };

                        fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
                    }

                    const communicationsFile = path.join(__dirname, "candidateCommunications.json");
                    let communications = [];

                    if (fs.existsSync(communicationsFile)) {
                        communications = JSON.parse(fs.readFileSync(communicationsFile, "utf8"));
                    }

                    communications.push({
                        id: Date.now().toString(),
                        applicationId: savedId,
                        candidateName: fullName,
                        candidateEmail: email,
                        position: position || "",
                        emailType: "Application Received",
                        status: "Sent",
                        resendEmailId: emailResult.id || "",
                        sentAt: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    });

                    fs.writeFileSync(communicationsFile, JSON.stringify(communications, null, 2));
                }
            } catch (emailError) {
                console.error("Application received email error:", emailError.message);

                if (db && savedId) {
                    try {
                        await db.collection("candidateCommunications").add({
                            applicationId: savedId,
                            candidateName: fullName,
                            candidateEmail: email,
                            position: position || "",
                            emailType: "Application Received",
                            status: "Failed",
                            errorMessage: emailError.message,
                            sentAt: "",
                            createdAt: new Date().toISOString()
                        });
                    } catch (logError) {
                        console.error("Application received email log error:", logError.message);
                    }
                }
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
                message: "Application was not submitted."
            });
        }
    }
);

app.post("/api/contact", async (req, res) => {
    try {
        const {
            name,
            fullName,
            email,
            phone,
            subject,
            message
        } = req.body;

        const contactName = name || fullName || "";
        const contactEmail = email || "";
        const contactPhone = phone || "";
        const contactSubject = subject || "Website Enquiry";
        const contactMessage = message || "";

        if (!contactName || !contactEmail || !contactMessage) {
            return res.status(400).json({
                success: false,
                message: "Name, email and message are required."
            });
        }

        const contactData = {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            subject: contactSubject,
            message: contactMessage,
            status: "New",
            read: false,
            emailSent: false,
            resendEmailId: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        let savedId;

        if (db) {
            const docRef = await db.collection("contactMessages").add(contactData);
            savedId = docRef.id;
        } else {
            const localFile = path.join(__dirname, "contactMessages.json");
            let contactMessages = [];

            if (fs.existsSync(localFile)) {
                contactMessages = JSON.parse(fs.readFileSync(localFile, "utf8"));
            }

            savedId = Date.now().toString();

            contactMessages.push({
                id: savedId,
                ...contactData
            });

            fs.writeFileSync(localFile, JSON.stringify(contactMessages, null, 2));
        }

        try {
            const contactEmailContent = buildContactEmail(contactData);
            const emailTo = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_REPLY_TO || "joseph.eldridge1964@gmail.com";

            const emailResult = await sendEmailWithResend({
                to: emailTo,
                subject: contactEmailContent.subject,
                html: contactEmailContent.html,
                plainText: contactEmailContent.plainText
            });

            if (db) {
                await db.collection("contactMessages").doc(savedId).update({
                    emailSent: true,
                    resendEmailId: emailResult.id || "",
                    updatedAt: new Date().toISOString()
                });
            } else {
                const localFile = path.join(__dirname, "contactMessages.json");
                const contactMessages = JSON.parse(fs.readFileSync(localFile, "utf8"));
                const index = contactMessages.findIndex(item => item.id === savedId);

                if (index !== -1) {
                    contactMessages[index].emailSent = true;
                    contactMessages[index].resendEmailId = emailResult.id || "";
                    contactMessages[index].updatedAt = new Date().toISOString();
                    fs.writeFileSync(localFile, JSON.stringify(contactMessages, null, 2));
                }
            }

        } catch (emailError) {
            console.error("Contact notification email error:", emailError.message);
        }

        res.json({
            success: true,
            message: "Your message has been sent successfully.",
            id: savedId
        });

    } catch (error) {
        console.error("Contact form error:", error);

        res.status(500).json({
            success: false,
            message: "Your message could not be sent."
        });
    }
});

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

app.get("/api/contact-messages", verifyToken, async (req, res) => {
    try {
        let messages = [];

        if (db) {
            const snapshot = await db
                .collection("contactMessages")
                .orderBy("createdAt", "desc")
                .get();

            messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            const localFile = path.join(__dirname, "contactMessages.json");

            if (fs.existsSync(localFile)) {
                messages = JSON.parse(fs.readFileSync(localFile, "utf8"));
            }
        }

        res.json({
            success: true,
            messages
        });

    } catch (error) {
        console.error("Fetch contact messages error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch contact messages."
        });
    }
});

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
                    message: "Applications file not found."
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

app.patch("/api/contact-messages/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        const updateData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        if (db) {
            await db.collection("contactMessages").doc(id).update(updateData);
        } else {
            const localFile = path.join(__dirname, "contactMessages.json");

            if (!fs.existsSync(localFile)) {
                return res.status(404).json({
                    success: false,
                    message: "Contact messages file not found."
                });
            }

            const messages = JSON.parse(fs.readFileSync(localFile, "utf8"));
            const index = messages.findIndex(item => item.id === id);

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Contact message not found."
                });
            }

            messages[index] = {
                ...messages[index],
                ...updateData
            };

            fs.writeFileSync(localFile, JSON.stringify(messages, null, 2));
        }

        res.json({
            success: true,
            message: "Contact message updated successfully."
        });

    } catch (error) {
        console.error("Update contact message error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update contact message."
        });
    }
});

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
                    message: "Applications file not found."
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

app.delete("/api/contact-messages/:id", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot delete contact messages."
            });
        }

        if (db) {
            await db.collection("contactMessages").doc(id).delete();
        } else {
            const localFile = path.join(__dirname, "contactMessages.json");

            if (!fs.existsSync(localFile)) {
                return res.status(404).json({
                    success: false,
                    message: "Contact messages file not found."
                });
            }

            let messages = JSON.parse(fs.readFileSync(localFile, "utf8"));
            messages = messages.filter(item => item.id !== id);

            fs.writeFileSync(localFile, JSON.stringify(messages, null, 2));
        }

        res.json({
            success: true,
            message: "Contact message deleted successfully."
        });

    } catch (error) {
        console.error("Delete contact message error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete contact message."
        });
    }
});

app.post("/api/applications/:id/invite", verifyToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot send interview invitations."
            });
        }

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
                    message: "Applications file not found."
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

        const emailContent = buildInterviewEmail(application, req.body);

        const emailResult = await sendEmailWithResend({
            to: application.email,
            subject: emailContent.subject,
            html: emailContent.html,
            plainText: emailContent.plainText
        });

        const updateData = {
            status: "Interview Invited",
            interviewDate: req.body.interviewDate || "",
            interviewTime: req.body.interviewTime || "",
            interviewLocation: req.body.interviewLocation || "",
            interviewMessage: req.body.interviewMessage || "",
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

            if (index !== -1) {
                applications[index] = {
                    ...applications[index],
                    ...updateData
                };

                fs.writeFileSync(localFile, JSON.stringify(applications, null, 2));
            }
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


function normaliseLines(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item || "").trim()).filter(Boolean);
    }

    return String(value || "")
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}

function buildVacancyData(body, existing = {}) {
    const now = new Date().toISOString();

    return {
        title: body.title || body.vacancyTitle || existing.title || "",
        location: body.location || body.vacancyLocation || existing.location || "",
        type: body.type || body.vacancyType || existing.type || "",
        category: body.category || body.vacancyCategory || existing.category || "General",
        salaryMin: body.salaryMin || body.vacancySalaryMin || existing.salaryMin || "",
        salaryMax: body.salaryMax || body.vacancySalaryMax || existing.salaryMax || "",
        closingDate: body.closingDate || body.vacancyClosingDate || existing.closingDate || "",
        status: body.status || body.vacancyStatus || existing.status || "Draft",
        description: body.description || body.vacancyDescription || existing.description || "",
        responsibilities: normaliseLines(body.responsibilities || body.vacancyResponsibilities || existing.responsibilities || []),
        requirements: normaliseLines(body.requirements || body.vacancyRequirements || existing.requirements || []),
        createdAt: existing.createdAt || now,
        updatedAt: now
    };
}

async function readLocalVacancies() {
    const localFile = path.join(__dirname, "vacancies.json");

    if (!fs.existsSync(localFile)) {
        return [];
    }

    return JSON.parse(fs.readFileSync(localFile, "utf8"));
}

async function writeLocalVacancies(vacancies) {
    const localFile = path.join(__dirname, "vacancies.json");
    fs.writeFileSync(localFile, JSON.stringify(vacancies, null, 2));
}

app.get("/api/vacancies", async (req, res) => {
    try {
        let vacancies = [];

        if (db) {
            const snapshot = await db
                .collection("vacancies")
                .where("status", "==", "Published")
                .get();

            vacancies = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            vacancies = (await readLocalVacancies()).filter(vacancy => vacancy.status === "Published");
        }

        vacancies.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json({
            success: true,
            vacancies
        });
    } catch (error) {
        console.error("Fetch public vacancies error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch vacancies."
        });
    }
});

app.get("/api/admin/vacancies", verifyToken, async (req, res) => {
    try {
        let vacancies = [];

        if (db) {
            const snapshot = await db.collection("vacancies").get();

            vacancies = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } else {
            vacancies = await readLocalVacancies();
        }

        vacancies.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json({
            success: true,
            vacancies
        });
    } catch (error) {
        console.error("Fetch admin vacancies error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch admin vacancies."
        });
    }
});

app.post("/api/admin/vacancies", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot create vacancies."
            });
        }

        const vacancyData = buildVacancyData(req.body);

        if (!vacancyData.title) {
            return res.status(400).json({
                success: false,
                message: "Vacancy title is required."
            });
        }

        let savedId;

        if (db) {
            const docRef = await db.collection("vacancies").add(vacancyData);
            savedId = docRef.id;
        } else {
            const vacancies = await readLocalVacancies();
            savedId = Date.now().toString();
            vacancies.push({ id: savedId, ...vacancyData });
            await writeLocalVacancies(vacancies);
        }

        res.json({
            success: true,
            message: "Vacancy created successfully.",
            id: savedId
        });
    } catch (error) {
        console.error("Create vacancy error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create vacancy."
        });
    }
});

app.patch("/api/admin/vacancies/:id", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot update vacancies."
            });
        }

        const { id } = req.params;
        let existing = {};

        if (db) {
            const doc = await db.collection("vacancies").doc(id).get();

            if (!doc.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Vacancy not found."
                });
            }

            existing = doc.data();
            const updateData = buildVacancyData(req.body, existing);
            await db.collection("vacancies").doc(id).update(updateData);
        } else {
            const vacancies = await readLocalVacancies();
            const index = vacancies.findIndex(vacancy => vacancy.id === id);

            if (index === -1) {
                return res.status(404).json({
                    success: false,
                    message: "Vacancy not found."
                });
            }

            existing = vacancies[index];
            vacancies[index] = {
                ...existing,
                ...buildVacancyData(req.body, existing)
            };

            await writeLocalVacancies(vacancies);
        }

        res.json({
            success: true,
            message: "Vacancy updated successfully."
        });
    } catch (error) {
        console.error("Update vacancy error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update vacancy."
        });
    }
});

app.delete("/api/admin/vacancies/:id", verifyToken, async (req, res) => {
    try {
        if (req.user.role === "viewer") {
            return res.status(403).json({
                success: false,
                message: "Viewers cannot delete vacancies."
            });
        }

        const { id } = req.params;

        if (db) {
            await db.collection("vacancies").doc(id).delete();
        } else {
            let vacancies = await readLocalVacancies();
            vacancies = vacancies.filter(vacancy => vacancy.id !== id);
            await writeLocalVacancies(vacancies);
        }

        res.json({
            success: true,
            message: "Vacancy deleted successfully."
        });
    } catch (error) {
        console.error("Delete vacancy error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete vacancy."
        });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

app.get("/careers", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "careers.html"));
});

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found."
    });
});

app.use((error, req, res, next) => {
    console.error("Server error:", error.message);

    res.status(500).json({
        success: false,
        message: error.message || "Internal server error."
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});