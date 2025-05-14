
import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import ImageProcessor from '@/components/ImageProcessor';
import ExcelProcessor from '@/components/ExcelProcessor';
import FileDropZone from '@/components/FileDropZone';
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedExcelFiles, setSelectedExcelFiles] = useState<File[]>([]);
  const [croppingPercentage, setCroppingPercentage] = useState<number>(70);
  const [processingOption, setProcessingOption] = useState<string>("images");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const { toast: shadcnToast } = useToast();

  useEffect(() => {
    // Show a loading toast
    toast.info("Loading face detection models...", {
      duration: 2000,
    });
  }, []);

  const handleImagesSelected = (files: File[]) => {
    setSelectedImages(files);
  };

  const handleExcelFilesSelected = (files: File[]) => {
    setSelectedExcelFiles(files);
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      if (processingOption === "images" && selectedImages.length > 0) {
        toast.promise(
          ImageProcessor.processImages(selectedImages, croppingPercentage),
          {
            loading: 'Processing images...',
            success: 'Images processed successfully!',
            error: 'Failed to process images',
          }
        );
      } else if (processingOption === "both") {
        if (selectedImages.length === 0) {
          toast.error("Please select images to process");
          setIsProcessing(false);
          return;
        }
        
        if (selectedExcelFiles.length === 0) {
          toast.error("Please select Excel files to process");
          setIsProcessing(false);
          return;
        }

        // Process both Excel files and images
        toast.promise(
          Promise.all([
            ExcelProcessor.processExcelFiles(selectedExcelFiles),
            ImageProcessor.processImages(selectedImages, croppingPercentage)
          ]),
          {
            loading: 'Processing files...',
            success: 'All files processed successfully!',
            error: 'Failed to process files',
          }
        );
      } else {
        toast.error("Please select files to process");
      }
    } catch (error) {
      console.error("Processing error:", error);
      toast.error("An error occurred during processing");
    }
    setIsProcessing(false);
  };

  const handleModelLoadingComplete = () => {
    setModelsLoaded(true);
    toast.success("Face detection models loaded successfully!");
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="w-full max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-gray-50 rounded-t-lg">
          <CardTitle className="text-2xl font-bold text-center text-gray-800">ID Card Image Converter</CardTitle>
          <CardDescription className="text-center text-gray-600">
            Process images and Excel files for ID card creation
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6">
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="upload">Upload Files</TabsTrigger>
              <TabsTrigger value="settings">Processing Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upload" className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Image Files</h3>
                  <FileDropZone 
                    onFilesSelected={handleImagesSelected}
                    acceptedTypes={".jpg,.jpeg,.png"}
                    multiple={true}
                    title="Drag & drop image files"
                    description="Or click to browse (JPG, PNG)"
                    selectedFiles={selectedImages}
                  />
                </div>
                
                {processingOption === "both" && (
                  <div>
                    <h3 className="text-lg font-medium mb-2">Excel Files</h3>
                    <FileDropZone 
                      onFilesSelected={handleExcelFilesSelected}
                      acceptedTypes={".xls,.xlsx"}
                      multiple={true}
                      title="Drag & drop Excel files"
                      description="Or click to browse (XLS, XLSX)"
                      selectedFiles={selectedExcelFiles}
                    />
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Face Cropping Percentage</h3>
                  <div className="flex flex-col space-y-2">
                    <div className="flex justify-between mb-2">
                      <span>Tight Crop</span>
                      <span>Wide Crop</span>
                    </div>
                    <Slider
                      value={[croppingPercentage]}
                      onValueChange={values => setCroppingPercentage(values[0])}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <span className="text-sm text-gray-500 mt-1">Current: {croppingPercentage}%</span>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="text-lg font-medium">Processing Options</h3>
                  <RadioGroup 
                    defaultValue={processingOption}
                    onValueChange={setProcessingOption}
                  >
                    <div className="flex items-center space-x-2">
                      <Radio value="images" id="images" />
                      <Label htmlFor="images">Process Images Only</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Radio value="both" id="both" />
                      <Label htmlFor="both">Process Images and Excel Files</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 flex justify-end">
            <Button 
              onClick={handleProcess} 
              disabled={isProcessing || !modelsLoaded || 
                (selectedImages.length === 0 && 
                (processingOption === "images" || 
                (processingOption === "both" && selectedExcelFiles.length === 0)))}
              className="w-full sm:w-auto"
            >
              {isProcessing ? "Processing..." : "Process Files"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Hidden component to load the models */}
      <div className="hidden">
        <ImageProcessor.FaceDetectionLoader onLoad={handleModelLoadingComplete} />
      </div>
    </div>
  );
};

export default Index;
