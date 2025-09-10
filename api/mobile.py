from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import check_password_hash
from datetime import datetime, timedelta
import secrets

mobile_bp = Blueprint('mobile', __name__)

# Import models and utilities
from models import db, User, Parent, Student, Class, Enrollment, Attendance, Payment, Registration, course_to_dict, class_to_dict, attendance_to_dict, payment_to_dict, student_to_dict
from utils import hash_password, verify_password, generate_qr_code

@mobile_bp.route('/login', methods=['POST'])
def mobile_login():
    """Mobile app login for both parents and students"""
    print("Mobile login attempt received")
    data = request.get_json()
    print(f"Login data: {data}")

    if 'username' not in data or 'password' not in data:
        print("Missing username or password")
        return jsonify({'error': 'Username and password are required'}), 400

    username = data['username'].strip()
    password = data['password']
    print(f"Attempting login for username: {username}")

    # Try to find user by mobile username (parent)
    parent = Parent.query.filter_by(mobile_username=username, mobile_app_enabled=True).first()
    print(f"Parent found: {parent is not None}")

    if parent and verify_password(parent.mobile_password_hash, password):
        print("Parent login successful")
        # Parent login
        access_token = create_access_token(identity=parent.id, additional_claims={'user_type': 'parent'})
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': parent.id,
                'name': parent.full_name,
                'email': parent.email,
                'type': 'parent',
                'students': [student_to_dict(s) for s in parent.students]
            }
        }), 200

    # Try to find student by mobile username
    student = Student.query.filter_by(mobile_username=username, mobile_app_enabled=True).first()
    print(f"Student found: {student is not None}")

    if student and verify_password(student.mobile_password_hash, password):
        print("Student login successful")
        # Student login
        access_token = create_access_token(identity=student.id, additional_claims={'user_type': 'student'})
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': student.id,
                'name': student.name,
                'type': 'student',
                'parent_id': student.parent_id
            }
        }), 200

    print("Login failed - invalid credentials")
    return jsonify({'error': 'Invalid username or password'}), 401

