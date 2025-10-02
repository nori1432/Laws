"""
Quick Login Test - Shows valid credentials in your database
Run this to see what usernames/phones you can use to test login
"""

from models import db, Parent, Student, User
from app import app

print("\n" + "="*80)
print("🔑 MOBILE LOGIN - TEST CREDENTIALS AVAILABLE")
print("="*80)

with app.app_context():
    # Check Parents with mobile access
    print("\n📱 PARENTS WITH MOBILE APP ACCESS:")
    print("-" * 80)
    
    parents = Parent.query.filter_by(mobile_app_enabled=True).all()
    
    if not parents:
        print("❌ No parents have mobile app enabled!")
        print("\n💡 First parent in database:")
        first_parent = Parent.query.first()
        if first_parent:
            print(f"   ID: {first_parent.id}")
            print(f"   Name: {first_parent.full_name}")
            print(f"   Phone: {first_parent.phone}")
            print(f"   Mobile Username: {first_parent.mobile_username}")
            print(f"   Mobile App Enabled: {first_parent.mobile_app_enabled}")
            print("\n   ⚠️  To enable, run:")
            print(f"   UPDATE parents SET mobile_app_enabled=1 WHERE id={first_parent.id};")
    else:
        for i, parent in enumerate(parents, 1):
            print(f"\n{i}. {parent.full_name} (ID: {parent.id})")
            print(f"   ✅ LOGIN OPTIONS:")
            if parent.mobile_username:
                print(f"      → Username: {parent.mobile_username}")
            if parent.phone:
                print(f"      → Phone: {parent.phone}")
            if parent.mobile_password_plain:
                print(f"      → Password: {parent.mobile_password_plain}")
            else:
                print(f"      → Password: [HASHED - check mobile_password_plain column]")
            print(f"   📊 Status:")
            print(f"      • App Enabled: {parent.mobile_app_enabled}")
            print(f"      • Has Username: {bool(parent.mobile_username)}")
            print(f"      • Has Password: {bool(parent.mobile_password_hash or parent.mobile_password_plain)}")
            
            if parent.mobile_username and parent.mobile_password_plain:
                print(f"\n   🎯 TEST THIS IN MOBILE APP:")
                print(f"      User Type: Parent")
                print(f"      Username: {parent.mobile_username}")
                print(f"      Password: {parent.mobile_password_plain}")
    
    # Check Students with mobile access
    print("\n\n📱 STUDENTS WITH MOBILE APP ACCESS:")
    print("-" * 80)
    
    students = Student.query.filter_by(mobile_app_enabled=True).all()
    
    if not students:
        print("❌ No students have mobile app enabled!")
        print("\n💡 First student in database:")
        first_student = Student.query.first()
        if first_student:
            user = User.query.get(first_student.user_id) if first_student.user_id else None
            print(f"   ID: {first_student.id}")
            print(f"   Name: {first_student.name}")
            print(f"   User ID: {first_student.user_id}")
            if user:
                print(f"   User Phone: {user.phone}")
            print(f"   Mobile Username: {first_student.mobile_username}")
            print(f"   Mobile App Enabled: {first_student.mobile_app_enabled}")
            print("\n   ⚠️  To enable, run:")
            print(f"   UPDATE students SET mobile_app_enabled=1 WHERE id={first_student.id};")
    else:
        for i, student in enumerate(students, 1):
            user = User.query.get(student.user_id) if student.user_id else None
            print(f"\n{i}. {student.name} (ID: {student.id})")
            print(f"   ✅ LOGIN OPTIONS:")
            if student.mobile_username:
                print(f"      → Username: {student.mobile_username}")
            if user and user.phone:
                print(f"      → Phone: {user.phone} (from users table)")
            if student.mobile_password_plain:
                print(f"      → Password: {student.mobile_password_plain}")
            else:
                print(f"      → Password: [HASHED - check mobile_password_plain column]")
            print(f"   📊 Status:")
            print(f"      • App Enabled: {student.mobile_app_enabled}")
            print(f"      • Has Username: {bool(student.mobile_username)}")
            print(f"      • Has Password: {bool(student.mobile_password_hash or student.mobile_password_plain)}")
            print(f"      • User ID: {student.user_id}")
            if user:
                print(f"      • User Phone: {user.phone}")
            
            if student.mobile_username and student.mobile_password_plain:
                print(f"\n   🎯 TEST THIS IN MOBILE APP:")
                print(f"      User Type: Student")
                print(f"      Username: {student.mobile_username}")
                if user and user.phone:
                    print(f"      OR Phone: {user.phone}")
                print(f"      Password: {student.mobile_password_plain}")
    
    # Summary
    print("\n\n" + "="*80)
    print("📊 SUMMARY:")
    print("="*80)
    print(f"✓ Parents with mobile access: {len(parents)}")
    print(f"✓ Students with mobile access: {len(students)}")
    
    if not parents and not students:
        print("\n⚠️  NO MOBILE CREDENTIALS FOUND!")
        print("\n💡 To create test credentials, run:")
        print("""
from models import db, Parent, Student
from utils import hash_password
from app import app

with app.app_context():
    # Setup test parent
    parent = Parent.query.first()
    if parent:
        parent.mobile_username = 'testparent'
        parent.mobile_password_plain = 'test123'
        parent.mobile_password_hash = hash_password('test123')
        parent.mobile_app_enabled = True
        db.session.commit()
        print(f"✅ Parent ready: testparent / test123")
    
    # Setup test student
    student = Student.query.first()
    if student:
        student.mobile_username = 'teststudent'
        student.mobile_password_plain = 'test123'
        student.mobile_password_hash = hash_password('test123')
        student.mobile_app_enabled = True
        db.session.commit()
        print(f"✅ Student ready: teststudent / test123")
        """)
    
    print("\n" + "="*80)
    print()
