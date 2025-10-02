import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Camera, X, Upload, Loader } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProfilePictureUploaderProps {
  currentImageUrl?: string | null;
  onImageUpdate?: (newImageUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  className?: string;
}

const ProfilePictureUploader: React.FC<ProfilePictureUploaderProps> = ({
  currentImageUrl,
  onImageUpdate,
  size = 'md',
  editable = true,
  className = ''
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Size configurations
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('profile.invalidFileType'));
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error(t('profile.fileTooLarge'));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    uploadImage(file);
  };

  const uploadImage = async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('profile_picture', file);

      const token = localStorage.getItem('access_token');
      
      // Check if token exists
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }

      const response = await fetch('/api/auth/upload-profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(t('profile.pictureUploaded'));
        onImageUpdate?.(data.profile_picture_url);
        setPreviewUrl(null); // Clear preview since we now have the real URL
      } else if (response.status === 401) {
        // Handle authentication errors
        localStorage.removeItem('access_token'); // Clear invalid token
        throw new Error(data.message || 'Authentication failed. Please login again.');
      } else {
        throw new Error(data.error || t('profile.uploadFailed'));
      }
    } catch (error) {
      console.error('Profile picture upload error:', error);
      toast.error(error instanceof Error ? error.message : t('profile.uploadFailed'));
      setPreviewUrl(null); // Clear preview on error
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const removeImage = async () => {
    if (!currentImageUrl) return;

    setIsUploading(true);
    
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/auth/remove-profile-picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(t('profile.pictureRemoved'));
        onImageUpdate?.(null);
      } else {
        throw new Error(data.error || t('profile.removeFailed'));
      }
    } catch (error) {
      console.error('Profile picture removal error:', error);
      toast.error(error instanceof Error ? error.message : t('profile.removeFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const displayUrl = previewUrl || currentImageUrl;

  return (
    <div className={`relative ${className}`}>
      <div className={`relative ${sizeClasses[size]} rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100 border-4 border-white shadow-lg group`}>
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Profile"
            className="w-full h-full object-cover"
            onError={(e) => {
              console.error('Failed to load profile image:', displayUrl);
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <User 
              size={iconSizes[size]} 
              className="text-gray-400"
            />
          </div>
        )}

        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Loader className="animate-spin text-white" size={iconSizes[size]} />
          </div>
        )}

        {/* Hover overlay for editable mode */}
        {editable && !isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <Camera className="text-white" size={iconSizes[size]} />
          </div>
        )}
      </div>

      {/* Action buttons */}
      {editable && (
        <div className="absolute -bottom-2 -right-2 flex gap-1">
          {/* Upload button */}
          <button
            onClick={openFileDialog}
            disabled={isUploading}
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-full p-2 shadow-lg transition-colors duration-200"
            title={t('profile.uploadPicture')}
          >
            <Upload size={14} />
          </button>

          {/* Remove button (only show if there's an image) */}
          {currentImageUrl && (
            <button
              onClick={removeImage}
              disabled={isUploading}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-full p-2 shadow-lg transition-colors duration-200"
              title={t('profile.removePicture')}
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
    </div>
  );
};

export default ProfilePictureUploader;