@mobile_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def mobile_dashboard():
    """Get dashboard data for mobile users"""
    user_id = get_jwt_identity()
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type == 'parent':
        # Parent dashboard
        parent = Parent.query.get(user_id)
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        students_data = []
        for student in parent.students:
            # Get student's enrollments
            enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            enrollment_data = []

            for enrollment in enrollments:
                class_info = Class.query.get(enrollment.class_id)
                course_info = class_info.course if class_info else None

                if class_info and course_info:
                    enrollment_data.append({
                        'id': enrollment.id,
                        'class_name': class_info.name,
                        'course_name': course_info.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None
                    })

            # Get recent attendance
            recent_attendance = Attendance.query.filter_by(student_id=student.id)\
                .order_by(Attendance.attendance_date.desc())\
                .limit(10)\
                .all()

            attendance_data = []
            for att in recent_attendance:
                class_info = Class.query.get(att.class_id)
                attendance_data.append({
                    'date': att.attendance_date.isoformat(),
                    'class_name': class_info.name if class_info else 'Unknown',
                    'status': att.status,
                    'qr_code_scanned': att.qr_code_scanned
                })

            students_data.append({
                'id': student.id,
                'name': student.name,
                'enrollments': enrollment_data,
                'recent_attendance': attendance_data
            })

        return jsonify({
            'type': 'parent',
            'user': {
                'id': parent.id,
                'name': parent.full_name,
                'email': parent.email
            },
            'students': students_data
        }), 200

    elif user_type == 'student':
        # Student dashboard
        student = Student.query.get(user_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Get student's enrollments
        enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
        enrollment_data = []

        for enrollment in enrollments:
            class_info = Class.query.get(enrollment.class_id)
            course_info = class_info.course if class_info else None

            if class_info and course_info:
                enrollment_data.append({
                    'id': enrollment.id,
                    'class_name': class_info.name,
                    'course_name': course_info.name,
                    'day_of_week': class_info.day_of_week,
                    'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                    'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                    'qr_code_data': class_info.qr_code_data
                })

        # Get recent attendance
        recent_attendance = Attendance.query.filter_by(student_id=student.id)\
            .order_by(Attendance.attendance_date.desc())\
            .limit(10)\
            .all()

        attendance_data = []
        for att in recent_attendance:
            class_info = Class.query.get(att.class_id)
            attendance_data.append({
                'date': att.attendance_date.isoformat(),
                'class_name': class_info.name if class_info else 'Unknown',
                'status': att.status,
                'qr_code_scanned': att.qr_code_scanned
            })

        return jsonify({
            'type': 'student',
            'user': {
                'id': student.id,
                'name': student.name
            },
            'enrollments': enrollment_data,
            'recent_attendance': attendance_data
        }), 200

    return jsonify({'error': 'Invalid user type'}), 400

@mobile_bp.route('/attendance/scan', methods=['POST'])
@jwt_required()
def scan_qr_code():
    """Scan QR code for attendance"""
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type != 'student':
        return jsonify({'error': 'Only students can scan QR codes'}), 403

    data = request.get_json()
    if 'qr_code_data' not in data:
        return jsonify({'error': 'QR code data is required'}), 400

    qr_code_data = data['qr_code_data']
    student_id = get_jwt_identity()

    # Find class with matching QR code
    class_info = Class.query.filter_by(qr_code_data=qr_code_data).first()
    if not class_info:
        return jsonify({'error': 'Invalid QR code'}), 400

    # Check if QR code is expired
    if class_info.qr_code_expires and class_info.qr_code_expires < datetime.utcnow():
        return jsonify({'error': 'QR code has expired'}), 400

    # Check if student is enrolled in this class
    enrollment = Enrollment.query.filter_by(
        student_id=student_id,
        class_id=class_info.id,
        is_active=True
    ).first()

    if not enrollment:
        return jsonify({'error': 'Student is not enrolled in this class'}), 403

    # Check if attendance already exists for today
    today = datetime.utcnow().date()
    existing_attendance = Attendance.query.filter_by(
        student_id=student_id,
        class_id=class_info.id,
        attendance_date=today
    ).first()

    if existing_attendance:
        if existing_attendance.qr_code_scanned:
            return jsonify({'error': 'Attendance already marked for today'}), 409
        else:
            # Update existing attendance
            existing_attendance.qr_code_scanned = True
            existing_attendance.qr_scan_time = datetime.utcnow()
            existing_attendance.device_info = data.get('device_info', '')
            existing_attendance.status = 'present'
            db.session.commit()

            return jsonify({
                'message': 'Attendance marked successfully',
                'attendance_id': existing_attendance.id
            }), 200

    # Create new attendance record
    attendance = Attendance(
        student_id=student_id,
        class_id=class_info.id,
        attendance_date=today,
        status='present',
        marked_by=0,  # System marked
        qr_code_scanned=True,
        qr_scan_time=datetime.utcnow(),
        device_info=data.get('device_info', '')
    )

    db.session.add(attendance)
    db.session.commit()

    return jsonify({
        'message': 'Attendance marked successfully',
        'attendance_id': attendance.id
    }), 201

@mobile_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    """Get payment information for mobile users"""
    user_id = get_jwt_identity()
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type == 'parent':
        # Get payments for all parent's students
        user = User.query.get(user_id)
        student_ids = [s.id for s in user.students]

        payments = Payment.query.join(Registration)\
            .filter(Registration.student_id.in_(student_ids))\
            .order_by(Payment.due_date.desc())\
            .all()

    elif user_type == 'student':
        # Get payments for student
        payments = Payment.query.join(Registration)\
            .filter(Registration.student_id == user_id)\
            .order_by(Payment.due_date.desc())\
            .all()
    else:
        return jsonify({'error': 'Invalid user type'}), 400

    payments_data = []
    for payment in payments:
        registration = payment.registration
        student = Student.query.get(registration.student_id)
        course = registration.course

        payments_data.append({
            'id': payment.id,
            'student_name': student.name if student else 'Unknown',
            'course_name': course.name if course else 'Unknown',
            'amount': float(payment.amount),
            'due_date': payment.due_date.isoformat(),
            'paid_date': payment.paid_date.isoformat() if payment.paid_date else None,
            'status': payment.status,
            'payment_method': payment.payment_method
        })

    return jsonify({'payments': payments_data}), 200

@mobile_bp.route('/schedule', methods=['GET'])
@jwt_required()
def get_schedule():
    """Get class schedule for mobile users"""
    user_id = get_jwt_identity()
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type == 'parent':
        # Get schedule for all parent's students
        parent = Parent.query.filter_by(user_id=user_id).first()
        if not parent:
            return jsonify({'error': 'Parent record not found'}), 404
        
        student_ids = [s.id for s in parent.students]

        enrollments = Enrollment.query.filter(
            Enrollment.student_id.in_(student_ids),
            Enrollment.is_active == True
        ).all()

    elif user_type == 'student':
        # Get schedule for student
        enrollments = Enrollment.query.filter_by(
            student_id=user_id,
            is_active=True
        ).all()
    else:
        return jsonify({'error': 'Invalid user type'}), 400

    schedule_data = []
    for enrollment in enrollments:
        class_info = Class.query.get(enrollment.class_id)
        course_info = class_info.course if class_info else None
        student = Student.query.get(enrollment.student_id)

        if class_info and course_info:
            schedule_data.append({
                'enrollment_id': enrollment.id,
                'student_name': student.name if student else 'Unknown',
                'class_name': class_info.name,
                'course_name': course_info.name,
                'day_of_week': class_info.day_of_week,
                'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                'is_active': class_info.is_active
            })

    return jsonify({'schedule': schedule_data}), 200

@mobile_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_mobile_password():
    """Change mobile app password"""
    data = request.get_json()
    user_id = get_jwt_identity()
    claims = get_jwt()
    user_type = claims.get('user_type')

    if 'current_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Current password and new password are required'}), 400

    if user_type == 'parent':
        parent = Parent.query.filter_by(user_id=user_id).first()
        if not parent or not verify_password(parent.mobile_password_hash, data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401

        parent.mobile_password_hash = hash_password(data['new_password'])
        db.session.commit()

    elif user_type == 'student':
        student = Student.query.get(user_id)
        if not student or not verify_password(student.mobile_password_hash, data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401

        student.mobile_password_hash = hash_password(data['new_password'])
        db.session.commit()
    else:
        return jsonify({'error': 'Invalid user type'}), 400

    return jsonify({'message': 'Password changed successfully'}), 200

@mobile_bp.route('/student/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_details(student_id):
    """Get detailed information for a specific student (Parent only)"""
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type != 'parent':
        return jsonify({'error': 'Only parents can access student details'}), 403

    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    # Check if the student belongs to this parent
    student = Student.query.filter_by(id=student_id, parent_id=user_id).first()
    if not student:
        return jsonify({'error': 'Student not found or access denied'}), 404

    # Get student's enrollments
    enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
    enrollment_data = []

    for enrollment in enrollments:
        class_info = Class.query.get(enrollment.class_id)
        course_info = class_info.course if class_info else None

        if class_info and course_info:
            enrollment_data.append({
                'id': enrollment.id,
                'class_name': class_info.name,
                'course_name': course_info.name,
                'day_of_week': class_info.day_of_week,
                'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                'qr_code_data': class_info.qr_code_data
            })

    # Get recent attendance
    recent_attendance = Attendance.query.filter_by(student_id=student.id)\
        .order_by(Attendance.attendance_date.desc())\
        .limit(10)\
        .all()

    attendance_data = []
    for att in recent_attendance:
        class_info = Class.query.get(att.class_id)
        attendance_data.append({
            'date': att.attendance_date.isoformat(),
            'class_name': class_info.name if class_info else 'Unknown',
            'status': att.status,
            'qr_code_scanned': att.qr_code_scanned
        })

    # Get payments
    payments = Payment.query.join(Registration)\
        .filter(Registration.student_id == student.id)\
        .order_by(Payment.due_date.desc())\
        .limit(5)\
        .all()

    payment_data = []
    for payment in payments:
        payment_data.append({
            'id': payment.id,
            'amount': float(payment.amount),
            'due_date': payment.due_date.isoformat(),
            'paid_date': payment.paid_date.isoformat() if payment.paid_date else None,
            'status': payment.status
        })

    return jsonify({
        'student': {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'mobile_username': student.mobile_username,
            'mobile_app_enabled': student.mobile_app_enabled
        },
        'enrollments': enrollment_data,
        'recent_attendance': attendance_data,
        'recent_payments': payment_data
    }), 200

def student_to_dict(student):
    """Convert Student model to dictionary for mobile response"""
    return {
        'id': student.id,
        'name': student.name,
        'mobile_username': student.mobile_username
    }
