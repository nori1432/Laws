from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
import logging
from sqlalchemy.exc import OperationalError, TimeoutError
from sqlalchemy import text, func
from sqlalchemy.orm import aliased
import time
import functools
import json
from datetime import datetime, date, timedelta
from decimal import Decimal
import pytz

admin_bp = Blueprint('admin', __name__)

logger = logging.getLogger(__name__)

def get_algerian_time():
    """Get current time in Algerian timezone (UTC+1)"""
    algerian_tz = pytz.timezone('Africa/Algiers')
    return datetime.now(algerian_tz)

def get_algerian_date():
    """Get current date in Algerian timezone"""
    return get_algerian_time().date()

# ===== DELETION HELPER FUNCTIONS =====

def safe_delete_with_logging(entity, entity_type, entity_id, user_id, related_deletions=None):
    """
    Safely delete an entity with comprehensive logging and rollback on failure
    """
    try:
        # Log the deletion attempt
        logger.info(f"Starting deletion of {entity_type} ID {entity_id} by user {user_id}")
        
        # Track what will be deleted for logging
        deletion_summary = {
            'entity_type': entity_type,
            'entity_id': entity_id,
            'deleted_by': user_id,
            'related_deletions': related_deletions or [],
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Perform the deletion
        db.session.delete(entity)
        db.session.commit()
        
        # Log successful deletion
        logger.info(f"Successfully deleted {entity_type} ID {entity_id} and {len(related_deletions or [])} related records")
        
        return True, deletion_summary
        
    except Exception as e:
        db.session.rollback()
        error_msg = f"Failed to delete {entity_type} ID {entity_id}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def delete_related_records(model, filter_field, filter_value, record_type):
    """
    Delete all records of a specific model that match the filter criteria
    Returns count of deleted records for logging
    """
    try:
        deleted_count = model.query.filter(getattr(model, filter_field) == filter_value).delete()
        return deleted_count, None
    except Exception as e:
        return 0, str(e)

def check_dependencies(entity_type, entity_id):
    """
    Check for dependencies that might prevent deletion
    Returns (can_delete, dependency_info)
    """
    dependencies = []
    
    if entity_type == 'course':
        # Check for active enrollments
        active_enrollments = db.session.query(Enrollment).join(Class).filter(
            Class.course_id == entity_id,
            Enrollment.is_active == True
        ).count()
        
        if active_enrollments > 0:
            dependencies.append(f"{active_enrollments} active enrollments")
            
        # Check for recent attendances (within last 30 days)
        recent_attendances = db.session.query(Attendance).join(Class).filter(
            Class.course_id == entity_id,
            Attendance.attendance_date >= get_algerian_date() - timedelta(days=30)
        ).count()
        
        if recent_attendances > 0:
            dependencies.append(f"{recent_attendances} recent attendance records")
    
    elif entity_type == 'student':
        # Check for active enrollments
        active_enrollments = Enrollment.query.filter_by(
            student_id=entity_id, 
            is_active=True
        ).count()
        
        if active_enrollments > 0:
            dependencies.append(f"{active_enrollments} active enrollments")
            
        # Check for recent attendances
        recent_attendances = Attendance.query.filter(
            Attendance.student_id == entity_id,
            Attendance.attendance_date >= get_algerian_date() - timedelta(days=30)
        ).count()
        
        if recent_attendances > 0:
            dependencies.append(f"{recent_attendances} recent attendance records")
    
    elif entity_type == 'user':
        # Check for parent records
        parent_count = Parent.query.filter_by(user_id=entity_id).count()
        if parent_count > 0:
            dependencies.append(f"{parent_count} parent records")
            
        # Check for admin role (prevent deleting last admin)
        user = User.query.get(entity_id)
        if user and user.role == 'admin':
            admin_count = User.query.filter_by(role='admin').count()
            if admin_count <= 1:
                dependencies.append("Cannot delete the last admin user")
    
    return len(dependencies) == 0, dependencies

# Enhanced logging configuration for attendance operations
def log_attendance_operation(operation_type, details, user_id=None, success=True, error_message=None):
    """
    Comprehensive attendance operation logging
    """
    log_entry = {
        'timestamp': get_algerian_time().isoformat(),
        'operation_type': operation_type,
        'user_id': user_id,
        'success': success,
        'details': details
    }
    
    if error_message:
        log_entry['error'] = error_message
    
    # Log to console with formatting
    def decimal_converter(obj):
        if isinstance(obj, Decimal):
            return float(obj)
        raise TypeError(f'Object of type {obj.__class__.__name__} is not JSON serializable')
    
    log_message = f"[ATTENDANCE_LOG] {operation_type.upper()}: {json.dumps(log_entry, indent=2, default=decimal_converter)}"
    
    if success:
        logger.info(log_message)
    else:
        logger.error(log_message)
    
    # Also log to a dedicated attendance log file if needed
    try:
        with open('attendance_operations.log', 'a', encoding='utf-8') as f:
            f.write(f"{log_message}\n")
    except Exception as e:
        logger.warning(f"Failed to write to attendance log file: {e}")
    
    return log_entry

def check_attendance_time_window(class_obj):
    """
    Check if current time is within the allowed window for attendance marking.
    Allowed window: 30 minutes before class start until 30 minutes after class end.
    Uses Algerian timezone (UTC+1).
    Returns (is_allowed: bool, message: str, warning_needed: bool)
    """
    # Check if class has required schedule information
    if class_obj.day_of_week is None or class_obj.start_time is None or class_obj.end_time is None:
        return False, "Class schedule information is incomplete. Cannot determine attendance window.", True
    
    # Use Algerian timezone
    now = get_algerian_time()
    current_time = now.time()
    current_weekday = now.weekday()  # 0=Monday, 6=Sunday
    
    # Convert class day_of_week to match Python's weekday (0=Monday)
    class_weekday = class_obj.day_of_week
    
    # Additional safety check
    if class_weekday is None or not (0 <= class_weekday <= 6):
        return False, "Class schedule day is invalid. Cannot determine attendance window.", True
    
    # Check if today is the class day
    if current_weekday != class_weekday:
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        return False, f"Today is not the scheduled day for this class (scheduled for {day_names[class_weekday]})", True
    
    # Calculate time window
    start_time = class_obj.start_time
    end_time = class_obj.end_time
    
    # Create datetime objects for easier calculation (using Algerian date)
    algerian_date = now.date()
    class_start = datetime.combine(algerian_date, start_time)
    class_end = datetime.combine(algerian_date, end_time)
    
    # 30 minutes before and after
    window_start = class_start - timedelta(minutes=30)
    window_end = class_end + timedelta(minutes=30)
    
    # Convert current time to comparable datetime
    current_datetime = datetime.combine(algerian_date, current_time)
    
    if window_start <= current_datetime <= window_end:
        return True, "Within allowed time window", False
    else:
        if current_datetime < window_start:
            return False, f"Too early to mark attendance. Class starts at {start_time.strftime('%H:%M')}, marking allowed from {window_start.time().strftime('%H:%M')} (Algerian time)", True
        else:
            return False, f"Too late to mark attendance. Class ended at {end_time.strftime('%H:%M')}, marking allowed until {window_end.time().strftime('%H:%M')} (Algerian time)", True

# Database retry decorator
def db_retry(max_retries=3, delay=1):
    """Decorator to retry database operations on connection failures"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except (OperationalError, TimeoutError) as e:
                    logger.warning(f"Database operation failed (attempt {attempt + 1}/{max_retries}): {str(e)}")
                    if attempt == max_retries - 1:
                        logger.error(f"Database operation failed after {max_retries} attempts")
                        raise
                    time.sleep(delay * (attempt + 1))  # Exponential backoff
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Import models and utilities
from models import (db, User, Parent, Registration, Student, Course, Class, Enrollment, 
                   Attendance, CourseSection, SectionEnrollment, Notification, 
                   UserSettings, ContactMessage, AuditLog)
from push_notifications import PushNotificationService
from utils import send_registration_approved_email, generate_parent_mobile_credentials, generate_student_mobile_credentials, send_registration_rejected_email, hash_password, send_manual_registration_email, generate_qr_code, send_admin_response_email
from auth import auto_generate_mobile_credentials_if_eligible
import requests
from werkzeug.utils import secure_filename
import base64
import os
from datetime import datetime, timedelta
import secrets

@admin_bp.route('/registrations/<int:registration_id>/approve', methods=['POST'])
@jwt_required()
def approve_registration(registration_id):
    """Approve a registration request (Admin only) - Updated to work with enrollments"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get enrollment instead of registration
    enrollment = Enrollment.query.get(registration_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    if enrollment.is_active:
        return jsonify({'error': 'Enrollment is already active'}), 400

    # Update enrollment status (approval only, no payment tracking)
    enrollment.is_active = True
    enrollment.status = 'approved'
    enrollment.approved_by = user_id
    enrollment.approved_at = get_algerian_time()

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Enrollment approved successfully'
    })

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
    parent.mobile_password_plain = parent_password  # Store unhashed password
    parent.mobile_app_enabled = True

    # Update student with mobile credentials
    student.mobile_username = student_username
    student.mobile_password_hash = hash_password(student_password)
    student.mobile_password_plain = student_password  # Store unhashed password
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
    """Reject a registration request (Admin only) - Updated to work with enrollments"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get enrollment instead of registration
    enrollment = Enrollment.query.get(registration_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    if not enrollment.is_active:
        return jsonify({'error': 'Enrollment is already inactive'}), 400

    # Deactivate enrollment
    enrollment.is_active = False

    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Enrollment rejected successfully'
    })

# === CLASSES AND ENROLLMENTS ROUTES ===

@admin_bp.route('/classes', methods=['GET'])
@jwt_required()
def get_all_classes():
    """Get all classes with course information"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        classes = db.session.query(Class).join(Course).filter(Class.is_active == True).all()
        
        classes_data = []
        for class_obj in classes:
            class_data = {
                'id': class_obj.id,
                'name': class_obj.name,
                'schedule': class_obj.schedule,
                'day_of_week': class_obj.day_of_week,
                'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
                'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
                'max_students': class_obj.max_students,
                'instructor_name': None,  # Class model doesn't have instructor field
                'room': None,  # Class model doesn't have room field
                'is_active': class_obj.is_active,
                'course': {
                    'id': class_obj.course.id,
                    'name': class_obj.course.name,
                    'name_en': class_obj.course.name_en,
                    'name_ar': class_obj.course.name_ar,
                    'pricing_type': class_obj.course.pricing_type,
                    'session_price': float(class_obj.course.session_price) if class_obj.course.session_price else None,
                    'monthly_price': float(class_obj.course.monthly_price) if class_obj.course.monthly_price else None
                },
                'enrolled_count': db.session.query(Enrollment).filter_by(
                    class_id=class_obj.id,
                    status='approved',
                    is_active=True
                ).count()
            }
            classes_data.append(class_data)

        return jsonify({
            'success': True,
            'classes': classes_data,
            'total': len(classes_data)
        }), 200

    except Exception as e:
        logger.error(f"Failed to fetch classes: {str(e)}")
        return jsonify({'error': f'Failed to fetch classes: {str(e)}'}), 500


