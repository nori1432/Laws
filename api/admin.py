from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging

admin_bp = Blueprint('admin', __name__)

logger = logging.getLogger(__name__)

# Import models and utilities
from models import db, User, Parent, Registration, Student, Course, Class, Enrollment, Attendance, Gallery
from utils import send_registration_approved_email, generate_parent_mobile_credentials, generate_student_mobile_credentials, send_registration_rejected_email, hash_password, send_manual_registration_email, generate_qr_code
import requests
from werkzeug.utils import secure_filename
import base64
import os
from datetime import datetime, timedelta
import secrets

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/registrations', methods=['GET'])
@jwt_required()
def get_registrations():
    """Get all registration requests (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    status_filter = request.args.get('status', 'pending')

    registrations = Registration.query.filter_by(status=status_filter).all()

    registrations_data = []
    for reg in registrations:
        parent = Parent.query.get(reg.parent_id)
        student = Student.query.get(reg.student_id)
        course = Course.query.get(reg.course_id)

        registrations_data.append({
            'id': reg.id,
            'parent': {
                'id': parent.id,
                'full_name': parent.full_name,
                'email': parent.email,
                'phone': parent.phone
            },
            'student': {
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat()
            },
            'course': {
                'id': course.id,
                'name': course.name,
                'price': float(course.price)
            },
            'status': reg.status,
            'payment_status': reg.payment_status,
            'payment_date': reg.payment_date.isoformat() if reg.payment_date else None,
            'notes': reg.notes,
            'created_at': reg.created_at.isoformat()
        })

    return jsonify({'registrations': registrations_data}), 200

@admin_bp.route('/registrations/<int:registration_id>/approve', methods=['POST'])
@jwt_required()
def approve_registration(registration_id):
    """Approve a registration request (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json() or {}
    section_id = data.get('section_id')  # Optional: admin can specify which section

    registration = Registration.query.get(registration_id)
    if not registration:
        return jsonify({'error': 'Registration not found'}), 404

    if registration.status != 'pending':
        return jsonify({'error': 'Registration is not pending'}), 400

    # Get parent, student, and course objects
    parent = Parent.query.get(registration.parent_id)
    student = Student.query.get(registration.student_id)
    course = Course.query.get(registration.course_id)

    # Get available sections for this course
    available_sections = Class.query.filter_by(course_id=course.id, is_active=True).all()

    if not available_sections:
        return jsonify({'error': 'No active sections available for this course'}), 409

    # Determine which section to assign
    assigned_section = None

    if len(available_sections) == 1:
        # Only one section available, assign directly
        assigned_section = available_sections[0]
    elif section_id:
        # Admin specified a section
        assigned_section = Class.query.filter_by(id=section_id, course_id=course.id, is_active=True).first()
        if not assigned_section:
            return jsonify({'error': 'Specified section not found or not available'}), 400
    else:
        # Multiple sections available but admin didn't specify - return error asking for section choice
        sections_data = []
        for section in available_sections:
            current_enrollments = Enrollment.query.filter_by(class_id=section.id, is_active=True).count()
            available_seats = max(0, section.max_students - current_enrollments)
            sections_data.append({
                'id': section.id,
                'name': section.name,
                'schedule': section.schedule,
                'available_seats': available_seats
            })

        return jsonify({
            'error': 'Multiple sections available - please specify which section to assign',
            'available_sections': sections_data,
            'requires_section_choice': True
        }), 400

    # Check if assigned section has available seats
    current_enrollments = Enrollment.query.filter_by(class_id=assigned_section.id, is_active=True).count()
    if current_enrollments >= assigned_section.max_students:
        return jsonify({'error': f'No available seats in section {assigned_section.name}'}), 409

    # Generate mobile credentials for both parent and student
    parent_username, parent_password = generate_parent_mobile_credentials(parent.full_name)
    student_username, student_password = generate_student_mobile_credentials(student.name)

    # Update parent with mobile credentials
    parent.mobile_username = parent_username
    parent.mobile_password_hash = hash_password(parent_password)
    parent.mobile_app_enabled = True

    # Update student with mobile credentials
    student.mobile_username = student_username
    student.mobile_password_hash = hash_password(student_password)
    student.mobile_app_enabled = True

    # Create enrollment in the assigned section
    enrollment = Enrollment(
        student_id=student.id,
        class_id=assigned_section.id
    )
    db.session.add(enrollment)

    # Update registration status
    registration.status = 'approved'
    db.session.commit()

    # Send approval email
    try:
        send_registration_approved_email(
            parent.email,
            student.name,
            course.name,
            parent_username,
            parent_password,
            student_username,
            student_password
        )
    except Exception as e:
        print(f"Email sending failed: {e}")

    return jsonify({
        'message': 'Registration approved successfully',
        'assigned_section': {
            'id': assigned_section.id,
            'name': assigned_section.name,
            'schedule': assigned_section.schedule
        },
        'mobile_credentials': {
            'parent': {
                'username': parent_username,
                'password': parent_password
            },
            'student': {
                'username': student_username,
                'password': student_password
            }
        }
    }), 200

@admin_bp.route('/registrations/<int:registration_id>/reject', methods=['POST'])
@jwt_required()
def reject_registration(registration_id):
    """Reject a registration request (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    registration = Registration.query.get(registration_id)
    if not registration:
        return jsonify({'error': 'Registration not found'}), 404

    if registration.status != 'pending':
        return jsonify({'error': 'Registration is not pending'}), 400

    data = request.get_json()
    notes = data.get('notes', '') if data else ''

    registration.status = 'rejected'
    registration.notes = notes
    db.session.commit()

    # Send rejection email
    parent = User.query.get(registration.user_id)
    student = Student.query.get(registration.student_id)
    course = Course.query.get(registration.course_id)

    try:
        send_registration_rejected_email(
            parent.email,
            student.name,
            course.name,
            notes
        )
    except Exception as e:
        print(f"Email sending failed: {e}")

    return jsonify({'message': 'Registration rejected successfully'}), 200

@admin_bp.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    """Get all students with comprehensive information (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    students = Student.query.all()

    students_data = []
    total_students = 0
    students_with_mobile = 0
    students_with_parents = 0
    students_enrolled = 0

    for student in students:
        total_students += 1

        parent = Parent.query.get(student.parent_id) if student.parent_id else None

        # Get all enrollments for this student
        all_enrollments = Enrollment.query.filter_by(student_id=student.id).all()
        active_enrollments = [e for e in all_enrollments if e.is_active]
        enrollment_count = len(active_enrollments)

        if enrollment_count > 0:
            students_enrolled += 1

        # Get current courses information
        courses_info = []
        for enrollment in active_enrollments:
            class_info = Class.query.get(enrollment.class_id)
            if class_info:
                course = Course.query.get(class_info.course_id)
                if course:
                    courses_info.append({
                        'id': course.id,
                        'name': course.name,
                        'class_name': class_info.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                        'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None
                    })

        # Get attendance statistics
        attendance_records = Attendance.query.filter_by(student_id=student.id).all()
        total_attendance = len(attendance_records)
        present_count = len([a for a in attendance_records if a.status == 'present'])
        absent_count = len([a for a in attendance_records if a.status == 'absent'])
        late_count = len([a for a in attendance_records if a.status == 'late'])

        attendance_rate = (present_count / total_attendance * 100) if total_attendance > 0 else 0

        # Mobile app status
        if student.mobile_username and student.mobile_app_enabled:
            students_with_mobile += 1

        if parent:
            students_with_parents += 1

        # Get parent's user information
        parent_user = None
        if parent:
            parent_user = User.query.get(parent.user_id)

        student_data = {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'age': None,  # Will calculate if date_of_birth exists
            'parent': {
                'id': parent.id if parent else None,
                'name': parent.full_name if parent else 'N/A',
                'email': parent.email if parent else 'N/A',
                'phone': parent.phone if parent else 'N/A',
                'mobile_username': parent.mobile_username if parent else None,
                'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
                'user_role': parent_user.role if parent_user else 'N/A',
                'user_email_verified': parent_user.email_verified if parent_user else False
            } if parent else None,
            'mobile_credentials': {
                'username': student.mobile_username,
                'app_enabled': student.mobile_app_enabled,
                'password_set': bool(student.mobile_password_hash)
            },
            'enrollment_info': {
                'total_enrollments': len(all_enrollments),
                'active_enrollments': enrollment_count,
                'courses': courses_info
            },
            'attendance_stats': {
                'total_records': total_attendance,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'attendance_rate': round(attendance_rate, 1)
            },
            'status': {
                'has_parent': parent is not None,
                'has_mobile_credentials': bool(student.mobile_username),
                'mobile_app_enabled': student.mobile_app_enabled,
                'is_enrolled': enrollment_count > 0
            },
            'created_at': student.created_at.isoformat() if hasattr(student, 'created_at') and student.created_at else None
        }

        # Calculate age if date of birth exists
        if student.date_of_birth:
            from datetime import date
            today = date.today()
            age = today.year - student.date_of_birth.year - ((today.month, today.day) < (student.date_of_birth.month, student.date_of_birth.day))
            student_data['age'] = age

        students_data.append(student_data)

    # Sort students by name
    students_data.sort(key=lambda x: x['name'].lower())

    return jsonify({
        'students': students_data,
        'summary': {
            'total_students': total_students,
            'students_with_parents': students_with_parents,
            'students_with_mobile': students_with_mobile,
            'students_enrolled': students_enrolled,
            'orphaned_students': total_students - students_with_parents
        }
    }), 200

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    users = User.query.all()

    users_data = []
    for u in users:
        users_data.append({
            'id': u.id,
            'email': u.email,
            'full_name': u.full_name,
            'phone': u.phone,
            'role': u.role,
            'email_verified': u.email_verified,
            'created_at': u.created_at.isoformat()
        })

    return jsonify({'users': users_data}), 200

@admin_bp.route('/students', methods=['POST'])
@jwt_required()
def create_student():
    """Create a new student (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()

    # Validate required fields
    required_fields = ['name', 'parent_name', 'parent_email', 'date_of_birth']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    # Check if parent exists by email
    parent_email = data['parent_email'].lower().strip()
    parent = Parent.query.filter_by(email=parent_email).first()

    if not parent:
        return jsonify({'error': 'Parent not found. Please ensure parent is registered first.'}), 404

    # Parse date of birth
    try:
        from datetime import datetime
        dob = datetime.fromisoformat(data['date_of_birth']).date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    # Create student
    student = Student(
        parent_id=parent.id,
        name=data['name'].strip(),
        date_of_birth=dob,
        mobile_app_enabled=data.get('mobile_app_enabled', False)
    )

    db.session.add(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student created successfully',
        'student': {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat(),
            'mobile_app_enabled': student.mobile_app_enabled
        }
    }), 201
    """Add a student manually (Admin only) with optional email for mobile credentials"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()

    # Validate required fields
    required_fields = ['parent_email', 'parent_name', 'parent_phone', 'student_name', 'student_dob', 'course_id']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'error': f'{field} is required'}), 400

    parent_email = data['parent_email'].lower().strip()
    student_name = data['student_name'].strip()
    parent_name = data['parent_name'].strip()
    parent_phone = data['parent_phone'].strip()

    # Check if parent already exists
    existing_parent = User.query.filter_by(email=parent_email).first()

    if existing_parent:
        parent = existing_parent
    else:
        # Create new parent user
        parent = User(
            email=parent_email,
            password_hash=hash_password(secrets.token_hex(16)),  # Random password, they'll use mobile app
            full_name=parent_name,
            phone=parent_phone,
            email_verified=True  # Manually added, assume verified
        )
        db.session.add(parent)
        db.session.flush()

    # Create student
    try:
        dob = datetime.strptime(data['student_dob'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    student = Student(
        user_id=parent.id,
        name=student_name,
        date_of_birth=dob
    )
    db.session.add(student)
    db.session.flush()

    # Check course exists and has available seats
    course = Course.query.get(data['course_id'])
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    current_registrations = Registration.query.filter_by(
        course_id=course.id,
        status='approved'
    ).count()

    if current_registrations >= course.max_students:
        return jsonify({'error': 'No available seats for this course'}), 409

    # Create registration
    registration = Registration(
        user_id=parent.id,
        course_id=course.id,
        student_id=student.id,
        status='approved',  # Auto-approved for manual additions
        notes=data.get('notes', 'Manually added by admin')
    )
    db.session.add(registration)
    db.session.flush()

    # Generate mobile credentials
    parent_username, parent_password = generate_parent_mobile_credentials()
    student_username, student_password = generate_student_mobile_credentials()

    # Update parent with mobile credentials
    parent.mobile_username = parent_username
    parent.mobile_password_hash = hash_password(parent_password)
    parent.mobile_app_enabled = True

    # Update student with mobile credentials
    student.mobile_username = student_username
    student.mobile_password_hash = hash_password(student_password)
    student.mobile_app_enabled = True

    # Create enrollment for the student
    # First, check if there's a default class for this course
    default_class = Class.query.filter_by(course_id=course.id, is_active=True).first()
    if default_class:
        enrollment = Enrollment(
            student_id=student.id,
            class_id=default_class.id,
            enrollment_date=datetime.utcnow(),
            is_active=True
        )
        db.session.add(enrollment)

    db.session.commit()

    # Send email with credentials if email is provided
    send_credentials = data.get('send_email', True)
    if send_credentials:
        try:
            send_manual_registration_email(
                parent.email,
                student.name,
                course.name,
                parent_username,
                parent_password,
                student_username,
                student_password
            )
        except Exception as e:
            print(f"Email sending failed: {e}")

    return jsonify({
        'message': 'Student added successfully',
        'student_id': student.id,
        'parent_id': parent.id,
        'registration_id': registration.id,
        'mobile_credentials': {
            'parent': {
                'username': parent_username,
                'password': parent_password
            },
            'student': {
                'username': student_username,
                'password': student_password
            }
        }
    }), 201

@admin_bp.route('/classes/<int:class_id>/generate-qr', methods=['POST'])
@jwt_required()
def generate_class_qr(class_id):
    """Generate QR code for a class (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    class_info = Class.query.get(class_id)
    if not class_info:
        return jsonify({'error': 'Class not found'}), 404

    data = request.get_json()
    duration_minutes = data.get('duration_minutes', 15)  # Default 15 minutes

    # Generate unique QR code data
    qr_data = f"class_{class_id}_{secrets.token_hex(8)}"
    expires_at = datetime.utcnow() + timedelta(minutes=duration_minutes)

    # Update class with QR code data
    class_info.qr_code_data = qr_data
    class_info.qr_code_expires = expires_at
    db.session.commit()

    # Generate QR code image
    qr_code_image = generate_qr_code(qr_data)

    return jsonify({
        'message': 'QR code generated successfully',
        'qr_code_data': qr_data,
        'expires_at': expires_at.isoformat(),
        'qr_code_image': qr_code_image,
        'class_name': class_info.name
    }), 200

    # Get various statistics
    total_users = User.query.count()
    verified_users = User.query.filter_by(email_verified=True).count()
    total_students = Student.query.count()
    total_courses = Course.query.filter_by(is_active=True).count()

    pending_registrations = Registration.query.filter_by(status='pending').count()
    approved_registrations = Registration.query.filter_by(status='approved').count()

    stats = {
        'users': {
            'total': total_users,
            'verified': verified_users
        },
        'students': total_students,
        'courses': total_courses,
        'registrations': {
            'pending': pending_registrations,
            'approved': approved_registrations
        }
    }

    return jsonify({'stats': stats}), 200

@admin_bp.route('/courses', methods=['POST'])
@jwt_required()
def create_course():
    """Create a new course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        name = request.form.get('name')
        description = request.form.get('description')
        price = request.form.get('price')
        max_students = request.form.get('max_students')
        category = request.form.get('category', 'General')
        image_file = request.files.get('image')

        if not name or not price or not max_students:
            return jsonify({'error': 'Name, price, and max_students are required'}), 400

        # Upload image if provided
        image_url = None
        if image_file:
            image_url = upload_to_imgbb(image_file)

        course = Course(
            name=name,
            description=description,
            price=float(price),
            max_students=int(max_students),
            category=category,
            image_url=image_url,
            is_active=True
        )

        db.session.add(course)
        db.session.commit()

        return jsonify({
            'message': 'Course created successfully',
            'course': {
                'id': course.id,
                'name': course.name,
                'description': course.description,
                'price': float(course.price),
                'max_students': course.max_students,
                'category': course.category,
                'image_url': course.image_url,
                'is_active': course.is_active
            }
        }), 201

    except Exception as e:
        print(f"Course creation failed: {e}")
        return jsonify({'error': 'Failed to create course'}), 500

@admin_bp.route('/courses', methods=['GET'])
@jwt_required()
def get_all_courses():
    """Get all courses (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    courses = Course.query.all()

    courses_data = []
    for course in courses:
        # Count current registrations
        registration_count = Registration.query.filter_by(
            course_id=course.id,
            status='approved'
        ).count()

        available_seats = max(0, course.max_students - registration_count)

        # Build pricing information
        pricing_info = {
            'pricing_type': course.pricing_type,
            'currency': 'DA',  # Algerian Dinar
        }

        if course.pricing_type == 'session':
            pricing_info.update({
                'session_price': float(course.session_price) if course.session_price else float(course.price),
                'session_duration_hours': course.session_duration,
                'display_price': f"{float(course.session_price) if course.session_price else float(course.price)} DA/session ({course.session_duration}h)"
            })
        elif course.pricing_type == 'monthly':
            pricing_info.update({
                'monthly_price': float(course.monthly_price) if course.monthly_price else float(course.price),
                'display_price': f"{float(course.monthly_price) if course.monthly_price else float(course.price)} DA/month"
            })

        courses_data.append({
            'id': course.id,
            'name': course.name,
            'description': course.description,
            'price': float(course.price),  # Keep for backward compatibility
            'pricing_info': pricing_info,
            'max_students': course.max_students,
            'category': course.category,
            'available_seats': available_seats,
            'is_active': course.is_active,
            'image_url': course.image_url,
            'created_at': course.created_at.isoformat() if course.created_at else None
        })

    return jsonify({'courses': courses_data}), 200

@admin_bp.route('/courses/<int:course_id>', methods=['PUT'])
@jwt_required()
def update_course(course_id):
    """Update a course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    try:
        # Handle form data for file uploads
        name = request.form.get('name')
        description = request.form.get('description')
        price = request.form.get('price')
        max_students = request.form.get('max_students')
        category = request.form.get('category')
        image_file = request.files.get('image')

        if name:
            course.name = name
        if description:
            course.description = description
        if price:
            course.price = float(price)
        if max_students:
            course.max_students = int(max_students)
        if category:
            course.category = category

        # Upload new image if provided
        if image_file:
            image_url = upload_to_imgbb(image_file)
            course.image_url = image_url

        db.session.commit()

        return jsonify({
            'message': 'Course updated successfully',
            'course': {
                'id': course.id,
                'name': course.name,
                'description': course.description,
                'price': float(course.price),
                'max_students': course.max_students,
                'category': course.category,
                'image_url': course.image_url,
                'is_active': course.is_active
            }
        }), 200

    except Exception as e:
        print(f"Course update failed: {e}")
        return jsonify({'error': 'Failed to update course'}), 500

@admin_bp.route('/courses/<int:course_id>', methods=['DELETE'])
@jwt_required()
def delete_course(course_id):
    """Delete a course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    db.session.delete(course)
    db.session.commit()

    return jsonify({'message': 'Course deleted successfully'}), 200

# Image upload utility function
def upload_to_imgbb(image_file):
    """Upload image to imgbb and return the URL"""
    try:
        # Read image file
        image_data = image_file.read()

        # Convert to base64
        encoded_image = base64.b64encode(image_data).decode('utf-8')

        # Upload to imgbb
        url = "https://api.imgbb.com/1/upload"
        payload = {
            'key': '87f7af9c51a82afe300f58346bb15445',
            'image': encoded_image
        }

        response = requests.post(url, data=payload)
        result = response.json()

        if result['success']:
            return result['data']['url']
        else:
            raise Exception(result.get('error', {}).get('message', 'Upload failed'))

    except Exception as e:
        print(f"Image upload failed: {e}")
        raise e

# Gallery management endpoints
@admin_bp.route('/gallery', methods=['GET'])
@jwt_required()
def get_gallery():
    """Get all gallery items (Admin only)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        gallery_items = Gallery.query.filter_by(is_active=True).all()

        gallery_data = []
        for item in gallery_items:
            gallery_data.append({
                'id': item.id,
            'title': item.title,
            'description': item.description,
            'image_url': item.image_url,
            'category': item.category,
            'is_active': item.is_active,
            'created_at': item.created_at.isoformat()
        })

        return jsonify({'gallery': gallery_data}), 200
    except Exception as e:
        logger.error(f"Database connection error in get_gallery: {str(e)}")
        return jsonify({
            'error': 'Database connection failed',
            'message': 'Unable to connect to database. Please try again later.'
        }), 503

@admin_bp.route('/gallery', methods=['POST'])
@jwt_required()
def create_gallery_item():
    """Create a new gallery item (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        title = request.form.get('title')
        description = request.form.get('description')
        category = request.form.get('category')
        image_file = request.files.get('image')

        if not title or not category or not image_file:
            return jsonify({'error': 'Title, category, and image are required'}), 400

        # Upload image to imgbb
        image_url = upload_to_imgbb(image_file)

        # Create gallery item
        gallery_item = Gallery(
            title=title,
            description=description,
            image_url=image_url,
            category=category,
            is_active=True
        )

        db.session.add(gallery_item)
        db.session.commit()

        return jsonify({
            'message': 'Gallery item created successfully',
            'gallery_item': {
                'id': gallery_item.id,
                'title': gallery_item.title,
                'description': gallery_item.description,
                'image_url': gallery_item.image_url,
                'category': gallery_item.category,
                'is_active': gallery_item.is_active
            }
        }), 201

    except Exception as e:
        print(f"Gallery creation failed: {e}")
        return jsonify({'error': 'Failed to create gallery item'}), 500

@admin_bp.route('/gallery/<int:item_id>', methods=['DELETE'])
@jwt_required()
def delete_gallery_item(item_id):
    """Delete a gallery item (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    gallery_item = Gallery.query.get(item_id)
    if not gallery_item:
        return jsonify({'error': 'Gallery item not found'}), 404

    db.session.delete(gallery_item)
    db.session.commit()

    return jsonify({'message': 'Gallery item deleted successfully'}), 200

# Public gallery endpoint for frontend
@admin_bp.route('/gallery/public', methods=['GET'])
def get_public_gallery():
    """Get gallery items for public display"""
    gallery_items = Gallery.query.filter_by(is_active=True).all()

    gallery_data = []
    for item in gallery_items:
        gallery_data.append({
            'id': item.id,
            'title': item.title,
            'description': item.description,
            'image_url': item.image_url,
            'category': item.category
        })

    return jsonify({'gallery': gallery_data}), 200

# Student-Parent Assignment Management
@admin_bp.route('/students/<int:student_id>/assign-parent', methods=['POST'])
@jwt_required()
def assign_student_to_parent(student_id):
    """Assign a student to a parent (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    parent_id = data.get('parent_id')

    if not parent_id:
        return jsonify({'error': 'Parent ID is required'}), 400

    student = Student.query.get_or_404(student_id)
    parent = Parent.query.get_or_404(parent_id)

    # Update student's parent
    student.parent_id = parent_id
    db.session.commit()

    return jsonify({
        'message': f'Student {student.name} assigned to parent {parent.full_name}',
        'student': {
            'id': student.id,
            'name': student.name,
            'parent_name': parent.full_name,
            'parent_email': parent.email
        }
    }), 200

@admin_bp.route('/students/<int:student_id>/unassign-parent', methods=['POST'])
@jwt_required()
def unassign_student_from_parent(student_id):
    """Unassign a student from their parent (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get_or_404(student_id)

    old_parent = Parent.query.get(student.parent_id)
    old_parent_name = old_parent.full_name if old_parent else 'Unknown'

    # Remove parent assignment
    student.parent_id = None
    db.session.commit()

    return jsonify({
        'message': f'Student {student.name} unassigned from parent {old_parent_name}',
        'student': {
            'id': student.id,
            'name': student.name,
            'parent_name': None
        }
    }), 200

@admin_bp.route('/parents', methods=['GET'])
@jwt_required()
def get_parents():
    """Get all parents (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parents = User.query.filter(User.students.any()).all()

    parents_data = []
    for parent in parents:
        parents_data.append({
            'id': parent.id,
            'full_name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone,
            'students_count': len(parent.students),
            'mobile_username': parent.mobile_username,
            'mobile_app_enabled': parent.mobile_app_enabled
        })

    return jsonify({'parents': parents_data}), 200

@admin_bp.route('/parents/<int:parent_id>/students', methods=['GET'])
@jwt_required()
def get_parent_students(parent_id):
    """Get all students assigned to a parent (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = User.query.get_or_404(parent_id)

    students_data = []
    for student in parent.students:
        # Get current course if enrolled
        enrollment = Enrollment.query.filter_by(student_id=student.id, is_active=True).first()
        course_name = None
        if enrollment:
            class_info = Class.query.get(enrollment.class_id)
            if class_info:
                course = Course.query.get(class_info.course_id)
                if course:
                    course_name = course.name

        students_data.append({
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'course_name': course_name,
            'mobile_username': student.mobile_username,
            'mobile_app_enabled': student.mobile_app_enabled
        })

    return jsonify({
        'parent': {
            'id': parent.id,
            'full_name': parent.full_name,
            'email': parent.email
        },
        'students': students_data
    }), 200

@admin_bp.route('/mobile-credentials', methods=['GET'])
@jwt_required()
def get_mobile_credentials():
    """Get all users with mobile credentials (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    credentials_data = []

    # Get parents with mobile credentials
    parents = Parent.query.filter(Parent.mobile_app_enabled == True).all()
    for parent in parents:
        # Get their students
        students_info = []
        active_students = 0
        total_enrollments = 0

        for student in parent.students:
            student_enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            enrollment_count = len(student_enrollments)

            if enrollment_count > 0:
                active_students += 1
                total_enrollments += enrollment_count

            # Get current courses for this student
            courses_info = []
            for enrollment in student_enrollments:
                class_info = Class.query.get(enrollment.class_id)
                if class_info:
                    course = Course.query.get(class_info.course_id)
                    if course:
                        courses_info.append({
                            'course_name': course.name,
                            'class_name': class_info.name,
                            'day_of_week': class_info.day_of_week,
                            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None
                        })

            if student.mobile_app_enabled:
                students_info.append({
                    'id': student.id,
                    'name': student.name,
                    'mobile_username': student.mobile_username,
                    'mobile_app_enabled': student.mobile_app_enabled,
                    'enrollment_count': enrollment_count,
                    'courses': courses_info,
                    'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
                })

        # Get parent's user information
        parent_user = User.query.get(parent.user_id)

        credentials_data.append({
            'id': parent.id,
            'user_id': parent.user_id,
            'name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone,
            'mobile_username': parent.mobile_username,
            'mobile_password': '••••••••',  # Masked for security - use regenerate endpoint for actual password
            'mobile_app_enabled': parent.mobile_app_enabled,
            'type': 'parent',
            'user_role': parent_user.role if parent_user else 'N/A',
            'user_email_verified': parent_user.email_verified if parent_user else False,
            'total_students': len(parent.students),
            'active_students': active_students,
            'total_enrollments': total_enrollments,
            'students': students_info,
            'created_at': parent.created_at.isoformat() if parent.created_at else None,
            'last_updated': parent.updated_at.isoformat() if hasattr(parent, 'updated_at') and parent.updated_at else None
        })

    # Get students with mobile credentials (orphaned students without parents)
    orphaned_students = Student.query.filter(
        Student.mobile_app_enabled == True,
        Student.parent_id.is_(None)
    ).all()

    for student in orphaned_students:
        # Get current enrollments for this student
        student_enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
        enrollment_count = len(student_enrollments)

        # Get current courses for this student
        courses_info = []
        for enrollment in student_enrollments:
            class_info = Class.query.get(enrollment.class_id)
            if class_info:
                course = Course.query.get(class_info.course_id)
                if course:
                    courses_info.append({
                        'course_name': course.name,
                        'class_name': class_info.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None
                    })

        credentials_data.append({
            'id': student.id,
            'name': student.name,
            'email': '',  # Students don't have email
            'mobile_username': student.mobile_username,
            'mobile_password': '••••••••',  # Masked for security - use regenerate endpoint for actual password
            'mobile_app_enabled': student.mobile_app_enabled,
            'type': 'student',
            'status': 'orphaned',  # No parent assigned
            'enrollment_count': enrollment_count,
            'courses': courses_info,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'created_at': student.created_at.isoformat() if hasattr(student, 'created_at') and student.created_at else None
        })

    # Sort by type (parents first) and then by name
    credentials_data.sort(key=lambda x: (x['type'] != 'parent', x['name'].lower()))

    return jsonify({
        'credentials': credentials_data,
        'summary': {
            'total_parents': len([c for c in credentials_data if c['type'] == 'parent']),
            'total_students': len([c for c in credentials_data if c['type'] == 'student']),
            'orphaned_students': len([c for c in credentials_data if c.get('status') == 'orphaned']),
            'total_credentials': len(credentials_data)
        }
    }), 200

@admin_bp.route('/credentials-overview', methods=['GET'])
@jwt_required()
def get_credentials_overview():
    """Get comprehensive overview of all parent and student credentials (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get all parents
    all_parents = Parent.query.all()
    parents_data = []

    # Get all students
    all_students = Student.query.all()
    students_data = []

    total_parents = 0
    parents_with_mobile = 0
    total_students = 0
    students_with_mobile = 0
    students_with_parents = 0
    orphaned_students = 0

    # Process parents
    for parent in all_parents:
        total_parents += 1

        if parent.mobile_username and parent.mobile_app_enabled:
            parents_with_mobile += 1

        # Get parent's user information
        parent_user = User.query.get(parent.user_id)

        # Get students for this parent
        parent_students = []
        for student in parent.students:
            total_students += 1
            students_with_parents += 1

            if student.mobile_username and student.mobile_app_enabled:
                students_with_mobile += 1

            # Get enrollment info
            enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            enrollment_count = len(enrollments)

            parent_students.append({
                'id': student.id,
                'name': student.name,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled,
                'enrollment_count': enrollment_count,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
            })

        parents_data.append({
            'id': parent.id,
            'user_id': parent.user_id,
            'name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone,
            'mobile_username': parent.mobile_username,
            'mobile_app_enabled': parent.mobile_app_enabled,
            'user_role': parent_user.role if parent_user else 'N/A',
            'user_email_verified': parent_user.email_verified if parent_user else False,
            'students_count': len(parent.students),
            'students': parent_students,
            'created_at': parent.created_at.isoformat() if parent.created_at else None
        })

    # Process orphaned students (students without parents)
    for student in all_students:
        if not student.parent_id:
            orphaned_students += 1
            total_students += 1

            if student.mobile_username and student.mobile_app_enabled:
                students_with_mobile += 1

            # Get enrollment info
            enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            enrollment_count = len(enrollments)

            students_data.append({
                'id': student.id,
                'name': student.name,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled,
                'enrollment_count': enrollment_count,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'status': 'orphaned'
            })

    # Sort data
    parents_data.sort(key=lambda x: x['name'].lower())
    students_data.sort(key=lambda x: x['name'].lower())

    return jsonify({
        'overview': {
            'parents': parents_data,
            'orphaned_students': students_data
        },
        'statistics': {
            'total_parents': total_parents,
            'parents_with_mobile': parents_with_mobile,
            'total_students': total_students,
            'students_with_parents': students_with_parents,
            'students_with_mobile': students_with_mobile,
            'orphaned_students': orphaned_students,
            'mobile_enabled_percentage': round(((parents_with_mobile + students_with_mobile) / (total_parents + total_students) * 100), 1) if (total_parents + total_students) > 0 else 0
        },
        'last_updated': datetime.utcnow().isoformat()
    }), 200

@admin_bp.route('/parents/<int:parent_id>/associate-student', methods=['POST'])
@jwt_required()
def associate_student_to_parent(parent_id):
    """Associate a student with a parent (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_id = data.get('student_id')

    if not student_id:
        return jsonify({'error': 'Student ID is required'}), 400

    parent = Parent.query.get_or_404(parent_id)
    student = Student.query.get_or_404(student_id)

    # Update student's parent_id to associate with parent
    student.parent_id = parent_id
    db.session.commit()

    return jsonify({
        'message': 'Student associated successfully',
        'parent': {
            'id': parent.id,
            'full_name': parent.full_name
        },
        'student': {
            'id': student.id,
            'name': student.name
        }
    }), 200

@admin_bp.route('/regenerate-mobile-credentials/<int:user_id>', methods=['POST'])
@jwt_required()
def regenerate_mobile_credentials(user_id):
    """Regenerate mobile credentials for a parent or student (Admin only)"""
    admin_user_id = get_jwt_identity()
    admin_user = User.query.get(admin_user_id)

    if admin_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    user_type = data.get('user_type')  # 'parent' or 'student'

    if user_type not in ['parent', 'student']:
        return jsonify({'error': 'Invalid user_type. Must be "parent" or "student"'}), 400

    if user_type == 'parent':
        parent = Parent.query.get_or_404(user_id)

        # Generate new credentials
        username, password = generate_parent_mobile_credentials(parent.full_name)

        # Update parent with new credentials
        parent.mobile_username = username
        parent.mobile_password_hash = hash_password(password)
        parent.mobile_app_enabled = True
        parent.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'message': 'Parent mobile credentials regenerated successfully',
            'credentials': {
                'id': parent.id,
                'type': 'parent',
                'name': parent.full_name,
                'username': username,
                'password': password,  # Return plain text for admin
                'mobile_app_enabled': True
            }
        }), 200

    elif user_type == 'student':
        student = Student.query.get_or_404(user_id)

        # Generate new credentials
        username, password = generate_student_mobile_credentials(student.name)

        # Update student with new credentials
        student.mobile_username = username
        student.mobile_password_hash = hash_password(password)
        student.mobile_app_enabled = True

        db.session.commit()

        return jsonify({
            'message': 'Student mobile credentials regenerated successfully',
            'credentials': {
                'id': student.id,
                'type': 'student',
                'name': student.name,
                'username': username,
                'password': password,  # Return plain text for admin
                'mobile_app_enabled': True
            }
        }), 200

@admin_bp.route('/get-mobile-credentials/<int:user_id>', methods=['GET'])
@jwt_required()
def get_single_mobile_credentials(user_id):
    """Get mobile credentials for a specific user (Admin only) - shows actual password temporarily"""
    admin_user_id = get_jwt_identity()
    admin_user = User.query.get(admin_user_id)

    if admin_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.args
    user_type = data.get('user_type')  # 'parent' or 'student'

    if user_type not in ['parent', 'student']:
        return jsonify({'error': 'Invalid user_type. Must be "parent" or "student"'}), 400

    if user_type == 'parent':
        parent = Parent.query.get_or_404(user_id)

        if not parent.mobile_username:
            return jsonify({'error': 'No mobile credentials found for this parent'}), 404

        # Generate new password for display (don't save yet)
        _, temp_password = generate_parent_mobile_credentials(parent.full_name)

        return jsonify({
            'credentials': {
                'id': parent.id,
                'type': 'parent',
                'name': parent.full_name,
                'username': parent.mobile_username,
                'password': temp_password,  # Temporary password for display
                'mobile_app_enabled': parent.mobile_app_enabled,
                'note': 'This is a temporary password. Use regenerate endpoint to update stored credentials.'
            }
        }), 200

    elif user_type == 'student':
        student = Student.query.get_or_404(user_id)

        if not student.mobile_username:
            return jsonify({'error': 'No mobile credentials found for this student'}), 404

        # Generate new password for display (don't save yet)
        _, temp_password = generate_student_mobile_credentials(student.name)

        return jsonify({
            'credentials': {
                'id': student.id,
                'type': 'student',
                'name': student.name,
                'username': student.mobile_username,
                'password': temp_password,  # Temporary password for display
                'mobile_app_enabled': student.mobile_app_enabled,
                'note': 'This is a temporary password. Use regenerate endpoint to update stored credentials.'
            }
        }), 200

# ===== STUDENT CRUD ENDPOINTS =====

@admin_bp.route('/students/<int:student_id>', methods=['PUT'])
@jwt_required()
def update_student(student_id):
    """Update a student (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    data = request.get_json()

    # Update student fields
    if 'name' in data:
        student.name = data['name']
    if 'date_of_birth' in data:
        from datetime import datetime
        student.date_of_birth = datetime.fromisoformat(data['date_of_birth'])
    if 'mobile_app_enabled' in data:
        student.mobile_app_enabled = data['mobile_app_enabled']

    # Update parent information if provided
    if 'parent_name' in data or 'parent_email' in data:
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        if parent:
            if 'parent_name' in data:
                parent.full_name = data['parent_name']
            if 'parent_email' in data:
                parent.email = data['parent_email']
            if 'parent_phone' in data:
                parent.phone = data['parent_phone']
            db.session.add(parent)

    db.session.add(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student updated successfully',
        'student': {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'mobile_app_enabled': student.mobile_app_enabled
        }
    }), 200

@admin_bp.route('/students/<int:student_id>', methods=['DELETE'])
@jwt_required()
def delete_student(student_id):
    """Delete a student (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # Check if student has active enrollments
    active_enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).count()
    if active_enrollments > 0:
        return jsonify({'error': 'Cannot delete student with active enrollments'}), 400

    # Delete related records
    Attendance.query.filter_by(student_id=student_id).delete()
    Enrollment.query.filter_by(student_id=student_id).delete()

    # Delete student
    db.session.delete(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Student deleted successfully'
    }), 200

@admin_bp.route('/students/<int:student_id>/toggle-mobile', methods=['PUT'])
@jwt_required()
def toggle_student_mobile(student_id):
    """Toggle mobile app access for a student (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    student.mobile_app_enabled = not student.mobile_app_enabled
    db.session.add(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Student mobile access {"enabled" if student.mobile_app_enabled else "disabled"}',
        'mobile_app_enabled': student.mobile_app_enabled
    }), 200

# ===== USER CRUD ENDPOINTS =====

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()

    # Validate required fields
    required_fields = ['full_name', 'email', 'phone', 'role']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    # Check if email already exists
    existing_user = User.query.filter_by(email=data['email']).first()
    if existing_user:
        return jsonify({'error': 'Email already exists'}), 400

    # Create new user
    new_user = User(
        email=data['email'],
        full_name=data['full_name'],
        phone=data['phone'],
        role=data['role'],
        email_verified=data.get('email_verified', False)
    )

    # Hash password if provided
    if 'password' in data:
        new_user.password_hash = hash_password(data['password'])
    else:
        # Generate a temporary password
        temp_password = secrets.token_urlsafe(8)
        new_user.password_hash = hash_password(temp_password)

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'User created successfully',
        'user': {
            'id': new_user.id,
            'email': new_user.email,
            'full_name': new_user.full_name,
            'phone': new_user.phone,
            'role': new_user.role,
            'email_verified': new_user.email_verified,
            'created_at': new_user.created_at.isoformat()
        }
    }), 201

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update a user (Admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    # Update user fields
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'email' in data:
        # Check if email is already taken by another user
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'error': 'Email already exists'}), 400
        user.email = data['email']
    if 'phone' in data:
        user.phone = data['phone']
    if 'role' in data:
        user.role = data['role']
    if 'email_verified' in data:
        user.email_verified = data['email_verified']

    # Update password if provided
    if 'password' in data and data['password']:
        user.password_hash = hash_password(data['password'])

    db.session.add(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'User updated successfully',
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'role': user.role,
            'email_verified': user.email_verified,
            'created_at': user.created_at.isoformat()
        }
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete a user (Admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Prevent deleting the last admin
    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400

    # Check if user has associated parents/students
    parent = Parent.query.filter_by(user_id=user_id).first()
    if parent:
        return jsonify({'error': 'Cannot delete user with associated parent records'}), 400

    # Delete user
    db.session.delete(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'User deleted successfully'
    }), 200

@admin_bp.route('/users/<int:user_id>/toggle-role', methods=['PUT'])
@jwt_required()
def toggle_user_role(user_id):
    """Toggle user role between admin and user (Admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Prevent removing admin role from the last admin
    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot remove admin role from the last admin user'}), 400

    # Toggle role
    user.role = 'user' if user.role == 'admin' else 'admin'
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'User role changed to {user.role}',
        'role': user.role
    }), 200

@admin_bp.route('/registrations/<int:registration_id>/payment-status', methods=['POST'])
@jwt_required()
def update_payment_status(registration_id):
    """Update payment status for a registration (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    if not data or 'payment_status' not in data:
        return jsonify({'error': 'Payment status is required'}), 400

    payment_status = data['payment_status']
    if payment_status not in ['unpaid', 'paid', 'partial']:
        return jsonify({'error': 'Invalid payment status. Must be: unpaid, paid, or partial'}), 400

    registration = Registration.query.get(registration_id)
    if not registration:
        return jsonify({'error': 'Registration not found'}), 404

    if registration.status != 'approved':
        return jsonify({'error': 'Can only update payment status for approved registrations'}), 400

    # Update payment status
    old_status = registration.payment_status
    registration.payment_status = payment_status

    # Set payment date if status is paid or partial
    from datetime import datetime
    if payment_status in ['paid', 'partial']:
        registration.payment_date = datetime.utcnow()
    elif payment_status == 'unpaid':
        registration.payment_date = None

    db.session.commit()

    return jsonify({
        'message': f'Payment status updated from {old_status} to {payment_status}',
        'registration_id': registration_id,
        'payment_status': payment_status,
        'payment_date': registration.payment_date.isoformat() if registration.payment_date else None
    }), 200
