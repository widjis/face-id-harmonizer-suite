import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { apiClient, type Employee, formatApiError } from '@/lib/apiClient';

export interface EmployeeCardMapping {
  employeeId: string;
  employeeName: string;
  cardNumber?: string;
  status: 'pending' | 'mapped' | 'error';
  errorMessage?: string;
}

interface CardMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeCardMapping[];
  onCardMapped: (employeeId: string, cardNumber: string) => void;
  onSkipEmployee: (employeeId: string) => void;
  onComplete: () => void;
}

interface NFCStatus {
  supported: boolean;
  enabled: boolean;
  reading: boolean;
  error?: string;
}

export const CardMappingDialog: React.FC<CardMappingDialogProps> = ({
  open,
  onOpenChange,
  employees,
  onCardMapped,
  onSkipEmployee,
  onComplete,
}) => {
  const [currentEmployeeIndex, setCurrentEmployeeIndex] = useState(0);
  const [manualCardNumber, setManualCardNumber] = useState('');
  const [nfcStatus, setNfcStatus] = useState<NFCStatus>({
    supported: false,
    enabled: false,
    reading: false,
  });
  const [inputMethod, setInputMethod] = useState<'nfc' | 'manual'>('nfc');
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentEmployee = employees[currentEmployeeIndex];
  const pendingEmployees = employees.filter(emp => emp.status === 'pending');
  const completedCount = employees.filter(emp => emp.status === 'mapped').length;
  const totalCount = employees.length;

  // Check NFC support on component mount
  useEffect(() => {
    checkNFCSupport();
  }, []);

  // Cleanup NFC reading on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const checkNFCSupport = async () => {
    if ('NDEFReader' in window) {
      try {
        const ndefReader = new (window as any).NDEFReader();
        setNfcStatus(prev => ({ ...prev, supported: true, enabled: true }));
      } catch (error) {
        setNfcStatus(prev => ({ 
          ...prev, 
          supported: true, 
          enabled: false, 
          error: 'NFC permission denied or not available' 
        }));
      }
    } else {
      setNfcStatus(prev => ({ 
        ...prev, 
        supported: false, 
        error: 'NFC not supported in this browser' 
      }));
    }
  };

  const startNFCReading = async () => {
    if (!nfcStatus.supported || !nfcStatus.enabled) {
      toast.error('NFC is not available. Please use manual input.');
      setInputMethod('manual');
      return;
    }

    try {
      setNfcStatus(prev => ({ ...prev, reading: true, error: undefined }));
      
      // Create new abort controller for this reading session
      abortControllerRef.current = new AbortController();
      
      const ndefReader = new (window as any).NDEFReader();
      
      await ndefReader.scan({ signal: abortControllerRef.current.signal });
      
      toast.success('NFC reader activated. Please tap your card.');

      ndefReader.addEventListener('reading', (event: any) => {
        const cardNumber = extractCardNumber(event);
        if (cardNumber) {
          handleCardNumberInput(cardNumber);
          stopNFCReading();
        }
      });

      ndefReader.addEventListener('readingerror', () => {
        toast.error('Failed to read NFC card. Please try again.');
        setNfcStatus(prev => ({ ...prev, reading: false }));
      });

    } catch (error: any) {
      console.error('NFC reading error:', error);
      setNfcStatus(prev => ({ 
        ...prev, 
        reading: false, 
        error: error.message || 'Failed to start NFC reading' 
      }));
      toast.error('Failed to start NFC reading. Please use manual input.');
      setInputMethod('manual');
    }
  };

  const stopNFCReading = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setNfcStatus(prev => ({ ...prev, reading: false }));
  };

  const extractCardNumber = (event: any): string | null => {
    try {
      // Try to extract card number from NFC data
      // This is a simplified implementation - actual card number extraction
      // depends on the specific card format and data structure
      
      if (event.serialNumber) {
        // Convert serial number to card number format
        return event.serialNumber.replace(/:/g, '').toUpperCase();
      }
      
      // Try to read NDEF records
      if (event.message && event.message.records) {
        for (const record of event.message.records) {
          if (record.recordType === 'text') {
            const textDecoder = new TextDecoder(record.encoding || 'utf-8');
            const cardNumber = textDecoder.decode(record.data);
            if (cardNumber && /^[0-9A-Fa-f]+$/.test(cardNumber)) {
              return cardNumber.toUpperCase();
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting card number:', error);
      return null;
    }
  };

  const handleCardNumberInput = async (cardNumber: string) => {
    if (!cardNumber.trim()) {
      toast.error('Please enter a valid card number.');
      return;
    }

    // Validate card number format (basic validation)
    const cleanCardNumber = cardNumber.trim().toUpperCase();
    if (!/^[0-9A-Fa-f]{6,16}$/.test(cleanCardNumber)) {
      toast.error('Card number must be 6-16 hexadecimal characters.');
      return;
    }

    try {
      // Call the API to assign the card to the employee
      await apiClient.assignCardToEmployee(currentEmployee.employeeId, cleanCardNumber);
      
      onCardMapped(currentEmployee.employeeId, cleanCardNumber);
      setManualCardNumber('');
      
      toast.success(`Card ${cleanCardNumber} mapped for ${currentEmployee.employeeName}`);
      
      // Move to next pending employee
      moveToNextEmployee();
    } catch (error) {
      const errorMessage = formatApiError(error);
      toast.error(`Failed to map card: ${errorMessage}`);
      console.error('Card mapping error:', error);
    }
  };

  const handleManualSubmit = () => {
    handleCardNumberInput(manualCardNumber);
  };

  const handleSkip = () => {
    onSkipEmployee(currentEmployee.employeeId);
    toast.info(`Skipped ${currentEmployee.employeeName}`);
    moveToNextEmployee();
  };

  const moveToNextEmployee = () => {
    const nextPendingIndex = employees.findIndex((emp, index) => 
      index > currentEmployeeIndex && emp.status === 'pending'
    );
    
    if (nextPendingIndex !== -1) {
      setCurrentEmployeeIndex(nextPendingIndex);
    } else {
      // No more pending employees, complete the process
      onComplete();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputMethod === 'manual' && manualCardNumber.trim()) {
      handleManualSubmit();
    }
  };

  if (!currentEmployee) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Card Number Mapping
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Progress: {completedCount} / {totalCount}</span>
            <Badge variant="outline">
              {pendingEmployees.length} remaining
            </Badge>
          </div>

          {/* Current employee info */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {currentEmployee.employeeName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{currentEmployee.employeeName}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {currentEmployee.employeeId}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input method selection */}
          <div className="flex gap-2">
            <Button
              variant={inputMethod === 'nfc' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('nfc')}
              disabled={!nfcStatus.supported}
              className="flex-1"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              NFC Tap
            </Button>
            <Button
              variant={inputMethod === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInputMethod('manual')}
              className="flex-1"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manual Input
            </Button>
          </div>

          <Separator />

          {/* NFC Method */}
          {inputMethod === 'nfc' && (
            <div className="space-y-3">
              {!nfcStatus.supported && (
                <Alert>
                  <WifiOff className="h-4 w-4" />
                  <AlertDescription>
                    NFC is not supported in this browser. Please use manual input.
                  </AlertDescription>
                </Alert>
              )}

              {nfcStatus.supported && !nfcStatus.enabled && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    NFC permission is required. Please enable NFC access.
                  </AlertDescription>
                </Alert>
              )}

              {nfcStatus.supported && nfcStatus.enabled && (
                <div className="text-center space-y-3">
                  {!nfcStatus.reading ? (
                    <Button onClick={startNFCReading} className="w-full">
                      <Wifi className="h-4 w-4 mr-2" />
                      Start NFC Reading
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Waiting for card tap...</span>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={stopNFCReading}
                        className="w-full"
                      >
                        Stop Reading
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {nfcStatus.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{nfcStatus.error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Manual Input Method */}
          {inputMethod === 'manual' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="Enter card number (e.g., 1A2B3C4D)"
                  value={manualCardNumber}
                  onChange={(e) => setManualCardNumber(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter 6-16 hexadecimal characters (0-9, A-F)
                </p>
              </div>
              
              <Button 
                onClick={handleManualSubmit}
                disabled={!manualCardNumber.trim()}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Map Card Number
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={handleSkip}
            className="w-full sm:w-auto"
          >
            Skip This Employee
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel Process
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};