from flask import Blueprint, request, jsonify
from datetime import datetime
from models import db

competition_bp = Blueprint('competition', __name__)

# Competition Submission Model
class CompetitionSubmission(db.Model):
    __tablename__ = 'competition_submissions'

    id = db.Column(db.Integer, primary_key=True)
    
    # Participation Type
    participation_type = db.Column(db.Enum('free', 'kindergarten'), default='free', nullable=False)
    kindergarten_name = db.Column(db.String(200), nullable=True)
    supervisor_name = db.Column(db.String(200), nullable=True)
    
    # Guardian Information
    guardian_first_name = db.Column(db.String(100), nullable=False)
    guardian_last_name = db.Column(db.String(100), nullable=False)
    
    # Child Information
    child_first_name = db.Column(db.String(100), nullable=False)
    child_last_name = db.Column(db.String(100), nullable=False)
    gender = db.Column(db.Enum('male', 'female'), nullable=False)
    birth_date = db.Column(db.Date, nullable=False)
    
    # Address
    address = db.Column(db.String(300), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    
    # Contact
    phone1 = db.Column(db.String(20), nullable=False)
    phone2 = db.Column(db.String(20), nullable=True)
    
    # Age Category
    age_category = db.Column(db.Enum('3', '4', '5'), nullable=False)
    
    # Status
    status = db.Column(db.Enum('pending', 'reviewed', 'approved', 'rejected'), default='pending')
    admin_notes = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert submission to dictionary"""
        # Calculate age
        today = datetime.now().date()
        age = today.year - self.birth_date.year
        if today.month < self.birth_date.month or (today.month == self.birth_date.month and today.day < self.birth_date.day):
            age -= 1
            
        return {
            'id': self.id,
            'participation_type': self.participation_type,
            'kindergarten_name': self.kindergarten_name,
            'supervisor_name': self.supervisor_name,
            'guardian_first_name': self.guardian_first_name,
            'guardian_last_name': self.guardian_last_name,
            'guardian_full_name': f"{self.guardian_first_name} {self.guardian_last_name}",
            'child_first_name': self.child_first_name,
            'child_last_name': self.child_last_name,
            'child_full_name': f"{self.child_first_name} {self.child_last_name}",
            'gender': self.gender,
            'birth_date': self.birth_date.isoformat() if self.birth_date else None,
            'age': age,
            'address': self.address,
            'city': self.city,
            'phone1': self.phone1,
            'phone2': self.phone2,
            'age_category': self.age_category,
            'status': self.status,
            'admin_notes': self.admin_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


@competition_bp.route('/submit', methods=['POST'])
def submit_competition_form():
    """Submit a new competition registration - No authentication required"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = [
            'guardian_first_name', 'guardian_last_name',
            'child_first_name', 'child_last_name',
            'gender', 'phone1', 'age_category',
            'birth_day', 'birth_month', 'birth_year'
        ]
        
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'الحقل مطلوب: {field}'}), 400
        
        # Parse birth date
        try:
            birth_date = datetime(
                int(data['birth_year']),
                int(data['birth_month']),
                int(data['birth_day'])
            ).date()
        except (ValueError, TypeError):
            return jsonify({'error': 'تاريخ الميلاد غير صحيح'}), 400
        
        # Validate participation type
        participation_type = data.get('participation_type', 'free')
        if participation_type == 'kindergarten' and not data.get('kindergarten_name'):
            return jsonify({'error': 'الرجاء إدخال اسم الروضة'}), 400
        
        # Create submission
        submission = CompetitionSubmission(
            participation_type=participation_type,
            kindergarten_name=data.get('kindergarten_name', ''),
            supervisor_name=data.get('supervisor_name', ''),
            guardian_first_name=data['guardian_first_name'],
            guardian_last_name=data['guardian_last_name'],
            child_first_name=data['child_first_name'],
            child_last_name=data['child_last_name'],
            gender=data['gender'],
            birth_date=birth_date,
            address=data.get('address', ''),
            city=data.get('city', ''),
            phone1=data['phone1'],
            phone2=data.get('phone2', ''),
            age_category=data['age_category'],
            status='pending'
        )
        
        db.session.add(submission)
        db.session.commit()
        
        return jsonify({
            'message': 'تم إرسال التسجيل بنجاح',
            'submission_id': submission.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting competition form: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء إرسال التسجيل'}), 500


@competition_bp.route('/submissions', methods=['GET'])
def get_competition_submissions():
    """Get all competition submissions - Admin only"""
    try:
        # Get query parameters for filtering
        status = request.args.get('status')
        age_category = request.args.get('age_category')
        search = request.args.get('search', '')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query
        query = CompetitionSubmission.query
        
        if status:
            query = query.filter(CompetitionSubmission.status == status)
        
        if age_category:
            query = query.filter(CompetitionSubmission.age_category == age_category)
        
        if search:
            search_pattern = f'%{search}%'
            query = query.filter(
                db.or_(
                    CompetitionSubmission.child_first_name.ilike(search_pattern),
                    CompetitionSubmission.child_last_name.ilike(search_pattern),
                    CompetitionSubmission.guardian_first_name.ilike(search_pattern),
                    CompetitionSubmission.guardian_last_name.ilike(search_pattern),
                    CompetitionSubmission.phone1.ilike(search_pattern),
                    CompetitionSubmission.kindergarten_name.ilike(search_pattern)
                )
            )
        
        # Order by newest first
        query = query.order_by(CompetitionSubmission.created_at.desc())
        
        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        submissions = [s.to_dict() for s in paginated.items]
        
        return jsonify({
            'submissions': submissions,
            'total': paginated.total,
            'pages': paginated.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        print(f"Error fetching competition submissions: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء جلب البيانات'}), 500


@competition_bp.route('/submissions/<int:submission_id>', methods=['GET'])
def get_submission_details(submission_id):
    """Get details of a specific submission"""
    try:
        submission = CompetitionSubmission.query.get_or_404(submission_id)
        return jsonify(submission.to_dict()), 200
    except Exception as e:
        print(f"Error fetching submission details: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء جلب البيانات'}), 500


@competition_bp.route('/submissions/<int:submission_id>/status', methods=['PUT'])
def update_submission_status(submission_id):
    """Update submission status - Admin only"""
    try:
        submission = CompetitionSubmission.query.get_or_404(submission_id)
        data = request.get_json()
        
        new_status = data.get('status')
        if new_status not in ['pending', 'reviewed', 'approved', 'rejected']:
            return jsonify({'error': 'حالة غير صالحة'}), 400
        
        submission.status = new_status
        
        if data.get('admin_notes'):
            submission.admin_notes = data['admin_notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'تم تحديث الحالة بنجاح',
            'submission': submission.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating submission status: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء تحديث الحالة'}), 500


@competition_bp.route('/submissions/<int:submission_id>', methods=['DELETE'])
def delete_submission(submission_id):
    """Delete a submission - Admin only"""
    try:
        submission = CompetitionSubmission.query.get_or_404(submission_id)
        
        db.session.delete(submission)
        db.session.commit()
        
        return jsonify({'message': 'تم حذف التسجيل بنجاح'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting submission: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء حذف التسجيل'}), 500


@competition_bp.route('/stats', methods=['GET'])
def get_competition_stats():
    """Get competition statistics - Admin only"""
    try:
        total = CompetitionSubmission.query.count()
        pending = CompetitionSubmission.query.filter_by(status='pending').count()
        reviewed = CompetitionSubmission.query.filter_by(status='reviewed').count()
        approved = CompetitionSubmission.query.filter_by(status='approved').count()
        rejected = CompetitionSubmission.query.filter_by(status='rejected').count()
        
        # By age category
        age_3 = CompetitionSubmission.query.filter_by(age_category='3').count()
        age_4 = CompetitionSubmission.query.filter_by(age_category='4').count()
        age_5 = CompetitionSubmission.query.filter_by(age_category='5').count()
        
        # By participation type
        free_count = CompetitionSubmission.query.filter_by(participation_type='free').count()
        kindergarten_count = CompetitionSubmission.query.filter_by(participation_type='kindergarten').count()
        
        # By gender
        male_count = CompetitionSubmission.query.filter_by(gender='male').count()
        female_count = CompetitionSubmission.query.filter_by(gender='female').count()
        
        return jsonify({
            'total': total,
            'by_status': {
                'pending': pending,
                'reviewed': reviewed,
                'approved': approved,
                'rejected': rejected
            },
            'by_age_category': {
                '3': age_3,
                '4': age_4,
                '5': age_5
            },
            'by_participation_type': {
                'free': free_count,
                'kindergarten': kindergarten_count
            },
            'by_gender': {
                'male': male_count,
                'female': female_count
            }
        }), 200
        
    except Exception as e:
        print(f"Error fetching competition stats: {str(e)}")
        return jsonify({'error': 'حدث خطأ أثناء جلب الإحصائيات'}), 500
