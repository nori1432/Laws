#!/usr/bin/env python3
"""
Create test bilingual notifications to verify the system works
"""

from app import app
from models import db, Notification, User
from datetime import datetime

print("=" * 70)
print("📱 CREATING TEST BILINGUAL NOTIFICATIONS")
print("=" * 70)

with app.app_context():
    # Get a user to send notifications to
    user = User.query.first()
    
    if not user:
        print("❌ No users found in database!")
        exit(1)
    
    print(f"\n✅ Sending test notifications to: {user.full_name} (ID: {user.id})")
    
    # Create test notifications with bilingual content
    test_notifications = [
        {
            'title_en': 'Welcome to Laws of Success',
            'title_ar': 'مرحباً بك في قوانين النجاح',
            'message_en': 'Thank you for joining our learning platform. We wish you success in your studies!',
            'message_ar': 'شكراً لانضمامك إلى منصة التعلم الخاصة بنا. نتمنى لك النجاح في دراستك!',
            'type': 'success'
        },
        {
            'title_en': 'Class Schedule Updated',
            'title_ar': 'تم تحديث جدول الحصص',
            'message_en': 'Your class schedule has been updated. Please check the schedule tab for the latest times.',
            'message_ar': 'تم تحديث جدول حصصك. يرجى مراجعة تبويب الجدول للحصول على أحدث المواعيد.',
            'type': 'info'
        },
        {
            'title_en': 'Payment Reminder',
            'title_ar': 'تذكير بالدفع',
            'message_en': 'Your monthly payment of 5000 DA is due on October 15, 2025. Please make the payment on time.',
            'message_ar': 'دفعتك الشهرية بقيمة 5000 دج مستحقة في 15 أكتوبر 2025. يرجى الدفع في الوقت المحدد.',
            'type': 'warning'
        },
        {
            'title_en': 'Attendance Alert',
            'title_ar': 'تنبيه الحضور',
            'message_en': 'You were marked absent for English class on October 1, 2025. Please contact your teacher if this is incorrect.',
            'message_ar': 'تم تسجيل غيابك في حصة الإنجليزية بتاريخ 1 أكتوبر 2025. يرجى التواصل مع معلمك إذا كان هذا خطأ.',
            'type': 'error'
        }
    ]
    
    created_count = 0
    for notif_data in test_notifications:
        notification = Notification(
            user_id=user.id,
            title_en=notif_data['title_en'],
            title_ar=notif_data['title_ar'],
            message_en=notif_data['message_en'],
            message_ar=notif_data['message_ar'],
            type=notif_data['type'],
            is_read=False,
            created_at=datetime.utcnow()
        )
        db.session.add(notification)
        created_count += 1
        
        print(f"\n📬 Created notification #{created_count}:")
        print(f"   EN: {notif_data['title_en']}")
        print(f"   AR: {notif_data['title_ar']}")
        print(f"   Type: {notif_data['type']}")
    
    db.session.commit()
    
    print(f"\n✅ Successfully created {created_count} bilingual notifications!")
    print(f"\n🔍 To test in mobile app:")
    print(f"   1. Login as: {user.full_name}")
    print(f"   2. Navigate to Notifications screen")
    print(f"   3. Switch language (EN/AR) and see content change!")
    print(f"   4. English mode: Shows title_en and message_en")
    print(f"   5. Arabic mode: Shows title_ar and message_ar")
    
print("\n" + "=" * 70)