@admin_bp.route('/enrollments', methods=['GET'])
@jwt_required()
def get_all_enrollments():
    """Get all enrollments with student, course, and class information"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get query parameters for filtering
        status_filter = request.args.get('status')  # pending, approved, rejected
        is_active = request.args.get('is_active')  # true/false
        course_id = request.args.get('course_id')
        class_id = request.args.get('class_id')

        # Build query
        query = db.session.query(Enrollment).join(Student).join(Parent).join(Class).join(Course)

        # Apply filters
        if status_filter:
            query = query.filter(Enrollment.status == status_filter)
        if is_active is not None:
            query = query.filter(Enrollment.is_active == (is_active.lower() == 'true'))
        if course_id:
            query = query.filter(Course.id == int(course_id))
        if class_id:
            query = query.filter(Class.id == int(class_id))

        enrollments = query.all()

        enrollments_data = []
        for enrollment in enrollments:
            enrollment_data = {
                'id': enrollment.id,
                'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                'status': enrollment.status,
                'is_active': enrollment.is_active,
                'payment_type': enrollment.payment_type,
                'monthly_sessions_attended': enrollment.monthly_sessions_attended,
                'monthly_payment_status': enrollment.monthly_payment_status,
                'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0,
                'debt_sessions': enrollment.debt_sessions or 0,
                'student': {
                    'id': enrollment.student.id,
                    'name': enrollment.student.name,
                    'date_of_birth': enrollment.student.date_of_birth.isoformat() if enrollment.student.date_of_birth else None,
                    'barcode': enrollment.student.barcode
                },
                'parent': {
                    'id': enrollment.student.parent.id,
                    'name': enrollment.student.parent.full_name,
                    'phone': enrollment.student.parent.phone,
                    'email': enrollment.student.parent.email
                },
                'class': {
                    'id': enrollment.class_.id,
                    'name': enrollment.class_.name,
                    'schedule': enrollment.class_.schedule,
                    'day_of_week': enrollment.class_.day_of_week,
                    'start_time': enrollment.class_.start_time.strftime('%H:%M') if enrollment.class_.start_time else None,
                    'end_time': enrollment.class_.end_time.strftime('%H:%M') if enrollment.class_.end_time else None
                },
                'course': {
                    'id': enrollment.class_.course.id,
                    'name': enrollment.class_.course.name,
                    'name_en': enrollment.class_.course.name_en,
                    'name_ar': enrollment.class_.course.name_ar,
                    'pricing_type': enrollment.class_.course.pricing_type,
                    'session_price': float(enrollment.class_.course.session_price) if enrollment.class_.course.session_price else None,
                    'monthly_price': float(enrollment.class_.course.monthly_price) if enrollment.class_.course.monthly_price else None
                }
            }
            enrollments_data.append(enrollment_data)

        return jsonify({
            'success': True,
            'enrollments': enrollments_data,
            'total': len(enrollments_data)
        }), 200

    except Exception as e:
        logger.error(f"Failed to fetch enrollments: {str(e)}")
        return jsonify({'error': f'Failed to fetch enrollments: {str(e)}'}), 500


# === ENROLLMENT APPROVAL SYSTEM ===

@admin_bp.route('/enrollments/pending', methods=['GET'])
@jwt_required()
def get_pending_enrollments():
    """Get all pending enrollments for admin review"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get pending enrollments with related data
        pending_enrollments = db.session.query(Enrollment).join(Student).join(Parent).join(User).join(Class).join(Course).filter(
            Enrollment.status == 'pending'
        ).all()

        enrollments_data = []
        for enrollment in pending_enrollments:
            enrollment_data = {
                'id': enrollment.id,
                'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                'student': {
                    'id': enrollment.student.id,
                    'name': enrollment.student.name,
                    'date_of_birth': enrollment.student.date_of_birth.isoformat() if enrollment.student.date_of_birth else None
                },
                'parent': {
                    'id': enrollment.student.parent.id,
                    'name': enrollment.student.parent.full_name,
                    'phone': enrollment.student.parent.phone,
                    'email': enrollment.student.parent.email
                },
                'user': {
                    'id': enrollment.student.parent.user.id,
                    'full_name': enrollment.student.parent.user.full_name,
                    'email': enrollment.student.parent.user.email,
                    'phone': enrollment.student.parent.user.phone
                },
                'course': {
                    'id': enrollment.class_.course.id,
                    'name': enrollment.class_.course.name,
                    'description': enrollment.class_.course.description,
                    'pricing_type': enrollment.class_.course.pricing_type,
                    'session_price': float(enrollment.class_.course.session_price) if enrollment.class_.course.session_price else None,
                    'monthly_price': float(enrollment.class_.course.monthly_price) if enrollment.class_.course.monthly_price else None
                },
                'class': {
                    'id': enrollment.class_.id,
                    'name': enrollment.class_.name,
                    'schedule': enrollment.class_.schedule,
                    'max_students': enrollment.class_.max_students,
                    'current_enrollments': db.session.query(Enrollment).filter_by(class_id=enrollment.class_.id, status='approved', is_active=True).count()
                },
                'payment_type': enrollment.payment_type,
                'status': enrollment.status
            }
            enrollments_data.append(enrollment_data)

        return jsonify({
            'success': True,
            'enrollments': enrollments_data,
            'total': len(enrollments_data)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch pending enrollments: {str(e)}'}), 500

@admin_bp.route('/enrollments/<int:enrollment_id>/approve', methods=['POST'])
@jwt_required()
def approve_enrollment(enrollment_id):
    """Approve a pending enrollment"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        if enrollment.status != 'pending':
            return jsonify({'error': 'Enrollment is not pending approval'}), 400

        # Check if class has available seats
        current_approved = db.session.query(Enrollment).filter_by(
            class_id=enrollment.class_id, 
            status='approved', 
            is_active=True
        ).count()
        
        if current_approved >= enrollment.class_.max_students:
            return jsonify({'error': 'No available seats in the selected class'}), 409

        # Approve the enrollment
        enrollment.status = 'approved'
        enrollment.is_active = True
        enrollment.approved_by = user_id
        enrollment.approved_at = datetime.utcnow()
        
        # Check if this is a kindergarten enrollment and initialize subscription
        class_obj = Class.query.get(enrollment.class_id)
        if class_obj and class_obj.course:
            course = class_obj.course
            if course.is_kindergarten:
                from datetime import date
                enrollment.is_kindergarten_subscription = True
                enrollment.subscription_status = 'pending'  # Payment pending
                # Subscription dates will be set when first payment is made
                enrollment.subscription_amount = course.monthly_price or course.price

        db.session.commit()

        # Auto-generate mobile credentials if eligible
        try:
            credentials_result = auto_generate_mobile_credentials_if_eligible(enrollment.student_id)
            if credentials_result.get('generated'):
                print(f"✅ [ENROLLMENT_APPROVED] Auto-generated mobile credentials for student {enrollment.student_id}")
        except Exception as cred_error:
            print(f"⚠️ [ENROLLMENT_APPROVED] Failed to auto-generate credentials: {str(cred_error)}")
            # Don't fail the enrollment approval if credential generation fails

        # Create notification for the user
        notification = Notification(
            user_id=enrollment.student.parent.user_id,
            title='Enrollment Approved',
            message=f'Your enrollment for {enrollment.class_.course.name} has been approved! Please contact the academy for further details.',
            type='enrollment',
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()

        response_data = {
            'success': True,
            'message': 'Enrollment approved successfully',
            'enrollment': {
                'id': enrollment.id,
                'status': enrollment.status,
                'approved_at': enrollment.approved_at.isoformat() if enrollment.approved_at else None,
                'approved_by': user.full_name
            }
        }
        
        # Include credential generation info if applicable
        if credentials_result.get('generated'):
            response_data['mobile_credentials_generated'] = True
            if credentials_result.get('student_credentials'):
                response_data['student_credentials'] = credentials_result['student_credentials']
            if credentials_result.get('parent_credentials'):
                response_data['parent_credentials'] = credentials_result['parent_credentials']

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to approve enrollment: {str(e)}'}), 500

@admin_bp.route('/enrollments/<int:enrollment_id>/reject', methods=['POST'])
@jwt_required()
def reject_enrollment(enrollment_id):
    """Reject a pending enrollment"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    rejection_reason = data.get('reason', 'No reason provided')

    try:
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        if enrollment.status != 'pending':
            return jsonify({'error': 'Enrollment is not pending approval'}), 400

        # Reject the enrollment
        enrollment.status = 'rejected'
        enrollment.is_active = False
        enrollment.approved_by = user_id
        enrollment.approved_at = datetime.utcnow()
        enrollment.rejection_reason = rejection_reason

        db.session.commit()

        # Create notification for the user
        notification = Notification(
            user_id=enrollment.student.parent.user_id,
            title='Enrollment Rejected',
            message=f'Your enrollment for {enrollment.class_.course.name} has been rejected. Reason: {rejection_reason}',
            type='enrollment',
            is_read=False
        )
        db.session.add(notification)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Enrollment rejected successfully',
            'enrollment': {
                'id': enrollment.id,
                'status': enrollment.status,
                'rejected_at': datetime.utcnow().isoformat(),
                'rejected_by': user.full_name,
                'rejection_reason': rejection_reason
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to reject enrollment: {str(e)}'}), 500

@admin_bp.route('/students', methods=['GET'])
@jwt_required()
def get_students():
    """Get all students with comprehensive information (Admin only) - Optimized with pagination"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get pagination parameters
        page = int(request.args.get('page', 1))
        get_all = request.args.get('all', 'false').lower() == 'true'

        if get_all:
            # Return all students without pagination
            per_page = None
            offset = 0
        else:
            per_page = min(int(request.args.get('per_page', 200)), 500)  # Increased default to 200, max 500 per page
            offset = (page - 1) * per_page

        # Get total count for pagination
        total_students = Student.query.count()

        if get_all:
            # Get all students without limit
            students_query = db.session.query(
                Student,
                Parent,
                User
            ).outerjoin(
                Parent, Student.parent_id == Parent.id
            ).outerjoin(
                User, Parent.user_id == User.id
            ).all()
        else:
            # Use paginated query for students with basic info
            students_query = db.session.query(
                Student,
                Parent,
                User
            ).outerjoin(
                Parent, Student.parent_id == Parent.id
            ).outerjoin(
                User, Parent.user_id == User.id
            ).offset(offset).limit(per_page).all()

        students_data = []
        students_with_mobile = 0
        students_with_parents = 0

        # Get enrollment data for all students in the current query
        student_ids = [student.id for student, _, _ in students_query]
        if student_ids:
            # Bulk query for enrollments
            enrollments_query = db.session.query(
                Enrollment.student_id,
                Enrollment.enrollment_date,
                Enrollment.monthly_sessions_attended,
                Class.name.label('class_name'),
                Class.day_of_week,
                Class.start_time,
                Class.end_time,
                Course.id.label('course_id'),
                Course.name.label('course_name'),
                Course.course_type.label('course_type')
            ).join(
                Class, Enrollment.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).filter(
                Enrollment.student_id.in_(student_ids),
                Enrollment.is_active == True
            ).all()

            # Group enrollments by student_id
            enrollments_by_student = {}
            for row in enrollments_query:
                if row.student_id not in enrollments_by_student:
                    enrollments_by_student[row.student_id] = []
                enrollments_by_student[row.student_id].append({
                    'id': row.course_id,
                    'name': row.course_name,
                    'pricing_type': row.course_type or 'session',  # Map course_type to pricing_type for API response
                    'monthly_sessions_attended': row.monthly_sessions_attended or 0,
                    'class_name': row.class_name,
                    'day_of_week': row.day_of_week,
                    'start_time': row.start_time.strftime('%H:%M') if row.start_time else None,
                    'end_time': row.end_time.strftime('%H:%M') if row.end_time else None,
                    'enrollment_date': row.enrollment_date.isoformat() if row.enrollment_date else None
                })

            # Bulk query for attendance stats
            attendance_query = db.session.query(
                Attendance.student_id,
                Attendance.status,
                db.func.count(Attendance.id).label('count')
            ).filter(
                Attendance.student_id.in_(student_ids)
            ).group_by(
                Attendance.student_id,
                Attendance.status
            ).all()

            # Group attendance stats by student_id
            attendance_by_student = {}
            for student_id, status, count in attendance_query:
                if student_id not in attendance_by_student:
                    attendance_by_student[student_id] = {'present': 0, 'absent': 0, 'late': 0, 'total': 0}
                attendance_by_student[student_id][status] = count
                attendance_by_student[student_id]['total'] += count

        for student, parent, parent_user in students_query:
            # Get enrollments for this student
            student_enrollments = enrollments_by_student.get(student.id, [])
            enrollment_count = len(student_enrollments)

            # Get attendance statistics
            student_attendance = attendance_by_student.get(student.id, {'present': 0, 'absent': 0, 'late': 0, 'total': 0})
            attendance_rate = (student_attendance['present'] / student_attendance['total'] * 100) if student_attendance['total'] > 0 else 0

            # Mobile app status
            if student.mobile_username and student.mobile_app_enabled:
                students_with_mobile += 1

            if parent:
                students_with_parents += 1

            # Get recent attendance records (last 5)
            recent_attendance_query = db.session.query(
                Attendance, Class, Course
            ).join(
                Class, Attendance.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).filter(
                Attendance.student_id == student.id
            ).order_by(
                Attendance.attendance_date.desc()
            ).limit(5).all()
            
            recent_attendance = []
            for attendance, class_info, course in recent_attendance_query:
                recent_attendance.append({
                    'id': attendance.id,
                    'status': attendance.status,
                    'attendance_date': attendance.attendance_date.isoformat() if attendance.attendance_date else None,
                    'marked_at': attendance.marked_at.isoformat() if attendance.marked_at else None,
                    'class_name': class_info.name,
                    'course_name': course.name
                })

            # Calculate payment statistics
            total_paid = 0
            sessions_attended = student_attendance['present'] + student_attendance['late']  # Count present and late as attended
            
            # Calculate total paid based on enrollments and attendance
            for enrollment_data in student_enrollments:
                if enrollment_data['pricing_type'] == 'monthly':
                    # For monthly pricing, calculate based on completed cycles
                    if enrollment_data.get('monthly_sessions_attended', 0) >= 4:
                        completed_cycles = enrollment_data['monthly_sessions_attended'] // 4
                        # Note: We don't have course price in this context, so we skip the calculation
                        # total_paid += completed_cycles * float(course.price)
                else:
                    # For session-based pricing, we would need more detailed data
                    # This calculation is simplified and may need adjustment
                    pass

            student_data = {
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'age': None,
                'parent': {
                    'id': parent.id if parent else None,
                    'name': parent.full_name if parent else 'N/A',
                    'email': parent.email if parent else 'N/A',
                    'phone': parent_user.phone if parent_user else (parent.phone if parent else 'N/A'),  # Load phone from users table first
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
                    'total_enrollments': enrollment_count,
                    'active_enrollments': enrollment_count,
                    'courses': student_enrollments,
                    'total_debt': float(student.total_debt) if student.total_debt else 0.0
                },
                'attendance_stats': {
                    'total_records': student_attendance['total'],
                    'present_count': student_attendance['present'],
                    'absent_count': student_attendance['absent'],
                    'late_count': student_attendance['late'],
                    'attendance_rate': round(attendance_rate, 1)
                },
                'payment_stats': {
                    'total_paid': round(float(total_paid), 2),
                    'sessions_attended': sessions_attended,
                    'total_debt': float(student.total_debt) if student.total_debt else 0.0
                },
                'recent_attendance': recent_attendance,
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

        # Calculate pagination info
        if get_all:
            pagination_info = {
                'page': 1,
                'per_page': len(students_data),
                'total_students': total_students,
                'total_pages': 1,
                'has_next': False,
                'has_prev': False,
                'all_loaded': True
            }
        else:
            total_pages = (total_students + per_page - 1) // per_page
            pagination_info = {
                'page': page,
                'per_page': per_page,
                'total_students': total_students,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_prev': page > 1,
                'all_loaded': False
            }

        return jsonify({
            'students': students_data,
            'pagination': pagination_info,
            'summary': {
                'total_students': total_students,
                'students_with_parents': students_with_parents,
                'students_with_mobile': students_with_mobile,
                'students_enrolled': sum(1 for s in students_data if s['status']['is_enrolled']),
                'orphaned_students': len(students_data) - students_with_parents
            }
        }), 200

    except Exception as e:
        logger.error(f"Error fetching students: {str(e)}")
        return jsonify({'error': 'Failed to fetch students data'}), 500

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (Admin only) - With pagination"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get pagination parameters
    page = int(request.args.get('page', 1))
    get_all = request.args.get('all', 'false').lower() == 'true'

    if get_all:
        # Return all users without pagination
        per_page = None
        offset = 0
    else:
        per_page = min(int(request.args.get('per_page', 200)), 1000)  # Increased default to 200, max 1000 per page
        offset = (page - 1) * per_page

    # Get total count for pagination
    total_users = User.query.count()

    if get_all:
        # Get all users without limit
        users = User.query.all()
    else:
        # Paginated query
        users = User.query.offset(offset).limit(per_page).all()

    users_data = []
    for u in users:
        users_data.append({
            'id': u.id,
            'email': u.email,
            'full_name': u.full_name,
            'phone': u.phone,
            'role': u.role,
            'email_verified': u.email_verified,
            'created_at': u.created_at.isoformat() if u.created_at else None
        })

    total_pages = (total_users + per_page - 1) // per_page if per_page else 1

    if get_all:
        pagination_info = {
            'page': 1,
            'per_page': len(users_data),
            'total_users': total_users,
            'total_pages': 1,
            'has_next': False,
            'has_prev': False,
            'all_loaded': True
        }
    else:
        pagination_info = {
            'page': page,
            'per_page': per_page,
            'total_users': total_users,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1,
            'all_loaded': False
        }

    return jsonify({
        'users': users_data,
        'pagination': pagination_info
    }), 200

@admin_bp.route('/students', methods=['POST'])
@jwt_required()
def create_student():
    """Create a new student (Admin only)"""
    user_id = int(get_jwt_identity())
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

    # Get user info if student has a user account
    user_email = student.user.email if student.user else None
    user_phone = student.user.phone if student.user else None

    return jsonify({
        'success': True,
        'message': 'Student created successfully',
        'student': {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'email': user_email,
            'phone': user_phone,
            'mobile_app_enabled': student.mobile_app_enabled
        }
    }), 201
    """Add a student manually (Admin only) with optional email for mobile credentials"""
    user_id = int(get_jwt_identity())
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
    existing_parent_user = User.query.filter_by(email=parent_email).first()
    existing_parent = None
    if existing_parent_user:
        existing_parent = Parent.query.filter_by(user_id=existing_parent_user.id).first()

    if existing_parent:
        parent_user = existing_parent_user
        parent = existing_parent
    else:
        # Create new parent user
        parent_user = User(
            email=parent_email,
            password_hash=hash_password(secrets.token_hex(16)),  # Random password, they'll use mobile app
            full_name=parent_name,
            phone=parent_phone,
            email_verified=True  # Manually added, assume verified
        )
        db.session.add(parent_user)
        db.session.flush()

        # Create parent record
        parent = Parent(
            user_id=parent_user.id,
            full_name=parent_name,
            phone=parent_phone,
            email=parent_email
        )
        db.session.add(parent)
        db.session.flush()

    # Create student
    try:
        dob = datetime.strptime(data['student_dob'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    student = Student(
        parent_id=parent.id,
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
        user_id=parent_user.id,
        parent_id=parent.id,
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
    parent.mobile_password_plain = parent_password  # Store unhashed password
    parent.mobile_app_enabled = True

    # Update student with mobile credentials
    student.mobile_username = student_username
    student.mobile_password_hash = hash_password(student_password)
    student.mobile_password_plain = student_password  # Store unhashed password
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
    user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
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
    """Get all courses (Admin only) - Optimized with filtering"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Check for currently studying filter
    currently_studying = request.args.get('currently_studying', 'false').lower() == 'true'
    
    if currently_studying:
        # Filter courses that have active enrollments
        courses = db.session.query(Course).join(
            Class, Course.id == Class.course_id
        ).join(
            Enrollment, Class.id == Enrollment.class_id
        ).filter(
            Enrollment.is_active == True
        ).distinct().all()
    else:
        courses = Course.query.all()

    # Get all course IDs for batch query
    course_ids = [course.id for course in courses]

    # Batch query for registration counts
    registration_counts = {}
    if course_ids:
        counts_query = db.session.query(
            Registration.course_id,
            db.func.count(Registration.id).label('count')
        ).filter(
            Registration.course_id.in_(course_ids),
            Registration.status == 'approved'
        ).group_by(Registration.course_id).all()

        registration_counts = {course_id: count for course_id, count in counts_query}

    courses_data = []
    for course in courses:
        # Get registration count from batch query
        registration_count = registration_counts.get(course.id, 0)
        available_seats = max(0, course.max_students - registration_count)

        # Build pricing information
        pricing_info = {
            'pricing_type': course.course_type,  # Use course_type as pricing_type for now
            'currency': 'DA',  # Algerian Dinar
        }

        if course.course_type == 'session':
            pricing_info.update({
                'session_price': float(course.session_price) if course.session_price else float(course.price),
                'session_duration_hours': course.session_duration,
                'display_price': f"{float(course.session_price) if course.session_price else float(course.price)} DA/session ({course.session_duration}h)"
            })
        elif course.course_type == 'monthly':
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
    user_id = int(get_jwt_identity())
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
    """Delete a course with comprehensive cascade deletion (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    try:
        related_deletions = []
        
        # STEP 1: Get all class IDs for this course (we'll need them for deletion)
        class_ids = [cls.id for cls in Class.query.filter_by(course_id=course_id).all()]
        
        # STEP 2: Delete attendances for all classes in this course
        if class_ids:
            attendance_count = Attendance.query.filter(Attendance.class_id.in_(class_ids)).delete(synchronize_session=False)
            if attendance_count > 0:
                related_deletions.append(f"{attendance_count} attendance records")

        # STEP 3: Delete enrollments for all classes in this course
        if class_ids:
            enrollment_count = Enrollment.query.filter(Enrollment.class_id.in_(class_ids)).delete(synchronize_session=False)
            if enrollment_count > 0:
                related_deletions.append(f"{enrollment_count} enrollments")

        # STEP 4: Delete all section enrollments for course sections
        section_ids = [sec.id for sec in CourseSection.query.filter_by(course_id=course_id).all()]
        if section_ids:
            section_enrollment_count = SectionEnrollment.query.filter(SectionEnrollment.section_id.in_(section_ids)).delete(synchronize_session=False)
            if section_enrollment_count > 0:
                related_deletions.append(f"{section_enrollment_count} section enrollments")

        # STEP 5: Delete all course sections for this course
        course_section_count = CourseSection.query.filter_by(course_id=course_id).delete(synchronize_session=False)
        if course_section_count > 0:
            related_deletions.append(f"{course_section_count} course sections")

        # STEP 6: Delete all classes for this course
        class_count = Class.query.filter_by(course_id=course_id).delete(synchronize_session=False)
        if class_count > 0:
            related_deletions.append(f"{class_count} classes")

        # STEP 7: Delete all registrations for this course
        registration_count = Registration.query.filter_by(course_id=course_id).delete(synchronize_session=False)
        if registration_count > 0:
            related_deletions.append(f"{registration_count} registrations")

        # STEP 8: Delete notifications related to this course
        try:
            notification_count = Notification.query.filter(
                db.or_(
                    Notification.message.contains(f"course {course_id}"),
                    Notification.message.contains(course.name) if course.name else False,
                    Notification.message_en.contains(course.name) if course.name else False,
                    Notification.message_ar.contains(course.name) if course.name else False
                )
            ).delete(synchronize_session=False)
            if notification_count > 0:
                related_deletions.append(f"{notification_count} notifications")
        except Exception as notif_error:
            # Continue even if notification deletion fails
            logger.warning(f"Could not delete notifications for course {course_id}: {str(notif_error)}")

        # STEP 9: Finally delete the course itself
        db.session.delete(course)
        db.session.commit()
        
        # Log successful deletion
        logger.info(f"Successfully deleted course ID {course_id} by user {user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'Course and all related data deleted successfully',
            'deleted_records': related_deletions,
            'course_id': course_id,
            'deleted_by': user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting course {course_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete course and related data',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@admin_bp.route('/classes/<int:class_id>', methods=['DELETE'])
@jwt_required()
def delete_class(class_id):
    """Delete a class/section with comprehensive cascade deletion (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    class_obj = Class.query.get(class_id)
    if not class_obj:
        return jsonify({'error': 'Class not found'}), 404

    try:
        related_deletions = []
        
        # 1. Delete all attendances for this class
        attendance_count = Attendance.query.filter_by(class_id=class_id).delete(synchronize_session=False)
        if attendance_count > 0:
            related_deletions.append(f"{attendance_count} attendance records")

        # 2. Delete all enrollments for this class
        enrollment_count = Enrollment.query.filter_by(class_id=class_id).delete(synchronize_session=False)
        if enrollment_count > 0:
            related_deletions.append(f"{enrollment_count} enrollments")

        # 3. Delete the class itself
        db.session.delete(class_obj)
        db.session.commit()
        
        logger.info(f"Successfully deleted class ID {class_id} by user {user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'Class and all related data deleted successfully',
            'deleted_records': related_deletions,
            'class_id': class_id,
            'deleted_by': user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting class {class_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete class and related data',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@admin_bp.route('/course-sections/<int:section_id>', methods=['DELETE'])
@jwt_required()
def delete_course_section(section_id):
    """Delete a course section with comprehensive cascade deletion (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    section = CourseSection.query.get(section_id)
    if not section:
        return jsonify({'error': 'Course section not found'}), 404

    try:
        related_deletions = []
        
        # 1. Delete all section enrollments for this section
        section_enrollment_count = SectionEnrollment.query.filter_by(section_id=section_id).delete(synchronize_session=False)
        if section_enrollment_count > 0:
            related_deletions.append(f"{section_enrollment_count} section enrollments")

        # 2. Delete the section itself
        db.session.delete(section)
        db.session.commit()
        
        logger.info(f"Successfully deleted course section ID {section_id} by user {user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'Course section and all related data deleted successfully',
            'deleted_records': related_deletions,
            'section_id': section_id,
            'deleted_by': user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting course section {section_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete course section and related data',
            'details': str(e),
            'type': type(e).__name__
        }), 500

# ===== ATTENDANCE MANAGEMENT ROUTES =====

@admin_bp.route('/attendance/student/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_attendance(student_id):
    """Get attendance records for a specific student (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # Get attendance records
    attendance_records = Attendance.query.filter_by(student_id=student_id)\
        .order_by(Attendance.attendance_date.desc()).all()

    # Build attendance data
    attendance_data = []
    total_present = 0
    total_records = len(attendance_records)

    for record in attendance_records:
        class_info = Class.query.get(record.class_id)
        course = class_info.course if class_info else None

        if record.status == 'present':
            total_present += 1

        attendance_data.append({
            'id': record.id,
            'date': record.attendance_date.isoformat() if record.attendance_date else None,
            'status': record.status,
            'class': {
                'id': class_info.id if class_info else None,
                'name': class_info.name if class_info else 'Unknown Class'
            },
            'course': {
                'id': course.id if course else None,
                'name': course.name if course else 'Unknown Course'
            },
            'marked_by': record.marked_by,
            'notes': record.notes
        })

    attendance_rate = round((total_present / total_records * 100), 1) if total_records > 0 else 0

    return jsonify({
        'student': {
            'id': student.id,
            'name': student.name
        },
        'attendance_summary': {
            'total_records': total_records,
            'present_count': total_present,
            'absent_count': total_records - total_present,
            'attendance_rate': attendance_rate
        },
        'attendance_records': attendance_data
    }), 200

@admin_bp.route('/attendance/check-window', methods=['POST'])
@jwt_required()
def check_attendance_window():
    """Check if attendance can be marked within time window (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.json
    class_id = data.get('class_id')
    
    if not class_id:
        return jsonify({'error': 'class_id is required'}), 400
    
    # Get class information
    class_info = Class.query.get(class_id)
    if not class_info:
        return jsonify({'error': 'Class not found'}), 404
        
    # Check time window
    is_allowed, message, warning_needed = check_attendance_time_window(class_info)
    
    # Check for unpaid debts for this student if student_id is provided
    student_id = data.get('student_id')
    debt_warning = None
    has_unpaid_debt = False
    
    if student_id:
        enrollment = Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first()
        if enrollment and enrollment.total_debt and enrollment.total_debt > 0:
            has_unpaid_debt = True
            debt_warning = f"⚠️ This student has {float(enrollment.total_debt)} DA in unpaid debts. Consider clearing debts before marking attendance."
    
    return jsonify({
        'is_allowed': is_allowed,
        'message': message,
        'warning_needed': warning_needed,
        'can_force': user.role == 'admin',  # Admins can always force
        'debt_warning': debt_warning,
        'has_unpaid_debt': has_unpaid_debt,
        'class_info': {
            'id': class_info.id,
            'name': class_info.name,
            'day_of_week': class_info.day_of_week,
            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBD',
            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBD'
        }
    }), 200

@admin_bp.route('/attendance/mark', methods=['POST'])
@jwt_required()
def mark_attendance():
    """Mark attendance for a student (Admin only) with comprehensive logging"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Start building log details
    operation_start_time = datetime.now()
    log_details = {
        'operation': 'mark_attendance',
        'start_time': operation_start_time.isoformat(),
        'admin_user_id': user_id,
        'admin_username': user.email if user else 'unknown',
        'request_data': request.get_json()
    }

    if user.role != 'admin':
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'insufficient_permissions',
            'user_role': user.role if user else 'no_user'
        }, user_id, False, 'Admin access required')
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_id = data.get('student_id')
    class_id = data.get('class_id')
    status = data.get('status', 'present')
    add_as_absent = data.get('add_as_absent', False)
    force_attendance = data.get('force', False) or data.get('force_attendance', False)

    # Update log details with parsed data
    log_details.update({
        'student_id': student_id,
        'class_id': class_id,
        'status': status,
        'add_as_absent': add_as_absent,
        'force_attendance': force_attendance
    })

    if not student_id or not class_id:
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'missing_required_fields',
            'missing_fields': [f for f in ['student_id', 'class_id'] if not data.get(f)]
        }, user_id, False, 'Missing required fields')
        return jsonify({'error': 'student_id and class_id are required'}), 400

    if status not in ['present', 'absent', 'late']:
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'invalid_status',
            'provided_status': status,
            'valid_statuses': ['present', 'absent', 'late']
        }, user_id, False, 'Invalid status')
        return jsonify({'error': 'Invalid status. Must be present, absent, or late'}), 400

    student = Student.query.get(student_id)
    if not student:
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'student_not_found'
        }, user_id, False, 'Student not found')
        return jsonify({'error': 'Student not found'}), 404

    class_info = Class.query.get(class_id)
    if not class_info:
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'class_not_found'
        }, user_id, False, 'Class not found')
        return jsonify({'error': 'Class not found'}), 404

    # Get course information for course_type
    course = Course.query.get(class_info.course_id)
    if not course:
        log_attendance_operation('MARK_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'course_not_found'
        }, user_id, False, 'Course not found')
        return jsonify({'error': 'Course not found'}), 404
    
    course_type = course.course_type or 'session'  # Default to session if not specified
    attendance_date = get_algerian_date()  # Use Algerian date for consistency

    # Get enrollment for debt check
    enrollment = Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first()

    # Check for unpaid debts before marking attendance
    has_unpaid_debts = (student.total_debt and student.total_debt > 0) or (enrollment.total_debt if enrollment and enrollment.total_debt else 0 > 0)
    
    if has_unpaid_debts and not force_attendance:
        debt_warning_message = f"This student has unpaid debts. Total debt: {float(student.total_debt or 0):.2f} DA. Are they cleared or not yet? To clear previous debts (if there was), please process payment first."
        
        log_details.update({
            'debt_check': {
                'has_unpaid_debts': True,
                'student_debt': float(student.total_debt or 0),
                'enrollment_debt': float(enrollment.total_debt or 0) if enrollment else 0,
                'warning_shown': True
            }
        })
        
        return jsonify({
            'error': 'Unpaid debts detected',
            'message': debt_warning_message,
            'warning_needed': True,
            'can_force': True,
            'debt_info': {
                'student_debt': float(student.total_debt or 0),
                'enrollment_debt': float(enrollment.total_debt or 0) if enrollment else 0,
                'has_unpaid_debts': True
            },
            'retry_data': {
                'student_id': student_id,
                'class_id': class_id,
                'status': status,
                'course_type': course_type,
                'date': attendance_date.isoformat(),
                'add_as_absent': add_as_absent,
                'force': True
            }
        }), 400

    # Add student and class info to log
    log_details.update({
        'student_name': student.name,
        'student_id': student.id,
        'class_name': class_info.name,
        'course_name': course.name,
        'course_type': course_type,
        'attendance_date': attendance_date.isoformat(),
        'class_schedule': {
            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time is not None else 'TBD',
            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time is not None else 'TBD',
            'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_info.day_of_week] if class_info.day_of_week is not None and 0 <= class_info.day_of_week < 7 else 'TBD'
        }
    })
    
    # Check time restrictions unless admin explicitly forces it
    if not force_attendance:
        is_allowed, time_message, warning_needed = check_attendance_time_window(class_info)
        
        log_details.update({
            'time_check': {
                'is_allowed': is_allowed,
                'message': time_message,
                'warning_needed': warning_needed,
                'current_time': datetime.now().strftime('%H:%M'),
                'check_performed_at': datetime.now().isoformat()
            }
        })
        
        if not is_allowed:
            # For admin users, provide a more lenient approach
            if user.role == 'admin':
                # Check if this is a simple time window issue that can be auto-resolved
                auto_force = data.get('auto_force', True)  # Default to auto-force for admins
                
                if auto_force and warning_needed:
                    # Automatically force the attendance for admin users when it's just a time window issue
                    logger.info(f"Auto-forcing attendance for admin user {user.email} due to time window - {time_message}")
                    force_attendance = True
                    log_details['time_check'] = {
                        'auto_forced': True,
                        'admin_override': True,
                        'original_message': time_message,
                        'message': 'Time restrictions automatically bypassed for admin'
                    }
                else:
                    # Still show the error but make it easy to retry
                    log_attendance_operation('MARK_ATTENDANCE_TIME_RESTRICTION', log_details, user_id, False, 
                                           f'Time restriction: {time_message}')
                    return jsonify({
                        'error': 'Time restriction violation',
                        'message': time_message,
                        'warning_needed': warning_needed,
                        'auto_retry_with_force': True,  # Flag for frontend to automatically retry
                        'can_force': True,  # Indicates admin can override
                        'current_time': datetime.now().strftime('%H:%M'),
                        'class_schedule': {
                            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBD',
                            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBD',
                            'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_info.day_of_week] if class_info.day_of_week is not None and 0 <= class_info.day_of_week < 7 else 'TBD'
                        },
                        'retry_data': {
                            'student_id': student_id,
                            'class_id': class_id, 
                            'status': status,
                            'course_type': course_type,
                            'date': attendance_date.isoformat(),
                            'add_as_absent': add_as_absent,
                            'force': True  # Include force parameter for retry
                        }
                    }), 400
            else:
                # Non-admin users get strict time restrictions
                log_attendance_operation('MARK_ATTENDANCE_TIME_RESTRICTION', log_details, user_id, False, 
                                         f'Time restriction: {time_message}')
                return jsonify({
                    'error': 'Time restriction violation',
                    'message': time_message,
                    'warning_needed': warning_needed,
                    'auto_retry_with_force': False,  # Non-admins cannot force
                    'can_force': False,
                    'current_time': datetime.now().strftime('%H:%M'),
                    'class_schedule': {
                        'start_time': class_info.start_time.strftime('%H:%M'),
                        'end_time': class_info.end_time.strftime('%H:%M'),
                        'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_info.day_of_week]
                    }
                }), 403  # Forbidden for non-admin users
    
    if force_attendance or log_details.get('time_check', {}).get('auto_forced'):
        log_details['time_check'] = log_details.get('time_check', {})
        log_details['time_check'].update({
            'forced': True,
            'admin_override': True,
            'message': log_details['time_check'].get('message', 'Time restrictions bypassed by admin')
        })

    try:
        # Check if attendance already exists for today
        existing_attendance = Attendance.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            attendance_date=attendance_date
        ).first()

        operation_type = 'update' if existing_attendance else 'create'
        log_details['operation_type'] = operation_type

        if existing_attendance:
            # Update existing attendance
            old_status = existing_attendance.status
            old_marked_by = existing_attendance.marked_by
            old_payment_status = existing_attendance.payment_status
            
            existing_attendance.status = status
            existing_attendance.marked_by = user.id
            message = 'Attendance updated successfully'
            
            log_details.update({
                'existing_record': {
                    'old_status': old_status,
                    'old_marked_by': old_marked_by,
                    'old_payment_status': old_payment_status,
                    'original_date': existing_attendance.attendance_date.isoformat() if existing_attendance.attendance_date else None,
                    'original_marked_at': existing_attendance.marked_at.isoformat() if existing_attendance.marked_at else None
                },
                'changes': {
                    'status_changed': old_status != status,
                    'marker_changed': old_marked_by != user.id
                }
            })
        else:
            # Create new attendance record
            attendance = Attendance(
                student_id=student_id,
                class_id=class_id,
                attendance_date=attendance_date,
                status=status,
                marked_by=user.id
            )
            db.session.add(attendance)
            message = 'Attendance marked successfully'
            
            log_details['new_record'] = {
                'created_at': datetime.now().isoformat(),
                'attendance_date': attendance_date.isoformat()
            }

        # Update monthly session count for monthly payment types and handle payment tracking
        enrollment = Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first()
        monthly_progress = None
        payment_due = False
        cycle_complete = False
        payment_required = False
        course_price = Decimal('0')

        if enrollment:
            # Get course price for payment calculations
            course = enrollment.class_.course if enrollment.class_ else None
            if course:
                course_price = Decimal(str(course.price)) if course.price else Decimal('0')

            log_details['enrollment'] = {
                'exists': True,
                'payment_type': enrollment.payment_type,
                'current_sessions': enrollment.monthly_sessions_attended or 0,
                'payment_status': enrollment.monthly_payment_status,
                'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0,
                'course_price': course_price
            }

            # Handle payment tracking based on payment type
            if enrollment.payment_type == 'session':
                # For session-based payments, mark attendance first, payment status will be updated separately
                # Default to 'unpaid' - will be updated when payment is confirmed
                if existing_attendance:
                    # Check if status is changing from absent to present (only then add debt)
                    old_status = existing_attendance.status
                    old_payment_status = existing_attendance.payment_status
                    status_changed_to_present = (old_status != 'present' and status == 'present')
                    
                    # Update payment status if not already paid/in debt
                    if existing_attendance.payment_status not in ['paid', 'debt']:
                        existing_attendance.payment_status = 'unpaid'
                        
                    # Add to debt ONLY if:
                    # 1. Status changed from absent to present AND payment status is unpaid, OR
                    # 2. Payment status changed from paid to unpaid for existing present attendance
                    should_add_debt = (status_changed_to_present and existing_attendance.payment_status == 'unpaid') or (status == 'present' and old_payment_status == 'paid' and existing_attendance.payment_status == 'unpaid')
                    
                    if should_add_debt:
                        enrollment.total_debt = (enrollment.total_debt or 0) + course_price
                        enrollment.debt_sessions = (enrollment.debt_sessions or 0) + 1
                        
                        # Also update student table
                        student.total_debt = (student.total_debt or 0) + course_price
                else:
                    attendance.payment_status = 'unpaid'
                    # Add to debt immediately for unpaid session attendance (only if present)
                    if status == 'present':
                        enrollment.total_debt = (enrollment.total_debt or 0) + course_price
                        enrollment.debt_sessions = (enrollment.debt_sessions or 0) + 1
                        
                        # Also update student table
                        student.total_debt = (student.total_debt or 0) + course_price

                log_details['payment_tracking'] = {
                    'payment_type': 'session',
                    'payment_status': 'unpaid',
                    'debt_added': course_price if status == 'present' else 0,
                    'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0,
                    'note': 'Debt immediately added for unpaid session attendance'
                }

            elif enrollment.payment_type == 'monthly':
                # For monthly payments, count sessions but only require payment after 4 sessions
                session_should_count = False
                
                if existing_attendance:
                    # For existing attendance, only count if status changes to present/absent from a non-counting status
                    old_status = existing_attendance.status
                    old_counts = old_status in ['present', 'absent']
                    new_counts = status in ['present', 'absent']
                    
                    # Only increment if we're changing to a status that counts and it didn't count before
                    if new_counts and not old_counts:
                        session_should_count = True
                    # If changing from counting status to another counting status, don't increment
                    # If changing from counting to non-counting, we might need to decrement (but we won't for now)
                else:
                    # New attendance - count if status is present or absent
                    if status in ['present', 'absent']:
                        session_should_count = True
                
                if session_should_count:
                    old_sessions = enrollment.monthly_sessions_attended or 0
                    enrollment.monthly_sessions_attended = old_sessions + 1
                    monthly_progress = enrollment.monthly_sessions_attended
                    
                    log_details['enrollment']['session_update'] = {
                        'old_count': old_sessions,
                        'new_count': monthly_progress,
                        'status_counted': status,
                        'reason': 'existing_attendance_status_change' if existing_attendance else 'new_attendance'
                    }
                else:
                    # Don't increment, just use current count
                    monthly_progress = enrollment.monthly_sessions_attended or 0
                    
                    log_details['enrollment']['session_update'] = {
                        'count_unchanged': monthly_progress,
                        'status': status,
                        'reason': 'no_increment_needed'
                    }

                # Only require payment when cycle is complete (4/4 sessions)
                sessions_attended = enrollment.monthly_sessions_attended or 0
                if sessions_attended >= 4:
                    cycle_complete = True
                    # Only ask for payment if cycle is complete AND not already paid
                    if enrollment.monthly_payment_status != 'paid':
                        payment_required = True
                        payment_due = True
                else:
                    # Less than 4 sessions - no payment required yet
                    payment_required = False
                    payment_due = False
                    cycle_complete = False

                log_details['enrollment']['cycle_info'] = {
                    'cycle_complete': cycle_complete,
                    'payment_due': payment_due,
                    'payment_required': payment_required,
                    'sessions_in_cycle': sessions_attended,
                    'note': 'Monthly payment only required after 4 sessions (cycle complete)'
                }
        else:
            log_details['enrollment'] = {'exists': False}

        # Commit to database
        commit_time = datetime.now()
        db.session.commit()
        log_details['database_commit_time'] = commit_time.isoformat()

        # Send push notifications to student and parent
        notification_results = []
        try:
            from push_notifications import PushNotificationService
            notification_result = PushNotificationService.send_attendance_notification(
                student_id=student_id,
                attendance_status=status,
                class_name=class_info.name,
                marked_by_admin=True
            )
            notification_results.append({
                'type': 'attendance_notification',
                'success': True,
                'result': notification_result
            })
            
            # Send payment due notification if applicable
            if payment_due and cycle_complete:
                payment_notification_result = PushNotificationService.send_payment_due_notification(
                    student_id=student_id,
                    course_name=class_info.course.name if class_info.course else class_info.name,
                    sessions_completed=enrollment.monthly_sessions_attended
                )
                notification_results.append({
                    'type': 'payment_due_notification',
                    'success': True,
                    'result': payment_notification_result
                })
                
        except Exception as e:
            notification_error = f"Failed to send push notification: {e}"
            logger.error(notification_error)
            notification_results.append({
                'type': 'notification_error',
                'success': False,
                'error': str(e)
            })

        # Prepare response data
        response_data = {
            'message': message,
            'attendance': {
                'student_id': student_id,
                'class_id': class_id,
                'status': status,
                'date': attendance_date.isoformat(),
                'marked_by': user_id,
                'marked_at': datetime.now().isoformat()
            }
        }

        # Add payment information if enrollment exists
        if enrollment:
            payment_info = {
                'payment_type': enrollment.payment_type,
                'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0,
                'debt_sessions': enrollment.debt_sessions or 0
            }

            if enrollment.payment_type == 'session':
                payment_info.update({
                    'payment_status': existing_attendance.payment_status if existing_attendance else attendance.payment_status,
                    'session_price': course_price,
                    'note': 'Payment can be marked as paid or not paid separately'
                })
            elif enrollment.payment_type == 'monthly':
                payment_info.update({
                    'monthly_sessions_attended': enrollment.monthly_sessions_attended,
                    'monthly_payment_status': enrollment.monthly_payment_status,
                    'payment_required': payment_required,
                    'payment_due': payment_due,
                    'cycle_complete': cycle_complete
                })

            response_data['payment_info'] = payment_info

        # Add monthly course progress info if applicable
        if enrollment and enrollment.payment_type == 'monthly':
            # Ensure monthly_progress always has a valid value
            if monthly_progress is None:
                monthly_progress = enrollment.monthly_sessions_attended or 0
                
            response_data.update({
                'monthly_progress': monthly_progress,
                'payment_due': payment_due,
                'cycle_complete': cycle_complete,
                'monthly_sessions_attended': enrollment.monthly_sessions_attended or 0
            })

        # For session payments, don't show payment modal - payment will be handled separately
        if enrollment and enrollment.payment_type == 'session':
            response_data['payment_required'] = False

        # Send push notification to student/parent about attendance marking
        try:
            from push_notifications import PushNotificationService
            
            # Determine notification message based on status and payment
            if status == 'present':
                if enrollment and enrollment.payment_type == 'session':
                    if existing_attendance and existing_attendance.payment_status == 'paid':
                        notification_title = "Attendance Confirmed"
                        notification_message = f"Your attendance for {course.name} has been marked as present and payment confirmed."
                    else:
                        notification_title = "Attendance Marked"
                        notification_message = f"Your attendance for {course.name} has been marked as present. Payment status: {existing_attendance.payment_status if existing_attendance else attendance.payment_status}."
                else:
                    notification_title = "Attendance Marked"
                    notification_message = f"Your attendance for {course.name} has been marked as present."
            elif status == 'absent':
                notification_title = "Absence Recorded"
                notification_message = f"Your absence for {course.name} has been recorded."
            else:
                notification_title = "Attendance Updated"
                notification_message = f"Your attendance status for {course.name} has been updated to {status}."
            
            # Send push notification only if student has a user account
            if student.user_id:
                PushNotificationService.send_push_notification(
                    user_id=student.user_id,
                    title=notification_title,
                    message=notification_message,
                    notification_type="attendance",
                    extra_data={
                        'student_id': student_id,
                        'class_id': class_id,
                        'status': status,
                        'course_name': course.name,
                        'date': attendance_date.isoformat()
                    }
                )
                
                log_details['push_notification'] = {
                    'sent': True,
                    'title': notification_title,
                    'message': notification_message,
                    'type': 'attendance'
                }
            else:
                print(f"No user account found for student {student.name} (ID: {student_id}) - skipping notification")
                log_details['push_notification'] = {
                    'sent': False,
                    'reason': 'no_user_account'
                }
            
        except Exception as push_error:
            print(f"Failed to send push notification: {push_error}")
            log_details['push_notification'] = {
                'sent': False,
                'error': str(push_error)
            }

        # Create database notification for the student only if they have a user account
        try:
            if student.user_id:
                db_notification = Notification(
                    user_id=student.user_id,
                    title=notification_title,
                    message=notification_message,
                    type='attendance'
                )
                db.session.add(db_notification)
                log_details['database_notification'] = {
                    'created': True,
                    'title': notification_title,
                    'message': notification_message,
                    'type': 'attendance'
                }
            else:
                log_details['database_notification'] = {
                    'created': False,
                    'reason': 'no_user_account'
                }
        except Exception as db_error:
            print(f"Failed to create database notification: {db_error}")
            log_details['database_notification'] = {
                'created': False,
                'error': str(db_error)
            }

        # Complete logging with success details
        operation_end_time = datetime.now()
        log_details.update({
            'end_time': operation_end_time.isoformat(),
            'duration_seconds': (operation_end_time - operation_start_time).total_seconds(),
            'notifications_sent': notification_results,
            'response_data': response_data,
            'final_status': 'SUCCESS'
        })
        
        # Send attendance notification to student
        try:
            attendance_notification = Notification(
                user_id=student_id,
                title='✅ Attendance Marked',
                message=f'You have been marked {status.title()} for {class_info.name} by admin',
                type='attendance',
                is_read=False,
                created_at=datetime.now()
            )
            db.session.add(attendance_notification)
            db.session.commit()
            
            # Send push notification
            try:
                from push_notifications import PushNotificationService
                push_service = PushNotificationService()
                push_service.send_notification_to_user(
                    user_id=student_id,
                    title='✅ Attendance Marked',
                    message=f'You have been marked {status.title()} for {class_info.name}',
                    data={
                        'type': 'attendance',
                        'class_id': class_id,
                        'status': status,
                        'course_type': course_type
                    }
                )
            except Exception as push_error:
                logger.warning(f"Failed to send push notification for attendance: {push_error}")
            
            log_details['notification_sent'] = True
            
        except Exception as notification_error:
            logger.error(f"Failed to send attendance notification: {notification_error}")
            log_details['notification_error'] = str(notification_error)
        
        log_attendance_operation('MARK_ATTENDANCE_SUCCESS', log_details, user_id, True)
        
        log_attendance_operation('MARK_ATTENDANCE_SUCCESS', log_details, user_id, True)

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        
        # Log the error with full details
        error_details = log_details.copy()
        error_details.update({
            'end_time': datetime.now().isoformat(),
            'duration_seconds': (datetime.now() - operation_start_time).total_seconds(),
            'exception_type': type(e).__name__,
            'exception_message': str(e),
            'final_status': 'ERROR'
        })
        
        log_attendance_operation('MARK_ATTENDANCE_ERROR', error_details, user_id, False, str(e))
        
        logger.error(f"Error marking attendance: {str(e)}")
        return jsonify({'error': 'Failed to mark attendance'}), 500

