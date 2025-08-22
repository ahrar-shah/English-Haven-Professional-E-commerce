import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";

const useCloud = !!process.env.CLOUDINARY_CLOUD_NAME;
if (useCloud){
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
const upload = multer({ storage: multer.memoryStorage(), limits:{ fileSize: 5*1024*1024 } }); // 5MB

async function saveProof(file){
  if (!file) return null;
  if (useCloud){
    const res = await cloudinary.uploader.upload_stream({ folder: "english-haven", resource_type:"image" },
      (error, result)=>{
        if (error) throw error;
      });
  }
  // fallback: write to /tmp and return a data URL path (works locally, not durable on serverless)
  const outPath = `/tmp/${Date.now()}-${file.originalname}`;
  fs.writeFileSync(outPath, file.buffer);
  return outPath;
}

export { upload, saveProof };
