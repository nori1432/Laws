"""
Push Notification Service for Laws of Success Academy
Handles sending push notifications to mobile apps for attendance updates
"""

import requests
import json
from datetime import datetime
from flask import current_app
import requests
import json
from datetime import datetime

# Try relative import first, fall back to direct import
try:
    from .models import User, Notification, db
except ImportError:
    from models import User, Notification, db

# Translation dictionaries for common notification texts
NOTIFICATION_TRANSLATIONS = {
    "en_to_ar": {
        # Status and action translations
        "✅ Attendance Marked": "✅ تم تسجيل الحضور",
        "❌ Attendance Marked": "❌ تم تسجيل الحضور",
        "Attendance Confirmed": "تأكيد الحضور", 
        "Attendance Marked": "تسجيل الحضور",
        "Attendance Updated": "تحديث الحضور",
        "Present": "حاضر",
        "Absent": "غائب",
        "by admin": "من قِبل المسؤول",
        
        # Message patterns
        "You have been marked": "تم تسجيلك",
        "has been marked": "تم تسجيله",
        "for": "في",
        "Your attendance for": "تم تسجيل حضورك في",
        "has been marked as present and payment confirmed.": "تم تسجيله كحاضر وتم تأكيد الدفع.",
        "has been marked as present. Payment status: unpaid.": "تم تسجيله كحاضر. حالة الدفع: غير مدفوع.",
        "has been marked as present. Payment status:": "تم تسجيله كحاضر. حالة الدفع:",
        "unpaid": "غير مدفوع",
        "paid": "مدفوع",
        
        # Dynamic patterns for student names in attendance updates
        " - Attendance Update": " - تحديث الحضور"
    }
}

def translate_notification_text(text, target_lang="ar"):
    """
    Translate notification text to Arabic using predefined translations
    """
    if target_lang != "ar":
        return text
    
    translations = NOTIFICATION_TRANSLATIONS["en_to_ar"]
    
    # Try exact match first
    if text in translations:
        return translations[text]
    
    # Try partial matches for dynamic content
    translated_text = text
    for en_text, ar_text in translations.items():
        if en_text in text:
            translated_text = translated_text.replace(en_text, ar_text)
    
    return translated_text


