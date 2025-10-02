"""
ImgBB Upload Utility
Handles uploading images to ImgBB hosting service
"""

import requests
import base64
import os
from typing import Optional, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ImgBBUploader:
    """Utility class for uploading images to ImgBB"""
    
    def __init__(self, api_key: str):
        """
        Initialize ImgBB uploader with API key
        
        Args:
            api_key (str): ImgBB API key
        """
        self.api_key = api_key
        self.base_url = "https://api.imgbb.com/1/upload"
        
    def upload_image(self, image_data: bytes, filename: str = "profile_picture") -> Optional[Dict[str, Any]]:
        """
        Upload image to ImgBB
        
        Args:
            image_data (bytes): Image file data in bytes
            filename (str): Optional filename for the image
            
        Returns:
            Dict[str, Any]: ImgBB response data with URLs, or None if failed
        """
        try:
            # Convert image data to base64
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # Prepare the payload
            payload = {
                'key': self.api_key,
                'image': image_base64,
                'name': filename
            }
            
            # Make the request
            logger.info(f"Uploading image to ImgBB with filename: {filename}")
            response = requests.post(self.base_url, data=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    logger.info("Image uploaded successfully to ImgBB")
                    return {
                        'success': True,
                        'url': result['data']['url'],
                        'display_url': result['data']['display_url'],
                        'thumb': result['data']['thumb']['url'],
                        'medium': result['data']['medium']['url'],
                        'delete_url': result['data']['delete_url'],
                        'size': result['data']['size'],
                        'title': result['data']['title'],
                        'image_id': result['data']['id']
                    }
                else:
                    logger.error(f"ImgBB API returned error: {result}")
                    return None
            else:
                logger.error(f"ImgBB API request failed with status {response.status_code}: {response.text}")
                return None
                
        except requests.exceptions.Timeout:
            logger.error("ImgBB upload request timed out")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"ImgBB upload request failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during ImgBB upload: {str(e)}")
            return None
    
    def upload_from_file(self, file_path: str, filename: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Upload image file to ImgBB
        
        Args:
            file_path (str): Path to the image file
            filename (str): Optional custom filename
            
        Returns:
            Dict[str, Any]: ImgBB response data with URLs, or None if failed
        """
        try:
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return None
                
            with open(file_path, 'rb') as file:
                image_data = file.read()
                
            if filename is None:
                filename = os.path.basename(file_path)
                
            return self.upload_image(image_data, filename)
            
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {str(e)}")
            return None
    
    def is_valid_image(self, image_data: bytes) -> bool:
        """
        Check if the provided data is a valid image
        
        Args:
            image_data (bytes): Image data to validate
            
        Returns:
            bool: True if valid image, False otherwise
        """
        try:
            # Check for common image file signatures
            image_signatures = [
                b'\xff\xd8\xff',  # JPEG
                b'\x89PNG\r\n\x1a\n',  # PNG
                b'GIF87a',  # GIF87a
                b'GIF89a',  # GIF89a
                b'RIFF',  # WebP (starts with RIFF)
                b'BM',  # BMP
            ]
            
            for signature in image_signatures:
                if image_data.startswith(signature):
                    return True
                    
            # Additional check for WebP
            if image_data.startswith(b'RIFF') and b'WEBP' in image_data[:12]:
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Error validating image: {str(e)}")
            return False
    
    def get_image_size(self, image_data: bytes) -> int:
        """
        Get the size of image data in bytes
        
        Args:
            image_data (bytes): Image data
            
        Returns:
            int: Size in bytes
        """
        return len(image_data)


# Initialize global uploader instance
# API key will be set from environment or config
IMGBB_API_KEY = "292e097078558ff4600633ef6aff3e0f"
imgbb_uploader = ImgBBUploader(IMGBB_API_KEY)


def upload_profile_picture(image_data: bytes, user_id: int) -> Optional[Dict[str, Any]]:
    """
    Convenience function to upload a user's profile picture
    
    Args:
        image_data (bytes): Image file data
        user_id (int): User ID for filename
        
    Returns:
        Dict[str, Any]: Upload result with URLs, or None if failed
    """
    filename = f"profile_picture_user_{user_id}"
    
    # Validate image
    if not imgbb_uploader.is_valid_image(image_data):
        logger.error("Invalid image data provided")
        return None
    
    # Check file size (ImgBB has a 32MB limit)
    max_size = 32 * 1024 * 1024  # 32MB
    if imgbb_uploader.get_image_size(image_data) > max_size:
        logger.error(f"Image too large. Maximum size is {max_size} bytes")
        return None
    
    return imgbb_uploader.upload_image(image_data, filename)


if __name__ == "__main__":
    # Test the uploader (for development purposes)
    print("ImgBB Uploader initialized successfully")
    print(f"API Key configured: {'Yes' if IMGBB_API_KEY else 'No'}")