from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta
import logging

from models import db, User, Student, Parent, Course, Class, Enrollment, Attendance

payments_bp = Blueprint('payments', __name__)

logger = logging.getLogger(__name__)

@payments_bp.route('/student/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_payments(student_id):
    """Get payment information for a specific student"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Check if user is admin or parent of the student
    student = Student.query.get_or_404(student_id)
    if user.role != 'admin' and student.parent.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403

    # Get all enrollments for this student
    enrollments = Enrollment.query.filter_by(student_id=student_id, is_active=True).all()

    payment_info = []
    for enrollment in enrollments:
        course = enrollment.class_.course

        payment_info.append({
            'enrollment_id': enrollment.id,
            'course_name': course.name,
            'section_name': enrollment.class_.name,
            'payment_type': enrollment.payment_type,
            'unpaid_amount': float(enrollment.total_unpaid_amount),
            'payment_status_display': enrollment.payment_status_display,
            'progress_percentage': enrollment.progress_percentage,
            'sessions_this_month': enrollment.sessions_this_month,
            'is_overdue': enrollment.is_payment_overdue,
            'monthly_payment_status': enrollment.monthly_payment_status,
            'course_price': float(course.monthly_price if enrollment.payment_type == 'monthly' else course.session_price or course.price or 0)
        })

    return jsonify({
        'student_id': student_id,
        'student_name': student.name,
        'payment_info': payment_info
    }), 200

@payments_bp.route('/student-payments', methods=['GET'])
@jwt_required()
def get_current_user_payments():
    """Get payment information for current user's students"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    payment_info = []

    if user.role == 'admin':
        # Admin can see all payments
        enrollments = Enrollment.query.filter_by(is_active=True).all()
    else:
        # Parent can see their children's payments
        parent = Parent.query.filter_by(user_id=current_user_id).first()
        if not parent:
            return jsonify({'error': 'Parent profile not found'}), 404

        students = Student.query.filter_by(parent_id=parent.id).all()
        student_ids = [s.id for s in students]
        enrollments = Enrollment.query.filter(
            Enrollment.student_id.in_(student_ids),
            Enrollment.is_active == True
        ).all()

    for enrollment in enrollments:
        course = enrollment.class_.course
        student = enrollment.student

        # Skip if student is None (data integrity issue)
        if not student:
            continue

        payment_info.append({
            'enrollment_id': enrollment.id,
            'student_name': student.name,
            'course_name': course.name,
            'section_name': enrollment.class_.name,
            'payment_type': enrollment.payment_type,
            'unpaid_amount': float(enrollment.total_unpaid_amount),
            'payment_status_display': enrollment.payment_status_display,
            'progress_percentage': enrollment.progress_percentage,
            'sessions_this_month': enrollment.sessions_this_month,
            'is_overdue': enrollment.is_payment_overdue,
            'monthly_payment_status': enrollment.monthly_payment_status,
            'course_price': float(course.monthly_price if enrollment.payment_type == 'monthly' else course.session_price or course.price or 0)
        })

    return jsonify(payment_info), 200

@payments_bp.route('/enrollment/<int:enrollment_id>/pay', methods=['POST'])
@jwt_required()
def process_payment(enrollment_id):
    """Process payment for an enrollment"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    enrollment = Enrollment.query.get_or_404(enrollment_id)

    # Check permissions
    if user.role != 'admin' and enrollment.student.parent.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    payment_method = data.get('payment_method', 'cash')
    transaction_id = data.get('transaction_id')
    payment_type = data.get('payment_type', 'general')  # 'registration', 'monthly', 'session'

    course = enrollment.class_.course
    total_amount = 0

    if enrollment.payment_type == 'session':
        # For session payments, just mark as paid since we don't track per-session anymore
        total_amount = course.session_price or course.price or 0
        # Could calculate based on attended sessions, but simplified for now

    else:  # monthly payment
        monthly_price = course.monthly_price or course.price or 0

        if payment_type == 'monthly':
            # Process monthly payment after 4 sessions
            sessions_this_month = enrollment.monthly_sessions_attended
            if sessions_this_month < 4:
                return jsonify({'error': 'Not enough sessions attended for monthly payment'}), 400

            if enrollment.monthly_payment_status == 'paid':
                return jsonify({'error': 'Monthly payment already processed this month'}), 400

            enrollment.monthly_payment_status = 'paid'
            total_amount = monthly_price

            # Reset for next month
            enrollment.monthly_payment_status = 'pending'

        else:
            return jsonify({'error': 'Invalid payment type for monthly course'}), 400

    db.session.commit()

    # Send push notification to student/parent about payment processing
    try:
        from push_notifications import PushNotificationService
        
        # Determine notification message based on payment type
        if payment_type == 'registration':
            notification_title = "Registration Payment Confirmed"
            notification_message = f"Registration payment of ${total_amount:.2f} for {course.name} has been processed successfully."
        elif payment_type == 'monthly':
            notification_title = "Monthly Payment Confirmed"
            notification_message = f"Monthly payment of ${total_amount:.2f} for {course.name} has been processed successfully."
        else:
            notification_title = "Payment Processed"
            notification_message = f"Payment of ${total_amount:.2f} for {course.name} has been processed successfully."
        
        # Send push notification
        PushNotificationService.send_push_notification(
            user_id=enrollment.student.user_id,
            title=notification_title,
            message=notification_message,
            notification_type="payment",
            extra_data={
                'enrollment_id': enrollment_id,
                'student_id': enrollment.student_id,
                'course_name': course.name,
                'payment_type': payment_type,
                'amount': float(total_amount),
                'payment_method': payment_method,
                'transaction_id': transaction_id
            }
        )
        
    except Exception as push_error:
        print(f"Failed to send payment push notification: {push_error}")

    return jsonify({
        'message': 'Payment processed successfully',
        'enrollment_id': enrollment_id,
        'amount_paid': float(total_amount),
        'payment_type': payment_type
    }), 200


@payments_bp.route('/admin/monthly-due', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_monthly_payments_due():
    """Get enrollments that need monthly payments"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get enrollments with monthly payment type that have 4+ sessions this month
    current_month = datetime.utcnow().strftime('%Y-%m')

    monthly_due = db.session.query(
        Enrollment,
        Student,
        Class,
        Course,
        Parent,
        User,
        func.count(Attendance.id).label('sessions_this_month')
    ).join(
        Student, Enrollment.student_id == Student.id
    ).join(
        Class, Enrollment.class_id == Class.id
    ).join(
        Course, Class.course_id == Course.id
    ).join(
        Parent, Student.parent_id == Parent.id
    ).join(
        User, Parent.user_id == User.id
    ).outerjoin(
        Attendance,
        and_(
            Attendance.student_id == Student.id,
            Attendance.class_id == Class.id,
            Attendance.status == 'present',
            func.date_format(Attendance.attendance_date, '%Y-%m') == current_month
        )
    ).filter(
        Enrollment.payment_type == 'monthly',
        Enrollment.is_active == True
    ).group_by(
        Enrollment.id, Student.id, Class.id, Course.id, Parent.id, User.id
    ).having(
        func.count(Attendance.id) >= 4
    ).all()

    monthly_details = []
    for enrollment, student, class_, course, parent, user, sessions_count in monthly_due:
        # Check if already paid this month using enrollment status
        if enrollment.monthly_payment_status != 'paid':
            monthly_details.append({
                'enrollment_id': enrollment.id,
                'student_name': student.name,
                'parent_name': parent.full_name,
                'parent_phone': parent.phone,
                'course_name': course.name,
                'section_name': class_.name,
                'sessions_this_month': sessions_count,
                'amount_due': float(course.monthly_price or course.price or 0),
                'month_year': current_month
            })

    return jsonify({
        'monthly_payments_due': monthly_details,
        'total_count': len(monthly_details)
    }), 200

@payments_bp.route('/admin/send-reminders', methods=['POST'])
@jwt_required()
def send_payment_reminders():
    """Send payment reminders to parents with overdue payments"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    reminder_type = data.get('reminder_type', 'overdue')  # 'overdue', 'upcoming', 'all'
    days_overdue = data.get('days_overdue', 7)

    from utils import send_payment_reminder_email

    reminders_sent = 0
    errors = []

    try:
        if reminder_type in ['overdue', 'all']:
            # Send reminders for overdue payments
            overdue_payments = db.session.query(
                Attendance,
                Student,
                Class,
                Course,
                Parent,
                User
            ).join(
                Student, Attendance.student_id == Student.id
            ).join(
                Class, Attendance.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).join(
                Parent, Student.parent_id == Parent.id
            ).join(
                User, Parent.user_id == User.id
            ).filter(
                Attendance.status == 'present',
                Attendance.payment_status != 'paid',
                Attendance.days_until_due >= days_overdue
            ).all()

            for attendance, student, class_, course, parent, user in overdue_payments:
                try:
                    # Calculate amount due
                    if course.pricing_type == 'session':
                        amount_due = course.session_price or course.price or 0
                    else:
                        amount_due = (course.monthly_price or course.price or 0) / 4

                    due_date = attendance.attendance_date + timedelta(days=7)

                    send_payment_reminder_email(
                        user.email,
                        student.name,
                        f"{amount_due:.2f}",
                        due_date
                    )
                    reminders_sent += 1
                except Exception as e:
                    errors.append(f"Failed to send reminder to {user.email}: {str(e)}")

        if reminder_type in ['upcoming', 'all']:
            # Send reminders for upcoming payments (due in next 3 days)
            upcoming_payments = db.session.query(
                Enrollment,
                Student,
                Class,
                Course,
                Parent,
                User
            ).join(
                Student, Enrollment.student_id == Student.id
            ).join(
                Class, Enrollment.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).join(
                Parent, Student.parent_id == Parent.id
            ).join(
                User, Parent.user_id == User.id
            ).filter(
                Enrollment.is_active == True,
                Enrollment.next_payment_due <= datetime.utcnow().date() + timedelta(days=3),
                Enrollment.next_payment_due >= datetime.utcnow().date()
            ).all()

            for enrollment, student, class_, course, parent, user in upcoming_payments:
                try:
                    if enrollment.payment_type == 'monthly':
                        amount_due = course.monthly_price or course.price or 0
                    else:
                        amount_due = course.session_price or course.price or 0

                    send_payment_reminder_email(
                        user.email,
                        student.name,
                        f"{amount_due:.2f}",
                        enrollment.next_payment_due
                    )
                    reminders_sent += 1
                except Exception as e:
                    errors.append(f"Failed to send reminder to {user.email}: {str(e)}")

    except Exception as e:
        return jsonify({
            'error': f'Failed to send reminders: {str(e)}',
            'reminders_sent': reminders_sent,
            'errors': errors
        }), 500

    return jsonify({
        'message': f'Successfully sent {reminders_sent} payment reminders',
        'reminders_sent': reminders_sent,
        'errors': errors
    }), 200

@payments_bp.route('/admin/reminder-settings', methods=['GET', 'POST'])
@jwt_required()
def manage_reminder_settings():
    """Get or update payment reminder settings"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    if request.method == 'GET':
        # Return current reminder settings (could be stored in database)
        settings = {
            'auto_reminders_enabled': True,
            'reminder_schedule': 'daily',  # daily, weekly
            'overdue_threshold_days': 7,
            'upcoming_reminder_days': 3,
            'last_reminder_run': None
        }
        return jsonify(settings), 200

    elif request.method == 'POST':
        data = request.get_json()
        # Here you would save settings to database
        # For now, just return success
        return jsonify({
            'message': 'Reminder settings updated successfully',
            'settings': data
        }), 200

@payments_bp.route('/admin/pending', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_pending_payments():
    """Get all pending payments (Admin only)"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    # Get all enrollments with pending monthly payments (4+ sessions attended)
    pending_monthly = Enrollment.query.filter(
        func.coalesce(Enrollment.monthly_sessions_attended, 0) >= 4,
        Enrollment.monthly_payment_status == 'pending'
    ).all()

    pending_payments = []

    # Process pending monthly payments
    for enrollment in pending_monthly:
        student = Student.query.get(enrollment.student_id)
        if not student:
            continue
            
        # Find parent through user relationship
        parent_user = None
        if hasattr(student, 'user_id') and student.user_id:
            parent_user = User.query.get(student.user_id)
            
        class_info = Class.query.get(enrollment.class_id) if enrollment.class_id else None
        course = class_info.course if class_info else None

        if not course:
            continue

        pending_payments.append({
            'id': f"monthly_{enrollment.id}",
            'type': 'monthly',
            'student': {
                'id': student.id,
                'name': student.name
            },
            'parent': {
                'id': parent_user.id if parent_user else None,
                'name': parent_user.full_name if parent_user else 'No Parent',
                'email': parent_user.email if parent_user else 'N/A',
                'phone': parent_user.phone if parent_user else 'N/A'
            },
            'course': {
                'id': course.id,
                'name': course.name
            },
            'amount': float(course.monthly_price) if hasattr(course, 'monthly_price') and course.monthly_price else float(course.price),
            'sessions_attended': enrollment.monthly_sessions_attended,
            'enrollment_id': enrollment.id,
            'status': 'pending',
            'description': f'Monthly Payment ({enrollment.monthly_sessions_attended}/4 sessions completed)'
        })

    # Sort by type and student name
    pending_payments.sort(key=lambda x: (x['type'], x['student']['name'].lower()))

    return jsonify({
        'pending_payments': pending_payments,
        'summary': {
            'total_pending': len(pending_payments),
            'registration_payments': len([p for p in pending_payments if p['type'] == 'registration']),
            'monthly_payments': len([p for p in pending_payments if p['type'] == 'monthly']),
            'total_amount': sum(p['amount'] for p in pending_payments)
        }
    }), 200

@payments_bp.route('/admin/monthly-due', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_monthly_due_payments():
    """Get all students who are due for monthly payments (Admin only)"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get all enrollments with monthly payment type and 4+ sessions attended
    monthly_due = Enrollment.query.filter(
        Enrollment.payment_type == 'monthly',
        func.coalesce(Enrollment.monthly_sessions_attended, 0) >= 4
    ).all()

    due_payments = []

    for enrollment in monthly_due:
        student = Student.query.get(enrollment.student_id)
        if not student:
            continue
            
        # Find parent through user relationship
        parent_user = None
        if hasattr(student, 'user_id') and student.user_id:
            parent_user = User.query.get(student.user_id)
            
        class_info = Class.query.get(enrollment.class_id) if enrollment.class_id else None
        course = class_info.course if class_info else None

        if not course:
            continue

        # Get recent attendance records to show progress
        recent_attendance = Attendance.query.filter_by(
            student_id=student.id,
            class_id=enrollment.class_id
        ).order_by(Attendance.attendance_date.desc()).limit(5).all()

        due_payments.append({
            'id': enrollment.id,
            'student': {
                'id': student.id,
                'name': student.name
            },
            'parent': {
                'id': parent_user.id if parent_user else None,
                'name': parent_user.full_name if parent_user else 'No Parent',
                'email': parent_user.email if parent_user else 'N/A',
                'phone': parent_user.phone if parent_user else 'N/A'
            },
            'course': {
                'id': course.id,
                'name': course.name
            },
            'payment_status': enrollment.monthly_payment_status,
            'sessions_attended': enrollment.monthly_sessions_attended,
            'amount_due': float(course.monthly_price) if hasattr(course, 'monthly_price') and course.monthly_price else float(course.price),
            'progress_percentage': min((enrollment.monthly_sessions_attended / 4) * 100, 100),
            'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
            'recent_attendance': [
                {
                    'date': att.attendance_date.isoformat(),
                    'status': att.status
                } for att in recent_attendance
            ]
        })

    # Sort by payment status (pending first) and sessions attended (highest first)
    due_payments.sort(key=lambda x: (
        x['payment_status'] != 'pending',
        -x['sessions_attended'],
        x['student']['name'].lower()
    ))

    return jsonify({
        'monthly_due': due_payments,
        'summary': {
            'total_due': len(due_payments),
            'pending_payments': len([p for p in due_payments if p['payment_status'] == 'pending']),
            'paid_payments': len([p for p in due_payments if p['payment_status'] == 'paid']),
            'total_amount_due': sum(p['amount_due'] for p in due_payments if p['payment_status'] == 'pending'),
            'average_sessions': round(sum(p['sessions_attended'] for p in due_payments) / len(due_payments), 1) if due_payments else 0
        }
    }), 200
