const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();


app.use(cors());
app.use(express.json());


const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.connect((err) => {
    if (err) {
        console.error(' LawFlow PostgreSQL Connection Error:', err);
    } else {
        console.log(' Connected to LawFlow PostgreSQL Database (lawflow_db) Successfully!');
    }
});

// 2. Gemini AI Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const legalSystemInstruction = `
You are LawFlow, an expert AI Legal Assistant for Pakistani Law. 
You strictly guide users based on these 10 legal templates available in your system:

Family Cases:
1. Dissolution of Marriage on Basis of Khula
2. Recovery of Maintenance / Kharcha
3. Recovery of Dowry Articles / Saman-e-Jahez
4. Custody of Minors (Hizanat)
5. Restitution of Conjugal Rights

Civil Cases:
6. Suit for Declaration & Mandatory Injunction
7. Suit for Possession of Property
8. Suit for Permanent Injunction / Stay Order
9. Suit for Specific Performance of Agreement / Biana
10. Suit for Recovery of Money / Karza

RULES FOR CONVERSATION:
- First Message (Greeting/Hi/Hello): Strictly respond with Screen 1 format using HTML tags (<br>, •):
  "Please specify:<br><br>• Case type (Civil or Family)<br>• Legal issue<br>• What you need (draft, documents, or procedure)<br><br>So I can help accurately."
- Follow-up Messages: Dynamically ask for the required fields step-by-step. Do not use markdown (**). Use HTML <b> and <br> for bold and line breaks.
- If all required details are provided, generate the text format layout based on the user's specific input.
`;


app.post('/api/chat', async(req, res) => {
    const userMessage = req.body.message;
    let userId = req.body.userId;

    if (!userMessage) {
        return res.status(400).json({ reply: "Message is empty." });
    }

    try {

        if (!userId) {
            const userCheck = await pool.query("SELECT id FROM users LIMIT 1");
            if (userCheck.rows.length > 0) {
                userId = userCheck.rows[0].id;
            } else {
                return res.status(500).json({ reply: "System Error: Aapke database ke 'users' table mein koi user nahi hai." });
            }
        }


        const historyRows = await pool.query(
            'SELECT role, message FROM chat_histories WHERE user_id = $1 ORDER BY created_at ASC', [userId]
        );

        const formattedHistory = historyRows.rows.map(row => ({
            role: row.role,
            parts: [{ text: row.message.replace(/<br>/g, "\n") }]
        }));


        await pool.query(
            'INSERT INTO chat_histories (user_id, role, message) VALUES ($1, $2, $3)', [userId, 'user', userMessage]
        );


        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // Wapis latest 2.5 model kar dein
            systemInstruction: legalSystemInstruction
        });
        const chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(userMessage);
        let botResponse = result.response.text();
        botResponse = botResponse.replace(/\n/g, "<br>");


        await pool.query(
            'INSERT INTO chat_histories (user_id, role, message) VALUES ($1, $2, $3)', [userId, 'model', botResponse]
        );


        res.json({ reply: botResponse });

    } catch (error) {
        console.error(" Error in LawFlow Chat system:", error);
        res.status(500).json({ reply: "Server error occurred." });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(` LawFlow AI Backend is running perfectly on port ${PORT}`);
});