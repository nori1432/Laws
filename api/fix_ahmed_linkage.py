#!/usr/bin/env python3
"""
Fix student-user linkage for AHMED GHALMI
"""

from app import app
from models import db, Student, User

print("=" * 70)
print("🔧 FIXING AHMED GHALMI STUDENT-USER LINKAGE")
print("=" * 70)

with app.app_context():
    # The user you're trying to login with
    user_ahmed = User.query.filter_by(phone='0656373321').first()
    
    # The student named AHMED GHALMI
    student_ahmed = Student.query.filter_by(name='AHMED GHALMI').first()
    
    if user_ahmed and student_ahmed:
        print(f"\n📋 Current State:")
        print(f"   User ID {user_ahmed.id}: {user_ahmed.full_name}, phone: {user_ahmed.phone}")
        print(f"   Student ID {student_ahmed.id}: {student_ahmed.name}, user_id: {student_ahmed.user_id}")
        
        old_user_id = student_ahmed.user_id
        old_user = User.query.get(old_user_id) if old_user_id else None
        old_phone = old_user.phone if old_user else "NO USER"
        
        print(f"\n⚠️ MISMATCH DETECTED:")
        print(f"   Student '{student_ahmed.name}' is linked to user_id={old_user_id} (phone: {old_phone})")
        print(f"   But you're trying to login with phone: {user_ahmed.phone} (user_id={user_ahmed.id})")
        
        print(f"\n🔧 FIXING...")
        print(f"   Updating student.user_id from {old_user_id} → {user_ahmed.id}")
        
        # Update the linkage
        student_ahmed.user_id = user_ahmed.id
        db.session.commit()
        
        print(f"✅ FIXED!")
        print(f"\n📋 New State:")
        print(f"   Student ID {student_ahmed.id}: {student_ahmed.name}")
        print(f"   Linked to user_id: {student_ahmed.user_id}")
        print(f"   User name: {user_ahmed.full_name}")
        print(f"   User phone: {user_ahmed.phone}")
        
        print(f"\n✅ NOW YOU CAN LOGIN WITH:")
        print(f"   Phone: {user_ahmed.phone}")
        print(f"   OR Username: {student_ahmed.mobile_username}")
        print(f"   Password: {student_ahmed.mobile_password_plain}")
        
    else:
        if not user_ahmed:
            print("❌ User with phone 0656373321 not found")
        if not student_ahmed:
            print("❌ Student named AHMED GHALMI not found")

print("\n" + "=" * 70)
