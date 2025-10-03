#!/usr/bin/env python3
"""
Quick diagnostic: Check student-user linkage in database
"""

from app import app
from models import db, Student, User

print("=" * 70)
print("🔍 CHECKING STUDENT-USER LINKAGE")
print("=" * 70)

with app.app_context():
    # Check the specific user from the logs
    user = User.query.get(1)
    if user:
        print(f"\n✅ User ID 1 exists:")
        print(f"   Name: {user.full_name}")
        print(f"   Phone: {user.phone}")
        print(f"   Email: {user.email}")
        
        # Try to find student with this user_id
        student = Student.query.filter_by(user_id=1).first()
        if student:
            print(f"\n✅ Student linked to user_id=1:")
            print(f"   Student ID: {student.id}")
            print(f"   Name: {student.name}")
            print(f"   Mobile Username: {student.mobile_username}")
            print(f"   Mobile App Enabled: {student.mobile_app_enabled}")
        else:
            print(f"\n❌ NO STUDENT found with user_id=1")
            
            # Check if there's a student with same phone
            print(f"\n🔍 Looking for students with any user having phone: {user.phone}")
            all_students = Student.query.all()
            print(f"   Total students in database: {len(all_students)}")
            
            if all_students:
                print(f"\n📋 First 5 students and their user_ids:")
                for s in all_students[:5]:
                    linked_user = User.query.get(s.user_id) if s.user_id else None
                    user_phone = linked_user.phone if linked_user else "NO USER"
                    print(f"   - Student ID {s.id}: {s.name}")
                    print(f"     user_id: {s.user_id}, linked phone: {user_phone}")
                    print(f"     mobile_username: {s.mobile_username}, enabled: {s.mobile_app_enabled}")
    else:
        print("\n❌ User ID 1 not found")
    
    print("\n" + "=" * 70)
    print("🔍 CHECKING ALL STUDENTS WITH MOBILE ACCESS")
    print("=" * 70)
    
    students_with_mobile = Student.query.filter_by(mobile_app_enabled=True).all()
    
    if students_with_mobile:
        print(f"\n✅ Found {len(students_with_mobile)} students with mobile access:\n")
        for s in students_with_mobile:
            linked_user = User.query.get(s.user_id) if s.user_id else None
            print(f"📱 Student: {s.name}")
            print(f"   - Student ID: {s.id}")
            print(f"   - user_id: {s.user_id}")
            print(f"   - Username: {s.mobile_username}")
            print(f"   - Password: {s.mobile_password_plain}")
            
            if linked_user:
                print(f"   - Linked User: {linked_user.full_name}")
                print(f"   - Phone: {linked_user.phone}")
            else:
                print(f"   - ⚠️ WARNING: user_id {s.user_id} not found in users table!")
            print()
    else:
        print("\n❌ No students have mobile_app_enabled=True")
        
        print("\n💡 To enable mobile access for a student, run:")
        print("   UPDATE students SET mobile_app_enabled=1 WHERE id=YOUR_STUDENT_ID;")
    
    print("=" * 70)