@admin_bp.route('/attendance/<int:attendance_id>/mark-payment', methods=['POST'])
@jwt_required()
def mark_attendance_payment(attendance_id):
    """Mark attendance payment as paid or not paid (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    payment_status = data.get('payment_status')  # 'paid' or 'unpaid'
    payment_method = data.get('payment_method', 'cash')

    if payment_status not in ['paid', 'unpaid']:
        return jsonify({'error': 'Invalid payment status. Must be "paid" or "unpaid"'}), 400

    # Get the attendance record
    attendance = Attendance.query.get_or_404(attendance_id)

    # Get the enrollment
    enrollment = Enrollment.query.filter_by(
        student_id=attendance.student_id,
        class_id=attendance.class_id
    ).first()

    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    if enrollment.payment_type != 'session':
        return jsonify({'error': 'This endpoint is only for session-based payments'}), 400

    # Get course price
    course = enrollment.class_.course
    course_price = Decimal(str(course.price)) if course and course.price else Decimal('0')

    # Update attendance payment status
    old_payment_status = attendance.payment_status
    attendance.payment_status = payment_status

    if payment_status == 'paid':
        attendance.payment_amount = course_price
        attendance.payment_date = get_algerian_time()
        attendance.payment_method = payment_method

        # Clear debt if any
        if enrollment.total_debt and enrollment.total_debt > 0:
            enrollment.total_debt = max(0, enrollment.total_debt - course_price)
            enrollment.debt_sessions = max(0, enrollment.debt_sessions - 1)
            
            # Also update student table
            student = Student.query.get(attendance.student_id)
            if student and student.total_debt and student.total_debt > 0:
                student.total_debt = max(0, student.total_debt - course_price)
    else:  # unpaid
        attendance.payment_amount = None
        attendance.payment_date = None
        attendance.payment_method = None

        # Add to debt
        enrollment.total_debt = (enrollment.total_debt or 0) + course_price
        enrollment.debt_sessions = (enrollment.debt_sessions or 0) + 1
        
        # Also update student table
        student = Student.query.get(attendance.student_id)
        if student:
            student.total_debt = (student.total_debt or 0) + course_price

    db.session.commit()

    # Send notification
    try:
        from push_notifications import PushNotificationService
        if payment_status == 'paid':
            PushNotificationService.send_payment_notification(
                student_id=attendance.student_id,
                course_name=course.name if course else 'Course',
                amount=course_price,
                payment_type='session'
            )
    except Exception as e:
        logger.warning(f"Failed to send payment notification: {str(e)}")

    return jsonify({
        'message': f'Payment marked as {payment_status}',
        'attendance_id': attendance_id,
        'payment_status': payment_status,
        'enrollment_updated': True,
        'new_debt': float(enrollment.total_debt) if enrollment.total_debt else 0
    }), 200


@admin_bp.route('/enrollment/<int:enrollment_id>/process-monthly-payment', methods=['POST'])
@jwt_required()
def process_monthly_payment(enrollment_id):
    """Process monthly payment for an enrollment (can be done anytime)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    payment_method = data.get('payment_method', 'cash')

    # Get the enrollment
    enrollment = Enrollment.query.get_or_404(enrollment_id)

    if enrollment.payment_type != 'monthly':
        return jsonify({'error': 'This endpoint is only for monthly payments'}), 400

    if enrollment.monthly_payment_status == 'paid':
        return jsonify({'error': 'Monthly payment is already paid'}), 400

    # Get course price
    course = enrollment.class_.course
    monthly_price = float(course.monthly_price or course.price or 0) if course else 0

    # Mark monthly payment as paid
    enrollment.monthly_payment_status = 'paid'
    enrollment.last_payment_date = get_algerian_time()

    # Reset session count for new month
    enrollment.monthly_sessions_attended = 0

    # Clear any debt
    enrollment.total_debt = 0
    enrollment.debt_sessions = 0

    db.session.commit()

    # Send notification
    try:
        from push_notifications import PushNotificationService
        PushNotificationService.send_payment_notification(
            student_id=enrollment.student_id,
            course_name=course.name if course else 'Course',
            amount=monthly_price,
            payment_type='monthly'
        )
    except Exception as e:
        logger.warning(f"Failed to send payment notification: {str(e)}")

    return jsonify({
        'message': 'Monthly payment processed successfully',
        'enrollment_id': enrollment_id,
        'amount': monthly_price,
        'payment_method': payment_method,
        'sessions_reset': True,
        'debt_cleared': True
    }), 200

