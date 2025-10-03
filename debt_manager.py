"""
Centralized Debt Management System
Handles all debt tracking operations to ensure consistency between GUI and API
"""
from decimal import Decimal
from datetime import datetime
from sqlalchemy import func
from models import db, Student, Attendance, Enrollment, Payment, Notification
from utils import get_algerian_time
import logging

logger = logging.getLogger(__name__)


class DebtManager:
    """Centralized debt management to ensure consistent financial tracking"""
    
    @staticmethod
    def add_debt(student_id, amount, attendance_id=None, commit=True):
        """
        Add debt to student and mark attendance as unpaid
        
        Args:
            student_id: Student ID
            amount: Debt amount to add
            attendance_id: Optional attendance record ID to link
            commit: Whether to commit transaction (default True)
        
        Returns:
            dict: Operation result with success status and new debt total
        """
        try:
            student = Student.query.get(student_id)
            if not student:
                return {'success': False, 'error': 'Student not found'}
            
            amount = Decimal(str(amount))
            old_debt = student.total_debt or Decimal('0')
            student.total_debt = old_debt + amount
            
            # Update attendance payment status if provided
            if attendance_id:
                attendance = Attendance.query.get(attendance_id)
                if attendance:
                    attendance.payment_status = 'unpaid'
                    attendance.payment_amount = float(amount)
            
            if commit:
                db.session.commit()
            
            logger.info(f"Added debt: Student {student_id}, Amount {amount}, "
                       f"Old debt: {old_debt}, New debt: {student.total_debt}")
            
            return {
                'success': True,
                'old_debt': float(old_debt),
                'new_debt': float(student.total_debt),
                'amount_added': float(amount)
            }
            
        except Exception as e:
            logger.error(f"Error adding debt: {e}")
            if commit:
                db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def clear_debt(student_id, amount, attendance_ids=None, create_payment_record=True, 
                   payment_method='cash', notes='', admin_id=None, commit=True):
        """
        Clear debt and mark attendances as paid
        
        Args:
            student_id: Student ID
            amount: Payment amount
            attendance_ids: List of attendance IDs to mark as paid (None = auto-select oldest unpaid)
            create_payment_record: Whether to create a payment record (default True)
            payment_method: Payment method for record
            notes: Optional payment notes
            admin_id: Admin user ID who processed payment
            commit: Whether to commit transaction (default True)
        
        Returns:
            dict: Operation result with details
        """
        try:
            student = Student.query.get(student_id)
            if not student:
                return {'success': False, 'error': 'Student not found'}
            
            amount = Decimal(str(amount))
            old_debt = student.total_debt or Decimal('0')
            
            # Validate amount doesn't exceed debt
            if amount > old_debt:
                return {
                    'success': False, 
                    'error': f'Payment amount {amount} exceeds outstanding debt {old_debt}'
                }
            
            # Reduce student debt
            student.total_debt = max(Decimal('0'), old_debt - amount)
            
            # Mark attendances as paid
            marked_attendances = []
            if attendance_ids:
                # Mark specific attendances
                for att_id in attendance_ids:
                    attendance = Attendance.query.get(att_id)
                    if attendance and attendance.payment_status == 'unpaid':
                        attendance.payment_status = 'paid'
                        marked_attendances.append(att_id)
            else:
                # Auto-select oldest unpaid attendances
                remaining_amount = amount
                unpaid_attendances = Attendance.query.filter_by(
                    student_id=student_id,
                    payment_status='unpaid'
                ).order_by(Attendance.attendance_date).all()
                
                for attendance in unpaid_attendances:
                    if remaining_amount <= 0:
                        break
                    att_amount = Decimal(str(attendance.payment_amount or 0))
                    if att_amount <= remaining_amount:
                        attendance.payment_status = 'paid'
                        marked_attendances.append(attendance.id)
                        remaining_amount -= att_amount
            
            # Create payment record
            payment_id = None
            if create_payment_record:
                payment = Payment(
                    student_id=student_id,
                    amount=float(amount),
                    payment_method=payment_method,
                    status='completed',
                    notes=notes,
                    processed_by=admin_id,
                    created_at=get_algerian_time()
                )
                db.session.add(payment)
                db.session.flush()  # Get payment ID
                payment_id = payment.id
            
            # Create bilingual notification
            from push_notifications import PushNotificationService
            PushNotificationService.send_payment_confirmation_notification(
                student_id=student_id,
                amount=float(amount),
                payment_method=payment_method
            )
            
            if commit:
                db.session.commit()
            
            logger.info(f"Cleared debt: Student {student_id}, Amount {amount}, "
                       f"Old debt: {old_debt}, New debt: {student.total_debt}, "
                       f"Attendances marked: {len(marked_attendances)}")
            
            return {
                'success': True,
                'old_debt': float(old_debt),
                'new_debt': float(student.total_debt),
                'amount_paid': float(amount),
                'attendances_marked': marked_attendances,
                'payment_id': payment_id
            }
            
        except Exception as e:
            logger.error(f"Error clearing debt: {e}")
            if commit:
                db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def get_student_debt(student_id, include_details=False):
        """
        Get accurate student debt (from database, with validation against attendances)
        
        Args:
            student_id: Student ID
            include_details: If True, returns breakdown of unpaid attendances
        
        Returns:
            float or dict: Total debt, or detailed breakdown if include_details=True
        """
        try:
            student = Student.query.get(student_id)
            if not student:
                return 0.0 if not include_details else {'total_debt': 0.0, 'error': 'Student not found'}
            
            # Get stored debt
            stored_debt = float(student.total_debt or 0)
            
            # Calculate actual debt from unpaid attendances
            calculated_debt = db.session.query(
                func.coalesce(func.sum(Attendance.payment_amount), 0)
            ).filter(
                Attendance.student_id == student_id,
                Attendance.payment_status == 'unpaid',
                Attendance.status == 'present'  # Only count present attendances
            ).scalar() or 0
            
            calculated_debt = float(calculated_debt)
            
            if not include_details:
                # Return stored debt (should match calculated)
                return stored_debt
            
            # Get unpaid attendance details
            unpaid_attendances = Attendance.query.filter_by(
                student_id=student_id,
                payment_status='unpaid',
                status='present'
            ).order_by(Attendance.attendance_date).all()
            
            attendance_details = [{
                'id': att.id,
                'date': att.attendance_date.isoformat() if att.attendance_date else None,
                'amount': float(att.payment_amount or 0),
                'class_id': att.class_id
            } for att in unpaid_attendances]
            
            return {
                'total_debt': stored_debt,
                'calculated_debt': calculated_debt,
                'matches': abs(stored_debt - calculated_debt) < 0.01,
                'discrepancy': stored_debt - calculated_debt,
                'unpaid_sessions': len(unpaid_attendances),
                'unpaid_attendances': attendance_details
            }
            
        except Exception as e:
            logger.error(f"Error getting student debt: {e}")
            return 0.0 if not include_details else {'total_debt': 0.0, 'error': str(e)}
    
    @staticmethod
    def reconcile_student_debt(student_id, commit=True):
        """
        Recalculate student debt from unpaid attendances and update database
        
        Args:
            student_id: Student ID
            commit: Whether to commit transaction
        
        Returns:
            dict: Reconciliation result
        """
        try:
            student = Student.query.get(student_id)
            if not student:
                return {'success': False, 'error': 'Student not found'}
            
            old_debt = float(student.total_debt or 0)
            
            # Calculate actual debt from attendances
            calculated_debt = db.session.query(
                func.coalesce(func.sum(Attendance.payment_amount), 0)
            ).filter(
                Attendance.student_id == student_id,
                Attendance.payment_status == 'unpaid',
                Attendance.status == 'present'
            ).scalar() or 0
            
            calculated_debt = Decimal(str(calculated_debt))
            
            # Update student debt
            student.total_debt = calculated_debt
            
            if commit:
                db.session.commit()
            
            discrepancy = float(calculated_debt) - old_debt
            
            logger.info(f"Reconciled debt: Student {student_id}, "
                       f"Old: {old_debt}, New: {float(calculated_debt)}, "
                       f"Discrepancy: {discrepancy}")
            
            return {
                'success': True,
                'student_id': student_id,
                'old_debt': old_debt,
                'new_debt': float(calculated_debt),
                'discrepancy': discrepancy,
                'was_corrected': abs(discrepancy) > 0.01
            }
            
        except Exception as e:
            logger.error(f"Error reconciling debt: {e}")
            if commit:
                db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def reconcile_all_debts():
        """
        Reconcile debts for all students
        
        Returns:
            dict: Summary of reconciliation operation
        """
        try:
            students = Student.query.all()
            results = []
            corrected_count = 0
            
            for student in students:
                result = DebtManager.reconcile_student_debt(student.id, commit=False)
                if result.get('success') and result.get('was_corrected'):
                    corrected_count += 1
                results.append(result)
            
            db.session.commit()
            
            logger.info(f"Reconciled all debts: {len(students)} students, "
                       f"{corrected_count} corrections made")
            
            return {
                'success': True,
                'total_students': len(students),
                'corrections_made': corrected_count,
                'details': results
            }
            
        except Exception as e:
            logger.error(f"Error reconciling all debts: {e}")
            db.session.rollback()
            return {'success': False, 'error': str(e)}
    
    @staticmethod
    def get_enrollment_debt_summary(enrollment_id):
        """
        Get debt summary for a specific enrollment
        
        Args:
            enrollment_id: Enrollment ID
        
        Returns:
            dict: Debt summary for this enrollment
        """
        try:
            enrollment = Enrollment.query.get(enrollment_id)
            if not enrollment:
                return {'success': False, 'error': 'Enrollment not found'}
            
            # Get unpaid attendances for this enrollment
            unpaid_amount = db.session.query(
                func.coalesce(func.sum(Attendance.payment_amount), 0)
            ).filter(
                Attendance.student_id == enrollment.student_id,
                Attendance.class_id == enrollment.class_id,
                Attendance.payment_status == 'unpaid',
                Attendance.status == 'present'
            ).scalar() or 0
            
            unpaid_count = Attendance.query.filter_by(
                student_id=enrollment.student_id,
                class_id=enrollment.class_id,
                payment_status='unpaid',
                status='present'
            ).count()
            
            return {
                'success': True,
                'enrollment_id': enrollment_id,
                'student_id': enrollment.student_id,
                'class_id': enrollment.class_id,
                'unpaid_amount': float(unpaid_amount),
                'unpaid_sessions': unpaid_count,
                'student_total_debt': float(enrollment.student.total_debt or 0)
            }
            
        except Exception as e:
            logger.error(f"Error getting enrollment debt summary: {e}")
            return {'success': False, 'error': str(e)}
