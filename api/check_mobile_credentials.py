#!/usr/bin/env python3

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models import db, Parent, Student, User
from app import create_app
from utils import hash_password

def check_mobile_credentials():
    app = create_app()
    with app.app_context():
        print("=== CHECKING MOBILE CREDENTIALS ===\n")
        
        # Check parents
        print("PARENTS:")
        parents = Parent.query.all()
        for parent in parents:
            print(f"ID: {parent.id}")
            print(f"Name: {parent.full_name}")
            print(f"Phone: {parent.phone}")
            print(f"Mobile Username: {parent.mobile_username}")
            print(f"Mobile Password Hash: {'SET' if parent.mobile_password_hash else 'NOT SET'}")
            print(f"Mobile Password Plain: {parent.mobile_password_plain}")
            print(f"Mobile App Enabled: {parent.mobile_app_enabled}")
            print(f"Students: {[s.name for s in parent.students]}")
            print("-" * 50)
        
        # Check students  
        print("\nSTUDENTS:")
        students = Student.query.all()
        for student in students:
            print(f"ID: {student.id}")
            print(f"Name: {student.name}")
            print(f"Parent: {student.parent.full_name if student.parent else 'None'}")
            print(f"Parent Phone: {student.parent.phone if student.parent else 'None'}")
            print(f"Mobile Username: {student.mobile_username}")
            print(f"Mobile Password Hash: {'SET' if student.mobile_password_hash else 'NOT SET'}")
            print(f"Mobile Password Plain: {student.mobile_password_plain}")
            print(f"Mobile App Enabled: {student.mobile_app_enabled}")
            print("-" * 50)

def setup_test_credentials():
    """Set up some test mobile credentials"""
    app = create_app()
    with app.app_context():
        print("=== SETTING UP TEST CREDENTIALS ===\n")
        
        # Find first parent
        parent = Parent.query.first()
        if parent:
            print(f"Setting up mobile credentials for parent: {parent.full_name}")
            parent.mobile_password_plain = "parent123"
            parent.mobile_password_hash = hash_password("parent123")
            parent.mobile_app_enabled = True
            db.session.add(parent)
            
            # Set up credentials for first student of this parent
            if parent.students:
                student = parent.students[0]
                print(f"Setting up mobile credentials for student: {student.name}")
                student.mobile_password_plain = "student123"
                student.mobile_password_hash = hash_password("student123")
                student.mobile_app_enabled = True
                db.session.add(student)
            
            db.session.commit()
            print(f"✅ Test credentials set up!")
            print(f"Parent Phone: {parent.phone}")
            print(f"Parent Password: parent123")
            print(f"Student Password: student123")
        else:
            print("❌ No parents found in database")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        setup_test_credentials()
    else:
        check_mobile_credentials()