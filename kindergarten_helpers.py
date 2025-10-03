"""
Helper functions for kindergarten (روضة) course management.
Handles multi-day schedules and subscription-based payments separately from regular courses.
"""

from datetime import datetime, timedelta, date
from dateutil.relativedelta import relativedelta
import json
import logging

logger = logging.getLogger(__name__)


def is_kindergarten_course(course):
    """Check if a course is a kindergarten course"""
    return course.is_kindergarten or course.category == 'روضة'


def parse_multi_day_schedule(multi_day_schedule_str):
    """
    Parse multi_day_schedule JSON string to list of day integers
    
    Args:
        multi_day_schedule_str: JSON string like "[0, 2, 4]" for Mon, Wed, Fri
    
    Returns:
        List of integers representing days (0=Monday, 6=Sunday)
    """
    if not multi_day_schedule_str:
        return []
    
    try:
        days = json.loads(multi_day_schedule_str)
        return [int(day) for day in days if isinstance(day, (int, str)) and 0 <= int(day) <= 6]
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.error(f"Error parsing multi_day_schedule: {e}")
        return []


def format_multi_day_schedule(days_list):
    """
    Format list of day integers to JSON string
    
    Args:
        days_list: List of integers (0=Monday, 6=Sunday)
    
    Returns:
        JSON string like "[0, 2, 4]"
    """
    if not days_list:
        return None
    
    try:
        # Ensure unique days and sort them
        unique_days = sorted(list(set([int(day) for day in days_list if 0 <= int(day) <= 6])))
        return json.dumps(unique_days)
    except (ValueError, TypeError) as e:
        logger.error(f"Error formatting multi_day_schedule: {e}")
        return None


def get_day_names(days_list, language='en'):
    """
    Get day names from day integers
    
    Args:
        days_list: List of day integers (0=Monday, 6=Sunday)
        language: 'en' or 'ar'
    
    Returns:
        List of day names
    """
    days_en = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    days_ar = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
    days_abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    days_map = days_ar if language == 'ar' else days_abbr
    
    try:
        return [days_map[int(day)] for day in days_list if 0 <= int(day) < len(days_map)]
    except (ValueError, IndexError) as e:
        logger.error(f"Error getting day names: {e}")
        return []


def calculate_next_subscription_date(start_date, months=1):
    """
    Calculate next subscription payment date
    
    Args:
        start_date: datetime.date object of subscription start
        months: Number of months to add (default 1)
    
    Returns:
        datetime.date object of next payment date
    """
    if not start_date:
        return None
    
    try:
        # If start_date is datetime, extract date
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        
        # Add months using relativedelta to handle month-end dates properly
        next_date = start_date + relativedelta(months=months)
        return next_date
    except Exception as e:
        logger.error(f"Error calculating next subscription date: {e}")
        return None


def is_subscription_due(next_subscription_date):
    """
    Check if subscription payment is due
    
    Args:
        next_subscription_date: datetime.date object
    
    Returns:
        Boolean indicating if payment is due
    """
    if not next_subscription_date:
        return False
    
    try:
        # If datetime, extract date
        if isinstance(next_subscription_date, datetime):
            next_subscription_date = next_subscription_date.date()
        
        today = date.today()
        return next_subscription_date <= today
    except Exception as e:
        logger.error(f"Error checking subscription due: {e}")
        return False


def process_kindergarten_subscription_payment(enrollment, amount_paid, course):
    """
    Process subscription payment for kindergarten enrollment
    
    Args:
        enrollment: Enrollment object
        amount_paid: Amount paid for subscription
        course: Course object
    
    Returns:
        Dictionary with payment info
    """
    from models import db
    
    try:
        today = date.today()
        
        # If first payment, set subscription start date
        if not enrollment.subscription_start_date:
            enrollment.subscription_start_date = today
            enrollment.next_subscription_date = calculate_next_subscription_date(today, months=1)
        else:
            # Move to next subscription period
            enrollment.next_subscription_date = calculate_next_subscription_date(
                enrollment.next_subscription_date, 
                months=1
            )
        
        # Update enrollment
        enrollment.subscription_status = 'active'
        enrollment.last_payment_date = datetime.utcnow()
        enrollment.subscription_amount = amount_paid
        
        # Clear any kindergarten-related debt
        if enrollment.is_kindergarten_subscription:
            # Don't touch regular attendance debt
            pass
        
        db.session.commit()
        
        return {
            'success': True,
            'message': 'Subscription payment processed successfully',
            'subscription_start_date': enrollment.subscription_start_date.isoformat(),
            'next_subscription_date': enrollment.next_subscription_date.isoformat(),
            'subscription_status': enrollment.subscription_status
        }
    
    except Exception as e:
        logger.error(f"Error processing kindergarten subscription payment: {e}")
        db.session.rollback()
        return {
            'success': False,
            'error': str(e)
        }


def get_kindergarten_schedule_display(class_obj, language='en'):
    """
    Get formatted schedule string for kindergarten class
    
    Args:
        class_obj: Class object
        language: 'en' or 'ar'
    
    Returns:
        Formatted schedule string
    """
    if not class_obj.multi_day_schedule:
        return 'TBD'
    
    try:
        days_list = parse_multi_day_schedule(class_obj.multi_day_schedule)
        day_names = get_day_names(days_list, language)
        
        start_str = class_obj.start_time.strftime('%H:%M') if class_obj.start_time else '00:00'
        end_str = class_obj.end_time.strftime('%H:%M') if class_obj.end_time else '00:00'
        
        days_str = ', '.join(day_names)
        return f"{days_str} {start_str}-{end_str}"
    
    except Exception as e:
        logger.error(f"Error getting kindergarten schedule display: {e}")
        return 'TBD'


def validate_kindergarten_class_data(data):
    """
    Validate kindergarten class creation/update data
    
    Args:
        data: Dictionary with class data
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check for required fields
    if 'multi_day_schedule' not in data or not data['multi_day_schedule']:
        return False, 'multi_day_schedule is required for kindergarten classes'
    
    # Validate multi_day_schedule is a list
    if not isinstance(data['multi_day_schedule'], list):
        return False, 'multi_day_schedule must be a list of day integers (0-6)'
    
    # Validate days are in valid range
    for day in data['multi_day_schedule']:
        try:
            day_int = int(day)
            if not (0 <= day_int <= 6):
                return False, f'Invalid day value: {day}. Must be between 0 (Monday) and 6 (Sunday)'
        except ValueError:
            return False, f'Invalid day value: {day}. Must be an integer'
    
    # Validate start_time and end_time
    if 'start_time' not in data or not data['start_time']:
        return False, 'start_time is required'
    
    if 'end_time' not in data or not data['end_time']:
        return False, 'end_time is required'
    
    return True, None
