import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

const app = express();
const PORT = process.env.PORT || 3001;
const LOGS_DIR = path.join(__dirname, '..', 'logs');

// GCS Configuration
const USE_GCS = process.env.USE_GCS === 'true' || process.env.NODE_ENV === 'production';
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'rabbit-in-holes';
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

// Ensure base logs directory exists for local fallback
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the 'public' directory (where client build will be placed)
const publicPath = path.join(__dirname, '..', 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
}

// Basic endpoint to check server status
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint to receive and sync full session logs
app.post('/api/session/sync', (req: Request, res: Response) => {
  const { userName, sessionId, sessionStartTime, actions, finalGameState } = req.body;
  
  if (!userName || !sessionId) {
    return res.status(400).json({ error: 'userName and sessionId are required' });
  }

  // Create a human friendly date time: YYYY-MM-DD-HH-MM-SS
  // Use sessionStartTime if provided, otherwise fallback to current time
  const startTime = sessionStartTime ? new Date(sessionStartTime) : new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const datetime = `${startTime.getFullYear()}-${pad(startTime.getMonth() + 1)}-${pad(startTime.getDate())}-${pad(startTime.getHours())}-${pad(startTime.getMinutes())}-${pad(startTime.getSeconds())}`;
  
  const fileName = `${datetime}-${sessionId}.log`;

  const logData = {
    userName,
    sessionId,
    sessionStartTime: sessionStartTime || startTime.toISOString(),
    timestamp: new Date().toISOString(),
    actions: actions || [],
    finalGameState: finalGameState || null
  };

  const jsonContent = JSON.stringify(logData, null, 2);

  if (USE_GCS) {
    // GCS path: logs/<userName>/<fileName>
    const gcsFileName = `logs/${userName}/${fileName}`;
    const file = bucket.file(gcsFileName);

    file.save(jsonContent, {
      contentType: 'application/json',
      resumable: false
    }).then(() => {
      console.log(`[SESSION SYNCED GCS]: ${userName} - ${gcsFileName}`);
      res.json({ success: true });
    }).catch(err => {
      console.error('Error uploading to GCS:', err);
      res.status(500).json({ error: 'Failed to sync session to GCS' });
    });
  } else {
    // Local Fallback
    const userDir = path.join(LOGS_DIR, userName);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    const filePath = path.join(userDir, fileName);

    fs.writeFile(filePath, jsonContent, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
        return res.status(500).json({ error: 'Failed to sync session' });
      }
      console.log(`[SESSION SYNCED LOCAL]: ${userName} - ${fileName}`);
      res.json({ success: true });
    });
  }
});



// Catch-all route to serve the index.html for SPA routing
if (fs.existsSync(publicPath)) {
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
