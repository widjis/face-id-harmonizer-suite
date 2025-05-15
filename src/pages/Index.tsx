
import React, { useState, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import FileDropZone from "@/components/FileDropZone";
import ImageProcessor from '@/components/ImageProcessor';
import ExcelProcessor from '@/components/ExcelProcessor';
import { Download, FileText, Upload } from 'lucide-react';

const Index: React.FC = () => {
  const [adaptiveRadiusPercentage, setAdaptiveRadiusPercentage] = useState(50);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [excelFiles, setExcelFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [processMode, setProcessMode] = useState<'images-only' | 'both'>('both');

  const handleAdaptiveRadiusChange = useCallback((value: number[]) => {
    setAdaptiveRadiusPercentage(value[0]);
  }, []);

  const handleImageFilesSelected = useCallback((acceptedFiles: File[]) => {
    setImageFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    setProcessingError(null);
  }, []);

  const handleExcelFilesSelected = useCallback((acceptedFiles: File[]) => {
    setExcelFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    setProcessingError(null);
  }, []);

  const handleProcessImages = async () => {
    if (imageFiles.length === 0 && processMode === 'images-only') {
      setProcessingError("Please upload image files first.");
      return;
    }

    if (processMode === 'both' && (imageFiles.length === 0 || excelFiles.length === 0)) {
      setProcessingError("Please upload both image and Excel files.");
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);

    try {
      // Process images
      if (imageFiles.length > 0) {
        await ImageProcessor.processImages(imageFiles, adaptiveRadiusPercentage);
        toast.success("Images processed successfully!");
      }

      // Process Excel files if in 'both' mode
      if (processMode === 'both' && excelFiles.length > 0) {
        await ExcelProcessor.processExcelFiles(excelFiles);
        toast.success("Excel files processed successfully!");
      }
    } catch (error: any) {
      console.error("Processing error:", error);
      setProcessingError(`Failed to process files: ${error.message || 'Unknown error'}`);
      toast.error("Failed to process files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModelsLoaded = useCallback(() => {
    setModelsLoaded(true);
    setIsLoadingModels(false);
  }, []);

  const handleProcessModeChange = (value: string) => {
    setProcessMode(value as 'images-only' | 'both');
    setProcessingError(null);
  };

  // UI Rendering
  return (
    <div className="container mx-auto p-6">
      {/* Header and Description */}
      <div className="mb-8">
        {/* MTI Logo */}
        <div className="flex justify-center mb-4">
          <img 
            src="/MTI-removebg-preview.png" 
            alt="MTI Logo" 
            className="h-24 w-auto" 
          />
        </div>
  
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
        <RadioGroup 
          defaultValue="both" 
          className="space-y-2"
          value={processMode}
          onValueChange={handleProcessModeChange}
        >
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

      {/* File Drop Zones */}
      <div className="mb-6 grid gap-6">
        {/* Image Files Drop Zone */}
        <div>
          <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
            <Upload size={18} />
            Image Files
          </h2>
          <FileDropZone
            onFilesSelected={handleImageFilesSelected}
            acceptedTypes=".jpg,.jpeg,.png"
            title="Drop image files here"
            description="or click to browse (JPG, JPEG, PNG)"
            multiple={true}
            selectedFiles={imageFiles}
          />
        </div>

        {/* Excel Files Drop Zone - only show when 'both' mode is selected */}
        {processMode === 'both' && (
          <div>
            <h2 className="text-lg font-medium mb-2 flex items-center gap-2">
              <FileText size={18} />
              Excel Files
            </h2>
            <FileDropZone
              onFilesSelected={handleExcelFilesSelected}
              acceptedTypes=".xlsx,.xls"
              title="Drop Excel files here"
              description="or click to browse (XLSX, XLS)"
              multiple={true}
              selectedFiles={excelFiles}
            />
          </div>
        )}

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
            max={100}
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
        disabled={isProcessing || (processMode === 'images-only' ? imageFiles.length === 0 : (imageFiles.length === 0 || excelFiles.length === 0))}
        className="w-full flex items-center justify-center gap-2"
      >
        {isProcessing ? (
          <>Processing...</>
        ) : (
          <>
            <Download size={18} />
            {processMode === 'both' 
              ? "Process Images & Generate Excel Files" 
              : "Process Images"}
          </>
        )}
      </Button>
      
      {/* Models loading state */}
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

      {/* Render the face detection loader component */}
      {!modelsLoaded && <ImageProcessor.FaceDetectionLoader onLoad={handleModelsLoaded} />}
    </div>
  );
};

export default Index;
