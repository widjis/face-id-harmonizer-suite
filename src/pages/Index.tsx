
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import FileDropZone from "@/components/FileDropZone"; // Fixed import statement
import ImageProcessor from '@/components/ImageProcessor';

const Index: React.FC = () => {
  const [adaptiveRadiusPercentage, setAdaptiveRadiusPercentage] = useState(25);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);

  const handleAdaptiveRadiusChange = useCallback((value: number[]) => {
    setAdaptiveRadiusPercentage(value[0]);
  }, []);

  const onFileAccepted = useCallback((acceptedFiles: File[]) => {
    setImageFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    setProcessingError(null);
  }, []);

  const onFileRejected = useCallback((rejectedFiles: File[]) => {
    console.log("Rejected File", rejectedFiles);
    setProcessingError("Only image files are allowed.");
  }, []);

  const handleProcessImages = async () => {
    if (imageFiles.length === 0) {
      setProcessingError("Please upload image files first.");
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    try {
      await ImageProcessor.processImages(imageFiles, adaptiveRadiusPercentage);
    } catch (error: any) {
      console.error("Processing error:", error);
      setProcessingError("Failed to process images. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModelsLoaded = useCallback(() => {
    setModelsLoaded(true);
    setIsLoadingModels(false);
  }, []);

  // UI Rendering
  return (
    <div className="container mx-auto p-6">
      {/* Header and Description */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-center mb-4">
          Employee Image Processor
        </h1>
        <p className="text-gray-600 text-center">
          Upload employee images, adjust processing options, and download the
          processed images in a zip file.
        </p>
      </div>

      {/* Processing Options */}
      <div className="mb-6">
        <h2 className="text-lg font-medium mb-2">Select Processing Options:</h2>
        <RadioGroup defaultValue="images-only" className="space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="images-only" id="images-only" />
            <Label htmlFor="images-only">Process Images Only</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both">Process Images and Excel Files</Label>
          </div>
        </RadioGroup>
      </div>

      {/* File Drop Zone */}
      <div className="mb-6">
        <FileDropZone
          onFileAccepted={onFileAccepted}
          onFileRejected={onFileRejected}
        />
        {processingError && (
          <p className="text-red-500 mt-2">{processingError}</p>
        )}
      </div>

      {/* Adaptive Radius Slider */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Adaptive Radius Percentage: {adaptiveRadiusPercentage}%</CardTitle>
        </CardHeader>
        <CardContent>
          <Slider
            defaultValue={[adaptiveRadiusPercentage]}
            max={50}
            min={5}
            step={1}
            onValueChange={handleAdaptiveRadiusChange}
            className="w-full"
          />
        </CardContent>
      </Card>

      {/* Process Button */}
      <Button
        onClick={handleProcessImages}
        disabled={isProcessing || imageFiles.length === 0}
        className="w-full"
      >
        {isProcessing ? "Processing..." : "Process Images"}
      </Button>
      
      {/* Models loading state - using the proper component reference */}
      {isLoadingModels && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Loading Face Detection Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-full"></div>
                </div>
                <p>This may take a moment...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Render the face detection loader component correctly */}
      {!modelsLoaded && <ImageProcessor.FaceDetectionLoader onLoad={handleModelsLoaded} />}

      {/* Error State */}
      {processingError && (
        <div className="mt-4 text-red-500">Error: {processingError}</div>
      )}
    </div>
  );
};

export default Index;
