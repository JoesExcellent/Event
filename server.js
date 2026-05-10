const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

/* =====================================================
   FIREBASE
===================================================== */

if (!admin.apps.length) {
    const serviceAccount = JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =====================================================
   STATIC FILES
===================================================== */

app.use(express.static(path.join(__dirname, "public")));

/* =====================================================
   MULTER
===================================================== */

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* =====================================================
   ADMIN AUTH
===================================================== */

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "No admin token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.admin = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid admin token."
        });
    }
}

/* =====================================================
   HEALTH
===================================================== */

app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "TEMC Recruitment backend is running"
    });
});

/* =====================================================
   ADMIN LOGIN
===================================================== */

app.post("/api/admin/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (
            email !== process.env.ADMIN_EMAIL ||
            password !== process.env.ADMIN_PASSWORD
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid login details"
            });
        }

        const token = jwt.sign(
            {
                email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "12h"
            }
        );

        res.json({
            success: true,
            token
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});

/* =====================================================
   SUBMIT APPLICATION
===================================================== */

app.post(
    "/api/apply",
    upload.single("cv"),
    async (req, res) => {

        try {

            const {
                fullName,
                email,
                phone,
                position,
                about
            } = req.body;

            let cvUrl = "";

            if (req.file) {

                const fileName =
                    `cv/${Date.now()}-${req.file.originalname}`;

                const file = bucket.file(fileName);

                await file.save(req.file.buffer, {
                    metadata: {
                        contentType: req.file.mimetype
                    }
                });

                await file.makePublic();

                cvUrl =
                    `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            }

            const application = {
                fullName,
                email,
                phone,
                position,
                about,
                cvUrl,
                status: "New",
                rating: 0,
                notes: "",
                interviewDate: "",
                interviewTime: "",
                createdAt: new Date().toISOString()
            };

            const docRef = await db
                .collection("applications")
                .add(application);

            res.json({
                success: true,
                id: docRef.id
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Application submission failed"
            });
        }
    }
);

/* =====================================================
   GET APPLICATIONS
===================================================== */

app.get(
    "/api/admin/applications",
    authenticateAdmin,
    async (req, res) => {

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

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to load applications"
            });
        }
    }
);

/* =====================================================
   UPDATE APPLICATION
===================================================== */

app.patch(
    "/api/admin/applications/:id",
    authenticateAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            await db
                .collection("applications")
                .doc(id)
                .update(req.body);

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to update application"
            });
        }
    }
);

/* =====================================================
   DELETE APPLICATION
===================================================== */

app.delete(
    "/api/admin/applications/:id",
    authenticateAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            await db
                .collection("applications")
                .doc(id)
                .delete();

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to delete application"
            });
        }
    }
);

/* =====================================================
   INTERVIEW INVITE
===================================================== */

app.post(
    "/api/admin/applications/:id/invite",
    authenticateAdmin,
    async (req, res) => {

        try {

            const { id } = req.params;

            await db
                .collection("applications")
                .doc(id)
                .update({
                    status: "Interview Invited",
                    interviewDate: req.body.interviewDate || "",
                    interviewTime: req.body.interviewTime || ""
                });

            res.json({
                success: true
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                success: false,
                message: "Failed to send invite"
            });
        }
    }
);

/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

/* =====================================================
   START SERVER
===================================================== */

app.listen(PORT, () => {
    console.log(
        `TEMC Recruitment backend running on port ${PORT}`
    );
});
