const express = require("express");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Resend } = require("resend");
require("dotenv").config();

const serviceAccount = require("./firebase-key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },

    filename: function (req, file, cb) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        cb(null, Date.now() + "-" + safeName);
    }
});

const upload = multer({ storage: storage });

function verifyAdminToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Admin token required"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.adminUser = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired admin token"
        });
    }
}

function ownerOnly(req, res, next) {
    if (!req.adminUser || req.adminUser.role !== "owner") {
        return res.status(403).json({
            success: false,
            message: "Owner permission required"
        });
    }

    next();
}

app.post("/api/admin/create", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const existing = await db
            .collection("admins")
            .where("email", "==", email)
            .get();

        if (!existing.empty) {
            return res.status(400).json({
                success: false,
                message: "Admin already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.collection("admins").add({
            name,
            email,
            password: hashedPassword,
            role: role || "admin",
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: "Admin created successfully"
        });

    } catch (error) {
        console.error("Create admin error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to create admin"
        });
    }
});

app.post("/api/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const snapshot = await db
            .collection("admins")
            .where("email", "==", email)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.status(401).json({
                success: false,
                message: "Invalid login details"
            });
        }

        const adminDoc = snapshot.docs[0];
        const adminUser = adminDoc.data();

        const passwordMatch = await bcrypt.compare(password, adminUser.password);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid login details"
            });
        }

        const token = jwt.sign(
            {
                id: adminDoc.id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: adminDoc.id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role
            }
        });

    } catch (error) {
        console.error("Admin login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
});

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC recruitment backend is running"
    });
});

app.post("/apply", upload.single("cv"), async (req, res) => {
    try {
        const { fullName, email, phone, position, about } = req.body;

        let cvFile = "";

        if (req.file) {
            cvFile = req.file.filename;
        }

        await db.collection("applications").add({
            fullName: fullName || "",
            email: email || "",
            phone: phone || "",
            position: position || "",
            about: about || "",
            cvFile,
            status: "New",
            rating: 0,
            notes: "",
            interviewDate: "",
            interviewTime: "",
            interviewLocation: "",
            invitationSent: false,
            invitationSentAt: "",
            favourite: false,
            createdAt: new Date()
        });

        res.json({
            success: true,
            message: "Application submitted successfully"
        });

    } catch (error) {
        console.error("Application error:", error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

app.get("/api/applications", async (req, res) => {
    try {
        const snapshot = await db
            .collection("applications")
            .orderBy("createdAt", "desc")
            .get();

        const applications = [];

        snapshot.forEach((doc) => {
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
            message: "Failed to fetch applications"
        });
    }
});

app.patch("/api/applications/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["New", "Reviewed", "Interview", "Rejected"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        await db.collection("applications").doc(id).update({
            status,
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Status updated"
        });

    } catch (error) {
        console.error("Status update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update status"
        });
    }
});

app.patch("/api/applications/:id/rating", async (req, res) => {
    try {
        const { id } = req.params;
        const { rating } = req.body;

        const numericRating = Number(rating);

        if (Number.isNaN(numericRating) || numericRating < 0 || numericRating > 5) {
            return res.status(400).json({
                success: false,
                message: "Invalid rating"
            });
        }

        await db.collection("applications").doc(id).update({
            rating: numericRating,
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Rating updated"
        });

    } catch (error) {
        console.error("Rating update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update rating"
        });
    }
});

app.patch("/api/applications/:id/notes", async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        await db.collection("applications").doc(id).update({
            notes: notes || "",
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Notes saved"
        });

    } catch (error) {
        console.error("Notes update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save notes"
        });
    }
});

app.patch("/api/applications/:id/interview", async (req, res) => {
    try {
        const { id } = req.params;
        const { interviewDate, interviewTime, interviewLocation } = req.body;

        await db.collection("applications").doc(id).update({
            interviewDate: interviewDate || "",
            interviewTime: interviewTime || "",
            interviewLocation: interviewLocation || "",
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Interview details saved"
        });

    } catch (error) {
        console.error("Interview update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to save interview details"
        });
    }
});

app.patch("/api/applications/:id/favourite", async (req, res) => {
    try {
        const { id } = req.params;
        const { favourite } = req.body;

        await db.collection("applications").doc(id).update({
            favourite: Boolean(favourite),
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Favourite status updated"
        });

    } catch (error) {
        console.error("Favourite update error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update favourite status"
        });
    }
});

