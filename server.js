const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();

/* =========================================================
   PORT
========================================================= */

const PORT = process.env.PORT || 8080;

/* =========================================================
   PATHS
========================================================= */

const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

/* =========================================================
   CREATE UPLOADS FOLDER
========================================================= */

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(PUBLIC_DIR));

/* =========================================================
   FIREBASE SETUP
========================================================= */

let db = null;
let bucket = null;

try {
    if (!admin.apps.length) {

        let serviceAccount = null;

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {

            serviceAccount = JSON.parse(
                process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
            );

            if (serviceAccount.private_key) {
                serviceAccount.private_key =
                    serviceAccount.private_key.replace(/\\n/g, "\n");
            }
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET
        });

        db = admin.firestore();
        bucket = admin.storage().bucket();

        console.log("Firebase connected successfully.");
    }

} catch (error) {

    console.error("Firebase initialization error:");
    console.error(error);

}

/* =========================================================
   MULTER STORAGE
========================================================= */

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() + "-" + file.originalname.replace(/\s+/g, "-");

        cb(null, uniqueName);
    }

});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {

    res.json({
        success: true,
        message: "TEMC Recruitment backend is running",
        firebase: Boolean(db && bucket)
    });

});

/* =========================================================
   ROOT ROUTE
========================================================= */

app.get("/", (req, res) => {
    res.redirect("/admin");
});

/* =========================================================
   ADMIN PAGE
========================================================= */

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(PUBLIC_DIR, "admin.html")
    );

});

/* =========================================================
   CAREERS PAGE
========================================================= */

app.get("/careers", (req, res) => {

    res.sendFile(
        path.join(PUBLIC_DIR, "index.html")
    );

});

/* =========================================================
   APPLICATION SUBMISSION
========================================================= */

app.post(
    "/api/apply",
    upload.fields([
        { name: "cv", maxCount: 1 },
        { name: "extraFiles", maxCount: 5 }
    ]),
    async (req, res) => {

        try {

            const {
                firstName,
                lastName,
                email,
                phone,
                position,
                message
            } = req.body;

            let cvUrl = "";
            let extraFileUrls = [];

            /* =========================================
               UPLOAD CV TO FIREBASE
            ========================================= */

            if (req.files && req.files.cv && bucket) {

                const cvFile = req.files.cv[0];

                const firebaseFile = bucket.file(
                    `applications/cv/${Date.now()}-${cvFile.filename}`
                );

                await bucket.upload(cvFile.path, {
                    destination: firebaseFile.name
                });

                await firebaseFile.makePublic();

                cvUrl = `https://storage.googleapis.com/${bucket.name}/${firebaseFile.name}`;
            }

            /* =========================================
               UPLOAD EXTRA FILES
            ========================================= */

            if (
                req.files &&
                req.files.extraFiles &&
                bucket
            ) {

                for (const file of req.files.extraFiles) {

                    const firebaseFile = bucket.file(
                        `applications/files/${Date.now()}-${file.filename}`
                    );

                    await bucket.upload(file.path, {
                        destination: firebaseFile.name
                    });

                    await firebaseFile.makePublic();

                    extraFileUrls.push(
                        `https://storage.googleapis.com/${bucket.name}/${firebaseFile.name}`
                    );
                }
            }

            /* =========================================
               SAVE TO FIRESTORE
            ========================================= */

            if (db) {

                await db.collection("applications").add({

                    firstName: firstName || "",
                    lastName: lastName || "",
                    email: email || "",
                    phone: phone || "",
                    position: position || "",
                    message: message || "",

                    cvUrl,
                    extraFileUrls,

                    status: "New",
                    createdAt: new Date()

                });

            }

            /* =========================================
               RESPONSE
            ========================================= */

            res.json({
                success: true,
                message: "Application submitted successfully"
            });

        } catch (error) {

            console.error("Application submission error:");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Server error submitting application"
            });

        }

    }
);

/* =========================================================
   GET APPLICATIONS
========================================================= */

app.get("/api/applications", async (req, res) => {

    try {

        if (!db) {
            return res.status(500).json({
                success: false,
                message: "Firestore not connected"
            });
        }

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
            message: "Failed to fetch applications"
        });

    }

});

/* =========================================================
   START SERVER
========================================================= */
app.get("/api/admin/applications", async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({
                success: false,
                message: "Firestore not connected"
            });
        }

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
            message: "Failed to fetch applications"
        });
    }
});

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `TEMC Recruitment backend running on port ${PORT}`
    );

});
