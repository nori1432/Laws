import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';

interface StudentQRCodeProps {
  studentId: number;
  classId: number;
  studentName: string;
  className: string;
  courseName: string;
  schedule: string;
  onRefresh?: () => void;
}

const StudentQRCode: React.FC<StudentQRCodeProps> = ({
  studentId,
  classId,
  studentName,
  className,
  courseName,
  schedule,
  onRefresh
}) => {
  const [qrData, setQrData] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchQRData();
  }, [studentId, classId]);

  const fetchQRData = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`/api/attendance/student-qr/${studentId}/${classId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch QR code');
      }

      const data = await response.json();
      setQrData(data.qr_data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchQRData();
    if (onRefresh) {
      onRefresh();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Generating QR Code...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
        <div className="text-red-500 mb-4">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">
        {studentName}
      </h3>
      <p className="text-sm text-gray-600 mb-2">
        {courseName} - {className}
      </p>
      <p className="text-xs text-gray-500 mb-4">
        {schedule}
      </p>

      <div className="bg-white p-4 rounded-lg border-2 border-gray-200 mb-4">
        <QRCode
          value={qrData}
          size={200}
          level="M"
          includeMargin={true}
        />
      </div>

      <p className="text-xs text-center text-gray-500 mb-4">
        Show this QR code to your instructor for attendance
      </p>

      <button
        onClick={handleRefresh}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm"
      >
        Refresh QR Code
      </button>
    </div>
  );
};

export default StudentQRCode;