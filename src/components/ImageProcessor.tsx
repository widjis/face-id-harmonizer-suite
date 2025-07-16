
import React, { useEffect } from 'react';
import * as faceapi from 'face-api.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Face detection loader component
const FaceDetectionLoader: React.FC<{ onLoad: () => void }> = ({ onLoad }) => {
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Load face-api models from CDN instead of local files
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        ]);
        
        console.log('Face detection models loaded');
        onLoad();
      } catch (error) {
        console.error('Error loading face detection models:', error);
      }
    };

    loadModels();
  }, [onLoad]);

  return null;
};

class ImageProcessor {
  static FaceDetectionLoader = FaceDetectionLoader;

  /**
   * Extracts employee ID from filename with flexible separator detection
   * Handles patterns like: MTIxxxxx - Name, MTIxxxxxx_Name, MTIxxxxx.Name, etc.
   */
  static extractEmployeeId(filename: string): string {
    // Common separators to try
    const separators = [' - ', '_', '.', ' ', '-'];
    
    // Try each separator to find the best match
    for (const separator of separators) {
      const parts = filename.split(separator);
      if (parts.length >= 2) {
        const potentialId = parts[0].trim();
        
        // Check if the first part looks like an employee ID
        // Pattern: starts with MTI followed by numbers, or just numbers
        if (this.isValidEmployeeId(potentialId)) {
          return potentialId;
        }
      }
    }
    
    // If no separator found, check if the whole filename is a valid ID
    const trimmedFilename = filename.trim();
    if (this.isValidEmployeeId(trimmedFilename)) {
      return trimmedFilename;
    }
    
    // Fallback: try to extract MTI pattern or numbers from anywhere in the filename
    const mtiMatch = filename.match(/MTI\d+/i);
    if (mtiMatch) {
      return mtiMatch[0];
    }
    
    // Last resort: extract first sequence of numbers
    const numberMatch = filename.match(/\d+/);
    if (numberMatch) {
      return numberMatch[0];
    }
    
    // If all else fails, return the original filename
    return filename;
  }
  
  /**
   * Validates if a string looks like a valid employee ID
   */
  static isValidEmployeeId(id: string): boolean {
    // Remove whitespace
    const cleanId = id.trim();
    
    // Check for MTI pattern (case insensitive)
    if (/^MTI\d+$/i.test(cleanId)) {
      return true;
    }
    
    // Check for pure numeric ID (at least 3 digits)
    if (/^\d{3,}$/.test(cleanId)) {
      return true;
    }
    
    // Check for alphanumeric ID (at least 3 characters)
    if (/^[A-Za-z0-9]{3,}$/.test(cleanId) && /\d/.test(cleanId)) {
      return true;
    }
    
    return false;
  }

  static async processImages(imageFiles: File[], adaptiveRadiusPercentage: number): Promise<void> {
    const zip = new JSZip();
    const processedFolder = zip.folder("processed_images");
    
    if (!processedFolder) {
      throw new Error("Failed to create zip folder");
    }
    
    // Store processing promises
    const processingPromises = imageFiles.map(async (file) => {
      try {
        const processedImage = await this.processImage(file, adaptiveRadiusPercentage);
        
        // Extract employee ID from filename for the output
        const fileName = file.name;
        const fileNameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        const employeeId = this.extractEmployeeId(fileNameWithoutExt);
        
        const outputFileName = `${employeeId}.jpg`;
        
        // Add to zip
        processedFolder.file(outputFileName, processedImage);
        return { success: true, fileName: outputFileName };
      } catch (error) {
        console.error(`Error processing image ${file.name}:`, error);
        return { success: false, fileName: file.name, error };
      }
    });
    
    // Wait for all images to be processed
    const results = await Promise.all(processingPromises);
    
    // Generate and download the zip file
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "processed_images.zip");
    
    // Log results
    const successCount = results.filter(r => r.success).length;
    console.log(`Processed ${successCount} out of ${imageFiles.length} images`);
  }
  
  static async processImage(file: File, adaptiveRadiusPercentage: number): Promise<Blob> {
    return new Promise(async (resolve, reject) => {
      try {
        // Create image element to load the file
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onload = async () => {
          try {
            // Create a canvas element to manipulate the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Failed to get canvas context');
            }
            
            // Set canvas to match image dimensions
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Detect faces using face-api.js
            const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options());
            
            if (detections.length === 0) {
              throw new Error('No face detected in image');
            }
            
            // Get the largest face
            const largestFace = detections.reduce((prev, current) => 
              (current.box.width * current.box.height > prev.box.width * prev.box.height) 
                ? current 
                : prev
            );
            
            // Extract face box values
            const { x, y, width, height } = largestFace.box;
            
            // Calculate the adaptive radius based on face size
            const radius = Math.min(width, height) * adaptiveRadiusPercentage / 100;
            
            // Adjust coordinates to include more area above the face
            const topPadding = radius * 1.5;
            const bottomPadding = radius * 0.5;
            
            // Calculate crop coordinates
            let cropX = Math.max(0, x - radius);
            let cropY = Math.max(0, y - topPadding);
            let cropWidth = Math.min(img.width - cropX, width + (2 * radius));
            let cropHeight = Math.min(img.height - cropY, height + topPadding + bottomPadding);
            
            // Create a new canvas for the cropped image
            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = 400; // Fixed output size
            croppedCanvas.height = 400;
            
            const croppedCtx = croppedCanvas.getContext('2d');
            if (!croppedCtx) {
              throw new Error('Failed to get cropped canvas context');
            }
            
            // Draw the cropped and resized face
            croppedCtx.drawImage(
              canvas, 
              cropX, cropY, cropWidth, cropHeight, 
              0, 0, 400, 400
            );
            
            // Convert to blob
            croppedCanvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to create image blob'));
              }
            }, 'image/jpeg', 0.95);
            
            // Clean up
            URL.revokeObjectURL(objectUrl);
          } catch (error) {
            URL.revokeObjectURL(objectUrl);
            reject(error);
          }
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Failed to load image: ${file.name}`));
        };
        
        img.src = objectUrl;
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default ImageProcessor;
