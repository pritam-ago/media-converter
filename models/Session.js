import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
    }, 
    files: [
        {
            fileName: String,
            filePath: String,
            convertionType: {
                type: String,
                enum: ["mp4-mp3", "pptx-pdf"],
            },
            fileSize: Number,
            uploadedAt: Date,
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

const Session = mongoose.model("Session", sessionSchema);
export default Session;