@admin_bp.route('/monthly-attendance/reset', methods=['POST'])
@jwt_required()
def reset_monthly_attendance():
    """Reset monthly attendance to 0/4 and mark as paid (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        data = request.get_json()
        student_id = data.get('student_id')
        class_id = data.get('class_id')  # Changed from enrollment_id to class_id
        
        # Debug logging
        logger.info(f'[MONTHLY_RESET_DEBUG] Received data: {data}')
        logger.info(f'[MONTHLY_RESET_DEBUG] student_id: {student_id} (type: {type(student_id)})')
        logger.info(f'[MONTHLY_RESET_DEBUG] class_id: {class_id} (type: {type(class_id)})')

        if not student_id or not class_id:
            logger.error(f'[MONTHLY_RESET_ERROR] Missing required fields - student_id: {student_id}, class_id: {class_id}')
            return jsonify({'error': 'Student ID and class ID are required'}), 400

        # Get student
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404
        
        # Find enrollment based on student_id and class_id
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            payment_type='monthly'
        ).first()

        if not enrollment:
            return jsonify({'error': 'Monthly enrollment not found for this student and class'}), 404

        # Only allow reset for monthly courses that have reached 4 sessions
        if enrollment.payment_type != 'monthly':
            return jsonify({'error': 'This action is only available for monthly payment courses'}), 400

        if (enrollment.monthly_sessions_attended or 0) < 4:
            return jsonify({'error': 'Can only reset attendance after completing 4 sessions (4/4)'}), 400

        # Reset monthly sessions to 0
        enrollment.monthly_sessions_attended = 0
        
        # Update payment status to reflect payment received
        enrollment.payment_status = 'paid'  # Mark as paid
        
        # Clear any existing debt for this enrollment
        enrollment.total_debt = 0

        # Commit the changes
        db.session.commit()

        # Log the operation
        logger.info(f'[MONTHLY_RESET] Admin {user.email} reset monthly attendance for student {student.name} (ID: {student_id})')

        return jsonify({
            'message': 'Monthly attendance reset successfully',
            'student_id': student_id,
            'class_id': class_id,
            'monthly_sessions_attended': 0,
            'payment_status': 'paid',
            'total_debt': 0
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f'Error resetting monthly attendance: {str(e)}')
        return jsonify({'error': 'Failed to reset monthly attendance'}), 500

@admin_bp.route('/students/<int:student_id>/attendance-today/<int:class_id>', methods=['GET'])
@jwt_required()
def get_student_attendance_today(student_id, class_id):
    """Get student's attendance record for today (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get today's date in Algerian timezone
    today = get_algerian_date()

    # Find today's attendance record
    attendance = Attendance.query.filter_by(
        student_id=student_id,
        class_id=class_id,
        attendance_date=today
    ).first()

    if not attendance:
        return jsonify({'error': 'No attendance record found for today'}), 404

    return jsonify({
        'attendance_id': attendance.id,
        'student_id': student_id,
        'class_id': class_id,
        'attendance_date': attendance.attendance_date.isoformat(),
        'status': attendance.status,
        'payment_status': attendance.payment_status,
        'payment_amount': float(attendance.payment_amount) if attendance.payment_amount else None,
        'payment_date': attendance.payment_date.isoformat() if attendance.payment_date else None
    }), 200
    """Get admin activity logs with filtering (Admin only)"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        action_filter = request.args.get('action')
        resource_type_filter = request.args.get('resource_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        user_filter = request.args.get('user_id')

        # Build query
        query = AuditLog.query

        if action_filter:
            query = query.filter(AuditLog.action == action_filter)
        if resource_type_filter:
            query = query.filter(AuditLog.resource_type == resource_type_filter)
        if user_filter:
            query = query.filter(AuditLog.user_id == int(user_filter))
        if date_from:
            query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        if date_to:
            query = query.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))

        # Order by most recent first
        query = query.order_by(AuditLog.created_at.desc())

        # Paginate
        logs = query.paginate(page=page, per_page=per_page, error_out=False)

        # Format logs
        log_data = []
        for log in logs.items:
            log_entry = {
                'id': log.id,
                'user_id': log.user_id,
                'action': log.action,
                'resource_type': log.resource_type,
                'resource_id': log.resource_id,
                'created_at': log.created_at.isoformat(),
                'ip_address': log.ip_address,
                'user_agent': log.user_agent
            }

            # Parse details JSON if available
            if log.details:
                try:
                    log_entry['details'] = json.loads(log.details)
                except:
                    log_entry['details'] = log.details

            log_data.append(log_entry)

        return jsonify({
            'success': True,
            'logs': log_data,
            'pagination': {
                'page': logs.page,
                'per_page': logs.per_page,
                'total': logs.total,
                'pages': logs.pages,
                'has_next': logs.has_next,
                'has_prev': logs.has_prev
            }
        })

    except Exception as e:
        logger.error(f"Error fetching admin logs: {str(e)}")
        return jsonify({'error': 'Failed to fetch logs'}), 500
@jwt_required()
def process_payment():
    """Process payment for enrollment debt or monthly payments (Admin only)"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.json
        enrollment_id = data.get('enrollment_id')
        payment_amount = data.get('payment_amount')
        payment_type = data.get('payment_type', 'debt')  # 'debt' or 'monthly'
        notes = data.get('notes', '')

        if not enrollment_id or not payment_amount:
            return jsonify({'error': 'Enrollment ID and payment amount are required'}), 400

        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        payment_amount = float(payment_amount)

        # Log the payment action
        audit_log = AuditLog(
            user_id=user_id,
            action='PAYMENT_PROCESSED',
            resource_type='enrollment',
            resource_id=enrollment_id,
            details=json.dumps({
                'payment_amount': payment_amount,
                'payment_type': payment_type,
                'enrollment_id': enrollment_id,
                'student_id': enrollment.student_id,
                'class_id': enrollment.class_id,
                'notes': notes,
                'processed_by': user.email
            }),
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        db.session.add(audit_log)

        if payment_type == 'debt':
            # Process debt payment
            if enrollment.total_debt and enrollment.total_debt >= payment_amount:
                enrollment.total_debt -= payment_amount
                if enrollment.total_debt <= 0:
                    enrollment.total_debt = 0
                    enrollment.debt_sessions = 0
                else:
                    # Reduce debt sessions proportionally
                    sessions_cleared = int(payment_amount / (enrollment.class_.course.price if enrollment.class_ and enrollment.class_.course else 1))
                    enrollment.debt_sessions = max(0, (enrollment.debt_sessions or 0) - sessions_cleared)

                message = f'Debt payment of {payment_amount} DZD processed successfully'
            else:
                return jsonify({'error': 'Payment amount exceeds outstanding debt'}), 400

        elif payment_type == 'monthly':
            # Process monthly payment
            enrollment.monthly_payment_status = 'paid'
            enrollment.last_payment_date = get_algerian_time()
            enrollment.monthly_sessions_attended = 0  # Reset for new cycle
            message = f'Monthly payment of {payment_amount} DZD processed successfully'

        db.session.commit()

        # Send payment confirmation notification
        try:
            from push_notifications import PushNotificationService
            PushNotificationService.send_payment_confirmation_notification(
                student_id=enrollment.student_id,
                amount=payment_amount,
                payment_type=payment_type
            )
        except Exception as e:
            logger.error(f"Failed to send payment notification: {e}")

        return jsonify({
            'success': True,
            'message': message,
            'enrollment': {
                'id': enrollment.id,
                'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0,
                'monthly_payment_status': enrollment.monthly_payment_status,
                'monthly_sessions_attended': enrollment.monthly_sessions_attended
            }
        })

    except Exception as e:
        logger.error(f"Error processing payment: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to process payment'}), 500
@jwt_required()
def remove_attendance():
    """Remove the most recent attendance record for a student (Admin only) with comprehensive logging"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    
    # Start building log details
    operation_start_time = datetime.now()
    log_details = {
        'operation': 'remove_attendance',
        'start_time': operation_start_time.isoformat(),
        'admin_user_id': user_id,
        'admin_username': user.email if user else 'unknown',
        'request_data': request.get_json()
    }

    if user.role != 'admin':
        log_attendance_operation('REMOVE_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'insufficient_permissions',
            'user_role': user.role if user else 'no_user'
        }, user_id, False, 'Admin access required')
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_id = data.get('student_id')
    class_id = data.get('class_id')

    # Update log details with parsed data
    log_details.update({
        'student_id': student_id,
        'class_id': class_id
    })

    if not student_id or not class_id:
        log_attendance_operation('REMOVE_ATTENDANCE_FAILED', log_details | {
            'error_reason': 'missing_required_fields',
            'missing_fields': [f for f in ['student_id', 'class_id'] if not data.get(f)]
        }, user_id, False, 'Missing required fields')
        return jsonify({'error': 'student_id and class_id are required'}), 400

    try:
        # Verify student and class exist
        student = Student.query.get(student_id)
        class_obj = Class.query.get(class_id)
        
        if not student:
            log_attendance_operation('REMOVE_ATTENDANCE_FAILED', log_details | {
                'error_reason': 'student_not_found'
            }, user_id, False, 'Student not found')
            return jsonify({'error': 'Student not found'}), 404
            
        if not class_obj:
            log_attendance_operation('REMOVE_ATTENDANCE_FAILED', log_details | {
                'error_reason': 'class_not_found'
            }, user_id, False, 'Class not found')
            return jsonify({'error': 'Class not found'}), 404

        # Add student and class info to log
        log_details.update({
            'student_name': student.name,
            'student_id': student.id,
            'class_name': class_obj.name,
            'class_schedule': {
                'start_time': class_obj.start_time.strftime('%H:%M'),
                'end_time': class_obj.end_time.strftime('%H:%M'),
                'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_obj.day_of_week]
            }
        })

        # Find the most recent attendance record for this student and class
        latest_attendance = Attendance.query.filter_by(
            student_id=student_id,
            class_id=class_id
        ).order_by(Attendance.attendance_date.desc(), Attendance.marked_at.desc()).first()

        if not latest_attendance:
            log_attendance_operation('REMOVE_ATTENDANCE_FAILED', log_details | {
                'error_reason': 'no_attendance_record_found',
                'search_criteria': {'student_id': student_id, 'class_id': class_id}
            }, user_id, False, 'No attendance record found to remove')
            return jsonify({'error': 'No attendance record found to remove'}), 404

        # Store info for response and logging
        removed_status = latest_attendance.status
        removed_date = latest_attendance.attendance_date
        removed_marked_by = latest_attendance.marked_by
        removed_marked_at = latest_attendance.marked_at

        log_details.update({
            'attendance_to_remove': {
                'id': latest_attendance.id,
                'status': removed_status,
                'date': removed_date.isoformat() if removed_date else None,
                'marked_by': removed_marked_by,
                'marked_at': removed_marked_at.isoformat() if removed_marked_at else None
            }
        })

        # Remove the attendance record
        db.session.delete(latest_attendance)

        # Update monthly session count for monthly payment types if removing a counted session
        enrollment = Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first()
        monthly_progress = None
        
        if enrollment:
            log_details['enrollment'] = {
                'exists': True,
                'payment_type': enrollment.payment_type,
                'current_sessions': enrollment.monthly_sessions_attended or 0,
                'payment_status': enrollment.monthly_payment_status
            }
            
            if enrollment.payment_type == 'monthly':
                # Decrease monthly session count if it's greater than 0
                old_sessions = enrollment.monthly_sessions_attended or 0
                if old_sessions > 0:
                    enrollment.monthly_sessions_attended = old_sessions - 1
                    monthly_progress = enrollment.monthly_sessions_attended
                    
                    log_details['enrollment']['session_update'] = {
                        'old_count': old_sessions,
                        'new_count': monthly_progress,
                        'status_removed': removed_status
                    }
        else:
            log_details['enrollment'] = {'exists': False}

        # Commit to database
        commit_time = datetime.now()
        db.session.commit()
        log_details['database_commit_time'] = commit_time.isoformat()

        response_data = {
            'message': f'Removed {removed_status} attendance for {student.first_name} {student.last_name} on {removed_date}',
            'removed_attendance': {
                'student_id': student_id,
                'class_id': class_id,
                'status': removed_status,
                'date': removed_date.isoformat(),
                'originally_marked_by': removed_marked_by,
                'originally_marked_at': removed_marked_at.isoformat() if removed_marked_at else None,
                'removed_by': user_id,
                'removed_at': datetime.now().isoformat()
            }
        }
        
        # Add monthly course progress info if applicable
        if enrollment and enrollment.payment_type == 'monthly':
            response_data.update({
                'monthly_progress': monthly_progress,
                'sessions_remaining': 4 - (monthly_progress or 0)
            })

        # Complete logging with success details
        operation_end_time = datetime.now()
        log_details.update({
            'end_time': operation_end_time.isoformat(),
            'duration_seconds': (operation_end_time - operation_start_time).total_seconds(),
            'response_data': response_data,
            'final_status': 'SUCCESS'
        })
        
        log_attendance_operation('REMOVE_ATTENDANCE_SUCCESS', log_details, user_id, True)

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        
        # Log the error with full details
        error_details = log_details.copy()
        error_details.update({
            'end_time': datetime.now().isoformat(),
            'duration_seconds': (datetime.now() - operation_start_time).total_seconds(),
            'exception_type': type(e).__name__,
            'exception_message': str(e),
            'final_status': 'ERROR'
        })
        
        log_attendance_operation('REMOVE_ATTENDANCE_ERROR', error_details, user_id, False, str(e))
        
        logger.error(f"Error removing attendance: {str(e)}")
        return jsonify({'error': 'Failed to remove attendance'}), 500

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error removing attendance: {str(e)}")
        return jsonify({'error': 'Failed to remove attendance'}), 500

@admin_bp.route('/attendance/auto-mark-absent', methods=['POST'])
@jwt_required()
def auto_mark_absent():
    """Automatically mark students as absent for classes that have ended (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from models import Class, Student, Enrollment, Attendance
        
        now = datetime.now()
        current_time = now.time()
        current_weekday = now.weekday()  # 0=Monday, 6=Sunday
        today = now.date()
        
        # Find all classes that have ended today (30 minutes grace period)
        grace_period = timedelta(minutes=30)
        current_datetime_with_grace = now - grace_period
        
        ended_classes = Class.query.filter(
            Class.day_of_week == current_weekday,
            Class.is_active == True
        ).all()
        
        marked_absent_count = 0
        processed_classes = []
        absent_students_data = []  # For bulk notifications
        
        for class_obj in ended_classes:
            # Check if class has ended (with grace period)
            class_end = datetime.combine(today, class_obj.end_time)
            
            if current_datetime_with_grace > class_end:
                # Get all enrolled students for this class
                enrollments = Enrollment.query.filter_by(
                    class_id=class_obj.id,
                    is_active=True
                ).all()
                
                class_marked_absent = 0
                
                for enrollment in enrollments:
                    # Check if student already has attendance marked for today
                    existing_attendance = Attendance.query.filter_by(
                        student_id=enrollment.student_id,
                        class_id=class_obj.id,
                        attendance_date=today
                    ).first()
                    
                    if not existing_attendance:
                        # Student wasn't marked - mark as absent
                        absent_attendance = Attendance(
                            student_id=enrollment.student_id,
                            class_id=class_obj.id,
                            attendance_date=today,
                            status='absent',
                            marked_by=user.id  # System marked
                        )
                        db.session.add(absent_attendance)
                        
                        # Update monthly session count for monthly payment types
                        if enrollment.payment_type == 'monthly':
                            enrollment.monthly_sessions_attended = (enrollment.monthly_sessions_attended or 0) + 1
                        
                        # Add to notification list
                        student = Student.query.get(enrollment.student_id)
                        if student:
                            absent_students_data.append({
                                'student_id': enrollment.student_id,
                                'class_name': class_obj.name,
                                'student_name': student.name
                            })
                        
                        class_marked_absent += 1
                        marked_absent_count += 1
                
                if class_marked_absent > 0:
                    processed_classes.append({
                        'class_id': class_obj.id,
                        'class_name': class_obj.name,
                        'course_name': class_obj.course.name if class_obj.course else 'Unknown',
                        'students_marked_absent': class_marked_absent,
                        'class_time': f"{class_obj.start_time.strftime('%H:%M')} - {class_obj.end_time.strftime('%H:%M')}"
                    })
        
        db.session.commit()
        
        # Send bulk push notifications for absent students
        if absent_students_data:
            try:
                PushNotificationService.send_bulk_absent_notifications(absent_students_data)
            except Exception as e:
                logger.error(f"Failed to send bulk absent notifications: {e}")
        
        return jsonify({
            'message': f'Successfully marked {marked_absent_count} students as absent',
            'total_students_marked': marked_absent_count,
            'processed_classes': processed_classes,
            'notifications_sent': len(absent_students_data),
            'processed_at': now.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error auto-marking absent: {str(e)}")
        return jsonify({'error': 'Failed to auto-mark students as absent'}), 500

@admin_bp.route('/attendance/class/<int:class_id>', methods=['GET'])
@jwt_required()
def get_class_attendance(class_id):
    """Get attendance records for a specific class (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    class_info = Class.query.get(class_id)
    if not class_info:
        return jsonify({'error': 'Class not found'}), 404

    # Get date filter
    date_filter = request.args.get('date', datetime.utcnow().date().isoformat())
    try:
        filter_date = datetime.fromisoformat(date_filter).date()
    except ValueError:
        filter_date = datetime.utcnow().date()

    # Get all students enrolled in this class
    enrollments = Enrollment.query.filter_by(class_id=class_id, is_active=True).all()
    
    attendance_data = []
    for enrollment in enrollments:
        student = Student.query.get(enrollment.student_id)
        
        # Get attendance record for the specific date
        attendance_record = Attendance.query.filter_by(
            student_id=student.id,
            class_id=class_id,
            attendance_date=filter_date
        ).first()

        attendance_data.append({
            'student': {
                'id': student.id,
                'name': student.name
            },
            'enrollment_id': enrollment.id,
            'attendance': {
                'status': attendance_record.status if attendance_record else 'not_marked',
                'notes': attendance_record.notes if attendance_record else '',
                'marked_by': attendance_record.marked_by if attendance_record else None
            }
        })

    return jsonify({
        'class': {
            'id': class_info.id,
            'name': class_info.name,
            'course_name': class_info.course.name
        },
        'date': filter_date.isoformat(),
        'attendance_data': attendance_data
    }), 200

@admin_bp.route('/attendance/overview', methods=['GET'])
@jwt_required()
def get_attendance_overview():
    """Get comprehensive attendance overview with filters"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from sqlalchemy import and_, desc, func
        from datetime import timedelta
        
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        student_id = request.args.get('student_id')
        class_id = request.args.get('class_id')
        status = request.args.get('status')  # 'present', 'absent', 'late'
        
        # Base query with payment information
        query = db.session.query(
            Attendance,
            Student.name.label('student_name'),
            Class.name.label('class_name'),
            Course.name.label('course_name'),
            Course.pricing_type.label('payment_type'),
            Attendance.payment_status.label('payment_status'),
            Course.price.label('course_price'),
            Course.session_price.label('session_price')
        ).join(
            Student, Attendance.student_id == Student.id
        ).join(
            Class, Attendance.class_id == Class.id
        ).join(
            Course, Class.course_id == Course.id
        )
        
        # Apply filters
        if start_date:
            query = query.filter(Attendance.attendance_date >= start_date)
        if end_date:
            query = query.filter(Attendance.attendance_date <= end_date)
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        if class_id:
            query = query.filter(Attendance.class_id == class_id)
        if status:
            query = query.filter(Attendance.status == status)
            
        # Order by most recent first
        results = query.order_by(desc(Attendance.attendance_date), desc(Attendance.marked_at)).all()
        
        # Format results
        attendance_records = []
        for attendance, student_name, class_name, course_name, payment_type, payment_status, course_price, session_price in results:
            # Determine the payment amount based on pricing type
            payment_amount = float(session_price) if session_price else float(course_price) if course_price else 0.0
            
            attendance_records.append({
                'id': attendance.id,
                'student_id': attendance.student_id,
                'student_name': student_name,
                'class_id': attendance.class_id,
                'class_name': class_name,
                'course_name': course_name,
                'payment_type': payment_type or 'session',
                'payment_status': payment_status or 'unpaid',
                'payment_amount': payment_amount,
                'status': attendance.status,
                'attendance_date': attendance.attendance_date.isoformat() if attendance.attendance_date else None,
                'marked_at': attendance.marked_at.isoformat() if attendance.marked_at else None,
                'marked_by': attendance.marked_by
            })
        
        # Get summary statistics
        total_records = len(attendance_records)
        present_count = len([r for r in attendance_records if r['status'] == 'present'])
        absent_count = len([r for r in attendance_records if r['status'] == 'absent'])
        late_count = len([r for r in attendance_records if r['status'] == 'late'])
        
        # Get recent activity (last 7 days)
        recent_cutoff = datetime.now() - timedelta(days=7)
        recent_records = [r for r in attendance_records if r['marked_at'] and datetime.fromisoformat(r['marked_at']) >= recent_cutoff]
        
        # Get classes with pending payments (monthly courses with 4+ sessions)
        payment_due_query = db.session.query(
            Student.id.label('student_id'),
            Student.name.label('student_name'),
            Course.id.label('course_id'),
            Course.name.label('course_name'),
            Enrollment.monthly_sessions_attended
        ).join(
            Enrollment, Student.id == Enrollment.student_id
        ).join(
            Class, Enrollment.class_id == Class.id
        ).join(
            Course, Class.course_id == Course.id
        ).filter(
            and_(
                Course.pricing_type == 'monthly',
                func.coalesce(Enrollment.monthly_sessions_attended, 0) >= 4,
                Enrollment.monthly_payment_status != 'paid'
            )
        ).all()
        
        payment_due_students = []
        for student_id, student_name, course_id, course_name, sessions_attended in payment_due_query:
            payment_due_students.append({
                'student_id': student_id,
                'student_name': student_name,
                'course_id': course_id,
                'course_name': course_name,
                'sessions_attended': sessions_attended,
                'payment_status': 'due'
            })
        
        return jsonify({
            'attendance_records': attendance_records,
            'summary': {
                'total_records': total_records,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'attendance_rate': round((present_count / total_records * 100), 2) if total_records > 0 else 0
            },
            'recent_activity': {
                'count': len(recent_records),
                'records': recent_records[:10]  # Latest 10
            },
            'payment_due_students': payment_due_students
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error fetching attendance overview: {str(e)}")
        return jsonify({'error': 'Failed to fetch attendance overview'}), 500

@admin_bp.route('/attendance/bulk-mark', methods=['POST'])
@jwt_required()
def bulk_mark_attendance():
    """Mark attendance for multiple students at once (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    class_id = data.get('class_id')
    attendance_records = data.get('attendance_records', [])  # [{student_id, status, notes}]
    date_str = data.get('date', datetime.utcnow().date().isoformat())
    force_attendance = data.get('force', False) or data.get('force_attendance', False)

    if not class_id or not attendance_records:
        return jsonify({'error': 'class_id and attendance_records are required'}), 400

    try:
        attendance_date = datetime.fromisoformat(date_str).date()
    except ValueError:
        attendance_date = datetime.utcnow().date()

    class_info = Class.query.get(class_id)
    if not class_info:
        return jsonify({'error': 'Class not found'}), 404

    # Check time restrictions unless admin explicitly forces it
    if not force_attendance:
        is_allowed, time_message, warning_needed = check_attendance_time_window(class_info)
        
        if not is_allowed:
            # For admin users, provide a more lenient approach  
            if user.role == 'admin':
                auto_force = data.get('auto_force', True)  # Default to auto-force for admins
                
                if auto_force and warning_needed:
                    # Automatically force the attendance for admin users when it's just a time window issue
                    logger.info(f"Auto-forcing bulk attendance for admin user {user.email} due to time window - {time_message}")
                    force_attendance = True
                else:
                    # Still show the error but make it easy to retry
                    return jsonify({
                        'error': 'Time restriction violation',
                        'message': time_message,
                        'warning_needed': warning_needed,
                        'auto_retry_with_force': True,  # Flag for frontend to automatically retry
                        'can_force': True,  # Indicates admin can override
                        'current_time': datetime.now().strftime('%H:%M'),
                        'class_schedule': {
                            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBD',
                            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBD',
                            'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_info.day_of_week] if class_info.day_of_week is not None and 0 <= class_info.day_of_week < 7 else 'TBD'
                        },
                        'retry_data': {
                            'class_id': class_id,
                            'attendance_records': attendance_records,
                            'date': date_str,
                            'force': True  # Include force parameter for retry
                        }
                    }), 400
            else:
                # Non-admin users get strict time restrictions
                return jsonify({
                    'error': 'Time restriction violation',
                    'message': time_message,
                    'warning_needed': warning_needed,
                    'auto_retry_with_force': False,  # Non-admins cannot force
                    'can_force': False,
                    'current_time': datetime.now().strftime('%H:%M'),
                    'class_schedule': {
                        'start_time': class_info.start_time.strftime('%H:%M'),
                        'end_time': class_info.end_time.strftime('%H:%M'),
                        'day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][class_info.day_of_week]
                    }
                }), 403  # Forbidden for non-admin users

    try:
        processed_count = 0
        updated_count = 0
        
        for record in attendance_records:
            student_id = record.get('student_id')
            status = record.get('status', 'present')
            notes = record.get('notes', '')

            if not student_id:
                continue

            # Check if attendance already exists
            existing_attendance = Attendance.query.filter_by(
                student_id=student_id,
                class_id=class_id,
                attendance_date=attendance_date
            ).first()

            if existing_attendance:
                existing_attendance.status = status
                existing_attendance.notes = notes
                existing_attendance.marked_by = user.id
                updated_count += 1
            else:
                attendance = Attendance(
                    student_id=student_id,
                    class_id=class_id,
                    attendance_date=attendance_date,
                    status=status,
                    notes=notes,
                    marked_by=user.id
                )
                db.session.add(attendance)

            # Update monthly session count
            enrollment = Enrollment.query.filter_by(student_id=student_id, class_id=class_id).first()
            if enrollment and enrollment.payment_type == 'monthly' and status == 'present':
                enrollment.monthly_sessions_attended += 1

            processed_count += 1

        db.session.commit()

        return jsonify({
            'message': 'Bulk attendance marked successfully',
            'processed_count': processed_count,
            'updated_count': updated_count,
            'new_count': processed_count - updated_count
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking bulk attendance: {str(e)}")
        return jsonify({'error': 'Failed to mark bulk attendance'}), 500

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

# Student-Parent Assignment Management
@admin_bp.route('/students/<int:student_id>/assign-parent', methods=['POST'])
@jwt_required()
def assign_student_to_parent(student_id):
    """Assign a student to a parent (Admin only)"""
    user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
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

@admin_bp.route('/parents/<int:parent_id>', methods=['DELETE'])
@jwt_required()
def delete_parent(parent_id):
    """Delete a parent with comprehensive cascade deletion (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = Parent.query.get(parent_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # Optional parameter to preserve user account
    preserve_user = request.args.get('preserve_user', 'true').lower() == 'true'

    try:
        related_deletions = []
        
        # Get all students for this parent
        students = Student.query.filter_by(parent_id=parent_id).all()
        
        for student in students:
            # Delete all student-related records
            attendance_count = Attendance.query.filter_by(student_id=student.id).delete(synchronize_session=False)
            enrollment_count = Enrollment.query.filter_by(student_id=student.id).delete(synchronize_session=False)
            section_enrollment_count = SectionEnrollment.query.filter_by(student_id=student.id).delete(synchronize_session=False)
            registration_count = Registration.query.filter_by(student_id=student.id).delete(synchronize_session=False)
            
            if attendance_count > 0:
                related_deletions.append(f"{attendance_count} attendance records for student {student.name}")
            if enrollment_count > 0:
                related_deletions.append(f"{enrollment_count} enrollments for student {student.name}")
            if section_enrollment_count > 0:
                related_deletions.append(f"{section_enrollment_count} section enrollments for student {student.name}")
            if registration_count > 0:
                related_deletions.append(f"{registration_count} registrations for student {student.name}")
            
            # Delete the student
            db.session.delete(student)
            related_deletions.append(f"Student: {student.name}")

        # Delete parent's direct registrations
        parent_registration_count = Registration.query.filter_by(parent_id=parent_id).delete(synchronize_session=False)
        if parent_registration_count > 0:
            related_deletions.append(f"{parent_registration_count} parent registrations")

        # Store user info before deleting parent
        user_to_delete = parent.user if not preserve_user else None
        
        # Delete the parent
        db.session.delete(parent)
        db.session.commit()
        
        # Optionally delete the associated user account
        if not preserve_user and user_to_delete:
            # Check if user has other parents or is admin
            other_parents = Parent.query.filter_by(user_id=user_to_delete.id).count()
            if other_parents == 0 and user_to_delete.role != 'admin':
                db.session.delete(user_to_delete)
                db.session.commit()
                related_deletions.append(f"User account: {user_to_delete.full_name}")
        
        logger.info(f"Successfully deleted parent ID {parent_id} by user {user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'Parent and all related data deleted successfully',
            'deleted_records': related_deletions,
            'parent_id': parent_id,
            'deleted_by': user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting parent {parent_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete parent and related data',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@admin_bp.route('/parents/<int:parent_id>/students', methods=['GET'])
@jwt_required()
def get_parent_students(parent_id):
    """Get all students assigned to a parent (Admin only)"""
    user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
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
            'email': student.user.email if student.user else '',
            'phone': student.user.phone if student.user else '',
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
    user_id = int(get_jwt_identity())
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
                'email': student.user.email if student.user else None,
                'phone': student.user.phone if student.user else None,
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
    user_id = int(get_jwt_identity())
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
    admin_user_id = int(get_jwt_identity())
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
    admin_user_id = int(get_jwt_identity())
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

@admin_bp.route('/students/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_details(student_id):
    """Get detailed information about a specific student (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get_or_404(student_id)
    parent = Parent.query.get(student.parent_id) if student.parent_id else None
    
    # Get enrollment information
    enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).all()
    enrollment_data = []
    for enrollment in enrollments:
        enrollment_data.append({
            'id': enrollment.id,
            'class_name': enrollment.class_.name,
            'course_name': enrollment.class_.course.name,
            'payment_type': enrollment.payment_type,
            'enrollment_status': enrollment.enrollment_status,
            'total_debt': float(enrollment.total_debt) if enrollment.total_debt else 0.0
        })

    student_data = {
        'id': student.id,
        'name': student.name,
        'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
        'barcode': student.barcode,
        'mobile_username': student.mobile_username,
        'mobile_app_enabled': student.mobile_app_enabled,
        'total_debt': float(student.total_debt) if student.total_debt else 0.0,
        'parent': {
            'id': parent.id,
            'full_name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone
        } if parent else None,
        'enrollments': enrollment_data,
        'created_at': student.created_at.isoformat() if student.created_at else None
    }

    return jsonify(student_data), 200

@admin_bp.route('/students/<int:student_id>', methods=['PUT'])
@jwt_required()
def update_student(student_id):
    """Update a student (Admin only)"""
    user_id = int(get_jwt_identity())
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

    # Update user information if student has a user account and email/phone provided
    if student.user:
        if 'email' in data:
            student.user.email = data['email'].strip() if data['email'] else None
            db.session.add(student.user)
        if 'phone' in data:
            student.user.phone = data['phone'].strip() if data['phone'] else None
            db.session.add(student.user)

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

    # Get user info for response
    user_email = student.user.email if student.user else None
    user_phone = student.user.phone if student.user else None

    return jsonify({
        'success': True,
        'message': 'Student updated successfully',
        'student': {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'email': user_email,
            'phone': user_phone,
            'mobile_app_enabled': student.mobile_app_enabled
        }
    }), 200

@admin_bp.route('/students/<int:student_id>', methods=['DELETE'])
@jwt_required()
def delete_student(student_id):
    """Delete a student with comprehensive cascade deletion (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    try:
        related_deletions = []
        
        # 1. Delete all attendances for this student
        attendance_count = Attendance.query.filter_by(student_id=student_id).delete(synchronize_session=False)
        if attendance_count > 0:
            related_deletions.append(f"{attendance_count} attendance records")

        # 2. Delete all enrollments for this student
        enrollment_count = Enrollment.query.filter_by(student_id=student_id).delete(synchronize_session=False)
        if enrollment_count > 0:
            related_deletions.append(f"{enrollment_count} enrollments")

        # 3. Delete all section enrollments for this student
        section_enrollment_count = SectionEnrollment.query.filter_by(student_id=student_id).delete(synchronize_session=False)
        if section_enrollment_count > 0:
            related_deletions.append(f"{section_enrollment_count} section enrollments")

        # 4. Delete all registrations for this student
        registration_count = Registration.query.filter_by(student_id=student_id).delete(synchronize_session=False)
        if registration_count > 0:
            related_deletions.append(f"{registration_count} registrations")

        # 5. Delete notifications related to this student (if any)
        try:
            notification_count = Notification.query.filter(
                db.or_(
                    Notification.message.contains(f"student {student_id}"),
                    Notification.message.contains(student.name) if student.name else False,
                    Notification.message_en.contains(student.name) if student.name else False,
                    Notification.message_ar.contains(student.name) if student.name else False
                )
            ).delete(synchronize_session=False)
            if notification_count > 0:
                related_deletions.append(f"{notification_count} notifications")
        except Exception as notif_error:
            logger.warning(f"Could not delete notifications for student {student_id}: {str(notif_error)}")

        # 6. If student has associated user account, handle it
        if student.user_id:
            # Don't delete the user account, just remove the association
            student.user_id = None
            related_deletions.append("Removed user account association")

        # 7. Delete the student itself
        db.session.delete(student)
        db.session.commit()
        
        logger.info(f"Successfully deleted student ID {student_id} by user {user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'Student and all related data deleted successfully',
            'deleted_records': related_deletions,
            'student_id': student_id,
            'deleted_by': user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting student {student_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete student and related data',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@admin_bp.route('/students/<int:student_id>/toggle-mobile', methods=['PUT'])
@jwt_required()
def toggle_student_mobile(student_id):
    """Toggle mobile app access for a student (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # If enabling mobile access and no credentials exist, generate them
    if not student.mobile_app_enabled and (not student.mobile_username or not student.mobile_password_hash):
        username, password = generate_student_mobile_credentials(student.name)
        student.mobile_username = username
        student.mobile_password_hash = hash_password(password)
        student.mobile_password_plain = password

    student.mobile_app_enabled = not student.mobile_app_enabled
    db.session.add(student)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Student mobile access {"enabled" if student.mobile_app_enabled else "disabled"}',
        'mobile_app_enabled': student.mobile_app_enabled
    }), 200

@admin_bp.route('/parents/<int:parent_id>/toggle-mobile', methods=['PUT'])
@jwt_required()
def toggle_parent_mobile(parent_id):
    """Toggle mobile app access for a parent (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = Parent.query.get(parent_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # If enabling mobile access and no credentials exist, generate them
    if not parent.mobile_app_enabled and (not parent.mobile_username or not parent.mobile_password_hash):
        username, password = generate_parent_mobile_credentials(parent.full_name)
        parent.mobile_username = username
        parent.mobile_password_hash = hash_password(password)
        parent.mobile_password_plain = password

    parent.mobile_app_enabled = not parent.mobile_app_enabled
    db.session.add(parent)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': f'Parent mobile access {"enabled" if parent.mobile_app_enabled else "disabled"}',
        'mobile_app_enabled': parent.mobile_app_enabled
    }), 200

@admin_bp.route('/parents/<int:parent_id>/setup-mobile', methods=['POST'])
@jwt_required()
def setup_parent_mobile(parent_id):
    """Set up mobile credentials for a parent (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = Parent.query.get(parent_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # Generate mobile credentials
    username, password = generate_parent_mobile_credentials(parent.full_name)

    # Update parent with mobile credentials
    parent.mobile_username = username
    parent.mobile_password_hash = hash_password(password)
    parent.mobile_app_enabled = True

    db.session.add(parent)
    db.session.commit()

    return jsonify({
        'success': True,
        'message': 'Mobile credentials set up successfully',
        'mobile_username': username,
        'mobile_password': password,  # In production, don't return password
        'mobile_app_enabled': True
    }), 200


# ===== USER CRUD ENDPOINTS =====

@admin_bp.route('/payments/admin/mark-paid', methods=['POST'])
@jwt_required()
def mark_payment_paid():
    """Mark a payment as paid (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    enrollment_id = data.get('enrollment_id')
    payment_type = data.get('payment_type')  # 'registration' or 'monthly'

    if not enrollment_id or not payment_type:
        return jsonify({'error': 'enrollment_id and payment_type are required'}), 400

    enrollment = Enrollment.query.get(enrollment_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    if payment_type == 'monthly':
        enrollment.monthly_payment_status = 'paid'
        # Reset sessions counter for next month
        enrollment.monthly_sessions_attended = 0
        message = 'Monthly payment marked as paid and session counter reset'
    else:
        return jsonify({'error': 'Invalid payment_type. Must be "monthly"'}), 400

    db.session.commit()

    return jsonify({
        'message': message,
        'enrollment_id': enrollment_id,
        'payment_type': payment_type,
        'status': 'paid'
    }), 200

@admin_bp.route('/payments/enrollment/<int:enrollment_id>/pay', methods=['POST'])
@jwt_required()
def process_enrollment_payment(enrollment_id):
    """Process payment for a specific enrollment (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    payment_type = data.get('payment_type', 'registration')
    amount = data.get('amount', 0)
    payment_method = data.get('payment_method', 'cash')

    enrollment = Enrollment.query.get(enrollment_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    try:
        if payment_type == 'monthly':
            enrollment.monthly_payment_status = 'paid'
            # Reset sessions counter for next month
            enrollment.monthly_sessions_attended = 0
            message = 'Monthly payment processed successfully and session counter reset'
        else:
            return jsonify({'error': 'Invalid payment type. Must be "monthly"'}), 400

        db.session.commit()

        return jsonify({
            'message': message,
            'enrollment_id': enrollment_id,
            'payment_type': payment_type,
            'amount': amount,
            'payment_method': payment_method,
            'status': 'paid'
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error processing payment for enrollment {enrollment_id}: {str(e)}")
        return jsonify({'error': 'Failed to process payment'}), 500

@admin_bp.route('/payments/admin/send-reminders', methods=['POST'])
@jwt_required()
def send_payment_reminders():
    """Send payment reminders to parents (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    reminder_type = data.get('type', 'all')  # 'overdue', 'upcoming', 'all'

    # This is a placeholder - implement actual email sending logic here
    # You would typically integrate with an email service like SendGrid, SES, etc.
    
    sent_count = 0
    if reminder_type in ['upcoming', 'all']:
        # Get upcoming due payments and send reminders (only monthly payments)
        upcoming_enrollments = Enrollment.query.filter(
            func.coalesce(Enrollment.monthly_sessions_attended, 0) >= 3,
            Enrollment.monthly_payment_status == 'pending'
        ).all()
        sent_count += len(upcoming_enrollments)

    return jsonify({
        'message': f'Payment reminders sent successfully',
        'reminder_type': reminder_type,
        'sent_count': sent_count
    }), 200

@admin_bp.route('/payments/admin/history', methods=['GET'])
@jwt_required()
def get_payment_history():
    """Get payment history for all students (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get pagination parameters
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))

    # Get all paid enrollments (monthly payments only)
    paid_enrollments = Enrollment.query.filter(
        Enrollment.monthly_payment_status == 'paid'
    ).order_by(Enrollment.enrollment_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    payment_history = []
    for enrollment in paid_enrollments.items:
        student = Student.query.get(enrollment.student_id)
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        course = enrollment.course

        # Only track monthly payments (registration payments removed)
        if enrollment.monthly_payment_status == 'paid':
            payment_history.append({
                'id': f"monthly_{enrollment.id}",
                'type': 'monthly',
                'student': {
                    'id': student.id,
                    'name': student.name
                },
                'parent': {
                    'id': parent.id if parent else None,
                    'name': parent.full_name if parent else 'No Parent',
                    'email': parent.email if parent else 'N/A'
                },
                'course': {
                    'id': course.id,
                    'name': course.name
                },
                'amount': float(course.monthly_price) if course.monthly_price else float(course.price),
                'paid_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                'status': 'paid'
            })

    return jsonify({
        'payment_history': payment_history,
        'pagination': {
            'page': page,
            'pages': paid_enrollments.pages,
            'per_page': per_page,
            'total': paid_enrollments.total
        }
    }), 200

@admin_bp.route('/payments/student-payments', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_student_payments():
    """Get payment information for the current user (student or parent)"""
    try:
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            response = jsonify()
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
            return response, 200

        # Get current user
        user_id = get_jwt_identity()
        if not user_id:
            return jsonify({'error': 'Authentication required'}), 401

        user = User.query.get(int(user_id))
        if not user:
            return jsonify({'error': 'User not found'}), 404

        payments_data = []
        
        # Check if user is a parent
        parent = Parent.query.filter_by(user_id=user.id).first()
        if parent:
            # Get all students for this parent
            students = Student.query.filter_by(parent_id=parent.id).all()
        else:
            # Check if user is directly a student (less common)
            student = Student.query.filter_by(user_id=user.id).first()
            students = [student] if student else []

        # If no students found, return empty array
        if not students:
            return jsonify([]), 200

        # Get payment info for all students
        for student in students:
            # Get all enrollments for this student
            enrollments = db.session.query(Enrollment)\
                .join(Class, Enrollment.class_id == Class.id)\
                .join(Course, Class.course_id == Course.id)\
                .filter(Enrollment.student_id == student.id)\
                .all()

            for enrollment in enrollments:
                # Get class and course info
                class_obj = Class.query.get(enrollment.class_id)
                course = Course.query.get(class_obj.course_id) if class_obj else None

                # Calculate unpaid amount (only monthly payments)
                unpaid_amount = 0
                if (enrollment.payment_type == 'monthly' and 
                    (enrollment.monthly_sessions_attended or 0) >= 4 and 
                    enrollment.monthly_payment_status == 'pending'):
                    unpaid_amount += float(course.monthly_price) if course and course.monthly_price else float(course.price) if course else 0

                # Calculate progress percentage
                progress_percentage = 0
                if enrollment.payment_type == 'monthly':
                    progress_percentage = min((enrollment.monthly_sessions_attended / 4) * 100, 100)

                # Determine if overdue (monthly payment due)
                is_overdue = False
                if enrollment.payment_type == 'monthly' and (enrollment.monthly_sessions_attended or 0) >= 4 and enrollment.monthly_payment_status == 'pending':
                    is_overdue = True

                payment_info = {
                    'enrollment_id': enrollment.id,
                    'student_name': student.name,
                    'course_name': course.name if course else 'Unknown Course',
                    'section_name': class_obj.name if class_obj else 'Unknown Section',
                    'payment_type': enrollment.payment_type,
                    'unpaid_amount': unpaid_amount,
                    'payment_status_display': enrollment.payment_status_display,
                    'progress_percentage': progress_percentage,
                    'sessions_this_month': enrollment.monthly_sessions_attended or 0,
                    'is_overdue': is_overdue,
                    'monthly_payment_status': enrollment.monthly_payment_status,
                    'course_price': float(course.price) if course else 0,
                    'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None
                }
                payments_data.append(payment_info)

        return jsonify(payments_data), 200

    except Exception as e:
        logger.error(f"Error fetching student payments: {e}")
        return jsonify({'error': 'Failed to fetch payment information'}), 500



# ===== USER CRUD ENDPOINTS =====

@admin_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a new user (Admin only)"""
    user_id = int(get_jwt_identity())
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
    current_user_id = int(get_jwt_identity())
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
    """Delete a user with comprehensive cascade deletion (Admin only)"""
    current_user_id = int(get_jwt_identity())
    current_user = User.query.get(current_user_id)

    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Prevent deleting the last admin or yourself
    if user.role == 'admin':
        admin_count = User.query.filter_by(role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot delete the last admin user'}), 400
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400

    try:
        related_deletions = []

        # Get all parents for this user
        parents = Parent.query.filter_by(user_id=user_id).all()
        
        for parent in parents:
            # Get all students for this parent
            students = Student.query.filter_by(parent_id=parent.id).all()
            
            for student in students:
                # Delete all student-related records
                attendance_count = Attendance.query.filter_by(student_id=student.id).delete(synchronize_session=False)
                enrollment_count = Enrollment.query.filter_by(student_id=student.id).delete(synchronize_session=False)
                section_enrollment_count = SectionEnrollment.query.filter_by(student_id=student.id).delete(synchronize_session=False)
                registration_count = Registration.query.filter_by(student_id=student.id).delete(synchronize_session=False)
                
                if attendance_count > 0:
                    related_deletions.append(f"{attendance_count} attendance records for student {student.name}")
                if enrollment_count > 0:
                    related_deletions.append(f"{enrollment_count} enrollments for student {student.name}")
                if section_enrollment_count > 0:
                    related_deletions.append(f"{section_enrollment_count} section enrollments for student {student.name}")
                if registration_count > 0:
                    related_deletions.append(f"{registration_count} registrations for student {student.name}")
                
                # Delete the student
                db.session.delete(student)
                related_deletions.append(f"Student: {student.name}")
            
            # Delete the parent
            db.session.delete(parent)
            related_deletions.append(f"Parent: {parent.full_name}")

        # Delete all direct registrations for this user
        direct_registration_count = Registration.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        if direct_registration_count > 0:
            related_deletions.append(f"{direct_registration_count} direct registrations")

        # Delete user settings
        user_settings = UserSettings.query.filter_by(user_id=user_id).first()
        if user_settings:
            db.session.delete(user_settings)
            related_deletions.append("User settings")

        # Delete contact messages
        contact_message_count = ContactMessage.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        if contact_message_count > 0:
            related_deletions.append(f"{contact_message_count} contact messages")

        # Delete notifications
        notification_count = Notification.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        if notification_count > 0:
            related_deletions.append(f"{notification_count} notifications")

        # Delete audit logs (optional - keeping them commented for compliance)
        # audit_log_count = AuditLog.query.filter_by(user_id=user_id).delete(synchronize_session=False)
        # if audit_log_count > 0:
        #     related_deletions.append(f"{audit_log_count} audit logs")

        # Finally delete the user
        db.session.delete(user)
        db.session.commit()
        
        logger.info(f"Successfully deleted user ID {user_id} by user {current_user_id}. Related deletions: {related_deletions}")
        
        return jsonify({
            'message': 'User and all associated records deleted successfully',
            'deleted_records': related_deletions,
            'user_id': user_id,
            'deleted_by': current_user_id
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting user {user_id}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({
            'error': 'Failed to delete user and associated records',
            'details': str(e),
            'type': type(e).__name__
        }), 500

@admin_bp.route('/users/<int:user_id>/toggle-role', methods=['PUT'])
@jwt_required()
def toggle_user_role(user_id):
    """Toggle user role between admin and user (Admin only)"""
    current_user_id = int(get_jwt_identity())
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
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    logger.info(f"Payment status update request for registration {registration_id}: {data}")

    if not data or 'payment_status' not in data:
        logger.error(f"Missing payment_status in request data: {data}")
        return jsonify({'error': 'Payment status is required'}), 400

    payment_status = data['payment_status']

    # Map frontend status values to backend database values
    status_mapping = {
        'paid': 'paid',
        'unpaid': 'unpaid',
        'partial': 'partial',
        'pending': 'unpaid',  # Map pending to unpaid
        'overdue': 'unpaid'   # Map overdue to unpaid
    }

    if payment_status not in status_mapping:
        logger.error(f"Invalid payment status: {payment_status}")
        return jsonify({'error': 'Invalid payment status. Must be: unpaid, paid, partial, pending, or overdue'}), 400

    # Convert to database value
    db_payment_status = status_mapping[payment_status]

    # Get enrollment instead of registration
    enrollment = Enrollment.query.get(registration_id)
    if not enrollment:
        logger.error(f"Enrollment not found: {registration_id}")
        return jsonify({'error': 'Enrollment not found'}), 404

    logger.info(f"Enrollment {registration_id} active: {enrollment.is_active}, monthly_payment_status: {enrollment.monthly_payment_status}")

    if not enrollment.is_active:
        logger.error(f"Cannot update payment status for inactive enrollment: active={enrollment.is_active}")
        return jsonify({'error': 'Can only update payment status for active enrollments'}), 400

    # Update monthly payment status only
    old_status = enrollment.monthly_payment_status
    enrollment.monthly_payment_status = db_payment_status

    # Set payment date if status is paid
    from datetime import datetime
    if db_payment_status == 'paid':
        enrollment.last_payment_date = get_algerian_time()
        # Reset sessions counter for next month
        enrollment.monthly_sessions_attended = 0
    elif db_payment_status == 'pending':
        enrollment.last_payment_date = None

    db.session.commit()
    logger.info(f"Payment status updated from {old_status} to {db_payment_status} for enrollment {registration_id}")

    return jsonify({
        'message': f'Payment status updated from {old_status} to {payment_status}',
        'registration_id': registration_id,
        'payment_status': db_payment_status,
        'payment_date': enrollment.last_payment_date.isoformat() if enrollment.last_payment_date else None
    }), 200

@admin_bp.route('/enrollments/<int:enrollment_id>/change-section', methods=['POST'])
@jwt_required()
def change_student_section(enrollment_id):
    """Change a student's section (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    if not data or 'new_section_id' not in data:
        return jsonify({'error': 'New section ID is required'}), 400

    new_section_id = data['new_section_id']

    # Get current enrollment
    enrollment = Enrollment.query.get(enrollment_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    # Get new section
    new_section = Class.query.get(new_section_id)
    if not new_section:
        return jsonify({'error': 'New section not found'}), 404

    # Check if new section belongs to same course
    if new_section.course_id != enrollment.class_.course_id:
        return jsonify({'error': 'New section must belong to the same course'}), 400

    # Check if new section has capacity
    if new_section.current_students >= new_section.max_students:
        return jsonify({'error': 'New section is at full capacity'}), 400

    # Update enrollment
    old_section = enrollment.class_
    enrollment.class_id = new_section_id
    enrollment.enrollment_date = datetime.utcnow()  # Update enrollment date

    # Update student counts
    old_section.current_students -= 1
    new_section.current_students += 1

    db.session.commit()

    return jsonify({
        'message': f'Student moved from section {old_section.name} to {new_section.name}',
        'enrollment_id': enrollment_id,
        'old_section': {
            'id': old_section.id,
            'name': old_section.name,
            'current_students': old_section.current_students
        },
        'new_section': {
            'id': new_section.id,
            'name': new_section.name,
            'current_students': new_section.current_students
        }
    }), 200

@admin_bp.route('/users/<int:user_id>/reset-password', methods=['POST'])
@jwt_required()
def reset_user_password(user_id):
    """Reset user password (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Generate new password
    new_password = secrets.token_hex(8)
    user.password_hash = hash_password(new_password)
    db.session.commit()

    return jsonify({
        'message': 'Password reset successfully',
        'new_password': new_password
    }), 200

@admin_bp.route('/parents/<int:parent_id>/reset-password', methods=['POST'])
@jwt_required()
def reset_parent_password(parent_id):
    """Reset parent password (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = Parent.query.get(parent_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # Reset user password
    user = parent.user
    if user:
        new_password = secrets.token_hex(8)
        user.password_hash = hash_password(new_password)
        db.session.commit()

        return jsonify({
            'message': 'Parent password reset successfully',
            'new_password': new_password
        }), 200
    else:
        return jsonify({'error': 'Parent has no associated user'}), 400

@admin_bp.route('/students/<int:student_id>/reset-password', methods=['POST'])
@jwt_required()
def reset_student_password(student_id):
    """Reset student mobile password (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # Generate new mobile password
    new_password = secrets.token_hex(8)
    student.mobile_password_hash = hash_password(new_password)
    db.session.commit()

    return jsonify({
        'message': 'Student mobile password reset successfully',
        'new_password': new_password
    }), 200

@admin_bp.route('/users/<int:user_id>/credentials', methods=['GET'])
@jwt_required()
def get_user_credentials(user_id):
    """Get user credentials (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get associated parent if exists
    parent = Parent.query.filter_by(user_id=user_id).first()

    credentials = {
        'user_id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'phone': user.phone,
        'role': user.role,
        'password_hash': user.password_hash,  # Keep hashed for web login security
        'parent_info': None
    }

    if parent:
        credentials['parent_info'] = {
            'id': parent.id,
            'mobile_username': parent.mobile_username,
            'mobile_app_enabled': parent.mobile_app_enabled
        }

    return jsonify(credentials), 200

@admin_bp.route('/parents/<int:parent_id>/credentials', methods=['GET'])
@jwt_required()
def get_parent_credentials(parent_id):
    """Get parent credentials (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    parent = Parent.query.get(parent_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    credentials = {
        'parent_id': parent.id,
        'full_name': parent.full_name,
        'email': parent.email,
        'phone': parent.phone,
        'mobile_username': parent.mobile_username,
        'mobile_password': parent.mobile_password_plain,  # Return unhashed password
        'mobile_app_enabled': parent.mobile_app_enabled,
        'user_credentials': None
    }

    if parent.user:
        credentials['user_credentials'] = {
            'id': parent.user.id,
            'email': parent.user.email,
            'phone': parent.user.phone,
            'password': parent.user.password_hash  # Keep hashed for web login
        }

    # Get students
    students = []
    for student in parent.students:
        students.append({
            'id': student.id,
            'name': student.name,
            'mobile_username': student.mobile_username,
            'mobile_password': student.mobile_password_plain,  # Return unhashed password
            'mobile_app_enabled': student.mobile_app_enabled
        })

    credentials['students'] = students

    return jsonify(credentials), 200

@admin_bp.route('/students/<int:student_id>/credentials', methods=['GET'])
@jwt_required()
def get_student_credentials(student_id):
    """Get student credentials (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    credentials = {
        'student_id': student.id,
        'name': student.name,
        'email': student.user.email if student.user else None,
        'phone': student.user.phone if student.user else None,
        'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
        'mobile_username': student.mobile_username,
        'mobile_password': student.mobile_password_plain,  # Return unhashed password
        'mobile_app_enabled': student.mobile_app_enabled,
        'parent_info': None
    }

    if student.parent:
        credentials['parent_info'] = {
            'id': student.parent.id,
            'full_name': student.parent.full_name,
            'email': student.parent.email,
            'phone': student.parent.phone,
            'mobile_username': student.parent.mobile_username,
            'mobile_password': student.parent.mobile_password_plain  # Return unhashed password
        }

    return jsonify(credentials), 200

@admin_bp.route('/enrollments/<int:enrollment_id>/course-details', methods=['GET'])
@jwt_required()
def get_enrollment_course_details(enrollment_id):
    """Get detailed course information for an enrollment (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    enrollment = Enrollment.query.get(enrollment_id)
    if not enrollment:
        return jsonify({'error': 'Enrollment not found'}), 404

    course_details = {
        'enrollment_id': enrollment.id,
        'student': {
            'id': enrollment.student.id,
            'name': enrollment.student.name
        },
        'class': {
            'id': enrollment.class_.id,
            'name': enrollment.class_.name,
            'schedule': enrollment.class_.schedule
        },
        'course': {
            'id': enrollment.class_.course.id,
            'name': enrollment.class_.course.name,
            'description': enrollment.class_.course.description,
            'price': enrollment.class_.course.price,
            'category': enrollment.class_.course.category
        },
        'enrollment_info': {
            'enrollment_date': enrollment.enrollment_date.isoformat(),
            'is_active': enrollment.is_active,
            'payment_type': enrollment.payment_type,
            'last_payment_date': enrollment.last_payment_date.isoformat() if enrollment.last_payment_date else None,
            'next_payment_due': enrollment.next_payment_due.isoformat() if enrollment.next_payment_due else None,
            'monthly_payment_status': enrollment.monthly_payment_status
        }
    }

    return jsonify(course_details), 200



@admin_bp.route('/payments/reset-all', methods=['POST'])
@jwt_required()
def reset_all_payments():
    """Reset all student payments for synchronized monthly cycles (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        data = request.get_json() or {}
        confirm_reset = data.get('confirm', False)

        if not confirm_reset:
            return jsonify({
                'error': 'Confirmation required. This will reset all monthly payment cycles.',
                'message': 'Add "confirm": true to proceed with resetting all student payments.'
            }), 400

        # Get all active enrollments with monthly payment type
        monthly_enrollments = Enrollment.query.filter_by(
            payment_type='monthly',
            is_active=True
        ).all()

        reset_count = 0
        students_affected = []

        for enrollment in monthly_enrollments:
            # Reset monthly payment tracking
            enrollment.monthly_sessions_attended = 0
            enrollment.monthly_payment_status = 'pending'

            reset_count += 1
            students_affected.append({
                'student_id': enrollment.student_id,
                'student_name': enrollment.student.name if enrollment.student else 'Unknown',
                'class_name': enrollment.class_.name if enrollment.class_ else 'Unknown'
            })

        # Reset session-based payment statuses in attendance records
        # Note: Payment status is no longer tracked per session, only at enrollment level

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Successfully reset payment cycles for {reset_count} students',
            'students_affected': students_affected,
            'reset_summary': {
                'monthly_enrollments_reset': reset_count,
                'session_payments_reset': 0  # No longer applicable
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error resetting payments: {str(e)}")
        return jsonify({'error': f'Failed to reset payments: {str(e)}'}), 500

@admin_bp.route('/payments/mark-paid/<int:enrollment_id>', methods=['POST'])
@jwt_required()
def mark_payment_paid_by_enrollment_id(enrollment_id):
    """Mark a specific enrollment payment as paid (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        enrollment = Enrollment.query.get(enrollment_id)
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        data = request.get_json() or {}
        payment_type = data.get('payment_type', 'monthly')  # 'monthly' or 'registration'

        if payment_type == 'monthly':
            enrollment.monthly_payment_status = 'paid'
            enrollment.monthly_sessions_attended = 0  # Reset counter after payment
            message = 'Monthly payment marked as paid'
        else:
            return jsonify({'error': 'Invalid payment type. Use "monthly"'}), 400

        db.session.commit()

        return jsonify({
            'success': True,
            'message': message,
            'student_name': enrollment.student.name if enrollment.student else 'Unknown',
            'class_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
            'payment_type': payment_type
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking payment as paid: {str(e)}")
        return jsonify({'error': f'Failed to mark payment: {str(e)}'}), 500

@admin_bp.route('/payments/status', methods=['GET'])
@jwt_required()
def get_payment_status():
    """Get payment status overview for all students (Admin only)"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get all active enrollments
        enrollments = Enrollment.query.filter_by(is_active=True).all()

        payment_summary = {
            'total_students': len(enrollments),
            'monthly_payments': {
                'pending_registration': 0,
                'pending_monthly': 0,
                'all_paid': 0
            },
            'session_payments': {
                'total': 0,
                'paid': 0,
                'pending': 0
            },
            'students': []
        }

        for enrollment in enrollments:
            student_info = {
                'student_id': enrollment.student_id,
                'student_name': enrollment.student.name if enrollment.student else 'Unknown',
                'class_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
                'payment_type': enrollment.payment_type,
                'monthly_payment_status': enrollment.monthly_payment_status if enrollment.payment_type == 'monthly' else None,
                'monthly_sessions_attended': enrollment.monthly_sessions_attended if enrollment.payment_type == 'monthly' else None,
                'progress_percentage': enrollment.progress_percentage if enrollment.payment_type == 'monthly' else None
            }

            payment_summary['students'].append(student_info)

            if enrollment.payment_type == 'monthly':
                if (enrollment.monthly_sessions_attended or 0) >= 4 and enrollment.monthly_payment_status != 'paid':
                    payment_summary['monthly_payments']['pending_monthly'] += 1
                else:
                    payment_summary['monthly_payments']['all_paid'] += 1
            else:
                payment_summary['session_payments']['total'] += 1
                # For session payments, we don't track individual status in summary

        return jsonify({
            'success': True,
            'payment_summary': payment_summary
        }), 200

    except Exception as e:
        logger.error(f"Error getting payment status: {str(e)}")
        return jsonify({'error': f'Failed to get payment status: {str(e)}'}), 500


@admin_bp.route('/students/detailed', methods=['GET'])
@jwt_required()
@db_retry(max_retries=2, delay=1)
def get_students_detailed():
    """Get detailed student information for admin table view with enrollments, attendance, and payments"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        # Get section filter if provided
        section_id = request.args.get('section_id')
        
        # Create aliases for the two User joins
        parent_user = aliased(User)
        student_user = aliased(User)
        
        # Base query for students with their parent information AND student user accounts
        students_query = db.session.query(
            Student,
            Parent,
            parent_user,  # Parent's user account
            student_user  # Student's user account (for barcode login)
        ).outerjoin(
            Parent, Student.parent_id == Parent.id
        ).outerjoin(
            parent_user, Parent.user_id == parent_user.id  # Parent's user account
        ).outerjoin(
            student_user, Student.user_id == student_user.id  # Student's user account
        )

        # If section filter is applied, filter students enrolled in that section
        if section_id and section_id != 'all':
            students_query = students_query.join(
                Enrollment, Student.id == Enrollment.student_id
            ).filter(
                Enrollment.class_id == int(section_id),
                Enrollment.is_active == True
            )

        students_data = []
        
        # Execute the query
        students_result = students_query.all()
        
        # Get all student IDs for bulk queries
        student_ids = [student.id for student, _, _, _ in students_result]
        
        # Bulk fetch all enrollments for these students
        all_enrollments = db.session.query(
            Enrollment,
            Class,
            Course
        ).join(
            Class, Enrollment.class_id == Class.id
        ).join(
            Course, Class.course_id == Course.id
        ).filter(
            Enrollment.student_id.in_(student_ids),
            Enrollment.is_active == True
        ).all() if student_ids else []
        
        # Group enrollments by student ID
        enrollments_by_student = {}
        for enrollment, class_obj, course in all_enrollments:
            if enrollment.student_id not in enrollments_by_student:
                enrollments_by_student[enrollment.student_id] = []
            enrollments_by_student[enrollment.student_id].append((enrollment, class_obj, course))
        
        # Bulk fetch attendance counts
        attendance_counts = {}
        if student_ids:
            # Get total sessions per student per class
            total_sessions_query = db.session.query(
                Attendance.student_id,
                Attendance.class_id,
                func.count(Attendance.id).label('total_sessions')
            ).filter(
                Attendance.student_id.in_(student_ids)
            ).group_by(Attendance.student_id, Attendance.class_id).all()
            
            # Get attended sessions per student per class
            attended_sessions_query = db.session.query(
                Attendance.student_id,
                Attendance.class_id,
                func.count(Attendance.id).label('attended_sessions')
            ).filter(
                Attendance.student_id.in_(student_ids),
                Attendance.status == 'present'
            ).group_by(Attendance.student_id, Attendance.class_id).all()
            
            # Process attendance data
            for student_id, class_id, total in total_sessions_query:
                key = (student_id, class_id)
                if key not in attendance_counts:
                    attendance_counts[key] = {'total': 0, 'attended': 0}
                attendance_counts[key]['total'] = total
            
            for student_id, class_id, attended in attended_sessions_query:
                key = (student_id, class_id)
                if key not in attendance_counts:
                    attendance_counts[key] = {'total': 0, 'attended': 0}
                attendance_counts[key]['attended'] = attended
        
        for student, parent, parent_user, student_user in students_result:
            # Get the phone number with priority: student's user account > parent's user account > parent's phone field
            phone_number = None
            if student_user and hasattr(student_user, 'phone') and student_user.phone:
                phone_number = student_user.phone
            elif parent_user and hasattr(parent_user, 'phone') and parent_user.phone:
                phone_number = parent_user.phone
            elif parent and hasattr(parent, 'phone') and parent.phone:
                phone_number = parent.phone
            
            # Fallback to 'N/A' if no phone number found
            if not phone_number:
                phone_number = 'N/A'
                
            # Get enrollments for this student from our bulk fetch
            enrollments = enrollments_by_student.get(student.id, [])

            enrollment_data = []
            for enrollment, class_obj, course in enrollments:
                # Get attendance data from bulk fetch
                attendance_key = (student.id, class_obj.id)
                attendance_data = attendance_counts.get(attendance_key, {'total': 0, 'attended': 0})
                total_sessions = attendance_data.get('total', 0) if attendance_data else 0
                attended_sessions = attendance_data.get('attended', 0) if attendance_data else 0
                
                # Ensure values are not None
                total_sessions = total_sessions or 0
                attended_sessions = attended_sessions or 0
                
                attendance_rate = round((attended_sessions / total_sessions * 100) if total_sessions > 0 else 0, 1)

                enrollment_data.append({
                    'enrollment_id': enrollment.id,
                    'section_id': class_obj.id,
                    'section_name': class_obj.name,
                    'course_name': course.name,
                    'course_id': course.id,
                    'pricing_type': course.pricing_type or 'session',  # Use pricing_type field to identify session vs monthly
                    'payment_type': enrollment.payment_type,
                    'enrollment_status': enrollment.status,  # Approval status (pending/approved/rejected)
                    'monthly_payment_status': enrollment.monthly_payment_status,
                    'monthly_sessions_attended': enrollment.monthly_sessions_attended or 0,  # Add monthly sessions
                    'attendance_rate': attendance_rate,
                    'sessions_attended': attended_sessions,
                    'total_sessions': total_sessions,
                    'schedule': class_obj.schedule if hasattr(class_obj, 'schedule') else f"{class_obj.day_of_week} {class_obj.start_time}-{class_obj.end_time}",
                    'section': {
                        'id': class_obj.id,
                        'name': class_obj.name,
                        'day_of_week': class_obj.day_of_week,
                        'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
                        'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
                    }
                })

            # Build payment status info (only attendance-based payments)
            payment_status = []
            for enrollment, _, course in enrollments:
                payment_info = {
                    'section_id': enrollment.class_id,
                    'course_name': course.name,
                    'pricing_type': course.pricing_type or 'session',  # Use pricing_type field to identify session vs monthly
                    'payment_type': enrollment.payment_type,
                    'monthly_sessions_attended': enrollment.monthly_sessions_attended or 0,  # Add monthly sessions
                    'amount': float(course.price) if course.price else 0
                }
                
                if enrollment.payment_type == 'monthly' and enrollment.monthly_payment_status:
                    payment_info['monthly_status'] = enrollment.monthly_payment_status
                    # Safely handle None values with COALESCE-like pattern
                    sessions_attended = enrollment.monthly_sessions_attended or 0
                    if sessions_attended >= 4 and enrollment.monthly_payment_status != 'paid':
                        payment_info['status'] = 'due'
                    else:
                        payment_info['status'] = 'ok'
                else:
                    payment_info['status'] = 'session-based'  # Pay per session

                payment_status.append(payment_info)

            student_data = {
                'id': student.id,
                'name': student.name,
                'email': parent.email if parent else None,
                'phone': parent.phone if parent else None,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'profile_picture_url': student_user.profile_picture_url if student_user else None,
                'status': {
                    'is_enrolled': len(enrollment_data) > 0,
                    'mobile_access': student.mobile_app_enabled if student.mobile_app_enabled is not None else False,
                    'has_parent': parent is not None
                },
                'enrollments': enrollment_data,
                'payment_status': payment_status,
                'parent': {
                    'id': parent.id if parent else None,
                    'name': parent.full_name if parent else None,
                    'email': parent.email if parent else None,
                    'phone': parent.phone if parent else None,
                    'profile_picture_url': parent_user.profile_picture_url if parent_user else None,
                    'mobile_username': parent.mobile_username if parent else None,
                    'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
                    'user_role': parent_user.role if parent_user else 'N/A',
                    'user_email_verified': parent_user.email_verified if parent_user else False
                } if parent else None
            }

            students_data.append(student_data)

        return jsonify({
            'success': True,
            'students': students_data,
            'total_count': len(students_data)
        }), 200

    except Exception as e:
        logger.error(f"Error getting detailed students: {str(e)}")
        return jsonify({'error': f'Failed to get detailed students: {str(e)}'}), 500


@admin_bp.route('/sections/current', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_current_sections():
    """Get currently active sections based on day and time"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from datetime import datetime, timedelta
        
        # Get current day and time parameters
        current_day = request.args.get('day', datetime.now().strftime('%A').lower())
        current_time = request.args.get('time', datetime.now().strftime('%H%M'))  # Format: HHMM
        
        # Convert time to minutes for easier comparison
        if isinstance(current_time, str) and len(current_time) == 4:
            current_time_minutes = int(current_time[:2]) * 60 + int(current_time[2:])
        else:
            # Default to current time
            now = datetime.now()
            current_time_minutes = now.hour * 60 + now.minute

        # Define tolerance window (e.g., 15 minutes before and after)
        time_tolerance = 15  # minutes
        
        # Query for sections that match the current day and are within the time window
        sections_query = db.session.query(
            Class,
            Course.name.label('course_name'),
            Course.category.label('course_category'),
            func.count(Enrollment.id).label('enrollment_count')
        ).join(
            Course, Class.course_id == Course.id
        ).outerjoin(
            Enrollment,
            (Enrollment.class_id == Class.id) & (Enrollment.is_active == True)
        ).filter(
            Course.is_active == True,
            Class.is_active == True,
            func.lower(Class.day_of_week) == current_day.lower()
        ).group_by(Class.id, Course.name, Course.category).all()

        current_sections = []
        all_sections = []
        for section, course_name, course_category, enrollment_count in sections_query:
            # Convert section time to minutes for comparison
            if section.start_time and section.end_time:
                start_minutes = section.start_time.hour * 60 + section.start_time.minute
                end_minutes = section.end_time.hour * 60 + section.end_time.minute
                
                # Check if current time is within the session window (with tolerance)
                is_current = (start_minutes - time_tolerance <= current_time_minutes <= end_minutes + time_tolerance)
                
                section_data = {
                    'id': section.id,
                    'course_id': section.course_id,
                    'course_name': course_name,
                    'course_category': course_category,
                    'section_name': section.name,
                    'day_of_week': section.day_of_week,
                    'start_time': section.start_time.strftime('%H:%M'),
                    'end_time': section.end_time.strftime('%H:%M'),
                    'max_students': section.max_students,
                    'current_students': enrollment_count,
                    'is_current_session': is_current,
                    'time_status': 'current' if is_current else 'scheduled'
                }
                
                # Add to all sections
                all_sections.append(section_data)
                
                # Add to current sections if it's currently active
                if is_current:
                    current_sections.append(section_data)

        return jsonify({
            'success': True,
            'sections': all_sections,  # All sections for the day
            'current_sections': current_sections,  # Only currently active sections
            'query_info': {
                'day': current_day,
                'time': current_time,
                'time_minutes': current_time_minutes,
                'tolerance_minutes': time_tolerance
            }
        }), 200

    except Exception as e:
        logger.error(f"Error getting current sections: {str(e)}")
        return jsonify({'error': f'Failed to get current sections: {str(e)}'}), 500

@admin_bp.route('/contact-messages', methods=['GET'])
@jwt_required()
def get_contact_messages_admin():
    """Get all contact messages for admin dashboard"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from models import ContactMessage
        
        # Get query parameters
        status_filter = request.args.get('status', 'all')
        limit = int(request.args.get('limit', 50))

        query = ContactMessage.query
        if status_filter != 'all':
            query = query.filter_by(status=status_filter)
        
        messages = query.order_by(ContactMessage.created_at.desc()).limit(limit).all()

        messages_data = []
        for msg in messages:
            messages_data.append({
                'id': msg.id,
                'user_id': msg.user_id,
                'user_name': msg.user.full_name,
                'user_email': msg.user.email,
                'subject': msg.subject,
                'message': msg.message,
                'status': msg.status,
                'admin_response': msg.admin_response,
                'admin_response_at': msg.admin_response_at.isoformat() if msg.admin_response_at else None,
                'created_at': msg.created_at.isoformat(),
                'updated_at': msg.updated_at.isoformat() if msg.updated_at else None
            })

        return jsonify({'messages': messages_data}), 200

    except Exception as e:
        logger.error(f"Error getting contact messages: {str(e)}")
        return jsonify({'error': 'Failed to get contact messages'}), 500

@admin_bp.route('/contact-messages/<int:message_id>/respond', methods=['POST'])
@jwt_required()
def respond_to_contact_message(message_id):
    """Admin respond to a contact message"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from models import ContactMessage
        from datetime import datetime
        
        data = request.get_json()
        response_text = data.get('response')
        
        if not response_text:
            return jsonify({'error': 'Response text is required'}), 400

        message = ContactMessage.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404

        message.admin_response = response_text
        message.admin_response_at = datetime.utcnow()
        message.status = 'responded'
        db.session.commit()

        # Send email notification to user
        try:
            send_admin_response_email(message, user)
        except Exception as e:
            print(f"Email notification failed: {e}")

        return jsonify({'message': 'Response sent successfully'}), 200

    except Exception as e:
        logger.error(f"Error responding to contact message: {str(e)}")
        return jsonify({'error': 'Failed to send response'}), 500


# New endpoints for course type support and bulk operations


@admin_bp.route('/payments/mark', methods=['POST'])
@jwt_required()
def mark_payment():
    """Mark payment for a student with course type support"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_id = data.get('student_id')
    section_id = data.get('section_id')
    amount = data.get('amount')

    if not student_id or not section_id:
        return jsonify({'error': 'Student ID and section ID are required'}), 400

    try:
        # Get enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=section_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this section'}), 404
        
        # Get course to determine pricing type
        section = Class.query.get(section_id)
        if not section:
            return jsonify({'error': 'Section not found'}), 404
            
        course = Course.query.get(section.course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        pricing_type = course.course_type or 'session'  # Use course_type from database

        if pricing_type == 'monthly':
            # Monthly course payment logic
            if (enrollment.monthly_sessions_attended or 0) >= 4 and enrollment.monthly_payment_status != 'paid':
                enrollment.monthly_payment_status = 'paid'
                # Reset monthly sessions for next month
                enrollment.monthly_sessions_attended = 0
                message = 'Monthly payment marked as paid and sessions reset'
            else:
                return jsonify({'error': 'No payment due for this student'}), 400
        else:
            # Session-based payment logic - mark monthly payment as paid
            enrollment.monthly_payment_status = 'paid'
            message = 'Payment marked as paid'

        db.session.commit()

        return jsonify({
            'message': message,
            'pricing_type': pricing_type,
            'monthly_sessions_attended': enrollment.monthly_sessions_attended if pricing_type == 'monthly' else None
        }), 200

    except Exception as e:
        logger.error(f"Error marking payment: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to mark payment: {str(e)}'}), 500


@admin_bp.route('/payments/quick', methods=['POST'])
@jwt_required()
def quick_payment():
    """Process quick payment for a student"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_id = data.get('student_id')
    section_id = data.get('section_id')
    amount = data.get('amount')
    payment_type = data.get('payment_type', 'session')  # Default to session
    payment_date = data.get('payment_date')

    if not student_id or not section_id or amount is None:
        return jsonify({'error': 'Student ID, section ID, and amount are required'}), 400

    try:
        # Get enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=section_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this section'}), 404

        # Get course to determine pricing
        section = Class.query.get(section_id)
        if not section:
            return jsonify({'error': 'Section not found'}), 404

        course = Course.query.get(section.course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        # Process payment based on type
        response_data = {}

        if payment_type == 'monthly':
            # Monthly payment logic
            if (enrollment.monthly_sessions_attended or 0) >= 4 and enrollment.monthly_payment_status != 'paid':
                # This is monthly payment after 4 sessions
                enrollment.monthly_payment_status = 'paid'
                enrollment.last_payment_date = datetime.utcnow()
                # Reset monthly sessions for next month
                old_progress = enrollment.monthly_sessions_attended or 0
                enrollment.monthly_sessions_attended = 0
                response_data['message'] = f'Monthly payment processed successfully - cycle reset from {old_progress}/4 to 0/4'
                response_data['cycle_reset'] = True
                response_data['new_progress'] = 0
                response_data['payment_type'] = 'monthly'
            else:
                return jsonify({'error': 'No monthly payment due for this student'}), 400
        else:
            # Session payment logic - mark as paid and clear any debt
            enrollment.monthly_payment_status = 'paid'
            enrollment.last_payment_date = datetime.utcnow()

            # Clear debt if any
            if enrollment.total_debt > 0:
                enrollment.total_debt = 0
                enrollment.debt_sessions = 0

            response_data['message'] = 'Session payment processed successfully'
            response_data['payment_type'] = 'session'

        # Log the payment
        audit_log = AuditLog(
            user_id=user_id,
            action='quick_payment',
            resource_type='enrollment',
            resource_id=enrollment.id,
            details=json.dumps({
                'student_id': student_id,
                'section_id': section_id,
                'amount': amount,
                'payment_type': payment_type,
                'course_name': course.name,
                'processed_by': user.full_name
            })
        )
        db.session.add(audit_log)

        db.session.commit()

        return jsonify(response_data), 200

    except Exception as e:
        logger.error(f"Error processing quick payment: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to process payment: {str(e)}'}), 500


@admin_bp.route('/bulk/clear-attendance', methods=['POST'])
@jwt_required()
def bulk_clear_attendance():
    """Bulk clear attendance for selected students"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_ids = data.get('student_ids', [])

    if not student_ids:
        return jsonify({'error': 'Student IDs are required'}), 400

    try:
        cleared_count = 0
        
        for student_id in student_ids:
            # Clear all attendance records for this student
            attendance_records = Attendance.query.filter_by(student_id=student_id).all()
            for record in attendance_records:
                db.session.delete(record)
            
            # Reset monthly sessions for monthly courses
            enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).all()
            for enrollment in enrollments:
                if enrollment.payment_type == 'monthly':
                    enrollment.monthly_sessions_attended = 0
            
            cleared_count += 1

        db.session.commit()

        return jsonify({
            'message': f'Attendance cleared for {cleared_count} students',
            'cleared_count': cleared_count
        }), 200

    except Exception as e:
        logger.error(f"Error clearing attendance: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to clear attendance: {str(e)}'}), 500


@admin_bp.route('/bulk/clear-payments', methods=['POST'])
@jwt_required()
def bulk_clear_payments():
    """Bulk clear payments for selected students"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_ids = data.get('student_ids', [])

    if not student_ids:
        return jsonify({'error': 'Student IDs are required'}), 400

    try:
        cleared_count = 0
        
        for student_id in student_ids:
            # Reset payment status for all enrollments
            enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).all()
            for enrollment in enrollments:
                enrollment.monthly_payment_status = 'pending'
            
            cleared_count += 1

        db.session.commit()

        return jsonify({
            'message': f'Payments cleared for {cleared_count} students',
            'cleared_count': cleared_count
        }), 200

    except Exception as e:
        logger.error(f"Error clearing payments: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to clear payments: {str(e)}'}), 500


@admin_bp.route('/bulk/clear-both', methods=['POST'])
@jwt_required()
def bulk_clear_both():
    """Bulk clear both attendance and payments for selected students"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_ids = data.get('student_ids', [])

    if not student_ids:
        return jsonify({'error': 'Student IDs are required'}), 400

    try:
        cleared_count = 0
        
        for student_id in student_ids:
            # Clear all attendance records
            attendance_records = Attendance.query.filter_by(student_id=student_id).all()
            for record in attendance_records:
                db.session.delete(record)
            
            # Reset payment status and monthly sessions for all enrollments
            enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).all()
            for enrollment in enrollments:
                enrollment.monthly_payment_status = 'pending'
                if enrollment.payment_type == 'monthly':
                    enrollment.monthly_sessions_attended = 0
            
            cleared_count += 1

        db.session.commit()

        return jsonify({
            'message': f'Attendance and payments cleared for {cleared_count} students',
            'cleared_count': cleared_count
        }), 200

    except Exception as e:
        logger.error(f"Error clearing attendance and payments: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Failed to clear attendance and payments: {str(e)}'}), 500

# ===== BULK DELETION ENDPOINTS =====

@admin_bp.route('/bulk/delete-students', methods=['POST'])
@jwt_required()
def bulk_delete_students():
    """Bulk delete multiple students (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    student_ids = data.get('student_ids', [])
    force_delete = data.get('force', False)

    if not student_ids:
        return jsonify({'error': 'No student IDs provided'}), 400

    try:
        results = []
        total_related_deletions = []

        for student_id in student_ids:
            student = Student.query.get(student_id)
            if not student:
                results.append(f"Student ID {student_id}: Not found")
                continue

            # Check dependencies if not forcing
            if not force_delete:
                can_delete, dependencies = check_dependencies('student', student_id)
                if not can_delete:
                    results.append(f"Student ID {student_id}: Has dependencies - {', '.join(dependencies)}")
                    continue

            # Delete related records
            attendance_count = Attendance.query.filter_by(student_id=student_id).delete()
            enrollment_count = Enrollment.query.filter_by(student_id=student_id).delete()
            section_enrollment_count = SectionEnrollment.query.filter_by(student_id=student_id).delete()
            registration_count = Registration.query.filter_by(student_id=student_id).delete()

            related_deletions = []
            if attendance_count > 0:
                related_deletions.append(f"{attendance_count} attendances")
            if enrollment_count > 0:
                related_deletions.append(f"{enrollment_count} enrollments")
            if section_enrollment_count > 0:
                related_deletions.append(f"{section_enrollment_count} section enrollments")
            if registration_count > 0:
                related_deletions.append(f"{registration_count} registrations")

            db.session.delete(student)
            results.append(f"Student ID {student_id}: Deleted successfully")
            total_related_deletions.extend(related_deletions)

        db.session.commit()
        
        return jsonify({
            'message': 'Bulk student deletion completed',
            'results': results,
            'total_related_deletions': total_related_deletions
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk student deletion: {str(e)}")
        return jsonify({
            'error': 'Failed to complete bulk student deletion',
            'details': str(e)
        }), 500

@admin_bp.route('/bulk/delete-classes', methods=['POST'])
@jwt_required()
def bulk_delete_classes():
    """Bulk delete multiple classes (Admin only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    class_ids = data.get('class_ids', [])
    force_delete = data.get('force', False)

    if not class_ids:
        return jsonify({'error': 'No class IDs provided'}), 400

    try:
        results = []
        total_related_deletions = []

        for class_id in class_ids:
            class_obj = Class.query.get(class_id)
            if not class_obj:
                results.append(f"Class ID {class_id}: Not found")
                continue

            # Check for active enrollments if not forcing
            if not force_delete:
                active_enrollments = Enrollment.query.filter_by(class_id=class_id, is_active=True).count()
                if active_enrollments > 0:
                    results.append(f"Class ID {class_id}: Has {active_enrollments} active enrollments")
                    continue

            # Delete related records
            attendance_count = Attendance.query.filter_by(class_id=class_id).delete()
            enrollment_count = Enrollment.query.filter_by(class_id=class_id).delete()

            related_deletions = []
            if attendance_count > 0:
                related_deletions.append(f"{attendance_count} attendances")
            if enrollment_count > 0:
                related_deletions.append(f"{enrollment_count} enrollments")

            db.session.delete(class_obj)
            results.append(f"Class ID {class_id}: Deleted successfully")
            total_related_deletions.extend(related_deletions)

        db.session.commit()
        
        return jsonify({
            'message': 'Bulk class deletion completed',
            'results': results,
            'total_related_deletions': total_related_deletions
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk class deletion: {str(e)}")
        return jsonify({
            'error': 'Failed to complete bulk class deletion',
            'details': str(e)
        }), 500

@admin_bp.route('/time/algerian', methods=['GET'])
@jwt_required()
def get_algerian_time_info():
    """Get current Algerian time information for debugging"""
    try:
        algerian_time = get_algerian_time()
        algerian_date = get_algerian_date()
        
        return jsonify({
            'algerian_time': algerian_time.isoformat(),
            'algerian_date': algerian_date.isoformat(),
            'timezone': 'Africa/Algiers (UTC+1)',
            'current_hour': algerian_time.hour,
            'current_minute': algerian_time.minute,
            'current_weekday': algerian_time.weekday(),  # 0=Monday
            'weekday_name': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][algerian_time.weekday()],
            'formatted_time': algerian_time.strftime('%H:%M:%S'),
            'formatted_date': algerian_date.strftime('%Y-%m-%d')
        }), 200
    except Exception as e:
        logger.error(f"Error getting Algerian time: {str(e)}")
        return jsonify({
            'error': 'Failed to get time information',
            'details': str(e)
        }), 500

@admin_bp.route('/registrations', methods=['GET'])
@jwt_required()
def get_pending_registrations():
    """Get all course enrollments for pending registrations management"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        # Get detailed enrollment information from enrollments table
        query = text("""
        SELECT
            e.id,
            u.full_name,
            SUBSTRING_INDEX(u.full_name, ' ', 1) as first_name,
            SUBSTRING_INDEX(u.full_name, ' ', -1) as last_name,
            u.email,
            u.phone,
            p.full_name as parent_name,
            p.phone as parent_phone,
            s.name as student_name,
            s.date_of_birth,
            YEAR(CURDATE()) - YEAR(s.date_of_birth) - (RIGHT(CURDATE(), 5) < RIGHT(s.date_of_birth, 5)) as age,
            c.id as course_id,
            c.name as course_name,
            c.price,
            e.enrollment_date as registration_date,
            COALESCE(e.status, 'pending') as status,
            e.monthly_payment_status as payment_status,
            e.rejection_reason as rejection_reason,
            DATE_FORMAT(e.enrollment_date, '%Y-%m-%d %H:%i:%s') as formatted_date,
            cls.name as class_name,
            CASE 
                WHEN cls.day_of_week IS NOT NULL AND cls.day_of_week != -1 AND cls.start_time IS NOT NULL AND cls.end_time IS NOT NULL THEN
                    CONCAT(
                        CASE cls.day_of_week
                            WHEN 0 THEN 'Mon'
                            WHEN 1 THEN 'Tue'
                            WHEN 2 THEN 'Wed'
                            WHEN 3 THEN 'Thu'
                            WHEN 4 THEN 'Fri'
                            WHEN 5 THEN 'Sat'
                            WHEN 6 THEN 'Sun'
                            ELSE 'Unknown'
                        END,
                        ' ',
                        TIME_FORMAT(cls.start_time, '%H:%i'),
                        '-',
                        TIME_FORMAT(cls.end_time, '%H:%i')
                    )
                ELSE 'TBD'
            END as schedule
        FROM enrollments e
        LEFT JOIN students s ON e.student_id = s.id
        LEFT JOIN parents p ON s.parent_id = p.id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN classes cls ON e.class_id = cls.id
        LEFT JOIN courses c ON cls.course_id = c.id
        ORDER BY e.enrollment_date DESC
        """)

        result = db.session.execute(query)
        registrations = [dict(row._mapping) for row in result]

        # Get unique courses for filtering
        courses_query = text("SELECT DISTINCT id, name FROM courses ORDER BY name")
        courses_result = db.session.execute(courses_query)
        courses = [dict(row._mapping) for row in courses_result]

        return jsonify({
            'success': True,
            'registrations': registrations,
            'courses': courses,
            'total': len(registrations)
        })
        
    except Exception as e:
        logger.error(f"Error fetching registrations: {str(e)}")
        return jsonify({'error': 'Failed to fetch registrations'}), 500

@admin_bp.route('/registrations/action', methods=['POST'])
@jwt_required()
def handle_registration_action():
    """Approve or reject a course enrollment"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.json
        registration_id = data.get('registration_id')
        action = data.get('action')  # 'approve' or 'reject'
        reason = data.get('reason', '')

        if not registration_id or not action:
            return jsonify({'error': 'Registration ID and action are required'}), 400

        if action not in ['approve', 'reject']:
            return jsonify({'error': 'Invalid action'}), 400

        # Get enrollment details
        enrollment = Enrollment.query.get(registration_id)

        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        if action == 'approve':
            # Check if class/course exists
            class_obj = Class.query.get(enrollment.class_id)
            if not class_obj:
                return jsonify({'error': 'Class not found'}), 404

            # Update enrollment status to approved
            enrollment.status = 'approved'
            enrollment.approved_by = user_id
            enrollment.approved_at = get_algerian_time()
            enrollment.is_active = True
            
            # Auto-generate mobile credentials if eligible
            credentials_generated = False
            try:
                credentials_result = auto_generate_mobile_credentials_if_eligible(enrollment.student_id)
                if credentials_result.get('generated'):
                    credentials_generated = True
                    logger.info(f"✅ Auto-generated mobile credentials for student {enrollment.student_id}")
            except Exception as cred_error:
                logger.warning(f"⚠️ Failed to auto-generate credentials: {str(cred_error)}")

            logger.info(f"Enrollment {registration_id} approved by admin {user_id}")

        elif action == 'reject':
            # Update enrollment status to rejected
            enrollment.status = 'rejected'
            enrollment.approved_by = user_id
            enrollment.approved_at = get_algerian_time()
            enrollment.rejection_reason = reason
            enrollment.is_active = False

            logger.info(f"Enrollment {registration_id} rejected by admin {user_id} with reason: {reason}")

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Enrollment {action}d successfully'
        })

    except Exception as e:
        logger.error(f"Error handling registration action: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to process registration action'}), 500

# ===== NEW MOBILE CREDENTIALS AND ENROLLMENT MANAGEMENT ENDPOINTS =====

@admin_bp.route('/students/<int:student_id>/generate-credentials', methods=['POST'])
@jwt_required()
def generate_student_credentials(student_id):
    """Generate mobile app credentials for a student"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Generate student credentials
        student_username, student_password = generate_student_mobile_credentials(student.name)
        
        # Update student with new credentials
        student.mobile_username = student_username
        student.mobile_password_hash = hash_password(student_password)
        student.mobile_password_plain = student_password
        student.mobile_app_enabled = True

        # If student has a parent, generate parent credentials too if they don't have any
        parent_credentials = None
        if student.parent and not student.parent.mobile_username:
            parent_username, parent_password = generate_parent_mobile_credentials(student.parent.full_name)
            student.parent.mobile_username = parent_username
            student.parent.mobile_password_hash = hash_password(parent_password)
            student.parent.mobile_password_plain = parent_password
            student.parent.mobile_app_enabled = True
            
            parent_credentials = {
                'username': parent_username,
                'password': parent_password,
                'phone': student.parent.phone
            }

        db.session.commit()

        response = {
            'success': True,
            'message': 'Mobile credentials generated successfully',
            'student_credentials': {
                'username': student_username,
                'password': student_password,
                'phone': student.parent.phone if student.parent else None
            }
        }
        
        if parent_credentials:
            response['parent_credentials'] = parent_credentials

        return jsonify(response)

    except Exception as e:
        logger.error(f"Error generating student credentials: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to generate credentials'}), 500

@admin_bp.route('/parents/<int:parent_id>/generate-credentials', methods=['POST'])
@jwt_required()
def generate_parent_credentials(parent_id):
    """Generate mobile app credentials for a parent"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        parent = Parent.query.get(parent_id)
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        # Generate parent credentials
        parent_username, parent_password = generate_parent_mobile_credentials(parent.full_name)
        
        # Update parent with new credentials
        parent.mobile_username = parent_username
        parent.mobile_password_hash = hash_password(parent_password)
        parent.mobile_password_plain = parent_password
        parent.mobile_app_enabled = True

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Mobile credentials generated successfully',
            'credentials': {
                'username': parent_username,
                'password': parent_password,
                'phone': parent.phone
            }
        })

    except Exception as e:
        logger.error(f"Error generating parent credentials: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to generate credentials'}), 500

@admin_bp.route('/students/<int:student_id>/regenerate-password', methods=['POST'])
@jwt_required()
def regenerate_student_password(student_id):
    """Regenerate mobile app password for a student"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        if not student.mobile_username:
            return jsonify({'error': 'Student does not have mobile credentials yet'}), 400

        # Generate new password while keeping the same username
        _, new_password = generate_student_mobile_credentials(student.name)
        
        # Update student with new password
        student.mobile_password_hash = hash_password(new_password)
        student.mobile_password_plain = new_password

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Password regenerated successfully',
            'credentials': {
                'username': student.mobile_username,
                'password': new_password,
                'phone': student.parent.phone if student.parent else None
            }
        })

    except Exception as e:
        logger.error(f"Error regenerating student password: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to regenerate password'}), 500

@admin_bp.route('/parents/<int:parent_id>/regenerate-password', methods=['POST'])
@jwt_required()
def regenerate_parent_password(parent_id):
    """Regenerate mobile app password for a parent"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        parent = Parent.query.get(parent_id)
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        if not parent.mobile_username:
            return jsonify({'error': 'Parent does not have mobile credentials yet'}), 400

        # Generate new password while keeping the same username
        _, new_password = generate_parent_mobile_credentials(parent.full_name)
        
        # Update parent with new password
        parent.mobile_password_hash = hash_password(new_password)
        parent.mobile_password_plain = new_password

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Password regenerated successfully',
            'credentials': {
                'username': parent.mobile_username,
                'password': new_password,
                'phone': parent.phone
            }
        })

    except Exception as e:
        logger.error(f"Error regenerating parent password: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to regenerate password'}), 500

@admin_bp.route('/students/<int:student_id>/enroll', methods=['POST'])
@jwt_required()
def enroll_student_in_course(student_id):
    """Enroll a student in a course/class"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    if not data or 'class_id' not in data:
        return jsonify({'error': 'Class ID is required'}), 400

    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        class_obj = Class.query.get(data['class_id'])
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404

        # Check if student is already enrolled in this class
        existing_enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=data['class_id'],
            is_active=True
        ).first()

        if existing_enrollment:
            return jsonify({'error': 'Student is already enrolled in this class'}), 400

        # Create new enrollment
        enrollment = Enrollment(
            student_id=student_id,
            class_id=data['class_id'],
            enrollment_date=get_algerian_time(),
            status='approved',
            approved_by=admin_id,
            approved_at=get_algerian_time(),
            is_active=True
        )

        db.session.add(enrollment)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Student enrolled successfully',
            'enrollment': {
                'id': enrollment.id,
                'class_name': class_obj.name,
                'course_name': class_obj.course.name,
                'enrollment_date': enrollment.enrollment_date.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Error enrolling student: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to enroll student'}), 500

@admin_bp.route('/students/<int:student_id>/unenroll/<int:enrollment_id>', methods=['DELETE'])
@jwt_required()
def unenroll_student_from_course(student_id, enrollment_id):
    """Unenroll a student from a course"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        enrollment = Enrollment.query.filter_by(
            id=enrollment_id,
            student_id=student_id
        ).first()

        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        # Mark enrollment as inactive instead of deleting
        enrollment.is_active = False
        enrollment.unenrolled_at = get_algerian_time()
        enrollment.unenrolled_by = admin_id

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Student unenrolled successfully'
        })

    except Exception as e:
        logger.error(f"Error unenrolling student: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to unenroll student'}), 500

@admin_bp.route('/students/<int:student_id>/change-section', methods=['PUT'])
@jwt_required()
def change_student_section9(student_id):
    """Change a student's section/class for a course"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    if not data or 'enrollment_id' not in data or 'new_class_id' not in data:
        return jsonify({'error': 'Enrollment ID and new class ID are required'}), 400

    try:
        enrollment = Enrollment.query.filter_by(
            id=data['enrollment_id'],
            student_id=student_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Active enrollment not found'}), 404

        new_class = Class.query.get(data['new_class_id'])
        if not new_class:
            return jsonify({'error': 'New class not found'}), 404

        # Check if student is already enrolled in the new class
        existing_enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=data['new_class_id'],
            is_active=True
        ).first()

        if existing_enrollment:
            return jsonify({'error': 'Student is already enrolled in the target class'}), 400

        old_class_name = enrollment.class_obj.name
        
        # Update the enrollment
        enrollment.class_id = data['new_class_id']
        enrollment.section_changed_at = get_algerian_time()
        enrollment.section_changed_by = admin_id

        db.session.commit()

        return jsonify({
            'success': True,
            'message': f'Student moved from {old_class_name} to {new_class.name}',
            'enrollment': {
                'id': enrollment.id,
                'old_class': old_class_name,
                'new_class': new_class.name,
                'course_name': new_class.course.name
            }
        })

    except Exception as e:
        logger.error(f"Error changing student section: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to change section'}), 500

@admin_bp.route('/students/<int:student_id>/payment-history', methods=['GET'])
@jwt_required()
def get_student_payment_history(student_id):
    """Get detailed payment history for a student"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Get all payments for this student
        payments = db.session.execute(text("""
            SELECT 
                p.id,
                p.amount,
                p.payment_date,
                p.payment_method,
                p.status,
                p.description,
                p.created_at,
                c.name as course_name,
                cl.name as class_name
            FROM payments p
            LEFT JOIN enrollments e ON p.enrollment_id = e.id
            LEFT JOIN classes cl ON e.class_id = cl.id
            LEFT JOIN courses c ON cl.course_id = c.id
            WHERE e.student_id = :student_id
            ORDER BY p.created_at DESC
        """), {'student_id': student_id}).fetchall()

        payment_history = []
        total_paid = 0
        
        for payment in payments:
            payment_dict = {
                'id': payment.id,
                'amount': float(payment.amount),
                'payment_date': payment.payment_date.isoformat() if payment.payment_date else None,
                'payment_method': payment.payment_method,
                'status': payment.status,
                'description': payment.description,
                'course_name': payment.course_name,
                'class_name': payment.class_name,
                'created_at': payment.created_at.isoformat() if payment.created_at else None
            }
            payment_history.append(payment_dict)
            
            if payment.status == 'completed':
                total_paid += float(payment.amount)

        # Get debt information
        debt_info = db.session.execute(text("""
            SELECT 
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
                COUNT(*) as total_sessions,
                c.price_per_session
            FROM attendance a
            JOIN enrollments e ON a.enrollment_id = e.id
            JOIN classes cl ON e.class_id = cl.id
            JOIN courses c ON cl.course_id = c.id
            WHERE e.student_id = :student_id AND e.is_active = 1
            GROUP BY c.price_per_session
        """), {'student_id': student_id}).fetchall()

        total_debt = 0
        for debt in debt_info:
            if debt.absent_count and debt.price_per_session:
                total_debt += debt.absent_count * float(debt.price_per_session)

        return jsonify({
            'student_id': student_id,
            'student_name': student.name,
            'payment_history': payment_history,
            'summary': {
                'total_paid': total_paid,
                'total_debt': total_debt,
                'balance': total_paid - total_debt,
                'payment_count': len(payment_history)
            }
        })

    except Exception as e:
        logger.error(f"Error fetching payment history: {str(e)}")
        return jsonify({'error': 'Failed to fetch payment history'}), 500

@admin_bp.route('/courses/available-for-enrollment', methods=['GET'])
@jwt_required()
def get_available_courses_for_enrollment():
    """Get all available courses and their classes for enrollment"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        courses = db.session.execute(text("""
            SELECT 
                c.id as course_id,
                c.name as course_name,
                c.description,
                c.price_per_session,
                cl.id as class_id,
                cl.name as class_name,
                cl.day_of_week,
                cl.start_time,
                cl.end_time,
                cl.max_students,
                COUNT(e.id) as current_enrollment_count
            FROM courses c
            JOIN classes cl ON c.id = cl.course_id
            LEFT JOIN enrollments e ON cl.id = e.class_id AND e.is_active = 1
            WHERE c.is_active = 1 AND cl.is_active = 1
            GROUP BY c.id, c.name, c.description, c.price_per_session, 
                     cl.id, cl.name, cl.day_of_week, cl.start_time, cl.end_time, cl.max_students
            ORDER BY c.name, cl.name
        """)).fetchall()

        courses_dict = {}
        for course in courses:
            course_id = course.course_id
            if course_id not in courses_dict:
                courses_dict[course_id] = {
                    'id': course_id,
                    'name': course.course_name,
                    'description': course.description,
                    'price_per_session': float(course.price_per_session) if course.price_per_session else 0,
                    'classes': []
                }
            
            class_info = {
                'id': course.class_id,
                'name': course.class_name,
                'day_of_week': course.day_of_week,
                'start_time': course.start_time,
                'end_time': course.end_time,
                'max_students': course.max_students,
                'current_enrollment_count': course.current_enrollment_count,
                'has_space': course.current_enrollment_count < course.max_students if course.max_students else True
            }
            courses_dict[course_id]['classes'].append(class_info)

        return jsonify({
            'courses': list(courses_dict.values())
        })

    except Exception as e:
        logger.error(f"Error fetching available courses: {str(e)}")
        return jsonify({'error': 'Failed to fetch available courses'}), 500

@admin_bp.route('/students/<int:student_id>/attendance-history', methods=['GET'])
@jwt_required()
def get_student_attendance_history(student_id):
    """Get detailed attendance history for a student"""
    admin_id = int(get_jwt_identity())
    admin = User.query.get(admin_id)

    if admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Get attendance records with class and course information
        attendance_records = db.session.execute(text("""
            SELECT 
                a.id,
                a.status,
                a.attendance_date,
                a.marked_at,
                a.marked_by,
                cl.name as class_name,
                c.name as course_name,
                c.price_per_session,
                u.full_name as marked_by_name
            FROM attendance a
            JOIN classes cl ON a.class_id = cl.id
            JOIN courses c ON cl.course_id = c.id
            LEFT JOIN users u ON a.marked_by = u.id
            WHERE a.student_id = :student_id
            ORDER BY a.attendance_date DESC
        """), {'student_id': student_id}).fetchall()

        # Calculate attendance statistics
        total_records = len(attendance_records)
        present_count = sum(1 for record in attendance_records if record.status == 'present')
        absent_count = sum(1 for record in attendance_records if record.status == 'absent')
        late_count = sum(1 for record in attendance_records if record.status == 'late')
        attendance_rate = round((present_count + late_count) / total_records * 100, 2) if total_records > 0 else 0

        # Format attendance history
        attendance_history = []
        for record in attendance_records:
            attendance_dict = {
                'id': record.id,
                'status': record.status,
                'attendance_date': record.attendance_date.isoformat() if record.attendance_date else None,
                'marked_at': record.marked_at.isoformat() if record.marked_at else None,
                'marked_by': record.marked_by,
                'marked_by_name': record.marked_by_name,
                'class_name': record.class_name,
                'course_name': record.course_name,
                'price_per_session': float(record.price_per_session) if record.price_per_session else 0
            }
            attendance_history.append(attendance_dict)

        return jsonify({
            'success': True,
            'student_id': student_id,
            'student_name': student.name,
            'stats': {
                'total_records': total_records,
                'present_count': present_count,
                'absent_count': absent_count,
                'late_count': late_count,
                'attendance_rate': attendance_rate
            },
            'attendance_history': attendance_history
        })

    except Exception as e:
        logger.error(f"Error fetching student attendance history: {str(e)}")
        return jsonify({'error': 'Failed to fetch attendance history'}), 500


# ===== NOTIFICATION MANAGEMENT ENDPOINTS =====

@admin_bp.route('/send-notification', methods=['POST'])
@jwt_required()
def send_notification():
    """Send bilingual notifications to users"""
    current_user_id = get_jwt_identity()
    
    # Verify admin access
    admin = User.query.get(current_user_id)
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        
        # Extract notification data
        title_en = data.get('title_en', '').strip()
        title_ar = data.get('title_ar', '').strip()
        message_en = data.get('message_en', '').strip()
        message_ar = data.get('message_ar', '').strip()
        
        # Backward compatibility for legacy single-language requests
        legacy_title = data.get('title', '').strip()
        legacy_message = data.get('message', '').strip()
        
        # If legacy fields are provided but bilingual fields are empty, use legacy as English
        if legacy_title and not title_en:
            title_en = legacy_title
        if legacy_message and not message_en:
            message_en = legacy_message
        
        # Validate that at least one language is provided
        if not (title_en or title_ar) or not (message_en or message_ar):
            return jsonify({'error': 'At least one language (English or Arabic) title and message must be provided'}), 400
        
        target_users = data.get('target_users', 'all')
        notification_type = data.get('type', 'info')
        
        # Get target users based on selection
        users_to_notify = []
        if target_users == 'all':
            users_to_notify = User.query.filter_by(is_active=True).all()
        elif target_users == 'students':
            # Students are users with role='user' who have student records
            users_to_notify = User.query.filter_by(role='user', is_active=True).join(Student, Student.user_id == User.id).all()
        elif target_users == 'parents':
            # Parents are users with role='user' who have parent records
            users_to_notify = User.query.filter_by(role='user', is_active=True).join(Parent, Parent.user_id == User.id).all()
        elif target_users == 'admins':
            users_to_notify = User.query.filter_by(role='admin', is_active=True).all()
        elif isinstance(target_users, list):
            # Specific user IDs provided
            users_to_notify = User.query.filter(User.id.in_(target_users), User.is_active.is_(True)).all()
        else:
            return jsonify({'error': 'Invalid target_users parameter'}), 400
        
        sent_count = 0
        push_service = PushNotificationService()
        
        # Send notifications to each user
        for user in users_to_notify:
            try:
                # Determine user's preferred language (default to English)
                user_language = getattr(user, 'preferred_language', 'en') or 'en'
                
                # Get title and message in user's preferred language
                display_title = title_en if user_language == 'en' else (title_ar or title_en)
                display_message = message_en if user_language == 'en' else (message_ar or message_en)
                
                if not display_title or not display_message:
                    continue
                
                # Create database notification record with bilingual support
                notification = Notification(
                    user_id=user.id,
                    title_en=title_en or None,
                    title_ar=title_ar or None,
                    message_en=message_en or None,
                    message_ar=message_ar or None,
                    title=display_title,  # Legacy fallback
                    message=display_message,  # Legacy fallback
                    type=notification_type
                )
                db.session.add(notification)
                db.session.flush()  # Get the notification ID
                
                # Send push notification
                try:
                    push_service.send_push_only(
                        user_id=user.id,
                        title=display_title,
                        message=display_message,
                        notification_type=notification_type,
                        data={'notification_id': notification.id}
                    )
                except Exception as push_error:
                    logger.warning(f"Failed to send push notification to user {user.id}: {str(push_error)}")
                
                sent_count += 1
                
            except Exception as user_error:
                logger.error(f"Failed to create notification for user {user.id}: {str(user_error)}")
                continue
        
        # Commit all notifications
        db.session.commit()
        
        logger.info(f"Sent {sent_count} bilingual notifications by admin {admin.id}")
        
        return jsonify({
            'success': True,
            'message': f'Notification sent successfully to {sent_count} recipients',
            'sent_count': sent_count
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error sending notifications: {str(e)}")
        return jsonify({'error': 'Failed to send notification'}), 500


@admin_bp.route('/notifications/recent', methods=['GET'])
@jwt_required()
def get_recent_notifications():
    """Get recent notifications for admin dashboard"""
    current_user_id = get_jwt_identity()
    
    # Verify admin access
    admin = User.query.get(current_user_id)
    if not admin or admin.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        # Get recent notifications (last 50)
        notifications = db.session.query(Notification).join(User).filter(
            User.is_active.is_(True)
        ).order_by(Notification.created_at.desc()).limit(50).all()
        
        notification_list = []
        for notification in notifications:
            notification_data = {
                'id': notification.id,
                'user_id': notification.user_id,
                'user_name': notification.user.full_name,
                'title_en': notification.title_en,
                'title_ar': notification.title_ar,
                'message_en': notification.message_en,
                'message_ar': notification.message_ar,
                # Legacy fields for backward compatibility
                'title': notification.title,
                'message': notification.message,
                'type': notification.type,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            }
            notification_list.append(notification_data)
        
        return jsonify({
            'success': True,
            'notifications': notification_list
        })
        
    except Exception as e:
        logger.error(f"Error fetching recent notifications: {str(e)}")
        return jsonify({'error': 'Failed to fetch notifications'}), 500


# ===== KINDERGARTEN (روضة) MANAGEMENT ENDPOINTS =====

@admin_bp.route('/kindergarten/courses', methods=['POST'])
@jwt_required()
def create_kindergarten_course():
    """Create a new kindergarten course with is_kindergarten flag"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from kindergarten_helpers import format_multi_day_schedule, validate_kindergarten_class_data
        
        data = request.get_json() if request.is_json else request.form.to_dict()
        
        # Required fields
        if not data.get('name') or not data.get('monthly_price'):
            return jsonify({'error': 'name and monthly_price are required'}), 400

        # Create kindergarten course
        course = Course(
            name=data['name'],
            description=data.get('description', ''),
            category='روضة',  # Kindergarten category
            price=float(data['monthly_price']),  # Main price field
            monthly_price=float(data['monthly_price']),  # Monthly subscription price
            pricing_type='monthly',
            course_type='monthly',
            max_students=int(data.get('max_students', 30)),
            is_kindergarten=True,  # Kindergarten flag
            is_active=True
        )

        db.session.add(course)
        db.session.commit()

        logger.info(f"Kindergarten course created: {course.id} - {course.name}")

        return jsonify({
            'success': True,
            'message': 'Kindergarten course created successfully',
            'course': {
                'id': course.id,
                'name': course.name,
                'description': course.description,
                'monthly_price': float(course.monthly_price),
                'max_students': course.max_students,
                'category': course.category,
                'is_kindergarten': course.is_kindergarten,
                'is_active': course.is_active
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Kindergarten course creation failed: {e}")
        return jsonify({'error': f'Failed to create kindergarten course: {str(e)}'}), 500


@admin_bp.route('/kindergarten/classes', methods=['POST'])
@jwt_required()
def create_kindergarten_class():
    """Create a new kindergarten class with multi-day schedule"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from kindergarten_helpers import format_multi_day_schedule, validate_kindergarten_class_data
        
        data = request.get_json()
        
        # Validate kindergarten class data
        is_valid, error_msg = validate_kindergarten_class_data(data)
        if not is_valid:
            return jsonify({'error': error_msg}), 400
        
        # Get course and verify it's kindergarten
        course_id = data.get('course_id')
        course = Course.query.get(course_id)
        
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if not course.is_kindergarten:
            return jsonify({'error': 'Course is not a kindergarten course'}), 400
        
        # Format multi-day schedule
        multi_day_schedule_json = format_multi_day_schedule(data['multi_day_schedule'])
        
        # Create class with multi-day schedule
        new_class = Class(
            course_id=course_id,
            name=data.get('name', f"{course.name} - روضة"),
            day_of_week=None,  # Not used for kindergarten
            multi_day_schedule=multi_day_schedule_json,  # JSON array of days
            start_time=data['start_time'],
            end_time=data['end_time'],
            max_students=int(data.get('max_students', 30)),
            is_active=True
        )

        db.session.add(new_class)
        db.session.commit()

        logger.info(f"Kindergarten class created: {new_class.id} - {new_class.name}")

        return jsonify({
            'success': True,
            'message': 'Kindergarten class created successfully',
            'class': {
                'id': new_class.id,
                'course_id': new_class.course_id,
                'name': new_class.name,
                'multi_day_schedule': new_class.multi_day_schedule,
                'start_time': new_class.start_time.strftime('%H:%M'),
                'end_time': new_class.end_time.strftime('%H:%M'),
                'max_students': new_class.max_students,
                'schedule_display': new_class.schedule
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Kindergarten class creation failed: {e}")
        return jsonify({'error': f'Failed to create kindergarten class: {str(e)}'}), 500


@admin_bp.route('/kindergarten/classes/<int:class_id>', methods=['PUT'])
@jwt_required()
def update_kindergarten_class(class_id):
    """Update kindergarten class multi-day schedule"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from kindergarten_helpers import format_multi_day_schedule
        
        class_obj = Class.query.get(class_id)
        
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404
        
        # Verify it's a kindergarten class
        course = Course.query.get(class_obj.course_id)
        if not course or not course.is_kindergarten:
            return jsonify({'error': 'Not a kindergarten class'}), 400
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            class_obj.name = data['name']
        
        if 'multi_day_schedule' in data:
            class_obj.multi_day_schedule = format_multi_day_schedule(data['multi_day_schedule'])
        
        if 'start_time' in data:
            class_obj.start_time = data['start_time']
        
        if 'end_time' in data:
            class_obj.end_time = data['end_time']
        
        if 'max_students' in data:
            class_obj.max_students = int(data['max_students'])
        
        db.session.commit()

        logger.info(f"Kindergarten class updated: {class_id}")

        return jsonify({
            'success': True,
            'message': 'Kindergarten class updated successfully',
            'class': {
                'id': class_obj.id,
                'name': class_obj.name,
                'multi_day_schedule': class_obj.multi_day_schedule,
                'start_time': class_obj.start_time.strftime('%H:%M'),
                'end_time': class_obj.end_time.strftime('%H:%M'),
                'max_students': class_obj.max_students,
                'schedule_display': class_obj.schedule
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Kindergarten class update failed: {e}")
        return jsonify({'error': f'Failed to update kindergarten class: {str(e)}'}), 500


@admin_bp.route('/kindergarten/enrollment/<int:enrollment_id>/subscribe', methods=['POST'])
@jwt_required()
def process_kindergarten_subscription(enrollment_id):
    """Process monthly subscription payment for kindergarten enrollment"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from kindergarten_helpers import process_kindergarten_subscription_payment
        
        enrollment = Enrollment.query.get(enrollment_id)
        
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404
        
        # Verify it's a kindergarten enrollment
        class_obj = Class.query.get(enrollment.class_id)
        course = Course.query.get(class_obj.course_id)
        
        if not course or not course.is_kindergarten:
            return jsonify({'error': 'Not a kindergarten enrollment'}), 400
        
        # Get payment amount
        data = request.get_json()
        amount_paid = float(data.get('amount', course.monthly_price))
        
        # Mark enrollment as kindergarten subscription
        if not enrollment.is_kindergarten_subscription:
            enrollment.is_kindergarten_subscription = True
        
        # Process payment
        result = process_kindergarten_subscription_payment(enrollment, amount_paid, course)
        
        if result['success']:
            # Send notification to parent/student
            student = Student.query.get(enrollment.student_id)
            if student and student.user_id:
                notification = Notification(
                    user_id=student.user_id,
                    title_en='Subscription Payment Received',
                    title_ar='تم استلام دفعة الاشتراك',
                    message_en=f'Your subscription payment for {course.name} has been received. Next payment due: {result["next_subscription_date"]}',
                    message_ar=f'تم استلام دفعة اشتراكك لدورة {course.name}. الدفعة التالية مستحقة في: {result["next_subscription_date"]}',
                    type='payment',
                    is_read=False
                )
                db.session.add(notification)
                db.session.commit()
            
            logger.info(f"Kindergarten subscription processed for enrollment {enrollment_id}")
            
            return jsonify({
                'success': True,
                'message': 'Subscription payment processed successfully',
                'subscription_info': result
            }), 200
        else:
            return jsonify({'error': result.get('error', 'Payment processing failed')}), 500

    except Exception as e:
        db.session.rollback()
        logger.error(f"Kindergarten subscription processing failed: {e}")
        return jsonify({'error': f'Failed to process subscription: {str(e)}'}), 500


@admin_bp.route('/kindergarten/attendance/mark', methods=['POST'])
@jwt_required()
def mark_kindergarten_attendance():
    """Mark attendance for kindergarten students (no payment coupling)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        data = request.get_json()
        
        student_id = data.get('student_id')
        class_id = data.get('class_id')
        attendance_date = data.get('date', datetime.utcnow().date())
        status = data.get('status', 'present')  # present, absent, late
        
        if not student_id or not class_id:
            return jsonify({'error': 'student_id and class_id are required'}), 400
        
        # Verify it's a kindergarten class
        class_obj = Class.query.get(class_id)
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404
        
        course = Course.query.get(class_obj.course_id)
        if not course or not course.is_kindergarten:
            return jsonify({'error': 'Not a kindergarten class'}), 400
        
        # Convert date string to date object if needed
        if isinstance(attendance_date, str):
            attendance_date = datetime.strptime(attendance_date, '%Y-%m-%d').date()
        
        # Check if attendance already exists
        existing = Attendance.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            attendance_date=attendance_date
        ).first()
        
        if existing:
            # Update existing attendance
            existing.status = status
            existing.marked_by = user_id
            existing.marked_at = datetime.utcnow()
            existing.is_kindergarten_attendance = True
            # No payment fields updated for kindergarten
            
            db.session.commit()
            
            return jsonify({
                'success': True,
                'message': 'Attendance updated successfully',
                'attendance_id': existing.id
            }), 200
        else:
            # Create new attendance record
            new_attendance = Attendance(
                student_id=student_id,
                class_id=class_id,
                attendance_date=attendance_date,
                status=status,
                marked_by=user_id,
                marked_at=datetime.utcnow(),
                is_kindergarten_attendance=True,
                # No payment coupling for kindergarten
                payment_status='paid',  # Not relevant for kindergarten
                qr_code_scanned=False
            )
            
            db.session.add(new_attendance)
            db.session.commit()
            
            logger.info(f"Kindergarten attendance marked: Student {student_id}, Class {class_id}, Status: {status}")
            
            return jsonify({
                'success': True,
                'message': 'Attendance marked successfully',
                'attendance_id': new_attendance.id
            }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Kindergarten attendance marking failed: {e}")
        return jsonify({'error': f'Failed to mark attendance: {str(e)}'}), 500


@admin_bp.route('/kindergarten/enrollment/<int:enrollment_id>/subscription-status', methods=['GET'])
@jwt_required()
def get_kindergarten_subscription_status(enrollment_id):
    """Get subscription status for kindergarten enrollment"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    try:
        from kindergarten_helpers import is_subscription_due
        
        enrollment = Enrollment.query.get(enrollment_id)
        
        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404
        
        # Get class and course
        class_obj = Class.query.get(enrollment.class_id)
        course = Course.query.get(class_obj.course_id)
        
        if not course or not course.is_kindergarten:
            return jsonify({'error': 'Not a kindergarten enrollment'}), 400
        
        # Calculate subscription status
        is_due = is_subscription_due(enrollment.next_subscription_date)
        
        return jsonify({
            'success': True,
            'enrollment_id': enrollment.id,
            'student_id': enrollment.student_id,
            'course_name': course.name,
            'is_kindergarten_subscription': enrollment.is_kindergarten_subscription,
            'subscription_status': enrollment.subscription_status,
            'subscription_start_date': enrollment.subscription_start_date.isoformat() if enrollment.subscription_start_date else None,
            'next_subscription_date': enrollment.next_subscription_date.isoformat() if enrollment.next_subscription_date else None,
            'subscription_amount': float(enrollment.subscription_amount) if enrollment.subscription_amount else float(course.monthly_price),
            'is_payment_due': is_due,
            'last_payment_date': enrollment.last_payment_date.isoformat() if enrollment.last_payment_date else None
        }), 200

    except Exception as e:
        logger.error(f"Failed to get kindergarten subscription status: {e}")
        return jsonify({'error': f'Failed to get subscription status: {str(e)}'}), 500
