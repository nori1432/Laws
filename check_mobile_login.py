"""
Mobile Login Debug Script
Run this to check database state for mobile credentials
"""

from models import db, Parent, Student, User
from app import app

def check_mobile_credentials():
    with app.app_context():
        print("\n" + "="*70)
        print("MOBILE LOGIN DEBUG - DATABASE CHECK")
        print("="*70)
        
        # Check Parents
        print("\n📋 PARENTS WITH MOBILE CREDENTIALS:")
        print("-" * 70)
        parents = Parent.query.filter(Parent.mobile_username.isnot(None)).all()
        
        if not parents:
            print("❌ No parents found with mobile credentials!")
            print("\n💡 Checking ALL parents:")
            all_parents = Parent.query.all()
            for p in all_parents[:5]:  # Show first 5
                print(f"   ID: {p.id}, Name: {p.full_name}, Phone: {p.phone}")
                print(f"      mobile_username: {p.mobile_username}")
                print(f"      mobile_app_enabled: {p.mobile_app_enabled}")
                print(f"      has password: {bool(p.mobile_password_hash or p.mobile_password_plain)}")
                if p.mobile_password_plain:
                    print(f"      plain password: {p.mobile_password_plain}")
                print()
        else:
            for parent in parents:
                print(f"✅ Parent: {parent.full_name}")
                print(f"   ID: {parent.id}")
                print(f"   Phone: {parent.phone}")
                print(f"   Username: {parent.mobile_username}")
                print(f"   App Enabled: {parent.mobile_app_enabled}")
                print(f"   Has Password Hash: {bool(parent.mobile_password_hash)}")
                print(f"   Has Password Plain: {bool(parent.mobile_password_plain)}")
                if parent.mobile_password_plain:
                    print(f"   Plain Password: {parent.mobile_password_plain}")
                print()
        
        # Check Students
        print("\n📋 STUDENTS WITH MOBILE CREDENTIALS:")
        print("-" * 70)
        students = Student.query.filter(Student.mobile_username.isnot(None)).all()
        
        if not students:
            print("❌ No students found with mobile credentials!")
            print("\n💡 Checking ALL students:")
            all_students = Student.query.all()
            for s in all_students[:5]:  # Show first 5
                user = User.query.get(s.user_id) if s.user_id else None
                print(f"   ID: {s.id}, Name: {s.name}, User Phone: {user.phone if user else 'N/A'}")
                print(f"      mobile_username: {s.mobile_username}")
                print(f"      mobile_app_enabled: {s.mobile_app_enabled}")
                print(f"      has password: {bool(s.mobile_password_hash or s.mobile_password_plain)}")
                if s.mobile_password_plain:
                    print(f"      plain password: {s.mobile_password_plain}")
                print()
        else:
            for student in students:
                user = User.query.get(student.user_id) if student.user_id else None
                print(f"✅ Student: {student.name}")
                print(f"   ID: {student.id}")
                print(f"   User ID: {student.user_id}")
                if user:
                    print(f"   User Phone: {user.phone}")
                print(f"   Username: {student.mobile_username}")
                print(f"   App Enabled: {student.mobile_app_enabled}")
                print(f"   Has Password Hash: {bool(student.mobile_password_hash)}")
                print(f"   Has Password Plain: {bool(student.mobile_password_plain)}")
                if student.mobile_password_plain:
                    print(f"   Plain Password: {student.mobile_password_plain}")
                print()
        
        # Test credentials
        print("\n🧪 TEST CREDENTIALS:")
        print("-" * 70)
        
        if parents:
            test_parent = parents[0]
            print(f"📱 Test Parent Login:")
            print(f"   Username: {test_parent.mobile_username}")
            print(f"   OR Phone: {test_parent.phone}")
            print(f"   Password: {test_parent.mobile_password_plain if test_parent.mobile_password_plain else '[Use hashed password]'}")
            print(f"   User Type: parent")
            print()
        
        if students:
            test_student = students[0]
            test_user = User.query.get(test_student.user_id) if test_student.user_id else None
            print(f"📱 Test Student Login:")
            print(f"   Username: {test_student.mobile_username}")
            if test_user:
                print(f"   OR Phone: {test_user.phone}")
            print(f"   Password: {test_student.mobile_password_plain if test_student.mobile_password_plain else '[Use hashed password]'}")
            print(f"   User Type: student")
            print()
        
        print("="*70)
        print()

if __name__ == '__main__':
    check_mobile_credentials()
