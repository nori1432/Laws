"""
Enhanced Mobile Dashboard API
This replaces the existing mobile dashboard with comprehensive functionality
matching the website dashboard with integrated attendance and payment tracking
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import (db, User, Parent, Student, Enrollment, Class, Course, 
                   Attendance, CourseSection, SectionEnrollment)
from datetime import datetime, timedelta
from sqlalchemy import func, and_

def get_enhanced_mobile_dashboard():
    """Get comprehensive dashboard data for mobile users matching website functionality"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')

    try:
        if user_type == 'parent':
            return get_parent_dashboard(user_id)
        elif user_type == 'student':
            return get_student_dashboard(user_id)
        else:
            return jsonify({'error': 'Invalid user type'}), 400
    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        return jsonify({'error': 'Failed to load dashboard'}), 500

def get_parent_dashboard(user_id):
    """Enhanced parent dashboard with comprehensive student tracking"""
    parent = Parent.query.get(user_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # Get parent user info
    parent_user = User.query.get(parent.user_id)
    
    students_data = []
    overall_summary = {
        'total_debt': 0,
        'total_students': 0,
        'students_with_debt': 0,
        'students_clear': 0,
        'total_enrollments': 0,
        'overall_attendance_rate': 0
    }

    for student in parent.students:
        student_info = get_comprehensive_student_data(student)
        students_data.append(student_info)
        
        # Update overall summary
        overall_summary['total_debt'] += student_info['payment_summary']['total_debt']
        overall_summary['total_enrollments'] += len(student_info['enrollments'])
        
        if student_info['payment_summary']['total_debt'] > 0:
            overall_summary['students_with_debt'] += 1
        else:
            overall_summary['students_clear'] += 1

    overall_summary['total_students'] = len(students_data)
    
    # Calculate overall attendance rate
    if students_data:
        attendance_rates = [s['attendance_summary']['attendance_rate'] 
                          for s in students_data if s['attendance_summary']['total_sessions'] > 0]
        overall_summary['overall_attendance_rate'] = round(
            sum(attendance_rates) / len(attendance_rates) if attendance_rates else 0, 1
        )

    return jsonify({
        'type': 'parent',
        'user': {
            'id': parent.id,
            'name': parent_user.full_name if parent_user else parent.full_name,
            'email': parent_user.email if parent_user else parent.email,
            'type': 'parent',
            'mobile_username': parent.mobile_username,
            'mobile_app_enabled': parent.mobile_app_enabled
        },
        'students': students_data,
        'overall_summary': overall_summary
    }), 200

def get_student_dashboard(user_id):
    """Enhanced student dashboard with comprehensive tracking"""
    student = Student.query.get(user_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    student_data = get_comprehensive_student_data(student)
    
    return jsonify({
        'type': 'student',
        'user': {
            'id': student.id,
            'student_id': student.id,
            'name': student.name,
            'type': 'student',
            'parent_id': student.parent_id
        },
        **student_data
    }), 200

def get_comprehensive_student_data(student):
    """Get comprehensive student data with integrated attendance and payment tracking"""
    
    # Get all enrollments (including pending ones)
    enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
    section_enrollments = SectionEnrollment.query.filter_by(student_id=student.id, is_active=True).all()
    
    enrollment_data = []
    payment_summary = {
        'total_debt': float(student.total_debt) if student.total_debt else 0.0,
        'courses_with_debt': 0,
        'courses_clear': 0,
        'enrollment_debts': []
    }
    
    attendance_summary = {
        'total_sessions': 0,
        'present_sessions': 0,
        'absent_sessions': 0,
        'late_sessions': 0,
        'attendance_rate': 0
    }

    # Process regular enrollments
    for enrollment in enrollments:
        class_info = Class.query.get(enrollment.class_id)
        if not class_info or not class_info.course:
            continue
            
        course = class_info.course
        
        # Get attendance data for this enrollment
        attendance_records = Attendance.query.filter_by(
            student_id=student.id,
            class_id=class_info.id
        ).all()
        
        # Count attendance
        present_count = sum(1 for a in attendance_records if a.status == 'present')
        absent_count = sum(1 for a in attendance_records if a.status == 'absent')
        late_count = sum(1 for a in attendance_records if a.status == 'late')
        total_count = len(attendance_records)
        
        # Update overall attendance summary
        attendance_summary['total_sessions'] += total_count
        attendance_summary['present_sessions'] += present_count
        attendance_summary['absent_sessions'] += absent_count
        attendance_summary['late_sessions'] += late_count
        
        # Calculate debt for this enrollment
        enrollment_debt = float(enrollment.total_debt) if enrollment.total_debt else 0.0
        unpaid_sessions = attendance_records and sum(1 for a in attendance_records 
                                                   if a.status == 'present' and a.payment_status == 'unpaid') or 0
        
        # Determine payment status
        if enrollment_debt > 0:
            payment_summary['courses_with_debt'] += 1
            payment_status = 'debt'
        else:
            payment_summary['courses_clear'] += 1
            payment_status = 'clear'
        
        # Add to enrollment debts for detailed view
        if enrollment_debt > 0:
            payment_summary['enrollment_debts'].append({
                'course_name': course.name,
                'debt_amount': enrollment_debt,
                'debt_sessions': unpaid_sessions
            })
        
        # Create enrollment data
        enrollment_info = {
            'id': enrollment.id,
            'course_name': course.name,
            'class_name': class_info.name,
            'instructor_name': getattr(class_info, 'instructor_name', 'TBA'),
            'day_of_week': class_info.day_of_week,
            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBA',
            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBA',
            'enrollment_date': enrollment.enrollment_date.strftime('%Y-%m-%d') if enrollment.enrollment_date else None,
            'status': enrollment.status,  # New enrollment status (pending/approved/rejected)
            'attendance_summary': {
                'total_sessions': total_count,
                'present_sessions': present_count,
                'absent_sessions': absent_count,
                'late_sessions': late_count,
                'attendance_rate': round((present_count / total_count * 100) if total_count > 0 else 0, 1)
            },
            'payment_info': {
                'type': course.pricing_type or 'session',
                'debt_amount': enrollment_debt,
                'status': payment_status,
                'unpaid_sessions': unpaid_sessions,
                'course_price': float(course.price) if course.price else 0.0
            }
        }
        
        enrollment_data.append(enrollment_info)
    
    # Process section enrollments
    for section_enrollment in section_enrollments:
        section = CourseSection.query.get(section_enrollment.section_id)
        if not section or not section.course:
            continue
            
        course = section.course
        
        # For section enrollments, we don't have class-based attendance
        # This is a simpler enrollment type
        enrollment_info = {
            'id': section_enrollment.id,
            'course_name': course.name,
            'section_name': section.name,
            'schedule': section.schedule or 'TBA',
            'enrollment_date': section_enrollment.enrollment_date.strftime('%Y-%m-%d') if section_enrollment.enrollment_date else None,
            'status': 'approved',  # Section enrollments are typically auto-approved
            'attendance_summary': {
                'total_sessions': 0,
                'present_sessions': 0,
                'absent_sessions': 0,
                'late_sessions': 0,
                'attendance_rate': 0
            },
            'payment_info': {
                'type': course.pricing_type or 'session',
                'debt_amount': 0.0,
                'status': 'clear',
                'unpaid_sessions': 0,
                'course_price': float(course.price) if course.price else 0.0
            }
        }
        
        enrollment_data.append(enrollment_info)
        payment_summary['courses_clear'] += 1

    # Calculate overall attendance rate
    if attendance_summary['total_sessions'] > 0:
        attendance_summary['attendance_rate'] = round(
            (attendance_summary['present_sessions'] / attendance_summary['total_sessions']) * 100, 1
        )

    # Get recent attendance (last 10 records)
    recent_attendance_query = db.session.query(Attendance, Class, Course).join(
        Class, Attendance.class_id == Class.id
    ).join(
        Course, Class.course_id == Course.id
    ).filter(
        Attendance.student_id == student.id
    ).order_by(Attendance.attendance_date.desc()).limit(10)
    
    recent_attendance = []
    for attendance, class_info, course in recent_attendance_query:
        recent_attendance.append({
            'id': attendance.id,
            'date': attendance.attendance_date.strftime('%Y-%m-%d'),
            'class_name': class_info.name,
            'course_name': course.name,
            'status': attendance.status,
            'payment_status': getattr(attendance, 'payment_status', 'paid'),
            'marked_at': attendance.marked_at.strftime('%H:%M') if attendance.marked_at else None
        })

    return {
        'id': student.id,
        'name': student.name,
        'enrollments': enrollment_data,
        'recent_attendance': recent_attendance,
        'payment_summary': payment_summary,
        'attendance_summary': attendance_summary
    }