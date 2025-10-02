import React from 'react';

interface QRCodeGeneratorProps {
  text: string;
  size?: number;
  className?: string;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ 
  text, 
  size = 100, 
  className = '' 
}) => {
  // Generate QR code data URL using a simple QR code library
  const generateQRCode = (data: string, size: number) => {
    // For now, we'll use a placeholder. In a real implementation, you'd use a QR code library
    // or call an API to generate the QR code
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Simple pattern for demonstration - replace with actual QR code generation
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);
      
      ctx.fillStyle = '#FFFFFF';
      const cellSize = size / 8;
      
      // Create a simple pattern
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if ((i + j) % 2 === 0) {
            ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize);
          }
        }
      }
      
      // Add data as text overlay for debugging
      ctx.fillStyle = '#000000';
      ctx.font = '8px Arial';
      ctx.fillText(data.substring(0, 10), 2, size - 2);
    }
    
    return canvas.toDataURL();
  };

  const qrCodeDataUrl = generateQRCode(text, size);

  return (
    <div className={`inline-block ${className}`}>
      <img 
        src={qrCodeDataUrl} 
        alt={`QR Code: ${text}`}
        width={size}
        height={size}
        className="border border-gray-300"
      />
    </div>
  );
};

export default QRCodeGenerator;