class PushNotificationService:
    """Service for sending push notifications to mobile devices"""
    
    # You can configure these based on your push notification provider
    # For now, this is a placeholder implementation
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
    FCM_URL = "https://fcm.googleapis.com/fcm/send"
    
    @staticmethod
    def send_push_notification(user_id, title=None, message=None, notification_type="attendance", extra_data=None, 
                             title_en=None, title_ar=None, message_en=None, message_ar=None):
        """
        Send bilingual push notification to a user
        
        Args:
            user_id: ID of the user to send notification to
            title: Legacy title (for backward compatibility)
            message: Legacy message (for backward compatibility)
            title_en: English title
            title_ar: Arabic title
            message_en: English message
            message_ar: Arabic message
            notification_type: Type of notification (attendance, payment, etc.)
            extra_data: Additional data to include in notification
        """
        try:
            # Get user
            user = User.query.get(user_id)
            if not user:
                print(f"User {user_id} not found")
                return False

            # Handle bilingual vs legacy format
            if title_en or title_ar or message_en or message_ar:
                # Bilingual notification
                final_title_en = title_en or title
                final_title_ar = title_ar or translate_notification_text(title_en or title, "ar") if (title_en or title) else None
                final_message_en = message_en or message
                final_message_ar = message_ar or translate_notification_text(message_en or message, "ar") if (message_en or message) else None
            else:
                # Legacy notification - auto-translate
                final_title_en = title
                final_title_ar = translate_notification_text(title, "ar") if title else None
                final_message_en = message
                final_message_ar = translate_notification_text(message, "ar") if message else None

            # Check if user has push notifications enabled
            if hasattr(user, 'push_notifications') and not user.push_notifications:
                print(f"Push notifications disabled for user {user_id}")
                # Still create notification record for in-app viewing
                pass

            # Always create bilingual notification record in database for in-app viewing
            notification = Notification(
                user_id=user_id,
                title=final_title_en,  # Keep legacy field for backward compatibility
                message=final_message_en,  # Keep legacy field for backward compatibility
                title_en=final_title_en,
                title_ar=final_title_ar,
                message_en=final_message_en,
                message_ar=final_message_ar,
                type=notification_type,
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.session.add(notification)
            db.session.commit()

            # Check if user has push token for actual push notification
            if not user.push_token or user.push_token in ['local-only-fallback', 'expo-go-disabled', 'simulator-fallback', 'permission-denied', 'registration-failed'] or user.push_token.startswith('DEV_') or user.push_token.startswith('LawsOfSuccess_'):
                print(f"No valid push token for user {user_id} (token: {user.push_token}) - notification created in database only")
                print("💡 Push notifications require a production Expo build with proper token configuration")
                return True

            # For push notification, use English by default (mobile app will handle language display)
            push_title = final_title_en or final_title_ar or "Notification"
            push_message = final_message_en or final_message_ar or "You have a new notification"

            # Prepare push notification payload
            push_payload = {
                "to": user.push_token,
                "title": push_title,
                "body": push_message,
                "data": {
                    "type": notification_type,
                    "notification_id": notification.id,
                    "created_at": notification.created_at.isoformat(),
                    "title_en": final_title_en,
                    "title_ar": final_title_ar,
                    "message_en": final_message_en,
                    "message_ar": final_message_ar,
                    **(extra_data or {})
                },
                "sound": "default",
                "badge": 1
            }

            # Send to Expo push service (if using Expo)
            if user.push_token.startswith("ExponentPushToken"):
                return PushNotificationService._send_expo_notification(push_payload)
            
            # Send to FCM (if using Firebase)
            elif user.push_token.startswith("f") or len(user.push_token) > 100:
                return PushNotificationService._send_fcm_notification(push_payload)
            
            # For now, just log the notification (development mode)
            print(f"📱 Bilingual push notification sent to user {user_id}:")
            print(f"   Title (EN): {final_title_en}")
            print(f"   Title (AR): {final_title_ar}")
            print(f"   Message (EN): {final_message_en}")
            print(f"   Message (AR): {final_message_ar}")
            print(f"   Type: {notification_type}")
            print(f"   Token: {user.push_token[:20]}...")
            
            return True
            
        except Exception as e:
            print(f"Error sending push notification: {e}")
            return False
            
            # For now, just log the notification (development mode)
            print(f"📱 Push notification sent to user {user_id}:")
            print(f"   Title: {title}")
            print(f"   Message: {message}")
            print(f"   Type: {notification_type}")
            print(f"   Token: {user.push_token[:20]}...")
            
            return True
            
        except Exception as e:
            print(f"Error sending push notification: {e}")
            return False
    
    @staticmethod
    def _send_expo_notification(payload):
        """Send notification via Expo Push Service"""
        try:
            headers = {
                "Accept": "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            }
            
            response = requests.post(
                PushNotificationService.EXPO_PUSH_URL,
                headers=headers,
                data=json.dumps(payload),
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("data", {}).get("status") == "ok":
                    print("✅ Expo push notification sent successfully")
                    return True
                else:
                    print(f"❌ Expo push notification failed: {result}")
                    return False
            else:
                print(f"❌ Expo API error: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Expo notification error: {e}")
            return False
    
    @staticmethod
    def _send_fcm_notification(payload):
        """Send notification via Firebase Cloud Messaging"""
        try:
            # FCM requires server key - you would configure this in production
            # For now, just simulate success
            print("📱 FCM notification would be sent here")
            return True
            
        except Exception as e:
            print(f"❌ FCM notification error: {e}")
            return False
    
    @staticmethod
    def send_attendance_notification(student_id, attendance_status, class_name, marked_by_admin=False):
        """
        Send attendance notification to student and parent
        
        Args:
            student_id: ID of the student
            attendance_status: 'present' or 'absent'
            class_name: Name of the class
            marked_by_admin: Whether attendance was marked by admin
        """
        try:
            from models import Student, Parent, User
            
            student = Student.query.get(student_id)
            if not student:
                return False
            
            # Get student's user record
            student_user = User.query.get(student.user_id)
            
            # Get parent's user record
            parent = Parent.query.get(student.parent_id) if student.parent_id else None
            parent_user = User.query.get(parent.user_id) if parent and parent.user_id else None
            
            # Prepare notification details
            status_emoji = "✅" if attendance_status == "present" else "❌"
            status_text = "Present" if attendance_status == "present" else "Absent"
            admin_text = " by admin" if marked_by_admin else ""
            
            # Send notification to student
            if student_user:
                student_title = f"{status_emoji} Attendance Marked"
                student_message = f"You have been marked {status_text} for {class_name}{admin_text}"
                
                PushNotificationService.send_push_notification(
                    user_id=student_user.id,
                    title=student_title,
                    message=student_message,
                    notification_type="attendance",
                    extra_data={
                        "student_id": student_id,
                        "class_name": class_name,
                        "attendance_status": attendance_status,
                        "marked_by_admin": marked_by_admin
                    }
                )
            
            # Send notification to parent
            if parent_user:
                parent_title = f"{status_emoji} {student.name} - Attendance Update"
                parent_message = f"{student.name} has been marked {status_text} for {class_name}{admin_text}"
                
                PushNotificationService.send_push_notification(
                    user_id=parent_user.id,
                    title=parent_title,
                    message=parent_message,
                    notification_type="attendance",
                    extra_data={
                        "student_id": student_id,
                        "student_name": student.name,
                        "class_name": class_name,
                        "attendance_status": attendance_status,
                        "marked_by_admin": marked_by_admin
                    }
                )
            
            return True
            
        except Exception as e:
            print(f"Error sending attendance notification: {e}")
            return False
    
    @staticmethod
    def send_bulk_absent_notifications(absent_students_data):
        """
        Send bulk notifications for auto-marked absent students
        
        Args:
            absent_students_data: List of dicts with student_id, class_name, student_name
        """
        success_count = 0
        
        for student_data in absent_students_data:
            try:
                result = PushNotificationService.send_attendance_notification(
                    student_id=student_data['student_id'],
                    attendance_status='absent',
                    class_name=student_data['class_name'],
                    marked_by_admin=True  # Auto-marking is considered admin action
                )
                
                if result:
                    success_count += 1
                    
            except Exception as e:
                print(f"Error sending notification for student {student_data.get('student_id')}: {e}")
                continue
        
        print(f"📱 Sent {success_count}/{len(absent_students_data)} absent notifications")
        return success_count
    
    @staticmethod
    def register_push_token(user_id, push_token, platform="unknown"):
        """
        Register or update push token for a user
        
        Args:
            user_id: ID of the user
            push_token: Push notification token
            platform: Platform (ios, android, web)
        """
        try:
            user = User.query.get(user_id)
            if not user:
                return False
            
            # Update push token
            user.push_token = push_token
            db.session.commit()
            
            print(f"📱 Push token registered for user {user_id} ({platform}): {push_token[:20]}...")
            return True
            
        except Exception as e:
            print(f"Error registering push token: {e}")
            return False
    
    @staticmethod
    def get_user_notifications(user_id, limit=50, unread_only=False):
        """
        Get notifications for a user
        
        Args:
            user_id: ID of the user
            limit: Maximum number of notifications to return
            unread_only: If True, only return unread notifications
        """
        try:
            query = Notification.query.filter_by(user_id=user_id)
            
            if unread_only:
                query = query.filter_by(is_read=False)
            
            notifications = query.order_by(Notification.created_at.desc()).limit(limit).all()
            
            from models import notification_to_dict
            return [notification_to_dict(notif) for notif in notifications]
            
        except Exception as e:
            print(f"Error getting user notifications: {e}")
            return []
    
    @staticmethod
    def mark_notification_read(notification_id, user_id):
        """Mark a notification as read"""
        try:
            notification = Notification.query.filter_by(
                id=notification_id,
                user_id=user_id
            ).first()
            
            if notification:
                notification.is_read = True
                db.session.commit()
                return True
            
            return False
            
        except Exception as e:
            print(f"Error marking notification as read: {e}")
            return False

    @staticmethod
    def send_payment_due_notification(student_id, course_name, sessions_completed=4):
        """
        Send payment due notification to student and parent
        
        Args:
            student_id: ID of the student
            course_name: Name of the course
            sessions_completed: Number of sessions completed (default 4 for monthly)
        """
        try:
            from models import Student, Parent, User
            
            student = Student.query.get(student_id)
            if not student:
                return False
            
            # Get student's user record
            student_user = User.query.get(student.user_id) if student.user_id else None
            
            # Get parent's user record
            parent = Parent.query.get(student.parent_id) if student.parent_id else None
            parent_user = User.query.get(parent.user_id) if parent and parent.user_id else None
            
            # Send notification to student
            if student_user:
                student_title = "💳 Payment Due"
                student_message = f"Your monthly payment is due for {course_name}. You've completed {sessions_completed} sessions."
                
                PushNotificationService.send_push_notification(
                    user_id=student_user.id,
                    title=student_title,
                    message=student_message,
                    notification_type="payment_due",
                    extra_data={
                        "student_id": student_id,
                        "course_name": course_name,
                        "sessions_completed": sessions_completed,
                        "payment_type": "monthly"
                    }
                )
            
            # Send notification to parent
            if parent_user:
                parent_title = f"💳 {student.name} - Payment Due"
                parent_message = f"Monthly payment is due for {student.name}'s {course_name} course ({sessions_completed} sessions completed)."
                
                PushNotificationService.send_push_notification(
                    user_id=parent_user.id,
                    title=parent_title,
                    message=parent_message,
                    notification_type="payment_due",
                    extra_data={
                        "student_id": student_id,
                        "student_name": student.name,
                        "course_name": course_name,
                        "sessions_completed": sessions_completed,
                        "payment_type": "monthly"
                    }
                )
            
            return True
            
        except Exception as e:
            print(f"Error sending payment due notification: {e}")
            return False

    @staticmethod
    def send_payment_confirmation_notification(student_id, amount, payment_method='cash'):
        """
        Send bilingual payment confirmation notification to student and parent
        
        Args:
            student_id: ID of the student
            amount: Payment amount
            payment_method: Method of payment (cash, card, etc.)
        """
        try:
            from models import Student, Parent, User
            
            student = Student.query.get(student_id)
            if not student:
                print(f"Student {student_id} not found for payment notification")
                return False
            
            # Get student's user record
            student_user = User.query.get(student.user_id) if student.user_id else None
            
            # Get parent's user record
            parent = Parent.query.get(student.parent_id) if student.parent_id else None
            parent_user = User.query.get(parent.user_id) if parent and parent.user_id else None
            
            # Prepare bilingual notifications
            # Send notification to student
            if student_user:
                PushNotificationService.send_push_notification(
                    user_id=student_user.id,
                    title_en=f"✅ Payment Confirmed",
                    title_ar=f"✅ تم تأكيد الدفع",
                    message_en=f"Payment of {amount} DA received via {payment_method}. Thank you!",
                    message_ar=f"تم استلام دفعة بقيمة {amount} دج عبر {payment_method}. شكراً لك!",
                    notification_type="payment",
                    extra_data={
                        "student_id": student_id,
                        "amount": amount,
                        "payment_method": payment_method,
                        "payment_confirmed": True
                    }
                )
            
            # Send notification to parent
            if parent_user:
                PushNotificationService.send_push_notification(
                    user_id=parent_user.id,
                    title_en=f"✅ {student.name} - Payment Confirmed",
                    title_ar=f"✅ {student.name} - تم تأكيد الدفع",
                    message_en=f"Payment of {amount} DA received for {student.name} via {payment_method}.",
                    message_ar=f"تم استلام دفعة بقيمة {amount} دج لـ {student.name} عبر {payment_method}.",
                    notification_type="payment",
                    extra_data={
                        "student_id": student_id,
                        "student_name": student.name,
                        "amount": amount,
                        "payment_method": payment_method,
                        "payment_confirmed": True
                    }
                )
            
            print(f"📱 Payment confirmation sent to student {student_id}: {amount} DA")
            return True
            
        except Exception as e:
            print(f"Error sending payment confirmation notification: {e}")
            import traceback
            traceback.print_exc()
            return False

    @staticmethod
    def send_bulk_payment_due_notifications():
        """
        Check for students with payment due and send notifications
        """
        try:
            from models import Student, Enrollment, Course
            from sqlalchemy import and_, func
            
            # Find students with 4+ monthly sessions who haven't paid
            payment_due_students = db.session.query(
                Student,
                Course.name.label('course_name'),
                Enrollment.monthly_sessions_attended
            ).join(
                Enrollment, Student.id == Enrollment.student_id
            ).join(
                Course, Enrollment.course_id == Course.id
            ).filter(
                and_(
                    Course.pricing_type == 'monthly',
                    func.coalesce(Enrollment.monthly_sessions_attended, 0) >= 4,
                    Enrollment.monthly_payment_status != 'paid'
                )
            ).all()
            
            success_count = 0
            for student, course_name, sessions_attended in payment_due_students:
                try:
                    result = PushNotificationService.send_payment_due_notification(
                        student_id=student.id,
                        course_name=course_name,
                        sessions_completed=sessions_attended
                    )
                    
                    if result:
                        success_count += 1
                        
                except Exception as e:
                    print(f"Error sending payment notification for student {student.id}: {e}")
                    continue
            
            print(f"💳 Sent {success_count}/{len(payment_due_students)} payment due notifications")
            return success_count
            
        except Exception as e:
            print(f"Error sending bulk payment due notifications: {e}")
            return 0

    @staticmethod
    def send_attendance_summary_notification(student_id, period="weekly"):
        """
        Send attendance summary notification (e.g., weekly summary)
        
        Args:
            student_id: ID of the student
            period: Period for summary (weekly, monthly)
        """
        try:
            from models import Student, Parent, User, Attendance, Class, Course
            from sqlalchemy import and_, desc, func
            from datetime import datetime, timedelta
            
            student = Student.query.get(student_id)
            if not student:
                return False
            
            # Calculate date range
            if period == "weekly":
                start_date = datetime.now() - timedelta(days=7)
                period_text = "this week"
            else:  # monthly
                start_date = datetime.now() - timedelta(days=30)
                period_text = "this month"
            
            # Get attendance records for the period
            attendance_records = db.session.query(
                Attendance,
                Class.name.label('class_name'),
                Course.name.label('course_name')
            ).join(
                Class, Attendance.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).filter(
                and_(
                    Attendance.student_id == student_id,
                    Attendance.attendance_date >= start_date.date()
                )
            ).all()
            
            if not attendance_records:
                return False  # No attendance to summarize
            
            # Calculate stats
            total_classes = len(attendance_records)
            present_count = len([r for r in attendance_records if r[0].status == 'present'])
            absent_count = len([r for r in attendance_records if r[0].status == 'absent'])
            attendance_rate = round((present_count / total_classes * 100), 1) if total_classes > 0 else 0
            
            # Get student and parent users
            student_user = User.query.get(student.user_id)
            parent = Parent.query.get(student.parent_id) if student.parent_id else None
            parent_user = User.query.get(parent.user_id) if parent and parent.user_id else None
            
            # Send to student
            if student_user:
                student_title = f"📊 Your Attendance Summary"
                student_message = f"You attended {present_count}/{total_classes} classes {period_text} ({attendance_rate}% attendance rate)"
                
                PushNotificationService.send_push_notification(
                    user_id=student_user.id,
                    title=student_title,
                    message=student_message,
                    notification_type="attendance_summary",
                    extra_data={
                        "student_id": student_id,
                        "period": period,
                        "total_classes": total_classes,
                        "present_count": present_count,
                        "absent_count": absent_count,
                        "attendance_rate": attendance_rate
                    }
                )
            
            # Send to parent
            if parent_user:
                parent_title = f"📊 {student.name} - Attendance Summary"
                parent_message = f"{student.name} attended {present_count}/{total_classes} classes {period_text} ({attendance_rate}% attendance)"
                
                PushNotificationService.send_push_notification(
                    user_id=parent_user.id,
                    title=parent_title,
                    message=parent_message,
                    notification_type="attendance_summary",
                    extra_data={
                        "student_id": student_id,
                        "student_name": student.name,
                        "period": period,
                        "total_classes": total_classes,
                        "present_count": present_count,
                        "absent_count": absent_count,
                        "attendance_rate": attendance_rate
                    }
                )
            
            return True
            
        except Exception as e:
            print(f"Error sending attendance summary notification: {e}")
            return False

    @staticmethod
    def send_notification_to_user(user_id, title, message, notification_type="info", data=None):
        """
        Send notification to a specific user - wrapper around send_push_notification
        with better method name for general notifications
        
        Args:
            user_id: ID of the user to send notification to
            title: Notification title
            message: Notification message
            notification_type: Type of notification (info, warning, success, error, etc.)
            data: Additional data to include in notification
        """
        return PushNotificationService.send_push_notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type,
            extra_data=data
        )

    @staticmethod
    def send_push_only(user_id, title, message, notification_type="info", data=None):
        """
        Send only push notification without creating database record
        (Used when notification record is created elsewhere)
        
        Args:
            user_id: ID of the user to send notification to
            title: Notification title
            message: Notification message
            notification_type: Type of notification
            data: Additional data to include in notification
        """
        try:
            # Get user
            user = User.query.get(user_id)
            if not user:
                print(f"User {user_id} not found")
                return False
            
            # Check if user has push notifications enabled
            if hasattr(user, 'push_notifications') and not user.push_notifications:
                print(f"Push notifications disabled for user {user_id}")
                return True  # Consider this "successful" as user doesn't want notifications
            
            # Check if user has push token for actual push notification
            if not user.push_token:
                print(f"No push token found for user {user_id} - skipping push notification")
                return True
            
            # Prepare push notification payload
            push_payload = {
                "to": user.push_token,
                "title": title,
                "body": message,
                "data": {
                    "type": notification_type,
                    "created_at": datetime.utcnow().isoformat(),
                    **(data or {})
                },
                "sound": "default",
                "badge": 1
            }
            
            # Send to Expo push service (if using Expo)
            if user.push_token.startswith("ExponentPushToken"):
                return PushNotificationService._send_expo_notification(push_payload)
            
            # Send to FCM (if using Firebase)
            elif user.push_token.startswith("f") or len(user.push_token) > 100:
                return PushNotificationService._send_fcm_notification(push_payload)
            
            # For now, just log the notification (development mode)
            print(f"📱 Push notification sent to user {user_id}:")
            print(f"   Title: {title}")
            print(f"   Message: {message}")
            print(f"   Type: {notification_type}")
            print(f"   Token: {user.push_token[:20]}...")
            
            return True
            
        except Exception as e:
            print(f"Error sending push notification: {e}")
            return False