app.post("/api/applications/:id/send-invitation", async (req, res) => {
    try {
        const { id } = req.params;

        const docRef = db.collection("applications").doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                message: "Application not found"
            });
        }

        const applicant = doc.data();

        if (!applicant.email) {
            return res.status(400).json({
                success: false,
                message: "Applicant has no email address"
            });
        }

        if (!applicant.interviewDate || !applicant.interviewTime || !applicant.interviewLocation) {
            return res.status(400).json({
                success: false,
                message: "Please save interview date, time and location before sending invitation"
            });
        }

        if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
            return res.status(500).json({
                success: false,
                message: "Email service is not configured"
            });
        }

        const subject = "Invitation to Interview - The Excellent Management Company";

        const html = `
            <div style="font-family:Arial,sans-serif;background:#f4f7fb;padding:40px;">
                <div style="max-width:700px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 5px 20px rgba(0,0,0,0.1);">

                    <div style="background:#02152b;padding:30px;text-align:center;">
                        <h1 style="color:#f1b400;margin:0;font-size:32px;">TEMC Recruitment</h1>
                        <p style="color:white;margin-top:10px;font-size:16px;">
                            The Excellent Management Company
                        </p>
                    </div>

                    <div style="padding:40px;color:#333;">
                        <h2>Hello ${applicant.fullName || "Candidate"},</h2>

                        <p style="line-height:1.8;">
                            Thank you for your recent application to
                            <strong>The Excellent Management Company (TEMC)</strong>.
                        </p>

                        <p style="line-height:1.8;">
                            We are pleased to invite you to attend an interview regarding your application for:
                        </p>

                        <div style="background:#f4f7fb;padding:20px;border-left:5px solid #f1b400;border-radius:8px;margin:25px 0;">
                            <p><strong>Position:</strong> ${applicant.position || "TEMC Position"}</p>
                            <p><strong>Date:</strong> ${applicant.interviewDate}</p>
                            <p><strong>Time:</strong> ${applicant.interviewTime}</p>
                            <p><strong>Location / Link:</strong> ${applicant.interviewLocation}</p>
                        </div>

                        <p style="line-height:1.8;">
                            Please arrive a few minutes early and bring any relevant identification or supporting documentation if requested.
                        </p>

                        <p style="line-height:1.8;">
                            If you are unable to attend, please contact us as soon as possible so alternative arrangements may be considered.
                        </p>

                        <div style="text-align:center;margin:40px 0;">
                            <a href="mailto:${process.env.EMAIL_FROM}"
                               style="background:#f1b400;color:#02152b;text-decoration:none;padding:16px 28px;border-radius:8px;font-weight:bold;display:inline-block;">
                                Contact Recruitment Team
                            </a>
                        </div>

                        <p style="line-height:1.8;">
                            We look forward to meeting you and discussing your application further.
                        </p>

                        <p style="margin-top:40px;">
                            Kind regards,<br>
                            <strong>TEMC Recruitment Team</strong>
                        </p>
                    </div>

                    <div style="background:#02152b;color:white;text-align:center;padding:20px;font-size:13px;">
                        © 2026 The Excellent Management Company (TEMC)
                    </div>

                </div>
            </div>
        `;

        const text = `
Dear ${applicant.fullName || "Candidate"},

Thank you for your recent application to The Excellent Management Company (TEMC).

We are pleased to invite you to attend an interview regarding your application.

Position: ${applicant.position || "TEMC Position"}
Date: ${applicant.interviewDate}
Time: ${applicant.interviewTime}
Location / Link: ${applicant.interviewLocation}

Please arrive a few minutes early and bring any relevant identification or supporting documentation if requested.

If you are unable to attend, please contact us as soon as possible.

Kind regards,
TEMC Recruitment Team
The Excellent Management Company
        `;

        await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to: applicant.email,
            subject,
            html,
            text
        });

        await docRef.update({
            invitationSent: true,
            invitationSentAt: new Date(),
            status: "Interview",
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: "Interview invitation sent successfully"
        });

    } catch (error) {
        console.error("Invitation email error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to send interview invitation"
        });
    }
});

app.delete("/api/applications/:id", verifyAdminToken, ownerOnly, async (req, res) => {
    try {
        const { id } = req.params;

        await db.collection("applications").doc(id).delete();

        res.json({
            success: true,
            message: "Application deleted successfully"
        });

    } catch (error) {
        console.error("Delete application error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to delete application"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`TEMC recruitment backend running on http://localhost:${PORT}`);
});