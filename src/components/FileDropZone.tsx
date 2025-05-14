
import React, { useState, useRef } from 'react';
import { X, Upload, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes: string;
  multiple?: boolean;
  title: string;
  description: string;
  selectedFiles: File[];
}

const FileDropZone: React.FC<FileDropZoneProps> = ({
  onFilesSelected,
  acceptedTypes,
  multiple = false,
  title,
  description,
  selectedFiles
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const filteredFiles = files.filter(file => {
        const fileType = '.' + file.name.split('.').pop()?.toLowerCase();
        return acceptedTypes.split(',').includes(fileType);
      });
      
      if (filteredFiles.length > 0) {
        onFilesSelected(multiple ? filteredFiles : [filteredFiles[0]]);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const handleClickDropZone = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = (fileToRemove: File) => {
    const updatedFiles = selectedFiles.filter(file => file !== fileToRemove);
    onFilesSelected(updatedFiles);
  };

  return (
    <div className="space-y-3">
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickDropZone}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept={acceptedTypes}
          multiple={multiple}
          className="hidden"
        />
        
        <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium mb-2">Selected Files ({selectedFiles.length})</h4>
          <div className="max-h-40 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between py-1 px-2 bg-white rounded mb-1">
                <div className="flex items-center">
                  <FileIcon className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="text-sm truncate max-w-[300px]">{file.name}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(file);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDropZone;
