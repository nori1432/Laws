"""
Firebase Admin SDK Initialization for Push Notifications

This module initializes Firebase Admin SDK to send push notifications
via Firebase Cloud Messaging (FCM) to your mobile app users.

The service account credentials are stored in:
- LawsOfSuccessMob/lawsofsuccess-cdd79-firebase-adminsdk-fbsvc-95e2d101b9.json

Make sure to copy this file to your API directory or set the path correctly.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, messaging
import logging

logger = logging.getLogger(__name__)

# Global Firebase app instance
_firebase_app = None

def initialize_firebase():
    """
    Initialize Firebase Admin SDK
    
    Returns:
        firebase_admin.App: Initialized Firebase app instance
    """
    global _firebase_app
    
    if _firebase_app is not None:
        logger.info("✅ Firebase Admin SDK already initialized")
        return _firebase_app
    
    try:
        # Path to service account key file
        # Option 1: Load from file in parent directory
        service_account_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'LawsOfSuccessMob',
            'lawsofsuccess-cdd79-firebase-adminsdk-fbsvc-95e2d101b9.json'
        )
        
        # Option 2: If not found, try current directory
        if not os.path.exists(service_account_path):
            service_account_path = os.path.join(
                os.path.dirname(__file__),
                'lawsofsuccess-cdd79-firebase-adminsdk-fbsvc-95e2d101b9.json'
            )
        
        # Option 3: Load from environment variable (for production)
        if not os.path.exists(service_account_path):
            service_account_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
            if service_account_json:
                logger.info("Loading Firebase credentials from environment variable")
                service_account_dict = json.loads(service_account_json)
                cred = credentials.Certificate(service_account_dict)
            else:
                logger.error("❌ Firebase service account file not found and no environment variable set")
                logger.error(f"Searched paths: {service_account_path}")
                return None
        else:
            logger.info(f"Loading Firebase credentials from: {service_account_path}")
            cred = credentials.Certificate(service_account_path)
        
        # Initialize Firebase app
        _firebase_app = firebase_admin.initialize_app(cred)
        logger.info("✅ Firebase Admin SDK initialized successfully")
        
        return _firebase_app
        
    except Exception as e:
        logger.error(f"❌ Error initializing Firebase Admin SDK: {e}")
        return None


def send_fcm_notification(fcm_token: str, title: str, body: str, data: dict = None) -> bool:
    """
    Send push notification via Firebase Cloud Messaging
    
    Args:
        fcm_token: FCM device token
        title: Notification title
        body: Notification body
        data: Additional data payload
        
    Returns:
        bool: True if sent successfully, False otherwise
    """
    try:
        # Ensure Firebase is initialized
        if _firebase_app is None:
            initialize_firebase()
        
        if _firebase_app is None:
            logger.error("Cannot send FCM notification - Firebase not initialized")
            return False
        
        # Prepare notification message
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            token=fcm_token,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    icon='icon',
                    color='#D4AF37',
                    sound='default',
                ),
            ),
            apns=messaging.APNSConfig(
                headers={'apns-priority': '10'},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title=title,
                            body=body,
                        ),
                        badge=1,
                        sound='default',
                    ),
                ),
            ),
        )
        
        # Send message
        response = messaging.send(message)
        logger.info(f"✅ FCM notification sent successfully: {response}")
        return True
        
    except firebase_admin.exceptions.InvalidArgumentError as e:
        logger.error(f"❌ Invalid FCM token or message: {e}")
        return False
    except firebase_admin.exceptions.UnavailableError as e:
        logger.error(f"❌ FCM service unavailable: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error sending FCM notification: {e}")
        return False


def send_fcm_batch(tokens: list, title: str, body: str, data: dict = None) -> dict:
    """
    Send push notifications to multiple devices
    
    Args:
        tokens: List of FCM device tokens
        title: Notification title
        body: Notification body
        data: Additional data payload
        
    Returns:
        dict: {'success_count': int, 'failure_count': int}
    """
    try:
        # Ensure Firebase is initialized
        if _firebase_app is None:
            initialize_firebase()
        
        if _firebase_app is None:
            logger.error("Cannot send FCM batch - Firebase not initialized")
            return {'success_count': 0, 'failure_count': len(tokens)}
        
        # Prepare multicast message
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=data or {},
            tokens=tokens,
            android=messaging.AndroidConfig(
                priority='high',
                notification=messaging.AndroidNotification(
                    icon='icon',
                    color='#D4AF37',
                    sound='default',
                ),
            ),
        )
        
        # Send batch
        response = messaging.send_multicast(message)
        logger.info(f"✅ FCM batch sent - Success: {response.success_count}, Failed: {response.failure_count}")
        
        return {
            'success_count': response.success_count,
            'failure_count': response.failure_count,
        }
        
    except Exception as e:
        logger.error(f"❌ Error sending FCM batch: {e}")
        return {'success_count': 0, 'failure_count': len(tokens)}


# Initialize Firebase when module is imported
initialize_firebase()
