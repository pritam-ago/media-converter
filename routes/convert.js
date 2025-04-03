import express from "express";
import Ffmpeg from "fluent-ffmpeg";
import path from "path";
import fs from "fs";

const router = express.Router();

router.post("/mp4-to-mp3", async (req, res) => {
    const { filePaths } = req.body;

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return res.status(400).json({ error: "File paths are required!" });
    }

    if (!fs.existsSync("converted")) {
        fs.mkdirSync("converted", { recursive: true });
    }

    const checkAudioStream = (filePath) => {
        return new Promise((resolve) => {
            Ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    console.error("FFprobe error:", err.message);
                    return resolve({ error: `Cannot read file metadata: ${err.message}` });
                }

                const hasAudio = metadata.streams.some((stream) => stream.codec_type === "audio");
                if (!hasAudio) {
                    return resolve({ error: `No audio stream found in file: ${filePath}` });
                }

                resolve({ hasAudio: true });
            });
        });
    };

    const convertFile = async (filePath) => {
        if (!fs.existsSync(filePath)) {
            return { error: `File not found: ${filePath}` };
        }

        const audioCheck = await checkAudioStream(filePath);
        if (audioCheck.error) {
            return { error: audioCheck.error };
        }

        const outputPath = `converted/${Date.now()}-${path.parse(filePath).name}.mp3`;

        return new Promise((resolve) => {
            Ffmpeg(filePath)
                .toFormat("mp3")
                .on("end", () => {
                    console.log(`Conversion successful: ${outputPath}`);
                    resolve({ success: true, convertedFile: outputPath });
                })
                .on("error", (err) => {
                    console.error("FFmpeg error:", err.message);
                    resolve({ error: `Conversion failed for ${filePath}: ${err.message}` });
                })
                .save(outputPath);
        });
    };

    const results = await Promise.all(filePaths.map(convertFile));

    res.json({ results });
});

export default router;
